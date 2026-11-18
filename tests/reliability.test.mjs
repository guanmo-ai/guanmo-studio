import { runPython } from '../scripts/environment.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, symlink, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import { serve } from '../scripts/server.mjs';
import { buildFilm, repository } from '../scripts/build.mjs';

const starter = JSON.parse(await readFile(path.join(repository, 'examples/starter/config.json'), 'utf8'));
const builder = path.join(repository, 'templates/card-carousel/scripts/build_film.py');

test('HTTP 拒绝隐藏文件、外部符号链接、外站和非法方法，正确发送字体与 WebP 类型', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guanmo-private-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'guanmo-outside-')); let server;
  try {
    await writeFile(path.join(outside, 'private.txt'), 'private');
    await symlink(outside, path.join(root, 'outside'), process.platform === 'win32' ? 'junction' : 'dir');
    await mkdir(path.join(root, '.local')); await writeFile(path.join(root, '.local/selection.json'), 'private');
    await mkdir(path.join(root, 'NODE_MODULES')); await writeFile(path.join(root, 'NODE_MODULES/private.txt'), 'private dependency');
    await writeFile(path.join(root, 'image.webp'), 'image'); await writeFile(path.join(root, 'font.woff2'), 'font');
    await writeFile(path.join(root, 'empty.mp4'), '');
    server = await serve(root);
    for (const uri of ['.local/selection.json', '%2elocal/selection.json', 'NODE_MODULES/private.txt', 'outside/private.txt']) assert.equal((await fetch(server.url + uri)).status, 403);
    assert.equal((await fetch(server.url + 'image.webp')).headers.get('content-type'), 'image/webp');
    assert.equal((await fetch(server.url + 'font.woff2')).headers.get('content-type'), 'font/woff2');
    assert.equal((await fetch(server.url + 'image.webp', { method: 'POST' })).status, 405);
    assert.equal((await fetch(server.url + 'image.webp', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    const rebound = await new Promise((resolve, reject) => {
      const req = http.get(server.url + 'image.webp', { headers: { Host: 'foreign.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject);
    });
    assert.equal(rebound, 403);
    assert.equal((await fetch(server.url + '%E0%A4%A')).status, 400);
    assert.equal((await fetch(server.url + 'empty.mp4')).headers.get('content-length'), '0');
    for (const range of ['bytes=-0', 'bytes=5-2', 'bytes=0-1,4-5', 'bytes=999999999999999999999-']) assert.equal((await fetch(server.url + 'image.webp', { headers: { Range: range } })).status, 416);
  } finally { await server?.close(); await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});

test('构建拒绝错误类型、重复 ID 和损坏图片；失败保留上次工程并清理临时目录', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guanmo-atomic-'));
  try {
    const config = path.join(root, 'config.json'), out = path.join(root, 'film');
    await writeFile(config, JSON.stringify(starter)); await buildFilm(config, out);
    const previous = await readFile(path.join(out, 'app.js'));
    const film = JSON.parse(await readFile(path.join(out, 'film.json'), 'utf8'));
    assert.deepEqual(film.audio, []);
    assert.equal((await readdir(path.join(out, 'source/assets'))).length, 0);
    const malformed = [null, { ...starter, cards: 'wrong' }, { ...starter, hook: { title: [3] } }, { ...starter, theme: { accent: {} } }];
    const duplicate = structuredClone(starter); duplicate.cards[1].id = duplicate.cards[0].id; malformed.push(duplicate);
    await writeFile(path.join(root, 'broken.jpg'), 'not an image');
    const broken = structuredClone(starter); broken.cards[0].image = 'broken.jpg'; malformed.push(broken);
    for (const cfg of malformed) {
      await writeFile(config, JSON.stringify(cfg)); await assert.rejects(buildFilm(config, out));
      assert.deepEqual(await readFile(path.join(out, 'app.js')), previous);
      assert.ok(!(await readdir(root)).some(x => x.startsWith('studio-build-') || x.endsWith('.backup')));
    }
    const conflict = path.join(root, 'valuable'); await mkdir(conflict); await writeFile(path.join(conflict, 'notes.txt'), 'keep');
    await assert.rejects(buildFilm(config, conflict), /非生成文件/);
    assert.equal(await readFile(path.join(conflict, 'notes.txt'), 'utf8'), 'keep');
    await assert.rejects(buildFilm(config, root), /源配置/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('1×1 图片可构建，关闭音轨不要求文件存在，超量精选牌被明确拒绝', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guanmo-tiny-'));
  try {
    const img = runPython(['-c', 'from PIL import Image; import sys; Image.new("RGB", (1,1), "#667788").save(sys.argv[1])', path.join(root, 'tiny.png')]);
    assert.equal(img.status, 0);
    const cfg = structuredClone(starter); cfg.cards[0].image = 'tiny.png'; cfg.audio.music.path = 'missing.wav';
    const config = path.join(root, 'config.json'); await writeFile(config, JSON.stringify(cfg));
    const result = runPython([builder, config, '--out', path.join(root, 'film'), '--standalone'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok((await stat(path.join(root, 'film/assets/card-00.jpg'))).size);
    cfg.featured = cfg.cards.map(c => c.id); await writeFile(config, JSON.stringify(cfg));
    const bad = runPython([builder, config, '--out', path.join(root, 'invalid'), '--standalone'], { encoding: 'utf8' });
    assert.notEqual(bad.status, 0); assert.match(bad.stdout, /featured 最多/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('CLI 拒绝未知参数、缺值和冲突，help 不触发构建', () => {
  for (const args of [['update', 'does-not-exist', '--draft', '--final'], ['update', 'does-not-exist', '--edit-pack'], ['build', '--out'], ['render', '--frame'], ['build', '--unknown'], ['setup', '--with-deps', '--skip-browser'], ['setup', '--unknown'], ['container', '--no-build', '--unknown']]) {
    const [script, ...rest] = args;
    const result = spawnSync(process.execPath, [path.join(repository, `scripts/${script}.mjs`), ...rest], { encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.doesNotMatch(result.stderr, /无法读取配置/);
  }
  for (const script of ['build', 'render', 'update', 'doctor', 'studio', 'preview', 'setup', 'container']) {
    const result = spawnSync(process.execPath, [path.join(repository, `scripts/${script}.mjs`), '--help'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /用法/);
  }
});
