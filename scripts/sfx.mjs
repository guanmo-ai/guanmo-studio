import path from 'node:path';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { parseCli } from './cli.mjs';

const template = new URL('../templates/card-carousel/', import.meta.url);
const sampleRate = 48_000;
const tau = 2 * Math.PI;

const sounds = {
  whoosh: {
    duration: 0.4,
    sample: (time, progress, band) => band * (0.9 + progress * 0.5) * Math.sin(Math.PI * progress) ** 1.7,
  },
  card: {
    duration: 0.11,
    sample: (time, progress, band, grit) =>
      (grit * 0.48 + band * 0.28) * Math.exp(-time * 58) +
      Math.sin(tau * (205 * time - 150 * time ** 2)) * 0.27 * Math.exp(-time * 32),
  },
  pop: {
    duration: 0.12,
    sample: (time, progress, band) =>
      (Math.sin(tau * (570 * time + 190 * time ** 2)) * 0.36 + band * 0.22) * Math.exp(-time * 35),
  },
  stamp: {
    duration: 0.34,
    sample: (time, progress, band, grit) =>
      Math.sin(tau * (78 * time + 1.6 * (1 - Math.exp(-time * 34)))) * 0.56 * Math.exp(-time * 15) +
      (band * 0.40 + grit * 0.30) * Math.exp(-time * 95),
  },
};

function readCue(cue, index, end) {
  const label = `第 ${index + 1} 个音效`;
  if (!cue || typeof cue !== 'object' || typeof cue.sound !== 'string' || !Object.hasOwn(sounds, cue.sound)) {
    throw new Error(`${label}的 sound 要填写 whoosh、card、pop 或 stamp`);
  }
  const { sound, time, duration = sounds[sound].duration, gain = 0.6, pan = 0 } = cue;
  if (!Number.isFinite(time) || time < 0 || time >= end) throw new Error(`${label}的 time 要在 0 至 ${end} 秒之间，且小于 ${end}`);
  if (!Number.isFinite(duration) || duration < 0.02 || duration > 2) throw new Error(`${label}的 duration 要在 0.02 至 2 秒之间`);
  if (!Number.isFinite(gain) || gain < 0 || gain > 1) throw new Error(`${label}的 gain 要在 0 至 1 之间`);
  if (!Number.isFinite(pan) || pan < -1 || pan > 1) throw new Error(`${label}的 pan 要在 -1 至 1 之间`);
  return { sound, time, duration, gain, pan };
}

function addCue(mix, cue, index) {
  const start = Math.floor(cue.time * sampleRate);
  const length = Math.min(Math.round(cue.duration * sampleRate), mix.length / 2 - start);
  const sample = sounds[cue.sound].sample;
  const left = Math.sqrt((1 - cue.pan) / 2) * cue.gain;
  const right = Math.sqrt((1 + cue.pan) / 2) * cue.gain;
  let seed = index + 1;
  let fast = 0;
  let slow = 0;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    fast += (noise - fast) * 0.34;
    slow += (noise - slow) * 0.055;
    const ramp = Math.min(1, i / (sampleRate * 0.003), (length - 1 - i) / (sampleRate * 0.015));
    const value = sample(i / sampleRate, i / length, fast - slow, noise - fast) * ramp;
    mix[2 * (start + i)] += value * left;
    mix[2 * (start + i) + 1] += value * right;
  }
}

function encodeWav(mix) {
  const bytes = mix.length * 2;
  const wav = Buffer.alloc(44 + bytes);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + bytes, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(bytes, 40);
  let peak = 0;
  for (const value of mix) peak = Math.max(peak, Math.abs(value));
  const scale = 32767 * (peak > 0.8 ? 0.8 / peak : 1);
  for (let i = 0; i < mix.length; i++) wav.writeInt16LE(Math.round(mix[i] * scale), 44 + i * 2);
  return wav;
}

try {
  const { values } = parseCli({ out: { type: 'string' }, cues: { type: 'string' } }, { maxPositionals: 0 });
  if (values.help) {
    console.log('用法：npm run sfx -- --out 音效.wav [--cues 时间点.json]');
  } else {
    if (!values.out || !/\.wav$/i.test(values.out)) throw new Error('--out 要指定 WAV 输出文件');
    const { duration } = JSON.parse(await readFile(new URL('timeline.json', template), 'utf8'));
    const cueFile = values.cues || new URL('sfx-cues.json', template);
    const recipe = JSON.parse(await readFile(cueFile, 'utf8'));
    if (!Array.isArray(recipe) || recipe.length === 0) throw new Error('音效时间表至少需要一个音效');
    const cues = recipe.map((cue, index) => readCue(cue, index, duration));
    const mix = new Float32Array(sampleRate * duration * 2);
    cues.forEach((cue, index) => addCue(mix, cue, index));
    const wav = encodeWav(mix);
    const output = path.resolve(values.out);
    await mkdir(path.dirname(output), { recursive: true });
    const file = await open(output, 'wx').catch(error => {
      if (error.code === 'EEXIST') throw new Error(`输出已存在，请选用新的文件：${output}`);
      throw error;
    });
    try {
      await file.writeFile(wav);
    } catch (error) {
      await file.close();
      await unlink(output);
      throw error;
    }
    await file.close();
    console.log(`已生成 ${duration} 秒音效，${cues.length} 个声音事件：${output}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
