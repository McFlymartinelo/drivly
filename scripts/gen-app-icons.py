from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "icon-source.jpg"
PUBLIC = ROOT / "public"

TEAL = (22, 106, 103)


def crop_tile(im: Image.Image) -> Image.Image:
    rgb = im.convert("RGB")
    w, h = rgb.size
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = rgb.getpixel((x, y))
            teal = r < 90 and g > 70 and b > 60 and g > r + 15
            orange = r > 160 and g > 60 and b < 100 and r > b + 40
            if teal or orange:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    pad = 8
    box = (
        max(0, minx - pad),
        max(0, miny - pad),
        min(w, maxx + 1 + pad),
        min(h, maxy + 1 + pad),
    )
    tile = rgb.crop(box)
    side = max(tile.size)
    square = Image.new("RGB", (side, side), TEAL)
    square.paste(tile, ((side - tile.size[0]) // 2, (side - tile.size[1]) // 2))
    fill_gray_corners(square)
    return square


def fill_gray_corners(im: Image.Image) -> None:
    w, h = im.size
    radius = int(min(w, h) * 0.22)
    r2 = radius * radius
    corners = ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            grayish = abs(r - g) < 18 and abs(g - b) < 18 and r > 190
            if not grayish:
                continue
            if any((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2 for cx, cy in corners):
                px[x, y] = TEAL


def fit(tile: Image.Image, size: int, pad_ratio: float = 0.0) -> Image.Image:
    canvas = Image.new("RGB", (size, size), TEAL)
    inner = max(1, int(round(size * (1 - 2 * pad_ratio))))
    scaled = tile.resize((inner, inner), Image.Resampling.LANCZOS)
    off = (size - inner) // 2
    canvas.paste(scaled, (off, off))
    return canvas


def main() -> None:
    tile = crop_tile(Image.open(SRC))
    outputs = {
        "pwa-192.png": (192, 0.0),
        "pwa-512.png": (512, 0.0),
        "apple-touch-icon.png": (180, 0.0),
        "pwa-512-maskable.png": (512, 0.10),
    }
    for name, (size, pad) in outputs.items():
        dest = PUBLIC / name
        fit(tile, size, pad).save(dest, "PNG", optimize=True)
        print(f"wrote {dest.name} {size}x{size}")


if __name__ == "__main__":
    main()
