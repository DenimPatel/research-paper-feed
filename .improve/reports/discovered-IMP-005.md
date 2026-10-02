# Discovered while implementing IMP-005 — not fixed

Scope note: IMP-005 touched `web/vite.config.ts`, `web/package.json`, `web/package-lock.json`
(permitted), plus two new files under `web/src/`. Nothing below was changed, and
`.improve/FEATURES.md` was not edited.

---

## 1. Stale premise in the backlog: the `environment: "node"` justification at `FEATURES.md:1662`

**Severity:** low (documentation drift inside the backlog, not a product defect)
**Where:** `.improve/FEATURES.md:1662`, the Notes of the fixture-contract item (the one proposing
committed `index.json` / shard fixtures under `web/src/lib/__tests__/fixtures/`).

> "A test in `web/src/lib/__tests__/paperIndex.test.ts` reads it with `node:fs` — legal because
> `vite.config.ts:8` sets `environment: \"node\"`"

That reasoning is now stale. `vite.config.ts:8` sets `environment: "jsdom"` as of IMP-005.

**The item is still implementable as written.** Vitest executes on Node in every environment and
only swaps the *globals*, so `node:fs` remains importable under `environment: "jsdom"`. I verified
this incidentally: with `environment` reverted to `"node"` in a `/tmp` copy, the 39 lib tests passed,
and with `environment: "jsdom"` (the committed config) the same 39 also pass — the suites are
environment-agnostic.

**Suggested fix when that item is picked up:** change the sentence to justify `node:fs` on the
grounds that Vitest runs on Node regardless of the DOM environment, or, if the author prefers a
literal `node` environment for that file, add a `// @vitest-environment node` docblock to
`paperIndex.test.ts` (verified safe: the lib suites and `src/test-setup.ts` both pass under a node
environment).

This is the same class of staleness the IMP-003 verifier flagged for WEB-01
(`.improve/reports/verify-IMP-003.md`): the profile and the backlog describe a state that an
earlier item already moved past.

---

## 2. Pre-existing: `jsdom@29`'s engine floor is above a bare `node-version: "20"`

**Severity:** low (latent CI risk, cannot currently fire)
**Where:** `web/package-lock.json` (post-IMP-005), `.github/workflows/ci.yml:29`,
`.github/workflows/deploy.yml:38`

`jsdom@29.1.1` declares `engines: {"node": "^20.19.0 || ^22.13.0 || >=24.0.0"}`. Both workflows
request `node-version: "20"`, which `actions/setup-node@v4` resolves to the newest 20.x, so the
range is satisfied today (Node 20.19.0 shipped 2025-03).

Two things make this worth recording rather than ignoring:

1. **It is unverified on this machine.** Every Homebrew `node@21` / `node@22` keg under
   `/opt/homebrew/opt/` is a symlink into `/opt/homebrew/Cellar/node/25.6.1`, so there is no real
   Node 20 available to test against. I could only reason about the resolution, not observe it.
2. **It cannot hard-fail the install.** There is no `.npmrc` and no `engine-strict=true`, so npm
   downgrades an engine mismatch to an `EBADENGINE` *warning*. Worst case is a noisy CI log, not a
   red build — and a `node:fs` import would still run.

This is not a bug I introduced so much as a fragility the new dependency inherits from the
workflows' floating `node-version`. **The durable fix belongs to a CI-hardening item** (PE-10
already lists "no Python matrix, single floating `3.x`, actions pinned to mutable tags"), e.g.
pinning an explicit `node-version: "20.19"` or `"22"`. Pinning the workflows is out of scope for
IMP-005 and outside `web/`.

If it ever needs to be silenced from the `web/` side instead, `npm install --save-dev jsdom@^26`
declares `node >=18` and costs one command; nothing else in the change depends on jsdom 29.

---

## 3. Pre-existing, unrelated to this item: repo hygiene noise

Already recorded as PE-12 and PE-15 in the profile, re-confirmed while working, no action taken:
`.venv/`, `.pytest_cache/`, `extracted/`, `*.pdf`, `*.tar.gz`, `*_papers.csv` in the repo root are
still untracked-and-unignored, and `git status --short` from a clean checkout dirties the tree.
Followed the readme's own instructions and reproduced it. Not in scope for IMP-005.