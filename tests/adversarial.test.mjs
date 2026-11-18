import { runPython } from '../scripts/environment.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, access, symlink, lstat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { commitArtifacts } from '../scripts/artifacts.mjs';
import { prepareCardStudio } from '../scripts/card-studio.mjs';
import { validateSelection } from '../scripts/selection.mjs';
import { exportEditPack } from '../scripts/edit-pack.mjs';
import { renderFilm } from '../scripts/render.mjs';
import { writeNotices } from '../scripts/notices.mjs';
import { buildFilm, repository } from '../scripts/build.mjs';
import { samplePng } from './fixtures.mjs';

const catalog = JSON.parse(await readFile(path.join(repository, 'templates/card-carousel/front-styles.json'), 'utf8'));
const choice = { project: 'studio-demo', palette: 'porcelain', palettes: ['porcelain','look-graphite','look-copper','look-midnight'], seed: 72819, layout: 'split', back: 'type', material: 'auto', light: 41, time: 7.6 };

test('多个产物保存中途失败时，旧视频、检查目录和报告一起恢复', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio-rollback-'));
  try {
    const movie = path.join(dir, 'movie.mp4'), checks = path.join(dir, 'movie-checks');
    const stagedMovie = path.join(dir, 'new.mp4'), stagedChecks = path.join(dir, 'new-checks');
    await mkdir(checks); await mkdir(stagedChecks);
    await writeFile(movie, 'old video'); await writeFile(path.join(checks, 'report.json'), 'old report');
    await writeFile(stagedMovie, 'new video'); await writeFile(path.join(stagedChecks, 'report.json'), 'new report');
    await assert.rejects(commitArtifacts([{ staged: stagedMovie, target: movie }, { staged: stagedChecks, target: checks }, { staged: path.join(dir, 'missing'), target: path.join(dir, 'edit') }]));
    assert.equal(await readFile(movie, 'utf8'), 'old video'); assert.equal(await readFile(path.join(checks, 'report.json'), 'utf8'), 'old report');
    assert.ok(!(await readdir(dir)).some(name => name.endsWith('.backup')));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('同时保存同一成片和报告时，最终两个文件来自同一次导出', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio-concurrent-'));
  try {
    const targets = ['movie.mp4', 'report.json'].map(name => path.join(dir, name));
    const save = async label => {
      const staged = await Promise.all(targets.map(async (target, i) => {
        const file = path.join(dir, `${label}-${i}`);
        await writeFile(file, label);
        return { staged: file, target };
      }));
      await commitArtifacts(staged);
      return label;
    };
    const results = await Promise.allSettled([save('first'), save('second')]);
    const completed = results.filter(result => result.status === 'fulfilled').map(result => result.value);
    assert.ok(completed.length > 0);
    for (const result of results) if (result.status === 'rejected') assert.match(result.reason.message, /正在保存/);
    const [movie, report] = await Promise.all(targets.map(file => readFile(file, 'utf8')));
    assert.equal(movie, report);
    assert.ok(completed.includes(movie));
    assert.ok(!(await readdir(dir)).some(name => name.endsWith('.studio-lock')));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('目录别名无法覆盖输入配置或把导出写进源工程', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio-output-alias-'));
  try {
    const original = path.join(dir, 'original');
    const output = await buildFilm('starter', path.join(original, 'film'));
    const alias = path.join(dir, 'alias');
    await symlink(original, alias, process.platform === 'win32' ? 'junction' : 'dir');
    const config = path.join(output, 'source/config.json');
    const previous = await readFile(config);
    const note = path.join(output, 'source/notes.txt');
    await writeFile(note, 'user notes');
    await assert.rejects(buildFilm(config, path.join(alias, 'film')), /不能覆盖.*源配置/);
    await assert.rejects(renderFilm(output, { output: path.join(alias, 'film', 'out.mp4') }), /输出不能放在输入工程内/);
    await assert.rejects(exportEditPack(output, path.join(dir, 'movie.mp4'), { output: path.join(alias, 'film', 'edit') }), /输出不能放在输入工程内/);
    assert.deepEqual(await readFile(config), previous);
    assert.equal(await readFile(note, 'utf8'), 'user notes');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('构建快照复制符号链接的素材内容，失去原文件后仍能重建', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio-link-snapshot-'));
  try {
    const poster = path.join(dir, 'original.png');
    await writeFile(poster, samplePng);
    try { await symlink(poster, path.join(dir, 'linked.png'), 'file'); }
    catch (error) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) return t.skip('当前 Windows 账户不可创建文件符号链接');
      throw error;
    }
    const config = path.join(dir, 'config.json');
    const cfg = JSON.parse(await readFile(path.join(repository, 'examples/starter/config.json'), 'utf8'));
    cfg.cards[0].image = 'linked.png';
    await writeFile(config, JSON.stringify(cfg));
    const output = await buildFilm(config, path.join(dir, 'film'));
    const asset = path.join(output, 'source/assets/card-0.png');
    assert.ok((await lstat(asset)).isFile());
    assert.deepEqual(await readFile(asset), samplePng);
    await rm(poster);
    await buildFilm(path.join(output, 'source/config.json'), path.join(dir, 'rebuilt'));
    cfg.cards[0].image = asset;
    await writeFile(config, JSON.stringify(cfg));
    await assert.rejects(buildFilm(config, output), /输出目录包含源素材/);
    await access(asset);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('剪辑或渲染清单无效时提前退出，保留旧剪辑包', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio-invalid-metadata-'));
  try {
    const project = await buildFilm('starter', path.join(dir, 'film'));
    const file = path.join(project, 'studio.json');
    const original = JSON.parse(await readFile(file, 'utf8'));
    const edit = path.join(dir, 'edit');
    await mkdir(path.join(edit, 'project'), { recursive: true });
    await writeFile(path.join(edit, 'timeline.json'), 'previous timeline');
    for (const badSegments of [[{ ...original.segments[0], id: 'invalid clip name' }, ...original.segments.slice(1)],
      [original.segments[0], { ...original.segments[1], start: 1 }, ...original.segments.slice(2)]]) {
      await writeFile(file, JSON.stringify({ ...original, segments: badSegments }));
      await assert.rejects(exportEditPack(project, path.join(dir, 'no-video.mp4'), { output: edit }), /清单的 segments 无效/);
      assert.equal(await readFile(path.join(edit, 'timeline.json'), 'utf8'), 'previous timeline');
    }
    await writeFile(file, JSON.stringify({ ...original, audio: [{ name: 'music', path: 'audio/music.wav', volume: 1 }] }));
    await assert.rejects(renderFilm(project, { proofOnly: true, output: path.join(dir, 'out.mp4') }), /素材路径.*无效/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('已保存方案真正进入候选工程，原配置、保存文件和来源保持完整', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio-selected-'));
  const original = await readFile(path.join(repository, 'examples/studio-demo/config.json'));
  try {
    const selectionFile = path.join(dir, 'selection.json'), output = path.join(dir, 'selected');
    await assert.rejects(prepareCardStudio({ selectionFile, output, requireSelection: true }), /尚未保存/);
    const data = JSON.stringify(choice); await writeFile(selectionFile, data);
    await prepareCardStudio({ selectionFile, output, requireSelection: true });
    const film = JSON.parse(await readFile(path.join(output, 'film.json'), 'utf8'));
    const source = JSON.parse(await readFile(path.join(output, 'source/config.json'), 'utf8'));
    assert.deepEqual(source.styleSelection.palettes, choice.palettes); assert.equal(source.styleSelection.seed, choice.seed);
    const counts = {};
    for (const card of film.cards) {
      const face = card.face; counts[face.palette] = (counts[face.palette] || 0) + 1;
      assert.equal(face.layout, choice.layout); assert.equal(face.back, choice.back); assert.equal(face.light, choice.light);
    }
    assert.deepEqual(Object.keys(counts).sort(), [...choice.palettes].sort()); assert.deepEqual(Object.values(counts).sort(), [5,5,5,6]);
    await access(path.join(output, 'source/SOURCE.md'));
    assert.equal(await readFile(selectionFile, 'utf8'), data);
    assert.deepEqual(await readFile(path.join(repository, 'examples/studio-demo/config.json')), original);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('浏览器缓存和保存 API 共用校验；空浏览状态可恢复，非法方案不能通过', () => {
  assert.deepEqual(validateSelection({ ...choice, palettes: [] }, catalog, { allowEmpty: true }).palettes, []);
  assert.throws(() => validateSelection({ ...choice, palettes: [] }, catalog));
  for (const patch of [{ palettes: ['porcelain','porcelain'] }, { seed: 'bad' }, { light: 101 }, { material: 'oops' }, { project: 'other' }]) {
    assert.throws(() => validateSelection({ ...choice, ...patch }, catalog, { allowEmpty: true }));
  }
});

test('损坏的保存文件不阻止工作台预览，显式制作仍拒绝使用且不改写原文件', async () => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'studio-corrupt-selection-'));
  try {
    const selectionFile=path.join(dir,'selection.json'),raw='{broken';await writeFile(selectionFile,raw);
    const output=await prepareCardStudio({selectionFile,output:path.join(dir,'preview')});
    const source=JSON.parse(await readFile(path.join(output,'source/config.json'),'utf8'));
    assert.deepEqual(source.styleSelection.palettes,['porcelain']);
    assert.equal(await readFile(selectionFile,'utf8'),raw);
    await assert.rejects(prepareCardStudio({selectionFile,output:path.join(dir,'selected'),requireSelection:true}),/原文件已保留/);
    assert.equal(await readFile(selectionFile,'utf8'),raw);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('剪辑包拒绝覆盖仓库、输入工程和普通资料目录', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio-edit-guard-'));
  try {
    const video = path.join(dir, 'movie.mp4'); await writeFile(video, 'placeholder');
    await assert.rejects(exportEditPack(dir, video, { output: repository }), /不能覆盖/);
    await assert.rejects(exportEditPack(dir, video, { output: dir }), /不能覆盖/);
    const notes = path.join(dir, 'notes'); await mkdir(notes); await writeFile(path.join(notes, 'README.md'), 'my notes');
    await assert.rejects(exportEditPack(dir, video, { output: notes }), /非生成文件/);
    assert.equal(await readFile(path.join(notes, 'README.md'), 'utf8'), 'my notes');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('构建包与剪辑包的模板许可和来源链接能在包内找到', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio-notices-'));
  try {
    await writeNotices(dir);
    for (const name of ['THIRD_PARTY_NOTICES.md','TEMPLATE-SOURCES.md']) {
      const md = await readFile(path.join(dir, name), 'utf8');
      for (const match of md.matchAll(/\]\(([^\s)]+)\)/g)) {
        const href = match[1].split('#')[0];
        if (!href || /^[a-z]+:/i.test(href)) continue;
        await access(path.resolve(dir, href));
      }
    }
    assert.ok((await readdir(path.join(dir, 'licenses/fonts'))).length >= 4);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('非法舞台、字标和卡片字段返回字段错误，不泄漏 Python 堆栈', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio-shape-'));
  try {
    const starter = JSON.parse(await readFile(path.join(repository, 'examples/starter/config.json'), 'utf8'));
    const noBrand = structuredClone(starter);
    delete noBrand.brand;
    noBrand.cards[0].face = { palette: 'porcelain' };
    const badTile = structuredClone(starter);
    badTile.kit.tiles.items[0].big = { value: 'invalid' };
    await writeFile(path.join(dir, 'broken.svg'), 'invalid svg');
    for (const [cfg, field] of [
      [{ ...starter, theme: { stage: [] } }, /theme\.stage/],
      [{ ...starter, theme: { stage: { bg: 'wrong', glow: null } } }, /theme\.stage\.glow/],
      [{ ...starter, kit: { ...starter.kit, under: {} } }, /kit\.under/],
      [{ ...starter, brand: { ...starter.brand, paper: 'wrong' } }, /brand\.paper/],
      [{ ...starter, brand: { ...starter.brand, logo: 'broken.svg' } }, /brand\.logo.*无法解码/],
      [{ ...starter, hero: true }, /hero 要是/],
      [noBrand, /brand 缺少 wordmark/],
      [badTile, /items\[0\]\.big/],
    ]) {
      await writeFile(path.join(dir, 'config.json'), JSON.stringify(cfg));
      const result = runPython([path.join(repository,'templates/card-carousel/scripts/build_film.py'),path.join(dir,'config.json'),'--out',path.join(dir,'out'),'--standalone'], { encoding: 'utf8' });
      assert.notEqual(result.status, 0); assert.match(result.stdout, field); assert.doesNotMatch(result.stderr, /Traceback/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('MP4 输出拒绝覆盖同名目录，保留其中的资料', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio-video-dir-'));
  try {
    const out = path.join(dir, 'notes.mp4'); await mkdir(out);
    await writeFile(path.join(out, 'notes.txt'), 'keep');
    await writeFile(path.join(dir, 'studio.json'), JSON.stringify({ width:1920,height:1080,duration:15,audio:[] }));
    await assert.rejects(renderFilm(dir, { output: out }), /不能覆盖目录/);
    assert.equal(await readFile(path.join(out, 'notes.txt'), 'utf8'), 'keep');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
