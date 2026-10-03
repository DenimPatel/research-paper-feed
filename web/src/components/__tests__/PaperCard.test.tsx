import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Paper } from "../../lib/types";
import { PaperCard } from "../PaperCard";

/**
 * The shape `record_from_result` (`scripts/build_index.py:121-138`) emits, with
 * nothing nulled out and no extra fields: a card cannot be rendered from
 * anything less, and the mirror convention puts this suite beside the component
 * it covers rather than in `src/__tests__/`.
 */
const FIXTURE: Paper = {
  id: "2401.00001",
  title: "A Minimal Paper",
  authors: ["Ada Lovelace"],
  abstract: "A short abstract that needs no expansion.",
  abstractTruncated: false,
  published: "2024-01-02",
  updated: "2024-01-03",
  categories: ["cs.CV"],
  primaryCategory: "cs.CV",
  absUrl: "https://arxiv.org/abs/2401.00001",
  pdfUrl: "https://arxiv.org/pdf/2401.00001",
};

describe("PaperCard", () => {
  it("links the title to absUrl and renders the publication date", () => {
    const { container } = render(<PaperCard paper={FIXTURE} />);

    const titleLink = screen.getByRole("link", { name: FIXTURE.title });
    expect(titleLink.getAttribute("href")).toBe(FIXTURE.absUrl);

    // IMP-219: `published` is a zoneless calendar day, and `2024-01-02` sits
    // exactly on `00:00Z` — the one value that slid to "Jan 1" for every
    // reader west of Greenwich while `dateTime` kept saying the 2nd.
    // `formatDate` now pins the zone to UTC, so the exact rendered string is
    // the assertion: a wrong month, a wrong day, a wrong year, or the text
    // rendering `updated` instead of `published` are all red, and the visible
    // text can no longer contradict the attribute beside it. The `dateTime`
    // assertion is unchanged — it was always the correct half.
    const published = container.querySelector("time");
    expect(published).not.toBeNull();
    expect(published?.getAttribute("dateTime")).toBe(FIXTURE.published);
    expect(published?.textContent).toBe("Jan 2, 2024");
  });
});