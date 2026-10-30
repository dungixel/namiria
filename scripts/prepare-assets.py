#!/usr/bin/env python3
"""
Turns the raw art in ./Resources into game-ready assets in ./src/assets.

  * Sprites  : the sketches sit on a flat cream background. We convert that
               background to transparency ("color to alpha"), keep the line art
               exactly as drawn, and fill the inside of each silhouette with the
               cream colour so mountains / other units don't show through the body.
               Every sprite is cropped to its content and scaled by the SAME factor,
               so relative sizes between poses are preserved.
  * Cards    : the six card faces are cropped out of Cards.jpg (hand-drawn border is
               kept, the area outside the border becomes transparent).
  * Manifest : src/assets/manifest.json with the pixel sizes of every output.

The generated files are committed, so you only need to re-run this if the art in
./Resources changes:

    pip install pillow numpy scipy
    python3 scripts/prepare-assets.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Resources"
OUT = ROOT / "src" / "assets"

PAPER = np.array([252, 232, 222], dtype=float)  # background of the sketches
INK = np.array([92, 58, 56], dtype=float)       # colour of the line art
SPRITE_SCALE = 0.5                               # shared by every sprite
CARD_WIDTH = 400

SPRITES = ["Idle", "Attack", "Special", "Step", "Block", "Grab"]
ICON_BOTTOM = {"attack": 0.74, "special": 0.72, "step": 0.65, "block": 0.72, "grab": 0.65, "change": 0.66}  # where the card label starts
CARD_ORDER = ["attack", "special", "step", "block", "grab", "change"]  # reading order of Cards.jpg


def color_to_alpha(rgb: np.ndarray) -> np.ndarray:
    """Alpha of the ink layer, assuming pixel = PAPER*(1-a) + INK*a."""
    a = ((PAPER - rgb) / (PAPER - INK)).mean(axis=2)
    a = np.clip(a, 0.0, 1.0)
    a[a < 0.03] = 0.0
    return a


def disk(r: int) -> np.ndarray:
    y, x = np.ogrid[-r : r + 1, -r : r + 1]
    return x * x + y * y <= r * r


def process_sprite(name: str) -> tuple[Image.Image, dict]:
    im = Image.open(SRC / "Sprites" / "Umiro" / f"{name}.png").convert("RGB")
    im = im.resize((round(im.width * SPRITE_SCALE), round(im.height * SPRITE_SCALE)), Image.LANCZOS)
    rgb = np.asarray(im, dtype=float)
    ink_a = color_to_alpha(rgb)

    # silhouette = outline closed over small gaps, then holes filled
    # (sketch outlines have small gaps, so we flood the OUTSIDE against a thickened outline,
    #  call everything the flood did not reach "inside", then trim the halo back)
    r = 9
    pad = r + 4
    line = np.pad(ink_a > 0.12, pad)
    thick = ndi.binary_dilation(line, structure=disk(r))
    lab, _ = ndi.label(~thick)
    border = np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))
    outside = np.isin(lab, border[border > 0])
    inside = ndi.binary_erosion(~outside, structure=disk(r))
    inside = ndi.binary_fill_holes(inside | line)[pad:-pad, pad:-pad]
    fill_a = inside.astype(float)

    out_a = ink_a + fill_a * (1 - ink_a)
    color = np.zeros_like(rgb)
    safe = np.maximum(out_a, 1e-6)[..., None]
    color = (INK * ink_a[..., None] + PAPER * (fill_a * (1 - ink_a))[..., None]) / safe
    rgba = np.dstack([np.clip(color, 0, 255), out_a * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")

    bbox = img.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    pad = 3
    bbox = (max(bbox[0] - pad, 0), max(bbox[1] - pad, 0), min(bbox[2] + pad, img.width), min(bbox[3] + pad, img.height))
    img = img.crop(bbox)
    return img, {"w": img.width, "h": img.height}


def process_cards() -> dict:
    sheet = Image.open(SRC / "Cards.jpg").convert("RGB")
    rgb = np.asarray(sheet, dtype=float)
    dark = rgb.sum(axis=2) < 450
    lab, n = ndi.label(ndi.binary_dilation(dark, structure=disk(3)))
    boxes = []
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        if w > 400 and h > 600:  # the card frames
            boxes.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
    assert len(boxes) == 6, f"expected 6 card frames, found {len(boxes)}"
    boxes.sort(key=lambda b: (round(b[1] / 700), b[0]))  # rows, then columns

    manifest = {}
    for key, (x0, y0, x1, y1) in zip(CARD_ORDER, boxes):
        pad = 6
        crop = sheet.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
        c = np.asarray(crop, dtype=float)
        # outside of the hand-drawn border -> transparent (flood from the edges)
        near_paper = (np.abs(c - PAPER).sum(axis=2) < 60)
        outside = np.zeros_like(near_paper)
        seeds = np.zeros_like(near_paper)
        seeds[0, :] = seeds[-1, :] = seeds[:, 0] = seeds[:, -1] = True
        lab2, _ = ndi.label(near_paper)
        edge_labels = np.unique(lab2[seeds & near_paper])
        outside = np.isin(lab2, edge_labels[edge_labels > 0])
        alpha = np.where(outside, 0, 255).astype(np.uint8)
        alpha = ndi.gaussian_filter(alpha.astype(float), 0.8).astype(np.uint8)
        rgba = np.dstack([np.asarray(crop), alpha])
        img = Image.fromarray(rgba, "RGBA")
        h = round(img.height * CARD_WIDTH / img.width)
        img = img.resize((CARD_WIDTH, h), Image.LANCZOS)
        img.save(OUT / "cards" / f"{key}.webp", quality=92, method=6)
        manifest[key] = {"w": img.width, "h": img.height}

        # the artwork alone (no frame / label), transparent, reused as in-game effects
        cw, ch = crop.size
        art = crop.crop((int(cw * 0.2), int(ch * 0.07), int(cw * 0.8), int(ch * ICON_BOTTOM.get(key, 0.7))))
        a = color_to_alpha(np.asarray(art, dtype=float))
        icon = np.dstack([np.broadcast_to(INK, a.shape + (3,)), a * 255]).astype(np.uint8)
        icon_img = Image.fromarray(icon, "RGBA")
        bb = icon_img.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
        icon_img = icon_img.crop(bb)
        icon_img = icon_img.resize((256, round(icon_img.height * 256 / icon_img.width)), Image.LANCZOS)
        icon_img.save(OUT / "icons" / f"{key}.webp", lossless=True, method=6)
        manifest.setdefault("_icons", {})[key] = {"w": icon_img.width, "h": icon_img.height}
    return manifest


def main() -> None:
    (OUT / "sprites" / "umiro").mkdir(parents=True, exist_ok=True)
    (OUT / "cards").mkdir(parents=True, exist_ok=True)
    (OUT / "icons").mkdir(parents=True, exist_ok=True)
    manifest: dict = {"spriteScale": SPRITE_SCALE, "sprites": {}, "cards": {}}

    for name in SPRITES:
        img, meta = process_sprite(name)
        img.save(OUT / "sprites" / "umiro" / f"{name.lower()}.webp", lossless=True, method=6)
        manifest["sprites"][f"umiro/{name.lower()}"] = meta
        print("sprite", name, meta)

    cards = process_cards()
    manifest["icons"] = cards.pop("_icons")
    manifest["cards"] = cards
    print("cards", manifest["cards"])
    print("icons", manifest["icons"])

    # favicon: the head of Umiro
    idle = Image.open(OUT / "sprites" / "umiro" / "idle.webp")
    head = idle.crop((0, 0, idle.width, int(idle.width * 0.95)))
    side = max(head.size)
    fav = Image.new("RGBA", (side, side), (252, 232, 222, 255))
    fav.alpha_composite(head, ((side - head.width) // 2, 0))
    fav.resize((128, 128), Image.LANCZOS).save(ROOT / "public" / "favicon.png")

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print("done")


if __name__ == "__main__":
    (ROOT / "public").mkdir(exist_ok=True)
    main()
