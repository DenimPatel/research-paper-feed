# Discovered while implementing IMP-151 — NOT fixed

Found while fixing `IMP-151` (the `"__proto__"` / `id in papers` membership bug in
`web/src/lib/collections.ts`). These are **outside IMP-151's acceptance criteria** and outside my
permitted file set, so I reported them rather than fixing them. None is a regression from my change.

---

## D-1 — `loadState` accepts a storage key that disagrees with the paper's own `id`

**Where:** `web/src/lib/collections.ts:289-296`.

```ts
for (const [id, paper] of Object.entries(parsedPapers as Record<string, unknown>)) {
  if (!PROTOTYPE_KEYS.has(id) && isPaper(paper)) {
    papers[id] = paper;
  }
}
```

The loop trusts the **record key** and ignores `paper.id`. `rpf.papers.v1` holding
`{"foo": {"id": "bar", …}}` produces `state.papers.foo` containing a paper whose `paper.id` is
`"bar"`. Consequences:

- `mergeImport` merges by `paper.id` while `loadState` keys by the storage key, so a paper saved in
  one session can be duplicated under two keys in the next.
- `exportCollection` (`collections.ts:229-234`) emits `papers: [{id: "bar"}]` inside a collection
  whose ids reference `"foo"`; re-importing that file drops the paper at AC3's own filter, because
  `"foo"` has no own snapshot under key `foo`.
- The paper is only reachable from a UI at `collections.ts:215` / `CollectionsView.tsx:42`, which
  look up by `paperIds`, so the *user* sees it disappear after an export/import round trip with no
  error anywhere.

**Suggested fix:** require `paper.id === id`, or re-key on `paper.id`, in the `loadState` loop.
Pre-existing, unrelated to prototype keys.

---

## D-2 — `CollectionsView.tsx:42` dereferences an unvalidated `state.papers[id]`

**Where:** `web/src/components/CollectionsView.tsx:42`.

```ts
const papers = collection.paperIds
  .map((id) => state.papers[id])
  .filter((paper): paper is NonNullable<typeof paper> => Boolean(paper));
```

After IMP-151 this is safe **only because its producer** (`mergeImport` / `loadState`) now filters on
own-key membership. Nothing at the point of use defends it. If any future code path ever adds a
`paperIds` entry without an own snapshot, the inherited value flows straight into `PaperCard` and
`paper.abstract.length` throws — the exact crash IMP-151 just fixed, one layer up.

This is the same defence-in-depth argument as profile WEB-07 ("no error boundary → white page"). A
one-line `hasOwnKey` filter here would make the invariant locally checkable. It needs a new
`web/src/components/__tests__/CollectionsView.test.tsx` to keep the repo's 1:1 test mirror, which is
why I did not do it here.

---

## D-3 — `PaperCard` has no guard against a non-`Paper` snapshot

**Where:** `web/src/components/PaperCard.tsx:50` and `:56` — `paper.abstract.length`.

The component destructures nothing and trusts its `Paper`-typed prop. Profile WEB-07 records this
pattern for shard data. IMP-151 closed the one *reachable* route to a bad value, but
`isPaper`/`hasSafeUrls` exist precisely because snapshots are untrusted, and the component is the
last line of defence with none. A defensive read (or an error boundary, which is profile item
IMP-018) would convert any future regression of this class from "permanently blank page until the
user clears localStorage" into a degraded card.

---

## D-4 — Profile §4.2 and PE-13 / INF-08 are stale about component testing

`REPO_PROFILE.md:219-223`, PE-13 (§7), and INF-08 (§9) all state that component tests are
"structurally impossible today", citing `vite.config.ts:8-9` with `environment: "node"` and
`include: ["src/**/*.test.ts"]`. **That is no longer true.** `vite.config.ts:8-9` now reads:

```ts
environment: "jsdom",
include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
setupFiles: ["src/test-setup.ts"],
```

and `web/src/test-setup.ts` plus `web/src/__tests__/domEnvironment.test.tsx` (3 tests) exist. The
baseline is therefore **60 tests across 5 files**, not the "3 files, 36 tests" of §3.3 — which is why
IMP-151's own criterion 5 predicts "4 files, 40+ tests" and both numbers are now out of date.

Anyone re-verifying with those figures will conclude the repo is broken when it is not. The profile
should be updated. (IMP-151 changed nothing here; I only measured the current state.)