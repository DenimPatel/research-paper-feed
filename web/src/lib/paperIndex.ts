import type {
  IndexManifest,
  Paper,
  RecencyDays,
  ShardFile,
  ShardManifestEntry,
} from "./types";

export class IndexUnavailableError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "IndexUnavailableError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export interface LoadProgress {
  loaded: number;
  total: number;
}

/** A shard that could not be loaded, named so the missing week is reportable. */
export interface ShardLoadFailure {
  readonly file: string;
  readonly message: string;
}

/**
 * What `loadPapers` resolves to: the papers from every shard that loaded, with
 * the shards that did not riding along. It is still the `Paper[]` callers have
 * always received — `papers` is that same array — so `setPapers(result)` and
 * `result.length` keep working, while a caller that has to tell the user which
 * week is missing reads `failedFiles` instead of guessing. Both properties are
 * non-enumerable, so the result still compares equal to a bare list.
 */
export type PapersLoadResult = Paper[] & {
  readonly papers: Paper[];
  readonly failedFiles: ShardLoadFailure[];
};

function papersResult(
  papers: Paper[],
  failedFiles: ShardLoadFailure[],
): PapersLoadResult {
  const result = papers as PapersLoadResult;
  Object.defineProperties(result, {
    papers: { value: result, enumerable: false },
    failedFiles: { value: failedFiles, enumerable: false },
  });
  return result;
}

const INDEX_HELP =
  "No paper index was found. Run `python scripts/build_index.py` locally, " +
  "or wait for the scheduled GitHub Action that builds and deploys the index.";

function dataBase(): string {
  const base = import.meta.env?.BASE_URL ?? "/";
  return `${base.replace(/\/$/, "")}/data`;
}

/** Newest publication date represented anywhere in the manifest. */
export function latestIndexDate(manifest: IndexManifest): string | null {
  let latest: string | null = null;
  for (const shard of manifest.shards) {
    if (shard.to && (latest === null || shard.to > latest)) {
      latest = shard.to;
    }
  }
  return latest;
}

/** ISO date ``days`` before ``referenceDate``. */
export function windowStart(referenceDate: string, days: number): string {
  const date = new Date(`${referenceDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Shards that can contain papers published on or after ``start``. */
export function selectShards(
  manifest: IndexManifest,
  start: string,
): ShardManifestEntry[] {
  return manifest.shards.filter((shard) => shard.to && shard.to >= start);
}

export class PaperIndex {
  private manifestPromise: Promise<IndexManifest> | null = null;

  private manifestSettled = false;

  private shardCache = new Map<string, Paper[]>();

  async getManifest(): Promise<IndexManifest> {
    if (!this.manifestPromise) {
      this.manifestSettled = false;
      this.manifestPromise = this.fetchManifest().then(
        (manifest) => {
          this.manifestSettled = true;
          return manifest;
        },
        // Clear the memoized promise on failure so a retry refetches instead of
        // replaying the same rejection forever.
        (error: unknown) => {
          this.manifestPromise = null;
          throw error;
        },
      );
    }
    return this.manifestPromise;
  }

  /**
   * Fetch the manifest again for an explicit retry. A memo that already
   * resolved is dropped so the retry really re-asks the network; a request that
   * is still in flight is shared with the caller instead of duplicated.
   */
  refreshManifest(): Promise<IndexManifest> {
    if (this.manifestSettled) {
      this.manifestPromise = null;
      this.manifestSettled = false;
    }
    return this.getManifest();
  }

  private async fetchManifest(): Promise<IndexManifest> {
    const url = `${dataBase()}/index.json`;
    let response: Response;
    try {
      response = await fetch(url, { cache: "no-cache" });
    } catch (error) {
      throw new IndexUnavailableError(INDEX_HELP, { cause: error });
    }
    const contentType = response.headers.get("content-type") ?? "";
    // Static hosts (and Vite's dev SPA fallback) answer a missing file with an
    // HTML page, sometimes with a 200. Treat that as "not built yet" instead of
    // surfacing a confusing parse error.
    if (!response.ok || contentType.includes("text/html")) {
      throw new IndexUnavailableError(
        `${INDEX_HELP} (HTTP ${response.status})`,
      );
    }
    try {
      return (await response.json()) as IndexManifest;
    } catch (error) {
      throw new IndexUnavailableError(
        "The paper index is malformed and could not be parsed.",
        { cause: error },
      );
    }
  }

  private async loadShard(shard: ShardManifestEntry): Promise<Paper[]> {
    const cached = this.shardCache.get(shard.file);
    if (cached) {
      return cached;
    }
    const response = await fetch(`${dataBase()}/${shard.file}`);
    if (!response.ok) {
      throw new Error(
        `Failed to load ${shard.file} (HTTP ${response.status}).`,
      );
    }
    const data = (await response.json().catch(() => null)) as
      | ShardFile
      | Paper[]
      | null;
    const papers = Array.isArray(data)
      ? data
      : data && Array.isArray(data.papers)
        ? data.papers
        : null;
    if (!papers) {
      throw new Error(
        `Shard ${shard.file} is missing or malformed. Try regenerating the index.`,
      );
    }
    this.shardCache.set(shard.file, papers);
    return papers;
  }

  /**
   * Load every shard overlapping the last ``days`` and return the papers
   * published within that exact window, newest first. Shards are cached, so
   * widening the window only fetches the newly needed weeks.
   *
   * A shard that fails is not fatal: the papers from the shards that did load
   * are returned and the failures ride along in `failedFiles`, because one 404,
   * one corrupt body, or one transient 500 must degrade the feed instead of
   * discarding every other week. Nothing is cached for a failed shard, so the
   * next load retries it and a transient failure heals itself.
   *
   * Two failures stay fatal. A failed *manifest* throws from `getManifest`
   * before this method reaches a shard, because there is nothing to show
   * without it; and a window in which every shard failed throws rather than
   * resolving to an empty list the user would read as "no papers yet".
   */
  async loadPapers(
    days: RecencyDays | number,
    onProgress?: (progress: LoadProgress) => void,
  ): Promise<PapersLoadResult> {
    const manifest = await this.getManifest();
    const reference = latestIndexDate(manifest);
    if (!reference) {
      return papersResult([], []);
    }
    const start = windowStart(reference, days);
    const needed = selectShards(manifest, start);

    const total = needed.length;
    let loaded = 0;
    onProgress?.({ loaded, total });

    // `allSettled`, not `all`: one rejected shard must not discard the rest.
    const settled = await Promise.allSettled(
      needed.map(async (shard) => {
        const papers = await this.loadShard(shard);
        loaded += 1;
        onProgress?.({ loaded, total });
        return papers;
      }),
    );

    const batches: Paper[][] = [];
    const failedFiles: ShardLoadFailure[] = [];
    let firstReason: unknown;
    for (const [position, outcome] of settled.entries()) {
      if (outcome.status === "fulfilled") {
        batches.push(outcome.value);
        continue;
      }
      firstReason ??= outcome.reason;
      failedFiles.push({
        file: needed[position].file,
        message:
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason),
      });
    }

    if (total > 0 && failedFiles.length === total) {
      // Every shard in the window failed, so reject exactly as `Promise.all`
      // used to — with the first shard's own error — rather than resolving to
      // an empty feed that reads as "no papers in this window yet".
      throw firstReason;
    }

    return papersResult(
      batches
        .flat()
        .filter((paper) => paper.published && paper.published >= start)
        .sort((a, b) => (a.published < b.published ? 1 : -1)),
      failedFiles,
    );
  }
}
