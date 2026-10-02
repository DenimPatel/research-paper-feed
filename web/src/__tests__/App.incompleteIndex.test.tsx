import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import type { IndexManifest, Paper } from "../lib/types";

/**
 * A reader has to be *told* when the index is short.
 *
 * The build can publish an index that is missing a category (its query died) or
 * holding a short one (the per-category cap cut it off), and `index.json`
 * carries both in `failedCategories` / `truncatedCategories`. A field the app
 * drops is not a guarantee: what these tests pin is the sentence on screen, and
 * the absence of a filter chip that leads to an empty feed.
 */

function makePaper(id: string, category: string): Paper {
  return {
    id,
    title: `A Paper From ${category}`,
    authors: ["Ada Lovelace"],
    abstract: "An abstract long enough to preview.",
    abstractTruncated: false,
    published: "2024-03-01",
    updated: "2024-03-01",
    categories: [category],
    primaryCategory: category,
    absUrl: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
  };
}

const CV = makePaper("2401.00001", "cs.CV");
const LG = makePaper("2401.00002", "cs.LG");

const SHARD = {
  week: "2024-W09",
  from: "2024-02-26",
  to: "2024-03-03",
  papers: [CV, LG],
};

function manifest(overrides: Partial<IndexManifest> = {}): IndexManifest {
  return {
    generatedAt: "2024-03-01T00:00:00Z",
    retentionDays: 60,
    categories: ["cs.CV", "cs.LG"],
    shards: [
      {
        week: "2024-W09",
        from: "2024-02-26",
        to: "2024-03-03",
        count: 2,
        file: "papers-2024-W09.json",
      },
    ],
    totalPapers: 2,
    ...overrides,
  };
}

function installFetch(index: IndexManifest): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/index.json")) {
        return new Response(JSON.stringify(index), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(SHARD), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

/** The IMP-204 notice, identified by its copy rather than by position. */
function incompleteNotice(): HTMLElement {
  const matches = screen
    .getAllByRole("alert")
    .filter((node) => /this index is incomplete/i.test(node.textContent ?? ""));
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one incomplete-index notice, found ${matches.length}`,
    );
  }
  return matches[0];
}

beforeEach(() => {
  window.location.hash = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App with a category missing from the index", () => {
  it("tells the reader the index is incomplete and names the category", async () => {
    installFetch(manifest({ failedCategories: ["cs.RO"] }));

    render(<App />);

    expect(await screen.findByText(CV.title)).toBeTruthy();

    const notice = incompleteNotice();
    expect(notice.textContent).toContain("cs.RO");
    // The point of the notice: the reader learns the cause is the index, not
    // their own filter.
    expect(notice.textContent).toMatch(/could not be fetched from arXiv/i);
    expect(notice.textContent).toMatch(/incomplete/i);
    expect(notice.className).toContain("banner");
    expect(notice.className).toContain("banner--warning");
    expect(notice.getAttribute("aria-label")).toBe("This index is incomplete");
  });

  it("offers no filter for the category it could not fetch", async () => {
    installFetch(manifest({ failedCategories: ["cs.RO"] }));

    render(<App />);
    await screen.findByText(CV.title);

    // The chip is the promise. A chip for a category with no papers behind it
    // leads to "No papers match the current filters", which blames the reader
    // for an outage they never caused.
    expect(screen.queryByRole("button", { name: "cs.RO" })).toBeNull();
    // And the header does not claim the index holds it either.
    const header = screen.getByText(/papers from/i);
    expect(header.textContent).toContain("cs.CV, cs.LG");
    expect(header.textContent).not.toContain("cs.RO");
  });

  it("keeps the notice across re-renders so it is announced once", async () => {
    installFetch(manifest({ failedCategories: ["cs.RO"] }));

    render(<App />);
    await screen.findByText(CV.title);
    const first = incompleteNotice();

    // A remount here would re-fire the assertive announcement on every
    // keystroke, which is the failure IMP-015's notice test pins for the shard
    // case and the same one here.
    const search = screen.getByLabelText("Search papers");
    search.focus();
    expect(incompleteNotice()).toBe(first);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("keeps the missing week out of a deep link instead of emptying the feed silently", async () => {
    // The other end of dropping the category: a stale `#cat=cs.RO` must be
    // reported by IMP-009's notice, which is honest ("this index does not have
    // that category"), rather than matching nothing without explanation.
    window.location.hash = "#cat=cs.RO";
    installFetch(manifest({ failedCategories: ["cs.RO"] }));

    render(<App />);

    expect(await screen.findByText(/unknown categor/i)).toBeTruthy();
    expect(incompleteNotice()).toBeTruthy();
  });
});

describe("App with a category cut short by the cap", () => {
  it("says the category may be missing older papers, and keeps it filterable", async () => {
    installFetch(manifest({ truncatedCategories: ["cs.LG"] }));

    render(<App />);
    expect(await screen.findByText(CV.title)).toBeTruthy();

    const notice = incompleteNotice();
    expect(notice.textContent).toContain("cs.LG");
    expect(notice.textContent).toMatch(/cut off/i);
    expect(notice.textContent).toMatch(/older papers .* may be missing/i);
    // Short is not absent: the category has papers, so it stays browsable.
    expect(screen.getByRole("button", { name: "cs.LG" })).toBeTruthy();
  });

  it("stays silent when the build covered everything it was asked for", async () => {
    installFetch(manifest());

    render(<App />);

    expect(await screen.findByText(CV.title)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/papers from/i).textContent).toContain(
      "cs.CV, cs.LG",
    );
  });
});