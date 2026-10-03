#!/usr/bin/env python3
"""Aggregate the IMP-225 capture corpus into the distributions the report quotes.

Groups are declared explicitly by capture-label prefix so the output cannot
silently change because a glob matched something new. Every group is internally
comparable (one pixel grid); cross-grid and cross-environment pairs are
reported separately, because a tolerance derived from a pool that mixes them
would be meaningless.

    python3 aggregate.py --dir /tmp/imp225/runs
"""
import argparse
import glob
import os
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pngdiff import compare  # noqa: E402

# (label, [capture-label prefixes], note)
WITHIN = [
    ("W1 desktop 1280x900 dsf=1 HEADLESS",
     ["E1-headless-dsf1", "E3-headless-s", "F2-headless-pinned"],
     "6 in one browser session + 6 in six separate sessions"),
    ("W2 desktop 1280x900 dsf=1 HEADED, scroll-pinned",
     ["F1-headed-pinned", "F3-headed-pinned-s"],
     "6 in one browser session + 6 in six separate sessions"),
    ("W3 mobile 390x844 dsf=1 HEADED, scroll-pinned",
     ["M1-mobile-headed", "M2-mobile-headed-s"],
     "6 in one browser session + 6 in six separate sessions"),
    ("W4 mobile 390x844 dsf=1 HEADLESS",
     ["M3-mobile-headless"],
     "6 in one browser session"),
    ("W5 desktop dsf=1.5 (1920x1350) HEADED",
     ["G1-headed-dsf1.5"], "3 in one browser session"),
    ("W6 desktop dsf=1.5 (1920x1350) HEADLESS",
     ["G4-headless-dsf1.5"], "3 in one browser session"),
    ("W7 desktop dsf=2 (2560x1800) HEADED",
     ["G2-headed-dsf2"], "3 in one browser session"),
    ("W8 desktop dsf=2 (2560x1800) HEADLESS",
     ["G3-headless-dsf2"], "3 in one browser session"),
]

UNPINNED = [
    ("B1 desktop 1280x900 dsf=1 HEADED, scroll NOT pinned, one session",
     ["E2-headed-dsf1"], "the apparatus exactly as FEATURES.md:42-43 describes it"),
    ("B2 desktop 1280x900 dsf=1 HEADED, scroll NOT pinned, six sessions",
     ["E4-headed-s"], "one of the six sessions recorded a scroll excursion"),
]


def resolve(root, prefixes):
    """Match `<prefix>__<view>-<n>.png` exactly, falling back to
    `<prefix>*__<view>-<n>.png` so a numbered series (`E3-headless-s1`) can be
    named by its stem (`E3-headless-s`). Exact match wins, so a stem that is a
    prefix of another stem cannot silently absorb it."""
    out = []
    for p in prefixes:
        hits = sorted(glob.glob(os.path.join(root, f"{p}__*.png")))
        if not hits:
            hits = sorted(glob.glob(os.path.join(root, f"{p}*__*.png")))
        if not hits:
            raise SystemExit(f"group prefix {p!r} matched nothing under {root}")
        out += hits
    return out


def stats(files):
    vals = []
    for i in range(len(files)):
        for j in range(i + 1, len(files)):
            r = compare(files[i], files[j])
            if "error" in r:
                raise SystemExit(f"{files[i]} vs {files[j]}: {r['error']}")
            vals.append((r["diffpx"], r["pct"]))
    px = [v[0] for v in vals]
    pc = [v[1] for v in vals]
    zero = sum(1 for v in px if v == 0)
    return {
        "n": len(files),
        "pairs": len(vals),
        "zero": zero,
        "nonzero": len(px) - zero,
        "min_px": min(px),
        "med_px": statistics.median(px),
        "max_px": max(px),
        "min_pct": min(pc),
        "med_pct": statistics.median(pc),
        "max_pct": max(pc),
        "distinct_nonzero_px": sorted(set(v for v in px if v > 0)),
    }


def show(rows, title):
    print(f"\n{'=' * 100}\n{title}\n{'=' * 100}")
    hdr = f"{'group':<50} {'N':>3} {'pairs':>5} {'0px':>4} {'non0':>5} {'min px':>7} {'med px':>7} {'max px':>7} {'max %':>8}"
    print(hdr)
    print("-" * len(hdr))
    for label, files, note, s in rows:
        print(
            f"{label:<50} {s['n']:>3} {s['pairs']:>5} {s['zero']:>4} {s['nonzero']:>5} "
            f"{s['min_px']:>7} {s['med_px']:>7} {s['max_px']:>7} {s['max_pct']:>8.4f}"
        )
        print(f"{'':<50} {note}")
        if s["distinct_nonzero_px"]:
            print(f"{'':<50} distinct non-zero px values: {s['distinct_nonzero_px']}")
    tot_pairs = sum(s["pairs"] for *_ , s in rows)
    tot_zero = sum(s["zero"] for *_ , s in rows)
    allpx = []
    allpc = []
    for *_ , s in rows:
        allpx += [s["min_px"]] * 0
    print("-" * len(hdr))
    print(
        f"{'POOLED':<50} {'':>3} {tot_pairs:>5} {tot_zero:>4} {tot_pairs - tot_zero:>5}"
    )
    return tot_pairs, tot_zero


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="/tmp/imp225/runs")
    a = ap.parse_args()

    rows = []
    for label, prefixes, note in WITHIN:
        files = resolve(a.dir, prefixes)
        rows.append((label, files, note, stats(files)))
    show(rows, "WITHIN ONE ENVIRONMENT -- the only population a tolerance can be derived from")

    rows2 = []
    for label, prefixes, note in UNPINNED:
        files = resolve(a.dir, prefixes)
        rows2.append((label, files, note, stats(files)))
    show(rows2, "SCROLL NOT PINNED -- the apparatus as FEATURES.md:42-43 specifies it")

    print(f"\n{'=' * 100}\nVIEWPORT AREAS (for the percentage arithmetic)\n{'=' * 100}")
    print(f"  desktop 1280 x 900 = {1280 * 900} px")
    print(f"  mobile   390 x 844 = {390 * 844} px")
    print(f"  ratio desktop/mobile = {1280 * 900 / (390 * 844):.3f}x")


if __name__ == "__main__":
    main()