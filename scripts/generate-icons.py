#!/usr/bin/env python3
"""Generate Conbhan PWA icons (512, maskable 512, apple-touch 180) from drawn art."""
from pathlib import Path

import math

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BG = (11, 18, 32)
ACCENT = (56, 189, 248, 255)
ACCENT2 = (167, 139, 250, 255)


def draw(size: int, maskable: bool) -> Image.Image:
    artwork = size * (0.8 if maskable else 1.0)
    pad = (size - artwork) / 2
    art = Image.new('RGBA', (int(artwork), int(artwork)), (0, 0, 0, 0))
    d = ImageDraw.Draw(art)
    r = int(artwork * 0.22)
    d.rounded_rectangle([0, 0, int(artwork), int(artwork)], radius=r, fill=BG)
    ring_r = artwork * 0.30
    stroke = max(4, artwork * 0.056)
    d.arc(
        [artwork / 2 - ring_r, artwork / 2 - ring_r, artwork / 2 + ring_r, artwork / 2 + ring_r],
        start=35,
        end=295,
        fill=ACCENT,
        width=int(stroke),
    )
    rad_end = math.radians(295)
    dx = artwork / 2 + (ring_r - stroke / 2) * math.cos(rad_end)
    dy = artwork / 2 + (ring_r - stroke / 2) * math.sin(rad_end)
    dot_r = max(5, artwork * 0.045)
    d.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=ACCENT2)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(out).rounded_rectangle([0, 0, size, size], radius=int(size * 0.22), fill=BG)
    pad_x, pad_y = round((size - artwork) / 2), round((size - artwork) / 2)
    if maskable:
        out.paste(art, (pad_x, pad_y), art)
    else:
        out = art
    return out


def main() -> None:
    icon_dir = ROOT / 'public' / 'icons'
    icon_dir.mkdir(parents=True, exist_ok=True)
    for filename, size, maskable in (
        ('icon-192.png', 192, False),
        ('icon-512.png', 512, False),
        ('maskable-icon-512.png', 512, True),
        ('apple-touch-icon.png', 180, False),
    ):
        draw(size, maskable).save(icon_dir / filename, format='PNG')
    print('icons written to', icon_dir)


if __name__ == '__main__':
    main()
