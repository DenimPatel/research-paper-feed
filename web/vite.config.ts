import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/research-paper-feed/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    // The added glob is IMP-028b: `scripts/require-index.mjs` gates every
    // production build and lives outside `src/`, so it was reachable by no test
    // at all. `scripts/**/*.test.mjs` is additive -- the two `src/` globs are
    // unchanged, so every test already collected is still collected by the same
    // rules, and `environment`/`setupFiles` are untouched (the new file opts out
    // of jsdom with a `// @vitest-environment node` docblock, the pattern
    // `src/lib/__tests__/urlState.test.ts` already uses).
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "scripts/**/*.test.mjs",
    ],
    setupFiles: ["src/test-setup.ts"],
  },
});
