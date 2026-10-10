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


def save(im, name):
    path = IMAGES / name if "/" not in name else ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix == ".jpg":
        im.save(path, quality=88, optimize=True, progressive=True)
    else:
        im.save(path, optimize=True)
    print(f"{path.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}")


# Portraits replacing the template's model.
save(crop("preview-6.jpg", (870, 869), 0.59, 0.42, 0.47), "tEtevi8JenLoBT4YdyPpWydOJg.png")  # avatars, "2026", "it's me"
save(crop("preview-2.jpg", (870, 869), 0.55, 0.40, 0.45), "O9xt0wGigYzX3kxKzDZ20639Y.jpg")  # About signature avatar
save(crop("IMG_4047.jpg", (382, 456), 0.52, 0.50, 0.55), "M2iKrRxfHsXjyXQCMHtRP56IA.png")  # inline photo in the hero sentence
save(crop("IMG_5195.jpg", (938, 898), 0.50, 0.67, 0.56), "wxpAecGN18uH8LxIHrSmqj7J5s.png")  # contact polaroid "random shot"
save(crop("IMG_4383.jpg", (1269, 1270), 0.40, 0.50, 0.56), "BpemFTgeHqmOEbavaTetbkDYBn0.png")  # contact polaroid "tiny moment!"

# Case study card covers (3:2, shown cover-cropped at several aspects, so the
# subject sits in the middle).
save(logo_card("briefly-dark.png", (2400, 1603), 0.46), "veyOMFLFvf4bfZJKXrpyPNzQWiw.jpg")  # Briefly: All Things Podcasts
save(logo_card("briefly-light.png", (2400, 1603), 0.46), "Hp4sdb6mgJqCAExV0ytS7gljgkA.jpg")  # The Briefly Look
save(crop("IMG_4690.jpg", (1114, 743), 0.42, 0.40, 1.0), "lRamgmULf2QHd5nO7cNT2LpLR5M.jpg")  # Seven Slides a Day
save(crop("preview-5.jpg", (1092, 728), 0.48, 0.47, 0.67), "77vnsoqQ0X6oMVSzYgh7nMkdh0.jpg")  # Under the Hood

# Logos: nav mark, favicons (light and dark), touch icon, share image.
light, _ = mark("briefly-light.png")
dark, dark_bg = mark("briefly-dark.png")
save(light.resize((256, 256), Image.LANCZOS), "site/brand/briefly-mark.png")
save(light.resize((64, 64), Image.LANCZOS), "wjwqrOUY5j7XeCzEQHXDiOX9dE.png")
save(dark.resize((64, 64), Image.LANCZOS), "site/brand/favicon-dark.png")
save(light.resize((180, 180), Image.LANCZOS), "ZMWEi8bXq0UHyMgEUcSAtJsVRKg.jpg")

og = Image.new("RGB", (1200, 630), dark_bg)
og.paste(dark.resize((300, 300), Image.LANCZOS), (110, 165))
d = ImageDraw.Draw(og)
bold = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-SemiBold.otf", 64)
regular = ImageFont.truetype("/usr/share/fonts/opentype/inter/Inter-Regular.otf", 34)
d.text((470, 235), "Htoo Myat Kyaw", font=bold, fill=(245, 243, 240))
d.text((472, 330), "Co-founder of Briefly", font=regular, fill=(190, 186, 182))
save(og, "fLhqLc1Zfa1vomoVNhwjalzo.jpg")

# Timeline icon for the first (Briefly) entry on About: an SVG wrapping the mark.
buf = io.BytesIO()
light.resize((80, 80), Image.LANCZOS).save(buf, "PNG", optimize=True)
uri = base64.b64encode(buf.getvalue()).decode()
(IMAGES / "aWwxH6dqmUu5jCNRFneN4Z8gLE0.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">'
    f'<image href="data:image/png;base64,{uri}" width="40" height="40"/></svg>\n'
)
print("site/_ext/framerusercontent.com/images/aWwxH6dqmUu5jCNRFneN4Z8gLE0.svg  timeline icon")
