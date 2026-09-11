import type { ReactNode } from "react";
import type { Collection } from "../lib/collections";
import type { Paper } from "../lib/types";
import { PaperCard } from "./PaperCard";

const LOAD_MORE_STEP = 50;

interface PaperListProps {
  papers: Paper[];
  visibleCount: number;
  onLoadMore: () => void;
  collections?: Collection[];
  isSaved?: (collectionId: string, paperId: string) => boolean;
  onToggleCollection?: (
    collectionId: string,
    paper: Paper,
    nextSaved: boolean,
  ) => void;
  onCreateCollection?: (name: string, paper: Paper) => void;
  renderAction?: (paper: Paper) => ReactNode;
  emptyMessage?: string;
}

export function PaperList({
  papers,
  visibleCount,
  onLoadMore,
  collections,
  isSaved,
  onToggleCollection,
  onCreateCollection,
  renderAction,
  emptyMessage = "No papers match the current filters.",
}: PaperListProps) {
  if (papers.length === 0) {
    return <p className="empty">{emptyMessage}</p>;
  }

  const visible = papers.slice(0, visibleCount);
  const remaining = papers.length - visible.length;

  return (
    <div className="paper-list">
      {visible.map((paper) => (
        <PaperCard
          key={paper.id}
          paper={paper}
          collections={collections}
          isSaved={isSaved}
          onToggleCollection={onToggleCollection}
          onCreateCollection={onCreateCollection}
          actionSlot={renderAction?.(paper)}
        />
      ))}

      {remaining > 0 && (
        <button
          type="button"
          className="button load-more"
          onClick={onLoadMore}
        >
          Load {Math.min(LOAD_MORE_STEP, remaining)} more ({remaining} remaining)
        </button>
      )}
    </div>
  );
}
