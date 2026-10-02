import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaperCard } from "../components/PaperCard";
import type { Paper } from "../lib/types";

const FIXTURE: Paper = {
  id: "2401.00001",
  title: "A Smoke Test Paper",
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

describe("DOM test environment", () => {
  it("provides a document to test against", () => {
    expect(typeof window).toBe("object");
    expect(typeof document).toBe("object");
    expect(document.body).toBeTruthy();
  });

  it("renders a component into the document", () => {
    render(<PaperCard paper={FIXTURE} />);
    expect(screen.getByRole("heading", { name: FIXTURE.title })).toBeTruthy();
    expect(document.querySelectorAll("article.paper")).toHaveLength(1);
  });

  it("unmounts each rendered tree", () => {
    expect(document.querySelectorAll("article.paper")).toHaveLength(0);
    render(<PaperCard paper={FIXTURE} />);
    expect(document.querySelectorAll("article.paper")).toHaveLength(1);
    cleanup();
    expect(document.querySelectorAll("article.paper")).toHaveLength(0);
  });
});