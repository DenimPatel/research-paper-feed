# IMP-005b — remove unused `@testing-library/user-event`

Follow-up to `impl-IMP-005.md`, addressing the §8.1 finding of `verify-IMP-005.md`:
`@testing-library/user-event@^14.6.7` was installed but imported nowhere in the repo.

## 1. Premise check

Before changing anything, repo-wide search for `user-event`:

```
grep -rn "user-event" --include="*.ts" --include="*.tsx" --include="*.js" \
  --include="*.jsx" --include="*.json" --include="*.md" --include="*.py" .
```

Hits were confined to `web/node_modules/**` (the package's own source/README),
`web/package.json`, `web/package-lock.json`, and the `.improve/reports/*.md`
prose describing the finding. **Zero** source imports. Finding confirmed.

## 2. Command run

```
cd web && npm uninstall --save-dev @testing-library/user-event
#→ removed 1 package, and audited 149 packages in 706ms
```

## 3. Exact changes

### `web/package.json`

One line removed from `devDependencies`:

```diff
   "devDependencies": {
     "@testing-library/react": "^16.3.3",
-    "@testing-library/user-event": "^14.6.7",
     "@types/react": "^18.3.12",
```

### `web/package-lock.json`

Two hunks, both mechanical npm output:

1. The mirrored `packages[""].devDependencies` line, as above.
2. The entire `node_modules/@testing-library/user-event` entry (14 lines)
   — `version`, `resolved`, `integrity`, `"dev": true`, `license`,
   `engines`, and the `peerDependencies` block on `@testing-library/dom`.
   Its peer dep `@testing-library/dom` is retained: `@testing-library/react`
   depends on it directly, so it is not orphaned.

No other line of either file changed. No reformatting. No dependency added.

Resulting `devDependencies`:

```
"@testing-library/react": "^16.3.3",   ← retained
"@types/react":          "^18.3.12",
"@types/react-dom":      "^18.3.1",
"@vitejs/plugin-react":  "^4.3.4",
"jsdom":                 "^29.1.1",     ← retained
"typescript":            "^5.6.3",
"vite":                  "^5.4.11",
"vitest":                "^2.1.8"
```

All specifiers remain caret-prefixed, matching the file's existing style.
`jsdom` and `@testing-library/react` are both still present, untouched.

## 4. Verification results

Baseline captured before the uninstall: 42 tests / 4 files.

| # | Command | Exit | Result |
|---|---------|------|--------|
| 1 | `npm run typecheck` | `0` | clean, no diagnostics |
| 2 | `npm test` | `0` | **4 files passed, 42 tests passed** — unchanged from baseline |
| 3 | `npm run build` | `0` | 38 modules, built in 394ms |
| 4 | `npm audit` | `1` | **5 vulnerabilities (3 moderate, 1 high, 1 critical)** — identical to baseline |
| 5 | `npm ci --dry-run` | `0` | "up to date" — lockfile consistent |

Test breakdown (unchanged):

```
 ✓ src/lib/__tests__/collections.test.ts    (16 tests)
 ✓ src/lib/__tests__/search.test.ts         (12 tests)
 ✓ src/lib/__tests__/paperIndex.test.ts     (11 tests)
 ✓ src/__tests__/domEnvironment.test.tsx     ( 3 tests)
 Test Files  4 passed (4)
      Tests  42 passed (42)
```

`npm audit` exit `1` is expected and is *not* a regression — npm exits non-zero
whenever any advisory is present. The baseline had the same exit and the same
counts. All five advisories remain dev-only, on `vitest`/`@vitest/mocker`,
`vite`/`vite-node`, and `esbuild`.

Two corroborating signals that nothing depended on the removed package:

- `grep -c user-event` → `0` in both `package.json` and `package-lock.json`;
  `node_modules/@testing-library/` now contains only `dom` and `react`.
- The production bundle hash is byte-identical to the one recorded in
  `verify-IMP-005.md`: `dist/assets/index-CzjWDLvR.js`. Same hash ⇒ the
  emitted application code is unchanged by the removal.

## 5. Scope

Only `web/package.json` and `web/package-lock.json` were modified. `git status
--porcelain` is byte-for-byte the same file set as before this task (the other
entries predate it and belong to IMP-002/004/005). `web/dist` is covered by
`web/.gitignore:5`, so the rebuild left no stray artifacts. No `scripts/`,
`tests/`, or `.improve/FEATURES.md` edits. No git write commands were issued.

## 6. Outcome

`@testing-library/user-event` is gone from the manifest and the lockfile.
IMP-005's actual intent — a working jsdom + React Testing Library component
test — is fully intact: `domEnvironment.test.tsx` still passes its 3 tests and
42 tests pass repo-wide. Removing the unused package reduced the dependency
surface with no behavioural change and no new advisories.