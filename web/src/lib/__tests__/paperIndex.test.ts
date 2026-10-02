import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IndexUnavailableError,
  PaperIndex,
  latestIndexDate,
  selectShards,
  windowStart,
} from "../paperIndex";
import type { LoadProgress } from "../paperIndex";
import type { IndexManifest, Paper } from "../types";

function makePaper(id: string, published: string): Paper {
  return {
    id,
    title: `Paper ${id}`,
    authors: ["Ada Lovelace"],
    abstract: "An abstract.",
    abstractTruncated: false,
    published,
    updated: published,
    categories: ["cs.CV"],
    primaryCategory: "cs.CV",
    absUrl: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
  };
}

const MANIFEST: IndexManifest = {
  generatedAt: "2024-03-01T00:00:00Z",
  retentionDays: 60,
  categories: ["cs.CV"],
  shards: [
    {
      week: "2024-W09",
      from: "2024-02-26",
      to: "2024-03-03",
      count: 2,
      file: "papers-2024-W09.json",
    },
    {
      week: "2024-W08",
      from: "2024-02-19",
      to: "2024-02-25",
      count: 1,
      file: "papers-2024-W08.json",
    },
    {
      week: "2024-W05",
      from: "2024-01-29",
      to: "2024-02-04",
      count: 1,
      file: "papers-2024-W05.json",
    },
  ],
  totalPapers: 4,
};

const SHARDS: Record<string, unknown> = {
  "papers-2024-W09.json": {
    week: "2024-W09",
    from: "2024-02-26",
    to: "2024-03-03",
    papers: [makePaper("w09a", "2024-03-01"), makePaper("w09b", "2024-02-27")],
  },
  "papers-2024-W08.json": {
    week: "2024-W08",
    from: "2024-02-19",
    to: "2024-02-25",
    papers: [makePaper("w08a", "2024-02-20")],
  },
  "papers-2024-W05.json": {
    week: "2024-W05",
    from: "2024-01-29",
    to: "2024-02-04",
    papers: [
      makePaper("w05-old", "2024-01-30"),
      makePaper("w05-edge", "2024-02-03"),
    ],
  },
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetch(shards: Record<string, unknown> = SHARDS) {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/index.json")) {
      return jsonResponse(MANIFEST);
    }
    const file = url.split("/").pop() ?? "";
    if (file in shards) {
      return jsonResponse(shards[file]);
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function defer<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("manifest helpers", () => {
  it("finds the newest date across shards", () => {
    expect(latestIndexDate(MANIFEST)).toBe("2024-03-03");
  });

  it("computes a window start offset from the reference date", () => {
    expect(windowStart("2024-03-03", 7)).toBe("2024-02-25");
  });

  it("selects only shards that can overlap the window", () => {
    const files = selectShards(MANIFEST, "2024-02-25").map((s) => s.file);
    expect(files).toEqual([
      "papers-2024-W09.json",
      "papers-2024-W08.json",
    ]);
  });
});

describe("PaperIndex", () => {
  it("throws a descriptive error when the manifest is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 })),
    );
    await expect(new PaperIndex().getManifest()).rejects.toBeInstanceOf(
      IndexUnavailableError,
    );
  });

  it("wraps network failures in IndexUnavailableError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(new PaperIndex().getManifest()).rejects.toBeInstanceOf(
      IndexUnavailableError,
    );
  });

  it("retries the manifest after a rejection instead of memoizing it", async () => {
    const mock = vi.fn(async () => jsonResponse(MANIFEST));
    mock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", mock);

    const index = new PaperIndex();
    await expect(index.getManifest()).rejects.toBeInstanceOf(
      IndexUnavailableError,
    );
    await expect(index.getManifest()).resolves.toEqual(MANIFEST);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("treats an HTML fallback for a missing manifest as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<!doctype html><title>fallback</title>", {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }),
      ),
    );
    await expect(new PaperIndex().getManifest()).rejects.toBeInstanceOf(
      IndexUnavailableError,
    );
  });

  it("loads overlapping shards and filters to the exact window", async () => {
    installFetch();
    const papers = await new PaperIndex().loadPapers(30);
    const ids = papers.map((paper) => paper.id);
    expect(ids).toContain("w09a");
    expect(ids).toContain("w08a");
    expect(ids).toContain("w05-edge");
    expect(ids).not.toContain("w05-old");
  });

  it("returns papers newest first", async () => {
    installFetch();
    const papers = await new PaperIndex().loadPapers(30);
    expect(papers[0].id).toBe("w09a");
    expect(papers[papers.length - 1].id).toBe("w05-edge");
  });

  it("reports progress and caches loaded shards", async () => {
    const mock = installFetch();
    const index = new PaperIndex();
    const progress: number[] = [];
    await index.loadPapers(7, (p) => progress.push(p.loaded));
    expect(progress[progress.length - 1]).toBe(2);

    const callsAfterFirstLoad = mock.mock.calls.length;
    await index.loadPapers(7);
    expect(mock.mock.calls.length).toBe(callsAfterFirstLoad);
  });

  it("returns an empty list when the manifest has no shards", async () => {
    installFetch();
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL) =>
        String(input).endsWith("/index.json")
          ? jsonResponse({ ...MANIFEST, shards: [], totalPapers: 0 })
          : new Response("not found", { status: 404 }),
    );
    expect(await new PaperIndex().loadPapers(7)).toEqual([]);
  });

  it("refetches the manifest on refresh, even after it resolved", async () => {
    const mock = vi.fn(async () => jsonResponse(MANIFEST));
    vi.stubGlobal("fetch", mock);

    const index = new PaperIndex();
    await expect(index.getManifest()).resolves.toEqual(MANIFEST);
    expect(mock).toHaveBeenCalledTimes(1);
    await expect(index.refreshManifest()).resolves.toEqual(MANIFEST);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("shares an in-flight manifest request with a retry instead of duplicating it", async () => {
    const gate = defer<Response>();
    const mock = vi.fn(() => gate.promise);
    vi.stubGlobal("fetch", mock);

    const index = new PaperIndex();
    const first = index.getManifest();
    const retried = index.refreshManifest();
    expect(mock).toHaveBeenCalledTimes(1);

    gate.resolve(jsonResponse(MANIFEST));
    await expect(first).resolves.toEqual(MANIFEST);
    await expect(retried).resolves.toEqual(MANIFEST);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("refetches the manifest on refresh after a rejection", async () => {
    const mock = vi.fn(async () => jsonResponse(MANIFEST));
    mock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", mock);

    const index = new PaperIndex();
    await expect(index.getManifest()).rejects.toBeInstanceOf(
      IndexUnavailableError,
    );
    await expect(index.refreshManifest()).resolves.toEqual(MANIFEST);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("leaves the memo holding the refreshed manifest for later callers", async () => {
    const fresh: IndexManifest = {
      generatedAt: "2024-03-08T00:00:00Z",
      retentionDays: 60,
      categories: ["cs.CV"],
      shards: [
        {
          week: "2024-W10",
          from: "2024-03-04",
          to: "2024-03-09",
          count: 1,
          file: "papers-2024-W10.json",
        },
      ],
      totalPapers: 1,
    };
    let manifestRequests = 0;
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/index.json")) {
        manifestRequests += 1;
        return jsonResponse(manifestRequests === 1 ? MANIFEST : fresh);
      }
      if (url.endsWith("papers-2024-W10.json")) {
        return jsonResponse({
          papers: [makePaper("w10a", "2024-03-08")],
        });
      }
      const file = url.split("/").pop() ?? "";
      if (file in SHARDS) {
        return jsonResponse(SHARDS[file]);
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", mock);

    const index = new PaperIndex();
    expect(await index.getManifest()).toEqual(MANIFEST);
    expect(await index.refreshManifest()).toEqual(fresh);

    // loadPapers must consume the refreshed memo, not the original manifest,
    // and must not trigger a third index.json request.
    const papers = await index.loadPapers(30);
    expect(papers.map((paper) => paper.id)).toEqual(["w10a"]);
    expect(manifestRequests).toBe(2);
  });

  it("recovers via refreshManifest after every manifest failure mode", async () => {
    const failures: Array<[string, () => Response]> = [
      [
        "a network error",
        () => {
          throw new TypeError("Failed to fetch");
        },
      ],
      [
        "an HTML SPA fallback",
        () =>
          new Response("<!doctype html><title>fallback</title>", {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }),
      ],
      ["a 404", () => new Response("not found", { status: 404 })],
      [
        "a malformed body",
        () =>
          new Response("<html>", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ],
    ];

    for (const [label, respond] of failures) {
      let requests = 0;
      const mock = vi.fn(async () => {
        requests += 1;
        return requests === 1 ? respond() : jsonResponse(MANIFEST);
      });
      vi.stubGlobal("fetch", mock);

      const index = new PaperIndex();
      await expect(index.getManifest(), label).rejects.toBeInstanceOf(
        IndexUnavailableError,
      );
      await expect(index.refreshManifest(), label).resolves.toEqual(MANIFEST);
      expect(mock, label).toHaveBeenCalledTimes(2);
    }
  });
});

/** A 7-day window from the fixture manifest needs exactly W09 and W08. */
const TWO_SHARD_WINDOW = 7;

describe("PaperIndex partial shard failures", () => {
  it("keeps the shards that loaded when one shard 404s", async () => {
    installFetch({ "papers-2024-W09.json": SHARDS["papers-2024-W09.json"] });

    const result = await new PaperIndex().loadPapers(TWO_SHARD_WINDOW);

    // Still the plain list the app consumes, and the same papers `Promise.all`
    // used to throw away along with the failed week.
    expect(Array.isArray(result)).toBe(true);
    expect(result.map((paper) => paper.id)).toEqual(["w09a", "w09b"]);
    expect(result.papers.map((paper) => paper.id)).toEqual(["w09a", "w09b"]);
    expect(result.failedFiles).toEqual([
      {
        file: "papers-2024-W08.json",
        message: "Failed to load papers-2024-W08.json (HTTP 404).",
      },
    ]);
  });

  it("keeps the shards that loaded when one shard has a malformed body", async () => {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/index.json")) {
        return jsonResponse(MANIFEST);
      }
      if (url.endsWith("papers-2024-W08.json")) {
        return new Response("<html>not json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return jsonResponse(SHARDS["papers-2024-W09.json"]);
    });
    vi.stubGlobal("fetch", mock);

    const result = await new PaperIndex().loadPapers(TWO_SHARD_WINDOW);

    expect(result.map((paper) => paper.id)).toEqual(["w09a", "w09b"]);
    expect(result.failedFiles).toEqual([
      {
        file: "papers-2024-W08.json",
        message:
          "Shard papers-2024-W08.json is missing or malformed. Try regenerating the index.",
      },
    ]);
  });

  it("reports every failed shard, not only the first", async () => {
    installFetch({ "papers-2024-W09.json": SHARDS["papers-2024-W09.json"] });

    const result = await new PaperIndex().loadPapers(30);

    expect(result.map((paper) => paper.id)).toEqual(["w09a", "w09b"]);
    expect(result.failedFiles.map((failure) => failure.file)).toEqual([
      "papers-2024-W08.json",
      "papers-2024-W05.json",
    ]);
  });

  it("rejects when every shard in the window fails", async () => {
    installFetch({});

    await expect(
      new PaperIndex().loadPapers(TWO_SHARD_WINDOW),
    ).rejects.toThrow("Failed to load papers-2024-W09.json (HTTP 404).");
  });

  it("still rejects when the manifest fails, even though shards are involved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        return url.endsWith("/index.json")
          ? new Response("not found", { status: 404 })
          : jsonResponse(SHARDS["papers-2024-W09.json"]);
      }),
    );

    await expect(
      new PaperIndex().loadPapers(TWO_SHARD_WINDOW),
    ).rejects.toBeInstanceOf(IndexUnavailableError);
  });

  it("reports no failures when every shard loads", async () => {
    installFetch();

    const result = await new PaperIndex().loadPapers(TWO_SHARD_WINDOW);

    expect(result.failedFiles).toEqual([]);
    expect(result.papers).toHaveLength(2);
  });

  it("retries a failed shard on the next load instead of caching the failure", async () => {
    // W08 carries a paper inside the 7-day window so a recovered shard has
    // something visible to contribute.
    const recovered = { papers: [makePaper("w08-fresh", "2024-02-26")] };
    let w08available = false;
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/index.json")) {
        return jsonResponse(MANIFEST);
      }
      const file = url.split("/").pop() ?? "";
      if (file === "papers-2024-W08.json") {
        return w08available
          ? jsonResponse(recovered)
          : new Response("server error", { status: 500 });
      }
      if (file in SHARDS) {
        return jsonResponse(SHARDS[file]);
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", mock);

    const index = new PaperIndex();
    const first = await index.loadPapers(TWO_SHARD_WINDOW);
    expect(first.map((paper) => paper.id)).toEqual(["w09a", "w09b"]);
    expect(first.failedFiles.map((failure) => failure.file)).toEqual([
      "papers-2024-W08.json",
    ]);

    // The shard recovers on the next load, and the week that already loaded is
    // still served from the cache.
    w08available = true;
    const requestsAfterFirstLoad = mock.mock.calls.length;
    const second = await index.loadPapers(TWO_SHARD_WINDOW);
    expect(second.map((paper) => paper.id)).toEqual(["w09a", "w09b", "w08-fresh"]);
    expect(second.failedFiles).toEqual([]);
    expect(mock.mock.calls.length - requestsAfterFirstLoad).toBe(1);
  });

  it("counts only the shards that loaded toward progress", async () => {
    installFetch({ "papers-2024-W09.json": SHARDS["papers-2024-W09.json"] });

    const progress: LoadProgress[] = [];
    await new PaperIndex().loadPapers(TWO_SHARD_WINDOW, (next) =>
      progress.push(next),
    );

    expect(progress).toEqual([
      { loaded: 0, total: 2 },
      { loaded: 1, total: 2 },
    ]);
  });

  it("returns no failures for an empty manifest instead of throwing", async () => {
    installFetch();
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL) =>
        String(input).endsWith("/index.json")
          ? jsonResponse({ ...MANIFEST, shards: [], totalPapers: 0 })
          : new Response("not found", { status: 404 }),
    );

    const result = await new PaperIndex().loadPapers(TWO_SHARD_WINDOW);

    expect(result).toEqual([]);
    expect(result.failedFiles).toEqual([]);
  });
});
