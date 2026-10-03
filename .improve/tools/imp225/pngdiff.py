#!/usr/bin/env python3
"""Dependency-free PNG reader + pixel-diff used by the IMP-225 measurement.

The reader/diff logic is verbatim from the harness regression 7 used
(`/tmp/sweep7/pngdiff.py`), so every percentage printed here is computed by the
same definition as the 15.46 % figure in `.improve/reports/regression-7.md`
§6.1 and can be compared against it directly.

Definition, unchanged: a pixel "differs" when any of its first `min(channels)`
8-bit components differ by **>= 1**. No per-channel tolerance, no antialias
discount, no perceptual metric. `pct = diffpx / (w*h) * 100`.

Added on top of regression 7's version, all read-only reporting:
  --profile   per-row diff counts, colour histogram, bbox, column histogram
  --json      machine-readable form for the harness aggregator
"""

import json
import struct
import sys
import zlib
from collections import Counter


def read_png(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", path
    pos = 8
    idat = b""
    w = h = bitd = ct = None
    while pos < len(data):
        ln = struct.unpack(">I", data[pos : pos + 4])[0]
        typ = data[pos + 4 : pos + 8]
        body = data[pos + 8 : pos + 8 + ln]
        if typ == b"IHDR":
            w, h, bitd, ct, comp, filt, inter = struct.unpack(">IIBBBBB", body)
            assert bitd == 8 and inter == 0, (path, bitd, inter)
        elif typ == b"IDAT":
            idat += body
        elif typ == b"IEND":
            break
        pos += 12 + ln
    raw = zlib.decompress(idat)
    nch = {0: 1, 2: 3, 4: 2, 6: 4}[ct]
    stride = w * nch
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]
        p += 1
        line = bytearray(raw[p : p + stride])
        p += stride
        if f == 1:
            for i in range(nch, stride):
                line[i] = (line[i] + line[i - nch]) & 255
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i - nch] if i >= nch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i - nch] if i >= nch else 0
                b = prev[i]
                c = prev[i - nch] if i >= nch else 0
                pa = abs(b - c)
                pb = abs(a - c)
                pc = abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y * stride : (y + 1) * stride] = line
        prev = line
    return w, h, nch, out


def box_downsample(w, h, nch, buf, f):
    """Box-average f x f blocks. Used to put a deviceScaleFactor=2 capture on
    the same pixel grid as a deviceScaleFactor=1 one, which is the only way the
    raw-pixel comparison can even be attempted across a DPI change."""
    assert w % f == 0 and h % f == 0, (w, h, f)
    nw, nh = w // f, h // f
    out = bytearray(nw * nh * nch)
    area = f * f
    for y in range(nh):
        for x in range(nw):
            for c in range(nch):
                s = 0
                for dy in range(f):
                    row = (y * f + dy) * w * nch
                    for dx in range(f):
                        s += buf[row + (x * f + dx) * nch + c]
                out[(y * nw + x) * nch + c] = (s + area // 2) // area
    return nw, nh, nch, out


def compare(a, b, tol=0, scale=1):
    """Return a dict describing the pixel difference between two PNGs.

    `tol` is an optional per-component dead-band applied *before* counting a
    pixel as different. `tol=0` reproduces regression 7 exactly and is what
    every headline number in the report uses; non-zero values are only ever
    reported as sensitivity analysis, never as the measurement.

    `scale` box-downsamples both images by that integer factor first, so a
    deviceScaleFactor=2 capture can be compared with a deviceScaleFactor=1 one.
    """
    wa, ha, na, pa = read_png(a)
    wb, hb, nb, pb = read_png(b)
    if scale > 1:
        # Box-downsample whichever side is larger by the largest integer factor
        # that lands it exactly on the smaller side's grid. A dsf=2 capture
        # becomes comparable to a dsf=1 one this way; a dsf=1.5 one cannot be
        # (1920x1350 has no integer factor that yields 1280x900), and that is
        # reported as a size mismatch rather than silently resampled.
        tw, th = min(wa, wb), min(ha, hb)
        if (wa, ha) != (tw, th) and wa % tw == 0 and ha % th == 0:
            wa, ha, na, pa = box_downsample(wa, ha, na, pa, wa // tw)
        if (wb, hb) != (tw, th) and wb % tw == 0 and hb % th == 0:
            wb, hb, nb, pb = box_downsample(wb, hb, nb, pb, wb // tw)
    if (wa, ha) != (wb, hb):
        return {"error": f"SIZE MISMATCH {wa}x{ha} vs {wb}x{hb}"}
    n = min(na, nb)
    diffpx = 0
    rows = []
    colhits = [0] * wa
    maxdelta = 0
    x0 = y0 = 10**9
    x1 = y1 = -1
    for y in range(ha):
        base_a = y * wa * na
        base_b = y * wa * nb
        rowdiff = 0
        for x in range(wa):
            ia = base_a + x * na
            ib = base_b + x * nb
            hit = False
            for c in range(n):
                d = abs(pa[ia + c] - pb[ib + c])
                if d > maxdelta:
                    maxdelta = d
                if d > tol:
                    hit = True
                    break
            if hit:
                diffpx += 1
                rowdiff += 1
                colhits[x] += 1
                if x < x0:
                    x0 = x
                if x > x1:
                    x1 = x
                if y < y0:
                    y0 = y
                if y > y1:
                    y1 = y
        rows.append(rowdiff)
    return {
        "width": wa,
        "height": ha,
        "channels": n,
        "tol": tol,
        "diffpx": diffpx,
        "pct": 100.0 * diffpx / (wa * ha),
        "rows_with_diff": sum(1 for r in rows if r),
        "rows": rows,
        "cols": colhits,
        "max_channel_delta": maxdelta,
        "bbox": None if x1 < 0 else [x0, y0, x1, y1],
    }


def colours(path, rows=None, step=None):
    """Most common RGB triples, optionally restricted to given row indices."""
    w, h, nch, buf = read_png(path)
    want = range(h) if rows is None else rows
    c = Counter()
    for y in want:
        base = y * w * nch
        for x in range(w):
            c[tuple(buf[base + x * nch : base + x * nch + 3])] += 1
    return c.most_common(step or 10)


def one_line(label, a, b, tol=0, scale=1):
    r = compare(a, b, tol, scale)
    if "error" in r:
        return f"{label}: {r['error']}"
    return (
        f"{label}: {r['diffpx']} px differ ({r['pct']:.4f}%) over "
        f"{r['rows_with_diff']} rows; maxdelta={r['max_channel_delta']}; "
        f"bbox={r['bbox']}"
    )


if __name__ == "__main__":
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        sys.exit(2)
    mode = "plain"
    tol = 0
    scale = 1
    while argv and argv[0].startswith("--"):
        flag = argv.pop(0)
        if flag == "--profile":
            mode = "profile"
        elif flag == "--json":
            mode = "json"
        elif flag == "--tol":
            tol = int(argv.pop(0))
        elif flag == "--scale":
            scale = int(argv.pop(0))
        elif flag == "--colours":
            mode = "colours"
            rows = [int(x) for x in argv.pop(0).split(",")] if argv else None
            for p in (argv[0], argv[1]) if len(argv) > 1 else argv:
                print(f"--- colours {p} ---")
                for rgb, n in colours(p, rows=rows, step=8):
                    print(f"  {rgb} x{n}")
            sys.exit(0)
    label = argv[2] if len(argv) > 2 else f"{argv[0]} vs {argv[1]}"
    r = compare(argv[0], argv[1], tol, scale)
    if mode == "json":
        r.pop("cols", None)
        print(json.dumps(r))
    elif mode == "profile":
        print(one_line(label, argv[0], argv[1], tol, scale))
        print("  rows with diff:", [i for i, v in enumerate(r["rows"]) if v][:40], "...")
        nz = [(i, v) for i, v in enumerate(r["rows"]) if v]
        print(f"  rows with diff: {len(nz)}; first={nz[0] if nz else None}; last={nz[-1] if nz else None}")
        print(f"  worst rows: {sorted(nz, key=lambda kv: -kv[1])[:12]}")
        print(f"  diff-px-per-differing-row: mean={sum(v for _, v in nz)/max(1,len(nz)):.1f}")
        full = sum(1 for _, v in nz if v == r["width"])
        print(f"  rows differing across the FULL width (1280): {full}")
        cols = r["cols"]
        print(f"  columns with any diff: {sum(1 for v in cols if v)}; worst cols {sorted(enumerate(cols), key=lambda kv: -kv[1])[:12]}")
    else:
        print(one_line(label, argv[0], argv[1], tol, scale))