# VERIFICATION — IMP-021 "Write the manifest before deleting stale shards"

**Verifier:** independent sub-agent (did not write the change)
**Date:** 2026-10-02
**Scope reviewed:** `git diff -- scripts/ tests/` plus untracked files in those dirs.
`web/` ignored entirely (concurrent IMP-018).
**Diff under review:**

```
 scripts/build_index.py    | 17 ++++++++++---
 tests/test_build_index.py | 60 +++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 74 insertions(+), 3 deletions(-)
```

**Verdict: PASS** — 3/3 acceptance criteria met, ordering is correct, IMP-004 not
weakened, stale cleanup intact. Three non-blocking findings, all recorded below.

---

## 0. What changed, precisely

`scripts/build_index.py`

| Line | Change |
| --- | --- |
| `:244` | `def _clean_old_shards(out_dir)` → `def _clean_old_shards(out_dir, keep=())` |
| `:245` | new docstring |
| `:247` | `keep = set(keep)` |
| `:249-250` | `if name in keep: continue` before the regex match |
| `:269-271` | shard writes (previously `:256-258`) |
| `:272-274` | manifest write |
| **`:275`** | **`_clean_old_shards(out_dir, keep=shard_files)` — moved from before the shard loop to after the manifest write** |
| `:276` | `return manifest_path` |

`tests/test_build_index.py:230-289` — new class `WriteIndexOrderingTests`, 2 tests.
`git diff -U0 -- tests/ | grep -c '^-[^-]'` → **0**. The test file is **purely additive**:
no existing line removed, edited, reordered, skipped or deleted.

`grep -rn "write_index\|_clean_old_shards" --include=*.py` over the repo (excluding `web/`):
8 matches. The only production caller is `build_index.py:337` inside `main()`.
No other code path touches shards, so the blast radius of this change is exactly `write_index`.

---

## 1. Acceptance criteria

### AC 1 — "writes the new shards and the manifest **before** calling `_clean_old_shards`" — **MET**

`scripts/build_index.py:268-276` executes strictly:
`makedirs` → *n* shard writes → `index.json` write → sweep. Verified by reading
`build_index.py:259-278` and by four independent mutation runs (§4).

### AC 2 — "A test monkeypatches `json.dump` to raise on the shard write and asserts previously valid `papers-*.json` files are still present" — **MET, verbatim**

`tests/test_build_index.py:245-260` installs `failing_dump` on `build_index.json.dump`
(raising `OSError("simulated crash mid-write")`), calls `write_index` inside
`assertRaises(OSError)`, then asserts at `:268-276` that `papers-2023-W52.json` still exists,
its `papers[0]["id"] == "2312.00001"` is intact, and the deployed `index.json` still names it.
Fixture seeding (`:236-242`) happens *before* the stub is installed, which is the only
correct ordering — reordering those two blocks would make the test fail during setup rather
than inside `write_index`.

### AC 3 — "existing test `tests/test_build_index.py:189` (stale-shard removal) still passes unchanged" — **MET**

`tests/test_build_index.py:189-225` (`test_writes_manifest_and_removes_stale_shards`) is
byte-identical to `HEAD`. Diff proof of the whole test file: zero `-` lines.
Runs green in every configuration tested below, including the two mutants that would break it.

**3/3 met.**

---

## 2. CRASH-STATE TABLE — every reachable intermediate state

Method: `write_index` was driven against a real deployed directory containing
`papers-2024-W01.json`, `W02`, `W03` + an `index.json` referencing all three. The new run
produces one shard for `W03` (the realistic same-ISO-week weekly deploy: the new build
overwrites a shard the live manifest already references). Faults were injected by stubbing
`build_index.json.dump` (partial flush, then raise) or `_clean_old_shards`. After each fault
the on-disk tree was probed for the only failure that matters to the deployed site:
a manifest entry whose file is **missing** (→ `Failed to load … (HTTP 404)` in
`web/src/lib/paperIndex.ts`) or **unparseable** (→ `JSONDecodeError` in `loadShard`).

| # | Crash point | HEAD (old order) | NEW (shipped) |
| --- | --- | --- | --- |
| 1 | during shard write, **overlapping** name (W03) | **BROKEN** — `['W01','W02']` MISSING → 404 | **BROKEN (different symptom)** — `W03` truncated → `JSONDecodeError` |
| 2 | during shard write, **non-overlapping** new name (W09) | **BROKEN** — `W01,W02,W03` MISSING → 404 | **CONSISTENT** — old manifest + all 3 old shards + orphan W09 |
| 3 | during manifest write (partial flush, `OSError(28)`) | **BROKEN** — `index.json` = 5 bytes unparseable **and** all shards already deleted | **BROKEN** — `index.json` truncated to 24 bytes unparseable; shards intact |
| 4 | sweep raises at entry (0 files deleted) | CONSISTENT — old manifest, 3 shards | CONSISTENT — **new** manifest (refs=1), 3 shards (2 stale) |
| 5 | sweep raises mid-delete | **BROKEN** — `W01,W02` MISSING → 404 | CONSISTENT — new manifest, 1 shard |
| 6 | after full sweep, no crash | CONSISTENT — new manifest, 1 shard | CONSISTENT — new manifest, 1 shard |

Verbatim probe output (deployed dir had 3 shards, new run writes `W03` only):

```
NEW  (shipped)  crash@shard1      -> BROKEN: manifest ref TRUNCATED -> JSONDecodeError [refs=3 shards_on_disk=3]
NEW  (shipped)  crash@manifest    -> manifest-UNPARSEABLE(24 bytes)  safe=False
NEW  (shipped)  crash@sweep-start -> CONSISTENT (stale-but-valid) [refs=1 shards_on_disk=3]
NEW  (shipped)  crash@sweep-mid   -> CONSISTENT (stale-but-valid) [refs=1 shards_on_disk=1]
HEAD (old order) crash@shard1     -> BROKEN: manifest ref MISSING -> 404 [refs=3 shards_on_disk=1]
HEAD (old order) crash@manifest   -> manifest-UNPARSEABLE(5 bytes)  safe=False
HEAD (old order) crash@sweep-mid  -> BROKEN: manifest ref MISSING -> 404 [refs=3 shards_on_disk=0]

NEW,  crash during a NON-overlapping new shard write -> CONSISTENT refs=['W01','W02','W03'] shards_on_disk=['W01','W02','W03','W09']
HEAD, same crash                                     -> BROKEN: ref MISSING -> 404 ['W01','W02','W03']
```

### Does the stated guarantee hold?

**"a crash at ANY point must never leave a manifest that references a shard file which does
not exist" — YES, for the shipped order.** Across all six injected states the count of
missing referenced shards is **0**. Rows 1/3 are broken for a *different* reason
(non-atomic truncation, `PY-7`) that this spec does not ask for and that existed identically
before the change. Row 1 is arguably **better** than HEAD: a truncated shard still resolves
with HTTP 200 and `loadShard`'s `Array.isArray` guard (`paperIndex.ts:115-119`) surfaces a
handled empty result, whereas HEAD produced a hard 404.

### Is a NEW crash window introduced?

**No.** The reordering closes a window and opens only a strictly-better one.

- **Closed:** HEAD's dominant window — the entire span between `_clean_old_shards` and the
  manifest write, during which *every* referenced shard was already deleted. Rows 1/2/5 above.
- **Opened (and benign):** row 2 — "new shards on disk, old manifest still deployed". The
  deployed site serves the *previous* index, fully intact. This is exactly what a failed
  deploy should do, and the next successful run sweeps the orphans (row 6 proves the sweep
  still fires; §3 proves it on a real run). Row 2 cannot lose data: nothing the old manifest
  referenced was touched.
- **Spec requires nothing stronger.** AC 1 asks only for ordering, and AC 2's own acceptance
  criterion is precisely this "old shards still present" state. Rows 4/5 additionally confirm
  the *new* manifest is never visible alongside missing shards.

---

## 3. IMP-004 INTERACTION — guarantee not weakened

**Trace.** `main()` is untouched by the diff. Order of operations in `build_index.py:305-337`:

```
:310  failures = collect_papers(..., failures)
:311  if failures:
:312-315    logging.error("Refusing to write an index: ..."); return 1     <-- HARD FAIL
:319  if not records: return 1
:326-329  manifest, shard_files = build_shards(...)
:337  write_index(args.out_dir, manifest, shard_files)                     <-- only reached on success
```

`return 1` at `:315` is unconditional and precedes `write_index`. There is no `try`/`except`
around the call, no `finally`, no cleanup hook — **the hard-fail path provably cannot reach
`_clean_old_shards`**, because `_clean_old_shards` is only called from inside `write_index`
(`:275`) and `write_index` is only called at `:337`.

**"Is there any path where a partial failure deletes stale shards while leaving the old
manifest?" — NO.** Deletion is reachable only via `_clean_old_shards`, whose sole caller is
`write_index:275`, which is reachable only from `main:337`, which is reachable only when
`failures == []` **and** `records` is non-empty. Any failure before `:337` writes nothing
and deletes nothing. Confirmed empirically against a *pre-existing* deployed index
(stronger than the existing test, which only asserts an empty dir):

```
INFO:root:Querying cat:cs.CV (limit 100000) ...
INFO:root:  1 papers within retention window for cs.CV
INFO:root:Querying cat:cs.LG (limit 100000) ...
ERROR:root:  query failed for cs.LG: simulated outage (https://export.arxiv.org/api/query)
ERROR:root:Refusing to write an index: the arXiv query failed for cs.LG.
exit_code: 1
files before: ['index.json', 'papers-2026-W40.json']
files after : ['index.json', 'papers-2026-W40.json']
byte-identical (nothing written or deleted): True
```

**IMP-004 tests unmodified and still asserting what they did.**
`MainTests.test_refuses_to_write_index_when_a_category_query_fails`
(`tests/test_build_index.py:364-393`) is byte-identical to `HEAD` and still asserts
`exit_code != 0`, `os.listdir(out_dir) == []`, and the ERROR log naming `cs.LG`.
`MainTests.test_refuses_to_write_an_empty_index` (`:351-362`) likewise unmodified.
`CollectPapersTests` (4 tests, `:290-348`) unmodified — all failure-classification tests pass.
Verified independently by running `HEAD:scripts/*` + `HEAD:tests/*` (53 tests, OK) and
`HEAD:scripts/*` + new `tests/*` (55 tests, 1 failure, and that failure is the ordering test,
never an IMP-004 test).

---

## 4. STALE CLEANUP STILL WORKS

### 4a. Orphans do not accumulate (real run, real arXiv query)

```
$ rm -rf /tmp/rpf-verify-021
$ /usr/local/bin/python3.11 scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-verify-021
INFO:root:  20 papers within retention window for cs.CV
INFO:root:Wrote 20 papers across 1 shards to /tmp/rpf-verify-021
real 0m0.331s      EXIT=0
$ ls /tmp/rpf-verify-021
index.json  papers-2026-W40.json

$ printf '[]'          > /tmp/rpf-verify-021/papers-2019-W05.json
$ printf '{"weeks":[]}' > /tmp/rpf-verify-021/papers-2018-W01.json
$ ls  -> index.json papers-2018-W01.json papers-2019-W05.json papers-2026-W40.json
$ /usr/local/bin/python3.11 scripts/build_index.py ... --out-dir /tmp/rpf-verify-021   # run 2
INFO:root:Wrote 20 papers across 1 shards to /tmp/rpf-verify-021
$ ls  -> index.json  papers-2026-W40.json
```

Both planted orphans gone; the run's own shard survived the sweep (`keep` works).
Manifest/shard cross-check:

```
totalPapers: 20 shards: 1
   papers-2026-W40.json exists= True manifest_count= 20 on_disk= 20 match= True
ALL_RESOLVE: True
orphan shards on disk: []      MISSING: []
```

Run 2 is clean and leaves no orphans. `shards[].file` resolves for every entry and the
declared `count` equals the on-disk paper count.

### 4b. Can `keep=shard_files` delete a shard the CURRENT manifest references?

Constructed the two dangerous cases directly:

```
=== CASE B: file in keep but NOT in manifest ===
  kept-but-unreferenced survives: True
  on disk: ['index.json','papers-2024-W05.json']  manifest refs: ['papers-2024-W05.json']
  -> an extra unreferenced file. Harmless; no data loss; swept next run.

=== CASE C: file in MANIFEST but NOT in shard_files ===
  files: ['index.json','papers-2024-W05.json']
  manifest ref papers-2024-W07.json resolves: False
  caller contract (manifest refs == shard_files keys) holds: False
```

Case B is safe by construction. Case C *would* recreate the original bug — but it requires
`write_index` to be called with a manifest inconsistent with its `shard_files`, which no
code does. `build_shards` (`build_index.py:161-181`) appends to `shards` and assigns
`shard_files[filename]` in the **same loop iteration**, so the key sets are identical by
construction. Verified over 500 randomized record sets:

```
trials where manifest refs != shard_files keys: 0 /500
counts always agree: True
```

`main:326` is the only production caller and passes both values from one `build_shards` call.
Case C is a caller-contract hazard, not a live defect. See finding F-3 for the cheap guard.

### 4c. THE MAIN PROTECTED CASE — new build produces FEWER shards than the old

```
=== CASE A: 3 shards -> 1 shard ===
after old run: ['index.json','papers-2024-W01.json','papers-2024-W02.json','papers-2024-W03.json']
after new run: ['index.json','papers-2024-W03.json']
manifest refs: ['papers-2024-W03.json']
orphans W01/W02 deleted: True
every manifest ref resolves: True
```

Yes — the now-orphaned old shards are deleted, and the surviving manifest is consistent.
This is the case the ordering exists to protect, and it is correct. Under HEAD's
delete-first order the equivalent run would have deleted W03 too and then written it back,
leaving a window where the deployed manifest referenced three files with zero on disk
(row 1/2 of the table).

---

## 5. ARE THE NEW TESTS NON-VACUOUS? (own scratch copy, `/tmp/rpf-v021/head`)

Scratch: `git show HEAD:scripts/*.py` into `/tmp/rpf-v021/head/scripts`, new `tests/` copied in.

### Mutant A — full revert to HEAD code (`Ran 55 tests ... FAILED (failures=1)`)

```
test_deployed_shards_survive_a_failure_mid_write ... FAIL
AssertionError: False is not true      (tests/test_build_index.py:260)
test_same_week_shard_from_a_previous_run_is_kept ... ok
Ran 55 tests in 0.031s
FAILED (failures=1)
```

**ACTUAL COUNT: exactly 1 of the 2 new tests fails against HEAD.**

### Do they pin the ORDERING, or merely assert the files exist afterwards?

`test_deployed_shards_survive_a_failure_mid_write` **genuinely observes order.** It does not
merely check existence post-hoc — it injects a fault at a point that only exists if the shard
writes precede the sweep, and asserts both that the fault escaped (`assertRaises(OSError)`) and
that the pre-existing shard survived. Existence-only assertions would pass under the old order
(the shard is rewritten), which is exactly why this test injects a failure. It also asserts
*content* integrity (`:269-273`), not just presence, so a write-then-truncate would be caught.

### Mutant B — new order but `keep=shard_files` dropped (the "just move the line" half-fix)

```
FAIL: test_writes_manifest_and_removes_stale_shards (WriteIndexTests)
AssertionError: False is not true      (tests/test_build_index.py:225)
Ran 55 tests — FAILED (failures=2)
```

The pre-existing AC-3 test is load-bearing for the `keep` parameter, and
`test_same_week_shard_from_a_previous_run_is_kept` is the specific pin for it.

### Mutant C — manifest written BEFORE shards (the literal misreading of the title)

```
ERROR: test_deployed_shards_survive_a_failure_mid_write
Ran 55 tests — FAILED (errors=1)
```

### Mutant D — `shards -> sweep -> manifest` (sweep moved but not to the end)

```
Ran 55 tests in 0.053s
OK            <-- ALL 55 PASS
```

**This is the one real coverage gap.** See finding F-1: the suite does not constrain the sweep
to run *last*, and I proved that variant is genuinely unsafe:

```
MUT5 (shards->sweep->manifest), crash after sweep, manifest atomic:
  on-disk: ['index.json','papers-2024-W03.json']
  deployed manifest refs: ['papers-2024-W01.json','papers-2024-W02.json','papers-2024-W03.json']
  MISSING referenced shards: ['papers-2024-W01.json','papers-2024-W02.json']
  -> deployed site BROKEN (404 in loadShard): True
```

The shipped code is the safe variant; the *test* simply would not catch a future regression to
the unsafe one.

### Mutant E — `_clean_old_shards` raising after the manifest write (task §6)

```
raised: simulated kill during sweep
  files=['index.json','papers-2023-W52.json','papers-2024-W02.json','papers-2026-W40.json']
  manifest_refs=['papers-2023-W52.json','papers-2024-W02.json']
  MISSING(ref present,file absent)=[]
  UNPARSEABLE(ref present,broken)=[]
  SAFE (no manifest ref missing): True
```

On-disk state after this crash is **safe**: new manifest written, all shards it references
present and parseable, plus two leftover shards the interrupted sweep did not reach. The next
successful run cleans them (verified in the implementer's §4.6 and independently in §4a).

---

## 6. FULL SUITE

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
test_deployed_shards_survive_a_failure_mid_write (WriteIndexOrderingTests) ... ok
test_same_week_shard_from_a_previous_run_is_kept  (WriteIndexOrderingTests) ... ok
test_writes_manifest_and_removes_stale_shards    (WriteIndexTests) ... ok
----------------------------------------------------------------------
Ran 55 tests in 0.034s

OK
```

- **Baseline reproduced independently:** `HEAD:scripts/*` + `HEAD:tests/*` → `Ran 53 tests … OK`.
  So the delta is exactly **53 → 55**, as claimed.
- **All 53 pre-existing names survive.** Name-set diff:
  ```
  baseline names missing now: (empty)      <-- none lost
  added: test_build_index.WriteIndexOrderingTests.test_deployed_shards_survive_a_failure_mid_write
         test_build_index.WriteIndexOrderingTests.test_same_week_shard_from_a_previous_run_is_kept
  ```
- **Nothing weakened, skipped or deleted.** `git diff -U0 -- tests/ | grep -c '^-[^-]'` → `0`.
  No `@unittest.skip`, no `.skipTest`, no `expectedFailure`, no `assertAlmostEqual`-style
  loosening. The one behavioural assertion change in the whole file is *additive*.
- **Hermetic — proven, not assumed.** Suite re-run with every outbound connection blocked
  (`socket.socket.connect`, `connect_ex`, `create_connection`, `getaddrinfo` all replaced with
  a raiser, installed after imports):
  ```
  NETWORK-BLOCKED RUN: OK | tests: 55
  ```
  All URL strings in the tests are inert literals fed to `record_from_result`.
- **Fast and stable:** `0.034s / 0.030s / 0.033s` over three consecutive runs.

---

## 7. PYTHON VERSION COMPATIBILITY

`.github/workflows/ci.yml:14-15` → `python-version: "3.x"` (floating latest, setup-python v5).
No `python-version` matrix exists, so nothing version-pinned is introduced or relied upon.

The change adds one defaulted keyword parameter, one `set()` call, and one `if/continue`.
No walrus, no `match`, no PEP 604 `X | Y` annotations, no `dict | dict`, no
`removeprefix`, no `asyncio.to_thread` — valid on any Python 3.x, comfortably below CI's floor.
`python3.11 -m compileall -q scripts tests` → `COMPILEALL_EXIT=0`.
The new tests use only `tempfile`, `json`, `os`, `datetime` — all stdlib, all pre-3.0.

---

## 8. FINDINGS (none blocking)

### F-1 — the test suite does not pin that the sweep runs LAST (coverage gap, low)

`write_index` ordering is `shards -> manifest -> sweep`. Mutant D (`shards -> sweep -> manifest`)
passes **all 55 tests**, yet it is demonstrably unsafe (§5): on a shrink run plus a crash
between the sweep and the manifest, the deployed manifest references two deleted shards.
The current tests constrain *writes before sweep* but not *manifest before sweep*.

Suggested third test (would have failed Mutant D, passes today):

```python
def test_stale_shards_are_swept_only_after_the_manifest_is_written(self):
    # deployed: 3 shards + manifest referencing all 3
    # stub _clean_old_shards to assert index.json already lists the NEW shard
    # and to record os.listdir(out_dir) at sweep entry
    # then: assert manifest_on_disk_is_new and stale shards still present at entry
```

Cheap variant: wrap `build_index._clean_old_shards` and, inside the wrapper, assert the
on-disk `index.json` already parses and equals the manifest passed to `write_index`.

### F-2 — writes remain non-atomic (`PY-7`, out of scope, pre-existing, unchanged by this diff)

Both the manifest and each shard are written with `open(path, "w")` + `json.dump` — no temp
file, no `os.replace`. Injected ENOSPC after a partial flush:

```
raised: [Errno 28] No space left on device
  index.json bytes: '{\n  "totalPapers": 1,\n  "sha'
  index.json parses: FALSE -> JSONDecodeError Unterminated string starting at: line 3 column 3 (char 24)
  old shards still on disk: True True
```

Row 3 of the crash table. A same-ISO-week shard crash truncates a shard the live manifest
references (row 1). The spec's AC 1-3 ask only for ordering; this is `PY-7` and the implementer
disclosed it correctly in `impl-IMP-021.md` §5 rather than claiming a full fix. Worth noting:
**HEAD was worse in the same scenario** (truncated manifest *and* zero shards on disk), so this
is not a regression. `PY-7` should be claimed by a backlog item.

### F-3 — `write_index` trusts its caller that `manifest["shards"][*]["file"]` == `shard_files` keys (latent, low)

Case C in §4b: a mismatched caller gets its referenced shards swept. Unreachable today
(500/500 randomized trials agree; `build_shards` builds both in one loop; `main` is the only
caller). A two-line assertion at the top of `write_index` would close it permanently:
`assert {s["file"] for s in manifest["shards"]} == set(shard_files)`. Optional.

### Non-issues, explicitly cleared

- The AC-2 test patches `build_index.json.dump`, which *is* the stdlib `json` module attribute
  (process-global). Restored in a `finally` (`:259-261`); `unittest` runs serially; the
  network-blocked run above confirms no cross-test contamination.
- Duplicated shard-name regex (`build_index.py:162` writer, `:250` cleanup) is pre-existing
  profile trap 2 and untouched by this item.
- No `web/` file was read or written; no git write command was run by this verification.

---

## 9. COMMAND INDEX (all reproducible)

```bash
# baseline
cd /tmp/rpf-v021/base && /usr/local/bin/python3.11 -m unittest discover -s tests -v   # Ran 53, OK

# current
cd <repo> && /usr/local/bin/python3.11 -m unittest discover -s tests -v               # Ran 55, OK
/usr/local/bin/python3.11 -m compileall -q scripts tests                                # exit 0
git diff -U0 -- tests/ | grep -c '^-[^-]'                                             # 0
git diff --stat -- scripts/ tests/

# mutant A: HEAD code + new tests
cd /tmp/rpf-v021/head && /usr/local/bin/python3.11 -m unittest discover -s tests -v   # 1 failure

# real run
/usr/local/bin/python3.11 scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-verify-021
```

---

## 10. SCORECARD

| Requirement | Result |
| --- | --- |
| AC 1 — shards + manifest written before `_clean_old_shards` | **MET** |
| AC 2 — `json.dump` raises on shard write; old shards survive | **MET** (verbatim) |
| AC 3 — `test_build_index.py:189` unchanged and passing | **MET** |
| Ordering correct; no manifest ever references a missing shard | **CONFIRMED** — 0 missing across 6 injected crash states |
| No new crash window | **CONFIRMED** — one window closed, one strictly-better window opened |
| IMP-004 hard-fail not weakened; nothing written or deleted | **CONFIRMED** — deployed dir byte-identical, exit 1 |
| IMP-004 tests unmodified and still asserting | **CONFIRMED** — 0 removed lines |
| Stale/orphan deletion still works | **CONFIRMED** — planted orphans swept; 3→1 shrink correct |
| `keep` cannot delete a manifest-referenced shard | **CONFIRMED** for all reachable callers |
| New tests non-vacuous | **1 of 2** fails vs HEAD; that 1 genuinely pins ordering |
| All 53 baseline test names survive | **CONFIRMED** (0 lost, 2 added) |
| `Ran 55 tests … OK`, hermetic, fast | **CONFIRMED** — network-blocked run OK, ~0.03 s |
| No version-specific constructs | **CONFIRMED** — CI `3.x`, plain 3.x syntax |
| **VERDICT** | **PASS** (3/3 criteria; F-1 recommended, non-blocking) |