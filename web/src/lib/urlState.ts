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

export function readHash(hash: string = window.location.hash): HashState {
  const raw = hash.replace(/^#/, "");
  const params = new URLSearchParams(raw);

  const rawRecency = Number(params.get("recency"));
  const recency = RECENCY_VALUES.includes(rawRecency as RecencyDays)
    ? (rawRecency as RecencyDays)
    : DEFAULT_RECENCY;

  const rawCategories = params.get("cat");

  return {
    view: params.get("view") === "collections" ? "collections" : "feed",
    query: params.get("q") ?? "",
    categories:
      rawCategories === null
        ? null
        : rawCategories.split(",").filter(Boolean),
    recency,
    sort: params.get("sort") === "relevance" ? "relevance" : "newest",
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
 */
export function writeHash(
  state: HashState,
  mode: "push" | "replace",
  write: HashWriter = writeToLocation,
): { hash: string } {
  const params = new URLSearchParams();
  if (state.view !== "feed") {
    params.set("view", state.view);
  }
  if (state.query) {
    params.set("q", state.query);
  }
  if (state.categories !== null) {
    params.set("cat", state.categories.join(","));
  }
  if (state.recency !== DEFAULT_RECENCY) {
    params.set("recency", String(state.recency));
  }
  if (state.sort !== "newest") {
    params.set("sort", state.sort);
  }

  const hash = `#${params.toString()}`;
  write(hash, mode);
  return { hash };
}