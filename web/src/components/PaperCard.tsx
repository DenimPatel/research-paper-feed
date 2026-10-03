import { useMemo, useState, type ReactNode } from "react";
import { isHttpUrl, type Collection } from "../lib/collections";
import type { Paper } from "../lib/types";

const ABSTRACT_PREVIEW_CHARS = 260;

interface PaperCardProps {
  paper: Paper;
  collections?: Collection[];
  isSaved?: (collectionId: string, paperId: string) => boolean;
  onToggleCollection?: (
    collectionId: string,
    paper: Paper,
    nextSaved: boolean,
  ) => void;
  onCreateCollection?: (name: string, paper: Paper) => void;
  actionSlot?: ReactNode;
}

/**
 * `published` is a zoneless calendar day from the producer (`iso_date`,
 * `scripts/build_index.py`), not an instant, so it has to read as the same day
 * for every reader. Anchoring the parse at midnight UTC and then formatting in
 * UTC — the choice `formatWeekRange` (`App.tsx:87-100`) already makes for bare
 * days — keeps the visible text in agreement with the `dateTime` attribute
 * beside it. Formatting that instant in the reader's local zone printed the day
 * *before* for everyone west of Greenwich, so every card contradicted itself.
 *
 * `formatGeneratedAt` (`App.tsx:64-74`) takes a real instant and deliberately
 * does the opposite; the two take different kinds of value. The `locale` axis
 * is still the runner's — IMP-125 owns that decision, not this one.
 */
function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Snapshots can predate import validation, so never hand an unverified url to href.
 *
 * The declared type is honest about all three shapes this actually receives —
 * a url, a producer `null`, and a `undefined` from a snapshot that predates the
 * field — and none of the three may reach `href`. The `isHttpUrl` call is the
 * reason that holds: it takes `unknown`, and `String(null)`/`String(undefined)`
 * are `"null"`/`"undefined"`, neither of which matches the anchored pattern, so
 * all three resolve to `undefined` and the caller omits the link. The guard is
 * load-bearing even though the type now promises the value — a shard is a bare
 * `as ShardFile` cast and an import is unvalidated JSON, so the compiler has
 * never checked either path.
 */
function safeHref(url: string | null | undefined): string | undefined {
  return isHttpUrl(url) ? String(url).trim() : undefined;
}

export function PaperCard({
  paper,
  collections,
  isSaved,
  onToggleCollection,
  onCreateCollection,
  actionSlot,
}: PaperCardProps) {
  const [expanded, setExpanded] = useState(false);
  const showSaveMenu =
    !!collections && !!isSaved && !!onToggleCollection && !!onCreateCollection;

  const abstract = useMemo(() => {
    if (expanded || paper.abstract.length <= ABSTRACT_PREVIEW_CHARS) {
      return paper.abstract;
    }
    return `${paper.abstract.slice(0, ABSTRACT_PREVIEW_CHARS).trimEnd()}\u2026`;
  }, [expanded, paper.abstract]);

  const canExpand = paper.abstract.length > ABSTRACT_PREVIEW_CHARS;
  const absHref = safeHref(paper.absUrl);
  const pdfHref = safeHref(paper.pdfUrl);

  return (
    <article className="paper">
      <header className="paper__header">
        <h3 className="paper__title">
          {absHref ? (
            <a href={absHref} target="_blank" rel="noreferrer">
              {paper.title}
            </a>
          ) : (
            <span>{paper.title}</span>
          )}
        </h3>
        <div className="paper__meta">
          <time dateTime={paper.published}>{formatDate(paper.published)}</time>
          <span className="paper__authors">{paper.authors.join(", ")}</span>
        </div>
      </header>

      <div className="paper__chips">
        {paper.categories.map((category) => (
          <span
            key={category}
            className={`tag ${category === paper.primaryCategory ? "tag--primary" : ""}`}
          >
            {category}
          </span>
        ))}
      </div>

      <p className="paper__abstract">{abstract}</p>
      {canExpand && (
        <button
          type="button"
          className="link-button"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
      {paper.abstractTruncated && (
        <p className="paper__note">
          Abstract truncated —{" "}
          {absHref ? (
            <a href={absHref} target="_blank" rel="noreferrer">
              view the full text on arXiv
            </a>
          ) : (
            "view the full text on arXiv"
          )}
          .
        </p>
      )}

      <footer className="paper__footer">
        <div className="paper__links">
          {absHref && (
            <a href={absHref} target="_blank" rel="noreferrer">
              arXiv
            </a>
          )}
          {pdfHref && (
            <a href={pdfHref} target="_blank" rel="noreferrer">
              PDF
            </a>
          )}
        </div>

        <div className="paper__actions">
          {actionSlot}
          {showSaveMenu && (
            <details className="save-menu">
              <summary className="button button--ghost">Save to collection</summary>
              <div className="save-menu__body">
                {collections.length > 0 ? (
                  <ul className="save-menu__list">
                    {collections.map((collection) => {
                      const saved = isSaved(collection.id, paper.id);
                      return (
                        <li key={collection.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={saved}
                              onChange={(event) =>
                                onToggleCollection(
                                  collection.id,
                                  paper,
                                  event.target.checked,
                                )
                              }
                            />
                            <span>{collection.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="save-menu__empty">
                    No collections yet. Create one below.
                  </p>
                )}

                <form
                  className="save-menu__new"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const name = String(data.get("name") ?? "").trim();
                    if (name) {
                      onCreateCollection(name, paper);
                      event.currentTarget.reset();
                    }
                  }}
                >
                  <input
                    name="name"
                    type="text"
                    placeholder="New collection name"
                    aria-label="New collection name"
                  />
                  <button type="submit" className="button">
                    Create &amp; save
                  </button>
                </form>
              </div>
            </details>
          )}
        </div>
      </footer>
    </article>
  );
}
