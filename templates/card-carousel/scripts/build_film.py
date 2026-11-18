#!/usr/bin/env python3
"""把一份仓库宣传片配置变成可以保存的动效工程。

用法（在工作台根目录运行）：
  python3 build_film.py <配置.json> --out files/<工程目录> [--root <仓库目录>] [--music <素材ID>] [--sfx <素材ID>]
                        [--fonts <字体身份,逗号分隔>] [--runtime <运行时版本>]

产出 <工程目录>/：引擎源码、film.json（片子的全部内容）、assets/（缩好的图片）、
audio/（随包的配乐和音效）、<工程目录名>.motion.json（保存用的清单，文件名就是作品标题）。
配置有问题时列出全部问题并以非零状态退出，不写半个工程。"""
import argparse, colorsys, hashlib, json, os, re, shutil, sys
from xml.etree import ElementTree
from PIL import Image

PKG = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE, AUDIO = os.path.join(PKG, 'assets', 'engine'), os.path.join(PKG, 'assets', 'audio')
ENGINE_FILES = ['index.html', 'main.js', 'styles.css', 'lib.js', 'choreo.js', 'data.js', 'tex.js', 'scene.js', 'glass-stage.js', 'card-face.js', 'card-distribution.js', 'kit.js', 'hud.js']
# Noto Sans SC、Instrument Serif（正 / 斜）、Geist、JetBrains Mono 的字体身份
FONTS = ['a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da', '498efd461f6ddfcb7a111bf9a565709d2085d48201d501ead960d93e84ffbb88',
         '08939b8bdf534afec24ae0ef5e03f948940cd9a8fe08e7fecbad040e62327385', '73894e0448cae90a92b6c2f8732b7bb9acb7b94c418bff559dad4a18e1de9659',
         '48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda']
STAGES = {
    'warm': {'bg': '#15110f', 'kitFog': '#2f251e', 'backdrop': ['#3a2d25', '#201915', '#0c0a09'],
             'glow': ['255,214,170', '255,190,140'], 'dust': '255,236,214', 'scrim': '14, 11, 10'},
    'cool': {'bg': '#0e1217', 'kitFog': '#1c2530', 'backdrop': ['#24313f', '#141b24', '#07090c'],
             'glow': ['170,210,255', '140,180,255'], 'dust': '214,232,255', 'scrim': '8, 11, 15'},
}
THEME = {'ink': '#352f2a', 'paper': '#fffdf8', 'accent': '#a34332', 'highlight': '#ffb59f', 'seal': '#c8372d', 'cursor': '#ff7eb6'}
PALETTE = ['#E62E2D', '#FF6A1A', '#1FB3A6', '#2E4BFF', '#C9A45A', '#7B52FF', '#F2B419', '#4DAF72', '#ED80B8', '#56CDDD']
HEX = re.compile(r'^#[0-9a-fA-F]{6}$')
problems, notes = [], []


def est(text, size, mono=False):
    """估一行字的宽度（像素）：中日韩字按一个字宽，其余按 0.58 / 0.6 个字宽。"""
    return sum(size if ord(ch) > 0x2e7f else size * (0.6 if mono else 0.58) for ch in text)


def rich(text):
    """count.big：数字标成高亮，独立的 + × · / 标成弱化。"""
    t = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    t = re.sub(r'\d[\d,.]*[%kKwW万+]?', lambda m: f'<b>{m.group(0)}</b>', t)
    return re.sub(r' ([+×·/]) ', r' <i>\1</i> ', t)


def need(obj, key, where):
    v = obj.get(key) if isinstance(obj, dict) else None
    if v in (None, '', []):
        problems.append(f'{where} 缺少 {key}')
    return v


def fit_note(text, size, limit, where, mono=False):
    w = est(re.sub(r'<[^>]+>', '', text or ''), size, mono)
    if w > limit * 1.25:
        notes.append(f'{where}「{text}」偏长（估 {w:.0f}px，位置宽 {limit}px），会被缩小到约 {size * limit / w:.0f}px')


def auto_color(path):
    """从图片里取一个代表色：面积大、够鲜艳、不太暗的那一块。整张图都灰就返回 None。"""
    try:
        im = Image.open(path).convert('RGB').resize((48, 48)).quantize(6).convert('RGB')
    except Exception:
        return None
    best, top = None, 0
    for n, (r, g, b) in im.getcolors(48 * 48):
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        score = n * s * (0.35 + v) if s > 0.22 and v > 0.25 else 0
        if score > top:
            top, best = score, (h, s, v)
    if not best:
        return None
    h, s, v = best
    r, g, b = colorsys.hsv_to_rgb(h, min(s, 0.85), min(max(v, 0.55), 0.92))
    return '#%02X%02X%02X' % (round(r * 255), round(g * 255), round(b * 255))


def save_image(src, dst, w, h, fit='cover'):
    im = Image.open(src).convert('RGB')
    pad = im.getpixel((min(2, im.width - 1), min(2, im.height - 1)))  # 小图片也能安全采样边角颜色
    k = (max if fit == 'cover' else min)(w / im.width, h / im.height)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    canvas = Image.new('RGB', (w, h), pad)
    canvas.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    canvas.save(dst, quality=90)
    # 四边都很暗的图在深色舞台上分不出边界：返回 True，牌面会加一道细亮边
    g = canvas.convert('L'); e = 8
    edge = b''.join(g.crop(box).tobytes() for box in ((0, 0, w, e), (0, h - e, w, h), (0, 0, e, h), (w - e, 0, w, h)))
    return sum(edge) / len(edge) < 56



def validate_structure(cfg):
    """在访问嵌套字段前报告类型错误，避免 traceback 或写入半成品。"""
    errors = []
    def obj(value, where):
        if not isinstance(value, dict):
            errors.append(f'{where} 要是对象')
            return {}
        return value
    def text_fields(value, fields, where):
        for key in fields:
            if key in value and not isinstance(value[key], str):
                errors.append(f'{where}.{key} 要是字符串')
    def sequence(value, where):
        if not isinstance(value, list):
            errors.append(f'{where} 要是数组')
            return []
        return value
    def color(value):
        return isinstance(value, str) and HEX.fullmatch(value)
    def rgb(value):
        return isinstance(value, str) and re.fullmatch(r'\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*', value) and all(int(x) <= 255 for x in value.split(','))
    def color_fields(value, fields, where):
        for key in fields:
            if key in value and not color(value[key]):
                errors.append(f'{where}.{key} 要写成 #rrggbb')
    cfg = obj(cfg, '配置')
    for key in ('brand', 'theme', 'hook', 'count', 'kit', 'end', 'background', 'audio'):
        if key in cfg: obj(cfg[key], key)
    brand, theme, hook, count, kit, end, background, audio = (cfg.get(k) if isinstance(cfg.get(k), dict) else {} for k in ('brand', 'theme', 'hook', 'count', 'kit', 'end', 'background', 'audio'))
    text_fields(brand, ('wordmark', 'tagline', 'logo', 'font', 'paper', 'ink', 'back'), 'brand')
    color_fields(brand, ('paper', 'ink', 'back'), 'brand')
    text_fields(hook, ('kicker', 'sub'), 'hook')
    if 'title' in hook and not (isinstance(hook['title'], str) or isinstance(hook['title'], list) and all(isinstance(x, str) for x in hook['title'])):
        errors.append('hook.title 要是字符串或字符串数组')
    text_fields(count, ('big', 'sub'), 'count')
    if 'under' in kit and not (isinstance(kit['under'], list) and all(isinstance(x,str) for x in kit['under'])):
        errors.append('kit.under 要是字符串数组')
    if 'stage' in theme and not isinstance(theme['stage'], (str, dict)):
        errors.append('theme.stage 要是预设名或对象')
    stage = theme.get('stage')
    if isinstance(stage, dict):
        color_fields(stage, ('bg', 'kitFog'), 'theme.stage')
        for key in ('dust', 'scrim'):
            if key in stage and not rgb(stage[key]):
                errors.append(f'theme.stage.{key} 要是三个 0—255 的 RGB 数值，以逗号分隔')
        for key, count_colors, valid in [('backdrop', 3, color), ('glow', 2, rgb)]:
            if key in stage and (not isinstance(stage[key], list) or len(stage[key]) != count_colors or not all(valid(v) for v in stage[key])):
                errors.append(f'theme.stage.{key} 要包含 {count_colors} 组有效颜色')
        if 'mode' in stage and stage['mode'] not in ('studio', 'glass'):
            errors.append('theme.stage.mode 只能是 studio / glass')
    text_fields(kit, ('head', 'path'), 'kit')
    text_fields(end, ('title', 'sub', 'url', 'credit', 'handle', 'seal'), 'end')
    text_fields(cfg, ('payoff',), '配置')
    text_fields(background, ('preset', 'image'), 'background')
    color_fields(theme, ('ink', 'paper', 'accent', 'highlight', 'seal', 'cursor'), 'theme')
    if 'surface' in theme:
        errors.append('theme.surface 由模板预设定义，请使用 theme.cardLook 或 theme.look')
    cards = sequence(cfg.get('cards', []), 'cards')
    for i, c in enumerate(cards):
        c = obj(c, f'cards[{i}]')
        text_fields(c, ('id', 'no', 'title', 'sub', 'tag', 'image', 'color', 'back', 'backStyle', 'fit', 'front'), f'cards[{i}]')
        if c.get('fit', 'cover') not in ('cover', 'contain'): errors.append(f'cards[{i}].fit 只能是 cover / contain')
        if 'front' in c and c['front'] != 'image':
            errors.append(f'cards[{i}].front 只支持 image，省略时沿用默认卡面')
        if c.get('front') == 'image' and not c.get('image'):
            errors.append(f'cards[{i}].front 为 image 时需要填写 image')
        if 'face' in c:
            face = obj(c['face'], f'cards[{i}].face')
            text_fields(face, ('palette', 'layout', 'back', 'material', 'icon', 'summary', 'nameEn', 'brand', 'kicker'), f'cards[{i}].face')
    for field in ('id', 'no'):
        values = [c.get(field) for c in cards if isinstance(c, dict) and isinstance(c.get(field), str) and c.get(field)]
        if len(values) != len(set(values)): errors.append(f'cards.{field} 不能重复')
    if 'featured' in cfg:
        featured = sequence(cfg['featured'], 'featured')
        if len(featured) > 6: errors.append('featured 最多 6 张')
        for i, value in enumerate(featured):
            if type(value) not in (str, int): errors.append(f'featured[{i}] 要是卡片名称或从 0 起的整数序号')
    if 'hero' in cfg and type(cfg['hero']) not in (str, int):
        errors.append('hero 要是卡片名称或从 0 起的整数序号')
    tiles = obj(kit.get('tiles', {}), 'kit.tiles')
    text_fields(tiles, ('title', 'sub'), 'kit.tiles')
    for i, tile in enumerate(sequence(tiles.get('items', []), 'kit.tiles.items')):
        where = f'kit.tiles.items[{i}]'
        tile = obj(tile, where)
        text_fields(tile, ('image', 'fit', 'small', 'label'), where)
        color_fields(tile, ('color',), where)
        if tile.get('fit', 'cover') not in ('cover', 'contain'): errors.append(f'{where}.fit 只能是 cover / contain')
        if 'big' in tile and not (isinstance(tile['big'], str) or type(tile['big']) in (int, float) and -float('inf') < tile['big'] < float('inf')):
            errors.append(f'{where}.big 要是字符串或数字')
    for i, row in enumerate(sequence(kit.get('rows', []), 'kit.rows')):
        row = obj(row, f'kit.rows[{i}]')
        text_fields(row, ('title', 'sub', 'kind', 'chip'), f'kit.rows[{i}]')
        sequence(row.get('items', []), f'kit.rows[{i}].items')
    typing = obj(kit.get('typing', {}), 'kit.typing')
    text_fields(typing, ('title', 'sub', 'text'), 'kit.typing')
    for name in ('music', 'sfx'):
        if name in audio: text_fields(obj(audio[name], f'audio.{name}'), ('path',), f'audio.{name}')
    return errors



def manifest_directory(output, cwd, standalone, path_api=os.path):
    try:
        return path_api.relpath(output, cwd).replace(path_api.sep, '/')
    except ValueError:
        if not standalone:
            raise ValueError('导入清单要求工程与工作目录位于同一磁盘；独立播放器请使用 --standalone')
        return path_api.abspath(output).replace(path_api.sep, '/')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('config'); ap.add_argument('--out', required=True); ap.add_argument('--root')
    ap.add_argument('--music'); ap.add_argument('--sfx'); ap.add_argument('--fonts'); ap.add_argument('--runtime', default='hyperframes-0.8.217-electron-v1')
    ap.add_argument('--standalone', action='store_true', help='独立播放器模式，无需外部宿主的素材 ID')
    a = ap.parse_args()
    try:
        cfg = json.load(open(a.config, encoding='utf-8-sig'))
    except (OSError, ValueError) as error:
        print(f'无法读取配置：{error}'); sys.exit(1)
    shape_errors = validate_structure(cfg)
    if shape_errors:
        print('配置有问题，没有生成工程：')
        for error in shape_errors: print('  ✗', error)
        sys.exit(1)
    root = a.root or os.path.dirname(os.path.abspath(a.config))
    here = os.path.dirname(os.path.abspath(a.config))

    def src(p):                                    # 先在 --root 里找，再在配置文件旁边找
        if os.path.isabs(p):
            return p
        first = os.path.join(root, p)
        return first if os.path.exists(first) else os.path.join(here, p) if os.path.exists(os.path.join(here, p)) else first

    def image(p, where, svg=False):
        if p and not os.path.isfile(src(p)):
            problems.append(f'{where} 的图片不存在：{p}')
        elif p and os.path.splitext(p)[1].lower() not in ('.png', '.jpg', '.jpeg', '.webp', '.gif') + (('.svg',) if svg else ()):
            problems.append(f'{where} 的图片要是 PNG / JPG / WebP / GIF' + ('（或 SVG）' if svg else '') + f'：{p}')
        elif p:
            try:
                if os.path.splitext(p)[1].lower() == '.svg':
                    with open(src(p), encoding='utf-8-sig') as svg_file:
                        tag = ElementTree.fromstring(svg_file.read()).tag
                    if tag not in ('svg', '{http://www.w3.org/2000/svg}svg'):
                        raise ValueError('缺少 SVG 根元素')
                else:
                    with Image.open(src(p)) as im: im.verify()
            except (OSError, ValueError, ElementTree.ParseError, Image.DecompressionBombError):
                problems.append(f'{where} 的图片无法解码：{p}')
        return p

    # —— 主题
    theme_cfg = cfg.get('theme', {})
    looks = json.load(open(os.path.join(PKG, 'looks.json'), encoding='utf-8'))
    card_styles = json.load(open(os.path.join(PKG, 'card-styles.json'), encoding='utf-8'))
    face_styles = json.load(open(os.path.join(PKG, 'front-styles.json'), encoding='utf-8'))
    look = looks.get(theme_cfg.get('look')) if isinstance(theme_cfg.get('look'), str) else None
    if theme_cfg.get('look') is not None and look is None:
        problems.append(f'theme.look 只能是 {" / ".join(looks)}')
    th = {**THEME, **(look['theme'] if look else {}), **{k: v for k, v in theme_cfg.items() if k != 'stage'}}
    # 卡片材质与舞台独立；原版不需要环境反射、厚边或玻璃结构。
    card_look = theme_cfg.get('cardLook')
    if card_look is not None and card_look not in ('original', *looks):
        problems.append(f'theme.cardLook 只能是 original / {" / ".join(looks)}')
    card_override = looks.get(card_look) if isinstance(card_look, str) else None
    surface = None if card_look == 'original' else (card_override or look or {}).get('surface')
    if surface:
        th['surface'] = surface
    base_stage = look['stage'] if look else STAGES['warm']
    stage = theme_cfg.get('stage', base_stage)
    th['stage'] = {**base_stage, **stage} if isinstance(stage, dict) else STAGES.get(stage)
    if not th['stage']:
        problems.append(f'theme.stage 只能是 {" / ".join(STAGES)} 或一个对象')
    # —— 背景与音轨独立于卡片和动画；素材在写工程前统一检查
    background = cfg.get('background') or {}
    if not isinstance(background, dict):
        problems.append('background 要是对象'); background = {}
    background_path = background.get('image')
    if background.get('preset') and background_path:
        problems.append('background.preset 与 background.image 只选一个')
    if background.get('preset'):
        repo = os.path.dirname(os.path.dirname(PKG))
        catalog = json.load(open(os.path.join(repo, 'assets/backgrounds/catalog.json'), encoding='utf-8'))
        preset = next((b for b in catalog['backgrounds'] if b['id'] == background['preset']), None)
        if not preset:
            problems.append(f'background.preset 不存在：{background["preset"]}')
        else:
            background_path = os.path.join(repo, preset['image'])
    image(background_path, 'background.image')
    bg = {'dim': background.get('dim', 0), 'vignette': background.get('vignette', 0.18 if background_path else 0.42),
          'titleScrimHeight': background.get('titleScrimHeight', 400),
          'particles': background.get('particles', not bool(background_path) and (th['stage'] or {}).get('mode') != 'glass'), 'glow': background.get('glow', not bool(background_path))}
    if type(bg['titleScrimHeight']) not in (int, float) or not 0 <= bg['titleScrimHeight'] <= 1080:
        problems.append('background.titleScrimHeight 要是 0—1080 之间的数字')
    for key in ('dim', 'vignette'):
        v = bg[key]
        if type(v) not in (int, float) or not 0 <= v <= 1:
            problems.append(f'background.{key} 要是 0—1 之间的数字')
    for key in ('particles', 'glow'):
        if not isinstance(bg[key], bool):
            problems.append(f'background.{key} 要是 true 或 false')
    audio_cfg = cfg.get('audio') or {}
    if not isinstance(audio_cfg, dict):
        problems.append('audio 要是对象'); audio_cfg = {}
    tracks = []
    for name, default_volume in (('music', 0.9), ('sfx', 1)):
        track = audio_cfg.get(name) or {}
        if not isinstance(track, dict):
            problems.append(f'audio.{name} 要是对象'); track = {}
        if not isinstance(track.get('enabled', True), bool):
            problems.append(f'audio.{name}.enabled 要是 true 或 false')
        if track.get('enabled') is False:
            continue
        source = src(track['path']) if track.get('path') else os.path.join(AUDIO, name + '.wav')
        if not os.path.isfile(source):
            problems.append(f'audio.{name} 的音频不存在：{source}')
        ext = os.path.splitext(source)[1].lower()
        if ext not in ('.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac'):
            problems.append(f'audio.{name} 要使用 WAV / MP3 / M4A / AAC / OGG / FLAC')
        volume = track.get('volume', default_volume)
        if type(volume) not in (int, float) or not 0 <= volume <= 1:
            problems.append(f'audio.{name}.volume 要是 0—1 之间的数字')
        tracks.append({'name': name, 'source': source, 'path': f'audio/{name}{ext}', 'volume': volume})
    # —— 牌
    raw = cfg.get('cards') or []
    if not 7 <= len(raw) <= 31:
        problems.append(f'cards 要 7—31 张，现在是 {len(raw)} 张')
    cards = []
    for i, c in enumerate(raw):
        title = need(c, 'title', f'cards[{i}]')
        has_img = bool(c.get('image')) and os.path.isfile(src(c['image']))
        color = c.get('color') or (auto_color(src(c['image'])) if has_img else None) or PALETTE[i % len(PALETTE)]
        if not HEX.match(color):
            problems.append(f'cards[{i}].color 要写成 #rrggbb：{color}')
        style_id = c.get('backStyle')
        card_style = card_styles.get(style_id) if isinstance(style_id, str) else None
        if style_id is not None and card_style is None:
            problems.append(f'cards[{i}].backStyle 只能是 {" / ".join(card_styles)}')
        if card_style and not surface:
            problems.append(f'cards[{i}].backStyle 需要设置 theme.cardLook 或 theme.look 的材质预设')
        back = c.get('back') or (card_style['base'] if card_style else surface['palette'][i % len(surface['palette'])] if surface else color)
        if card_style:
            card_style = {**card_style, 'id': style_id, 'base': back}
        if not HEX.match(back):
            problems.append(f'cards[{i}].back 要写成 #rrggbb：{back}')
        face = c.get('face')
        if face is not None:
            face = dict(face) if isinstance(face, dict) else {}
            face.setdefault('brand', cfg.get('brand', {}).get('wordmark', ''))
            palette = next((p for p in face_styles['palettes'] if p['id'] == face.get('palette')), None)
            if not palette: problems.append(f'cards[{i}].face.palette 不存在')
            for field, collection, default in [('layout', 'layouts', 'editorial'), ('back', 'backs', 'number')]:
                face.setdefault(field, default)
                if face[field] not in [p['id'] for p in face_styles[collection]]: problems.append(f'cards[{i}].face.{field} 不存在')
            face['colors'] = palette
            face.setdefault('material', (palette or {}).get('material', 'matte'))
            face.setdefault('light', (palette or {}).get('lightPosition', 28))
            if face['material'] not in ('matte','metal','glass'): problems.append(f'cards[{i}].face.material 不存在')
            if type(face['light']) not in (int,float) or not 0 <= face['light'] <= 100: problems.append(f'cards[{i}].face.light 要在0—100之间')
            image(face.get('icon'), f'cards[{i}].face.icon')
        cards.append({'id': str(c.get('id', '')), 'no': str(c.get('no') or f'{i + 1:02d}'), 'title': title or '', 'sub': c.get('sub', ''), 'color': color,
                      'back': back, 'backStyle': card_style, 'face': face, 'tag': c.get('tag', ''), 'image': image(c.get('image'), f'cards[{i}]'), 'fit': c.get('fit', 'cover'), 'front': c.get('front')})
        fit_note(f"{cards[-1]['no']}  {title}  {cards[-1]['sub']}", 50, 1540, f'cards[{i}] 牌下的名字')

    def find(key, where):
        for field in ('id', 'no', 'title'):                 # 先按 id，再按编号，再按名字
            for i, c in enumerate(cards):
                if c[field] and str(key) == c[field]:
                    return i
        if isinstance(key, int) and 0 <= key < len(cards):
            return key
        problems.append(f'{where} 找不到这张牌：{key}（写 id、no、title 或从 0 起的序号）')
        return 0

    n = len(cards) + 1
    step = max(1, min(3, (n - 2) // 6))
    hero_slot = 6 * step
    order = [None] * len(cards)
    if cards:
        order[min(hero_slot, len(cards) - 1)] = find(cfg.get('hero', min(hero_slot, len(cards) - 1)), 'hero')
        for j, key in enumerate((cfg.get('featured') or [])[:6]):
            i = find(key, f'featured[{j}]')
            if i in order:
                problems.append(f'featured[{j}] 和 hero 或前面的 featured 重复：{key}')
            else:
                order[j * step] = i
        rest = [i for i in range(len(cards)) if i not in order]
        order = [rest.pop(0) if s is None else s for s in order]
    # —— 文字
    brand, hook, count, kit, end = (cfg.get(k) or {} for k in ('brand', 'hook', 'count', 'kit', 'end'))
    need(brand, 'wordmark', 'brand')
    titles = hook.get('title') or []
    titles = [titles] if isinstance(titles, str) else titles
    if not 1 <= len(titles) <= 2:
        problems.append('hook.title 要 1—2 行')
    for s in titles:
        fit_note(s, 176, 720, 'hook.title')
    fit_note(hook.get('sub', ''), 35, 720, 'hook.sub')
    fit_note(need(count, 'big', 'count') or '', 78, 1150, 'count.big')
    fit_note(need(kit, 'head', 'kit') or '', 54, 1000, 'kit.head')
    fit_note(kit.get('path', ''), 30, 640, 'kit.path', True)
    fit_note(need(cfg, 'payoff', '配置') or '', 150, 720, 'payoff')
    fit_note(need(end, 'title', 'end') or '', 96, 880, 'end.title')
    fit_note(need(end, 'url', 'end') or '', 34, 800, 'end.url', True)
    if len(end.get('seal', '')) > 2:
        problems.append('end.seal 最多两个字')
    # —— 拆开的那张牌
    tiles = kit.get('tiles') or {}
    items = tiles.get('items') or []
    if not 2 <= len(items) <= 4:
        problems.append(f'kit.tiles.items 要 2—4 个，现在是 {len(items)} 个')
    for i, t in enumerate(items):
        if len(str(t.get('big', ''))) > 4:
            notes.append(f'kit.tiles.items[{i}].big「{t["big"]}」超过 4 个字符，会被缩小')
        if not t.get('image') and not t.get('big'):
            problems.append(f'kit.tiles.items[{i}] 要有 image，或者 big（一个大字或数字）')
        image(t.get('image'), f'kit.tiles.items[{i}]')
    rows = kit.get('rows') or []
    if not 1 <= len(rows) <= 3:
        problems.append('kit.rows 要 1—3 行')
    for i, r in enumerate(rows):
        need(r, 'title', f'kit.rows[{i}]'); its = need(r, 'items', f'kit.rows[{i}]') or []
        kind = r.setdefault('kind', 'chips')
        if kind not in ('dots', 'chips', 'mono'):
            problems.append(f'kit.rows[{i}].kind 只能是 dots / chips / mono')
        if kind == 'dots' and (len(its) > 7 or not all(HEX.match(str(x)) for x in its)):
            problems.append(f'kit.rows[{i}] 是色点行：最多 7 个，每个写成 #rrggbb')
        if kind != 'dots':
            mono = kind == 'mono'
            w = sum(36 + est(str(x), 20 if mono else 25, mono) + (30 if not mono and r.get('numbered', True) else 0) for x in its) + 12 * (len(its) - 1)
            room = 770 * (2 if i == len(rows) - 1 else 1)        # 最后一行可以折成两行
            if w > room * 1.2:
                notes.append(f'kit.rows[{i}] 的标签一共约 {w:.0f}px，这一行只有 {room}px，会整行缩小；减少或缩短几个')
    typing = kit.get('typing') or {}
    need(typing, 'title', 'kit.typing'); text = need(typing, 'text', 'kit.typing') or ''
    if est(text, 21, True) > 676 * 4.6:
        problems.append(f'kit.typing.text 太长，面板放不下 5 行（约 {est(text, 21, True) / 676:.1f} 行）；截到 4 行以内')
    image(brand.get('logo'), 'brand.logo', svg=True)
    if problems:
        print('配置有问题，没有生成工程：'); [print('  ✗', p) for p in problems]; [print('  !', x) for x in notes]
        sys.exit(1)

    # —— 写工程
    out = a.out
    os.makedirs(os.path.join(out, 'assets'), exist_ok=True)
    for f in os.listdir(os.path.join(out, 'assets')):      # 重新生成时清掉上一次生成的图片
        if re.match(r'^(card-\d+\.jpg|tile-\d+\.jpg|logo\.(svg|png)|background\.[a-z]+)$', f):
            os.remove(os.path.join(out, 'assets', f))
    for f in ENGINE_FILES:
        shutil.copyfile(os.path.join(ENGINE, f), os.path.join(out, f))
    images = []
    if background_path:
        # 原尺寸无损保留，避免将电影背景按卡片尺寸缩小或二次 JPEG 压缩
        bg['image'] = 'background' + os.path.splitext(background_path)[1].lower()
        shutil.copyfile(src(background_path), os.path.join(out, 'assets', bg['image']))
        images.append(bg['image'])
    film_cards = []
    for slot, i in enumerate(order):
        c = cards[i]; img = None; rim = False
        if c['image']:
            img = f'card-{slot:02d}.jpg'
            rim = save_image(src(c['image']), os.path.join(out, 'assets', img), 1024, 576, c['fit']); images.append(img)
        face = dict(c['face']) if c['face'] else None
        if face and face.get('icon'):
            icon = f'face-icon-{slot}.png'
            Image.open(src(face['icon'])).convert('RGBA').save(os.path.join(out, 'assets', icon))
            face['icon'] = icon; images.append(icon)
        film_cards.append({'id': c['id'] or c['no'], 'no': c['no'], 'title': c['title'], 'sub': c['sub'], 'color': c['color'], 'back': c['back'], 'backStyle': c['backStyle'], 'face': face, 'tag': c['tag'], 'img': img, 'rim': bool(img and rim), 'front': c['front']})
    film_tiles = []
    for i, t in enumerate(items):
        if t.get('image'):
            img = f'tile-{i}.jpg'
            save_image(src(t['image']), os.path.join(out, 'assets', img), 648, 810, t.get('fit', 'cover')); images.append(img)
            film_tiles.append({'img': img, 'label': t.get('label', '')})
        else:
            film_tiles.append({'big': str(t['big']), 'small': t.get('small', ''), 'color': t.get('color'), 'label': t.get('label', '')})
    logo = None
    if brand.get('logo'):
        ext = os.path.splitext(brand['logo'])[1].lower()
        logo = 'logo' + ext
        if ext == '.svg':     # 只有 viewBox 的 SVG 补上宽高，浏览器才有确定的尺寸
            svg = open(src(brand['logo']), encoding='utf-8').read()
            head = re.search(r'<svg\b[^>]*>', svg)
            if head:
                vb = re.search(r'viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"', head[0])
                if vb and not re.search(r'\swidth\s*=', head[0]):
                    ending = '/>' if head[0].endswith('/>') else '>'
                    svg = svg[:head.start()] + head[0][:-len(ending)] + f' width="{vb[1]}" height="{vb[2]}"' + ending + svg[head.end():]
            open(os.path.join(out, 'assets', logo), 'w', encoding='utf-8').write(svg)
        else:
            im = Image.open(src(brand['logo'])).convert('RGBA'); im.thumbnail((640, 640), Image.LANCZOS)
            logo = 'logo.png'; im.save(os.path.join(out, 'assets', logo))
        images.append(logo)
    film = {
        'step': step, 'theme': th, 'background': bg,
        'audio': [{k: t[k] for k in ('name', 'path', 'volume')} for t in tracks],
        'brand': {'wordmark': brand['wordmark'], 'tagline': brand.get('tagline', ''), 'logo': logo, 'back': brand.get('back') or (surface['palette'][0] if surface else th['accent']),
                  'font': brand.get('font'), 'dot': brand.get('dot', True), 'paper': brand.get('paper'), 'ink': brand.get('ink')},
        'hook': {'kicker': hook.get('kicker', ''), 'title': titles, 'sub': hook.get('sub', '')},
        'count': {'big': rich(count['big']), 'sub': count.get('sub', '')},
        'cards': film_cards,
        'kit': {'head': kit['head'], 'path': kit.get('path', ''), 'under': kit.get('under'),
                'tiles': {'title': tiles.get('title', ''), 'sub': tiles.get('sub', ''), 'items': film_tiles},
                'rows': rows, 'typing': {'title': typing['title'], 'sub': typing.get('sub', ''), 'text': text}},
        'payoff': cfg['payoff'],
        'end': {'title': end['title'], 'sub': end.get('sub', ''), 'url': end['url'], 'credit': end.get('credit', ''),
                'handle': end.get('handle', ''), 'seal': end.get('seal', '')},
        'images': images,
    }
    json.dump(film, open(os.path.join(out, 'film.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # —— 声音和清单
    rel = manifest_directory(out, os.getcwd(), a.standalone)
    if not a.standalone and not rel.startswith('files/'):
        notes.append(f'--out 应在工作台的 files/ 下，并从工作台根目录运行；现在清单里的路径是 {rel}/…')
    assets, audio = [], []
    os.makedirs(os.path.join(out, 'audio'), exist_ok=True)
    for track in tracks:
        asset_id = a.music if track['name'] == 'music' else a.sfx
        name, vol, ms = os.path.basename(track['path']), track['volume'], 15000
        shutil.copyfile(track['source'], os.path.join(out, track['path']))
        if asset_id:
            digest = hashlib.sha256(open(track['source'], 'rb').read()).hexdigest()
            assets.append({'path': 'assets/' + name, 'assetId': asset_id, 'contentHash': digest})
            audio.append({'path': 'assets/' + name, 'startMs': 0, 'sourceStartMs': 0, 'durationMs': ms, 'volume': vol})
    manifest = {'schemaVersion': 3, 'runtime': a.runtime, 'width': 1920, 'height': 1080, 'fps': 60, 'durationMs': 15000,
                'fonts': a.fonts.split(',') if a.fonts else FONTS, 'assets': assets, 'audio': audio,
                'filePaths': {f: f'{rel}/{f}' for f in ENGINE_FILES + ['film.json']},
                'resourceFiles': {f'assets/{f}': f'{rel}/assets/{f}' for f in images}}
    mf = os.path.basename(os.path.normpath(out)) + '.motion.json'
    json.dump(manifest, open(os.path.join(out, mf), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    # —— 交代结果
    name = lambda s: f"{film_cards[s]['no']} {film_cards[s]['title']}"
    print(f'工程已生成：{rel}/（{len(cards)} 张内容牌 + 1 张字标牌，每拍转 {step} 张）')
    print(f'  保存用的清单：{rel}/{mf}')
    for b in range(6):
        print(f'  {2 + b * 0.5:.1f}—{2.5 + b * 0.5:.1f} s 正对镜头：{name(b * step)}')
    print(f'  6.0—10.2 s 拆开：{name(hero_slot)}')
    print(f'  图片 {len(images)} 张；没有图片的牌 {sum(1 for c in film_cards if not c["img"])} 张（用代表色和大字做牌面）')
    if a.standalone:
        print(f'  声音：已复制 {len(tracks)} 条启用音轨，独立渲染器按配置混音')
    elif len(audio) == 2:
        print('  声音：已写进清单')
    else:
        print(f'  声音：还没接入——把 {rel}/audio/music.wav 和 sfx.wav 放进项目，拿到素材 ID 后带上 --music / --sfx 重跑')
        for nm in ('music.wav', 'sfx.wav'):
            print(f'    {nm} sha256 {hashlib.sha256(open(os.path.join(AUDIO, nm), "rb").read()).hexdigest()}（项目里已有同哈希的素材就直接用它的 ID）')
    [print('  !', x) for x in notes]


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    main()
