import { useState } from "react";
import type {
  Collection,
  CollectionsState,
  ExportPayload,
} from "../lib/collections";
import { parseExportPayload } from "../lib/collections";
import { PaperCard } from "./PaperCard";

interface CollectionsViewProps {
  state: CollectionsState;
  storageAvailable: boolean;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onRemovePaper: (collectionId: string, paperId: string) => void;
  onExport: (id: string) => void;
  onImport: (payload: ExportPayload) => void;
}

interface CollectionSectionProps {
  collection: Collection;
  state: CollectionsState;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onRemovePaper: (collectionId: string, paperId: string) => void;
  onExport: (id: string) => void;
}

function CollectionSection({
  collection,
  state,
  onRename,
  onDelete,
  onRemovePaper,
  onExport,
}: CollectionSectionProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(collection.name);

  const papers = collection.paperIds
    .map((id) => state.papers[id])
    .filter((paper): paper is NonNullable<typeof paper> => Boolean(paper));

  return (
    <section className="collection" aria-label={collection.name}>
      <header className="collection__header">
        {editing ? (
          <form
            className="collection__rename"
            onSubmit={(event) => {
              event.preventDefault();
              const name = draftName.trim();
              if (name) {
                onRename(collection.id, name);
                setEditing(false);
              }
            }}
          >
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              aria-label="Collection name"
              autoFocus
            />
            <button type="submit" className="button">
              Save
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                setDraftName(collection.name);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <h2 className="collection__title">
            {collection.name}{" "}
            <span className="collection__count">({papers.length})</span>
          </h2>
        )}

        {!editing && (
          <div className="collection__actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                setDraftName(collection.name);
                setEditing(true);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => onExport(collection.id)}
              disabled={papers.length === 0}
            >
              Export
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${collection.name}"? This cannot be undone.`,
                  )
                ) {
                  onDelete(collection.id);
                }
              }}
            >
              Delete
            </button>
          </div>
        )}
      </header>

      {papers.length === 0 ? (
        <p className="empty">
          No papers saved yet. Use “Save to collection” on any paper in the feed.
        </p>
      ) : (
        <div className="paper-list">
          {papers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              actionSlot={
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => onRemovePaper(collection.id, paper.id)}
                >
                  Remove
                </button>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function CollectionsView({
  state,
  storageAvailable,
  onCreate,
  onRename,
  onDelete,
  onRemovePaper,
  onExport,
  onImport,
}: CollectionsViewProps) {
  const [importError, setImportError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setImportError(null);
    try {
      const payload = parseExportPayload(JSON.parse(await file.text()));
      if (!payload) {
        setImportError("That file does not look like a collection export.");
        return;
      }
      onImport(payload);
    } catch {
      setImportError("Could not read that file as JSON.");
    }
  };

  return (
    <div className="collections-view">
      {!storageAvailable && (
        <p className="banner banner--warning" role="alert">
          Browser storage is unavailable, so collections will not persist after
          you reload.
        </p>
      )}

      <div className="collections-toolbar">
        <form
          className="collections-toolbar__new"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const name = String(data.get("name") ?? "").trim();
            if (name) {
              onCreate(name);
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
            Create collection
          </button>
        </form>

        <label className="button button--ghost import-button">
          Import collection
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {importError && (
        <p className="banner banner--error" role="alert">
          {importError}
        </p>
      )}

      {state.collections.length === 0 ? (
        <p className="empty">
          You have no collections yet. Create one above, or save papers from the
          feed.
        </p>
      ) : (
        state.collections.map((collection) => (
          <CollectionSection
            key={collection.id}
            collection={collection}
            state={state}
            onRename={onRename}
            onDelete={onDelete}
            onRemovePaper={onRemovePaper}
            onExport={onExport}
          />
        ))
      )}
    </div>
  );
}
