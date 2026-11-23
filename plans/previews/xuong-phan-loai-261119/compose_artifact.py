"""Builds the artifact page (and the local copy) of the 3D mock-up from the dev page's own HTML and CSS."""
import io
import re
import shutil

app = 'D:/workspace/GameBuilder/app/tests/showcase/'
here = 'C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/75fb5f30-1223-44d1-ba33-7a3950788f98/scratchpad/factory-artifact-3d/'
local = 'D:/workspace/GameBuilder/plans/previews/xuong-phan-loai-261119/'
css = io.open(app + 'factory-mockup.css', encoding='utf-8').read()
html = io.open(app + 'factory-mockup.html', encoding='utf-8').read()
body = re.search(r'<body>(.*)<script type="module"', html, re.S).group(1).strip()
page = '<title>Xưởng phân loại 3D</title>\n<style>\n' + css + '</style>\n\n' + body + '\n\n<script src="xuong-3d.js"></script>\n'
io.open(here + 'xuong-3d.html', 'w', encoding='utf-8', newline='').write(page)
io.open(local + 'xuong-3d.html', 'w', encoding='utf-8', newline='').write(
    '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + page + '</body></html>')
shutil.copy(here + 'xuong-3d.js', local + 'xuong-3d.js')
print('ok', len(page))
