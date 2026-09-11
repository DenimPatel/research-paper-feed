import { describe, expect, it } from "vitest";
import { rankPapers, scorePaper, tokenize } from "../search";
import type { Paper } from "../types";

function makePaper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: "2401.00001",
    title: "A Study of Visual Inertial Odometry",
    authors: ["Ada Lovelace"],
    abstract: "We present a neural method for 3d reconstruction from images.",
    abstractTruncated: false,
    published: "2024-01-08",
    updated: "2024-01-08",
    categories: ["cs.CV"],
    primaryCategory: "cs.CV",
    absUrl: "https://arxiv.org/abs/2401.00001",
    pdfUrl: "https://arxiv.org/pdf/2401.00001",
    ...overrides,
  };
}

describe("tokenize", () => {
  it("splits plain terms and lowercases them", () => {
    expect(tokenize("Visual Odometry")).toEqual([
      { text: "visual", phrase: false },
      { text: "odometry", phrase: false },
    ]);
  });

  it("keeps quoted phrases together", () => {
    expect(tokenize('"visual inertial" odometry')).toEqual([
      { text: "visual inertial", phrase: true },
      { text: "odometry", phrase: false },
    ]);
  });

  it("treats an unterminated quote as a plain term", () => {
    expect(tokenize('"visual')).toEqual([{ text: "visual", phrase: false }]);
  });

  it("returns nothing for an empty query", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("scorePaper", () => {
  it("requires every term (implicit AND)", () => {
    const paper = makePaper();
    expect(scorePaper(paper, tokenize("visual odometry"))).toBeGreaterThan(0);
    expect(scorePaper(paper, tokenize("visual quantum"))).toBe(0);
  });

  it("scores title matches above abstract-only matches", () => {
    const titleMatch = makePaper({ title: "Neural rendering", abstract: "none" });
    const abstractMatch = makePaper({
      title: "Unrelated",
      abstract: "neural rendering everywhere",
    });
    const tokens = tokenize("neural");
    expect(scorePaper(titleMatch, tokens)).toBeGreaterThan(
      scorePaper(abstractMatch, tokens),
    );
  });

  it("gives phrase matches a bonus over a plain term", () => {
    const paper = makePaper();
    const phrase = scorePaper(paper, tokenize('"visual inertial"'));
    const single = scorePaper(paper, tokenize("visual"));
    expect(phrase).toBeGreaterThan(single);
  });

  it("requires quoted phrases to match contiguously", () => {
    const paper = makePaper({
      title: "Inertial sensing for visual navigation",
      abstract: "",
    });
    expect(scorePaper(paper, tokenize("visual inertial"))).toBeGreaterThan(0);
    expect(scorePaper(paper, tokenize('"visual inertial"'))).toBe(0);
  });

  it("scores an empty token list as a neutral positive", () => {
    expect(scorePaper(makePaper(), [])).toBe(1);
  });
});

describe("rankPapers", () => {
  it("drops non-matching papers", () => {
    const papers = [
      makePaper({ id: "a", title: "Visual inertial odometry" }),
      makePaper({ id: "b", title: "Quantum chemistry" }),
    ];
    const ranked = rankPapers(papers, "visual");
    expect(ranked.map((entry) => entry.paper.id)).toEqual(["a"]);
  });

  it("orders by score with newest as the tie-breaker", () => {
    const papers = [
      makePaper({
        id: "older-weak",
        title: "Visual",
        abstract: "visual",
        published: "2024-01-01",
      }),
      makePaper({
        id: "newer-strong",
        title: "Visual inertial odometry",
        abstract: "visual",
        published: "2024-02-01",
      }),
    ];
    const ranked = rankPapers(papers, "visual");
    expect(ranked[0].paper.id).toBe("newer-strong");
  });

  it("returns an empty list for a query matching nothing", () => {
    expect(rankPapers([makePaper()], "zzz-no-match")).toEqual([]);
  });
});
