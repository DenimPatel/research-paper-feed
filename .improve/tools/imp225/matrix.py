#!/usr/bin/env python3
"""Pairwise pixel-difference matrix over a set of captures, IMP-225.

Reads a directory of PNGs (or a manifest of named groups), computes the diff
for **every** unordered pair with the regression-7 definition, and prints an
N x N matrix plus min / median / max and the 0 px vs non-0 px split.

    python3 matrix.py --dir /tmp/imp225/runs --group 'E2*' --label E2-headed
    python3 matrix.py --pairs pairs.txt          # one "label a.png b.png" per line

`--scale N` box-downsamples both sides of every pair first (see
pngdiff.box_downsample); that is how the deviceScaleFactor=2 captures are put
on the same grid as the deviceScaleFactor=1 ones.
"""
import argparse
import glob
import os
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pngdiff import compare  # noqa: E402


def run(names, paths, scale=1):
    n = len(names)
    grid = [[None] * n for _ in range(n)]
    px = [[0] * n for _ in range(n)]
    pcm = [[0.0] * n for _ in range(n)]
    errors = []
    for i in range(n):
        for j in range(i + 1, n):
            r = compare(paths[i], paths[j], 0, scale)
            if "error" in r:
                errors.append(f"{names[i]} vs {names[j]}: {r['error']}")
                grid[i][j] = grid[j][i] = r["error"]
                continue
            grid[i][j] = grid[j][i] = f"{r['pct']:.4f}"
            px[i][j] = px[j][i] = r["diffpx"]
            pcm[i][j] = pcm[j][i] = r["pct"]
    return grid, px, pcm, errors


def summarise(px, pcm, n):
    vals, pcts = [], []
    zero = nonzero = 0
    for i in range(n):
        for j in range(i + 1, n):
            vals.append(px[i][j])
            pcts.append(pcm[i][j])
            if px[i][j] == 0:
                zero += 1
            else:
                nonzero += 1
    return {
        "pairs": len(vals),
        "zero_px_pairs": zero,
        "nonzero_px_pairs": nonzero,
        "min_px": min(vals),
        "median_px": statistics.median(vals),
        "max_px": max(vals),
        "min_pct": min(pcts),
        "median_pct": statistics.median(pcts),
        "max_pct": max(pcts),
    }


def print_matrix(names, grid):
    w = max(len(x) for x in names) + 2
    print(" " * w + "".join(f"{i + 1:>9d}" for i in range(len(names))))
    for i, nm in enumerate(names):
        cells = []
        for j in range(len(names)):
            if i == j:
                cells.append(f"{'-':>9}")
            else:
                g = grid[i][j]
                cells.append(f"{('ERR' if isinstance(g, str) and not g[0].isdigit() else g):>9}")
        print(f"{i + 1:>2d} {nm:<{w - 3}}"[: w] + "".join(cells))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir")
    ap.add_argument("--group", default="*")
    ap.add_argument("--label", default="group")
    ap.add_argument("--pairs")
    ap.add_argument("--scale", type=int, default=1)
    ap.add_argument("--json-out")
    a = ap.parse_args()

    if a.pairs:
        names, paths = [], []
        for line in open(a.pairs):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            lab, pa, pb = line.split()
            names.append(lab)
            paths.append((lab, pa, pb))
        # pairs mode: rows are independent comparisons, not a matrix
        print(f"# independent comparisons, scale={a.scale}")
        results = []
        for lab, pa, pb in paths:
            r = compare(pa, pb, 0, a.scale)
            if "error" in r:
                print(f"{lab:34s} {r['error']}")
                results.append({"label": lab, "error": r["error"]})
            else:
                print(
                    f"{lab:34s} {r['diffpx']:>8d} px  {r['pct']:>9.4f}%  "
                    f"rows={r['rows_with_diff']:<4d} maxdelta={r['max_channel_delta']} bbox={r['bbox']}"
                )
                results.append(
                    {
                        "label": lab,
                        "diffpx": r["diffpx"],
                        "pct": r["pct"],
                        "rows": r["rows_with_diff"],
                        "maxdelta": r["max_channel_delta"],
                        "bbox": r["bbox"],
                    }
                )
        if a.json_out:
            import json

            json.dump(results, open(a.json_out, "w"), indent=2)
        return

    files = sorted(glob.glob(os.path.join(a.dir, f"{a.group}.png")))
    names = [os.path.basename(f)[:-4] for f in files]
    print(f"# group {a.label}: N={len(files)} captures from {a.dir}  scale={a.scale}")
    for nm, f in zip(names, files):
        print(f"#   {nm}")
    grid, px, pcm, errors = run(names, files, a.scale)
    print()
    print_matrix(names, grid)
    s = summarise(px, pcm, len(names))
    print()
    print(f"pairs            : {s['pairs']}")
    print(f"0 px pairs       : {s['zero_px_pairs']}")
    print(f"non-0 px pairs   : {s['nonzero_px_pairs']}")
    print(
        f"px  min/med/max  : {s['min_px']} / {s['median_px']} / {s['max_px']}"
    )
    print(
        f"pct  min/med/max : {s['min_pct']:.4f} / {s['median_pct']:.4f} / {s['max_pct']:.4f}"
    )
    for e in errors:
        print(f"ERROR {e}")
    if a.json_out:
        import json

        json.dump({"group": a.label, "names": names, "summary": s, "matrix_pct": grid}, open(a.json_out, "w"), indent=2)


if __name__ == "__main__":
    main()