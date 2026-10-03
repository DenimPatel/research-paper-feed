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

    // `formatDate` returns `toLocaleDateString(undefined, …)`, so the visible
    // wording follows the runner's locale; the `dateTime` attribute is the
    // machine-readable half and the text only has to be there.
    const published = container.querySelector("time");
    expect(published).not.toBeNull();
    expect(published?.getAttribute("dateTime")).toBe(FIXTURE.published);
    expect(published?.textContent).toContain("2024");
  });
});