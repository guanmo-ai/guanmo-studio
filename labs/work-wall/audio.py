"""作品墙配乐（一整首歌，15 秒）。120 BPM（一拍 = 30 帧 @60fps）· A 小调 → C 大调收。
招牌声音是“翻牌”：一记纸卡的“嗒” + 一小口气流，波扫过去的时候从左到右一串。
时间全部读 config.json（和画面同一份）。python3 audio.py out.wav"""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
LIB = Path(__import__('os').environ.get('DESIGN_STYLE', '../design-style')).resolve() / 'drafts/_lib'
sys.path.insert(0, str(LIB))
from song import Song  # noqa: E402
from softfx import SoftFX  # noqa: E402

cfg = json.loads((HERE / 'config.json').read_text())
FPS = 60
fr_ = lambda s: s * FPS                       # 秒 → 帧
TL = cfg['timeline']
END = int(TL['end'] * FPS)

AM, F, C, G, DM, E = [69, 72, 76], [65, 69, 72], [67, 72, 76], [67, 71, 74], [62, 65, 69], [64, 68, 71]
CH = [(0, 45, AM), (120, 41, F), (180, 36, C), (240, 43, G), (300, 45, AM), (360, 41, F), (420, 36, C), (480, 43, G),
      (540, 45, AM), (600, 41, F), (660, 36, C), (720, 43, G), (780, 41, F), (840, 36, C)]


class WallSong(Song, SoftFX):
    def flip(self, level=1.0, bright=1.0):
        """一张卡翻过去：纸板的“嗒” + 一小口风"""
        click = self.click(level, lo=900 * bright, hi=6500 * bright, d=0.006)
        air = self.brush(0.09, 0.35 * level, up=True)
        n = max(len(click), len(air))
        return np.pad(click, (0, n - len(click))) + np.pad(air, (0, n - len(air)))


S = WallSong(END, CH, seed=11, tail=2.5)
fr = S.fr
rng = np.random.default_rng(5)


def wave_clatter(at_s, cross_s, count, level=0.5, bright=1.0, radial=False):
    """一道波扫过：count 声翻牌，时间按波前分布，声像从左到右（放射状则从中间往两边）"""
    for k in range(count):
        u = (k + rng.uniform(0, .8)) / count
        t = at_s + cross_s * u ** (1.0 if not radial else .7)
        pan = (-0.85 + 1.7 * u) if not radial else float(rng.uniform(-.9, .9)) * u
        S.sfx(S.flip(float(rng.uniform(.6, 1.0)), bright * float(rng.uniform(.85, 1.15))), fr(fr_(t)), level * (1 - .35 * u), pan, send=0.18)


# —— 乐队：开场只有铺底和翻牌，第一道波（2.0 s）全乐队进来；主角飞出那一拍（6.0—7.0 s）抽空鼓，7.0 s 落下 ——
HERO0, HERO1 = int(fr_(cfg['hero']['out'][0])), int(fr_(cfg['hero']['out'][1]))
BRK = [(HERO0, HERO1)]
S.pad(0.9, wave='saw', fc=1500)
S.drums(120, 840, skip=BRK, level=0.8)
for fm in np.arange(120, 840, 7.5):
    if not any(a <= fm < z for a, z in BRK):
        S.place(S.shaker(1.0), fr(fm), 0.7 if fm % 15 else 0.4, -0.3)
S.bassline(120, 840, skip=BRK, level=0.85)
S.arp(60, 840, 1.1, skip=BRK, pattern=(0, 2, 1, 3, 2, 4, 3, 1))
HOOK = {120: [(0, 76, 1), (1, 72, 1), (2, 69, 2)], 180: [(0, 79, 1), (1, 76, 1), (2, 72, 2)], 240: [(0, 79, 1), (1, 74, 1), (2, 71, 2)],
        300: [(0, 81, 1), (1, 76, 1), (2, 72, 1), (3, 76, 1)], 420: [(0, 84, 2), (2, 79, 2)], 480: [(0, 83, 1), (1, 79, 1), (2, 74, 2)],
        540: [(0, 81, 1), (1, 76, 1), (2, 72, 2)], 660: [(0, 79, 1), (1, 84, 1), (2, 88, 2)], 720: [(0, 86, 1), (1, 83, 1), (2, 79, 2)]}
for s0, notes in HOOK.items():
    S.hook(s0, notes, 0.9)

# —— 0 s：第 0 帧就有声音：标题砸下 + 一串翻牌从镜头边上扫过去 ——
S.sfx(S.slam(33, 1.0), fr(0), 0.8, 0.0, send=0.35)
S.place(S.crash(0.6), fr(0), 0.4, send=0.4)
wave_clatter(0.0, 2.2, 44, 0.42, 0.9)
S.sfx(S.whoosh(1.0, 200, 3800, 0.9, 0.6), fr(60), 0.35)          # 镜头从墙边甩到正面
S.sfx(S.riser(fr(40), 0.6, 300, 6000), fr(80), 0.3)
S.transition(120, True, 0.6)

# —— 2—6 s：四道翻牌波，每道一记重拍 + 一串从左到右的翻牌 ——
for i, w in enumerate([w for w in cfg['waves'] if w.get('label')]):
    a = fr_(w['at'])
    S.place(S.kick(1.1), fr(a), 0.9); S.kicks.append(a)
    wave_clatter(w['at'] + 0.02, 0.62, 30, 0.5, 1.0 + 0.08 * i)
    if i:
        S.transition(a, i % 2 == 0, 0.45)

# —— 6—7 s：主角离开墙面飞到镜头前（抽空、上升），7 s 铺满时落下 ——
S.sfx(S.flip(1.2, 0.8), fr(HERO0), 0.8)
S.sfx(S.whoosh(1.0, 180, 5200, 1.0, 0.7), fr(HERO0 + 4), 0.55, send=0.3)
S.sfx(S.riser(fr(HERO1 - HERO0), 0.8, 250, 8000), fr(HERO0), 0.4)
S.sfx(S.rev_cymbal(0.35, 1.0), fr(HERO1) - 0.35, 0.6, send=0.3)
S.place(S.kick(1.3), fr(HERO1), 1.0); S.kicks.append(HERO1)
S.sfx(S.boom(0.9, 90, 34, 0.9), fr(HERO1), 0.7)
S.place(S.crash(0.8), fr(HERO1), 0.5, send=0.5)
S.place(S.sbass(36, 1.6), fr(HERO1), 0.4, bus=S.PUMP)

# —— 8.75—9.75 s：主角飞回墙里，落位那一刻一圈波纹（全墙翻成混排）——
B0, B1 = fr_(cfg['hero']['back'][0]), fr_(cfg['hero']['back'][1])
S.sfx(S.whoosh(1.0, 5000, 300, 0.9, 0.7), fr(B0), 0.45)
S.sfx(S.thock(48, 1.0), fr(B1), 0.6)
ripple = [w for w in cfg['waves'] if w['stage'] == 'mix'][0]
S.sfx(S.shimmer(1.4, 0.9), fr(fr_(ripple['at'])), 0.4, send=0.6)
wave_clatter(ripple['at'], 1.8, 60, 0.38, 1.1, radial=True)

# —— 10.5 s：收获，一颗标签一声“啵”，音高沿和弦往上 ——
P = fr_(TL['payoff'])
for k in range(len(cfg['payoff']['chips'])):
    at = P + 15 + k * 15
    S.sfx(S.bop(S.tone(at, k, 1), 1.0, 0.18), fr(at), 0.6, -0.5 + 0.2 * k, send=0.3)

# —— 13 s：全墙从中间往外翻成暗面（收灯），字标从圆点里长出来；14 s 盖章；收在 C 大三和弦 ——
E0 = fr_(TL['endIn'])
back = [w for w in cfg['waves'] if w['stage'] == 'back'][0]
wave_clatter(back['at'], 1.2, 50, 0.34, 0.75, radial=True)
S.sfx(S.bop(72, 1.0, 0.25), fr(E0), 0.6, send=0.3)
S.sfx(S.whoosh(0.5, 400, 3000, 0.6, 0.5), fr(E0 + 12), 0.35)
ST = fr_(TL['stamp'])
S.sfx(S.rev_cymbal(0.3, 1.0), fr(ST) - 0.3, 0.5)
S.place(S.kick(1.3), fr(ST), 1.0); S.kicks.append(ST)
S.sfx(S.slam(36, 0.9), fr(ST), 0.7, send=0.4)
S.place(S.crash(0.9), fr(ST), 0.5, send=0.5)
for k, m in enumerate([72, 76, 79, 84, 88]):
    S.sfx(S.celesta(m, 1.8, 0.8), fr(ST + 6 + k * 3), 0.42, -0.4 + 0.2 * k, send=0.5)

# —— 文字：每个字落定一声（与 hud.js 的逐字节奏一致：开场每字 0.03 s，标签每字 0.035 s，其余 0.022 s）——
cues = []
def add(t_s, text, kind, step_s=0.022):
    cues.append([fr_(t_s), len(text.replace(' ', '')), step_s * FPS, kind])
h = cfg['hook']
add(h['lineAt'][1], h['lines'][1], 'title', 0.03)
add(h['subAt'], h['sub'], 'small')
for w in cfg['waves']:
    if w.get('label'):
        add(w['at'] + 0.04, w['label'], 'title', 0.035)
        if w.get('sub'):
            add(w['at'] + 0.12, w['sub'], 'small')
add(cfg['hero']['labelAt'] + 0.05, cfg['hero']['title'], 'title', 0.04)
add(TL['payoff'], cfg['payoff']['title'], 'title', 0.03)
add(TL['endIn'] + 0.55, cfg['end']['sub'], 'small', 0.018)
S.text_cues(cues, 0.8)

S.master(sys.argv[1] if len(sys.argv) > 1 else str(HERE / 'music.wav'), loop=False)
