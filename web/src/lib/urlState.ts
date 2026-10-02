import type { RecencyDays, SortMode } from "./types";

const DEFAULT_RECENCY: RecencyDays = 60;
const RECENCY_VALUES: RecencyDays[] = [7, 30, 60];

export type View = "feed" | "collections";

export interface HashState {
  view: View;
  query: string;
  categories: string[] | null;
  recency: RecencyDays;
  sort: SortMode;
}

export interface CategoryResolution {
  /** Requested categories the manifest knows about, de-duplicated, or `null`
   *  when the hash named none. */
  selected: string[] | null;
  /** Requested categories the manifest does not contain, in request order. */
  unknown: string[];
}

/**
 * Intersects a `cat=` list with the manifest's own `categories`, which is the
 * only authority on what this index actually contains.
 *
 * `valid` is the manifest's list, and the manifest is fetched asynchronously —
 * it is `null` at startup and stays `null` forever if the fetch fails. Until
 * then the selection is passed through untouched (only de-duplicated), because
 * a slow or failed manifest must never blank the feed or strand a deep link.
 * Pass the list again once it resolves and unknown values are dropped.
 *
 * A `null` selection means "no explicit selection" and is preserved as `null`,
 * so "all categories" stays representable and stays distinct from the `[]` an
 * explicit `#cat=` produces.
 *
 * `valid` is typed as the manifest declares it, but the manifest arrives
 * through a bare cast (`paperIndex.ts:118`), so the shape is re-checked at
 * runtime before it is trusted.
 */
export function resolveCategories(
  requested: readonly string[] | null,
  valid?: readonly string[] | null,
): CategoryResolution {
  if (requested === null) {
    return { selected: null, unknown: [] };
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const category of requested) {
    if (!seen.has(category)) {
      seen.add(category);
      unique.push(category);
    }
  }

  if (valid === undefined || valid === null) {
    return { selected: unique, unknown: [] };
  }

  // A list that is not an array of non-empty names counts as "the valid list is
  // not known" and leaves the selection alone. `new Set("cs.CV")` yields
  // `{"c","s",".","C","V"}`, so trusting a malformed payload here would drop
  // every selection and empty every feed — a worse blast radius than the typo
  // this guards against.
  if (
    !Array.isArray(valid) ||
    !valid.every((entry) => typeof entry === "string" && entry !== "")
  ) {
    return { selected: unique, unknown: [] };
  }
  const known = new Set(valid);
  return {
    selected: unique.filter((category) => known.has(category)),
    unknown: unique.filter((category) => !known.has(category)),
  };
}

/**
 * Whether `selected` names exactly the same categories as `all`, in any order
 * and without repeats.
 *
 * "All categories" is a state the app can be in without saying so. `null` is
 * one way to spell it, but a selection that happens to cover the whole index is
 * the same state reached a different way, and the two must serialize identically
 * — otherwise the URL carries a `cat=` that reads straight back out, and the
 * "All" chip disagrees with the address bar about what is pressed.
 *
 * `all` is the manifest's own list and is re-checked at runtime for the same
 * reason `resolveCategories` re-checks it: it arrives through a bare cast. A
 * list that cannot be trusted answers "no", which keeps the writer emitting the
 * `cat=` it emitted before rather than dropping a live filter.
 */
export function isFullSelection(
  selected: readonly string[],
  all?: readonly string[] | null,
): boolean {
  if (!Array.isArray(all) || all.length === 0) {
    return false;
  }
  const valid = new Set<string>();
  for (const entry of all) {
    if (typeof entry !== "string" || entry === "") {
      return false;
    }
    valid.add(entry);
  }
  const chosen = new Set(selected);
  return (
    chosen.size === valid.size && all.every((category) => chosen.has(category))
  );
}

/**
 * Parses a location hash into the app's URL state, and nothing more. `cat=` is
 * de-duplicated but *not* validated here: the manifest has not been fetched at
 * the point this is called (first render, or the `hashchange` listener), so
 * `readHash` cannot know what the index contains. Validation belongs to
 * `resolveCategories`, run at the call site once `manifest` exists — see
 * `App.tsx`.
 */
export function readHash(hash: string = window.location.hash): HashState {
  const raw = hash.replace(/^#/, "");
  const params = new URLSearchParams(raw);

  const rawRecency = Number(params.get("recency"));
  const recency = RECENCY_VALUES.includes(rawRecency as RecencyDays)
    ? (rawRecency as RecencyDays)
    : DEFAULT_RECENCY;

  const rawCategories = params.get("cat");
  const categories =
    rawCategories === null ? null : rawCategories.split(",").filter(Boolean);
  const query = params.get("q") ?? "";

  return {
    view: params.get("view") === "collections" ? "collections" : "feed",
    query,
    categories: resolveCategories(categories).selected,
    recency,
    // Relevance ranks against a search term, so `sort=relevance` without one
    // asks for an order the feed cannot produce. Normalizing it here keeps a
    // shared `#sort=relevance` link self-consistent on its very first render
    // instead of pressing the chip over a date-ordered list.
    sort:
      query.trim() !== "" && params.get("sort") === "relevance"
        ? "relevance"
        : "newest",
  };
}

export type HashWriter = (hash: string, mode: "push" | "replace") => void;

function writeToLocation(hash: string, mode: "push" | "replace"): void {
  if (mode === "push") {
    window.location.hash = hash;
  } else {
    window.history.replaceState(null, "", hash);
  }
}

/**
 * Serializes `state` into the URL hash and hands it to `write`, which defaults
 * to the real `location.hash` / `history.replaceState` writers. The hash is
 * also returned so callers — and tests — never have to read it back out of the
 * address bar, which is why the serialization needs no `window` of its own.
 *
 * `allCategories` is the index's own category list. It is what makes "every
 * category" recognizable: a selection that covers all of it is not a filter, so
 * it is written as no `cat=` at all and reads back as the `null` that means the
 * same thing. An explicitly empty selection is a different request and keeps its
 * own `cat=`. Omit the list and every non-`null` selection is written as named,
 * which is what a caller that has no manifest in hand wants.
 */
export function writeHash(
  state: HashState,
  mode: "push" | "replace",
  write: HashWriter = writeToLocation,
  allCategories?: readonly string[] | null,
): { hash: string } {
  const params = new URLSearchParams();
  if (state.view !== "feed") {
    params.set("view", state.view);
  }
  if (state.query) {
    params.set("q", state.query);
  }
  if (
    state.categories !== null &&
    !isFullSelection(state.categories, allCategories)
  ) {
    params.set("cat", state.categories.join(","));
  }
  if (state.recency !== DEFAULT_RECENCY) {
    params.set("recency", String(state.recency));
  }
  // The mirror of the `readHash` normalization: never write a `sort=relevance`
  // that the reader would have to strip, or clearing the query would leave the
  // address bar claiming an order the feed is not using.
  if (state.sort !== "newest" && state.query.trim() !== "") {
    params.set("sort", state.sort);
  }

  const hash = `#${params.toString()}`;
  write(hash, mode);
  return { hash };
}