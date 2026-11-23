"""Makes the artifact page and the local double-click copy of the 3D mock-up from the worktree page's own HTML and CSS."""
import io
import os
import re
import shutil

app = 'D:/workspace/GameBuilder-mockup/app/tests/showcase/'
packed = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'packed', 'xuong-3d.js')
local = 'D:/workspace/GameBuilder/plans/previews/xuong-phan-loai-261119/'
artifact = local + 'artifact-outbound/'
os.makedirs(artifact, exist_ok=True)
css = io.open(app + 'factory-mockup.css', encoding='utf-8').read()
html = io.open(app + 'factory-mockup.html', encoding='utf-8').read()
body = re.search(r'<body>(.*)<script type="module"', html, re.S).group(1).strip()
page = '<title>Xưởng phân loại 3D: sàn chia chọn và khu xuất hàng</title>\n<style>\n' + css + '</style>\n\n' + body + '\n\n<script src="xuong-3d.js"></script>\n'
io.open(artifact + 'xuong-3d.html', 'w', encoding='utf-8', newline='').write(page)
shutil.copy(packed, artifact + 'xuong-3d.js')
io.open(local + 'xuong-3d.html', 'w', encoding='utf-8', newline='').write(
    '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + page + '</body></html>')
shutil.copy(packed, local + 'xuong-3d.js')
print('ok', len(page), os.path.getsize(packed) // 1024, 'KB')
