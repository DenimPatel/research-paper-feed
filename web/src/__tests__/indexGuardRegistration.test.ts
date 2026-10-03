// @vitest-environment node
import { describe, expect, it } from "vitest";
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
 * Three witnesses, none of which the others can stand in for:
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
 *
 * There was a fourth witness, an assertion over the *imported* `test.include`
 * that a pattern remained anchored at `scripts/`. It was removed in IMP-028d
 * after mutation testing showed it earned nothing and cost something. It caught
 * no real hole that witnesses 1 and 3 do not already catch -- including the two
 * holes a config-reading witness is structurally blind to, `exclude: ["scripts/**"]`
 * and the guard file being renamed, both of which leave `include` untouched and
 * still scripts-anchored. Meanwhile it produced a false positive: widening the
 * glob to `**\/*.test.mjs` still collects all 23 guard cases correctly, yet only
 * that assertion went red, reporting that the suite "stops being collected" --
 * untrue, and a spurious failure on a working configuration. Its cost was not
 * only the false positive but its staleness: it asserted a shape of the `include`
 * expression rather than a fact about collection, so it would have outlived its
 * own reason. The evidence is reproduced in `.improve/reports/impl-IMP-028d.md`.
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
});