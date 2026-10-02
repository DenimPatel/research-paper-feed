# Discovered while implementing IMP-021

Found in passing while implementing `.improve/FEATURES.md:470` (`IMP-021`, write the manifest
before deleting stale shards). **Nothing here was fixed** — every item below is out of IMP-021's
scope. Line numbers are from `scripts/build_index.py` as of commit `fa4cbcb` plus the IMP-021 diff.

---

## D1 — `PY-7` is now the *only* remaining guard between a crash and a broken deployed index, and it is unowned

**Profile row:** `PY-7` (`REPO_PROFILE.md:780`) — "Non-atomic writes — a crash mid-`json.dump`
leaves a truncated `index.json`/shard on the static host".

IMP-021 closes the **deletion** half of `PY-8` but leaves the **truncation** half completely open.
After the reorder, the only remaining way a crash breaks the live site is a non-atomic write, and
that is the one defect with no item assigned to it. Measured, not assumed — a crash injected during
the write of a same-week shard (the normal case on a weekly deploy) leaves the deployed
`index.json` pointing at a 24-byte truncated shard:

```
crash: simulated kill during shard write
deployed index.json unchanged: True
referenced shard exists: True size: 24
referenced shard parses: False -> JSONDecodeError Unterminated string starting at: line 1 column 18 (char 17)
```

`web/src/lib/paperIndex.ts:105-110` catches only the HTTP failure and the
`Array.isArray(data.papers)` shape check, so a truncated shard surfaces as a raw parse error and —
per `WEB-02` — `Promise.all` discards **every** shard that did load. One bad week kills the whole
feed.

This is *not* a regression introduced by the reorder: before it, the same crash produced a deleted
file and an equally broken index (a 404). The reorder changed the symptom, not the class.

**Suggested scope for a future item:** write shards and `index.json` to a sibling
`.<name>.tmp` and `os.replace()` into position. Cheap, stdlib-only, and it retires `PY-7` outright.
Not attempted here because IMP-021's acceptance criteria ask only for ordering and the brief
explicitly forbids expanding scope.

---

## D2 — `PY-9` interacts with IMP-021's guarantee and will destroy it if implemented naively

**Profile row:** `PY-9` (`REPO_PROFILE.md:782`) — no error handling around `write_index`; an
unwritable `--out-dir` raises a raw `OSError` traceback.

IMP-021's ordering guarantee depends on a failure inside `write_index` **propagating** so that
nothing else is written afterwards. Today that holds, because `main()` (`build_index.py:326`) calls
`write_index` with no `try`/`except`, so the exception escapes and the process exits non-zero
without reaching `_clean_old_shards`.

If `PY-9` is implemented as `except OSError: logging.error(...); return 1`, the guarantee is
preserved. If it is implemented as `except OSError: logging.error(...); return 0`, or as a
`finally` that sweeps stale shards regardless, **the IMP-021 guarantee is silently voided** — a
failed write would still delete the shards the live manifest references.

**Suggested scope for whoever picks up PY-9:** make the "return 0 on write failure" form explicitly
forbidden in the item text, the same way IMP-023's criterion 4 explicitly forbids treating IMP-024's
landed `filter="data"` as a substitute. Noted now because the ordering fix is invisible to a future
reader of `main()`.

---

## D3 — Orphaned shards from a crashed run are swept only by the *next successful* run

After a mid-run crash the out-dir can contain shards no manifest references. The next successful
`write_index` does sweep them (verified: a 0-byte `papers-2024-W02.json` planted from a crash was
removed by a later run that wrote a different week). But a run that hard-fails on IMP-004's path
never calls `write_index` at all, so it sweeps nothing either — the orphans persist until a
successful deploy.

This is harmless (nothing reads `manifest.shards[]`, profile trap 2) and self-healing, so it is
informational only. Recorded because a verifier counting files in `web/public/data/` after a failed
deploy will see these and may read them as a bug in this item. They are not.

---

## D4 — `keep=()` is load-bearing for any future caller of `_clean_old_shards`

`_clean_old_shards(out_dir, keep=())` (`build_index.py:244-256`) is private with a single caller
today. The default is deliberately empty so a direct `_clean_old_shards(dir)` call still removes
everything, matching pre-IMP-021 behaviour. Any future second caller must pass `keep=`; there is no
test for the default-argument path specifically (the existing test at `tests/test_build_index.py:205`
exercises it only indirectly, through `write_index`). Low risk, but worth a test if a second caller
ever appears.

---

## Not reported, deliberately

- **Same-week shard overwrite semantics** — a redeploy reuses `papers-<week>.json` for a week that
  may already be deployed, so the new shard replaces the live one in place. Correct and desirable
  (it is what keeps the out-dir bounded), just worth knowing it is load-bearing rather than
  accidental.
- **`_result_datetime` / retention ordering** — those are `IMP-020`'s business, not observed here.