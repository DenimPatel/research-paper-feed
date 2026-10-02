import { describe, expect, it } from "vitest";
import {
  COLLECTIONS_KEY,
  EMPTY_STATE,
  PAPERS_KEY,
  collectionsReducer,
  createCollection,
  exportCollection,
  loadState,
  parseExportPayload,
  saveState,
  type CollectionsState,
  type ExportPayload,
} from "../collections";
import type { Paper } from "../types";

function makePaper(id: string, overrides: Partial<Paper> = {}): Paper {
  return {
    id,
    title: `Paper ${id}`,
    authors: ["Ada Lovelace"],
    abstract: "An abstract.",
    abstractTruncated: false,
    published: "2024-01-08",
    updated: "2024-01-08",
    categories: ["cs.CV"],
    primaryCategory: "cs.CV",
    absUrl: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    ...overrides,
  };
}

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const THROWING_STORAGE = {
  get length(): number {
    throw new Error("blocked");
  },
  clear(): void {
    throw new Error("blocked");
  },
  getItem(): string | null {
    throw new Error("blocked");
  },
  key(): string | null {
    throw new Error("blocked");
  },
  removeItem(): void {
    throw new Error("blocked");
  },
  setItem(): void {
    throw new Error("blocked");
  },
} as unknown as Storage;

/**
 * A quota that is exhausted by the time `saveState` reaches `PAPERS_KEY`. Reads
 * succeed and the first write lands, so this is the fill-up-the-quota shape of
 * `DOMException("…", "QuotaExceededError")` rather than `THROWING_STORAGE`'s
 * storage-disabled one. `writes` records the keys in order and `succeed()` makes
 * the store writable again, which is how the caller recovers.
 */
function quotaStorage(): { storage: Storage; writes: string[]; succeed(): void } {
  const writes: string[] = [];
  let full = true;
  const store = new Map<string, string>();
  const storage = {
    get length(): number {
      return store.size;
    },
    clear(): void {
      store.clear();
    },
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    setItem(key: string, value: string): void {
      writes.push(key);
      if (full && key === PAPERS_KEY) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      store.set(key, value);
    },
  } satisfies Storage;
  return { storage, writes, succeed: () => (full = false) };
}

describe("createCollection", () => {
  it("builds an empty named collection", () => {
    const collection = createCollection("Vision", "2024-01-08T00:00:00Z", "id-1");
    expect(collection).toEqual({
      id: "id-1",
      name: "Vision",
      createdAt: "2024-01-08T00:00:00Z",
      paperIds: [],
    });
  });
});

describe("collectionsReducer", () => {
  it("adds a paper to a collection and snapshots it", () => {
    const collection = createCollection("Vision", "2024-01-08", "c1");
    const paper = makePaper("2401.00001");
    const state = collectionsReducer(EMPTY_STATE, {
      type: "addCollection",
      collection,
    });
    const next = collectionsReducer(state, {
      type: "addPaper",
      collectionId: "c1",
      paper,
    });
    expect(next.collections[0].paperIds).toEqual(["2401.00001"]);
    expect(next.papers["2401.00001"]).toEqual(paper);
  });

  it("does not add the same paper twice", () => {
    const collection = createCollection("Vision", "2024-01-08", "c1");
    const paper = makePaper("2401.00001");
    let state: CollectionsState = collectionsReducer(EMPTY_STATE, {
      type: "addCollection",
      collection,
    });
    state = collectionsReducer(state, {
      type: "addPaper",
      collectionId: "c1",
      paper,
    });
    state = collectionsReducer(state, {
      type: "addPaper",
      collectionId: "c1",
      paper,
    });
    expect(state.collections[0].paperIds).toEqual(["2401.00001"]);
  });

  it("renames a collection but ignores blank names", () => {
    const collection = createCollection("Vision", "2024-01-08", "c1");
    let state = collectionsReducer(EMPTY_STATE, {
      type: "addCollection",
      collection,
    });
    state = collectionsReducer(state, {
      type: "renameCollection",
      id: "c1",
      name: "  Robotics  ",
    });
    expect(state.collections[0].name).toBe("Robotics");
    state = collectionsReducer(state, {
      type: "renameCollection",
      id: "c1",
      name: "   ",
    });
    expect(state.collections[0].name).toBe("Robotics");
  });

  it("prunes orphaned paper snapshots when removing the last reference", () => {
    let state = collectionsReducer(EMPTY_STATE, {
      type: "addCollection",
      collection: createCollection("A", "2024-01-08", "c1"),
    });
    state = collectionsReducer(state, {
      type: "addCollection",
      collection: createCollection("B", "2024-01-08", "c2"),
    });
    const paper = makePaper("2401.00001");
    state = collectionsReducer(state, {
      type: "addPaper",
      collectionId: "c1",
      paper,
    });
    state = collectionsReducer(state, {
      type: "addPaper",
      collectionId: "c2",
      paper,
    });

    state = collectionsReducer(state, {
      type: "removePaper",
      collectionId: "c1",
      paperId: paper.id,
    });
    expect(state.papers[paper.id]).toBeDefined();

    state = collectionsReducer(state, {
      type: "removePaper",
      collectionId: "c2",
      paperId: paper.id,
    });
    expect(state.papers[paper.id]).toBeUndefined();
  });

  it("merges an import without clobbering an existing collection id", () => {
    const existing = createCollection("Existing", "2024-01-08", "c1");
    let state = collectionsReducer(EMPTY_STATE, {
      type: "addCollection",
      collection: existing,
    });
    const importedPaper = makePaper("2401.99999");
    const payload = {
      version: 1 as const,
      exportedAt: "2024-02-01",
      collection: {
        id: "c1",
        name: "Imported",
        createdAt: "2024-02-01",
        paperIds: ["2401.99999"],
      },
      papers: [importedPaper],
    };
    state = collectionsReducer(state, { type: "mergeImport", payload });
    expect(state.collections).toHaveLength(1);
    expect(state.collections[0].name).toBe("Existing");
    expect(state.papers["2401.99999"]).toEqual(importedPaper);
  });
});

describe("exportCollection", () => {
  it("returns the collection plus full paper snapshots", () => {
    const collection = createCollection("Vision", "2024-01-08", "c1");
    const paper = makePaper("2401.00001");
    let state = collectionsReducer(EMPTY_STATE, {
      type: "addCollection",
      collection,
    });
    state = collectionsReducer(state, {
      type: "addPaper",
      collectionId: "c1",
      paper,
    });
    const payload = exportCollection(state, "c1", "2024-02-01T00:00:00Z");
    expect(payload?.papers).toEqual([paper]);
    expect(payload?.version).toBe(1);
  });

  it("returns null for an unknown collection", () => {
    expect(exportCollection(EMPTY_STATE, "missing")).toBeNull();
  });
});

describe("parseExportPayload", () => {
  it("accepts a valid payload", () => {
    const payload = parseExportPayload({
      version: 1,
      exportedAt: "2024-02-01",
      collection: {
        id: "c1",
        name: "Vision",
        createdAt: "2024-01-08",
        paperIds: ["2401.00001"],
      },
      papers: [makePaper("2401.00001")],
    });
    expect(payload?.collection.name).toBe("Vision");
    expect(payload?.papers).toHaveLength(1);
  });

  it("drops papers whose urls are not http(s) and keeps valid siblings", () => {
    const payload = parseExportPayload({
      version: 1,
      exportedAt: "2024-02-01",
      collection: {
        id: "c1",
        name: "Vision",
        createdAt: "2024-01-08",
        paperIds: ["2401.00001", "2401.12345", "2401.99999"],
      },
      papers: [
        makePaper("2401.00001"),
        makePaper("2401.12345"),
        makePaper("2401.99999", { absUrl: "javascript:alert(1)" }),
        makePaper("2401.88888", { pdfUrl: "javascript:alert(1)" }),
      ],
    });
    expect(payload?.papers.map((paper) => paper.id)).toEqual([
      "2401.00001",
      "2401.12345",
    ]);
    expect(
      parseExportPayload({
        collection: { id: "c1", name: "Vision", paperIds: [] },
        papers: [makePaper("2401.99999", { absUrl: "javascript:alert(1)" })],
      })?.papers,
    ).toEqual([]);
  });

  it("keeps an https paper url", () => {
    const payload = parseExportPayload({
      version: 1,
      exportedAt: "2024-02-01",
      collection: {
        id: "c1",
        name: "Vision",
        createdAt: "2024-01-08",
        paperIds: ["2401.12345"],
      },
      papers: [
        makePaper("2401.12345", { absUrl: "https://arxiv.org/abs/2401.12345" }),
      ],
    });
    expect(payload?.papers).toHaveLength(1);
    expect(payload?.papers[0].absUrl).toBe("https://arxiv.org/abs/2401.12345");
  });

  it("drops invalid papers and rejects malformed payloads", () => {
    const payload = parseExportPayload({
      collection: { id: "c1", name: "Vision", paperIds: [] },
      papers: [{ nope: true }],
    });
    expect(payload?.papers).toEqual([]);
    expect(parseExportPayload(null)).toBeNull();
    expect(parseExportPayload({ collection: {}, papers: [] })).toBeNull();
    expect(
      parseExportPayload({ collection: { id: "c1", name: "V", paperIds: [] } }),
    ).toBeNull();
  });

  it("drops papers whose id is an inherited Object.prototype key", () => {
    const payload = parseExportPayload({
      version: 1,
      exportedAt: "2024-02-01",
      collection: {
        id: "c1",
        name: "Vision",
        createdAt: "2024-01-08",
        paperIds: ["__proto__", "constructor", "prototype", "2401.00001"],
      },
      papers: [
        { id: "__proto__", title: "proto", authors: [], abstract: "x" },
        makePaper("constructor"),
        makePaper("prototype"),
        makePaper("2401.00001"),
      ],
    });
    expect(payload?.papers.map((paper) => paper.id)).toEqual(["2401.00001"]);
    expect(
      parseExportPayload({
        collection: {
          id: "c1",
          name: "Vision",
          createdAt: "2024-01-08",
          paperIds: ["__proto__"],
        },
        papers: [{ id: "__proto__", title: "proto", authors: [], abstract: "x" }],
      })?.papers,
    ).toEqual([]);
  });
});

describe("prototype-keyed import payloads", () => {
  const PROTO_PAPER = {
    id: "__proto__",
    title: "proto",
    authors: [],
    abstract: "x",
  };

  function protoPayload() {
    return {
      version: 1 as const,
      exportedAt: "2024-02-01",
      collection: {
        id: "c1",
        name: "Imported",
        createdAt: "2024-02-01",
        paperIds: ["__proto__", "2401.00001"],
      },
      papers: [PROTO_PAPER, makePaper("2401.00001")],
    };
  }

  it("keeps the valid sibling and never stores an own __proto__ snapshot", () => {
    const payload = parseExportPayload(JSON.parse(JSON.stringify(protoPayload())));
    expect(payload).not.toBeNull();
    expect(payload?.papers.map((paper) => paper.id)).toEqual(["2401.00001"]);

    const state = collectionsReducer(EMPTY_STATE, {
      type: "mergeImport",
      payload: payload as ExportPayload,
    });
    expect(state.collections[0].paperIds).toEqual(["2401.00001"]);
    expect(Object.prototype.hasOwnProperty.call(state.papers, "__proto__")).toBe(
      false,
    );
  });

  it("drops a __proto__ paperId that has no own snapshot in mergeImport", () => {
    const parsed = protoPayload();
    const state = collectionsReducer(EMPTY_STATE, {
      type: "mergeImport",
      payload: {
        ...parsed,
        collection: { ...parsed.collection, paperIds: ["__proto__", "ghost"] },
        papers: [makePaper("2401.00001")],
      },
    });
    expect(state.collections[0].paperIds).toEqual([]);
  });

  it("drops every inherited Object.prototype key from loadState", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      COLLECTIONS_KEY,
      JSON.stringify([
        {
          id: "c1",
          name: "Vision",
          createdAt: "2024-01-08",
          paperIds: ["__proto__", "2401.00001"],
        },
      ]),
    );
    expect(loadState(storage).collections[0].paperIds).toEqual([]);
  });

  it("survives a poisoned papers record in storage", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PAPERS_KEY,
      JSON.stringify({
        __proto__: makePaper("2401.00001"),
        "2401.00001": makePaper("2401.00001"),
      }),
    );
    storage.setItem(
      COLLECTIONS_KEY,
      JSON.stringify([
        {
          id: "c1",
          name: "Vision",
          createdAt: "2024-01-08",
          paperIds: ["__proto__", "constructor", "toString", "2401.00001"],
        },
      ]),
    );
    const loaded = loadState(storage);
    expect(loaded.collections[0].paperIds).toEqual(["2401.00001"]);
    expect(Object.prototype.hasOwnProperty.call(loaded.papers, "__proto__")).toBe(
      false,
    );
    expect(Object.getPrototypeOf(loaded.papers)).toBe(Object.prototype);
  });
});

describe("producer-null urls in imported papers", () => {
  /**
   * `scripts/build_index.py` builds `absUrl`/`pdfUrl` with `getattr(result, …,
   * None)`, so a genuinely url-less paper reaches the wire as JSON `null`. The
   * round-trip reproduces the bytes the import path actually reads.
   */
  function parseImported(papers: unknown[]) {
    return parseExportPayload(
      JSON.parse(
        JSON.stringify({
          version: 1,
          exportedAt: "2026-10-02T00:00:00.000Z",
          collection: {
            id: "c1",
            name: "Imported",
            createdAt: "2026-10-02",
            paperIds: (papers as Array<{ id: string }>).map((paper) => paper.id),
          },
          papers,
        }),
      ),
    );
  }

  it("keeps a paper whose absUrl is null", () => {
    const payload = parseImported([
      { ...makePaper("2401.00001"), absUrl: null },
      makePaper("2401.00002"),
    ]);
    expect(payload?.papers.map((paper) => paper.id)).toEqual([
      "2401.00001",
      "2401.00002",
    ]);
    expect(payload?.papers[0].absUrl).toBeNull();
  });

  it("keeps a paper whose pdfUrl is null", () => {
    const payload = parseImported([
      { ...makePaper("2401.00001"), pdfUrl: null },
      makePaper("2401.00002"),
    ]);
    expect(payload?.papers.map((paper) => paper.id)).toEqual([
      "2401.00001",
      "2401.00002",
    ]);
    expect(payload?.papers[0].pdfUrl).toBeNull();
  });

  it("keeps a paper whose absUrl and pdfUrl are both null", () => {
    const payload = parseImported([
      { ...makePaper("2401.00001"), absUrl: null, pdfUrl: null },
    ]);
    expect(payload?.papers.map((paper) => paper.id)).toEqual(["2401.00001"]);
    expect(payload?.papers[0].absUrl).toBeNull();
    expect(payload?.papers[0].pdfUrl).toBeNull();
  });

  it("still drops javascript:, data: and vbscript: urls beside null siblings", () => {
    const payload = parseImported([
      makePaper("2401.00001", { absUrl: "javascript:alert(1)" }),
      makePaper("2401.00002", { pdfUrl: "data:text/html,<script>x</script>" }),
      makePaper("2401.00003", { pdfUrl: "vbscript:msgbox(1)" }),
      { ...makePaper("2401.00004"), absUrl: null, pdfUrl: null },
      makePaper("2401.00005", { absUrl: "httpx://evil.example/5" }),
    ]);
    expect(payload?.papers.map((paper) => paper.id)).toEqual(["2401.00004"]);
  });
});

/**
 * The third `getattr(result, …, None)` field. `record_from_result` publishes
 * `primaryCategory: null` whenever arXiv names no primary category, so a gate
 * that requires a string here deletes a paper the index really did publish.
 * The key must still be present: `undefined` is the field-missing case IMP-154
 * added the check for, and it stays rejected.
 */
describe("producer-null primaryCategory in imported papers", () => {
  function parseImported(papers: unknown[]): ExportPayload | null {
    return parseExportPayload(
      JSON.parse(
        JSON.stringify({
          version: 1,
          exportedAt: "2026-10-02T00:00:00.000Z",
          collection: {
            id: "c1",
            name: "Imported",
            createdAt: "2026-10-02",
            paperIds: (papers as Array<{ id: string }>).map((paper) => paper.id),
          },
          papers,
        }),
      ),
    );
  }

  it("keeps a paper whose primaryCategory is null", () => {
    const payload = parseImported([
      { ...makePaper("2401.00001"), primaryCategory: null },
      makePaper("2401.00002"),
    ]);

    expect(payload?.papers.map((paper) => paper.id)).toEqual([
      "2401.00001",
      "2401.00002",
    ]);
    expect(payload?.papers[0].primaryCategory).toBeNull();
  });

  it("still drops a paper whose primaryCategory key is absent", () => {
    const absent = { ...makePaper("2401.00001") } as Record<string, unknown>;
    delete absent.primaryCategory;

    const payload = parseImported([absent, makePaper("2401.00002")]);

    expect(payload?.papers.map((paper) => paper.id)).toEqual(["2401.00002"]);
  });

  it("keeps a null primaryCategory through a localStorage round trip", () => {
    const storage = new MemoryStorage();
    const paper = { ...makePaper("2401.00001"), primaryCategory: null };
    storage.setItem(PAPERS_KEY, JSON.stringify({ [paper.id]: paper }));
    storage.setItem(
      COLLECTIONS_KEY,
      JSON.stringify([
        { id: "c1", name: "Vision", createdAt: "2026-10-02", paperIds: [paper.id] },
      ]),
    );

    const loaded = loadState(storage);

    expect(loaded.papers[paper.id]?.primaryCategory).toBeNull();
    expect(loaded.collections[0].paperIds).toEqual([paper.id]);
  });

  it("leaves the url guard untouched for a null primaryCategory", () => {
    const payload = parseImported([
      { ...makePaper("2401.00001"), primaryCategory: null, absUrl: "javascript:alert(1)" },
      { ...makePaper("2401.00002"), primaryCategory: null, pdfUrl: "data:text/html,x" },
      { ...makePaper("2401.00003"), primaryCategory: null },
    ]);

    expect(payload?.papers.map((paper) => paper.id)).toEqual(["2401.00003"]);
  });
});

describe("loadState / saveState", () => {
  it("round-trips collections and papers", () => {
    const storage = new MemoryStorage();
    const collection = createCollection("Vision", "2024-01-08", "c1");
    const paper = makePaper("2401.00001");
    let state = collectionsReducer(EMPTY_STATE, {
      type: "addCollection",
      collection,
    });
    state = collectionsReducer(state, {
      type: "addPaper",
      collectionId: "c1",
      paper,
    });
    expect(saveState(state, storage)).toBe(true);

    const loaded = loadState(storage);
    expect(loaded.collections[0].name).toBe("Vision");
    expect(loaded.papers["2401.00001"]).toEqual(paper);
  });

  it("ignores malformed stored data", () => {
    const storage = new MemoryStorage();
    storage.setItem(COLLECTIONS_KEY, "not json");
    expect(loadState(storage)).toEqual(EMPTY_STATE);
  });

  it("drops paper ids with no snapshot", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      COLLECTIONS_KEY,
      JSON.stringify([
        { id: "c1", name: "Vision", createdAt: "2024-01-08", paperIds: ["ghost"] },
      ]),
    );
    expect(loadState(storage).collections[0].paperIds).toEqual([]);
  });

  it("degrades to an empty state and false when storage throws", () => {
    expect(loadState(THROWING_STORAGE)).toEqual(EMPTY_STATE);
    expect(saveState(EMPTY_STATE, THROWING_STORAGE)).toBe(false);
  });

  it("returns false when the quota fills on the second key it writes", () => {
    // A real quota is not `THROWING_STORAGE`: the collections key still fits and
    // only the papers key — the larger of the two, and the second one written —
    // overflows. That is the failure the App's save effect turns into a banner,
    // and it is reachable on an ordinary 5 MB localStorage rather than only
    // under a storage-blocking policy.
    const { storage, writes } = quotaStorage();
    const state = collectionsReducer(EMPTY_STATE, {
      type: "addCollection",
      collection: createCollection("Vision", "2024-01-08", "c1"),
    });

    expect(saveState(state, storage)).toBe(false);
    expect(writes).toEqual([COLLECTIONS_KEY, PAPERS_KEY]);
  });

  it("reports the next save as successful once the quota is gone", () => {
    // `false` is a per-attempt result, not a sticky flag, so the caller has a
    // successful return to clear its warning on. A `saveState` that latched the
    // first failure would leave the user permanently warned.
    const { storage, succeed } = quotaStorage();
    const state = collectionsReducer(EMPTY_STATE, {
      type: "addCollection",
      collection: createCollection("Vision", "2024-01-08", "c1"),
    });

    expect(saveState(state, storage)).toBe(false);
    succeed();
    expect(saveState(state, storage)).toBe(true);
  });
});

/**
 * `PaperCard` dereferences `categories`, `primaryCategory` and `published`
 * without a guard, and nothing sits between `<App />` and the DOM, so a snapshot
 * missing one of them blanks every view rather than degrading one card.
 */
describe("paper fields PaperCard dereferences are validated", () => {
  const SIBLING = "2401.00001";

  /** Round-trips through JSON so the payload is the bytes a file import reads. */
  function parseImported(papers: unknown[]): ExportPayload | null {
    return parseExportPayload(
      JSON.parse(
        JSON.stringify({
          version: 1,
          exportedAt: "2026-10-02T00:00:00.000Z",
          collection: {
            id: "c1",
            name: "Imported",
            createdAt: "2026-10-02",
            paperIds: papers.map((paper) => (paper as { id: string }).id),
          },
          papers,
        }),
      ),
    );
  }

  function merge(raw: unknown): CollectionsState | null {
    const payload = parseExportPayload(JSON.parse(JSON.stringify(raw)));
    return payload
      ? collectionsReducer(EMPTY_STATE, { type: "mergeImport", payload })
      : null;
  }

  const MALFORMED: Array<[string, Record<string, unknown>]> = [
    ["no categories", { id: "2401.00009", title: "No categories", authors: ["A"], abstract: "abc" }],
    ["no published", { ...makePaper("2401.00010"), published: undefined }],
    ["categories as a string", { ...makePaper("2401.00011"), categories: "cs.CV" }],
    ["categories with a non-string", { ...makePaper("2401.00012"), categories: ["cs.CV", 7] }],
    ["no primaryCategory", { ...makePaper("2401.00013"), primaryCategory: undefined }],
    ["published as a number", { ...makePaper("2401.00014"), published: 20240101 }],
  ];

  for (const [label, malformed] of MALFORMED) {
    it(`drops a payload paper with ${label} and keeps the valid sibling`, () => {
      const raw = {
        version: 1,
        exportedAt: "2026-10-02T00:00:00.000Z",
        collection: {
          id: "c1",
          name: "Imported",
          createdAt: "2026-10-02",
          paperIds: [malformed.id as string, SIBLING],
        },
        papers: [malformed, makePaper(SIBLING)],
      };
      expect(parseImported(raw.papers)?.papers.map((paper) => paper.id)).toEqual([
        SIBLING,
      ]);
      const state = merge(raw);
      expect(state?.collections[0].paperIds).toEqual([SIBLING]);
      expect(Object.keys(state?.papers ?? {})).toEqual([SIBLING]);
    });
  }

  it("returns an empty papers array, never null, when every paper fails", () => {
    const raw = {
      version: 1,
      exportedAt: "2026-10-02T00:00:00.000Z",
      collection: {
        id: "c1",
        name: "Imported",
        createdAt: "2026-10-02",
        paperIds: ["2401.00009", "2401.00010"],
      },
      papers: [
        { id: "2401.00009", title: "No categories", authors: ["A"], abstract: "abc" },
        { ...makePaper("2401.00010"), published: null },
      ],
    };
    const payload = parseImported(raw.papers);
    expect(payload).not.toBeNull();
    expect(payload?.papers).toEqual([]);
    expect(merge(raw)?.collections[0].paperIds).toEqual([]);
  });

  it("drops a stored snapshot that is missing categories on reload", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PAPERS_KEY,
      JSON.stringify({
        "2401.00009": { id: "2401.00009", title: "No categories", authors: ["A"], abstract: "abc" },
        [SIBLING]: makePaper(SIBLING),
      }),
    );
    storage.setItem(
      COLLECTIONS_KEY,
      JSON.stringify([
        {
          id: "c1",
          name: "Vision",
          createdAt: "2024-01-08",
          paperIds: ["2401.00009", SIBLING],
        },
      ]),
    );
    const loaded = loadState(storage);
    expect(Object.keys(loaded.papers)).toEqual([SIBLING]);
    expect(loaded.collections[0].paperIds).toEqual([SIBLING]);
  });
});

/**
 * Four records copied verbatim out of `web/public/data/papers-2026-W40.json` and
 * `papers-2026-W39.json` as produced by `scripts/build_index.py`: the multi
 * category cross-listed paper, an `et al.` capped author list, a single category
 * paper, and a short untruncated abstract whose primary category is not a `cs.*`
 * one. `web/public/data/` is gitignored, so the sweep below can only run where a
 * real index happens to be on disk; this fixture keeps the contract covered in
 * CI either way.
 */
const REAL_RECORDS: Paper[] = [
  {
    id: "2610.02207",
    title: "One Basis to Animate Them All: Gaussian Blendshape Distillation for Real-Time Avatars",
    authors: ["Ramazan Fazylov", "Stamatis Lefkimmiatis", "Ivan Laptev"],
    abstract:
      "3D Gaussian avatars support fast rendering, however, their real-time animation is often challenged by the costly neural inference. We address this bottleneck and show that the animation of pretrained avatar models can be closely approximated by a linear combination of identity-independent blendshapes. Building on this finding, we introduce GALA (Gaussian Animation via Linear Approximation), a distillation method that replaces per-frame heavy neural decoding with a shallow coefficient predictor a\u2026",
    abstractTruncated: true,
    published: "2026-10-01",
    updated: "2026-10-01",
    categories: ["cs.CV", "cs.AI", "cs.HC", "cs.LG"],
    primaryCategory: "cs.CV",
    absUrl: "http://arxiv.org/abs/2610.02207v1",
    pdfUrl: "https://arxiv.org/pdf/2610.02207v1",
  },
  {
    id: "2610.01004",
    title:
      "The Effect of Gait Stability Based on Two Types of Impact Strategies for Two-Link Walking and Brachiating Robots",
    authors: ["Alan Estrada Flores", "Nelson Rosa"],
    abstract:
      "In this paper, we explore the impulsive dynamics common to single-joint, two-link models of walking and brachiating gaits with respect to slope and switching time. In particular, we investigate how the stability of a gait and bifurcations encountered within a family of gaits change under time-based and state-based switching of the impulsive dynamics.",
    abstractTruncated: false,
    published: "2026-10-01",
    updated: "2026-10-01",
    categories: ["nlin.CD", "cs.RO"],
    primaryCategory: "nlin.CD",
    absUrl: "http://arxiv.org/abs/2610.01004v1",
    pdfUrl: "https://arxiv.org/pdf/2610.01004v1",
  },
  {
    id: "2609.38219",
    title:
      "TutlAit v1: a crowdsourced Moroccan Tamazight speech dataset with Arabic transcriptions and regional accent labels",
    authors: [
      "Mohamed-Amine Chadi",
      "Ezzahra Ait El Arbi",
      "Ismail Khayoub",
      "Aymane Fadili",
      "Yassine Ennhili",
      "Jadjigua Bouali",
      "Hanane Inhid",
      "Mohammed Ameksa",
      "et al.",
    ],
    abstract:
      "Tamazight (Amazigh) is, together with Arabic, one of the two official languages of Morocco, yet it remains severely under-resourced for speech technology: pub licly available labelled audio is scarce, generally lacks information on the regional variety spoken, and is often of uneven transcription quality. This article describes the TutlAit dataset, a corpus of Moroccan Tamazight speech paired with Modern Standard Arabic text and explicit regional accent labels. The data were collected with TutlA\u2026",
    abstractTruncated: true,
    published: "2026-09-27",
    updated: "2026-09-27",
    categories: ["cs.CL", "cs.LG"],
    primaryCategory: "cs.CL",
    absUrl: "http://arxiv.org/abs/2609.38219v1",
    pdfUrl: "https://arxiv.org/pdf/2609.38219v1",
  },
  {
    id: "2609.38216",
    title:
      "Fiatlux: A Long-Horizon Benchmark for Humanoid Ladder Climbing and Light-Bulb Replacement",
    authors: [
      "Pavel Bushuyeu",
      "Yujin Chen",
      "Anton Nikolaev",
      "Brian Shu",
      "Igor Molybog",
    ],
    abstract:
      "Existing benchmarks evaluate tabletop manipulation, flat-floor household activity, or humanoid locomotion and manipulation as separate task groups; none scores vertical mobility and dexterous work on a fragile payload in one long-horizon episode. We present Fiatlux, a light-bulb replacement benchmark built on NVIDIA Isaac Lab. In one episode, a Unitree G1 humanoid positions a step ladder under a ceiling or wall fixture, climbs it, exchanges a spent bulb in a socket for a fresh one, and leaves th\u2026",
    abstractTruncated: true,
    published: "2026-09-27",
    updated: "2026-09-27",
    categories: ["cs.RO"],
    primaryCategory: "cs.RO",
    absUrl: "http://arxiv.org/abs/2609.38216v1",
    pdfUrl: "https://arxiv.org/pdf/2609.38216v1",
  },
];

describe("real producer records are never rejected", () => {
  it("keeps every real record fixture", () => {
    const payload = parseExportPayload({
      version: 1,
      exportedAt: "2026-10-02T02:44:04Z",
      collection: {
        id: "c1",
        name: "Imported",
        createdAt: "2026-10-02",
        paperIds: REAL_RECORDS.map((paper) => paper.id),
      },
      papers: REAL_RECORDS,
    });
    expect(payload?.papers).toHaveLength(REAL_RECORDS.length);
    expect(payload?.papers).toEqual(REAL_RECORDS);
  });

  it("keeps a real record through a localStorage round trip", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PAPERS_KEY,
      JSON.stringify(
        Object.fromEntries(REAL_RECORDS.map((paper) => [paper.id, paper])),
      ),
    );
    storage.setItem(
      COLLECTIONS_KEY,
      JSON.stringify([
        {
          id: "c1",
          name: "Vision",
          createdAt: "2026-10-02",
          paperIds: REAL_RECORDS.map((paper) => paper.id),
        },
      ]),
    );
    const loaded = loadState(storage);
    expect(loaded.collections[0].paperIds).toHaveLength(REAL_RECORDS.length);
    expect(loaded.collections[0].paperIds).toEqual(
      REAL_RECORDS.map((paper) => paper.id),
    );
  });
});
