"""Make the web copies of the carousel photographs and the social-sharing (OG) image.

Not needed to host the site: its output is already in assets/.
Run it only to replace a photograph:

    python tools/make_images.py "path/to/folder/with/originals"

Needs Pillow (pip install pillow).  Every photograph is cropped to 3:2 around its centre,
converted to sRGB, stripped of camera metadata (including any GPS position) and written as
WebP at 640, 1280 and 1920 px wide, plus a 1280 px JPEG for browsers without WebP.
"""
import io
import sys
from pathlib import Path

from PIL import Image, ImageCms, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / 'assets' / 'photos'
OG = ROOT / 'assets' / 'og-image.jpg'

# Original file name -> web name.  The order here does not matter; index.html sets the order.
SOURCES = {
    'Palash Khan_1.JPG': 'showari-ghat-recycling-yard',
    'Mehedi Hasan_1.JPG': 'buriganga-plastic-burning',
    'Mehedi Hasan_3.JPG': 'kamrangirchar-riverbank-waste',
    'Rashed Sumon_1.jpg': 'kazla-canal-excavator',
    'Rashed Sumon_2.jpg': 'old-buriganga-channel-overgrown',
    'Rashed_Sumon_3.JPG': 'kalyanpur-canal-child-collecting',
}
WIDTHS = (640, 1280, 1920)
SRGB = ImageCms.createProfile('sRGB')


def load(path):
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    icc = im.info.get('icc_profile')
    im = im.convert('RGB')
    if icc:
        try:
            src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            im = ImageCms.profileToProfile(im, src, SRGB, outputMode='RGB')
        except Exception:
            pass
    return im


def crop(im, ratio):
    w, h = im.size
    if w / h > ratio:
        nw = round(h * ratio)
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = round(w / ratio)
    y = (h - nh) // 2
    return im.crop((0, y, w, y + nh))


def photos(src_dir):
    PHOTOS.mkdir(parents=True, exist_ok=True)
    for name, slug in SOURCES.items():
        im = crop(load(src_dir / name), 3 / 2)
        for w in WIDTHS:
            out = im.resize((w, round(w * 2 / 3)), Image.LANCZOS)
            out.save(PHOTOS / f'{slug}-{w}.webp', 'WEBP', quality={640: 74, 1280: 70, 1920: 64}[w], method=6)
            if w == 1280:
                out.save(PHOTOS / f'{slug}-{w}.jpg', 'JPEG', quality=76, optimize=True, progressive=True)
        print(f'{name:22s} -> assets/photos/{slug}-*.webp/.jpg')


def og(src_dir):
    src = src_dir / 'og-image.jpeg'
    if not src.exists():
        return
    im = crop(load(src), 16 / 9).resize((1200, 675), Image.LANCZOS)
    im.save(OG, 'JPEG', quality=84, optimize=True, progressive=True)
    print(f'og-image.jpeg          -> assets/og-image.jpg ({OG.stat().st_size // 1024} KB)')


def hero_jpegs():
    """JPEG copies of the opening and present-day pictures, for browsers without WebP (Safari
    before 14).  They only see the simple crossfade, so these are the only two pictures needed."""
    hero = ROOT / 'assets' / 'hero'
    for name, size in (('opening', (1600, 1067)), ('opening-tall', (720, 1067)),
                       ('now', (1600, 1067)), ('now-tall', (720, 1067))):
        im = Image.open(hero / f'{name}.webp').convert('RGB').resize(size, Image.LANCZOS)
        im.save(hero / f'{name}.jpg', 'JPEG', quality=72, optimize=True, progressive=True)
        print(f'assets/hero/{name}.jpg ({(hero / f"{name}.jpg").stat().st_size // 1024} KB)')


if __name__ == '__main__':
    if len(sys.argv) == 2 and sys.argv[1] == '--hero':
        hero_jpegs()
        sys.exit()
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder = Path(sys.argv[1])
    photos(folder)
    og(folder)
