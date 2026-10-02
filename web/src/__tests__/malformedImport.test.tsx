import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaperList } from "../components/PaperList";
import {
  COLLECTIONS_KEY,
  EMPTY_STATE,
  PAPERS_KEY,
  collectionsReducer,
  loadState,
  parseExportPayload,
  type CollectionsState,
} from "../lib/collections";
import type { Paper } from "../lib/types";

const VALID: Paper = {
  id: "2401.00001",
  title: "A Real Paper",
  authors: ["Ada Lovelace"],
  abstract: "An abstract.",
  abstractTruncated: false,
  published: "2024-01-08",
  updated: "2024-01-08",
  categories: ["cs.CV"],
  primaryCategory: "cs.CV",
  absUrl: "https://arxiv.org/abs/2401.00001",
  pdfUrl: "https://arxiv.org/pdf/2401.00001",
};

let root: HTMLDivElement | null = null;

/**
 * jsdom's `window.localStorage` is unusable in this environment (`setItem is not
 * a function`), so the reload path is driven with the same in-file `Storage` fake
 * shape `collections.test.ts` uses.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
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

afterEach(() => {
  root?.remove();
  root = null;
});

function importPayload(papers: unknown[]): CollectionsState {
  const payload = parseExportPayload(
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
  expect(payload).not.toBeNull();
  return collectionsReducer(EMPTY_STATE, {
    type: "mergeImport",
    payload: payload as NonNullable<typeof payload>,
  });
}

function savedPapers(state: CollectionsState): Paper[] {
  const collection = state.collections[0];
  return collection.paperIds.flatMap((id) => {
    const paper = Object.prototype.hasOwnProperty.call(state.papers, id)
      ? state.papers[id]
      : undefined;
    return paper ? [paper] : [];
  });
}

/** Mirrors how `App` mounts: the rendered tree lives under `#root`. */
function renderRoot(papers: Paper[]): HTMLDivElement {
  root = document.createElement("div");
  root.id = "root";
  document.body.appendChild(root);
  render(
    <PaperList papers={papers} visibleCount={50} onLoadMore={() => {}} />,
    { container: root },
  );
  return root;
}

const MALFORMED: Array<[string, Record<string, unknown>]> = [
  [
    "omits categories",
    { id: "2401.00009", title: "No categories", authors: ["A"], abstract: "abc" },
  ],
  ["omits published", { ...VALID, id: "2401.00010", published: undefined }],
  ["has categories as a string", { ...VALID, id: "2401.00011", categories: "cs.CV" }],
];

describe("a malformed import cannot blank the app", () => {
  for (const [label, malformed] of MALFORMED) {
    it(`keeps the tree mounted when an imported paper ${label}`, () => {
      const state = importPayload([malformed, VALID]);
      const papers = savedPapers(state);
      expect(papers.map((paper) => paper.id)).toEqual([VALID.id]);

      const container = renderRoot(papers);
      expect(container.children.length).toBeGreaterThan(0);
      expect(container.querySelectorAll("article.paper")).toHaveLength(1);
      expect(container.textContent).toContain(VALID.title);
    });
  }

  it("leaves no snapshot that PaperCard would dereference unguarded", () => {
    const state = importPayload([...MALFORMED.map(([, paper]) => paper), VALID]);
    for (const paper of Object.values(state.papers)) {
      expect(Array.isArray(paper.categories)).toBe(true);
      expect(paper.categories.every((c) => typeof c === "string")).toBe(true);
      expect(typeof paper.primaryCategory).toBe("string");
      expect(typeof paper.published).toBe("string");
    }
  });

  it("survives a stored snapshot that predates the validation", () => {
    const malformed = {
      id: "2401.00009",
      title: "No categories",
      authors: ["A"],
      abstract: "abc",
    };
    const storage = new MemoryStorage();
    storage.setItem(
      PAPERS_KEY,
      JSON.stringify({ "2401.00009": malformed, [VALID.id]: VALID }),
    );
    storage.setItem(
      COLLECTIONS_KEY,
      JSON.stringify([
        {
          id: "c1",
          name: "Vision",
          createdAt: "2024-01-08",
          paperIds: ["2401.00009", VALID.id],
        },
      ]),
    );
    const loaded = loadState(storage);
    const container = renderRoot(savedPapers(loaded));
    expect(container.children.length).toBeGreaterThan(0);
    expect(container.querySelectorAll("article.paper")).toHaveLength(1);
  });
});