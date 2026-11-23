"""Contact sheet of the newest burst only. usage: store-slots-latest.py <prefix> <minutes> <first> <last> <cols> <out.jpg> <scale>"""
import glob, os, sys, time
from PIL import Image, ImageDraw
prefix, minutes, first, last, cols, out, scale = sys.argv[1], float(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), sys.argv[6], float(sys.argv[7])
files = sorted(f for f in glob.glob(prefix + '-*.jpg') if time.time() - os.path.getmtime(f) < minutes * 60)[first:last + 1]
imgs = []
for f in files:
    im = Image.open(f).convert('RGB')
    im = im.resize((int(im.width * scale), int(im.height * scale)))
    ImageDraw.Draw(im).text((4, 4), f.split('-')[-2] + ' ' + f.split('-')[-1][:-4], fill=(255, 0, 0))
    imgs.append(im)
w, h = imgs[0].size
rows = (len(imgs) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows), 'white')
for i, im in enumerate(imgs):
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out, quality=80)
print(len(files), sheet.size)
