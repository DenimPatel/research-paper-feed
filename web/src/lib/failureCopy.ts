import { IndexUnavailableError, ShardLoadError } from "./paperIndex";

/**
 * A load failure in two registers: the sentence a reader can act on, and the
 * technical cause — file name, HTTP status, whatever the stack threw.
 *
 * The split is the whole point. `Failed to load papers-2024-W14.json (HTTP 404).`
 * is worth keeping for whoever is debugging a deploy and is worth nothing to a
 * reader who just wants their feed, so it is preserved in `detail` and never in
 * `message`.
 */
export interface LoadFailureNotice {
  /** Plain, reader-facing copy. Safe to render as the primary visible text. */
  readonly message: string;
  /** The technical cause. For a `title` attribute and for `console.error`. */
  readonly detail: string;
}

/**
 * The index could not be fetched at all: a network error, a 404, or the HTML
 * page a static host answers a missing file with. The panels that render this
 * already say the index is missing, so it adds the part a reader cannot guess —
 * that it is a transient condition and that waiting is a real option.
 */
const INDEX_UNAVAILABLE =
  "The paper index could not be loaded, so there is no feed to show. This is " +
  "usually temporary, and the page will start working once the index is " +
  "available again.";

/**
 * The index arrived and could not be read. Unlike the state above, retrying does
 * not fix it, so saying so is the useful thing to do — the alternative is a
 * reader clicking Try again until they give up.
 */
const INDEX_MALFORMED =
  "The paper index on this site could not be read, so there is no feed to " +
  "show. This is a problem with the site's published data rather than with " +
  "your browser, so trying again will not help until the index is rebuilt.";

/**
 * A week of papers did not arrive. True for every shard failure, whether the
 * request was refused or the body was unreadable, and deliberately says nothing
 * about *which* week or how many: that is a per-week question the partial-shard
 * notice answers, and a hard failure has no week left to name.
 */
const SHARD_UNAVAILABLE =
  "Some of the paper data could not be fetched. This is usually temporary, and " +
  "it does not mean the papers are missing.";

/** Nothing recognizable was thrown. Honest about the ignorance on purpose. */
const UNKNOWN =
  "Something went wrong while loading papers. This is usually temporary.";

/**
 * The index is on screen but does not cover everything it was built for. Three
 * things can happen to a build and only one of them is visible to a reader who
 * is not looking at a pipeline: a category whose query died, and a category the
 * per-category cap cut short. Both land in `index.json` (`build_index.py`), and
 * this is where they become something a person reads.
 */
export interface IncompleteIndexNotice {
  /** The label the banner leads with, and the notice's accessible name. */
  readonly headline: string;
  /** The reader-facing sentence that follows the label. */
  readonly prose: string;
  /** The category lists verbatim, for `title` and for debugging. */
  readonly detail: string;
}

/** Keeps a manifest value usable as a category list without trusting it. */
function categoryNames(value: readonly string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (name): name is string => typeof name === "string" && name.length > 0,
  );
}

/**
 * Describe an index that is missing a category or holding a short one, in the
 * order that matters to a reader: what is absent, then what may be.
 *
 * Returns `null` when there is nothing to report, so the caller can gate on the
 * answer itself and a complete index renders exactly the screen it always did.
 * A category that failed and one that was capped get different sentences
 * because they are different problems: papers that are gone versus papers that
 * might be.
 */
export function describeIncompleteIndex(
  failed?: readonly string[],
  truncated?: readonly string[],
): IncompleteIndexNotice | null {
  const missing = categoryNames(failed);
  const short = categoryNames(truncated).filter(
    (name) => !missing.includes(name),
  );
  if (missing.length === 0 && short.length === 0) {
    return null;
  }

  const sentences: string[] = [];
  if (missing.length > 0) {
    sentences.push(
      `${missing.join(", ")} could not be fetched from arXiv when this index ` +
        `was built, so ${missing.length === 1 ? "it has" : "they have"} no ` +
        `papers here and ${missing.length === 1 ? "no filter" : "no filters"} ` +
        `to browse.`,
    );
  }
  if (short.length > 0) {
    sentences.push(
      `${short.join(", ")} ${short.length === 1 ? "was" : "were"} cut off at ` +
        `this index's per-category limit, so older papers from ` +
        `${short.length === 1 ? "it" : "them"} may be missing.`,
    );
  }

  return {
    headline: "This index is incomplete",
    prose: sentences.join(" "),
    detail: [
      missing.length > 0 ? `failed: ${missing.join(", ")}` : "",
      short.length > 0 ? `truncated: ${short.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/**
 * Turn whatever a load rejected with into the pair a screen can render. The
 * cause is classified by type, never by matching on the message, so rewording
 * `paperIndex.ts` cannot silently change which sentence a reader gets.
 *
 * `detail` is always the original text, so nothing is discarded: a caller that
 * wants the file name and the status still has both.
 */
export function describeLoadFailure(cause: unknown): LoadFailureNotice {
  const detail = cause instanceof Error ? cause.message : String(cause);
  if (cause instanceof IndexUnavailableError) {
    return {
      message:
        cause.kind === "malformed" ? INDEX_MALFORMED : INDEX_UNAVAILABLE,
      detail,
    };
  }
  if (cause instanceof ShardLoadError) {
    return { message: SHARD_UNAVAILABLE, detail };
  }
  return { message: UNKNOWN, detail };
}
