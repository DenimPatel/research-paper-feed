import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedControls } from "../components/FeedControls";
import type { SortMode } from "../lib/types";

const HINT = /enter a search term to sort by relevance/i;

function renderControls({
  query = "",
  sort = "newest" as SortMode,
}: { query?: string; sort?: SortMode } = {}) {
  const onSortChange = vi.fn();
  render(
    <FeedControls
      query={query}
      onQueryChange={vi.fn()}
      categories={["cs.CV", "cs.LG"]}
      selectedCategories={["cs.CV", "cs.LG"]}
      onToggleCategory={vi.fn()}
      onSelectAllCategories={vi.fn()}
      recency={60}
      onRecencyChange={vi.fn()}
      sort={sort}
      onSortChange={onSortChange}
      resultCount={3}
    />,
  );
  return { onSortChange };
}

function sortChip(name: "Newest" | "Relevance"): HTMLButtonElement {
  return within(screen.getByRole("group", { name: "Sort" })).getByRole(
    "button",
    { name },
  );
}

function pressedSortLabels(): string[] {
  return within(screen.getByRole("group", { name: "Sort" }))
    .getAllByRole("button")
    .filter((chip) => chip.getAttribute("aria-pressed") === "true")
    .map((chip) => chip.textContent ?? "");
}

describe("FeedControls relevance chip", () => {
  it("presses Relevance while a search term is present", () => {
    renderControls({ query: "diffusion", sort: "relevance" });

    const relevance = sortChip("Relevance");
    expect(relevance.getAttribute("aria-pressed")).toBe("true");
    expect(relevance.className).toContain("chip--active");
    expect(relevance.hasAttribute("disabled")).toBe(false);
    expect(pressedSortLabels()).toEqual(["Relevance"]);
  });

  it("keeps the hint out of the way when relevance is available", () => {
    renderControls({ query: "diffusion", sort: "relevance" });
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it("un-presses Relevance and explains why once the query is cleared", () => {
    renderControls({ query: "", sort: "relevance" });

    const relevance = sortChip("Relevance");
    expect(relevance.getAttribute("aria-pressed")).toBe("false");
    expect(relevance.className).not.toContain("chip--active");
    expect(relevance.hasAttribute("disabled")).toBe(true);
  });

  it("names Newest as the sort in effect when relevance is unavailable", () => {
    renderControls({ query: "", sort: "relevance" });
    expect(pressedSortLabels()).toEqual(["Newest"]);
  });

  it("shows a visible hint, not a tooltip, when relevance is unavailable", () => {
    renderControls({ query: "", sort: "relevance" });

    const hint = screen.getByText(HINT);
    expect(hint.tagName).toBe("P");
    expect(hint.className).not.toContain("sr-only");
    expect(hint.closest("[hidden]")).toBeNull();
    expect(hint.getAttribute("aria-hidden")).toBeNull();
  });

  it("treats a whitespace-only query as no query at all", () => {
    renderControls({ query: "   ", sort: "relevance" });

    expect(sortChip("Relevance").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText(HINT)).toBeTruthy();
    expect(pressedSortLabels()).toEqual(["Newest"]);
  });

  it("leaves the default newest sort untouched with no query", () => {
    renderControls({ query: "", sort: "newest" });

    expect(pressedSortLabels()).toEqual(["Newest"]);
    expect(sortChip("Relevance").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText(HINT)).toBeTruthy();
  });

  it("still enables Relevance with a query under the newest sort", () => {
    const { onSortChange } = renderControls({
      query: "diffusion",
      sort: "newest",
    });

    const relevance = sortChip("Relevance");
    expect(relevance.hasAttribute("disabled")).toBe(false);
    fireEvent.click(relevance);
    expect(onSortChange).toHaveBeenCalledWith("relevance");
  });
});

const ALL_CATEGORIES = ["cs.CV", "cs.LG", "cs.RO"];

function renderCategories(selectedCategories: string[]) {
  const onSelectAllCategories = vi.fn();
  render(
    <FeedControls
      query=""
      onQueryChange={vi.fn()}
      categories={ALL_CATEGORIES}
      selectedCategories={selectedCategories}
      onToggleCategory={vi.fn()}
      onSelectAllCategories={onSelectAllCategories}
      recency={60}
      onRecencyChange={vi.fn()}
      sort="newest"
      onSortChange={vi.fn()}
      resultCount={0}
    />,
  );
  return { onSelectAllCategories };
}

function categoryGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Categories" });
}

function allChip(): HTMLButtonElement {
  return within(categoryGroup()).getByRole("button", { name: "All" });
}

describe("FeedControls All chip", () => {
  it("puts All ahead of the per-category chips", () => {
    renderCategories(["cs.CV"]);

    expect(
      within(categoryGroup())
        .getAllByRole("button")
        .map((chip) => chip.textContent),
    ).toEqual(["All", "cs.CV", "cs.LG", "cs.RO"]);
  });

  it("presses All when the selection names every category", () => {
    renderCategories(["cs.RO", "cs.CV", "cs.LG"]);

    expect(allChip().getAttribute("aria-pressed")).toBe("true");
    expect(allChip().className).toContain("chip--active");
  });

  it("leaves All un-pressed for a partial selection", () => {
    renderCategories(["cs.CV"]);

    expect(allChip().getAttribute("aria-pressed")).toBe("false");
    expect(allChip().className).not.toContain("chip--active");
  });

  it("leaves All un-pressed for an explicitly empty selection", () => {
    renderCategories([]);

    expect(allChip().getAttribute("aria-pressed")).toBe("false");
  });

  it("asks the app to select every category when activated", () => {
    const { onSelectAllCategories } = renderCategories([]);

    fireEvent.click(allChip());

    expect(onSelectAllCategories).toHaveBeenCalledTimes(1);
  });

  it("leaves the per-category chips reporting their own state", () => {
    renderCategories(["cs.CV"]);

    expect(allChip().hasAttribute("disabled")).toBe(false);
    expect(
      within(categoryGroup())
        .getByRole("button", { name: "cs.CV" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(categoryGroup())
        .getByRole("button", { name: "cs.LG" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });
});
