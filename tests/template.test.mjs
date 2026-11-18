import { runPython } from '../scripts/environment.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { buildFilm, repository } from '../scripts/build.mjs';
import { samplePng } from './fixtures.mjs';

const builder = path.join(repository, 'templates/card-carousel/scripts/build_film.py');
const starter = JSON.parse(await readFile(path.join(repository, 'examples/starter/config.json'), 'utf8'));
const example = structuredClone(starter);
example.cards = Array.from({ length: 21 }, (_, i) => {
  const no = String(i + 1).padStart(2, '0');
  return { no, title: `测试卡片 ${no}`, color: starter.cards[i % starter.cards.length].color };
});
example.cards[0].image = 'fixture.png';
example.featured = ['02', '06', '03', '13', '04', '12'];
example.hero = '20';
example.audio = { music: { enabled: true }, sfx: { enabled: true } };

async function generate(cfg, check) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'guanmo-template-'));
  try {
    const config = path.join(temp, 'config.json'), out = path.join(temp, 'film');
    await writeFile(path.join(temp, 'fixture.png'), samplePng);
    await writeFile(config, JSON.stringify(cfg));
    const result = runPython([builder, config, '--root', temp, '--out', out, '--standalone'], { encoding: 'utf8' });
    await check(result, out);
  } finally { await rm(temp, { recursive: true, force: true }); }
}

test('含图片的示例保留六张精选牌、主角、图片和两条音轨', async () => {
  await generate(example, async (result, out) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const film = JSON.parse(await readFile(path.join(out, 'film.json'), 'utf8'));
    assert.equal(film.cards.length, 21);
    assert.equal(film.cards[6 * film.step].no, example.hero);
    assert.deepEqual(example.featured, Array.from({ length: 6 }, (_, i) => film.cards[i * film.step].no));
    assert.equal(film.cards.filter(card => card.img).length, 1);
    for (const image of film.images) assert.ok((await stat(path.join(out, 'assets', image))).size > 0);
    for (const audio of ['music.wav', 'sfx.wav']) assert.ok((await stat(path.join(out, 'audio', audio))).size > 0);
  });
});

for (const count of [7, 9, 31]) test(`${count} 张无图卡片正确选择精选牌和主角`, async () => {
  const cfg = structuredClone(example);
  cfg.cards = Array.from({ length: count }, (_, i) => ({ id: `item-${i}`, title: `示例 ${i + 1}`, color: '#6688cc' }));
  cfg.featured = cfg.cards.slice(0, 6).map(c => c.id); cfg.hero = cfg.cards[6].id;
  await generate(cfg, async (result, out) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const film = JSON.parse(await readFile(path.join(out, 'film.json'), 'utf8'));
    assert.equal(film.cards.length, count);
    assert.equal(film.cards[6 * film.step].title, '示例 7');
    assert.equal(film.cards.filter(c => c.img).length, 0);
  });
});

for (const count of [6, 32]) test(`${count} 张牌超出范围时不写入半成品`, async () => {
  const cfg = structuredClone(example);
  cfg.cards = Array.from({ length: count }, (_, i) => ({ title: `示例 ${i}` }));
  cfg.featured = []; delete cfg.hero;
  await generate(cfg, async (result, out) => {
    assert.notEqual(result.status, 0); assert.match(result.stdout, /cards 要 7—31 张/);
    await assert.rejects(stat(out), { code: 'ENOENT' });
  });
});

test('缺图时先报告错误，不写入工程', async () => {
  const cfg = structuredClone(example); cfg.cards[0].image = 'missing-card.jpg';
  await generate(cfg, async (result, out) => {
    assert.notEqual(result.status, 0); assert.match(result.stdout, /图片不存在/);
    await assert.rejects(stat(out), { code: 'ENOENT' });
  });
});

test('程序卡面把完整色卡、材质、光位和独立图标带入视频工程', async () => {
  const cfg=structuredClone(example);cfg.theme={stage:'warm',cardLook:'original'};
  const icon='fixture.png';
  cfg.cards.forEach(c=>{delete c.image;c.face={palette:'study-warm',layout:'split',back:'type',material:'metal',light:53,summary:'原有服务说明',icon};});
  await generate(cfg,async(result,out)=>{
    assert.equal(result.status,0,result.stdout+result.stderr);
    const film=JSON.parse(await readFile(path.join(out,'film.json'),'utf8'));
    for(const card of film.cards){assert.equal(card.face.brand,cfg.brand.wordmark);assert.equal(card.face.colors.name,'暖钛柔光');assert.equal(card.face.material,'metal');assert.equal(card.face.light,53);assert.ok((await stat(path.join(out,'assets',card.face.icon))).size>0);}
  });
  cfg.cards[0].face.palette='unknown';
  await generate(cfg,async(result,out)=>{assert.notEqual(result.status,0);assert.match(result.stdout,/face.palette/);await assert.rejects(stat(out),{code:'ENOENT'});});
});

test('卡面品牌和标语进入独立工程，拒绝错误类型', async () => {
  const cfg=structuredClone(example);
  cfg.cards.forEach(card=>{delete card.image;card.face={palette:'study-warm',brand:'Paper Nest',kicker:'研究工具'};});
  await generate(cfg,async(result,out)=>{
    assert.equal(result.status,0,result.stdout+result.stderr);
    const film=JSON.parse(await readFile(path.join(out,'film.json'),'utf8'));
    assert.ok(film.cards.every(card=>card.face.brand==='Paper Nest'&&card.face.kicker==='研究工具'));
  });
  cfg.cards[0].face.brand={invalid:true};
  await generate(cfg,async(result,out)=>{assert.notEqual(result.status,0);assert.match(result.stdout,/face.brand/);await assert.rejects(stat(out),{code:'ENOENT'});});
});

test('精选牌和主角重复时拒绝生成', async () => {
  const cfg = structuredClone(example); cfg.featured[0] = cfg.hero;
  await generate(cfg, async (result, out) => {
    assert.notEqual(result.status, 0); assert.match(result.stdout, /重复/);
    await assert.rejects(stat(out), { code: 'ENOENT' });
  });
});

test('背景预设保留原图，关闭干扰画面的附加光和浮尘', async () => {
  const cfg = structuredClone(example); cfg.background = { preset: 'studio-amber' };
  await generate(cfg, async (result, out) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const film = JSON.parse(await readFile(path.join(out, 'film.json'), 'utf8'));
    assert.equal(film.background.image, 'background.png');
    assert.equal(film.background.particles, false); assert.equal(film.background.glow, false);
    assert.ok(film.images.includes('background.png'));
    assert.deepEqual(await readFile(path.join(out, 'assets/background.png')), await readFile(path.join(repository, 'assets/backgrounds/studio-amber.png')));
  });
});

for (const background of [{ preset: 'missing' }, { image: 'missing.png' }, { preset: 'studio-amber', image: 'fixture.png' }, { dim: 2 }, { vignette: '0.5' }, { particles: 'false' }]) {
  test(`错误背景在生成前被拒绝：${JSON.stringify(background)}`, async () => {
    const cfg = structuredClone(example); cfg.background = background;
    await generate(cfg, async (result, out) => {
      assert.notEqual(result.status, 0); assert.match(result.stdout, /background/);
      await assert.rejects(stat(out), { code: 'ENOENT' });
    });
  });
}

test('自定义音轨与静音配置进入工程', async () => {
  const cfg = structuredClone(example);
  const source = path.join(repository, 'templates/card-carousel/assets/audio/sfx.wav');
  cfg.audio = { music: { path: source, volume: 0 }, sfx: { volume: 0.5 } };
  await generate(cfg, async (result, out) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const film = JSON.parse(await readFile(path.join(out, 'film.json'), 'utf8'));
    assert.equal(film.audio[0].volume, 0); assert.equal(film.audio[1].volume, 0.5);
    assert.deepEqual(await readFile(path.join(out, film.audio[0].path)), await readFile(source));
  });
});

test('缺音轨时不写入半成品', async () => {
  const cfg = structuredClone(example); cfg.audio = { music: { path: 'missing.wav' } };
  await generate(cfg, async (result, out) => {
    assert.notEqual(result.status, 0); assert.match(result.stdout, /音频不存在/);
    await assert.rejects(stat(out), { code: 'ENOENT' });
  });
});

test('可编辑配置搬移后能重新构建，不依赖原素材路径', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'guanmo-portable-'));
  try {
    const first = path.join(temp, 'first');
    const originalConfig = path.join(temp, 'config.json');
    const fixture = { ...example, background: { preset: 'studio-amber' } };
    await writeFile(path.join(temp, 'fixture.png'), samplePng);
    await writeFile(originalConfig, JSON.stringify(fixture));
    await buildFilm(originalConfig, first);
    const { rename } = await import('node:fs/promises');
    const moved = path.join(temp, 'moved'); await rename(path.join(first, 'source'), moved);
    await rm(first, { recursive: true });
    await rm(path.join(temp, 'fixture.png'));
    const config = JSON.parse(await readFile(path.join(moved, 'config.json'), 'utf8'));
    assert.equal(config.background?.preset, undefined); assert.equal(config.theme.cardLook, 'original');
    assert.equal(config.background.image, 'assets/background.png');
    assert.equal(config.audio.music.path, 'assets/music.wav');
    const second = path.join(temp, 'second'); await buildFilm(path.join(moved, 'config.json'), second);
    const film = JSON.parse(await readFile(path.join(second, 'film.json'), 'utf8'));
    assert.equal(film.theme.stage.bg, '#15110f'); assert.equal(film.theme.surface, undefined);
    assert.equal(film.cards.filter(card => card.img).length, 1);
    assert.ok(film.cards.every(c => c.backStyle === null));
    const meta = JSON.parse(await readFile(path.join(second, 'studio.json'), 'utf8'));
    assert.equal(meta.segments[0].start, 0); assert.equal(meta.segments.at(-1).end, meta.duration);
    for (let i = 1; i < meta.segments.length; i++) assert.equal(meta.segments[i].start, meta.segments[i - 1].end);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

for (const look of ['graphite', 'midnight', 'copper', 'glass']) test(`${look} 同时设置舞台与卡背，保留服务正面的识别色`, async () => {
  const cfg = structuredClone(example); cfg.theme = { look };
  await generate(cfg, async (result, out) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const film = JSON.parse(await readFile(path.join(out, 'film.json'), 'utf8'));
    assert.equal(film.theme.stage.mode, look === 'glass' ? 'glass' : 'studio');
    if (look === 'glass') assert.equal(film.background.particles, false);
    assert.equal(film.background.image, undefined);
    for (const card of film.cards) {
      const original = example.cards.find(c => c.no === card.no);
      assert.equal(card.color, original.color);
      assert.ok(film.theme.surface.palette.includes(card.back));
    }
  });
});

test('卡片样式与舞台独立：保留原卡片或只换卡片材质', async () => {
  const cfg = structuredClone(example); cfg.theme = { look: 'glass', cardLook: 'original' };
  cfg.cards[0].back = '#bb4455';
  await generate(cfg, async (result, out) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const film = JSON.parse(await readFile(path.join(out, 'film.json'), 'utf8'));
    assert.equal(film.theme.stage.mode, 'glass'); assert.equal(film.theme.surface, undefined);
    assert.equal(film.cards.find(c => c.no === cfg.cards[0].no).back, '#bb4455');
    assert.equal(film.cards.find(c => c.no === cfg.cards[0].no).color, cfg.cards[0].color);
  });
  cfg.theme = { look: 'graphite', cardLook: 'glass' };
  await generate(cfg, async (result, out) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const film = JSON.parse(await readFile(path.join(out, 'film.json'), 'utf8'));
    assert.equal(film.theme.stage.mode, 'studio'); assert.equal(film.theme.surface.glass, true);
    assert.equal(film.background.particles, true);
  });
  cfg.theme.cardLook = 'missing';
  await generate(cfg, async (result, out) => {
    assert.notEqual(result.status, 0); assert.match(result.stdout, /theme.cardLook/);
    await assert.rejects(stat(out), { code: 'ENOENT' });
  });
});

test('五种卡背风格随卡片重排，保留各自材质、文字对比与服务正面', async () => {
  const cfg = structuredClone(example); cfg.theme = { look: 'glass' };
  const presets = JSON.parse(await readFile(path.join(repository, 'templates/card-carousel/card-styles.json'), 'utf8'));
  const ids = Object.keys(presets);
  cfg.cards.forEach((c, i) => { c.backStyle = ids[i % ids.length]; });
  await generate(cfg, async (result, out) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const film = JSON.parse(await readFile(path.join(out, 'film.json'), 'utf8'));
    for (const card of film.cards) {
      const original = cfg.cards.find(c => c.no === card.no), preset = presets[original.backStyle];
      assert.equal(card.backStyle.id, original.backStyle);
      assert.equal(card.back, preset.base); assert.equal(card.backStyle.material, preset.material);
      assert.equal(card.backStyle.ink, preset.ink); assert.equal(card.color, original.color);
    }
    assert.equal(film.cards.find(c => c.backStyle.id === 'berry').backStyle.ink, '#4b2539');
  });
  cfg.cards[0].backStyle = 'missing';
  await generate(cfg, async (result, out) => {
    assert.notEqual(result.status, 0); assert.match(result.stdout, /backStyle/);
    await assert.rejects(stat(out), { code: 'ENOENT' });
  });
});

test('自定义卡背可覆盖配色预设，错误的质感名称在写入前被拒绝', async () => {
  const cfg = structuredClone(example); cfg.theme = { look: 'graphite' }; cfg.cards[0].back = '#506070';
  await generate(cfg, async (result, out) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const film = JSON.parse(await readFile(path.join(out, 'film.json'), 'utf8'));
    assert.equal(film.cards.find(c => c.no === cfg.cards[0].no).back, '#506070');
  });
  cfg.theme.look = 'missing';
  await generate(cfg, async (result, out) => {
    assert.notEqual(result.status, 0); assert.match(result.stdout, /theme.look/);
    await assert.rejects(stat(out), { code: 'ENOENT' });
  });
});
