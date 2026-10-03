#!/usr/bin/env python3
"""Integrity check for `.improve/FEATURES.md`.

FEATURES.md was corrupted once: a script split it with
`re.split(r'\n(?=### IMP-)', txt)` and rejoined with `"".join(...)`, which
**consumes** the newline and glued 208 item headings together. This checker
exists so that any future edit can prove it did not do that again.

What it asserts, and the number to compare against:
  * item headings `^### IMP-<id>`            == 223
  * unique ids among those headings         == 223
  * every item block carries all 12 fields
  * the split used here is zero-width, so rejoining with `"".join` is safe:
      re.compile(r'(?m)^(?=### IMP-)')   consumes nothing
    The old pattern `r'\n(?=### IMP-)'` consumes one newline and is the bug.

Usage:
    python3 check_features.py                       # check the working copy
    python3 check_features.py --against HEAD:.improve/FEATURES.md
"""
import argparse
import re
import subprocess
import sys

FIELDS = [
    "Status",
    "Category",
    "Type",
    "Area / files",
    "Intent",
    "Acceptance criteria",
    "Verification method",
    "Effort",
    "Risk",
    "Depends on",
    "Priority score",
    "Notes",
]

# Zero-width: matches the position before a heading, consumes nothing.
SPLIT = re.compile(r"(?m)^(?=### IMP-)")
HEADING = re.compile(r"^### (IMP-\d+[a-z]?)\b", re.M)
EXPECTED_ITEMS = 223


def load(path=None, spec=None):
    if spec:
        ref, _, p = spec.partition(":")
        return subprocess.run(
            ["git", "show", f"{ref}:{p}"], capture_output=True, text=True, check=True
        ).stdout
    if path:
        return open(path, encoding="utf-8").read()
    return open(".improve/FEATURES.md", encoding="utf-8").read()


def check(text, label):
    ids = HEADING.findall(text)
    blocks = SPLIT.split(text)
    # blocks[0] is the preamble before the first heading.
    item_blocks = [b for b in blocks if b.startswith("### IMP-")]

    problems = []
    if len(ids) != EXPECTED_ITEMS:
        problems.append(f"item headings: {len(ids)}, expected {EXPECTED_ITEMS}")
    if len(set(ids)) != len(ids):
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        problems.append(f"duplicate ids: {dupes}")
    if len(item_blocks) != len(ids):
        problems.append(
            f"zero-width split produced {len(item_blocks)} blocks for {len(ids)} "
            "headings -- a heading was glued to the previous item"
        )

    missing = {}
    for b in item_blocks:
        i = HEADING.match(b).group(1)
        absent = [f for f in FIELDS if f"**{f}:**" not in b]
        if absent:
            missing[i] = absent
    if missing:
        problems.append(f"items missing fields: { {k: v for k, v in list(missing.items())[:5]} }")

    glued = [i for b in item_blocks for i in HEADING.findall(b)[1:]]
    if glued:
        problems.append(f"blocks containing more than one heading: {glued[:5]}")

    print(f"--- {label} ---")
    print(f"  bytes                     : {len(text.encode())}")
    print(f"  item headings             : {len(ids)}")
    print(f"  unique ids                : {len(set(ids))}")
    print(f"  zero-width split blocks   : {len(item_blocks)}")
    print(f"  fields required per item  : {len(FIELDS)}")
    print(f"  items missing any field   : {len(missing)}")
    for i, absent in list(missing.items())[:10]:
        print(f"      {i}: {absent}")
    if problems:
        print("  RESULT: FAIL")
        for p in problems:
            print(f"      - {p}")
        return False
    print("  RESULT: OK")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--path")
    ap.add_argument("--against", help="git ref:path, e.g. HEAD:.improve/FEATURES.md")
    a = ap.parse_args()
    ok = True
    if a.against:
        ok &= check(load(spec=a.against), f"against {a.against}") and ok
    ok &= check(load(path=a.path), a.path or ".improve/FEATURES.md")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()