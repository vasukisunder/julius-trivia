#!/usr/bin/env python3
"""
Pulls generated sticker art off its flat background and writes a real alpha channel.

Why a saturated key colour rather than white, black, or a transparency checkerboard:
the art has pure white die-cut borders and heavy black ink outlines, so on a white
or black background the border pixels are bit-identical to the background and no
amount of cleverness separates them. Measured on a baked checkerboard, the best
lattice-based repair recovered IoU 0.43-0.71 and ate up to 42% of the sticker.

Magenta appears in none of the palettes — they are all faded vintage colours, which
are desaturated by definition — so every art pixel is far from the key and the split
is exact.

Edges are unmixed rather than thresholded: an anti-aliased pixel is a blend of art
and key, so the key's contribution is subtracted back out instead of leaving a pink
fringe around every sticker.

    python3 tools/key.py --dir raw/ --out public/stickers/    # writes .webp
    python3 tools/key.py one.png out.webp
"""
import argparse
import os
import numpy as np
from PIL import Image

NEAR, FAR = 70.0, 150.0   # distance to key: fully transparent / fully opaque
MIN_SAT = 90              # a key colour flatter than this is probably not a key


def key_colour(rgb: np.ndarray) -> np.ndarray:
    """The background, sampled from the corners rather than assumed."""
    h, w = rgb.shape[:2]
    m = max(4, min(h, w) // 40)
    corners = np.concatenate([
        rgb[:m, :m].reshape(-1, 3), rgb[:m, -m:].reshape(-1, 3),
        rgb[-m:, :m].reshape(-1, 3), rgb[-m:, -m:].reshape(-1, 3),
    ])
    return np.median(corners, axis=0)


def key_out(path: str) -> tuple[Image.Image, str]:
    im = Image.open(path).convert('RGBA')
    a = np.array(im).astype(np.float64)
    rgb, alpha = a[..., :3], a[..., 3]

    if (alpha < 250).mean() > 0.02:
        return im, 'already transparent, left alone'

    k = key_colour(rgb)
    if float(k.max() - k.min()) < MIN_SAT:
        return im, f'background {tuple(int(v) for v in k)} is not a saturated key — skipped'

    dist = np.sqrt(((rgb - k) ** 2).sum(axis=2))
    frac = np.clip((dist - NEAR) / (FAR - NEAR), 0.0, 1.0)   # 0 = key, 1 = art

    # Unmix: pixel = frac*art + (1-frac)*key, so recover art. Guarded against a
    # divide-by-zero where frac is 0 and the result is discarded anyway.
    safe = np.maximum(frac, 1e-3)[..., None]
    art = np.clip((rgb - (1.0 - safe) * k) / safe, 0, 255)

    out = np.dstack([art, frac * 255.0]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA'), 'keyed'


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('path', nargs='?')
    ap.add_argument('out_path', nargs='?')
    ap.add_argument('--dir')
    ap.add_argument('--out')
    ap.add_argument('--size', type=int, default=256,
                    help='longest edge of the written file (default 256)')
    args = ap.parse_args()

    def write(img: Image.Image, dest: str) -> None:
        img.thumbnail((args.size, args.size), Image.LANCZOS)
        img.save(dest, 'WEBP', quality=92, alpha_quality=100, method=6)

    if args.dir:
        out_dir = args.out or 'keyed'
        os.makedirs(out_dir, exist_ok=True)
        for name in sorted(os.listdir(args.dir)):
            if not name.lower().endswith(('.png', '.webp', '.jpg', '.jpeg')):
                continue
            img, note = key_out(os.path.join(args.dir, name))
            dest = os.path.join(out_dir, os.path.splitext(name)[0] + '.webp')
            write(img, dest)
            print(f'{name}: {note}')
    elif args.path:
        img, note = key_out(args.path)
        write(img, args.out_path or args.path.rsplit('.', 1)[0] + '.webp')
        print(f'{os.path.basename(args.path)}: {note}')
    else:
        ap.error('give a file or --dir')


if __name__ == '__main__':
    main()
