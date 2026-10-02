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

function pressedCategoryLabels(group: HTMLElement): string[] {
  return within(group)
    .getAllByRole("button")
    .filter((chip) => chip.getAttribute("aria-pressed") === "true")
    .map((chip) => chip.textContent ?? "");
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
    // reveals whether the carried list was intersected or raw.
    fireEvent.click(within(group).getByRole("button", { name: "cs.LG" }));
    expect(window.location.hash).toBe("#cat=cs.CV%2Ccs.LG");
    expect(pressedCategoryLabels(group)).toEqual(["cs.CV", "cs.LG"]);
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

    expect(await screen.findByText(/No papers match the current filters/)).toBeTruthy();
    expect(pressedCategoryLabels(group)).toEqual([]);
  });

  it("recovers the whole feed when the reset is clicked", async () => {
    installFetch();
    window.location.hash = "#cat=cs.BI";
    const group = await renderFeed();
    expect(await screen.findByText(/No papers match the current filters/)).toBeTruthy();

    fireEvent.click(
      within(unknownNotice()).getByRole("button", { name: /reset category filter/i }),
    );

    expect(window.location.hash).not.toContain("cat=");
    expect(screen.queryByRole("alert")).toBeNull();
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
    // is nothing to report. Its empty feed is a separate item's business.
    installFetch();
    window.location.hash = "#cat=";

    await renderFeed();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findByText(/No papers match the current filters/)).toBeTruthy();
  });
});
