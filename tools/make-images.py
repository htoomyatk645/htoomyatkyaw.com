#!/usr/bin/env python3
"""Generate the site's photos and logos from brand/.

    python3 tools/make-images.py

Each template image keeps its file name (so no HTML/JS has to change) and its
original aspect ratio; the new content is cropped around the subject. Crop
centres are fractions of the source image (fx, fy) and `span` is the crop
height as a fraction of the source height (capped to fit the image).
"""
import base64
import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "brand/photos"
LOGOS = ROOT / "brand/logos"
IMAGES = ROOT / "site/_ext/framerusercontent.com/images"
BRAND_OUT = ROOT / "site/brand"


def crop(src, size, fx, fy, span):
    """Crop `src` to the aspect of `size` around (fx, fy), then resize."""
    im = ImageOps.exif_transpose(Image.open(PHOTOS / src)).convert("RGB")
    W, H = im.size
    tw, th = size
    aspect = tw / th
    h = min(H * span, H, W / aspect)
    w = h * aspect
    cx, cy = fx * W, fy * H
    left = min(max(cx - w / 2, 0), W - w)
    top = min(max(cy - h / 2, 0), H - h)
    box = tuple(round(v) for v in (left, top, left + w, top + h))
    return im.crop(box).resize(size, Image.LANCZOS)


def mark(name):
    """The Briefly mascot from a logo file, trimmed to a square around it."""
    im = Image.open(LOGOS / name).convert("RGB")
    # Background = most common colour; ignore a thin border some exports have.
    bg = max(im.getcolors(im.size[0] * im.size[1]))[1]
    edge = 8
    im = im.crop((edge, edge, im.size[0] - edge, im.size[1] - edge))
    diff = Image.eval(
        Image.merge("RGB", [c.point(lambda v, b=b: 255 if abs(v - b) > 60 else 0) for c, b in zip(im.split(), bg)]),
        lambda v: v,
    ).convert("L")
    l, t, r, b = diff.getbbox()
    side = max(r - l, b - t)
    cx, cy = (l + r) / 2, (t + b) / 2
    canvas = Image.new("RGB", (side, side), bg)
    canvas.paste(im.crop((round(cx - side / 2), round(cy - side / 2), round(cx + side / 2), round(cy + side / 2))), (0, 0))
    return canvas, bg


def logo_card(name, size, scale):
    """Logo centred on its own background colour, mark `scale` x card height."""
    m, bg = mark(name)
    card = Image.new("RGB", size, bg)
    s = round(size[1] * scale)
    m = m.resize((s, s), Image.LANCZOS)
    card.paste(m, ((size[0] - s) // 2, (size[1] - s) // 2))
    return card


def fit_card(src, scale, size=(1200, 1357)):
    """Fit a white-background graphic inside a card-shaped white canvas.

    The home page shows case-study covers at 604x683 (this aspect); other
    pages crop them wider, which only trims the white margins."""
    im = Image.open(ROOT / "brand" / src).convert("RGBA")
    flat = Image.new("RGB", im.size, "white")
    flat.paste(im, mask=im.split()[3])
    # Trim white margins so the graphic, not the margin, is what gets scaled.
    ink = flat.convert("L").point(lambda v: 255 if v < 235 else 0).getbbox()
    pad = round(0.06 * max(ink[2] - ink[0], ink[3] - ink[1]))
    flat = flat.crop((max(ink[0] - pad, 0), max(ink[1] - pad, 0), min(ink[2] + pad, flat.width), min(ink[3] + pad, flat.height)))
    w, h = size
    k = min(w * scale / flat.width, h * scale / flat.height)
    flat = flat.resize((round(flat.width * k), round(flat.height * k)), Image.LANCZOS)
    card = Image.new("RGB", size, "white")
    card.paste(flat, ((w - flat.width) // 2, (h - flat.height) // 2))
    return card


def bleed_card(src, art=1800, size=(2100, 1900), left=300, top=50, grid=50):
    """The Bionic Redr cover (a square on dotted paper, with a panel bleeding
    off its right and bottom edges) set into a wider card.

    The home page cover-crops cards to about 0.88:1 and the case-study grid to
    about 1.38:1. The art sits against the card's right edge, so the panel
    still bleeds off it; the paper on the left and top gets the same dot grid
    (one dot every `grid` px at this size), and the panel's last row is
    stretched down to the bottom edge. Both crops keep the logo, title and
    tags; the portrait one trims a little off the panel."""
    im = Image.open(ROOT / "brand" / src).convert("RGB").resize((art, art), Image.LANCZOS)
    W, H = size
    assert left + art == W and top % grid == 0 and left % grid == 0
    bg = im.getpixel((5, 5))
    card = Image.new("RGB", size, bg)
    card.paste(im.crop((0, art - 1, art, art)).resize((art, H - top - art)), (left, top + art))
    card.paste(im, (left, top))
    dot = im.crop((grid // 2 - 7, grid // 2 - 7, grid // 2 + 8, grid // 2 + 8))
    near = lambda c: max(abs(a - b) for a, b in zip(c, bg)) <= 3
    for y in range(grid // 2 - 7, H - 15, grid):
        for x in range(grid // 2 - 7, W - 15, grid):
            if x > left - 15 and top - 15 < y < top + art:
                continue
            if all(near(card.getpixel((x + dx, y + dy))) for dx in (0, 7, 14) for dy in (0, 7, 14)):
                card.paste(dot, (x, y))
    return card

def fan_card(src, size=(2000, 1700), height=0.84, bg=(250, 248, 247)):
    """A transparent graphic (with its shadows) centred on a paper-coloured card.

    The card is wider than any frame it is shown in and the graphic sits well
    inside it, so cover-cropping at the home page's portrait aspect or the
    wider aspects elsewhere never cuts into it."""
    im = Image.open(ROOT / "brand" / src).convert("RGBA")
    im = im.crop(im.getchannel("A").getbbox())
    k = size[1] * height / im.height
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    card = Image.new("RGB", size, bg)
    card.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2), im)
    return card


def save(im, name):
    path = IMAGES / name if "/" not in name else ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix == ".jpg":
        im.save(path, quality=88, optimize=True, progressive=True)
    else:
        im.save(path, optimize=True)
    print(f"{path.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}")


# Portraits replacing the template's model.
save(crop("graduation.jpg", (870, 869), 0.50, 0.45, 1.0), "tEtevi8JenLoBT4YdyPpWydOJg.png")  # avatars, "2026", "it's me"
save(crop("graduation.jpg", (870, 869), 0.50, 0.40, 0.75), "O9xt0wGigYzX3kxKzDZ20639Y.jpg")  # About signature avatar
save(crop("IMG_4047.jpg", (382, 456), 0.52, 0.50, 0.55), "M2iKrRxfHsXjyXQCMHtRP56IA.png")  # inline photo in the hero sentence
save(crop("boston-common.jpg", (938, 898), 0.62, 0.66, 0.60), "wxpAecGN18uH8LxIHrSmqj7J5s.png")  # contact polaroid, left
save(crop("IMG_4383.jpg", (1269, 1270), 0.40, 0.50, 0.56), "BpemFTgeHqmOEbavaTetbkDYBn0.png")  # contact polaroid "tiny moment!"

# Case study card covers (3:2, shown cover-cropped at several aspects, so the
# subject sits in the middle).
save(logo_card("briefly-dark.png", (2400, 1603), 0.46), "veyOMFLFvf4bfZJKXrpyPNzQWiw.jpg")  # Briefly: All Things Podcasts
save(fit_card("briefly/app-icon-tags.png", 0.88), "Hp4sdb6mgJqCAExV0ytS7gljgkA.jpg")  # The Briefly Look
save(fan_card("briefly/seven-slides-fan.png"), "lRamgmULf2QHd5nO7cNT2LpLR5M.jpg")  # Seven Slides a Day: three example slides
save(bleed_card("bionic-redr/cover.webp"), "77vnsoqQ0X6oMVSzYgh7nMkdh0.jpg")  # Bionic Redr (Under the Hood)

# "my app" polaroid on the home page: the Briefly app screenshot, full height
# (the card is made taller with CSS in tools/rebrand.json).
save(Image.open(ROOT / "brand/briefly/app-screenshot.jpg").convert("RGB"), "jaipCY5FvgftEDz3qtilGNnLVk.png")

# Playground: square photos (shown cover-cropped), subject centred.
for src, fx, fy, name in [
    ("IMG_6247.jpg", 0.48, 0.33, "dePDiIbQ0pEr3GA9qJX5vggP8c.png"),   # tiny details, big difference
    ("IMG_3777.jpg", 0.50, 0.45, "hkqAE76OI4thM32d4iwu4EFQps.png"),   # whiteboard, day 3
    ("IMG_4690.jpg", 0.42, 0.45, "ImWtq4yKP0WdM1PBrSczsl11z1A.png"),  # launch-week energy
    ("preview-3.jpg", 0.55, 0.45, "h4E4SLgLCRWR0vwuAQOQvUvGn0.png"),  # random shot
    ("IMG_4257.jpg", 0.50, 0.40, "8WCddJF9lKOfd38rMGa4CTi7egs.png"),  # tiny moments
    ("IMG_5462.jpg", 0.50, 0.58, "GeBUV4VcRCbGk0YtC0xD3Hts4.png"),    # first draft, don't judge
    ("preview-4.jpg", 0.52, 0.60, "htQBJ0hwpd8OwRHUnkgEDJuVDo.png"),  # on the green line, thinking
    ("IMG_3145.jpg", 0.58, 0.62, "HTUAceLZFBiFgG7xm5wwwQXQM.png"),    # flower!
]:
    save(crop(src, (1200, 1200), fx, fy, 1.0), name)

# Logos. The tab icon, the nav mark (top left) and the touch icon are a
# portrait; the Briefly mark stays on the About timeline (below).
light, _ = mark("briefly-light.png")


def round_icon(im, size):
    """Circular icon with transparent corners (supersampled for clean edges)."""
    big = im.resize((size * 4, size * 4), Image.LANCZOS).convert("RGBA")
    m = Image.new("L", big.size, 0)
    ImageDraw.Draw(m).ellipse((0, 0, big.width - 1, big.height - 1), fill=255)
    big.putalpha(m)
    return big.resize((size, size), Image.LANCZOS)


face = crop("icon-portrait.jpg", (1024, 1024), 0.42, 0.49, 0.46)
save(round_icon(face, 256), "site/brand/portrait-mark.png")  # nav, top left
save(round_icon(face, 64), "wjwqrOUY5j7XeCzEQHXDiOX9dE.png")  # favicon
save(round_icon(face, 64), "site/_ext/framerusercontent.com/assets/wjwqrOUY5j7XeCzEQHXDiOX9dE.png")  # same, as the JS references it
save(round_icon(face, 64), "site/brand/favicon-dark.png")  # favicon, dark mode
save(face.resize((180, 180), Image.LANCZOS), "ZMWEi8bXq0UHyMgEUcSAtJsVRKg.jpg")  # apple-touch-icon (iOS rounds it)

# Link preview: rendered from tools/og/og.html by tools/og/render.mjs.
og = Image.open(ROOT / "brand/og.png").convert("RGB")
save(og, "fLhqLc1Zfa1vomoVNhwjalzo.jpg")
save(og, "site/_ext/framerusercontent.com/assets/fLhqLc1Zfa1vomoVNhwjalzo.jpg")

# Timeline icon for the first (Briefly) entry on About: an SVG wrapping the mark.
buf = io.BytesIO()
light.resize((80, 80), Image.LANCZOS).save(buf, "PNG", optimize=True)
uri = base64.b64encode(buf.getvalue()).decode()
(IMAGES / "aWwxH6dqmUu5jCNRFneN4Z8gLE0.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">'
    f'<image href="data:image/png;base64,{uri}" width="40" height="40"/></svg>\n'
)
print("site/_ext/framerusercontent.com/images/aWwxH6dqmUu5jCNRFneN4Z8gLE0.svg  timeline icon")

# Timeline icons for the other About entries (the template had stock logos):
# square monogram badges in each organisation's colour.
for name, label, bg in [
    ("oCWnU4BxvjGfHzEiZF1rhnFs.svg", "HRI", "#3172AE"),     # Tufts HRI Lab (Tufts blue)
    ("c8llj7bjZDasXPotcD32uirJjwU.svg", "RNA", "#46166B"),  # The RNA Institute, UAlbany (purple)
    ("yMcXNSNKzTKIukLJc4d9uhurDwE.svg", "AMC", "#00539B"),  # Albany Medical Center (blue)
]:
    (IMAGES / name).write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">'
        f'<rect width="40" height="40" fill="{bg}"/>'
        f'<text x="20" y="25" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" '
        f'font-size="13" letter-spacing=".5" fill="#fff">{label}</text></svg>\n'
    )
    print(f"site/_ext/framerusercontent.com/images/{name}  timeline icon {label}")
