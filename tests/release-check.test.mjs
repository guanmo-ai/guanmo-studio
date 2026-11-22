import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const video = 'examples/demo/video.mp4';
const poster = 'examples/demo/poster.jpg';
const config = 'examples/demo/config.json';
const prompt = 'templates/card-carousel/prompt.md';
const audio = ['music.wav', 'sfx.wav', 'sfx-synth.wav'].map(name => `templates/card-carousel/assets/audio/${name}`);
const sample = 'media bytes';
const sha256 = createHash('sha256').update(sample).digest('hex');

async function withRelease(check) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guanmo-release-check-'));
  const script = path.join(root, 'scripts', 'release-check.mjs');
  const write = async (file, contents) => {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, typeof contents === 'string' ? contents : JSON.stringify(contents));
  };
  try {
    await mkdir(path.dirname(script));
    await copyFile(new URL('../scripts/release-check.mjs', import.meta.url), script);
    await write('LICENSE', 'MIT License');
    for (const file of [video, poster, ...audio]) await write(file, sample);
    await write(config, {});
    await write(prompt, '模板提示词');
    await write('templates/catalog.json', { templates: [{ poster, prompt, examples: [{ video, poster }] }] });
    await write('docs/example-videos.json', { approvedExamples: [{ file: video, poster, config, bytes: Buffer.byteLength(sample), sha256 }] });
    await write('docs/asset-licenses.json', {
      groups: [{ id: 'demo', paths: [video, poster, ...audio], status: 'documented', license: 'MIT', evidence: 'LICENSE' }],
      sha256: Object.fromEntries([...audio, poster].map(file => [file, sha256]))
    });
    const run = () => spawnSync(process.execPath, [script], { encoding: 'utf8' });
    await check({ root, write, run });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('发布检查无需安装依赖，能识别成片、内置音轨和已登记封面被同长内容替换', async () => {
  await withRelease(async ({ write, run }) => {
    const clean = run();
    assert.equal(clean.status, 0, clean.stderr);
    const replaced = 'other bytes';
    assert.equal(replaced.length, sample.length);
    await write(video, replaced);
    await write(audio[0], replaced);
    await write(poster, replaced);
    const changed = run();
    assert.equal(changed.status, 1);
    assert.ok(changed.stderr.includes(`SHA256 与清单不符：${video}`));
    assert.ok(changed.stderr.includes(`SHA256 与清单不符：${audio[0]}`));
    assert.ok(changed.stderr.includes(`SHA256 与清单不符：${poster}`));
  });
});

test('发布检查拒绝隐藏目录中未登记的媒体和缺失的案例入口', async () => {
  await withRelease(async ({ root, write, run }) => {
    await write('.github/media/sample.webm', sample);
    await rm(path.join(root, config));
    await rm(path.join(root, poster));
    const failed = run();
    assert.equal(failed.status, 1);
    assert.ok(failed.stderr.includes('素材需要唯一许可记录：.github/media/sample.webm'));
    assert.ok(failed.stderr.includes('案例封面必须指向发布目录内的有效文件'));
    assert.ok(failed.stderr.includes('案例配置必须指向发布目录内的有效文件'));
  });
});

test('只展示成片的创作者案例需要来源说明', async () => {
  await withRelease(async ({ root, write, run }) => {
    const sourceNote = 'examples/demo/SOURCE.md';
    await write('docs/example-videos.json', {
      approvedExamples: [{ file: video, poster, source: 'creator-case', sourceNote, bytes: Buffer.byteLength(sample), sha256 }],
    });
    await rm(path.join(root, config));
    await write(sourceNote, '案例成片和封面来源');
    const documented = run();
    assert.equal(documented.status, 0, documented.stderr);
    await rm(path.join(root, sourceNote));
    const missing = run();
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /案例来源必须指向发布目录内的有效文件/);
  });
});
