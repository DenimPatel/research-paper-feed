import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaperCard } from "../components/PaperCard";
import type { Paper } from "../lib/types";

/**
 * `record_from_result` (`scripts/build_index.py:118-120`) reads
 * `primaryCategory`, `absUrl` and `pdfUrl` with `getattr(result, …, None)`, so
 * arXiv omitting one of them publishes JSON `null` there and the card receives
 * that null straight from the shard. `Paper` declares all three `string | null`
 * for exactly that reason, so these fixtures are only assignable while the
 * declaration matches the producer — which is what makes this file fail
 * `npm run typecheck` against the old non-nullable types.
 */
function paper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: "2401.00001",
    title: "A paper with a url-less arXiv entry",
    authors: ["Ada Lovelace"],
    abstract: "An abstract.",
    abstractTruncated: false,
    published: "2024-01-08",
    updated: "2024-01-08",
    categories: ["cs.CV", "cs.LG"],
    primaryCategory: "cs.CV",
    absUrl: "https://arxiv.org/abs/2401.00001",
    pdfUrl: "https://arxiv.org/pdf/2401.00001",
    ...overrides,
  };
}

/** Every anchor the card rendered, so no `href` can hide from the assertions. */
function anchors(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll("a"));
}

function assertNoNullHref(container: HTMLElement): void {
  for (const anchor of anchors(container)) {
    const href = anchor.getAttribute("href");
    expect(href).not.toBeNull();
    expect(href).toMatch(/^https?:\/\//i);
    // `String(null)`/`String(undefined)` are the shapes a null would take if it
    // ever reached `href` through string coercion instead of being dropped.
    expect(anchor.getAttribute("href")).not.toBe("null");
    expect(anchor.getAttribute("href")).not.toBe("undefined");
  }
}

describe("a card whose pdfUrl is null", () => {
  it("omits the PDF link and still renders the card", () => {
    const { container } = render(<PaperCard paper={paper({ pdfUrl: null })} />);

    expect(screen.getByText(paper().title)).toBeTruthy();
    // The PDF control is gone rather than broken: no link, no throw, and the
    // sibling arXiv link is untouched.
    expect(screen.queryByRole("link", { name: "PDF" })).toBeNull();
    expect(screen.getByRole("link", { name: "arXiv" })).toBeTruthy();
    assertNoNullHref(container);
  });

  it("omits the PDF link when absUrl is null too", () => {
    const { container } = render(
      <PaperCard paper={paper({ absUrl: null, pdfUrl: null })} />,
    );

    expect(screen.getByText(paper().title)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "PDF" })).toBeNull();
    expect(screen.queryByRole("link", { name: "arXiv" })).toBeNull();
    // No url at all, so the card has no anchor whatsoever.
    expect(anchors(container)).toHaveLength(0);
    assertNoNullHref(container);
  });

  it("keeps a url that is only unsafely absent-safe when it is a real http url", () => {
    // The other side of the same guard: a non-http value is still refused, so
    // widening the type to `string | null` did not turn `safeHref` into a
    // pass-through.
    const { container } = render(
      <PaperCard paper={paper({ pdfUrl: "javascript:alert(1)" })} />,
    );

    expect(screen.queryByRole("link", { name: "PDF" })).toBeNull();
    expect(screen.getByRole("link", { name: "arXiv" })).toBeTruthy();
    assertNoNullHref(container);
  });
});

describe("a card whose absUrl is null", () => {
  it("renders the title as plain text and links only the PDF", () => {
    const { container } = render(<PaperCard paper={paper({ absUrl: null })} />);

    // The title anchor is conditional on a verified `absUrl`, so with none the
    // heading holds a span instead of a link that goes nowhere.
    expect(screen.getByRole("heading").querySelector("a")).toBeNull();
    expect(screen.getByRole("link", { name: "PDF" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "arXiv" })).toBeNull();
    assertNoNullHref(container);
  });
});

describe("a card whose primaryCategory is null", () => {
  it("renders every category chip and marks none of them primary", () => {
    const { container } = render(
      <PaperCard paper={paper({ primaryCategory: null })} />,
    );

    const tags = Array.from(container.querySelectorAll(".paper__chips .tag"));
    expect(tags.map((tag) => tag.textContent)).toEqual(["cs.CV", "cs.LG"]);
    // `null` is "the producer named no primary", not a category that happens to
    // equal null, so no chip may claim the modifier.
    expect(tags.every((tag) => !tag.className.includes("tag--primary"))).toBe(
      true,
    );
    assertNoNullHref(container);
  });
});

describe("a card with all three producer fields null", () => {
  it("renders completely and without a single anchor", () => {
    const { container } = render(
      <PaperCard
        paper={paper({ primaryCategory: null, absUrl: null, pdfUrl: null })}
      />,
    );

    expect(screen.getByText(paper().title)).toBeTruthy();
    expect(screen.getByText("An abstract.")).toBeTruthy();
    expect(anchors(container)).toHaveLength(0);
    assertNoNullHref(container);
  });

  it("still reads its truncated-abstract note without linking the missing url", () => {
    const { container } = render(
      <PaperCard
        paper={paper({
          abstractTruncated: true,
          absUrl: null,
          pdfUrl: null,
        })}
      />,
    );

    // The note keeps its wording and drops only the anchor, so the reader is
    // not sent to an href that is not there.
    expect(
      screen.getByText(/Abstract truncated/).textContent,
    ).toContain("view the full text on arXiv");
    expect(anchors(container)).toHaveLength(0);
    assertNoNullHref(container);
  });
});
