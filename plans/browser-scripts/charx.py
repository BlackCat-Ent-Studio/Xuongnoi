import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
w, h = im.size
xs = []; ys = []
px = im.load()
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        if b > 170 and r < 90 and 80 < g < 170:
            xs.append(x); ys.append(y)
print(f"{round(sum(xs)/len(xs)) if xs else -1},{round(sum(ys)/len(ys)) if ys else -1}")
