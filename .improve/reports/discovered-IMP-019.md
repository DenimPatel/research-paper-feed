# IMP-019 — discovered issues (found, NOT fixed)

Reported by the IMP-019 implementer. Per the task boundary, none of these were
fixed; each needs its own item or a decision from the coordinator.

---

## D-1 — `Paper.updated` has the same type lie IMP-019 just fixed, and it is
## *more* reachable than the three fields that were

**Severity: low (no current consumer). Confidence: high — read from source.**

`IMP-019` widened `primaryCategory`, `absUrl` and `pdfUrl` to `string | null`
because `record_from_result` reads them with `getattr(result, …, None)`. The
same function has the identical shape two lines earlier, and it was left behind:

- `scripts/build_index.py:117` — `"updated": iso_date(getattr(result, "updated", None))`
- `scripts/build_index.py:84-87` — `iso_date()` opens with
  `if value is None: return None`, so a missing/None `updated` becomes JSON
  `null`, not a missing key.
- `web/src/lib/types.ts:8` — declares `updated: string`.

**Why it is more reachable than the three fields that were fixed:**
`build_shards` (`scripts/build_index.py:155-157`) skips any record whose
`published` is falsy, so a `published: null` can never reach a shard. There is
no equivalent filter for `updated`. A record with a good `published` and an
absent `updated` is written into the shard with `"updated": null`.

**Why it has not caused visible damage:** `updated` has **zero read sites** in
`web/src` (verified — `rg -n "\.updated" src --glob '!**/__tests__/**'` returns
no matches; this is also the known `WEB-11` row in `.improve/REPO_PROFILE.md`,
"written but never read"). Nothing dereferences it, so a `null` there is inert
today. It is a latent lie of exactly the kind IMP-019 existed to remove, and it
becomes a real crash-in-render the moment someone reads the field.

**Suggested fix** (own item, not applied here): widen `updated` to
`string | null` in `web/src/lib/types.ts:8`. `published` should be left as
`string` — `build_shards` already guarantees it is present and truthy before a
record is sharded, and `isPaper` (`collections.ts:98`) requires a string, which
is the correct gate. Note this is the one field where the two stacks disagree in
the *safe* direction, so it deserves a comment saying so rather than a blind
mirror of the other three.

---

## D-2 — `isPaper`'s null tolerance is now split across two styles, and the
## asymmetry is unexplained

**Severity: informational. Confidence: high — observed in the shipped diff.**

`collections.ts:99-101` now reads

```ts
(typeof paper.primaryCategory === "string" ||
  paper.primaryCategory === null) &&
```

which is a *tolerance* — `undefined` still rejected, explicit `null` accepted.

`hasSafeUrls` (`collections.ts:116-121`) uses a *different* idiom for the same
distinction:

```ts
(url) => url == null || isHttpUrl(url)
```

which tolerates `null` **and** `undefined`, because for the URL fields an absent
key is genuinely as reachable as a `null` one (the import payload is a
hand-written file; the existing IMP-001 criterion 1 relies on this).

The two are not interchangeable, and nothing in the file says why. A future
reader who sees the `=== null` form in `isPaper` and the `== null` form in
`hasSafeUrls` has no signal about which is deliberate. Worth a one-line comment
on each the next time either is touched. I did **not** "normalise" them: the
difference is load-bearing (`collections.test.ts` has both an `absUrl: null`
kept case and a `primaryCategory`-absent dropped case), and normalising would
have changed behaviour.
