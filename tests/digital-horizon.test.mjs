import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { buildFilm } from '../scripts/build.mjs';
import { readFilmMetadata } from '../scripts/film-metadata.mjs';
import { writeScore } from '../templates/digital-horizon/score.mjs';

test('数字地平线按项目配置构建，可用快照重新构建自带音轨', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio-horizon-'));
  try {
    const input = path.join(dir, 'config.json');
    const out = path.join(dir, 'output');
    const track = path.join(dir, 'track.wav');
    await writeScore(track, 1);
    const config = {
      template: 'digital-horizon', duration: 5, title: '观默工作室', color: '#778dff',
      particles: { count: 0 }, audio: { path: 'track.wav', volume: 0.42 },
    };
    await writeFile(input, JSON.stringify(config));
    await buildFilm(input, out);
    const meta = await readFilmMetadata(out);
    assert.equal(meta.title, '观默工作室');
    assert.equal(meta.duration, 5);
    assert.equal(meta.segments.length, 3);
    assert.equal(meta.segments.at(-1).end, 5);
    assert.deepEqual(meta.audio, [{ name: 'music', path: 'audio/music.wav', volume: 0.42 }]);

    const rebuilt = await buildFilm(path.join(out, 'source/config.json'), path.join(dir, 'rebuilt'));
    assert.deepEqual(await readFile(path.join(rebuilt, 'audio/music.wav')), await readFile(track));
    await writeFile(input, JSON.stringify({ ...config, duration: 2 }));
    await assert.rejects(buildFilm(input, out), /duration/);
    assert.deepEqual(await readFilmMetadata(out), meta);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
