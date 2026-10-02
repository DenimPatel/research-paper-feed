import type { RecencyDays, SortMode } from "../lib/types";

interface FeedControlsProps {
  query: string;
  onQueryChange: (query: string) => void;
  categories: string[];
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
  recency: RecencyDays;
  onRecencyChange: (recency: RecencyDays) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  resultCount: number;
}

const RECENCY_OPTIONS: RecencyDays[] = [7, 30, 60];

export function FeedControls({
  query,
  onQueryChange,
  categories,
  selectedCategories,
  onToggleCategory,
  recency,
  onRecencyChange,
  sort,
  onSortChange,
  resultCount,
}: FeedControlsProps) {
  // Relevance needs a search term to rank against. Without one the feed lists by
  // date, so the chips must report the sort that is actually in effect rather
  // than the one the URL happens to carry.
  const relevanceAvailable = query.trim() !== "";
  const effectiveSort: SortMode =
    sort === "relevance" && !relevanceAvailable ? "newest" : sort;

  return (
    <section className="controls" aria-label="Feed filters">
      <div className="controls__search">
        <label htmlFor="search-input" className="sr-only">
          Search papers
        </label>
        <input
          id="search-input"
          type="search"
          value={query}
          placeholder='Search papers, e.g. 3d reconstruction or "visual inertial"'
          onChange={(event) => onQueryChange(event.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="controls__row">
        <fieldset className="controls__group">
          <legend>Categories</legend>
          <div className="chips">
            {categories.map((category) => {
              const active = selectedCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  className={`chip ${active ? "chip--active" : ""}`}
                  aria-pressed={active}
                  onClick={() => onToggleCategory(category)}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="controls__group">
          <legend>Recency</legend>
          <div className="chips">
            {RECENCY_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${recency === option ? "chip--active" : ""}`}
                aria-pressed={recency === option}
                onClick={() => onRecencyChange(option)}
              >
                {option} days
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="controls__group">
          <legend>Sort</legend>
          <div className="chips">
            {(["newest", "relevance"] as SortMode[]).map((option) => {
              const active = effectiveSort === option;
              const unavailable = option === "relevance" && !relevanceAvailable;
              return (
                <button
                  key={option}
                  type="button"
                  className={`chip ${active ? "chip--active" : ""}`}
                  aria-pressed={active}
                  onClick={() => onSortChange(option)}
                  disabled={unavailable}
                >
                  {option === "newest" ? "Newest" : "Relevance"}
                </button>
              );
            })}
          </div>
          {!relevanceAvailable && (
            // Reuses `controls__count`, the block's muted secondary-text style,
            // so the hint needs no new rule in styles.css.
            <p className="controls__count">
              Enter a search term to sort by relevance.
            </p>
          )}
        </fieldset>
      </div>

      <p className="controls__count" role="status" aria-live="polite">
        {resultCount} paper{resultCount === 1 ? "" : "s"} match
      </p>
    </section>
  );
}
