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
});
