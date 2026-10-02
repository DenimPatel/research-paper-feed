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
    expect(readHash("#sort=relevance").sort).toBe("relevance");
    expect(readHash("#sort=oldest").sort).toBe("newest");
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