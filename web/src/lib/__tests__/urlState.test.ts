// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  readHash,
  writeHash,
  type HashState,
  type HashWriter,
} from "../urlState";

const DEFAULT_STATE: HashState = {
  view: "feed",
  query: "",
  categories: null,
  recency: 60,
  sort: "newest",
};

const FULL_STATE: HashState = {
  view: "collections",
  query: "diffusion",
  categories: ["cs.CV", "cs.LG"],
  recency: 7,
  sort: "relevance",
};

const FULL_HASH =
  "#view=collections&q=diffusion&cat=cs.CV,cs.LG&recency=7&sort=relevance";

const IGNORE_LOCATION: HashWriter = () => {};

function recordWrites(): {
  calls: { hash: string; mode: "push" | "replace" }[];
  write: HashWriter;
} {
  const calls: { hash: string; mode: "push" | "replace" }[] = [];
  return {
    calls,
    write: (hash, mode) => {
      calls.push({ hash, mode });
    },
  };
}

describe("readHash", () => {
  it("returns the default state for an empty hash", () => {
    expect(readHash("")).toEqual(DEFAULT_STATE);
  });

  it("returns the default state for a bare #", () => {
    expect(readHash("#")).toEqual(DEFAULT_STATE);
  });

  it("reads every parameter of a full hash", () => {
    expect(readHash(FULL_HASH)).toEqual(FULL_STATE);
  });

  it("falls back to the default recency for an unknown window", () => {
    expect(readHash("#recency=99").recency).toBe(60);
    expect(readHash("#recency=").recency).toBe(60);
    expect(readHash("#recency=week").recency).toBe(60);
  });

  it("keeps each recency window the UI offers", () => {
    expect(readHash("#recency=7").recency).toBe(7);
    expect(readHash("#recency=30").recency).toBe(30);
  });

  it("falls back to the feed for an unknown view", () => {
    expect(readHash("#view=collections").view).toBe("collections");
    expect(readHash("#view=archive").view).toBe("feed");
  });

  it("falls back to newest for an unknown sort", () => {
    expect(readHash("#q=diffusion&sort=oldest").sort).toBe("newest");
    expect(readHash("#q=diffusion&sort=").sort).toBe("newest");
  });

  it("keeps relevance only when the hash carries a search term", () => {
    expect(readHash("#q=diffusion&sort=relevance").sort).toBe("relevance");
  });

  it("falls back to newest when sort=relevance arrives with no query", () => {
    expect(readHash("#sort=relevance").sort).toBe("newest");
  });

  it("treats a blank or whitespace-only query as no query for sort", () => {
    expect(readHash("#q=&sort=relevance").sort).toBe("newest");
    expect(readHash("#q=%20%20&sort=relevance").sort).toBe("newest");
  });

  it("reads a category list and drops empty entries", () => {
    expect(readHash("#cat=cs.CV,,cs.LG").categories).toEqual([
      "cs.CV",
      "cs.LG",
    ]);
  });

  it("reads an explicit empty cat as an empty selection, not the default", () => {
    expect(readHash("#cat=").categories).toEqual([]);
  });

  it("reads a percent-encoded category list written back by writeHash", () => {
    expect(readHash("#cat=cs.CV%2Ccs.LG").categories).toEqual([
      "cs.CV",
      "cs.LG",
    ]);
  });
});

describe("writeHash", () => {
  it("omits every default, leaving a bare #", () => {
    expect(writeHash(DEFAULT_STATE, "replace", IGNORE_LOCATION).hash).toBe("#");
  });

  it("omits a relevance sort that no query could justify", () => {
    const hash = writeHash(
      { ...DEFAULT_STATE, sort: "relevance" },
      "replace",
      IGNORE_LOCATION,
    ).hash;
    expect(hash).toBe("#");
  });

  it("omits a relevance sort for a whitespace-only query", () => {
    const hash = writeHash(
      { ...DEFAULT_STATE, query: "   ", sort: "relevance" },
      "replace",
      IGNORE_LOCATION,
    ).hash;
    expect(hash).toBe("#q=+++");
  });

  it("round-trips a relevance hash whose query was cleared away", () => {
    const { hash } = writeHash(
      { ...readHash(FULL_HASH), query: "" },
      "replace",
      IGNORE_LOCATION,
    );
    expect(hash).toBe("#view=collections&cat=cs.CV%2Ccs.LG&recency=7");
    expect(readHash(hash).sort).toBe("newest");
  });

  it("writes every non-default value in a fixed order", () => {
    const hash = writeHash(FULL_STATE, "replace", IGNORE_LOCATION).hash;
    expect(hash).toBe(
      "#view=collections&q=diffusion&cat=cs.CV%2Ccs.LG&recency=7&sort=relevance",
    );
  });

  it("round-trips a full hash back through readHash", () => {
    const { hash } = writeHash(readHash(FULL_HASH), "replace", IGNORE_LOCATION);
    expect(readHash(hash)).toEqual(FULL_STATE);
  });

  it("round-trips the default hash back through readHash", () => {
    const { hash } = writeHash(readHash("#"), "replace", IGNORE_LOCATION);
    expect(readHash(hash)).toEqual(DEFAULT_STATE);
  });

  it("writes an empty category selection as an explicit cat=", () => {
    const hash = writeHash(
      { ...DEFAULT_STATE, categories: [] },
      "replace",
      IGNORE_LOCATION,
    ).hash;
    expect(hash).toBe("#cat=");
  });

  it("hands the serialized hash and the mode to the writer", () => {
    const { calls, write } = recordWrites();
    writeHash({ ...DEFAULT_STATE, view: "collections" }, "push", write);
    expect(calls).toEqual([{ hash: "#view=collections", mode: "push" }]);
  });

  it("replaces rather than pushes when asked to", () => {
    const { calls, write } = recordWrites();
    writeHash({ ...DEFAULT_STATE, recency: 30 }, "replace", write);
    expect(calls).toEqual([{ hash: "#recency=30", mode: "replace" }]);
  });

  it("does not need a window to serialize a state", () => {
    expect(typeof window).toBe("undefined");
    expect(readHash(FULL_HASH)).toEqual(FULL_STATE);
    expect(writeHash(FULL_STATE, "replace", IGNORE_LOCATION).hash).toBe(
      "#view=collections&q=diffusion&cat=cs.CV%2Ccs.LG&recency=7&sort=relevance",
    );
  });
});