#!/usr/bin/env python3
"""Generates src/lib/miljo/labelArt.ts, the vector artwork of the 49 x 49 mm Miljøregistrering label.

See README.md in this folder. Edit the settings below and run:

    python scripts/miljo-label/generate-label-art.py

Layout (sizes and positions on the label) is not here; it lives in src/lib/miljo/labelPdf.ts.
"""

import argparse
import json
import math
from pathlib import Path

import numpy as np
import potrace
import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BOLD = HERE / 'fonts' / 'Poppins-Bold.ttf'
SEMIBOLD = HERE / 'fonts' / 'Poppins-SemiBold.ttf'
LOGO = ROOT / 'public' / 'logo.png'
OUTPUT = ROOT / 'src' / 'lib' / 'miljo' / 'labelArt.ts'

# ── The label's fixed wording: key used by labelPdf.ts, font, text, tracking (1/1000 em). ──
TEXTS = [
    ('brand', BOLD, 'aBoks', -22),
    ('heading', BOLD, 'Miljøregistrering', -8),
    ('site', BOLD, 'aboks.no', -8),
    ('register', SEMIBOLD, 'Registrer', 0),
    ('usedBatteries', SEMIBOLD, 'brukte batterier', 0),
]

# ── Icon line weights, in each icon's own units. labelPdf.ts prints the globe 4 mm wide and the
#    battery 4.5 mm tall, so these are 0.30 mm and 0.32 mm: at least 2 dots on a 203 dpi printer. ──
GLOBE_STROKE = 7.5
BATTERY_STROKE = 4.2

KAPPA = 0.5523  # control-point distance that makes a cubic Bézier approximate a quarter circle


def num(value):
    return ('%.2f' % value).rstrip('0').rstrip('.')


def outline_text(path, string, tracking):
    """A line of text as SVG path data: kerning applied, 1000 units per em, baseline at y = 0, y down."""
    tt = TTFont(path)
    glyphs = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    font = hb.Font(hb.Face(hb.Blob.from_file_path(str(path))))
    buf = hb.Buffer()
    buf.add_str(string)
    buf.guess_segment_properties()
    hb.shape(font, buf, {'kern': True, 'liga': False})
    pen = SVGPathPen(glyphs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
    bounds = BoundsPen(glyphs)
    x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        glyph = glyphs[order[info.codepoint]]
        origin = x + pos.x_offset
        glyph.draw(TransformPen(pen, (1, 0, 0, -1, origin, 0)))
        glyph.draw(TransformPen(bounds, (1, 0, 0, -1, origin, 0)))
        x += pos.x_advance + tracking
    b = bounds.bounds
    return {'d': pen.getCommands(), 'xMin': round(b[0], 1), 'yMin': round(b[1], 1), 'xMax': round(b[2], 1), 'yMax': round(b[3], 1)}


def arc(cx, cy, r, start, end):
    """A circular arc as cubic Béziers. Angles in degrees, y down; begins with its own M."""
    n = max(1, math.ceil(abs(end - start) / 60))
    step = math.radians((end - start) / n)
    k = 4 / 3 * math.tan(step / 4)
    a = math.radians(start)
    p = lambda x, y: f'{num(x)} {num(y)}'
    d = [f'M{p(cx + r * math.cos(a), cy + r * math.sin(a))}']
    for _ in range(n):
        b = a + step
        d.append(
            'C' + p(cx + r * (math.cos(a) - k * math.sin(a)), cy + r * (math.sin(a) + k * math.cos(a)))
            + ' ' + p(cx + r * (math.cos(b) + k * math.sin(b)), cy + r * (math.sin(b) - k * math.cos(b)))
            + ' ' + p(cx + r * math.cos(b), cy + r * math.sin(b))
        )
        a = b
    return ''.join(d)


def globe_icon():
    """Circle, one pair of meridians and two bowed parallels on a 100 x 100 box."""
    c = 50
    r = 44
    k = KAPPA

    def ellipse(rx, ry):
        return (
            f'M{num(c - rx)} {c}C{num(c - rx)} {num(c - ry * k)} {num(c - rx * k)} {c - ry} {c} {c - ry}'
            f'C{num(c + rx * k)} {c - ry} {num(c + rx)} {num(c - ry * k)} {num(c + rx)} {c}'
            f'C{num(c + rx)} {num(c + ry * k)} {num(c + rx * k)} {c + ry} {c} {c + ry}'
            f'C{num(c - rx * k)} {c + ry} {num(c - rx)} {num(c + ry * k)} {num(c - rx)} {c}Z'
        )

    parallels = 'M11 34Q50 28 89 34M11 66Q50 72 89 66'
    return {'width': 100, 'height': 100, 'strokeWidth': GLOBE_STROKE, 'stroke': ellipse(r, r) + ellipse(18, r) + parallels, 'fill': ''}


def battery_icon():
    """Tilted battery inside three arc arrows, on a 64 x 60 box, redrawn from the reference sticker."""
    tilt = math.radians(28)
    ux, uy = math.cos(tilt), math.sin(tilt)
    vx, vy = -uy, ux
    cx, cy = 34.5, 27.5

    # u runs across the battery, v along it, both from its centre.
    def p(u, v):
        return f'{num(cx + u * ux + v * vx)} {num(cy + u * uy + v * vy)}'

    hw, hl, r = 10.6, 18.8, 3.2  # half width, half length, corner radius
    q = r * (1 - KAPPA)
    body = (
        'M' + p(-3, hl) + 'L' + p(-hw + r, hl)  # the outline is open at the bottom, as in the reference
        + 'C' + p(-hw + q, hl) + ' ' + p(-hw, hl - q) + ' ' + p(-hw, hl - r)
        + 'L' + p(-hw, -hl + r)
        + 'C' + p(-hw, -hl + q) + ' ' + p(-hw + q, -hl) + ' ' + p(-hw + r, -hl)
        + 'L' + p(hw - r, -hl)
        + 'C' + p(hw - q, -hl) + ' ' + p(hw, -hl + q) + ' ' + p(hw, -hl + r)
        + 'L' + p(hw, hl - r)
        + 'C' + p(hw, hl - q) + ' ' + p(hw - q, hl) + ' ' + p(hw - r, hl)
        + 'L' + p(3, hl)
    )
    terminal = (
        'M' + p(-4.6, -hl) + 'L' + p(-4.6, -hl - 5)
        + 'C' + p(-4.6, -hl - 5.9) + ' ' + p(-4, -hl - 6.5) + ' ' + p(-3.1, -hl - 6.5)
        + 'L' + p(3.1, -hl - 6.5)
        + 'C' + p(4, -hl - 6.5) + ' ' + p(4.6, -hl - 5.9) + ' ' + p(4.6, -hl - 5)
        + 'L' + p(4.6, -hl)
    )
    plus = 'M' + p(-3.7, -10.3) + 'L' + p(3.7, -10.3) + 'M' + p(0, -14) + 'L' + p(0, -6.6)
    minus = 'M' + p(-3.4, 11.3) + 'L' + p(3.4, 11.3)
    arcs = arc(30.5, 32, 27.6, 176, 238) + arc(30, 32, 25.7, 150, 62) + arc(33.5, 29, 27, -27, 42)
    arrowheads = 'M16.3 2.8L25.5 7.3L18 15Z' + 'M49.6 41L59.6 48.6L49.2 51Z'
    return {'width': 64, 'height': 60, 'strokeWidth': BATTERY_STROKE, 'stroke': body + terminal + plus + minus + arcs, 'fill': arrowheads}


def trace_mark():
    """Outlines the cube in public/logo.png with potrace, one path per colour, cropped to the cube."""
    rgba = np.array(Image.open(LOGO).convert('RGBA')).astype(float)
    height = rgba.shape[0]
    alpha = rgba[:, :, 3] / 255
    rgb = rgba[:, :, :3] * alpha[..., None] + 255 * (1 - alpha[..., None])

    # The cube ends at the first blank row in the lower part of the file; the wordmark follows.
    blank = np.where((rgb.min(axis=2) < 200).sum(axis=1) == 0)[0]
    cut = blank[blank > 300][0]
    above = np.arange(height)[:, None] < cut

    ink = (rgb.mean(axis=2) < 170) & above
    green = ink & (rgb[:, :, 1] - rgb[:, :, 2] > 25)  # olive has much more green than blue; the dark parts do not
    dark = ink & ~green
    ys, xs = np.where(green | dark)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1

    def trace(mask):
        # potracer treats True as background, so the mask is inverted.
        curves = potrace.Bitmap(~mask).trace(turdsize=20, alphamax=1.0, opticurve=True, opttolerance=0.4)
        p = lambda pt: f'{pt.x - x0:.1f} {pt.y - y0:.1f}'
        d = []
        for curve in curves:
            d.append('M' + p(curve.start_point))
            for seg in curve.segments:
                if seg.is_corner:
                    d.append('L' + p(seg.c) + 'L' + p(seg.end_point))
                else:
                    d.append('C' + p(seg.c1) + ' ' + p(seg.c2) + ' ' + p(seg.end_point))
            d.append('Z')
        return ''.join(d)

    return {'width': int(x1 - x0), 'height': int(y1 - y0), 'green': trace(green), 'dark': trace(dark)}


HEADER = """// GENERATED by scripts/miljo-label/generate-label-art.py. Edit that script, not this file.
//
// Vector artwork for the 49 × 49 mm Miljøregistrering label (./labelPdf). Data only, so the PDF
// needs no font embedding and no raster image:
//   • `mark` is a potrace outline of the cube in public/logo.png, split into its two colours;
//   • `globe` and `recycleBattery` are the footer icons, redrawn from the printed reference sticker;
//   • `text` is each fixed line of the label as outlines of Poppins (SIL Open Font License) with
//     its kerning applied: 1000 units per em, baseline at y = 0, y pointing down.
// All paths are SVG path data in their own coordinate system.

export type LabelTextArt = { d: string; xMin: number; yMin: number; xMax: number; yMax: number }

"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=OUTPUT, help='where to write (default: src/lib/miljo/labelArt.ts)')
    args = parser.parse_args()
    art = {
        'mark': trace_mark(),
        'globe': globe_icon(),
        'recycleBattery': battery_icon(),
        'text': {key: outline_text(font, string, tracking) for key, font, string, tracking in TEXTS},
    }
    args.out.write_text(HEADER + 'export const LABEL_ART = ' + json.dumps(art, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(f'wrote {args.out} ({args.out.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
