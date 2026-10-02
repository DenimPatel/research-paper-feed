import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import type { IndexManifest, Paper } from "../lib/types";

function paper(id: string, category: string): Paper {
  return {
    id,
    title: `${category} paper ${id}`,
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

const CV_PAPER = paper("2401.00001", "cs.CV");
const LG_PAPER = paper("2401.00002", "cs.LG");

/** Two categories the index has. `cs.BI` is deliberately absent. */
const MANIFEST: IndexManifest = {
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
};

const SHARD = {
  week: "2024-W09",
  from: "2024-02-26",
  to: "2024-03-03",
  papers: [CV_PAPER, LG_PAPER],
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return jsonResponse(url.endsWith("/index.json") ? MANIFEST : SHARD);
    }),
  );
}

/** Holds `index.json` open so the in-flight window is observable. */
function installGatedFetch() {
  let release!: (value: Response) => void;
  const gate = new Promise<Response>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/index.json")) {
        return gate;
      }
      return jsonResponse(SHARD);
    }),
  );
  return { release: () => release(jsonResponse(MANIFEST)) };
}

function htmlFallback(): Response {
  return new Response("<!doctype html><title>fallback</title>", {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function installUnavailableFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => htmlFallback()),
  );
}

/**
 * The chips are gated on `manifest` alone, but the cards are filled by a
 * separate effect that flips `loading` off once `loadPapers` resolves, so the
 * controls are safe to assert synchronously and the cards must be awaited. Same
 * split as `App.relevance.test.tsx`.
 */
async function renderFeed() {
  render(<App />);
  await screen.findByRole("heading", { name: /Recent arXiv papers/ });
  return screen.getByRole("group", { name: "Categories" });
}

/** The per-category chips only: `All` is a separate control with its own tests. */
function pressedCategoryLabels(group: HTMLElement): string[] {
  return within(group)
    .getAllByRole("button")
    .filter(
      (chip) =>
        chip.textContent !== "All" &&
        chip.getAttribute("aria-pressed") === "true",
    )
    .map((chip) => chip.textContent ?? "");
}

function allChip(group: HTMLElement): HTMLElement {
  return within(group).getByRole("button", { name: "All" });
}

/** The unknown-category banner. `error` never renders here, so it is unique. */
function unknownNotice(): HTMLElement {
  return screen.getByRole("alert");
}

beforeEach(() => {
  window.location.hash = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a deep link naming a category the index does not have", () => {
  it("intersects the hash list with the manifest, not the raw hash list", async () => {
    installFetch();
    window.location.hash = "#cat=cs.CV,cs.BI";

    const group = await renderFeed();

    expect(pressedCategoryLabels(group)).toEqual(["cs.CV"]);
    expect(
      within(group).getByRole("button", { name: "cs.LG" }).getAttribute("aria-pressed"),
    ).toBe("false");
    // The dropped value must not filter anything out, or the feed would go
    // empty for a category the user cannot see selected.
    expect(await screen.findByText(CV_PAPER.title)).toBeTruthy();
    expect(screen.queryByText(LG_PAPER.title)).toBeNull();

    // Pressing a second chip is what makes the intersection observable: the
    // chips are drawn from the manifest either way, so only the next write
    // reveals whether the carried list was intersected or raw. Pressing the
    // last one fills the whole index, which is no filter, so the write drops
    // `cat=` — never `cs.BI`, which is what seeding from the raw hash would do.
    // The empty string rather than `#` is what a browser reports for a URL that
    // ends in a bare fragment, and both mean "no `cat=`".
    fireEvent.click(within(group).getByRole("button", { name: "cs.LG" }));
    expect(window.location.hash).not.toContain("cat=");
    expect(pressedCategoryLabels(group)).toEqual(["cs.CV", "cs.LG"]);
    expect(allChip(group).getAttribute("aria-pressed")).toBe("true");
  });

  it("names the dropped value rather than leaving an unexplained result", async () => {
    installFetch();
    window.location.hash = "#cat=cs.CV,cs.BI";

    await renderFeed();

    const notice = unknownNotice();
    expect(notice.textContent).toContain("Unknown category");
    expect(notice.textContent).toContain("cs.BI");
    expect(notice.textContent).not.toContain("cs.CV");
  });

  it("keeps the deep link working while the index is still in flight", async () => {
    const feed = installGatedFetch();
    window.location.hash = "#cat=cs.CV,cs.BI";

    render(<App />);

    // Nothing is claimed about a category before the index can answer. The
    // loading status is announced, and no alert is invented.
    expect(screen.getByRole("status").textContent).toContain(
      "Loading the paper index",
    );
    expect(screen.queryByRole("alert")).toBeNull();

    await act(async () => {
      feed.release();
    });

    expect(pressedCategoryLabels(screen.getByRole("group", { name: "Categories" }))).toEqual(
      ["cs.CV"],
    );
    expect(unknownNotice().textContent).toContain("cs.BI");
  });

  it("leaves the hash and the error panel alone when the index never loads", async () => {
    installUnavailableFetch();
    window.location.hash = "#cat=cs.CV,cs.BI";

    render(<App />);
    await screen.findByRole("heading", { name: /No paper index yet/ });

    expect(window.location.hash).toBe("#cat=cs.CV,cs.BI");
    expect(screen.queryByRole("group", { name: "Categories" })).toBeNull();
  });

  it("never puts the dropped value back into the URL", async () => {
    installFetch();
    window.location.hash = "#cat=cs.CV,cs.BI";
    const group = await renderFeed();

    fireEvent.click(within(group).getByRole("button", { name: "cs.CV" }));

    // Seeding the toggle from the raw hash list would leave `cs.BI` here —
    // the unpressable filter this item removes, back again on the next click.
    expect(window.location.hash).not.toContain("cs.BI");
  });
});

describe("a deep link naming only unknown categories", () => {
  it("renders a named notice with a usable reset instead of a bare empty state", async () => {
    installFetch();
    window.location.hash = "#cat=cs.BI";

    const group = await renderFeed();

    const notice = unknownNotice();
    expect(notice.textContent).toContain("Unknown category: cs.BI.");

    const reset = within(notice).getByRole("button", {
      name: /reset category filter/i,
    });
    expect(reset.tagName).toBe("BUTTON");
    expect(reset.getAttribute("type")).toBe("button");
    expect(reset.hasAttribute("disabled")).toBe(false);

    reset.focus();
    expect(document.activeElement).toBe(reset);

    // The feed body says nothing of its own here. IMP-010's "No categories
    // selected" is a claim about a selection the reader made, and this reader
    // made none — their category is simply not in this index, which the notice
    // above already says. A second account of the same empty list would name a
    // cause that did not happen.
    expect(screen.queryByText("No categories selected")).toBeNull();
    expect(
      screen.queryByText(/No papers match the current filters/),
    ).toBeNull();
    expect(pressedCategoryLabels(group)).toEqual([]);
  });

  /**
   * One condition, one way out. IMP-009's reset and IMP-010's "Select all" both
   * write `categories: null` from this state, so rendering both gave the reader
   * two controls for one fact and told them the same thing twice.
   */
  it("offers exactly one control for recovering from it", async () => {
    installFetch();
    window.location.hash = "#cat=cs.BI";

    await renderFeed();
    await screen.findByRole("alert");

    const controls = [
      screen.queryByRole("button", { name: /select all categories/i }),
      screen.queryByRole("button", { name: /reset category filter/i }),
      screen.queryByRole("button", { name: /keep only indexed categories/i }),
    ].filter((node) => node !== null);
    expect(controls).toHaveLength(1);
    expect(controls[0]?.textContent).toBe("Reset category filter");
    // The one that survives is the one inside the notice, so the control and the
    // explanation of what it fixes are the same block of text.
    expect(unknownNotice().contains(controls[0] as HTMLElement)).toBe(true);
  });

  it("recovers the whole feed when the reset is clicked", async () => {
    installFetch();
    window.location.hash = "#cat=cs.BI";
    const group = await renderFeed();
    await screen.findByRole("alert");

    fireEvent.click(
      within(unknownNotice()).getByRole("button", { name: /reset category filter/i }),
    );

    expect(window.location.hash).not.toContain("cat=");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("No categories selected")).toBeNull();
    expect(await screen.findByText(CV_PAPER.title)).toBeTruthy();
    expect(screen.getByText(LG_PAPER.title)).toBeTruthy();
    expect(pressedCategoryLabels(group)).toEqual(["cs.CV", "cs.LG"]);
  });

  it("clears only the unknown value when a known one survives the reset", async () => {
    installFetch();
    window.location.hash = "#cat=cs.CV,cs.BI";
    const group = await renderFeed();

    fireEvent.click(
      within(unknownNotice()).getByRole("button", {
        name: /keep only indexed categories/i,
      }),
    );

    expect(window.location.hash).toBe("#cat=cs.CV");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(pressedCategoryLabels(group)).toEqual(["cs.CV"]);
    expect(await screen.findByText(CV_PAPER.title)).toBeTruthy();
  });

  it("reports every dropped value, and no more than those", async () => {
    installFetch();
    window.location.hash = "#cat=cs.BI,cs.NOPE";

    await renderFeed();

    const text = unknownNotice().textContent ?? "";
    expect(text).toContain("Unknown categories: cs.BI, cs.NOPE.");
    expect(text).not.toContain("cs.CV");
  });
});

describe("hashes that name no category", () => {
  it("shows no unknown-category notice for a plain feed", async () => {
    installFetch();

    const group = await renderFeed();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(pressedCategoryLabels(group)).toEqual(["cs.CV", "cs.LG"]);
  });

  it("does not claim anything about an explicit empty selection", async () => {
    // `#cat=` asks for no category, which is a request — not a typo — so there
    // is nothing to report as unknown. Its empty feed is named and reversible.
    installFetch();
    window.location.hash = "#cat=";

    await renderFeed();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findByText("No categories selected")).toBeTruthy();
  });

  /**
   * The mirror of the one-control rule for `#cat=cs.BI`: this is the state
   * IMP-010 exists for, and the unknown-category notice must not swallow it. A
   * `#cat=` reader did turn everything off, so the copy and the control that
   * reverses it both belong here.
   */
  it("keeps its own reversible control, and the unknown-category notice out of it", async () => {
    installFetch();
    window.location.hash = "#cat=";

    await renderFeed();
    await screen.findByText("No categories selected");

    const controls = [
      screen.queryByRole("button", { name: /select all categories/i }),
      screen.queryByRole("button", { name: /reset category filter/i }),
      screen.queryByRole("button", { name: /keep only indexed categories/i }),
    ].filter((node) => node !== null);
    expect(controls).toHaveLength(1);
    expect(controls[0]?.textContent).toBe("Select all categories");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("choosing between all categories and a subset", () => {
  it("presses All for a bare feed and drops cat= once it is pressed again", async () => {
    installFetch();
    const group = await renderFeed();

    expect(allChip(group).getAttribute("aria-pressed")).toBe("true");
    expect(window.location.hash).not.toContain("cat=");

    fireEvent.click(within(group).getByRole("button", { name: "cs.CV" }));
    expect(allChip(group).getAttribute("aria-pressed")).toBe("false");
    // Removing one category from the full set leaves the other four, so the
    // write names what is left rather than what was clicked.
    expect(window.location.hash).toBe("#cat=cs.LG");

    fireEvent.click(allChip(group));
    expect(allChip(group).getAttribute("aria-pressed")).toBe("true");
    expect(window.location.hash).not.toContain("cat=");
    expect(pressedCategoryLabels(group)).toEqual(["cs.CV", "cs.LG"]);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findByText(LG_PAPER.title)).toBeTruthy();
  });

  it("treats a reordered full list from a deep link as no filter", async () => {
    installFetch();
    window.location.hash = "#cat=cs.LG,cs.CV";

    const group = await renderFeed();

    expect(allChip(group).getAttribute("aria-pressed")).toBe("true");
    // The URL still carries the full list because nothing has rewritten it
    // yet; the next write is what has to drop it.
    fireEvent.change(screen.getByLabelText("Search papers"), {
      target: { value: "smoke" },
    });
    expect(window.location.hash).toBe("#q=smoke");
  });

  it("names and reverses an explicitly empty selection", async () => {
    installFetch();
    window.location.hash = "#cat=";
    await renderFeed();

    const restore = await screen.findByRole("button", {
      name: "Select all categories",
    });
    expect(restore.tagName).toBe("BUTTON");
    expect(restore.getAttribute("type")).toBe("button");
    expect(restore.hasAttribute("disabled")).toBe(false);
    restore.focus();
    expect(document.activeElement).toBe(restore);

    fireEvent.click(restore);

    expect(window.location.hash).not.toContain("cat=");
    expect(
      screen.queryByText("No categories selected"),
    ).toBeNull();
    expect(await screen.findByText(CV_PAPER.title)).toBeTruthy();
    expect(screen.getByText(LG_PAPER.title)).toBeTruthy();
  });

  it("reaches the empty state by deselecting every chip in turn", async () => {
    installFetch();
    const group = await renderFeed();

    fireEvent.click(within(group).getByRole("button", { name: "cs.CV" }));
    fireEvent.click(within(group).getByRole("button", { name: "cs.LG" }));

    expect(await screen.findByText("No categories selected")).toBeTruthy();
    expect(pressedCategoryLabels(group)).toEqual([]);
    expect(window.location.hash).toBe("#cat=");

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(await screen.findByText(CV_PAPER.title)).toBeTruthy();
    expect(window.location.hash).not.toContain("cat=");
  });
});
