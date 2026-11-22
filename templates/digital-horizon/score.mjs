import { writeFile } from 'node:fs/promises';

const tau = 2 * Math.PI;

// 本地合成一条立体声音轨。缓慢的和声起伏贯穿换字和片尾。
export async function writeScore(file, duration) {
  const rate = 48000;
  const frames = rate * duration;
  const bytes = Buffer.alloc(44 + frames * 4);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 4, 28);
  bytes.writeUInt16LE(4, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(frames * 4, 40);
  const voices = [
    [73.42, 0.014], [146.83, 0.034], [293.66, 0.037], [369.99, 0.029],
    [440.00, 0.022], [587.33, 0.013], [739.99, 0.007], [880.00, 0.005],
  ];
  for (let i = 0; i < frames; i++) {
    const t = i / rate;
    const position = t / duration;
    const swell = 0.47 + 0.46 * Math.exp(-((position - 0.30) ** 2) / 0.026)
      + 0.43 * Math.exp(-((position - 0.83) ** 2) / 0.021);
    const level = 2.45 * swell * Math.min(1, t / 0.23) * Math.min(1, (duration - t) / 0.38);
    let left = 0, right = 0;
    for (const [frequency, strength] of voices) {
      const phase = frequency * tau * t;
      const drift = 0.32 * Math.sin(t * 1.45 + frequency);
      const timbre = strength * (0.86 + 0.14 * Math.sin(t + frequency));
      const center = 0.65 * Math.sin(phase + drift + frequency);
      left += timbre * (center + 0.35 * Math.sin(phase * 0.9984 - drift));
      right += timbre * (center + 0.35 * Math.sin(phase * 1.0016 - drift));
    }
    bytes.writeInt16LE(Math.round(left * level * 32767), 44 + i * 4);
    bytes.writeInt16LE(Math.round(right * level * 32767), 46 + i * 4);
  }
  await writeFile(file, bytes);
}
