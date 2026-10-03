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

/**
 * Wall-clock ceiling on one `vitest list` child, in milliseconds.
 *
 * `spawnSync` blocks the event loop while the child runs, so vitest's own
 * per-test `it` timeout (120 s, set at the call sites) cannot fire to rescue a
 * hung child: the timer that would fire it is never serviced. Without a bound
 * here, a wedged child stalls the whole worker and the only backstop left is the
 * CI job's `timeout-minutes`, which fails every other test in the file along
 * with this one.
 *
 * 30 s is chosen against two measured numbers, not picked round:
 *
 *   - The healthy cost of a listing is 918-1330 ms on this tree, and the `--json`
 *     listing is the expensive one. 30 s is ~23x the worst observed cost, so a
 *     loaded or cold CI filesystem has to slow the child by more than an order of
 *     magnitude before this can fire on a healthy tree. A tighter value trades
 *     that margin for nothing: the child either answers quickly or is wedged.
 *   - vitest's 120 s test timeout. Staying at or above it would let the blocking
 *     window reach the `it` deadline, and the pin would fail with vitest's generic
 *     "test timed out" instead of the ETIMEDOUT diagnosis that names the cause.
 *     30 s is 4x under it, so the block closes early and the failure says what
 *     actually happened.
 *
 * `killSignal: "SIGKILL"` is what makes the bound a bound. `spawnSync` sends
 * SIGTERM on expiry, and a child that catches or ignores SIGTERM keeps the parent
 * blocked indefinitely -- which is the precise failure this timeout exists to
 * prevent. SIGKILL cannot be handled, so the loop always comes back.
 */
const LIST_TIMEOUT_MS = 30_000;

/** Runs `vitest list ...` and returns its status, stdout and stderr together. */
function runList(args) {
  const result = spawnSync(process.execPath, [vitestBin(), "list", ...args], {
    cwd: WEB_ROOT,
    encoding: "utf8",
    env: childEnv(),
    maxBuffer: 32 * 1024 * 1024,
    timeout: LIST_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    spawnError: result.error ? result.error.message : null,
    spawnErrorCode: result.error && result.error.code ? result.error.code : null,
  };
}

function diagnose(args, result) {
  // A timed-out child exits with `status === null` and `error.code === "ETIMEDOUT"`,
  // which is otherwise indistinguishable from any other crash in the raw status.
  // Naming it here means the failure says "the child hung" rather than leaving a
  // reader to work out why the exit code is null.
  const timedOut = result.spawnErrorCode === "ETIMEDOUT";
  return (
    `vitest list ${args.join(" ")} failed\n` +
    (timedOut
      ? `the child did not finish within ${LIST_TIMEOUT_MS} ms and was killed (SIGKILL)\n`
      : "") +
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