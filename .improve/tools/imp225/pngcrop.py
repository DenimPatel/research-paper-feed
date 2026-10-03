#!/usr/bin/env python3
"""Crop / tile PNGs with the dependency-free reader in pngdiff.py.

Used to put two captures of the same view side by side (or stacked) so a human
can see *what* moved, rather than only how many pixels moved.
"""
import sys
import zlib
import struct

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from pngdiff import read_png  # noqa: E402


def write_png(path, w, h, rgb):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += rgb[y * w * 3 : (y + 1) * w * 3]

    def chunk(typ, body):
        c = struct.pack(">I", len(body)) + typ + body
        return c + struct.pack(">I", zlib.crc32(typ + body) & 0xFFFFFFFF)

    out = b"\x89PNG\r\n\x1a\n"
    out += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    out += chunk(b"IDAT", zlib.compress(bytes(raw), 6))
    out += chunk(b"IEND", b"")
    open(path, "wb").write(out)


def load_rgb(path):
    w, h, nch, buf = read_png(path)
    if nch < 3:
        raise SystemExit(f"{path}: needs >=3 channels, has {nch}")
    out = bytearray(w * h * 3)
    for i in range(w * h):
        out[i * 3 : i * 3 + 3] = buf[i * nch : i * nch + 3]
    return w, h, out


def crop(w, h, rgb, x0, y0, x1, y1):
    cw, ch = x1 - x0, y1 - y0
    out = bytearray(cw * ch * 3)
    for y in range(ch):
        s = ((y + y0) * w + x0) * 3
        out[y * cw * 3 : (y + 1) * cw * 3] = rgb[s : s + cw * 3]
    return cw, ch, out


def hstack(imgs, gap=8):
    w = sum(i[0] for i in imgs) + gap * (len(imgs) - 1)
    h = max(i[1] for i in imgs)
    out = bytearray(b"\xff" * (w * h * 3))
    x = 0
    for (iw, ih, buf) in imgs:
        for y in range(ih):
            s = y * iw * 3
            d = (y * w + x) * 3
            out[d : d + iw * 3] = buf[s : s + iw * 3]
        x += iw + gap
    return w, h, out


def vstack(imgs, gap=8):
    w = max(i[0] for i in imgs)
    h = sum(i[1] for i in imgs) + gap * (len(imgs) - 1)
    out = bytearray(b"\xff" * (w * h * 3))
    y = 0
    for (iw, ih, buf) in imgs:
        for r in range(ih):
            s = r * iw * 3
            d = ((y + r) * w) * 3
            out[d : d + iw * 3] = buf[s : s + iw * 3]
        y += ih + gap
    return w, h, out


def scale(w, h, rgb, factor):
    nw, nh = w * factor, h * factor
    out = bytearray(nw * nh * 3)
    for y in range(nh):
        sy = y // factor
        for x in range(nw):
            s = (sy * w + x // factor) * 3
            d = (y * nw + x) * 3
            out[d : d + 3] = rgb[s : s + 3]
    return nw, nh, out


if __name__ == "__main__":
    # usage: pngcrop.py OUT MODE SPEC...
    #   SPEC = src.png[:x0,y0,x1,y1][:xN]
    out_path, mode = sys.argv[1], sys.argv[2]
    imgs = []
    for spec in sys.argv[3:]:
        parts = spec.split(":")
        w, h, rgb = load_rgb(parts[0])
        label = parts[0]
        for p in parts[1:]:
            if p.startswith("x"):
                w, h, rgb = scale(w, h, rgb, int(p[1:]))
                label += f" x{p[1:]}"
            else:
                x0, y0, x1, y1 = (int(v) for v in p.split(","))
                w, h, rgb = crop(w, h, rgb, x0, y0, x1, y1)
                label += f" [{x0},{y0},{x1},{y1}]"
        imgs.append((w, h, rgb))
        print(f"loaded {label} -> {w}x{h}")
    res = hstack(imgs) if mode == "h" else vstack(imgs)
    write_png(out_path, *res)
    print(f"wrote {out_path} {res[0]}x{res[1]}")