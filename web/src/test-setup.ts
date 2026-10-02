import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Vitest runs with `globals: false`, so Testing Library cannot auto-register its
 * cleanup hook; every rendered tree must be unmounted explicitly or it leaks into
 * the next test's `document`.
 */
afterEach(cleanup);