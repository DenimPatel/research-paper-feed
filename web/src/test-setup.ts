import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Vitest runs with `globals: false`, so Testing Library cannot auto-register its
 * cleanup hook; every rendered tree must be unmounted explicitly or it leaks into
 * the next test's `document`.
 */
afterEach(cleanup);

/**
 * Testing Library's `asyncUtilTimeout` defaults to 1000ms, and it is the budget
 * every `findBy*` and `waitFor` call in this suite inherits. That default is
 * already tighter than this suite's slowest observed async wait (~1.5s), so any
 * of those ~100 call sites can flake under CI load, a slower machine, or a cold
 * Vite transform -- and `--sequence.shuffle` has no power to surface it.
 *
 * 3000ms absorbs that variance (3x the old budget, 2x the slowest observed wait)
 * while staying deliberately far below vitest's own 5000ms `testTimeout`, so a
 * genuinely-never-resolving query still fails with Testing Library's diagnostic
 * "Unable to find an element..." error rather than a generic vitest timeout.
 *
 * The delta form (`configure(existing => ...)`) is used so unrelated RTL settings
 * such as `reactStrictMode` keep their current values.
 */
configure((config) => ({ ...config, asyncUtilTimeout: 3000 }));
