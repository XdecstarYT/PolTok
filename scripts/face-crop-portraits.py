#!/usr/bin/env python3
"""Re-crop official portraits so the face fills the frame (head-and-shoulders), instead of a blind centre/top crop.

Usage: python3 -I scripts/face-crop-portraits.py <dir with original downloads named by slug> <public/portraits/au>
Originals come from the `i` (image) URLs recorded in src/data/photos/official.ts. When no face is found the existing
file is left untouched. Output: 256x256 WebP, same file names, so official.ts does not change.
"""
import os
import sys

import cv2
from PIL import Image, ImageOps

SRC, DST = sys.argv[1], sys.argv[2]
front = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
alt = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')


def face(gray):
    h, w = gray.shape
    mn = max(24, int(min(w, h) * 0.04))
    best = None
    for c in (front, alt):
        for (x, y, fw, fh) in c.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6, minSize=(mn, mn)):
            # prefer big faces in the upper two-thirds of the photo
            score = fw * fh * (1.0 if y + fh / 2 < h * 0.7 else 0.4)
            if not best or score > best[0]:
                best = (score, x, y, fw, fh)
        if best:
            break
    return best[1:] if best else None


# hand-checked crops where detection fails or picks the wrong spot: (centre x, centre y, side) as fractions of width
MANUAL = {
    'amy-espeseth': (0.50, 0.35, 0.60),
    'kath-larkin': (0.53, 0.36, 0.60),
    'timon-fotakis': (0.53, 0.22, 0.42),
}

done = skipped = 0
for name in sorted(os.listdir(SRC)):
    src = os.path.join(SRC, name)
    out = os.path.join(DST, name + '.webp')
    if not os.path.exists(out):
        continue
    try:
        im = ImageOps.exif_transpose(Image.open(src))
        if im.mode in ('RGBA', 'LA', 'P'):
            im = im.convert('RGBA')
            bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
            im = Image.alpha_composite(bg, im)
        im = im.convert('RGB')
    except Exception as e:  # noqa: BLE001
        print('unreadable', name, e)
        skipped += 1
        continue
    w, h = im.size
    gray = cv2.cvtColor(cv2.UMat(cv2.cvtColor(__import__('numpy').asarray(im), cv2.COLOR_RGB2BGR)), cv2.COLOR_BGR2GRAY).get()
    f = face(gray)
    if name in MANUAL:
        mx, my, ms = MANUAL[name]
        side = int(w * ms)
        f = (int(mx * w - side / 2.7 / 2), int(my * h - side / 2.7 * 0.82), int(side / 2.7), int(side / 2.7))
    if not f:
        print('no face', name)
        skipped += 1
        continue
    x, y, fw, fh = f
    side = min(w, h, max(int(fw * 2.7), 160))
    cx, cy = x + fw / 2, y + fh / 2 + fh * 0.32
    left = int(min(max(cx - side / 2, 0), w - side))
    top = int(min(max(cy - side / 2, 0), h - side))
    im.crop((left, top, left + side, top + side)).resize((256, 256), Image.LANCZOS).save(out, 'WEBP', quality=80, method=6)
    done += 1
print(f'cropped {done}, left as-is {skipped}')
