import type { Paper } from "./types";

export const COLLECTIONS_KEY = "rpf.collections.v1";
export const PAPERS_KEY = "rpf.papers.v1";

export interface Collection {
  id: string;
  name: string;
  createdAt: string;
  paperIds: string[];
}

export interface CollectionsState {
  collections: Collection[];
  papers: Record<string, Paper>;
}

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  collection: Collection;
  papers: Paper[];
}

export type CollectionsAction =
  | { type: "addCollection"; collection: Collection }
  | { type: "renameCollection"; id: string; name: string }
  | { type: "deleteCollection"; id: string }
  | { type: "addPaper"; collectionId: string; paper: Paper }
  | { type: "removePaper"; collectionId: string; paperId: string }
  | { type: "mergeImport"; payload: ExportPayload };

export const EMPTY_STATE: CollectionsState = { collections: [], papers: {} };

/**
 * Keys inherited from `Object.prototype`. An untrusted `id` matching one of
 * these resolves through the prototype chain instead of being an own snapshot,
 * so it must never be stored or resolved as a paper.
 */
const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Own-key membership. A bare bracket read walks the prototype chain, which
 * lets an imported `"__proto__"` id masquerade as a stored paper.
 * `Object.hasOwn` would read better but needs the ES2022 lib; `lib` here is
 * ES2020, so use the equivalent `hasOwnProperty` call.
 */
function hasOwnKey(map: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key);
}

export function newId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createCollection(
  name: string,
  now: string = new Date().toISOString(),
  id: string = newId(),
): Collection {
  return { id, name, createdAt: now, paperIds: [] };
}

function isPaper(value: unknown): value is Paper {
  if (!value || typeof value !== "object") {
    return false;
  }
  const paper = value as Partial<Paper>;
  return (
    typeof paper.id === "string" &&
    !PROTOTYPE_KEYS.has(paper.id) &&
    typeof paper.title === "string" &&
    Array.isArray(paper.authors) &&
    typeof paper.abstract === "string"
  );
}

/**
 * Absolute http(s) only. Papers reach the renderer as clickable hrefs, and React
 * does not block `javascript:` there, so anything else must not survive import.
 */
export function isHttpUrl(value: unknown): boolean {
  return /^https?:\/\//i.test(String(value).trim());
}

/**
 * Reject only urls that are present and not `http(s)`. A field the producer
 * left absent is `null` as often as it is missing — `build_index.py` reads it
 * with `getattr(result, …, None)` — and that is "no url", not "unsafe url",
 * so dropping the paper would lose data this guard never meant to remove.
 */
function hasSafeUrls(value: Paper): boolean {
  const paper = value as Partial<Paper>;
  return [paper.absUrl, paper.pdfUrl].every(
    (url) => url == null || isHttpUrl(url),
  );
}

function isCollection(value: unknown): value is Collection {
  if (!value || typeof value !== "object") {
    return false;
  }
  const collection = value as Partial<Collection>;
  return (
    typeof collection.id === "string" &&
    typeof collection.name === "string" &&
    Array.isArray(collection.paperIds) &&
    collection.paperIds.every((id) => typeof id === "string")
  );
}

/** Drop paper snapshots no collection references any more. */
function prunePapers(state: CollectionsState): CollectionsState {
  const referenced = new Set<string>();
  for (const collection of state.collections) {
    for (const id of collection.paperIds) {
      referenced.add(id);
    }
  }
  const papers: Record<string, Paper> = {};
  for (const [id, paper] of Object.entries(state.papers)) {
    if (referenced.has(id)) {
      papers[id] = paper;
    }
  }
  return { collections: state.collections, papers };
}

function mergeImport(
  state: CollectionsState,
  payload: ExportPayload,
): CollectionsState {
  const papers: Record<string, Paper> = { ...state.papers };
  for (const paper of payload.papers) {
    if (!hasOwnKey(papers, paper.id)) {
      papers[paper.id] = paper;
    }
  }

  if (state.collections.some((c) => c.id === payload.collection.id)) {
    return { collections: state.collections, papers };
  }

  const paperIds = Array.from(
    new Set(
      (payload.collection.paperIds.length > 0
        ? payload.collection.paperIds
        : payload.papers.map((paper) => paper.id)
      ).filter((id) => hasOwnKey(papers, id)),
    ),
  );

  return {
    collections: [
      ...state.collections,
      { ...payload.collection, name: payload.collection.name, paperIds },
    ],
    papers,
  };
}

export function collectionsReducer(
  state: CollectionsState,
  action: CollectionsAction,
): CollectionsState {
  switch (action.type) {
    case "addCollection":
      return {
        ...state,
        collections: [...state.collections, action.collection],
      };
    case "renameCollection": {
      const name = action.name.trim();
      if (!name) {
        return state;
      }
      return {
        ...state,
        collections: state.collections.map((collection) =>
          collection.id === action.id ? { ...collection, name } : collection,
        ),
      };
    }
    case "deleteCollection":
      return prunePapers({
        ...state,
        collections: state.collections.filter((c) => c.id !== action.id),
      });
    case "addPaper": {
      const collections = state.collections.map((collection) =>
        collection.id === action.collectionId &&
        !collection.paperIds.includes(action.paper.id)
          ? {
              ...collection,
              paperIds: [...collection.paperIds, action.paper.id],
            }
          : collection,
      );
      return {
        collections,
        papers: { ...state.papers, [action.paper.id]: action.paper },
      };
    }
    case "removePaper":
      return prunePapers({
        ...state,
        collections: state.collections.map((collection) =>
          collection.id === action.collectionId
            ? {
                ...collection,
                paperIds: collection.paperIds.filter(
                  (id) => id !== action.paperId,
                ),
              }
            : collection,
        ),
      });
    case "mergeImport":
      return mergeImport(state, action.payload);
    default:
      return state;
  }
}

export function exportCollection(
  state: CollectionsState,
  collectionId: string,
  now: string = new Date().toISOString(),
): ExportPayload | null {
  const collection = state.collections.find((c) => c.id === collectionId);
  if (!collection) {
    return null;
  }
  const papers = collection.paperIds
    .filter((id) => hasOwnKey(state.papers, id))
    .map((id) => state.papers[id])
    .filter((paper): paper is Paper => Boolean(paper));
  return { version: 1, exportedAt: now, collection, papers };
}

/** Validate an untrusted import file, returning null when it is unusable. */
export function parseExportPayload(raw: unknown): ExportPayload | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const candidate = raw as Partial<ExportPayload>;
  if (!isCollection(candidate.collection)) {
    return null;
  }
  if (!Array.isArray(candidate.papers)) {
    return null;
  }
  const papers = candidate.papers.filter(isPaper).filter(hasSafeUrls);
  return {
    version: 1,
    exportedAt:
      typeof candidate.exportedAt === "string"
        ? candidate.exportedAt
        : new Date().toISOString(),
    collection: candidate.collection,
    papers,
  };
}

function defaultStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadState(
  storage: Storage | null = defaultStorage(),
): CollectionsState {
  if (!storage) {
    return EMPTY_STATE;
  }
  try {
    const rawCollections = storage.getItem(COLLECTIONS_KEY);
    const rawPapers = storage.getItem(PAPERS_KEY);
    const parsedCollections: unknown = rawCollections
      ? JSON.parse(rawCollections)
      : [];
    const parsedPapers: unknown = rawPapers ? JSON.parse(rawPapers) : {};

    const papers: Record<string, Paper> = {};
    if (parsedPapers && typeof parsedPapers === "object") {
      for (const [id, paper] of Object.entries(
        parsedPapers as Record<string, unknown>,
      )) {
        if (!PROTOTYPE_KEYS.has(id) && isPaper(paper)) {
          papers[id] = paper;
        }
      }
    }

    const collections = Array.isArray(parsedCollections)
      ? parsedCollections.filter(isCollection).map((collection) => ({
          ...collection,
          paperIds: collection.paperIds.filter((id) => hasOwnKey(papers, id)),
        }))
      : [];

    return { collections, papers };
  } catch {
    return EMPTY_STATE;
  }
}

/** Persist state. Returns false instead of throwing when storage is blocked. */
export function saveState(
  state: CollectionsState,
  storage: Storage | null = defaultStorage(),
): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(COLLECTIONS_KEY, JSON.stringify(state.collections));
    storage.setItem(PAPERS_KEY, JSON.stringify(state.papers));
    return true;
  } catch {
    return false;
  }
}
