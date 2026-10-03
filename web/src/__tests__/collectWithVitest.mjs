// @vitest-environment node
//
// IMP-028c, probe half. `src/__tests__/indexGuardRegistration.test.ts` is the
// pin; this is the only part of it that needs Node's `child_process` and `fs`.
//
// It is a separate `.mjs` file for one reason, and it is not stylistic: this
// tree has no `@types/node` -- `tsconfig.json` sets `"types": ["vite/client"]`,
// and nothing in the React toolchain ships Node types -- so a `.ts` file under
// `src/` cannot import `node:child_process` without failing `npm run typecheck`.
// `scripts/__tests__/indexGuards.test.mjs` spawns Node freely for the same
// reason it is `.mjs`. `collectWithVitest.d.mts` declares the shape for
// TypeScript without adding a dependency or editing `tsconfig.json`.
//
// It is `.mjs` rather than `.ts` and therefore outside the TypeScript project
// entirely, which is also why the `// @vitest-environment node` docblock above is
// decorative: this file is not collected by `test.include` (which globs
// `src/**/*.test.ts`, `src/**/*.test.tsx` and `scripts/**/*.test.mjs`) and never
// runs on its own.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The `vitest` CLI, located through Node's resolution rather than by assuming a
 * path into `web/node_modules`, so a hoisted install keeps working.
 */
function vitestBin() {
  const manifestPath = createRequire(import.meta.url).resolve("vitest/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return join(dirname(manifestPath), manifest.bin.vitest);
}

/**
 * The parent run's own `VITEST*` variables describe a pool, a worker and a mode
 * belonging to the process being asked. Dropping them means the child configures
 * itself from the files on disk rather than inheriting a worker id it is not
 * running in.
 */
function childEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("VITEST")) {
      env[key] = value;
    }
  }
  return env;
}

/** An absolute path as posix, relative to `web/`, so it can be compared to config globs. */
function repoRelative(absolute) {
  return relative(WEB_ROOT, absolute).split(sep).join("/");
}

/** Runs `vitest list ...` and returns its status, stdout and stderr together. */
function runList(args) {
  const result = spawnSync(process.execPath, [vitestBin(), "list", ...args], {
    cwd: WEB_ROOT,
    encoding: "utf8",
    env: childEnv(),
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    spawnError: result.error ? result.error.message : null,
  };
}

function diagnose(args, result) {
  return (
    `vitest list ${args.join(" ")} failed\n` +
    `spawn error: ${result.spawnError ?? "none"}\n` +
    `exit: ${result.status}\n` +
    `stdout:\n${result.stdout}\n` +
    `stderr:\n${result.stderr}`
  );
}

/**
 * Every test *file* vitest collects, from an unfiltered `list --filesOnly`.
 *
 * This is the load-bearing witness and the reason the pin is not a guess: it is
 * the real runner, with the real config, resolving the real globs against the
 * real tree, with nothing narrowed and nothing assumed. It is also the cheap one
 * -- `--filesOnly` globs without importing a single test module, so it costs a
 * few hundred milliseconds where `--json` costs seconds.
 */
export function collectTestFiles() {
  const result = runList(["--filesOnly"]);
  if (result.status !== 0) {
    return { ok: false, reason: diagnose(["--filesOnly"], result), items: [] };
  }
  return {
    ok: true,
    reason: null,
    items: result.stdout.split("\n").filter(Boolean),
  };
}

/**
 * Every test *case* vitest collects under `scripts/__tests__`, with the file it
 * came from -- `list` resolves the config, globs the tree and evaluates each
 * module's `describe`/`it` calls, so a file can only appear here if the runner
 * would genuinely run it.
 *
 * Two things about the argument order are load-bearing:
 *
 *   - `--json` takes an optional path, so `list --json <filter>` would read the
 *     filter as the output path and try to write JSON into it. `--json` goes
 *     last, where nothing can be mistaken for its value.
 *   - The positional filter narrows what the child collects, and only narrows.
 *     A filter cannot reintroduce a file that `include` excluded -- verified by
 *     deleting the glob and re-running this: the child returned `[]`, not the
 *     guard file. So the cheap file listing stays the primary witness and this
 *     only adds which cases that file contributes. It costs ~0.75 s against
 *     ~4.7 s for an unfiltered `--json`, which collects all 18 files.
 */
export function collectGuardSuiteCases() {
  const filter = "scripts/__tests__";
  const result = runList([filter, "--json"]);
  if (result.status !== 0) {
    return { ok: false, reason: diagnose([filter, "--json"], result), items: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    return {
      ok: false,
      reason: `vitest list ${filter} --json was not JSON: ${error.message}`,
      items: [],
    };
  }
  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      reason: `vitest list ${filter} --json was not an array`,
      items: [],
    };
  }

  return {
    ok: true,
    reason: null,
    items: parsed.map((entry) => ({
      name: entry.name,
      file: repoRelative(entry.file),
    })),
  };
}

/**
 * Both listings, run once per test file. Even the cheap one costs a child
 * process and a vite config load, and two `it` blocks asking the same question
 * must not pay that twice for one answer. Neither listing can change within a
 * run, so the cache is safe.
 */
const memo = new Map();

function once(key, produce) {
  if (!memo.has(key)) {
    memo.set(key, produce());
  }
  return memo.get(key);
}

export function guardSuiteListing() {
  return once("files", collectTestFiles);
}

export function guardSuiteCases() {
  return once("cases", collectGuardSuiteCases);
}