"""生成网页缩略图；保留原始 PNG 和素材注册表。"""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
catalog = json.loads((root / 'assets/backgrounds/catalog.json').read_text())
destination = root / 'assets/backgrounds/previews'
destination.mkdir(parents=True, exist_ok=True)
count = 0
for background in catalog['backgrounds']:
    if background.get('status') in ('superseded', 'removed'):
        continue
    with Image.open(root / background['image']) as original:
        image = original.convert('RGB')
        image.thumbnail((960, 960), Image.Resampling.LANCZOS)
        image.save(destination / f"{background['id']}.webp", 'WEBP', quality=92, method=6)
    count += 1
print(f'已生成 {count} 张网页预览图；下载仍使用原始 PNG。')
