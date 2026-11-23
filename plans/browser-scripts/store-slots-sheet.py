"""Contact sheet of burst frames. usage: carry-place-sheet.py <prefix> <first> <last> <cols> <out.jpg> [cropx0 cropy0 cropx1 cropy1] [scale]"""
import glob, sys
from PIL import Image, ImageDraw

prefix, first, last, cols, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
crop = tuple(int(v) for v in sys.argv[6:10]) if len(sys.argv) >= 10 else None
scale = float(sys.argv[10]) if len(sys.argv) >= 11 else 1.0
files = sorted(glob.glob(prefix + '-*.jpg'))[first:last + 1]
imgs = []
for f in files:
    im = Image.open(f).convert('RGB')
    if crop:
        im = im.crop(crop)
    if scale != 1.0:
        im = im.resize((int(im.width * scale), int(im.height * scale)))
    ImageDraw.Draw(im).text((4, 4), f.split('-')[-2] + ' ' + f.split('-')[-1][:-4], fill=(255, 0, 0))
    imgs.append(im)
w, h = imgs[0].size
rows = (len(imgs) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows), 'white')
for i, im in enumerate(imgs):
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out, quality=80)
print(sheet.size)
