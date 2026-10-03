# IMP-037 — Add a component render smoke test

**Status:** implemented. One new file, no source or config change.

```
web/src/components/__tests__/PaperCard.test.tsx   (new, 41 lines, 1 test)
```

## 1. The test

Full contents of the new file:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Paper } from "../../lib/types";
import { PaperCard } from "../PaperCard";

/**
 * The shape `record_from_result` (`scripts/build_index.py:121-138`) emits, with
 * nothing nulled out and no extra fields: a card cannot be rendered from
 * anything less, and the mirror convention puts this suite beside the component
 * it covers rather than in `src/__tests__/`.
 */
const FIXTURE: Paper = {
  id: "2401.00001",
  title: "A Minimal Paper",
  authors: ["Ada Lovelace"],
  abstract: "A short abstract that needs no expansion.",
  abstractTruncated: false,
  published: "2024-01-02",
  updated: "2024-01-03",
  categories: ["cs.CV"],
  primaryCategory: "cs.CV",
  absUrl: "https://arxiv.org/abs/2401.00001",
  pdfUrl: "https://arxiv.org/pdf/2401.00001",
};

describe("PaperCard", () => {
  it("links the title to absUrl and renders the publication date", () => {
    const { container } = render(<PaperCard paper={FIXTURE} />);

    const titleLink = screen.getByRole("link", { name: FIXTURE.title });
    expect(titleLink.getAttribute("href")).toBe(FIXTURE.absUrl);

    // `formatDate` returns `toLocaleDateString(undefined, …)`, so the visible
    // wording follows the runner's locale; the `dateTime` attribute is the
    // machine-readable half and the text only has to be there.
    const published = container.querySelector("time");
    expect(published).not.toBeNull();
    expect(published?.getAttribute("dateTime")).toBe(FIXTURE.published);
    expect(published?.textContent).toContain("2024");
  });
});
```

**The fixture.** All eleven `Paper` fields from `web/src/lib/types.ts:1-24`, nothing nulled, no
extra keys — `Paper` has three `string | null` fields (`primaryCategory`, `absUrl`, `pdfUrl`,
`types.ts:21-23`) and a fixture that omits or nulls any of them would exercise the
`safeHref`/`tag--primary` branches instead of the plain render this item asks for. `paperCardNullUrls.test.tsx`
already owns every null combination (7 tests); duplicating them here would be noise.

**Style.** Imports, fixture shape and assertion idiom imitate the two neighbouring suites:
`src/__tests__/domEnvironment.test.tsx` (module-level `const FIXTURE: Paper`, `render` + `screen`
from RTL, `expect(x).toBeTruthy()` — no `jest-dom` matchers, which is correct: `@testing-library/jest-dom`
is not a dependency) and `src/__tests__/paperCardNullUrls.test.tsx` (same component, same `Paper`
literal). Two-space indent, double quotes, semicolons, `describe`/`it`, `expect` from vitest.

**Why `dateTime` and not the visible string.** `PaperCard.formatDate` (`PaperCard.tsx:20-30`) calls
`new Date(\`${value}T00:00:00Z\`).toLocaleDateString(undefined, …)` with **no `timeZone` option**, so
the rendered text is both locale- and host-timezone-dependent — on this machine (`America/New_York`)
a `published` of `2024-01-02` renders as `Jan 1, 2024`. Asserting the literal `"Jan 2, 2024"` would
have made the test fail on half the planet, so the assertion targets the machine-readable
`<time dateTime>` (which is what `formatDate`'s caller writes, `PaperCard.tsx:85`) and only requires
that visible text exists and carries the year. The timezone defect itself is **not fixed** here — it
is written up in `discovered-IMP-037.md`.

## 2. Counts — before and after

Both measured with `npm test` from `web/`, same machine, same working tree otherwise.

| | `Test Files` | `Tests` |
| --- | --- | --- |
| **before** (no new file) | `19 passed (19)` | `292 passed (292)` |
| **after** | `20 passed (20)` | `293 passed (293)` |

Exactly +1 file, +1 test. Verbatim summary lines:

```
# before
 Test Files  19 passed (19)
      Tests  292 passed (292)
   Duration  6.73s (transform 1.02s, setup 3.16s, collect 2.06s, tests 12.12s, environment 14.96s, prepare 1.65s)

# after
 ✓ src/components/__tests__/PaperCard.test.tsx (1 test) 161ms
 Test Files  20 passed (20)
      Tests  293 passed (293)
   Duration  7.66s (transform 608ms, setup 3.09s, collect 1.45s, tests 12.68s, environment 16.50s, prepare 1.41s)
```

The item's spec says "one more test file and one more test than the **36-test baseline**" and its
verification method predicts "4 files, 37 tests". Both figures were written when the suite was 3 files
/ 36 tests and were already stale on arrival (the suite was 19 files / 292 tests before this change).
The acceptance criterion is relative — "+1 file, +1 test" — and that is what is reported above. No
number in the spec was trusted over what the runner printed.

## 3. Commands run, with results

| Command (from `web/`) | Result |
| --- | --- |
| `npm test` (before) | 19 files / 292 tests passed, exit 0 |
| `npm test` (after) | **20 files / 293 tests passed**, exit 0 |
| `npm run typecheck` | exit 0, no output (`tsc --noEmit`) |
| `npm run build` | exit 0 — `Paper index present: public/data/index.json with 5 shard(s).`, `✓ 41 modules transformed.`, `dist/assets/index-DLsgZ6xw.css 10.91 kB │ gzip: 2.86 kB`, `dist/assets/index-Cz853rdl.js 172.50 kB │ gzip: 55.22 kB`, `✓ built in 541ms` |
| `git status --porcelain` (repo root) | `?? web/src/components/__tests__/` — one untracked path, nothing else |

`web/public/data/` already held a 5-shard index on this checkout, so `npm run build`'s middle gate
(`scripts/require-index.mjs`) exercised its success path rather than the refusal path.

## 4. Non-vacuity experiment

Required, and run twice — once per assertion — because an assertion that cannot fail is worse than
no assertion. Both breaks were made in **this** working copy and reverted immediately after.

### Break A — the `href` assertion pointed at the wrong fixture field

`expect(titleLink.getAttribute("href")).toBe(FIXTURE.pdfUrl)` (a realistic copy/paste slip: `absUrl`
and `pdfUrl` are adjacent fixture fields and the card renders *both* links, so a wrong-field
assertion would pass silently if the assertion were `toBeTruthy()`).

```
⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/components/__tests__/PaperCard.test.tsx > PaperCard > links the title to absUrl and renders the publication date
AssertionError: expected 'https://arxiv.org/abs/2401.00001' to be 'https://arxiv.org/pdf/2401.00001' // Object.is equality

Expected: "https://arxiv.org/pdf/2401.00001"
Received: "https://arxiv.org/abs/2401.00001"

 ❯ src/components/__tests__/PaperCard.test.tsx:31:44
     29|
     30|     const titleLink = screen.getByRole("link", { name: FIXTURE.title })…
     31|     expect(titleLink.getAttribute("href")).toBe(FIXTURE.pdfUrl);
       |                                            ^
     32|
     33|     // `formatDate` returns `toLocaleDateString(undefined, …)`, so the…

 Test Files  1 failed | 19 passed (20)
      Tests  1 failed | 292 passed (293)
```

The failure names both URLs and points at line 31 — it distinguishes the card's title link from its
PDF link, which is the whole point of the assertion.

### Break B — the date assertion asked for a year the card does not render

`expect(published?.textContent).toContain("1999")`:

```
⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/components/__tests__/PaperCard.test.tsx > PaperCard > links the title to absUrl and renders the publication date
AssertionError: expected 'Jan 1, 2024' to contain '1999'

Expected: "1999"
Received: "Jan 1, 2024"

 ❯ src/components/__tests__/PaperCard.test.tsx:39:36
     37|     expect(published).not.toBeNull();
     38|     expect(published?.getAttribute("dateTime")).toBe(FIXTURE.published…
     39|     expect(published?.textContent).toContain("1999");
       |                                    ^
     40|   });
     41| }

 Test Files  1 failed | 19 passed (20)
      Tests  1 failed | 292 passed (293)
```

The `Received:` line is the discovery referred to in §1: the card renders **`Jan 1, 2024`** for
`published: "2024-01-02"` on this host. That is not a test bug — `formatDate` formats a UTC-anchored
timestamp in the local timezone — and it is exactly why this test does not hardcode the visible date.
Filed in `discovered-IMP-037.md`, not fixed.

### Restored, green again

```
 ✓ src/components/__tests__/PaperCard.test.tsx (1 test) 201ms
 Test Files  20 passed (20)
      Tests  293 passed (293)
typecheck exit=0
```

One later edit followed the experiment and re-verified the same way: the fixture docblock's line
cite for `record_from_result` was wrong when first written (`build_index.py:102-114`, which is
`iso_date`) and was corrected to `:121-138` after reading the file. The counts above are post-correction.

**The broken version is not in place.** The file on disk is the green version quoted in §1; the final
`npm test` / `npm run typecheck` / `npm run build` runs in §3 are all against it.

## 5. Constraints honoured

- **No new dependency.** `web/package.json` and `web/package-lock.json` are untouched (`git status`
  shows only the new test directory). `@types/node` was not added; the test uses only vitest, RTL and
  `DOM`/`Element` APIs, all of which resolve through `tsconfig.json`'s `"types": ["vite/client"]`.
- **`web/vite.config.ts` untouched.** Its `include` already carries `src/**/*.test.tsx`, so
  `src/components/__tests__/PaperCard.test.tsx` is collected by an existing glob — confirmed by the
  runner reporting the file by path. The `scripts/**/*.test.mjs` glob and IMP-212's concern with it
  are unaffected.
- **No `npm run lint` added.** There is no linter in this repo; `npm run typecheck` is the substitute.
- **`web/tsconfig.json` untouched** — `include: ["src", "vite.config.ts"]` already covers the new file
  (it lives under `src/`), so no tsconfig change was needed or made.
- **No source file changed.** `PaperCard.tsx` is exactly as it was; this item is a test only.
- `.improve/FEATURES.md` was not touched (another agent owns it).

## 6. Uncertain / not verified

- **The item's premise is stale.** It says "Today zero component behavior is testable" and depends on
  IMP-005 having just landed. In fact IMP-005 landed long ago and 120 component/DOM tests already
  exist, including 7 against this exact component. The *action* is still worth doing (a 1:1 mirror
  file per component is a convention the other three components still lack — `CollectionsView.tsx`,
  `FeedControls.tsx`, `PaperList.tsx` have no `components/__tests__/` sibling), but this does not
  establish a DOM environment that had not been established.
- **A new test-file location now exists.** `web/src/components/__tests__/` is the third web test
  directory; `REPO_PROFILE.md` §5.3 and `CONTRIBUTING.md:85` both enumerate only
  `web/src/lib/__tests__/` and `web/src/__tests__/`. The item mandates this path, so I used it, and
  filed the docs gap in `discovered-IMP-037.md` rather than editing docs outside this item.
  `CONTRIBUTING.md:7` ("`web/src/**/__tests__/`") already covers the new path.
- **Single test only.** AC-3 pins the file count at +1 test, so this file deliberately holds one `it`
  covering both required assertions. Someone reading the file cold may expect more of a "smoke test
  suite"; the intent was a foundation check, and the deeper `PaperCard` behaviour (abstract
  truncation, save menu, `safeHref`) is already owned elsewhere.
- **Only the host timezone was exercised.** The `dateTime` assertion is timezone-independent, and the
  text assertion is year-only, so the test should hold under any `TZ`; I verified only on
  `America/New_York` (EDT, −04:00). Running the suite under `TZ=Asia/Tokyo` and `TZ=UTC` would be a
  cheap extra confirmation but was not run.