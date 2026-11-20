# 把原素材整理成墙上的牌：统一 4:5、480×600；影片取一帧居中裁切
import sys, os, subprocess, glob
from PIL import Image, ImageDraw, ImageFont
W = sys.argv[1]; SRC = os.path.join(W, 'src'); OUT = os.path.join(W, 'assets/tiles'); os.makedirs(OUT, exist_ok=True)
TW, TH = 480, 600
def fit(im):
    im = im.convert('RGB'); r = TW / TH; w, h = im.size
    if w / h > r: nw = int(h * r); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else: nh = int(w / r); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return im.resize((TW, TH), Image.LANCZOS)
kinds = {'poster': ['poster'], 'cheat': ['cheatsheet', 'geometry'], 'app': ['app-ui', 'skins', 'interfaces', 'compare']}
for f in sorted(glob.glob(os.path.join(SRC, 'img', '*.jpg'))):
    work, kind = os.path.basename(f)[:-4].split('--')
    for k, names in kinds.items():
        if kind in names:
            o = os.path.join(OUT, f'{k}-{work}.jpg')
            if not os.path.exists(o): fit(Image.open(f)).save(o, quality=90)
# 影片：每部取两帧（40% 和 70% 处），给墙更多变化
for f in sorted(glob.glob(os.path.join(SRC, 'video', '*.mp4'))):
    work = os.path.basename(f)[:-4]
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))
    for n, at in enumerate([.42, .72]):
        o = os.path.join(OUT, f'film{n}-{work}.jpg')
        if os.path.exists(o): continue
        tmp = o + '.png'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(dur * at), '-i', f, '-frames:v', '1', tmp], check=True)
        fit(Image.open(tmp)).save(o, quality=90); os.remove(tmp)
# 牌背：深色，中间一个小圆点，右下角字标
back = Image.new('RGB', (TW, TH), (24, 19, 17)); d = ImageDraw.Draw(back)
d.ellipse((TW/2-14, TH/2-14, TW/2+14, TH/2+14), fill=(226, 69, 47))
back.save(os.path.join(OUT, 'back.jpg'), quality=92)
print(len(os.listdir(OUT)), 'tiles')
