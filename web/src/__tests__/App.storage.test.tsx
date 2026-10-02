import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { COLLECTIONS_KEY, PAPERS_KEY } from "../lib/collections";
import type { IndexManifest, Paper } from "../lib/types";

const PAPER: Paper = {
  id: "2401.00001",
  title: "A Storage Failure Paper",
  authors: ["Ada Lovelace"],
  abstract: "An abstract long enough to preview.",
  abstractTruncated: false,
  published: "2024-03-01",
  updated: "2024-03-01",
  categories: ["cs.CV"],
  primaryCategory: "cs.CV",
  absUrl: "https://arxiv.org/abs/2401.00001",
  pdfUrl: "https://arxiv.org/pdf/2401.00001",
};

const MANIFEST: IndexManifest = {
  generatedAt: "2024-03-01T00:00:00Z",
  retentionDays: 60,
  categories: ["cs.CV"],
  shards: [
    {
      week: "2024-W09",
      from: "2024-02-26",
      to: "2024-03-03",
      count: 1,
      file: "papers-2024-W09.json",
    },
  ],
  totalPapers: 1,
};

const SHARD = {
  week: "2024-W09",
  from: "2024-02-26",
  to: "2024-03-03",
  papers: [PAPER],
};

/**
 * jsdom 29 hands back a `window.localStorage` whose `setItem` is not a function
 * (`malformedImport.test.tsx:32` records the same finding), so `detectStorage()`
 * would report "no storage", the save effect would return before it ever called
 * `saveState`, and nothing here would be reachable. Replacing the accessor with a
 * working in-memory `Storage` is what makes the failure path observable at all.
 */
class FakeStorage implements Storage {
  readonly store = new Map<string, string>();
  /**
   * A full localStorage, not a blocked one: reads and the smaller
   * `COLLECTIONS_KEY` write still succeed and only `PAPERS_KEY` overflows, which
   * is where a real quota error lands. `saveState` swallows it and returns false.
   */
  full = false;

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
    if (this.full && key === PAPERS_KEY) {
      throw new DOMException("quota", "QuotaExceededError");
    }
    this.store.set(key, value);
  }
}

let storage: FakeStorage;
let originalLocalStorage: PropertyDescriptor | undefined;

beforeEach(() => {
  window.location.hash = "";
  storage = new FakeStorage();
  originalLocalStorage = Object.getOwnPropertyDescriptor(
    window,
    "localStorage",
  );
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return new Response(
        JSON.stringify(url.endsWith("/index.json") ? MANIFEST : SHARD),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }),
  );
});

afterEach(() => {
  if (originalLocalStorage) {
    Object.defineProperty(window, "localStorage", originalLocalStorage);
  }
  vi.unstubAllGlobals();
});

/** The collections tab, where a collection is created and therefore saved. */
async function openCollections(): Promise<void> {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /^Collections/ }));
  await screen.findByRole("button", { name: "Create collection" });
}

/**
 * One dispatch, so exactly one save attempt. The form is the cheapest route to
 * it: the collection list is visible without waiting for the index to resolve.
 */
function createCollection(name: string): void {
  fireEvent.change(screen.getByLabelText("New collection name"), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create collection" }));
}

function saveFailedBanner(): HTMLElement {
  return screen.getByRole("alert");
}

describe("a collections save that localStorage refuses", () => {
  it("warns instead of letting the optimistic update pass as a real save", async () => {
    await openCollections();
    expect(screen.queryByRole("alert")).toBeNull();

    storage.full = true;
    createCollection("Vision");

    // The reducer already applied, so the card still claims the collection
    // exists. Without the banner that is the whole story the user gets, and the
    // data is gone on the next reload.
    expect(await screen.findByRole("heading", { name: /^Vision/ })).toBeTruthy();
    const banner = saveFailedBanner();
    expect(banner.textContent).toContain("Collections could not be saved");
    expect(banner.textContent).toMatch(/storage may be full/i);
    // The established notice treatment: the same `banner`/`banner--error` pair
    // the import error uses, so no new styling is needed.
    expect(banner.className).toContain("banner--error");
  });

  it("clears the banner on the next successful save", async () => {
    await openCollections();
    storage.full = true;
    createCollection("Vision");
    await screen.findByRole("alert");

    storage.full = false;
    createCollection("NLP");

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(
      screen.getByRole("heading", { name: /^NLP/ }),
    ).toBeTruthy();
    expect(storage.store.has(PAPERS_KEY)).toBe(true);
  });

  it("keeps one banner node across repeated failures so it is announced once", async () => {
    await openCollections();
    storage.full = true;
    createCollection("Vision");
    const first = await screen.findByRole("alert");

    // A second failed save must reuse the node already in the live region. A
    // remount here would re-fire the assertive announcement on every save.
    createCollection("NLP");
    await screen.findByRole("heading", { name: /^NLP/ });
    const second = saveFailedBanner();
    expect(second).toBe(first);
    expect(second.textContent).toBe(first.textContent);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("still reports the failure after switching views", async () => {
    await openCollections();
    storage.full = true;
    createCollection("Vision");
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    await screen.findByRole("heading", { name: /Recent arXiv papers/ });

    // A save is triggered from either tab, so the warning cannot belong to one
    // of them or it disappears exactly when the user goes looking for it.
    expect(saveFailedBanner().textContent).toContain(
      "Collections could not be saved",
    );
  });

  it("stays silent while saves succeed", async () => {
    await openCollections();
    createCollection("Vision");

    await screen.findByRole("heading", { name: /^Vision/ });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(storage.store.has(COLLECTIONS_KEY)).toBe(true);
    expect(storage.store.has(PAPERS_KEY)).toBe(true);
  });
});