"""Generate Intervals app icons as PNGs — pure stdlib (zlib + struct), no deps.

Renders a stylised ember/flame mark with 3x supersampling for clean edges.
"""
import math
import struct
import zlib
from pathlib import Path

OUT = Path("/home/ervinchai/projects/intervals-pwa/public/icons")

BG = (0x17, 0x12, 0x10)
FLAME_OUT_LO = (0xC2, 0x41, 0x0C)   # ember base
FLAME_OUT_HI = (0xF9, 0x73, 0x16)   # ember tip
FLAME_IN_LO = (0xF5, 0x9E, 0x0B)
FLAME_IN_HI = (0xFF, 0xE1, 0x8A)

SS = 3  # supersample factor


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def flame_cover(px, py, cx, base_y, height, radius, lick):
    """Coverage-ish test: is point inside the union of spine circles?

    Returns the normalised height t of the covering circle (for gradient),
    or None when outside.
    """
    best = None
    steps = 90
    for i in range(steps + 1):
        t = i / steps
        r = radius * (1.0 - t) ** 0.72
        if r <= 0.4:
            continue
        ccx = cx + lick * radius * math.sin(t * 3.1) * t
        ccy = base_y - t * height
        if (px - ccx) ** 2 + (py - ccy) ** 2 <= r * r:
            if best is None or t > best:
                best = t
    return best


def render(size, pad_frac=0.0, rounded=True, transparent_bg=False):
    """Render one icon at `size` px. pad_frac shrinks the mark (maskable safe zone)."""
    S = size * SS
    radius_corner = S * 0.22

    inset = S * pad_frac
    art = S - 2 * inset

    # Flame geometry within the art box
    cx = S / 2
    base_y = inset + art * 0.80
    height = art * 0.62
    radius = art * 0.20
    in_base_y = inset + art * 0.80
    in_height = art * 0.34
    in_radius = art * 0.115

    px_buf = bytearray()
    rows = []
    for y in range(S):
        row = bytearray()
        for x in range(S):
            fx, fy = x + 0.5, y + 0.5

            # background (rounded square)
            if transparent_bg:
                r_, g_, b_, a_ = 0, 0, 0, 0
            else:
                inside_bg = True
                if rounded:
                    qx = abs(fx - S / 2) - (S / 2 - radius_corner)
                    qy = abs(fy - S / 2) - (S / 2 - radius_corner)
                    if qx > 0 and qy > 0:
                        inside_bg = (qx * qx + qy * qy) <= radius_corner ** 2
                if inside_bg:
                    r_, g_, b_, a_ = BG[0], BG[1], BG[2], 255
                else:
                    r_, g_, b_, a_ = 0, 0, 0, 0

            t_out = flame_cover(fx, fy, cx, base_y, height, radius, 0.55)
            if t_out is not None:
                c = lerp(FLAME_OUT_LO, FLAME_OUT_HI, t_out)
                r_, g_, b_, a_ = c[0], c[1], c[2], 255

            t_in = flame_cover(fx, fy, cx, in_base_y, in_height, in_radius, 0.30)
            if t_in is not None:
                c = lerp(FLAME_IN_LO, FLAME_IN_HI, t_in)
                r_, g_, b_, a_ = c[0], c[1], c[2], 255

            row += bytes((r_, g_, b_, a_))
        rows.append(row)

    # downsample SS x SS -> 1
    out = bytearray()
    for y in range(size):
        out.append(0)  # filter type 0
        for x in range(size):
            rr = gg = bb = aa = 0
            for dy in range(SS):
                src = rows[y * SS + dy]
                for dx in range(SS):
                    o = ((x * SS + dx) * 4)
                    a = src[o + 3]
                    rr += src[o] * a
                    gg += src[o + 1] * a
                    bb += src[o + 2] * a
                    aa += a
            n = SS * SS
            if aa == 0:
                out += bytes((0, 0, 0, 0))
            else:
                out += bytes((rr // aa, gg // aa, bb // aa, aa // n))
    del px_buf
    return bytes(out)


def write_png(path, size, raw):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    path.write_bytes(png)
    print(f"  {path.name}  {size}x{size}  {len(png)/1024:.1f} KB")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [
        ("icon-192.png", 192, 0.0, True, False),
        ("icon-512.png", 512, 0.0, True, False),
        ("icon-maskable-512.png", 512, 0.14, False, False),
        ("apple-touch-icon.png", 180, 0.0, False, False),  # iOS masks it itself
        ("favicon-32.png", 32, 0.0, True, False),
    ]
    for name, size, pad, rounded, transp in jobs:
        raw = render(size, pad, rounded, transp)
        write_png(OUT / name, size, raw)


if __name__ == "__main__":
    main()
