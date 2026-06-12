#!/usr/bin/env python3
"""Generate the exact "Squishy & Friends" wordmark outlines for src/game/logo.ts.

Reads the self-hosted Fredoka woff2, instances it at weight 700, and bakes the
lockup (big "Squishy", small "& Friends" tucked under) into three SVG path `d`
strings (one per colour). Run from the repo root:  python3 scripts/gen-logo.py
Requires: fonttools, brotli  (pip install fonttools brotli)
"""
import json
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import ControlBoundsPen
from fontTools.svgLib.path import parse_path

FONT = 'public/fonts/fredoka-latin.woff2'
SUB_SCALE = 0.34   # "& Friends" size relative to "Squishy"
SUB_SPACE = 200    # gap between "&" and "Friends", font units (pre-scale)
SQUISHY_FOOT = 236 # bottom of the "Squishy" q/y descenders, font units
SUB_GAP = 12       # vertical gap from those descenders to the "& Friends" cap
SUB_CAP = 700      # cap height of the subline glyphs (font units, pre-scale)


def main():
    f = TTFont(FONT)
    instantiateVariableFont(f, {'wght': 700}, inplace=True)
    gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f['hmtx']

    def width(s):
        return sum(hmtx[cmap[ord(c)]][0] if cmap.get(ord(c)) else 300 for c in s)

    def bake(s, tr):
        pen, x = SVGPathPen(gs), 0.0
        a, b, c, d, e, ff = tr
        for ch in s:
            g = cmap.get(ord(ch))
            if g is None:
                x += 300
                continue
            gs[g].draw(TransformPen(pen, (a, b, c, d, a * x + e, b * x + ff)))
            x += hmtx[g][0]
        return pen.getCommands()

    def bounds(d):
        bp = ControlBoundsPen(None)
        parse_path(d, bp)
        return bp.bounds

    main_w = width('Squishy')
    sub_nat = width('&') + SUB_SPACE + width('Friends')
    sub_x = main_w / 2 - (sub_nat * SUB_SCALE) / 2
    sub_base = SQUISHY_FOOT + SUB_GAP + SUB_SCALE * SUB_CAP
    paths = {
        'S': bake('Squishy', (1, 0, 0, -1, 0, 0)),
        'A': bake('&', (SUB_SCALE, 0, 0, -SUB_SCALE, sub_x, sub_base)),
        'F': bake('Friends', (SUB_SCALE, 0, 0, -SUB_SCALE,
                              sub_x + (width('&') + SUB_SPACE) * SUB_SCALE, sub_base)),
    }
    bs = [bounds(paths[k]) for k in 'SAF']
    xmin = min(b[0] for b in bs)
    ymin = min(b[1] for b in bs)
    xmax = max(b[2] for b in bs)
    ymax = max(b[3] for b in bs)
    print(json.dumps({'paths': paths,
                      'bbox': [round(xmin), round(ymin), round(xmax), round(ymax)]}))


if __name__ == '__main__':
    main()
