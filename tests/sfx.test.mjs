import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/sfx.mjs', import.meta.url));
const bundled = new URL('../templates/card-carousel/assets/audio/sfx-synth.wav', import.meta.url);
const rate = 48_000;
const header = 44;
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

test('内置音效可重建随附的 15 秒立体声 WAV', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'studio-sfx-'));
  try {
    const output = path.join(folder, 'effects.wav');
    const result = run('--out', output);
    assert.equal(result.status, 0, result.stderr);
    const wav = await readFile(output);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt16LE(22), 2);
    assert.equal(wav.readUInt32LE(24), rate);
    assert.equal(wav.readUInt32LE(40), 15 * rate * 4);
    const reference = await readFile(bundled);
    assert.equal(wav.length, reference.length);
    assert.deepEqual(wav.subarray(0, header), reference.subarray(0, header));
    for (let i = header; i < wav.length; i += 2) {
      assert.ok(Math.abs(wav.readInt16LE(i) - reference.readInt16LE(i)) <= 1);
    }
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('自定义时间点和声像生效，生成命令保护已有输出', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'studio-sfx-'));
  try {
    const cues = path.join(folder, 'cues.json');
    const output = path.join(folder, 'effects.wav');
    await writeFile(cues, JSON.stringify([{ time: 3, sound: 'stamp', duration: 0.1, pan: -1 }]));
    const result = run('--cues', cues, '--out', output);
    assert.equal(result.status, 0, result.stderr);
    const wav = await readFile(output);
    const onset = header + 3 * rate * 4;
    const end = header + 3.1 * rate * 4;
    assert.ok(wav.subarray(header, onset).every(value => value === 0));
    assert.ok(wav.subarray(end).every(value => value === 0));
    let hasLeftSignal = false;
    let hasRightSignal = false;
    for (let i = onset; i < end; i += 4) {
      hasLeftSignal ||= wav.readInt16LE(i) !== 0;
      hasRightSignal ||= wav.readInt16LE(i + 2) !== 0;
    }
    assert.equal(hasLeftSignal, true);
    assert.equal(hasRightSignal, false);
    assert.match(run('--cues', cues, '--out', output).stderr, /输出已存在/);
    assert.deepEqual(await readFile(output), wav);
    await writeFile(cues, JSON.stringify([{ time: 15, sound: 'stamp' }]));
    assert.match(run('--cues', cues, '--out', path.join(folder, 'invalid.wav')).stderr, /time/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
