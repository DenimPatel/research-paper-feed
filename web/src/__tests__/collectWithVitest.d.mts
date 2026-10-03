// Type declarations for `collectWithVitest.mjs`, which is deliberately outside
// the TypeScript project: this tree has no `@types/node`, and `tsconfig.json`
// pins `"types": ["vite/client"]`, so nothing under `src/` can import
// `node:child_process` from a `.ts` file without failing `npm run typecheck`.
// Declaring these two functions keeps that constraint out of the pin test, which
// has to be a `.ts` file because the *original* `src/**` globs are the ones that
// collect it.

/** The result of asking the real vitest runner what it collects. */
export interface Listing<T> {
  /** False when the runner could not be asked, which is a failure, not a pass. */
  ok: boolean;
  /** Human-readable diagnosis, or `null` on success. */
  reason: string | null;
  items: T;
}

/** A collected test file, posix-relative to `web/`. */
export type CollectedFile = string;

/** A collected test case: its full name and the file it lives in. */
export interface CollectedCase {
  name: string;
  /** Posix, relative to `web/`. */
  file: string;
}

/** Test files vitest collects, from an unfiltered `vitest list --filesOnly`. */
export declare function guardSuiteListing(): Listing<CollectedFile[]>;

/** Test cases vitest collects under `scripts/__tests__`, from a filtered `list --json`. */
export declare function guardSuiteCases(): Listing<CollectedCase[]>;