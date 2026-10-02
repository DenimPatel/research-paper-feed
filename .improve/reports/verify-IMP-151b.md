# Verification report — IMP-151b (null-URL import regression fix)

**Verifier:** independent, skeptical sub-agent (did not author the change)
**Repo:** `/Users/denimpatel/Desktop/git/research-paper-feed`
**Change under review:** uncommitted working-tree diff to `web/src/lib/collections.ts` + `web/src/lib/__tests__/collections.test.ts`
**Baseline:** 65 tests / 5 files (60 pre-IMP-151 + 5 from IMP-151)
**Date:** 2026-10-02

---

## VERDICT: **PASS** — 6/6 criteria met

All criteria are met. The fix is correct, minimal, and **does not weaken the IMP-001 security
property**. I found zero unsafe hrefs across 41 adversarial import payloads driven through the
real import *and* render path, and I confirmed in real Chromium that the whitespace/tab
`javascript:` vectors this change could plausibly have regressed **are** genuinely
browser-executable — and that `isHttpUrl` rejects every one of them.

Two LOW/non-blocking observations are recorded in §7. Neither is a blocker and neither
invalidates the verdict.

---

## 1. Diff review against stated intent

### 1.1 The production change — one token

`web/src/lib/collections.ts:96-101`:

```ts
function hasSafeUrls(value: Paper): boolean {
  const paper = value as Partial<Paper>;
  return [paper.absUrl, paper.pdfUrl].every(
    (url) => url == null || isHttpUrl(url),   // :99  (was `url === undefined ||`)
  );
}
```

`git diff --stat -- web/`:

```
 web/src/lib/__tests__/collections.test.ts | 69 +++++++++++++++++++++++++++++++
 web/src/lib/collections.ts                |  8 +++-
 2 files changed, 76 insertions(+), 1 deletion(-)
```

One line of code changed (`=== undefined` → `== null`) plus a 5-line doc comment. The
allowlist itself is untouched: `isHttpUrl` (`collections.ts:86-88`) is byte-identical, and so
are `isPaper` (`:68-80`) and the `filter(isPaper).filter(hasSafeUrls)` chain (`:257`).

**This is the right shape of fix.** It widens the *exempt* set only — from `{undefined}` to
`{undefined, null}` — and leaves the *accepted* set (`isHttpUrl`) exactly as IMP-001 defined
it. A fix that had instead loosened `isHttpUrl` or returned `true` for non-strings would have
re-opened the XSS hole; this does neither.

### 1.2 `null` / `undefined` are retained — CONFIRMED

Proven through the full round-trip (bytes → `parseExportPayload` → `collectionsReducer` →
rendered DOM), `absUrl: null` and `pdfUrl: null` both yield **retained=1, anchors=0, hrefs=[]**.
An absent (key-deleted) field likewise yields `{"ids":["absent"],"hrefs":[],"anchorCount":0}`.

### 1.3 Root cause is genuine — producer confirmed

`scripts/build_index.py:113-114` (`record_from_result`), read independently:

```python
"absUrl": getattr(result, "entry_id", None),
"pdfUrl": getattr(result, "pdf_url", None),
```

A missing attribute becomes `None` → JSON `null`. `web/src/lib/types.ts:11-12` declares both
fields non-nullable `string`, so TypeScript never saw the mismatch. The pre-fix predicate ran
`isHttpUrl(null)` → `String(null)` → `"null"` → regex fail → paper discarded. Confirmed: the
`null` case was genuinely reachable on the wire.

### 1.4 Scope note (implementer's, and it is correct)

`loadState` (`collections.ts:280-316`) never calls `hasSafeUrls`, so pre-existing localStorage
snapshots were never affected. Only the **import** path lost papers. Verified: `loadState`
applies only `isPaper` (`:299`), no URL filter.

---

## 2. THE SECURITY PROPERTY — IMP-001 is intact

This is the most important check. **Intact.**

### 2.1 Method

Two independent harnesses, both in `/tmp` (repo untouched):

- **`isHttpUrl` direct probe** — every payload through the exported predicate.
- **Full attack harness** — payload → `JSON.parse(JSON.stringify(...))` → `parseExportPayload`
  → `collectionsReducer` → `render(<PaperCard/>)` → `document.querySelectorAll("a")`, capturing
  the raw `getAttribute("href")` of every rendered anchor.
- **Real Chromium** — `page.evaluate` resolving each payload through `new URL()` and an `<a>`
  element, to establish what a browser *actually* does (authoritative, not simulated).

### 2.2 Direct `isHttpUrl` verdicts (all 26 cases)

| payload | `isHttpUrl` | `String(v).trim()` |
| --- | --- | --- |
| `null` | **false** | `"null"` |
| `undefined` | **false** | `"undefined"` |
| `""` | **false** | `""` |
| `"   "` | **false** | `""` |
| `0` | **false** | `"0"` |
| `false` | **false** | `"false"` |
| `[]` | **false** | `""` |
| `{}` | **false** | `"[object Object]"` |
| `"javascript:alert(1)"` | **false** | `"javascript:alert(1)"` |
| `"JAVASCRIPT:alert(1)"` | **false** | `"JAVASCRIPT:alert(1)"` |
| `" javascript:alert(1)"` | **false** | `"javascript:alert(1)"` |
| `"\t\n javascript:alert(1)"` | **false** | `"javascript:alert(1)"` |
| `"java\tscript:alert(1)"` | **false** | `"java\tscript:alert(1)"` |
| `"jav\u0000ascript:alert(1)"` | **false** | `"jav\u0000ascript:alert(1)"` |
| `"data:text/html,<script>x</script>"` | **false** | (unchanged) |
| `"vbscript:msgbox(1)"` | **false** | (unchanged) |
| `"file:///etc/passwd"` | **false** | (unchanged) |
| `"//evil.example"` | **false** | `"//evil.example"` |
| `"httpsx://ok"` | **false** | `"httpsx://ok"` |
| `"http:\/\/ok"` | **false** | `"http:\\/\\/ok"` |
| `"http://"` | **true** | `"http://"` |
| `"https://ok.example"` | **true** | (unchanged) |
| `"HTTP://ARXIV.ORG/ABS/1"` | **true** | (unchanged) |
| `"\thttps://ok.example"` | **true** | `"https://ok.example"` |
| `"https://x\n@evil.example"` | **true** | `"https://x\n@evil.example"` |
| `["https://x"]` | **true** | `"https://x"` |

Every non-`http(s)` scheme is still rejected. `http` must remain accepted — board history
records that the live index emits `http://arxiv.org/abs/…` (`build_index.py:111`), so an
https-only allowlist would strip every link. The change did not touch that.

### 2.3 The leading-whitespace / embedded-tab question — ANSWERED DEFINITIVELY

This is the case I was told to worry about, and I confirmed it in **real Chromium**, not by
theory:

| payload | Chromium-resolved `href` | protocol | `isHttpUrl` | paper |
| --- | --- | --- | --- | --- |
| `"JAVASCRIPT:alert(1)"` | `javascript:alert(1)` | **`javascript:`** | false | **DROPPED** |
| `" javascript:alert(1)"` | `javascript:alert(1)` | **`javascript:`** | false | **DROPPED** |
| `"\t\n javascript:alert(1)"` | `javascript:alert(1)` | **`javascript:`** | false | **DROPPED** |
| `"java\tscript:alert(1)"` | `javascript:alert(1)` | **`javascript:`** | false | **DROPPED** |

Chromium strips leading C0 controls/space and embedded tab/LF, so all four **would execute**
as live anchors. The threat model is real. `isHttpUrl` rejects all four, so the paper never
reaches the renderer. **No bypass exists.**

Why it is airtight, not merely lucky: `isHttpUrl` is
`/^https?:\/\//i.test(String(value).trim())` — anchored at `^` *after* trimming. Any string
that passes begins with the literal characters `http:`/`https:`, case-insensitively. Browser
URL parsing only ever *removes* tab (U+0009), LF (U+000A) and CR (U+000D) — none of which
appear in the literal `https`. Therefore the scheme a browser derives is always `http` or
`https`. There is no input that passes the predicate and resolves to `javascript:`.

`jav\0ascript:` (NUL) is also rejected — Chromium refuses to parse it at all (protocol
`(throw)`), so it is inert either way.

---

## 3. `PaperCard.tsx` render guards — NOT WEAKENED (reported only, not modified)

`web/src/components/PaperCard.tsx:33-35` is byte-identical to HEAD and **not null-aware**:

```ts
function safeHref(url: string | undefined): string | undefined {
  return isHttpUrl(url) ? String(url).trim() : undefined;
}
```

This is correct and should stay this way: `isHttpUrl` takes `unknown`, so `isHttpUrl(null)` is
`false` at runtime, `safeHref` returns `undefined`, and all four `href={…}` sites (`:64`,
`:102`, `:116`, `:121`) take their existing no-anchor branches. Import-time validation is *not*
relied upon — the render guard is independently sufficient, which matters because
`loadState` can hydrate papers that never passed `hasSafeUrls`.

Verified by rendering (jsdom), not by reading:

```
abstractTruncated=true, both urls null -> anchors=0 hrefs=[]
note text: Abstract truncated — view the full text on arXiv.
title tag: SPAN
.paper__links children: 0
absUrl=https, pdfUrl=null -> hrefs=["https://arxiv.org/abs/x1","https://arxiv.org/abs/x1"]
```

Markup for the both-null case — note there is **no `href` attribute of any kind**, not even an
empty one:

```html
<article class="paper"><header class="paper__header">
<h3 class="paper__title"><span>Paper x1</span></h3>
...
<p class="paper__note">Abstract truncated — view the full text on arXiv.</p>
```

So: a null URL renders **no anchor**, and the `abstractTruncated` branch (`:100-110`) renders
the phrase as plain text. Both confirmed empirically. The `PaperCard.tsx` diff is empty.

---

## 4. Type-narrowing and typecheck soundness

### 4.1 `npm run typecheck` is genuinely clean — not silently skipping

```
$ npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0
```

Verified it is not a no-op:
- `web/package.json` → `"typecheck": "tsc --noEmit"` — a real compile, not a stub.
- `web/tsconfig.json` → `"strict": true`, `"include": ["src", "vite.config.ts"]` — so the
  **test files are type-checked too**, and `noUnusedLocals`/`noUnusedParameters` are on.
- **Empirical liveness probe** (scratch only): injected
  `const bad: number = "definitely-not-a-number";` into `collections.ts` and re-ran
  `npx tsc --noEmit` → `src/lib/collections.ts(53,9): error TS2322: Type 'string' is not
  assignable to type 'number'.` The compiler is live and reaching the changed file.

### 4.2 `url == null` narrows correctly under `strict`

Probe file (scratch only, since removed) compiled against the real predicate:

```ts
export function probeLoose(p: Partial<Paper>): boolean {
  return [p.absUrl, p.pdfUrl].every((url) => url == null || isHttpUrl(url));
}
export function probeNarrow(p: Partial<Paper>): string | undefined {
  if (p.absUrl == null) { return undefined; }
  return p.absUrl.toUpperCase();     // narrows to string — compiles clean
}
```

`npx tsc --noEmit` produced **zero** errors in the probe file (the only error in the whole run
was `process` in my own scratch test — unrelated). Confirmed:
- `== null` is accepted by `strict` for a `string | undefined` element (no TS2367) — this is
  the idiomatic null-or-undefined check and TypeScript special-cases it.
- It narrows correctly: after `if (p.absUrl == null) return;`, `p.absUrl` is `string`.
- The narrowing is not even load-bearing here, because `isHttpUrl` is typed `(value: unknown)`
  and the `.every()` result is consumed as a plain `boolean`.

Incidentally `url === null` would *also* have compiled, so `== null` was a style choice, not a
compiler-forced one. It is the better choice — one comparison instead of two, and it cannot
drift if a third nullish value is ever added.

---

## 5. Non-vacuousness — independently reproduced

### 5.1 Reverting one line yields exactly 4 failed / 65 passed — CONFIRMED

Scratch at `/tmp/verif151b/scratch` (rsync of `web/` minus `node_modules`/`dist`, with
`node_modules` symlinked back). Only the predicate line was reverted; the repo was never
touched — verified afterwards that the repo still reads `url == null || isHttpUrl(url)` at
`collections.ts:99`.

```
$ npx vitest run          # scratch, predicate reverted to `url === undefined`
 FAIL  … > keeps a paper whose absUrl is null
 FAIL  … > keeps a paper whose pdfUrl is null
 FAIL  … > keeps a paper whose absUrl and pdfUrl are both null
 FAIL  … > still drops javascript:, data: and vbscript: urls beside null siblings
 Test Files  1 failed | 4 passed (5)
      Tests  4 failed | 65 passed (69)
```

**Exactly the claimed 4 failed / 65 passed.** Failure mode is the reported one:

```
AssertionError: expected [] to deeply equal [ '2401.00004' ]
- Array [ "2401.00001" ]
+ Array []
```

All 4 new tests are load-bearing, and **no pre-existing test depends on the buggy behaviour**
(the other 65 pass unchanged under the revert).

### 5.2 No existing test weakened or deleted — CONFIRMED

`git diff -- web/src/lib/__tests__/collections.test.ts` is **purely additive**: `69` insertions,
`0` deletions (`git diff --numstat` → `69 0`; grepping the diff for removed lines returns none).
The 65 pre-existing tests are untouched, and `collections.test.ts` went 21 → 25.

The 4th new test is well designed: `still drops javascript:, data: and vbscript: urls beside
null siblings` asserts that of a 5-paper payload containing four hostile URLs and one
both-null paper, *only* `2401.00004` survives. This pins the new behaviour and the old security
property in a single assertion, so an over-broad future "fix" (`return true`, or exempting
non-strings) fails it.

---

## 6. Gate results (run from `web/`, exact output)

```
$ npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0

$ npm test
> vitest run
 RUN  v2.1.9 /Users/denimpatel/Desktop/git/research-paper-feed/web
 ✓ src/lib/__tests__/urlState.test.ts (18 tests) 4ms
 ✓ src/lib/__tests__/collections.test.ts (25 tests) 9ms
 ✓ src/lib/__tests__/search.test.ts (12 tests) 4ms
 ✓ src/lib/__tests__/paperIndex.test.ts (11 tests) 14ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 141ms
 Test Files  5 passed (5)
      Tests  69 passed (69)
TEST_EXIT=0

$ npm run build
> tsc --noEmit && vite build
vite v5.4.21 building for production...
✓ 39 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-D8wKSJm1.js   163.72 kB │ gzip: 52.63 kB
✓ built in 369ms
BUILD_EXIT=0
```

**69 tests / 5 files** as expected. 39 modules, CSS 10.93 kB / gzip 2.86 kB unchanged, JS
163.72 kB — no bundle regression. `web/dist` is gitignored (`web/.gitignore:5`), so the build
did not dirty the tree.

---

## 7. Attack table — 15 payloads × both URL fields

Full round-trip per row: payload → `JSON.parse(JSON.stringify(...))` → `parseExportPayload` →
`collectionsReducer` → `render(<PaperCard/>)` → every rendered `getAttribute("href")`.
`absUrl` rows pair with `pdfUrl: null`, `pdfUrl` rows with `absUrl: null`; both columns
behaved identically in every case.

| # | payload | paper | anchors | rendered `href`s | unsafe href? |
| --- | --- | --- | --- | --- | --- |
| 1 | `null` | **RETAINED** | 0 | `[]` | **none** |
| 2 | absent (key deleted) | **RETAINED** | 0 | `[]` | **none** |
| 3 | `""` | dropped | 0 | `[]` | none |
| 4 | `"   "` | dropped | 0 | `[]` | none |
| 5 | `0` | dropped | 0 | `[]` | none |
| 6 | `false` | dropped | 0 | `[]` | none |
| 7 | `[]` | dropped | 0 | `[]` | none |
| 8 | `{}` | dropped | 0 | `[]` | none |
| 9 | `"JAVASCRIPT:alert(1)"` | dropped | 0 | `[]` | none |
| 10 | `" javascript:alert(1)"` | dropped | 0 | `[]` | none |
| 11 | `"java\tscript:alert(1)"` | dropped | 0 | `[]` | none |
| 12 | `"java\nscript:alert(1)"` | dropped | 0 | `[]` | none |
| 13 | `"https://ok.example"` | **RETAINED** | 2 | `["https://ok.example","https://ok.example"]` | none |
| 14 | `"//evil.example"` | dropped | 0 | `[]` | none |
| 15 | `"http://"` | **RETAINED** | 2 | `["http://","http://"]` | none (protocol-relative-free, http:) |
| 16 | `"httpsx://ok"` | dropped | 0 | `[]` | none |
| 17 | `"file:///etc/passwd"` | dropped | 0 | `[]` | none |
| 18 | `"blob:https://x/y"` | dropped | 0 | `[]` | none |
| 19 | `["https://x"]` (array w/ http) | **RETAINED** | 2 | `["https://x","https://x"]` | none |
| 20 | `"\thttps://ok.example"` | **RETAINED** | 2 | `["https://ok.example", …]` | none (trimmed) |
| 21 | `"https://x\n@evil.example"` | **RETAINED** | 2 | `["https://x\n@evil.example", …]` | none — Chromium → `https://x@evil.example/`, protocol still `https:` |

**Zero unsafe hrefs across all 41 rendered cases.** Rows 1–2 confirm the fix; rows 3–18
confirm IMP-001's property still holds; rows 19–21 are the non-issues noted in §8.

Note on rows 3–8: these are *dropped*, not retained-as-no-url. That is IMP-001's intended
posture (a present-but-invalid URL means the export is untrustworthy), and the payload values
are not ones `build_index.py` emits, so it is not a data-loss regression. See §8 OBS-A for the
residual nuance.

---

## 8. Observations (LOW — none blocking, none introduced by this change)

**OBS-A — `""` is still "unsafe", not "no URL".** Rows 3–4. `String("").trim()` is `""`, which
fails the regex, so an empty-string URL discards the whole paper — the same data-loss shape as
the reported bug. `build_index.py` cannot emit `""` (it uses `getattr(…, None)`), so this is
**latent**, not live. It would only bite a third-party or hand-edited export. Out of scope for
this regression and arguably correct-by-design; flagging so it is not rediscovered later.

**OBS-B — `isHttpUrl` permits embedded tab/LF/CR mid-URL.** Row 21. `"https://x\n@evil.example"`
passes, and the raw newline is written into the `href`; Chromium silently strips it to
`https://x@evil.example/` — i.e. userinfo `x`, host `evil.example`. **This is not an XSS**: the
scheme is pinned by the `^https?://` anchor, as argued in §2.3. It is a phishing/defense-in-depth
nit only. A future hardening could reject `/[\t\n\r]/` in `isHttpUrl`; doing so is behaviour-
changing and belongs to its own item.

**OBS-C — pre-existing, unchanged:** an `absUrl` that is a JSON *array* `["https://x"]` passes
via `String([...])` (row 19). The rendered `href` is still `https://x`, so not exploitable.
This is `verify-IMP-001.md` OBS-1 / IMP-019 territory, correctly left alone here.

**OBS-D — type contract knowingly violated at runtime.** `types.ts:11-12` declares
`absUrl: string` / `pdfUrl: string`, but after this fix `parseExportPayload` can legitimately
return papers whose fields are `null`. `safeHref`'s signature (`PaperCard.tsx:33`) is likewise
now inaccurate — it receives `null` where the type says `string`. This is safe **only** because
`isHttpUrl` is typed `(value: unknown)` and thus handles `null` at runtime; if anyone ever
narrows that parameter to `string`, the `null` would flow straight into an `href`. The
implementer flagged this correctly as IMP-019's scope and explicitly recommended keeping the
`url == null` branch even after the types are tightened (because `parseExportPayload` validates
untrusted files from disk). That advice is sound and should be recorded when IMP-019 lands.

**OBS-E — test-coverage gap (LOW).** `collections.test.ts:266-267` — the pre-existing IMP-001
coverage tests only bare `javascript:`. The new test adds `data:`, `vbscript:` and `httpx://`.
Still untested anywhere in the repo: `file:`, `blob:`, and — most notably — the
whitespace/tab-obfuscated `javascript:` variants that I proved in §2.3 are the *actually
executable* ones. A future edit that dropped `.trim()` from `isHttpUrl` would pass every
existing test while re-opening the hole. Recommend three assertions added to the existing
`describe` (assert on `isHttpUrl` directly, or extend the 4th new test's payload list with
`" javascript:alert(1)"` and `"java\tscript:alert(1)"`). This is a test gap, not a defect.

---

## 9. Criterion 5 — no regression to normal import — CONFIRMED against real data

Driven through the actual import path with the **real** `build_index.py` output committed at
`web/public/data/` (not a fixture):

```
shard 2026-W40: manifest count=2549 onDisk=2549 imported=2549
shard 2026-W39: manifest count=263  onDisk=263  imported=263
REAL ROUND-TRIP TOTAL IMPORTED = 2812 (manifest totalPapers=2812)
```

All 2,812 papers survive, ids in exact manifest order, zero dropped. Also checked: the current
2,812-paper corpus contains **0** null `absUrl`/`pdfUrl` fields, confirming the regression this
fix addresses is **latent** — it would have fired only on an export containing a url-less paper
(e.g. an `arxiv.Result` whose `pdf_url` is unavailable). The fix is still correct and necessary:
`getattr(result, "pdf_url", None)` makes `None` reachable, and hand-edited or third-party export
files are explicitly in scope for a validator that reads from disk.

---

## 10. Repository hygiene

- **No source file modified by me.** `git status --porcelain` is byte-identical to the state I
  received: ` M web/src/lib/__tests__/collections.test.ts`, ` M web/src/lib/collections.ts`,
  plus the 3 pre-existing untracked reports. No new untracked files in `web/`.
- Verified `collections.ts:99` still reads `url == null || isHttpUrl(url)` after all scratch work.
- Grepped `web/` for my scratch filenames (`attack-151b`, `ishttpurl-probe`,
  `papercard-null-branch`, `real-export`): **no leaks**.
- No git write command run. No `git commit`/`add`/`push`/`checkout`/`reset`/`stash`.
- `.kilo/worktrees/mildly-income` never read or modified.
- All scratch work confined to `/tmp/verif151b/`.
- Browser: one `about:blank` navigation + one `page.evaluate` for the Chromium URL-resolution
  table, then closed. Per IMP-001's known Playwright-MCP quirk it left an empty
  `.playwright-mcp/traces/`; that path is excluded via `.git/info/exclude:52` so it never
  dirtied `git status`, and I removed it to leave the tree exactly as found.

---

## 11. Summary

| # | Criterion | Result |
| --- | --- | --- |
| 1 | `null`/`undefined` treated as "no URL"; paper retained | **MET** |
| 2 | IMP-001 security property intact (all non-`http(s)` schemes still rejected) | **MET** |
| 3 | `PaperCard.tsx` `safeHref` guards not weakened; null renders no anchor | **MET** |
| 4 | No type-narrowing regression; `npm run typecheck` genuinely clean | **MET** |
| 5 | 4 new tests non-vacuous (4 failed / 65 passed on revert); no test weakened or deleted | **MET** |
| 6 | Gates: typecheck 0 · 69 tests / 5 files · build 0 | **MET** |
| 7 | No regression to normal import (2,812 / 2,812 real papers) | **MET** |

**6/6 criteria met. PASS.**

The implementer's report was accurate on every claim I checked, including the exact
4 failed / 65 passed non-vacuousness figure and the build byte sizes. The fix is one token,
correctly scoped to the exemption set rather than the allowlist, and the security property it
had to preserve is genuinely preserved — including against the whitespace/tab obfuscation that
real Chromium executes.
