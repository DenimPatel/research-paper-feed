import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import type { IndexManifest, Paper } from "../lib/types";

const DIFFUSION: Paper = {
  id: "2401.00001",
  title: "Diffusion Models for Everything",
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

const OTHER: Paper = {
  ...DIFFUSION,
  id: "2401.00002",
  title: "A Paper About Something Else",
  abstract: "This abstract covers entirely unrelated topics.",
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
  papers: [DIFFUSION, OTHER],
};

function installFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.endsWith("/index.json") ? MANIFEST : SHARD;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

/**
 * The hero heading and the controls are gated on `manifest`, but the cards are
 * filled by a separate effect keyed on `[manifest, urlState.recency]` that flips
 * `loading` off only once `loadPapers` resolves — so the heading is on screen one
 * commit before any paper is. Everything gated on `manifest` alone is safe to
 * assert synchronously; anything gated on `papers` must be awaited. See
 * `App.retry.test.tsx` for the same split.
 */
async function renderFeed(): Promise<HTMLElement> {
  render(<App />);
  await screen.findByRole("heading", { name: /Recent arXiv papers/ });
  return screen.getByRole("group", { name: "Sort" });
}

function pressedSortLabels(group: HTMLElement): string[] {
  return within(group)
    .getAllByRole("button")
    .filter((chip) => chip.getAttribute("aria-pressed") === "true")
    .map((chip) => chip.textContent ?? "");
}

beforeEach(() => {
  window.location.hash = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("relevance sort over a deep link", () => {
  it("lands on a date-ordered feed for #sort=relevance with no q", async () => {
    installFetch();
    window.location.hash = "#sort=relevance";

    const group = await renderFeed();

    const relevance = within(group).getByRole("button", { name: "Relevance" });
    expect(relevance.getAttribute("aria-pressed")).toBe("false");
    expect(relevance.className).not.toContain("chip--active");
    expect(pressedSortLabels(group)).toEqual(["Newest"]);
    expect(
      screen.getByText(/enter a search term to sort by relevance/i),
    ).toBeTruthy();
    expect(await screen.findByText(OTHER.title)).toBeTruthy();
  });

  it("still honours #q=…&sort=relevance, so the fix does not disable relevance", async () => {
    installFetch();
    window.location.hash = "#q=diffusion&sort=relevance";

    const group = await renderFeed();

    expect(pressedSortLabels(group)).toEqual(["Relevance"]);
    expect(
      screen.queryByText(/enter a search term to sort by relevance/i),
    ).toBeNull();
    expect(await screen.findByText(DIFFUSION.title)).toBeTruthy();
    expect(screen.queryByText(OTHER.title)).toBeNull();
  });

  it("un-presses Relevance when the search box is cleared, and rewrites the hash", async () => {
    installFetch();
    window.location.hash = "#q=diffusion&sort=relevance";
    const group = await renderFeed();
    expect(await screen.findByText(DIFFUSION.title)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search papers"), {
      target: { value: "" },
    });

    const relevance = within(group).getByRole("button", { name: "Relevance" });
    expect(relevance.getAttribute("aria-pressed")).toBe("false");
    expect(pressedSortLabels(group)).toEqual(["Newest"]);
    expect(await screen.findByText(OTHER.title)).toBeTruthy();
    expect(window.location.hash).not.toContain("sort=relevance");
  });
});
