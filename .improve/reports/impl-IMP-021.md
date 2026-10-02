# IMP-021 — Write the manifest before deleting stale shards

**Status:** implemented
**Spec:** `.improve/FEATURES.md:470-484` (`### IMP-021`, TODO → now landed)
**Closes:** `PY-8` (`.improve/REPO_PROFILE.md:781`)
**Partially leaves open:** `PY-7` (`REPO_PROFILE.md:780`) — see §5, measured, not hand-waved.
**This was NOT a retry:** `.improve/reports/verify-IMP-021.md` did not exist at the time of writing.

---

## 1. Files changed

| File | Change |
| --- | --- |
| `scripts/build_index.py` | `_clean_old_shards` gained a `keep=()` parameter; `write_index` reordered so shards → manifest → sweep. 17 lines changed (3 of them docstring/comment). |
| `tests/test_build_index.py` | New `WriteIndexOrderingTests` class, 2 tests. Appended only — **no existing test was edited, moved, renamed or weakened.** |

Nothing else was touched. `web/` was not read from or written to; the `web/src/main.tsx`
modification and the untracked `web/src/ErrorBoundary.tsx`, `web/src/__tests__/errorBoundary.test.tsx`,
`web/src/__tests__/zzprobe.test.ts` visible in `git status` belong to the other agent working
`web/`, not to this change. No git write command was run. `.improve/FEATURES.md` untouched.

---

## 2. The ordering guarantee implemented

`write_index` (`scripts/build_index.py:259-278`) now executes in this order:

1. `os.makedirs(out_dir, exist_ok=True)`
2. write every new `papers-*.json` shard
3. write `index.json`
4. `_clean_old_shards(out_dir, keep=shard_files)` — **last**

Before: step 4 was step 1, i.e. delete-everything-then-write.

**Invariant this buys:** for the entire window in which this run can fail (steps 2 and 3), the
`index.json` sitting on disk is still the previously deployed one *and every shard it references
is still on disk*. The failure mode the spec names — a manifest pointing at shard files that no
longer exist, producing the `paperIndex.ts` 404 — is structurally unreachable from this function.

Because step 4 now runs after step 3, the sweep must not eat the shards it just wrote. Hence
`_clean_old_shards(out_dir, keep=())` (`:244-256`): the default `keep=()` preserves the old
behaviour exactly for any direct caller, and `write_index` passes `keep=shard_files` — the
`shard_files` dict is keyed by filename, so `set(keep)` is the set of just-written names.
Deletion is still gated on the same `re.fullmatch(r"papers-\d{4}-W\d{2}\.json", name)` regex and
the same `OSError`-swallowing `logging.warning`, so orphaned shards do not accumulate.

Stale-shard deletion is therefore **not** removed — it is moved, and it still runs on every
successful `write_index`. Measured in §4.

---

## 3. Interaction with IMP-004's hard-fail path

`main()` is untouched; the diff on `scripts/build_index.py` is confined to lines 244-278.
`write_index` is still called at `build_index.py:326`, which is unreachable when either guard
returns 1:

- `build_index.py:310-315` — a failed category query logs `Refusing to write an index: …` and returns 1.
- `build_index.py:317-319` — zero papers returns 1.

So on the IMP-004 path `write_index` is never entered and this change cannot emit a partial write.
The existing test `test_refuses_to_write_index_when_a_category_query_fails`
(`tests/test_build_index.py:304-330`) asserts `os.listdir(out_dir) == []` and still passes.

I additionally confirmed the stronger form ad-hoc (§4, check 6): when a **pre-existing** deployed
index is present, the hard-fail path leaves it byte-identical.

One coupling worth recording for whoever picks up PY-9 (`REPO_PROFILE.md:782`): the ordering fix
relies on a failure inside `write_index` **propagating out** so nothing further is written. That
is what happens today — `main()` has no `try`/`except` around `write_index`, so an `OSError`
escapes as a traceback with a non-zero exit. Wrapping `write_index` in a handler that swallowed
errors and returned 0 would destroy this guarantee; wrapping it in a handler that logs and returns
1 would preserve it. Not changed here (out of scope).

---

## 4. Every command run, with verbatim results

### 4.1 Baseline

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 53 tests in 0.036s
OK
```

### 4.2 After the change

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 55 tests in 0.038s
OK

$ /usr/local/bin/python3.11 -m compileall -q scripts tests
COMPILEALL_EXIT=0
```

**53 → 55 tests, all passing.** The 2 new tests are the only delta; no existing test was altered.

### 4.3 Non-vacuity — the new tests fail without the fix

Scratch copy under `/tmp` (`/tmp/rpf-imp021`, `scripts/` + `tests/` copied, `build_index.py`
replaced with `git show HEAD:scripts/build_index.py`, new tests retained):

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
FAIL: test_deployed_shards_survive_a_failure_mid_write (test_build_index.WriteIndexOrderingTests.test_deployed_shards_survive_a_failure_mid_write)
Traceback (most recent call last):
  File "/private/tmp/rpf-imp021/tests/test_build_index.py", line 260, in test_deployed_shards_survive_a_failure_mid_write
    self.assertTrue(os.path.exists(deployed))
AssertionError: False is not true
Ran 55 tests in 0.034s
FAILED (failures=1)
```

That is the old ordering deleting the deployed shard before the failing write — the exact 404 bug.

**Second mutation check.** With the *new* ordering but the `keep=shard_files` argument dropped
(the plausible half-fix "just move the line"), 2 tests fail:

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
test_deployed_shards_survive_a_failure_mid_write ... ok
test_same_week_shard_from_a_previous_run_is_kept ... FAIL
Ran 55 tests in 0.033s
FAILED (failures=2)
```

The second failure is `WriteIndexTests.test_writes_manifest_and_removes_stale_shards` at
`tests/test_build_index.py:205` (the AC-3 test, unmodified), which asserts
`papers-2024-W02.json` exists at `:225-227`. So AC 3 is load-bearing, and the new
`test_same_week_shard_from_a_previous_run_is_kept` is what pins the `keep` semantics specifically.
Note the honest reading: `test_same_week_shard_from_a_previous_run_is_kept` passes against the
*old* code (there, the file was deleted and then rewritten), so it is a regression guard for the
new order, not a reproduction of the original bug. Only the AC-2 test is a bug reproduction.

### 4.4 Spec verification method — two live runs into `/tmp/rpf-order`

`/tmp/rpf-venv` does **not** exist on this machine, so the spec's literal
`/tmp/rpf-venv/bin/python` could not be used. Substituted `/usr/local/bin/python3.11`, which
`REPO_PROFILE.md` §3.1 documents as the working interpreter (`arxiv 2.1.3`, `pandas 2.2.1`) and
which this task brief designates as authoritative. Same script, same flags.

```
$ rm -rf /tmp/rpf-order
$ /usr/local/bin/python3.11 scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-order
INFO:root:  20 papers within retention window for cs.CV
INFO:root:Wrote 20 papers across 1 shards to /tmp/rpf-order
=== after run 1 ===
index.json
papers-2026-W40.json
```

A stale shard was then planted and the run repeated:

```
$ printf '[]' > /tmp/rpf-order/papers-2019-W05.json
$ /usr/local/bin/python3.11 scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-order
INFO:root:Wrote 20 papers across 1 shards to /tmp/rpf-order
=== after run 2 ===
index.json
papers-2026-W40.json
```

`papers-2019-W05.json` is gone and `papers-2026-W40.json` survives — deletion still happens, and
the just-written shard is not swept. Exactly one shard plus `index.json`, as the spec asks.

### 4.5 Every `shards[].file` resolves

```
$ /usr/local/bin/python3.11 - <<'EOF'   # reads /tmp/rpf-order/index.json
totalPapers: 20 shards: 1
  papers-2026-W40.json: exists=True count=20 papers_on_disk=20
ALL_RESOLVE: True
```

### 4.6 Crash simulation against a real deployed directory

Copied `/tmp/rpf-order` to `/tmp/rpf-crash`, added a second referenced shard to `index.json`,
then made `json.dump` raise during the shard write:

```
crash simulated: simulated OOM kill
deployed manifest intact: True
every referenced shard still on disk: True
files present: ['index.json', 'papers-2023-W52.json', 'papers-2024-W02.json', 'papers-2026-W40.json']
```

`papers-2024-W02.json` is the half-written new shard: `open(..., "w")` truncates before `json.dump`
runs. It is **not** referenced by the deployed manifest, and the next successful run sweeps it —
verified with a distinct week so the sweep is unambiguous:

```
shard file this run wrote: ['papers-2024-W10.json']
files after run: ['index.json', 'papers-2024-W10.json']
stale orphan swept: True
every referenced shard resolves: True
```

### 4.7 IMP-004 hard-fail on a pre-existing deployed directory

```
INFO:root:Querying cat:cs.CV (limit 100000) ...
INFO:root:  1 papers within retention window for cs.CV
INFO:root:Querying cat:cs.LG (limit 100000) ...
ERROR:root:  query failed for cs.LG: simulated outage (https://export.arxiv.org/api/query)
ERROR:root:Refusing to write an index: the arXiv query failed for cs.LG.
exit_code: 1
deployed dir byte-identical after hard fail: True
files: ['index.json', 'papers-2026-W40.json']
```

No regression.

---

## 5. What is still broken after this change (residual, honest)

**`PY-7` is NOT fixed, and this fix does not fully close `PY-8`'s blast radius.** Writes are still
non-atomic — no temp file, no rename. `PY-7` is explicitly out of scope per the task brief
("ONLY if the spec asks for it"; the spec's AC 1-3 ask only for ordering), so I did not add it.

The ordering fix closes the *deletion* direction of `PY-8`: a deployed manifest can no longer
reference a shard that was deleted by this run. It does **not** close the truncation direction, and
it is worth being precise about the one case that is still broken, because it is measured, not
assumed. If a crash happens **during** the write of a shard whose filename already exists in the
deployed index (same ISO week — the normal case on a weekly deploy), `open(..., "w")` truncates
the live shard before `json.dump` fills it:

```
crash: simulated kill during shard write
deployed index.json unchanged: True
referenced shard exists: True size: 24
referenced shard parses: False -> JSONDecodeError Unterminated string starting at: line 1 column 18 (char 17)
```

So the deployed index is broken, just with a different symptom: a `JSONDecodeError` in
`loadShard` (`web/src/lib/paperIndex.ts:105`) instead of the `Failed to load … (HTTP 404)` it
produced before. Note this is **not a new regression introduced by the ordering change** — before
it, the same crash produced a deleted file and therefore also a broken deployed index (a 404).
The change moves the failure from "referenced shard missing" to "referenced shard truncated",
which is a strict improvement but not a fix. Closing it requires temp-file-plus-`os.replace`
writes for the shards and the manifest, i.e. `PY-7`, which no item currently owns.

---

## 6. Uncertain / for the verifier to check

1. **Scope judgement.** I added `keep=()` with a default so the sweep skips the just-written names.
   The spec did not name a mechanism, only the order. `PY-8`'s profile row cites
   `build_index.py:224-232` for `_clean_old_shards`; that function had to change for the reordering
   to be correct at all, since an unfiltered sweep after the writes would delete the run's own
   output. A verifier who reads AC 1 as "relocate the call and nothing else" should know this is
   the minimum extra step, and that the pre-existing test at `tests/test_build_index.py:205`
   independently forces it (§4.3).
2. **Test patching style.** The AC-2 test patches `build_index.json.dump`, which *is* the stdlib
   `json` module's `dump` attribute — process-global for the duration. It is restored in a `finally`,
   and `unittest` runs serially, so nothing else observes the patched window. The repo has no
   precedent either way (`tests/` uses plain save/restore with `try`/`finally`, never
   `unittest.mock`), so I matched the existing style rather than introducing `mock`.
3. **`json.dump` seeding order.** The AC-2 test seeds its fixture files with `json.dump` *before*
   installing the failing stub. Reordering those two blocks would make the test vacuous (it would
   fail during setup, not inside `write_index`).
4. **Python compatibility.** CI is `python-version: "3.x"` (`.github/workflows/ci.yml:15`), i.e.
   floating latest, so I avoided 3.10+ syntax entirely. The change adds one defaulted parameter and
   one `set()` call — valid on 3.6+. Verified locally on 3.11.0 only; I did not test other
   interpreters.
5. **Unchanged by design.** The shard-filename regex remains duplicated at `build_index.py:162`
   (`f"papers-{week}.json"`) and `:250` (the cleanup regex) — profile trap 2. Not this item.
6. **`readme.md` / `CONTRIBUTING.md`:** no flag, default or command changed, so no doc update is
   required (profile §4.5 not triggered).