# Discovered while implementing IMP-001

Out of scope for IMP-001 — recorded, not fixed.

## D-1 — The live index emits `http://` arXiv URLs, not `https://`

- **File:** `scripts/build_index.py:111` (`"absUrl": getattr(result, "entry_id", None)`)
- **Description:** `absUrl` is taken verbatim from `arxiv.Result.entry_id`, which the arXiv
  API returns as `http://arxiv.org/abs/<id>v1`, so every paper card in the deployed feed
  links over plaintext http. IMP-001's `isHttpUrl` accepts `http://` and `https://`
  precisely because of this — a strict https-only check would strip the link from all
  50 visible cards. Verified in the running app: 50/50 cards have `http://arxiv.org/abs/...`
  hrefs while `pdfUrl` is already `https://`.
- **Why not fixed here:** the spec for IMP-001 requires both schemes, and rewriting the
  producer's URL scheme belongs to the Python/`types.ts` items (IMP-019 touches
  `types.ts`), not to a security fix in the import path.

## D-2 — Playwright MCP screenshot paths are mangled for dot-directories

- **File:** (tooling, not the repo) `.playwright-mcp/` created in the repo root by
  `playwright_browser_take_screenshot`
- **Description:** passing `filename: ".improve/artifacts/IMP-001/foo.png"` writes to
  `.playwright-mcp/-improve-artifacts-IMP-001-foo.png` — the leading `.` is stripped and the
  path is flattened into `.playwright-mcp/`. An absolute `/tmp/...` filename is mangled the
  same way. Every implementer doing a visual check will hit this and must move the file
  afterwards, and `.playwright-mcp/` must be deleted or it dirties the tree.
