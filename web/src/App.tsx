import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { CollectionsView } from "./components/CollectionsView";
import { FeedControls } from "./components/FeedControls";
import { PaperList } from "./components/PaperList";
import {
  collectionsReducer,
  createCollection,
  exportCollection,
  loadState,
  saveState,
  type ExportPayload,
} from "./lib/collections";
import {
  PaperIndex,
  type LoadProgress,
  type ShardLoadFailure,
} from "./lib/paperIndex";
import { rankPapers, scorePaper, tokenize } from "./lib/search";
import type { IndexManifest, Paper, RecencyDays, SortMode } from "./lib/types";
import {
  readHash,
  resolveCategories,
  writeHash,
  type HashState,
  type View,
} from "./lib/urlState";

const PAGE_SIZE = 50;

function detectStorage(): boolean {
  try {
    const key = "rpf.__storage_test__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function slugifyFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "collection";
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function App() {
  const [urlState, setUrlState] = useState<HashState>(() => readHash());
  const view = urlState.view;

  useEffect(() => {
    const onHashChange = () => setUrlState(readHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const indexRef = useRef<PaperIndex>();
  if (!indexRef.current) {
    indexRef.current = new PaperIndex();
  }

  const [manifest, setManifest] = useState<IndexManifest | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LoadProgress>({ loaded: 0, total: 0 });
  // Shards that were asked for and did not arrive. A partial failure no longer
  // rejects the load (IMP-015), so without this the feed would render short and
  // say nothing: correct papers, silently incomplete week. The error state above
  // cannot cover it either, because the load succeeded.
  const [failedShards, setFailedShards] = useState<ShardLoadFailure[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [manifestAttempts, setManifestAttempts] = useState(0);
  const retriedRef = useRef(false);
  const feedHeadingRef = useRef<HTMLHeadingElement>(null);

  const applyState = useCallback(
    (next: HashState, mode: "push" | "replace") => {
      // The manifest is what "every category" means, so the writer needs it: a
      // selection covering the whole index is no filter at all and must
      // serialize as no `cat=`. The third argument stays undefined so the
      // default writer is kept.
      writeHash(next, mode, undefined, manifest?.categories ?? null);
      setUrlState(next);
    },
    [manifest],
  );

  useEffect(() => {
    let cancelled = false;
    const index = indexRef.current;
    if (!index) {
      return;
    }
    // A cold start has nothing memoized, so getManifest() is the right call. A
    // repeat attempt must re-ask the network: getManifest already un-memoes a
    // rejection, and refreshManifest also drops a manifest that resolved.
    const attempt =
      manifestAttempts > 0 ? index.refreshManifest() : index.getManifest();
    attempt
      .then((next) => {
        if (!cancelled) {
          setManifest(next);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [manifestAttempts]);

  useEffect(() => {
    if (manifest && retriedRef.current) {
      retriedRef.current = false;
      feedHeadingRef.current?.focus();
    }
  }, [manifest]);

  // No "already retrying" latch: clearing `error` unmounts this button in the
  // same commit, so a second activation cannot reach the handler until the
  // attempt has settled and the panel is on screen again. Simultaneous
  // activations batch into one `manifestAttempts` change, hence one request.
  const handleRetryManifest = () => {
    retriedRef.current = true;
    setError(null);
    setLoading(true);
    setManifestAttempts((attempts) => attempts + 1);
  };

  useEffect(() => {
    if (!manifest) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    indexRef.current
      ?.loadPapers(urlState.recency, (next) => {
        if (!cancelled) {
          setProgress(next);
        }
      })
      .then((list) => {
        if (!cancelled) {
          setPapers(list);
          // `list` is still the `Paper[]` `setPapers` has always taken, and it
          // also carries the shards that failed. Reading them off the same value
          // is what lets one load drive both the feed and the completeness
          // notice, with no second request and no chance of the two disagreeing.
          setFailedShards(list.failedFiles);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          // Every shard failed, so there is no partial result to describe: the
          // hard error panel below is the whole story, and leaving an older
          // partial notice up would double-report a state that no longer holds.
          setFailedShards([]);
          setError(cause instanceof Error ? cause.message : String(cause));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [manifest, urlState.recency]);

  // A shared link can name categories this index does not have, and `readHash`
  // cannot tell: it runs before the manifest is fetched and never re-runs.
  // Intersecting here, during render, means the render that `setManifest`
  // triggers re-derives this for free — no second fetch, no awaited parse, no
  // effect — while the request is in flight `valid` is `undefined` and the
  // selection passes through untouched, so a slow or failed index still lands
  // the deep link unchanged. Every consumer below (the chips, the feed filter,
  // and `toggleCategory`) reads this one value, so they cannot disagree.
  const categoryResolution = useMemo(
    () => resolveCategories(urlState.categories, manifest?.categories),
    [urlState.categories, manifest],
  );
  // `selected: null` means the hash named no category at all, which is the
  // existing encoding for "every category the index has".
  const activeCategories =
    categoryResolution.selected ?? manifest?.categories ?? [];
  const unknownCategories = categoryResolution.unknown;

  // `activeCategories` is empty until the manifest arrives, so "no categories
  // selected" is only a claim the index could already have refuted.
  const noCategoriesSelected =
    manifest !== null && activeCategories.length === 0;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [urlState.query, urlState.recency, urlState.categories, urlState.sort]);

  const visiblePapers = useMemo(() => {
    const active = new Set(activeCategories);
    const inCategories = papers.filter(
      (paper) =>
        active.has(paper.primaryCategory) ||
        paper.categories.some((category) => active.has(category)),
    );

    const query = urlState.query.trim();
    if (!query) {
      return inCategories;
    }
    if (urlState.sort === "relevance") {
      return rankPapers(inCategories, urlState.query).map((entry) => entry.paper);
    }
    const tokens = tokenize(urlState.query);
    return inCategories.filter((paper) => scorePaper(paper, tokens) > 0);
  }, [papers, activeCategories, urlState.query, urlState.sort]);

  const [storageAvailable] = useState(detectStorage);
  const [collections, dispatch] = useReducer(collectionsReducer, undefined, () =>
    loadState(),
  );
  const [saveFailed, setSaveFailed] = useState(false);

  // `saveState` reports a blocked or exhausted quota by returning false rather
  // than throwing, so this effect is the only place the failure can be
  // noticed. Without it the reducer state stays optimistic, the card shows the
  // paper as saved, and everything is gone on the next reload. Setting the
  // flag unconditionally is safe: `useState` bails out on an unchanged value,
  // and this effect does not depend on it, so a steady stream of saves cannot
  // loop.
  useEffect(() => {
    if (storageAvailable) {
      setSaveFailed(!saveState(collections));
    }
  }, [collections, storageAvailable]);

  const setView = (next: View) => {
    applyState({ ...urlState, view: next }, "push");
  };

  const setQuery = (query: string) => {
    applyState({ ...urlState, query }, "replace");
  };

  const setRecency = (recency: RecencyDays) => {
    applyState({ ...urlState, recency }, "replace");
  };

  const setSort = (sort: SortMode) => {
    applyState({ ...urlState, sort }, "replace");
  };

  // Seed from `activeCategories`, not from the raw hash list: with
  // `#cat=cs.CV,cs.BI` intersected down to `["cs.CV"]`, deselecting the one
  // visible chip off the raw list would write `cs.BI` — the dropped, unpressable
  // value — straight back into the URL, reinstating the filter this hides.
  const toggleCategory = (category: string) => {
    const current = activeCategories;
    const next = current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category];
    applyState({ ...urlState, categories: next }, "replace");
  };

  // "Every category" is `null` — no explicit selection — so the state and the
  // URL agree: `writeHash` omits `cat=` and `readHash` hands the same `null`
  // back. Writing the manifest's list instead would be a second spelling of a
  // state that already has one, and it would drift the moment the index does.
  const selectAllCategories = () => {
    applyState({ ...urlState, categories: null }, "replace");
  };

  // Keeps whatever the index does have and drops only the values it reported as
  // unknown. When nothing survived, the surviving list is empty, and an empty
  // `cat=` is itself an empty-feed trap, so fall back to `null` — "no category
  // filter", which `writeHash` writes as no `cat=` at all.
  const resetUnknownCategories = () => {
    applyState(
      {
        ...urlState,
        categories: activeCategories.length > 0 ? activeCategories : null,
      },
      "replace",
    );
  };

  const isSaved = (collectionId: string, paperId: string) =>
    collections.collections.some(
      (collection) =>
        collection.id === collectionId &&
        collection.paperIds.includes(paperId),
    );

  const handleToggleCollection = (
    collectionId: string,
    paper: Paper,
    nextSaved: boolean,
  ) => {
    dispatch(
      nextSaved
        ? { type: "addPaper", collectionId, paper }
        : { type: "removePaper", collectionId, paperId: paper.id },
    );
  };

  const handleCreateCollection = (name: string, paper: Paper) => {
    const collection = createCollection(name);
    dispatch({ type: "addCollection", collection });
    dispatch({ type: "addPaper", collectionId: collection.id, paper });
  };

  const handleCreate = (name: string) => {
    dispatch({ type: "addCollection", collection: createCollection(name) });
  };

  const handleExport = (collectionId: string) => {
    const payload = exportCollection(collections, collectionId);
    if (!payload) {
      return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${slugifyFilename(payload.collection.name)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleImport = (payload: ExportPayload) => {
    dispatch({ type: "mergeImport", payload });
  };

  const collectionCount = collections.collections.length;

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <div className="site-header__inner">
          <span className="site-title">Research Paper Feed</span>
          <nav className="site-nav" aria-label="Primary">
            <button
              type="button"
              className={`nav-link ${view === "feed" ? "nav-link--active" : ""}`}
              aria-current={view === "feed" ? "page" : undefined}
              onClick={() => setView("feed")}
            >
              Feed
            </button>
            <button
              type="button"
              className={`nav-link ${
                view === "collections" ? "nav-link--active" : ""
              }`}
              aria-current={view === "collections" ? "page" : undefined}
              onClick={() => setView("collections")}
            >
              Collections{collectionCount > 0 ? ` (${collectionCount})` : ""}
            </button>
          </nav>
        </div>
      </header>

      <main className="app__main" id="main">
        {saveFailed && (
          // Outside the view branch because a save can fail from either tab,
          // and `role="alert"` on a node that mounts only while the failure
          // lasts means the announcement fires once per failure rather than on
          // every render or every later failed save. Reuses `banner` /
          // `banner--error`, the same pair the import error already uses.
          <p className="banner banner--error" role="alert">
            <strong>Collections could not be saved.</strong> This browser’s
            storage may be full or blocked, so anything you just changed will be
            lost when you reload this page.
          </p>
        )}

        {view === "collections" ? (
          <CollectionsView
            state={collections}
            storageAvailable={storageAvailable}
            onCreate={handleCreate}
            onRename={(id, name) =>
              dispatch({ type: "renameCollection", id, name })
            }
            onDelete={(id) => dispatch({ type: "deleteCollection", id })}
            onRemovePaper={(collectionId, paperId) =>
              dispatch({ type: "removePaper", collectionId, paperId })
            }
            onExport={handleExport}
            onImport={handleImport}
          />
        ) : (
          <>
            {!manifest && error && (
              <div className="panel panel--error" role="alert">
                <h1>No paper index yet</h1>
                <p>{error}</p>
                <p>
                  <button
                    type="button"
                    className="button"
                    onClick={handleRetryManifest}
                  >
                    Try again
                  </button>
                </p>
                <p>Build the index locally:</p>
                <pre>
                  <code>python scripts/build_index.py</code>
                </pre>
                <pre>
                  <code>cd web &amp;&amp; npm run dev</code>
                </pre>
              </div>
            )}

            {!manifest && !error && (
              <p className="panel" role="status">
                Loading the paper index…
              </p>
            )}

            {manifest && (
              <>
                <section className="hero">
                  <h1 ref={feedHeadingRef} tabIndex={-1}>
                    Recent arXiv papers in CS &amp; AI
                  </h1>
                  <p>
                    {manifest.totalPapers.toLocaleString()} papers from{" "}
                    {manifest.categories.join(", ")} · index generated{" "}
                    {formatGeneratedAt(manifest.generatedAt)}
                  </p>
                </section>

                <FeedControls
                  query={urlState.query}
                  onQueryChange={setQuery}
                  categories={manifest.categories}
                  selectedCategories={activeCategories}
                  onToggleCategory={toggleCategory}
                  onSelectAllCategories={selectAllCategories}
                  recency={urlState.recency}
                  onRecencyChange={setRecency}
                  sort={urlState.sort}
                  onSortChange={setSort}
                  resultCount={visiblePapers.length}
                />

                {error && (
                  <p className="banner banner--warning" role="alert">
                    {error}
                  </p>
                )}

                {failedShards.length > 0 && (
                  // A shard that failed is no longer fatal, but its week is
                  // still missing — so this is the one case where the feed is
                  // honest about being incomplete, and silently dropping it
                  // would trade an obvious empty feed for a plausible wrong one.
                  // Same `banner banner--error` pair and `role="alert"` as the
                  // storage notice IMP-011 added, so the two read as one kind of
                  // thing and need no new styling. Mounted only while the
                  // failures last and keyed to nothing but its own condition, so
                  // the assertive announcement fires once per degraded load and
                  // not again on every later render. The shard names go in
                  // `title`: IMP-015 wants the missing week named, IMP-017 AC2
                  // bars a file name or an `Error.message` from the visible
                  // text, and `title` is the one place that satisfies both.
                  <p
                    className="banner banner--error"
                    role="alert"
                    title={failedShards
                      .map((failure) => `${failure.file}: ${failure.message}`)
                      .join("\n")}
                  >
                    <strong>Some papers could not be loaded.</strong>{" "}
                    {failedShards.length === 1
                      ? "One week"
                      : `${failedShards.length} weeks`}{" "}
                    in this window failed to load, so the feed below is
                    incomplete. Everything that did load is shown.
                  </p>
                )}

                {unknownCategories.length > 0 && (
                  // Names the dropped values so the link's real cause is visible
                  // and removable, instead of an empty feed with no explanation.
                  // Shown on a partial drop too, not only a total one: the user
                  // has to learn that `cs.BI` is the reason nothing matches.
                  // Reuses `banner banner--warning` and `button button--ghost`
                  // so no `styles.css` rule is needed.
                  <p className="banner banner--warning" role="alert">
                    <strong>
                      Unknown categor
                      {unknownCategories.length === 1 ? "y" : "ies"}:{" "}
                      {unknownCategories.join(", ")}.
                    </strong>{" "}
                    {activeCategories.length === 0
                      ? "This index does not have that category, so nothing can match."
                      : "This index does not have that category, so those papers are hidden."}{" "}
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={resetUnknownCategories}
                    >
                      {activeCategories.length === 0
                        ? "Reset category filter"
                        : "Keep only indexed categories"}
                    </button>
                  </p>
                )}

                {loading ? (
                  <p className="panel" role="status">
                    Loading papers from {progress.total} week
                    {progress.total === 1 ? "" : "s"}… ({progress.loaded}/
                    {progress.total})
                  </p>
                ) : noCategoriesSelected ? (
                  // Deselecting the last chip is the one filter change no chip
                  // can undo, so this state names its own cause and offers the
                  // action that reverses it instead of the generic "nothing
                  // matched" line. Reuses `empty` and `button`, so no
                  // `styles.css` rule is needed.
                  <>
                    <p className="empty">No categories selected</p>
                    <p>
                      <button
                        type="button"
                        className="button"
                        onClick={selectAllCategories}
                      >
                        Select all categories
                      </button>
                    </p>
                  </>
                ) : (
                  <PaperList
                    papers={visiblePapers}
                    visibleCount={visibleCount}
                    onLoadMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
                    collections={collections.collections}
                    isSaved={isSaved}
                    onToggleCollection={handleToggleCollection}
                    onCreateCollection={handleCreateCollection}
                    emptyMessage={
                      papers.length === 0
                        ? "No papers are available in this window yet."
                        : "No papers match the current filters."
                    }
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      <footer className="site-footer">
        <p>
          Metadata from the{" "}
          <a
            href="https://arxiv.org/"
            target="_blank"
            rel="noreferrer"
          >
            arXiv
          </a>{" "}
          API. This site is static and stores your collections in this browser
          only.
        </p>
      </footer>
    </div>
  );
}
