// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  isFullSelection,
  readHash,
  resolveCategories,
  writeHash,
  type HashState,
  type HashWriter,
} from "../urlState";

/** `scripts/build_index.py:32` DEFAULT_CATEGORIES, as the manifest ships them. */
const MANIFEST_CATEGORIES = ["cs.CV", "cs.LG", "cs.CL", "cs.AI", "cs.RO"];

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

  it("de-duplicates a repeated category key", () => {
    expect(readHash("#cat=cs.CV,cs.CV,cs.LG").categories).toEqual([
      "cs.CV",
      "cs.LG",
    ]);
  });

  it("never validates cat, because the manifest is not in hand yet", () => {
    // `readHash` runs before the index is fetched and never re-runs, so it has
    // no way to know what the index contains. Dropping unknown values is
    // `resolveCategories`' job, at the call site that has the manifest.
    expect(readHash("#cat=cs.CV,cs.BI").categories).toEqual(["cs.CV", "cs.BI"]);
    expect(readHash("#cat=cs.BI").categories).toEqual(["cs.BI"]);
  });
});

describe("resolveCategories", () => {
  it("returns a null selection when the hash named no category", () => {
    expect(resolveCategories(null, MANIFEST_CATEGORIES)).toEqual({
      selected: null,
      unknown: [],
    });
  });

  it("keeps a null selection so all categories stay representable", () => {
    expect(resolveCategories(null, null).selected).toBeNull();
    expect(resolveCategories(null, undefined).selected).toBeNull();
  });

  it("keeps an explicitly empty selection empty", () => {
    expect(resolveCategories([], MANIFEST_CATEGORIES)).toEqual({
      selected: [],
      unknown: [],
    });
  });

  it("keeps the selection intact while the manifest is unknown", () => {
    expect(resolveCategories(["cs.BI", "cs.XX"], null)).toEqual({
      selected: ["cs.BI", "cs.XX"],
      unknown: [],
    });
    expect(resolveCategories(["cs.BI"], undefined).unknown).toEqual([]);
  });

  it("intersects with the manifest and reports every dropped value", () => {
    expect(
      resolveCategories(["cs.BI", "cs.CV", "cs.NOPE"], MANIFEST_CATEGORIES),
    ).toEqual({
      selected: ["cs.CV"],
      unknown: ["cs.BI", "cs.NOPE"],
    });
  });

  it("preserves the requested order rather than the manifest order", () => {
    expect(
      resolveCategories(["cs.RO", "cs.CV"], MANIFEST_CATEGORIES).selected,
    ).toEqual(["cs.RO", "cs.CV"]);
  });

  it("de-duplicates before validating so a repeat cannot be reported twice", () => {
    expect(
      resolveCategories(["cs.BI", "cs.BI", "cs.CV", "cs.CV"], MANIFEST_CATEGORIES),
    ).toEqual({ selected: ["cs.CV"], unknown: ["cs.BI"] });
  });

  it("drops unicode and look-alike values that are not in the manifest", () => {
    expect(
      resolveCategories(
        ["cs.ＣＶ", "csv", " cs.CV", "cs.CV "],
        MANIFEST_CATEGORIES,
      ),
    ).toEqual({ selected: [], unknown: ["cs.ＣＶ", "csv", " cs.CV", "cs.CV "] });
  });

  // Membership is exact on purpose. arXiv category names are case-sensitive
  // strings, and a fuzzy match would invent a filter the user never asked for —
  // the exact failure this item removes. Reporting a near miss as unknown and
  // naming it in the notice is the recoverable version of that failure.
  it("does not fuzzy-match a near miss onto a category the index does have", () => {
    expect(
      resolveCategories(["cs.cv", "CS.CV", "cs.Cv"], MANIFEST_CATEGORIES),
    ).toEqual({
      selected: [],
      unknown: ["cs.cv", "CS.CV", "cs.Cv"],
    });
  });

  it("treats an empty manifest list as declaring nothing valid", () => {
    expect(resolveCategories(["cs.CV"], [])).toEqual({
      selected: [],
      unknown: ["cs.CV"],
    });
  });

  it("accepts a manifest list that repeats a category", () => {
    expect(
      resolveCategories(["cs.CV"], [...MANIFEST_CATEGORIES, "cs.CV"]).selected,
    ).toEqual(["cs.CV"]);
  });

  it("does not mutate the requested list", () => {
    const requested = ["cs.BI", "cs.CV", "cs.BI"];
    resolveCategories(requested, MANIFEST_CATEGORIES);
    expect(requested).toEqual(["cs.BI", "cs.CV", "cs.BI"]);
  });

  it("leaves the selection alone when the manifest list is malformed", () => {
    // The manifest reaches the app through a bare cast, so the shape `as
    // string[]` promises is not one the runtime guarantees. The casts below are
    // what the app's own types would hide.
    const nonArrayEntry = ["cs.CV", {}, 7] as unknown as string[];
    expect(resolveCategories(["cs.BI"], nonArrayEntry)).toEqual({
      selected: ["cs.BI"],
      unknown: [],
    });
    const blankEntry = ["cs.CV", ""] as string[];
    expect(resolveCategories(["cs.BI"], blankEntry).selected).toEqual([
      "cs.BI",
    ]);
  });

  it("does not read a bare string as a list of one-character categories", () => {
    expect(
      resolveCategories(["cs.CV", "cs.LG"], "cs.CV" as unknown as string[]).selected,
    ).toEqual(["cs.CV", "cs.LG"]);
  });
});

describe("isFullSelection", () => {
  it("accepts a selection naming every category, in any order", () => {
    expect(isFullSelection(MANIFEST_CATEGORIES, MANIFEST_CATEGORIES)).toBe(true);
    expect(
      isFullSelection([...MANIFEST_CATEGORIES].reverse(), MANIFEST_CATEGORIES),
    ).toBe(true);
  });

  it("rejects a partial selection", () => {
    expect(isFullSelection(["cs.CV"], MANIFEST_CATEGORIES)).toBe(false);
    expect(
      isFullSelection(MANIFEST_CATEGORIES.slice(0, 4), MANIFEST_CATEGORIES),
    ).toBe(false);
  });

  it("rejects a selection naming more than the index has", () => {
    expect(
      isFullSelection([...MANIFEST_CATEGORIES, "cs.BI"], MANIFEST_CATEGORIES),
    ).toBe(false);
  });

  it("rejects an explicitly empty selection", () => {
    expect(isFullSelection([], MANIFEST_CATEGORIES)).toBe(false);
  });

  it("cannot be fooled by a repeated name on either side", () => {
    // A repeat must not stand in for a missing category: `["cs.CV","cs.CV"]`
    // has two entries but names one category.
    expect(isFullSelection(["cs.CV", "cs.CV"], MANIFEST_CATEGORIES)).toBe(false);
    // A manifest that repeats a category still declares the same set.
    expect(
      isFullSelection(MANIFEST_CATEGORIES, [
        ...MANIFEST_CATEGORIES,
        "cs.CV",
      ]),
    ).toBe(true);
  });

  it("answers no while the manifest list is absent or unusable", () => {
    // Answering "yes" here would make the writer drop a live `cat=`.
    expect(isFullSelection(MANIFEST_CATEGORIES, null)).toBe(false);
    expect(isFullSelection(MANIFEST_CATEGORIES, undefined)).toBe(false);
    expect(isFullSelection(MANIFEST_CATEGORIES, [])).toBe(false);
    expect(
      isFullSelection(
        MANIFEST_CATEGORIES,
        ["cs.CV", {}] as unknown as string[],
      ),
    ).toBe(false);
    expect(
      isFullSelection(MANIFEST_CATEGORIES, "cs.CV" as unknown as string[]),
    ).toBe(false);
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

  it("omits cat for a selection that covers the whole index", () => {
    const hash = writeHash(
      { ...DEFAULT_STATE, categories: [...MANIFEST_CATEGORIES] },
      "replace",
      IGNORE_LOCATION,
      MANIFEST_CATEGORIES,
    ).hash;

    expect(hash).toBe("#");
    // The `cat=` it drops is the one `readHash` reports as no selection at all,
    // so the round trip lands on the same state the writer started from.
    expect(readHash(hash).categories).toBeNull();
  });

  it("emits cat for a partial selection of the same index", () => {
    const hash = writeHash(
      { ...DEFAULT_STATE, categories: ["cs.CV", "cs.LG"] },
      "replace",
      IGNORE_LOCATION,
      MANIFEST_CATEGORIES,
    ).hash;

    expect(hash).toBe("#cat=cs.CV%2Ccs.LG");
    expect(readHash(hash).categories).toEqual(["cs.CV", "cs.LG"]);
  });

  it("keeps an explicitly empty selection its own cat=, not the full one", () => {
    // "No category" and "every category" are different requests; collapsing
    // them would silently re-filter the feed the user just emptied.
    const hash = writeHash(
      { ...DEFAULT_STATE, categories: [] },
      "replace",
      IGNORE_LOCATION,
      MANIFEST_CATEGORIES,
    ).hash;

    expect(hash).toBe("#cat=");
    expect(readHash(hash).categories).toEqual([]);
  });

  it("still emits cat when the index's category list is not in hand", () => {
    // No list means no way to recognize a full selection, and dropping the
    // filter would be the worse failure of the two.
    const hash = writeHash(
      { ...DEFAULT_STATE, categories: [...MANIFEST_CATEGORIES] },
      "replace",
      IGNORE_LOCATION,
    ).hash;

    expect(hash).toBe(`#cat=${MANIFEST_CATEGORIES.join("%2C")}`);
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