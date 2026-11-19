#!/usr/bin/env python3
"""Generate the pixel-art image assets used by the site.

Everything is drawn on a 4px grid with a fixed 16-colour palette, so raster
assets are regenerated from their source images instead of hand-painted:
photos are reduced to a coarse grid and snapped to the palette, emblems are
posterised, and the icon set is drawn as a 16x16 bitmap.

Usage:  python3 scripts/pixel-art.py
Needs:  Pillow  (pip install pillow)
"""

from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "src" / "assets"
OUT = ASSETS / "pixel"

# ---------------------------------------------------------------------------
# Palette. Keep in sync with src/styles/_tokens.scss.
# ---------------------------------------------------------------------------
PALETTE = [
    (21, 22, 29),     # 0  ink
    (11, 13, 22),     # 1  ink deep
    (20, 26, 46),     # 2  night navy
    (31, 40, 68),     # 3  navy
    (49, 60, 94),     # 4  slate
    (78, 86, 116),    # 5  haze
    (120, 124, 146),  # 6  mist
    (168, 166, 172),  # 7  grey
    (236, 228, 210),  # 8  paper shade
    (255, 250, 238),  # 9  paper
    (232, 198, 168),  # 10 skin light
    (204, 162, 132),  # 11 skin
    (160, 118, 92),   # 12 skin shadow
    (122, 106, 84),   # 13 fur
    (58, 48, 38),     # 14 fur dark
    (47, 163, 107),   # 15 phosphor green
]

INK = (21, 22, 29, 255)
PAPER = (255, 250, 238, 255)
GREEN = (47, 163, 107, 255)


def nearest(pixel, palette):
    r, g, b = pixel[:3]
    best, best_d = 0, float("inf")
    for index, (pr, pg, pb) in enumerate(palette):
        d = (r - pr) ** 2 * 0.30 + (g - pg) ** 2 * 0.59 + (b - pb) ** 2 * 0.11
        if d < best_d:
            best, best_d = index, d
    return palette[best]


def to_pixels(image, size, palette=PALETTE, brightness=1.0, contrast=1.0, color=1.0):
    """Downscale an image to size x size and snap every pixel to the palette."""
    small = image.convert("RGB").resize(size, Image.LANCZOS)
    if brightness != 1.0:
        small = ImageEnhance.Brightness(small).enhance(brightness)
    if contrast != 1.0:
        small = ImageEnhance.Contrast(small).enhance(contrast)
    if color != 1.0:
        small = ImageEnhance.Color(small).enhance(color)
    data = list(small.get_flattened_data()) if hasattr(small, "get_flattened_data") else list(small.getdata())
    return Image.frombytes(
        "RGB",
        size,
        bytes(channel for px in data for channel in nearest(px, palette)),
    )


def crop_square(image):
    w, h = image.size
    edge = min(w, h)
    return image.crop(((w - edge) // 2, (h - edge) // 2, (w + edge) // 2, (h + edge) // 2))


# ---------------------------------------------------------------------------
# 1. Portrait: 96 x 96, displayed at 3x with image-rendering: pixelated.
# ---------------------------------------------------------------------------
def portrait():
    src = Image.open(ASSETS / "images" / "profile" / "daoze-tang.jpg")
    upscaled = src.resize((512, 512), Image.LANCZOS)
    small = to_pixels(upscaled, (96, 96), brightness=1.48, contrast=1.06, color=1.22)
    OUT.mkdir(parents=True, exist_ok=True)
    small.save(OUT / "portrait-96.png", optimize=True)
    print("portrait-96.png", small.size)


# ---------------------------------------------------------------------------
# 2. Institution emblems: posterised onto a 4-step ink/paper ramp.
# ---------------------------------------------------------------------------
EMBLEM_SIZE = 56
RAMPS = {
    "cau-logo": [(255, 250, 238), (4, 96, 60), (47, 163, 107), (11, 13, 22)],
    "huc-logo": [(255, 250, 238), (4, 96, 60), (47, 163, 107), (11, 13, 22)],
    "hust-logo": [(255, 250, 238), (28, 62, 140), (110, 156, 230), (11, 13, 22)],
}


def emblems():
    directory = ASSETS / "images" / "institutions"
    for stem, palette in RAMPS.items():
        source = Image.open(directory / f"{stem}.png")
        square = crop_square(source).resize((EMBLEM_SIZE, EMBLEM_SIZE), Image.LANCZOS)
        alpha = square.convert("RGBA").getchannel("A").resize((EMBLEM_SIZE, EMBLEM_SIZE), Image.LANCZOS)
        out = to_pixels(square, (EMBLEM_SIZE, EMBLEM_SIZE), palette=palette).convert("RGBA")
        out.putalpha(alpha)
        out.save(directory / f"{stem}-px.png", optimize=True)
        print(f"{stem}-px.png", out.size)


# ---------------------------------------------------------------------------
# 3. Icon set: 16x16 prompt mark (chevron + underscore), exported at 32/180.
# ---------------------------------------------------------------------------
def prompt_mark():
    grid = [["." for _ in range(16)] for _ in range(16)]

    def rect(x, y, w, h, key):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < 16 and 0 <= yy < 16:
                    grid[yy][xx] = key

    # chevron ">" — stepped diagonal, 2px thick
    rect(2, 3, 2, 2, "g")
    rect(4, 5, 2, 2, "g")
    rect(6, 7, 2, 2, "g")
    rect(4, 9, 2, 2, "g")
    rect(2, 11, 2, 2, "g")
    # underscore
    rect(9, 11, 5, 2, "p")

    colors = {".": INK, "g": GREEN, "p": PAPER}
    image = Image.new("RGBA", (16, 16), INK)
    pixels = image.load()
    for y in range(16):
        for x in range(16):
            pixels[x, y] = colors[grid[y][x]]
    image.resize((32, 32), Image.NEAREST).save(ASSETS / "favicon.png", optimize=True)
    image.resize((160, 160), Image.NEAREST).save(ASSETS / "apple-touch-icon.png", optimize=True)
    print("favicon.png 32x32, apple-touch-icon.png 160x160")


if __name__ == "__main__":
    portrait()
    emblems()
    prompt_mark()
