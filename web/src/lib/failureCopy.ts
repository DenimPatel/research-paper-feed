import { IndexUnavailableError, ShardLoadError } from "./paperIndex";

/**
 * A load failure in two registers: the sentence a reader can act on, and the
 * technical cause — file name, HTTP status, whatever the stack threw.
 *
 * The split is the whole point. `Failed to load papers-2024-W14.json (HTTP 404).`
 * is worth keeping for whoever is debugging a deploy and is worth nothing to a
 * reader who just wants their feed, so it is preserved in `detail` and never in
 * `message`.
 */
export interface LoadFailureNotice {
  /** Plain, reader-facing copy. Safe to render as the primary visible text. */
  readonly message: string;
  /** The technical cause. For a `title` attribute and for `console.error`. */
  readonly detail: string;
}

/**
 * The index could not be fetched at all: a network error, a 404, or the HTML
 * page a static host answers a missing file with. The panels that render this
 * already say the index is missing, so it adds the part a reader cannot guess —
 * that it is a transient condition and that waiting is a real option.
 */
const INDEX_UNAVAILABLE =
  "The paper index could not be loaded, so there is no feed to show. This is " +
  "usually temporary, and the page will start working once the index is " +
  "available again.";

/**
 * The index arrived and could not be read. Unlike the state above, retrying does
 * not fix it, so saying so is the useful thing to do — the alternative is a
 * reader clicking Try again until they give up.
 */
const INDEX_MALFORMED =
  "The paper index on this site could not be read, so there is no feed to " +
  "show. This is a problem with the site's published data rather than with " +
  "your browser, so trying again will not help until the index is rebuilt.";

/**
 * A week of papers did not arrive. True for every shard failure, whether the
 * request was refused or the body was unreadable, and deliberately says nothing
 * about *which* week or how many: that is a per-week question the partial-shard
 * notice answers, and a hard failure has no week left to name.
 */
const SHARD_UNAVAILABLE =
  "Some of the paper data could not be fetched. This is usually temporary, and " +
  "it does not mean the papers are missing.";

/** Nothing recognizable was thrown. Honest about the ignorance on purpose. */
const UNKNOWN =
  "Something went wrong while loading papers. This is usually temporary.";

/**
 * Turn whatever a load rejected with into the pair a screen can render. The
 * cause is classified by type, never by matching on the message, so rewording
 * `paperIndex.ts` cannot silently change which sentence a reader gets.
 *
 * `detail` is always the original text, so nothing is discarded: a caller that
 * wants the file name and the status still has both.
 */
export function describeLoadFailure(cause: unknown): LoadFailureNotice {
  const detail = cause instanceof Error ? cause.message : String(cause);
  if (cause instanceof IndexUnavailableError) {
    return {
      message:
        cause.kind === "malformed" ? INDEX_MALFORMED : INDEX_UNAVAILABLE,
      detail,
    };
  }
  if (cause instanceof ShardLoadError) {
    return { message: SHARD_UNAVAILABLE, detail };
  }
  return { message: UNKNOWN, detail };
}
