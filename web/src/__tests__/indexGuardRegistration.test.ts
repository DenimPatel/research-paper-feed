// @vitest-environment node
import { describe, expect, it } from "vitest";
import viteConfig from "../../vite.config";
import { guardSuiteCases, guardSuiteListing } from "./collectWithVitest.mjs";

/**
 * IMP-028c: pins the *registration* of the index-guard suite.
 *
 * The 23 tests in `scripts/__tests__/indexGuards.test.mjs` exist only to keep
 * `scripts/require-index.mjs` honest, and `require-index.mjs` is the thing that
 * makes a production build fail closed instead of shipping a site that reads
 * "No paper index yet" forever. That suite runs only because `vite.config.ts`'s
 * `test.include` reaches outside `src/` to collect it -- and that registration
 * was itself unpinned. A verifier deleted the `scripts/**\/*.test.mjs` glob and
 * `npm test` still exited 0, reporting 17 files and 266 tests instead of 18 and
 * 289. Twenty-three tests went quiet with nothing red.
 *
 * So this file lives under `src/`, where the *original* two globs already
 * collect it. A pin placed in `scripts/__tests__/` would be dropped by exactly
 * the narrowing it exists to catch, and would prove nothing.
 *
 * Four witnesses, none of which the others can stand in for:
 *
 *   1. `vitest list --filesOnly`, spawned: the real runner, loading the real
 *      config, resolving the real globs against the real tree, with nothing
 *      narrowed and nothing assumed. Behaviour, not configuration, so it
 *      survives `include` being rewritten in any equivalent form, and it cannot
 *      be satisfied by a string that merely appears somewhere in a comment.
 *   2. The same listing checked for *this* file, which is what makes the pin
 *      able to catch a narrowing it is not subject to.
 *   3. A `list --json` for which cases the guard suite actually contributes,
 *      so a bare count cannot stand in for the named ones below.
 *   4. The imported config's `test.include`: a cheap, direct statement of
 *      intent, whose failure message names the glob rather than a file list.
 */

const GUARD_SUITE = "scripts/__tests__/indexGuards.test.mjs";

/**
 * Named rather than counted, because a count is satisfied by any 23 unrelated
 * tests. These two are the guard suite's reason for existing: they are what a
 * deployment would notice going missing.
 */
const DEPLOY_CRITICAL_CASES = [
  "the guards stay wired into the commands that run them > runs the guard in the build script, before vite build",
  "the guards stay wired into the commands that run them > has the deploy workflow assert the index after the build and before the upload",
];

/**
 * A floor, not an equality: it fails only if the guard suite loses cases, never
 * if a later change adds some. 23 is the size of the suite as it stands.
 */
const GUARD_SUITE_MINIMUM_CASES = 23;

/** This file's own path as posix, the way the listing reports paths. */
const SELF = import.meta.url.replace(/\\/g, "/");

/**
 * Whether the configured `include` can reach anything under `scripts/`.
 *
 * An absent or empty `include` counts as reaching it, deliberately: vitest's
 * default pattern is `**\/*.{test,spec}.?(c|m)[jt]s?(x)`, which already collects
 * the guard suite, so dropping the array entirely is a legitimate refactor here
 * rather than a hole. Witness 1 is what catches a narrowing that actually loses
 * the suite; this one exists to say plainly, when it does, that the glob is gone.
 */
function includeReachesScripts(): boolean {
  const include = viteConfig.test?.include;
  if (include === undefined || include.length === 0) {
    return true;
  }
  return include.some((entry) => {
    // Drop the glob metacharacters and look at the literal directory the
    // pattern is anchored at: `scripts/**\/*.test.mjs` -> `scripts//.test.mjs`.
    const anchor = entry.replace(/[*?[\]{}!]/g, "");
    return /(^|\/)scripts(\/|$)/.test(anchor);
  });
}

describe("the index-guard suite is registered with the test runner", () => {
  it("collects the guard suite, so the tests guarding every deploy actually run", () => {
    const listing = guardSuiteListing();
    expect(listing.reason, "vitest list --filesOnly should be runnable").toBeNull();
    expect(listing.ok, "vitest list --filesOnly should succeed").toBe(true);
    expect(
      listing.items,
      `${GUARD_SUITE} is not collected, so the 23 tests guarding every production ` +
        `build are not running. vitest's test.include no longer reaches scripts/.`,
    ).toContain(GUARD_SUITE);
  }, 120_000);

  it("collects itself, since a pin under the glob it pins would prove nothing", () => {
    // Checked through the real matcher rather than by string-matching its own
    // path, so this is not a restatement of the file name: it is the runner
    // saying it will run this test even though the guard suite is not collected.
    const listing = guardSuiteListing();
    expect(listing.ok, `vitest list --filesOnly should succeed: ${listing.reason}`).toBe(true);

    const self = SELF.slice(SELF.lastIndexOf("/src/") + 1);
    expect(self).toMatch(/^src\/__tests__\/indexGuardRegistration\.test\.ts$/);
    expect(listing.items).toContain(self);
  }, 120_000);

  it("collects the guard suite's cases, not just its file", () => {
    const listing = guardSuiteCases();
    expect(listing.ok, `vitest list --json should succeed: ${listing.reason}`).toBe(true);

    const files = [...new Set(listing.items.map((entry) => entry.file))];
    expect(files, `${GUARD_SUITE} should be collected`).toContain(GUARD_SUITE);

    // Collected as an empty shell is not collected: a file whose cases cannot be
    // enumerated is a file nobody is asserting anything about.
    expect(
      listing.items.length,
      `${GUARD_SUITE} should contribute at least ${GUARD_SUITE_MINIMUM_CASES} collected cases`,
    ).toBeGreaterThanOrEqual(GUARD_SUITE_MINIMUM_CASES);

    const names = listing.items.map((entry) => entry.name);
    for (const name of DEPLOY_CRITICAL_CASES) {
      expect(names, `${GUARD_SUITE} should still contain "${name}"`).toContain(name);
    }
  }, 120_000);

  it("keeps an include pattern anchored at scripts/ in vite.config.ts", () => {
    // The config is *imported*, not read and parsed, and that is the whole reason
    // this witness is shaped this way. `vite.config.ts` documents the
    // `scripts/**\/*.test.mjs` glob in a comment a few lines above the `include`
    // array it lives in, so a test that grepped the file's text would still find
    // `scripts/**\/*.test.mjs` after the real glob is deleted -- and would pass
    // green over a suite that is no longer running. Only the evaluated module
    // knows which strings are patterns and which are prose.
    expect(
      includeReachesScripts(),
      "vite.config.ts's test.include no longer reaches scripts/, so " +
        `${GUARD_SUITE} stops being collected`,
    ).toBe(true);
  });
});