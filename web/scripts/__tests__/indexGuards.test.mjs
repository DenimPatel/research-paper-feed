// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * IMP-028b: tests for the two guards that stand between a paper index and
 * production. `scripts/require-index.mjs` runs inside `npm run build`, and
 * `.github/workflows/deploy.yml` asserts `web/dist/data/index.json` reached the
 * artifact; between them they are the only thing standing between a silently
 * empty feed and a published site. Until this file existed, deleting either one
 * turned nothing red.
 *
 * They live in `web/` rather than in the Python `tests/` suite because what they
 * guard is Node and shell: the behaviour is only reachable by *running*
 * `require-index.mjs`, and a Python test could do that at best by shelling out to
 * a `node` that the `python-tests` CI job never installs. It lives in the vitest
 * suite because that is the runner CI already executes for this tree (`npm test`,
 * `web-tests` job), which is what makes widening `test.include` the
 * least-blast-radius registration available: a dedicated runner, a second vitest
 * config or a `node --test` script would all need a `.github/workflows/ci.yml`
 * edit to ever run, and would leave this file collecting dust otherwise.
 *
 * The tests spawn the guard rather than importing it, deliberately: the guard
 * reads `process.argv` and calls `process.exit` at module scope, so importing it
 * would either kill the test worker or test something other than what the build
 * runs. A child process costs ~30 ms and is the same invocation `npm run build`
 * makes. No `vite build` runs here, nothing touches the network, and every
 * fixture lives in a fresh temp directory that `afterEach` removes.
 */

const GUARD = fileURLToPath(new URL("../require-index.mjs", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PACKAGE_JSON = fileURLToPath(new URL("../../package.json", import.meta.url));
const DEPLOY_YAML = fileURLToPath(new URL("../../../.github/workflows/deploy.yml", import.meta.url));
const README = fileURLToPath(new URL("../../../readme.md", import.meta.url));

/** A shard name of the shape `build_index.py` writes (`write_index`, ISO week). */
const SHARD = "papers-2026-W40.json";

const sandboxes = [];

afterEach(() => {
  while (sandboxes.length > 0) {
    rmSync(sandboxes.pop(), { recursive: true, force: true });
  }
});

/** A fresh temp root, optionally with `public/data` created inside it. */
function fixture({ withDataDir = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "index-guard-"));
  sandboxes.push(root);
  const data = join(root, "public", "data");
  if (withDataDir) {
    mkdirSync(data, { recursive: true });
  }
  return { root, data };
}

/** Writes an `index.json`. A string is written verbatim, to make malformed input easy. */
function writeManifest(data, contents) {
  writeFileSync(
    join(data, "index.json"),
    typeof contents === "string" ? contents : JSON.stringify(contents),
  );
}

/** Writes one real shard file, the way `build_index.py` would. */
function writeShard(data, name = SHARD) {
  writeFileSync(join(data, name), JSON.stringify({ papers: [] }));
}

function runGuard(args, cwd) {
  const result = spawnSync(process.execPath, [GUARD, ...args], { cwd, encoding: "utf8" });
  return {
    code: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/** The exact invocation `npm run build` makes: no argument, so `public/data`. */
function runAsBuildDoes(root) {
  return runGuard([], root);
}

/**
 * The one-argument form, relative by default so the guard names the path the way
 * the readme and the build script do rather than as a `/tmp` absolute path.
 */
function runOn({ root, data }, { absolute = false } = {}) {
  return runGuard([absolute ? data : "public/data"], root);
}

function expectRefused(result, message) {
  expect(result.code, `guard should exit 1. stderr:\n${result.stderr}`).toBe(1);
  expect(result.stderr).toMatch(message);
  // A refusal has to be silent on stdout, so nothing downstream can mistake a
  // failed check for a successful one by reading the happy-path line.
  expect(result.stdout).toBe("");
  // Exit code 1 alone does not prove the guard *diagnosed* the problem: an
  // unhandled ENOENT exits 1 too, with a stack trace instead of a message. These
  // three assertions are what make the broken-symlink cases real tests of the
  // guard rather than of Node's crash reporter.
  expect(result.stderr, "guard must not crash").not.toMatch(/^\s+at /m);
  expect(result.stderr, "guard must not crash").not.toMatch(/\bENOENT\b/);
  expect(result.stderr, "guard must not crash").not.toMatch(/Node\.js v\d/);
}

function expectAccepted(result, shardCount) {
  expect(result.stderr, `guard should exit 0. stderr:\n${result.stderr}`).toBe("");
  expect(result.code, `guard should exit 0. stderr:\n${result.stderr}`).toBe(0);
  expect(result.stdout).toMatch(new RegExp(`with ${shardCount} shard\\(s\\)\\.$`, "m"));
}

describe("require-index.mjs refuses an index it must not ship", () => {
  it("refuses a data directory that is not there at all", () => {
    // The fresh-checkout case IMP-028 exists for: `public/data` is gitignored.
    const { root } = fixture({ withDataDir: false });
    const result = runAsBuildDoes(root);

    expectRefused(result, /No paper index to build against: public\/data\/index\.json does not exist\./);
    // The message has to say how to fix it, since this is what a developer
    // meets first when they clone and build without reading the deploy workflow.
    expect(result.stderr).toMatch(/python scripts\/build_index\.py/);
  });

  it("refuses a data directory that holds no index.json", () => {
    const place = fixture();
    expectRefused(runOn(place), /public\/data\/index\.json does not exist\./);
  });

  it("refuses an index.json that is empty", () => {
    const place = fixture();
    writeManifest(place.data, "");

    expectRefused(runOn(place), /could not be read as an index manifest/);
  });

  it("refuses an index.json that is a directory", () => {
    const place = fixture();
    mkdirSync(join(place.data, "index.json"));

    expectRefused(runOn(place), /could not be read as an index manifest/);
  });

  it("refuses an index.json that is malformed JSON", () => {
    const place = fixture();
    writeManifest(place.data, '{"shards": [');

    expectRefused(runOn(place), /could not be read as an index manifest/);
  });

  it("refuses an index.json that is a dangling symlink", () => {
    const place = fixture();
    symlinkSync(join(place.data, "never-written.json"), join(place.data, "index.json"));

    expectRefused(runOn(place), /public\/data\/index\.json does not exist\./);
  });

  it("refuses a manifest with no shards key", () => {
    const place = fixture();
    writeManifest(place.data, { generatedAt: "2026-10-02T00:00:00Z" });

    expectRefused(runOn(place), /has no "shards" list, so it is not an index manifest\./);
  });

  it("refuses a manifest whose shards list is empty", () => {
    // A run that collected no papers writes this, and the site renders it as an
    // empty feed rather than as a missing index -- the quieter failure these
    // guards exist to stop.
    const place = fixture();
    writeManifest(place.data, { shards: [] });

    expectRefused(runOn(place), /names no shards, so there is no index to ship\./);
  });

  it("refuses a manifest naming a shard that is not there", () => {
    const place = fixture();
    writeManifest(place.data, { shards: [{ file: SHARD }] });

    expectRefused(runOn(place), new RegExp(`names a shard that is not there: ${SHARD}`));
  });

  it("refuses a shard that is a directory", () => {
    // The hole the IMP-028 verifier proved: `existsSync` accepts a directory, so
    // this state passed the build guard and was rejected only later by the deploy
    // step's `test -f`. The build must not be greener than the gate after it.
    const place = fixture();
    writeManifest(place.data, { shards: [{ file: SHARD }] });
    mkdirSync(join(place.data, SHARD));

    expectRefused(runOn(place), new RegExp(`names a shard that is a directory, not a file: ${SHARD}`));
  });

  it("refuses a shard that is a dangling symlink, without crashing", () => {
    const place = fixture();
    writeManifest(place.data, { shards: [{ file: SHARD }] });
    symlinkSync(join(place.data, "never-written.json"), join(place.data, SHARD));

    // `statSync` throws on a dangling link, so the guard has to catch it. A bare
    // `statSync(...).isFile()` exits 1 here too -- with an ENOENT stack trace and
    // no diagnosis -- which is why `expectRefused` rejects a stack trace.
    expectRefused(runOn(place), new RegExp(`names a shard that is not there: ${SHARD}`));
  });

  it("refuses a shard entry with no file name", () => {
    const place = fixture();
    writeManifest(place.data, { shards: [{ week: "2026-W40" }] });

    expectRefused(runOn(place), /has a shard entry without a "file" name\./);
  });

  it("refuses a shard entry whose file name is not a string", () => {
    const place = fixture();
    writeManifest(place.data, { shards: [{ file: 42 }] });

    expectRefused(runOn(place), /has a shard entry without a "file" name\./);
  });
});

describe("require-index.mjs accepts an index it can ship", () => {
  it("accepts a manifest whose shard is a regular file", () => {
    const place = fixture();
    writeManifest(place.data, { shards: [{ file: SHARD }] });
    writeShard(place.data);

    expectAccepted(runOn(place), 1);
  });

  it("accepts a manifest naming several shards", () => {
    const place = fixture();
    writeManifest(place.data, {
      shards: [{ file: SHARD }, { file: "papers-2026-W39.json" }],
    });
    writeShard(place.data);
    writeShard(place.data, "papers-2026-W39.json");

    expectAccepted(runOn(place), 2);
  });

  it("accepts an index at the default path, the way npm run build calls it", () => {
    // No argument, so the guard resolves `public/data` against its own working
    // directory -- the one invocation `npm run build` actually makes. Without
    // this, every other test here would pass while the build script's own call
    // shape was broken.
    const place = fixture();
    writeManifest(place.data, { shards: [{ file: SHARD }] });
    writeShard(place.data);

    const result = runAsBuildDoes(place.root);
    expectAccepted(result, 1);
    // The success line names the path as a developer would type it, which is
    // what makes it readable in CI output.
    expect(result.stdout).toMatch(/^Paper index present: public\/data\/index\.json /m);
  });

  it("accepts a shard that is a symlink to a regular file", () => {
    // Deliberate: `statSync` follows symlinks, so this agrees with the deploy
    // step's `test -f`, which also accepts it. Pinned so that "require a regular
    // file" cannot later be read as "reject every symlink", which would be a new
    // failure mode rather than a fix.
    const place = fixture();
    writeManifest(place.data, { shards: [{ file: SHARD }] });
    writeShard(place.data, "elsewhere.json");
    symlinkSync(join(place.data, "elsewhere.json"), join(place.data, SHARD));

    expectAccepted(runOn(place), 1);
  });

  it("accepts an incomplete index that carries failedCategories and truncatedCategories", () => {
    // Must pass, and the reason is IMP-204: a run where one category's query
    // died, or hit its `--max-per-category` cap, still writes the index it did
    // collect and records the shortfall in the manifest. The site renders that as
    // an on-screen notice, so refusing the build here would take down a feed that
    // is honest about what it is missing.
    const place = fixture();
    writeManifest(place.data, {
      generatedAt: "2026-10-02T06:00:00Z",
      retentionDays: 60,
      categories: ["cs.CV", "cs.LG"],
      failedCategories: ["cs.LG"],
      truncatedCategories: ["cs.CV"],
      shards: [{ file: SHARD }],
    });
    writeShard(place.data);

    expectAccepted(runOn(place), 1);
  });

  it("accepts the same index reached by absolute path", () => {
    const place = fixture();
    writeManifest(place.data, { shards: [{ file: SHARD }] });
    writeShard(place.data);

    expectAccepted(runOn(place, { absolute: true }), 1);
  });
});

describe("the guards stay wired into the commands that run them", () => {
  const scripts = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")).scripts;

  it("runs the guard in the build script, before vite build", () => {
    // Order is the whole point: a guard that ran after `vite build` would report
    // on a `dist` it had already produced, and one that was dropped from the
    // script would leave the deploy step as the only gate.
    expect(scripts.build).toContain("node scripts/require-index.mjs");
    expect(scripts.build.indexOf("require-index")).toBeGreaterThan(-1);
    expect(scripts.build.indexOf("require-index")).toBeLessThan(
      scripts.build.indexOf("vite build"),
    );
  });

  it("never runs the guard from npm run dev or npm test", () => {
    // Both run on CI, and a missing index must cost a developer nothing until
    // they are trying to produce something deployable. This is also what lets
    // this suite assert on a refused index: it runs inside `npm test`.
    expect(scripts.dev).not.toMatch(/require-index/);
    expect(scripts.test).not.toMatch(/require-index/);
  });

  it("has the deploy workflow assert the index after the build and before the upload", () => {
    // The second guard, in the only place it can live: `.github/workflows` is not
    // a file the test suite otherwise reads, and the ordering it encodes is the
    // reason a build that silently lost its index could not publish. Asserted on
    // content rather than on the step's display name, so renaming the step does
    // not break it and deleting the step does.
    const yaml = readFileSync(DEPLOY_YAML, "utf8");
    const buildStep = yaml.indexOf("run: npm run build");
    const uploadStep = yaml.indexOf("actions/upload-pages-artifact");

    expect(buildStep, "deploy.yml should build the site").toBeGreaterThan(-1);
    expect(uploadStep, "deploy.yml should upload the artifact").toBeGreaterThan(buildStep);

    const between = yaml.slice(buildStep, uploadStep);
    expect(between, "the check should read the build output, not the source tree").toContain(
      "web/dist/data",
    );
    // A check that cannot fail is not a check.
    expect(between).toContain("exit 1");
  });

  it("documents the build command the package actually runs", () => {
    // The readme is the only place a reader is told what `npm run build` does, and
    // it went stale the moment the guard was added to the script. The profile
    // requires the documented commands to match `--help`/`package.json`.
    const documented = readFileSync(README, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("npm run build"));

    expect(documented.length).toBeGreaterThan(0);
    for (const line of documented) {
      expect(line, `readme should describe the guard: "${line}"`).toContain(
        "require-index.mjs",
      );
    }
  });
});
