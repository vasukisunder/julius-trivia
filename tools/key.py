#!/usr/bin/env python3
"""
Turns generated sticker art into game assets: keys out the flat background, writes a
real alpha channel, crops to the art and encodes WebP.

Why a saturated key colour and not transparency: asked for a transparent background,
the image model paints the *symbol* for it — an opaque grey-and-white checkerboard.
That is unrecoverable here, because the art has pure white die-cut borders, so a
border pixel landing on a white checker square is bit-identical to the background,
and half of every border does. A lattice-based repair measured IoU 0.43-0.71 and ate
up to 42% of the sticker. White and black are out for the same reason: the art uses
both, heavily.

How this survives a background that is neither pure nor uniform:

  - The key is sampled per image from the border ring, because the generated pink
    drifts (R 194-235, G 27-106 across the set) and a hard-coded #FF00FF would miss.
  - Selection is by connectivity, not colour alone. Some art sits close to the key —
    an oxblood car interior is 121 away from it — and a global colour threshold would
    punch holes in it. Flood-filling from the border cannot, because the white
    die-cut ring is 230-odd away from the key and walls the interior off.
  - Only the largest remaining component survives, which drops the UI artifact one
    export picked up in its top-left corner along with any stray speck.
  - Edges are unmixed rather than thresholded: an anti-aliased pixel is a blend of
    art and key, so the key's contribution is subtracted back out instead of leaving
    a pink fringe around every sticker.
  - Output is cropped to the art before resizing, so stickers come out the same
    apparent size however much empty background the model left around them.

    python3 tools/key.py --dir raw/ --out public/stickers/
"""
import argparse
import os
import numpy as np
from PIL import Image
from scipy import ndimage

NEAR, FAR = 46.0, 108.0   # distance from the key: fully transparent / fully opaque
FLOOD_TOL = 96.0          # generous, because connectivity does the real work
MIN_SAT = 60              # a flatter background than this is probably not a key
ENCLOSED_TOL = 14.0      # key colour walled inside the art; fixed, see below
CREAM = np.array([244.0, 239.0, 226.0])   # the one colour common to every palette


def sample_key(rgb: np.ndarray) -> tuple[np.ndarray, float]:
    """The background colour and how much it varies, from the border ring."""
    ring = np.concatenate([
        rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3),
        rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3),
    ])
    k = np.median(ring, axis=0)
    spread = float(np.percentile(np.sqrt(((ring - k) ** 2).sum(axis=1)), 98))
    return k, spread


def key_out(path: str) -> tuple[Image.Image | None, str]:
    im = Image.open(path).convert('RGB')
    rgb = np.array(im).astype(np.float64)

    k, spread = sample_key(rgb)
    if float(k.max() - k.min()) < MIN_SAT:
        return None, f'background {tuple(int(v) for v in k)} is not a saturated key'

    dist = np.sqrt(((rgb - k) ** 2).sum(axis=2))

    # Everything the key could plausibly reach, then only the part of it joined to
    # the frame edge.
    candidate = dist <= max(FLOOD_TOL, spread * 1.6)
    labels, _ = ndimage.label(candidate)
    edge = np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])
    outside = np.isin(labels, np.unique(edge[edge > 0]))

    # Soft coverage, applied only in the band where background meets art, so a
    # near-key colour deep inside the sticker is left fully opaque.
    frac = np.clip((dist - NEAR) / (FAR - NEAR), 0.0, 1.0)
    band = ndimage.binary_dilation(outside, iterations=3)
    alpha = np.where(band, frac, 1.0)

    # One sticker per file: keep the largest piece and its soft rim, drop the UI
    # artifact one export picked up in its corner along with any stray speck.
    solid = alpha > 0.5
    labels, n = ndimage.label(solid)
    if n == 0:
        return None, 'nothing left after keying'
    if n > 1:
        sizes = ndimage.sum(solid, labels, range(1, n + 1))
        keep = ndimage.binary_dilation(labels == 1 + int(np.argmax(sizes)), iterations=4)
        alpha = np.where(keep, alpha, 0.0)

    # Some stickers come back with the key colour *inside* them: the model drew a
    # round sticker and filled the disc with the background instead of a real colour.
    # The flood fill cannot reach it — the white border encloses it — and it is not a
    # keying failure but a generation one. Repaired to the cream that runs through
    # nearly every palette in this set, which is better than leaving a magenta disc
    # on a deep indigo stage. Regenerating the file is the real fix.
    # Some stickers come back with the key colour *inside* them: the model drew a
    # round sticker and filled the disc with the background instead of a real colour,
    # or left it showing through a handle loop. The flood fill cannot reach it, since
    # the art encloses it — this is a generation fault, not a keying one.
    #
    # The tolerance here is fixed, deliberately. Scaling it by the background spread
    # put a cream blotch through the middle of a red heart, because that image had a
    # noisy background and a pink subject. Measured at a fixed 14, an enclosed fill is
    # 11k-183k pixels and genuinely pink *art* is zero pixels — the fills are the same
    # colour the generator used for the background, and art never is.
    enclosed = (dist <= ENCLOSED_TOL) & ~outside & (alpha > 0.5)
    # Grown over the fill's own anti-aliased rim, but only into pixels still clearly
    # key-ish, so it cannot creep into the artwork.
    enclosed = (ndimage.binary_dilation(enclosed, iterations=3)
                & (dist <= FLOOD_TOL * 0.6) & ~outside & (alpha > 0.5))

    note_extra = ''
    labels, n = ndimage.label(enclosed)
    if n:
        area = float((alpha > 0.5).sum())
        big = [i for i, a in enumerate(ndimage.sum(enclosed, labels, range(1, n + 1)), 1)
               if a > 0.005 * area]          # ignore specks
        if big:
            fill = np.isin(labels, big)
            rgb = rgb.copy()
            rgb[fill] = CREAM
            note_extra = f', filled {fill.sum() / area * 100:.0f}% enclosed key with cream'

    # Unmix: pixel = a*art + (1-a)*key.
    safe = np.maximum(alpha, 1e-3)[..., None]
    art = np.clip((rgb - (1.0 - safe) * k) / safe, 0, 255)

    out = np.dstack([art, alpha * 255.0]).astype(np.uint8)

    # Crop to the art so stickers come out a consistent size.
    ys, xs = np.nonzero(out[..., 3] > 8)
    if len(ys) == 0:
        return None, 'nothing left after keying'
    pad = 2
    y0, y1 = max(0, ys.min() - pad), min(out.shape[0], ys.max() + 1 + pad)
    x0, x1 = max(0, xs.min() - pad), min(out.shape[1], xs.max() + 1 + pad)
    return Image.fromarray(out[y0:y1, x0:x1], 'RGBA'), 'keyed' + note_extra


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', required=True)
    ap.add_argument('--out', required=True)
    # Resolution matched to display size rather than uniform: objects render at up
    # to 100px on the stage and postcards at up to 204px, so a flat 256 was both
    # wasteful for one and thin for the other.
    ap.add_argument('--size', type=int, default=208, help='longest edge, objects')
    ap.add_argument('--card-size', type=int, default=416, help='longest edge, postcards')
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    ok = bad = 0
    for name in sorted(os.listdir(args.dir)):
        if not name.lower().endswith(('.png', '.webp', '.jpg', '.jpeg')):
            continue
        img, note = key_out(os.path.join(args.dir, name))
        if img is None:
            print(f'  SKIP {name}: {note}')
            bad += 1
            continue
        if note != 'keyed':
            print(f'  {name}: {note}')
        edge = args.card_size if name.startswith('postcard-') else args.size
        img.thumbnail((edge, edge), Image.LANCZOS)
        img.save(os.path.join(args.out, os.path.splitext(name)[0] + '.webp'),
                 'WEBP', quality=86, alpha_quality=100, method=6)
        ok += 1
    print(f'{ok} keyed, {bad} skipped -> {args.out}')


if __name__ == '__main__':
    main()
