#!/usr/bin/env python3
"""
Lines & Logos — full app-icon generator.

Source : icons/icon-512.png  (logo mark, square, transparent background)
         logo-hero.png is widescreen on black — do NOT use for icons.
Outputs: macOS .icns, Windows .ico, web favicon set, PWA icons,
         Apple touch icon, maskable icon, Linux hicolor tree (snap/deb).

Usage  : python3 pkg/icons/generate-icons.py
Requires: Pillow only  (pip install pillow). No macOS needed for .icns.
"""
import struct
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Pillow required: pip install pillow")

BASE   = Path(__file__).resolve().parents[2]          # repo/app root
SRC    = BASE / "icons" / "icon-512.png"
OUT    = BASE / "icons"
DIST   = BASE / "pkg" / "icons" / "dist"
NAVY   = (10, 21, 51)          # brand navy #0a1533 for opaque/maskable bgs
NAME   = "lines-and-logos"

if not SRC.exists():
    raise SystemExit(f"source image not found: {SRC}")

master = Image.open(SRC).convert("RGBA")


def resample(img, size):
    return img.resize((size, size), Image.LANCZOS)


def save_png(img, size, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    resample(img, size).save(path, "PNG", optimize=True)
    print("wrote", path.relative_to(BASE))


def opaque(img, size, bg=(255, 255, 255)):
    """Flatten onto a solid background (Apple touch icons must be opaque)."""
    canvas = Image.new("RGBA", img.size, bg + (255,))
    canvas.alpha_composite(img)
    return canvas


def write_icns(path, entries):
    """Pure-python .icns writer — entries: list of (fourcc, PIL.Image)."""
    body = b""
    for fourcc, img in entries:
        buf = BytesIO()
        img.save(buf, "PNG", optimize=True)
        data = buf.getvalue()
        body += fourcc.encode("ascii") + struct.pack(">I", 8 + len(data)) + data
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"icns" + struct.pack(">I", 8 + len(body)) + body)
    print("wrote", path.relative_to(BASE))


# ---------------------------------------------------------------- web / PWA
print("== web & PWA ==")
save_png(master, 16,  OUT / "favicon-16.png")
save_png(master, 32,  OUT / "favicon-32.png")
save_png(opaque(master, 180), 180, OUT / "apple-touch-icon.png")
save_png(master, 192, OUT / "icon-192.png")
save_png(master, 512, OUT / "icon-512.png")

# favicon.ico (multi-resolution, for browsers)
ICO_SIZES = [(16, 16), (32, 32), (48, 48)]
ico = resample(master, 48)
(OUT / "favicon.ico").parent.mkdir(parents=True, exist_ok=True)
ico.save(OUT / "favicon.ico", format="ICO", sizes=ICO_SIZES)
print("wrote icons/favicon.ico")
ico.save(BASE / "favicon.ico", format="ICO", sizes=ICO_SIZES)
print("wrote favicon.ico (site root — browser default location)")

# maskable PWA icon (logo at ~72% safe zone on brand navy)
mask = Image.new("RGBA", (512, 512), NAVY + (255,))
inner = master.resize((370, 370), Image.LANCZOS)
mask.alpha_composite(inner, ((512 - 370) // 2, (512 - 370) // 2))
save_png(mask, 512, OUT / "icon-maskable-512.png")

# ---------------------------------------------------------------- Windows
print("== Windows ==")
win = DIST / "windows"
win.mkdir(parents=True, exist_ok=True)
resample(master, 256).save(
    win / "icon.ico", format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("wrote pkg/icons/dist/windows/icon.ico")

# ---------------------------------------------------------------- macOS
print("== macOS ==")
ICNS = [  # (fourcc, pixel size)
    ("icp4", 16), ("icp5", 32), ("icp6", 64),
    ("ic07", 128), ("ic08", 256), ("ic09", 512), ("ic10", 1024),
]
write_icns(DIST / "macos" / "icon.icns", [(f, resample(master, s)) for f, s in ICNS])

# iconset for macOS `iconutil` users (identical content, classic layout)
iconset = DIST / "macos" / "icon.iconset"
iconset.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 128, 256, 512):
    save_png(master, size, iconset / f"icon_{size}x{size}.png")
    save_png(master, size * 2, iconset / f"icon_{size}x{size}@2x.png")

# ---------------------------------------------------------------- Linux
print("== Linux (snap/deb hicolor tree) ==")
for size in (16, 24, 32, 48, 64, 128, 256, 512):
    save_png(master, size,
             DIST / "linux" / "hicolor" / f"{size}x{size}" / "apps" / f"{NAME}.png")
print("done.")
