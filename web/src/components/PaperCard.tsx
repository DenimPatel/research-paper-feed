import { useMemo, useState, type ReactNode } from "react";
import type { Collection } from "../lib/collections";
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

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

  return (
    <article className="paper">
      <header className="paper__header">
        <h3 className="paper__title">
          <a href={paper.absUrl} target="_blank" rel="noreferrer">
            {paper.title}
          </a>
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
          <a href={paper.absUrl} target="_blank" rel="noreferrer">
            view the full text on arXiv
          </a>
          .
        </p>
      )}

      <footer className="paper__footer">
        <div className="paper__links">
          <a href={paper.absUrl} target="_blank" rel="noreferrer">
            arXiv
          </a>
          <a href={paper.pdfUrl} target="_blank" rel="noreferrer">
            PDF
          </a>
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
