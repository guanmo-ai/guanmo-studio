import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { containsPath, canonicalPath } from '../../scripts/paths.mjs';
import { resolveProjectFile } from '../../scripts/film-metadata.mjs';
import { writeScore } from './score.mjs';
import { duration, durationRange, openingOut, titleIn } from './timing.js';

const defaultGlyphs = ['{}', '{}', '[]', '<>', '//', '%', '+', '&', '=', '*', '0', '1', '2', '4', '6', '8', '9', '18'];
const json = value => JSON.stringify(value, null, 2) + '\n';
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const line = value => typeof value === 'string' && [...value].length <= 80 && !/[\r\n]/.test(value);

function normalize(config) {
  const film = {
    template: 'digital-horizon',
    title: typeof config.title === 'string' ? config.title.trim() : config.title,
    opening: config.opening === undefined ? '' : config.opening,
    duration: config.duration === undefined ? duration : config.duration,
    color: config.color === undefined ? '#ffa466' : config.color,
    particles: { count: 520, seed: 31, glyphs: defaultGlyphs, ...config.particles },
    audio: { enabled: true, volume: 0.85, ...config.audio },
  };
  if (!line(config.title) || !film.title) throw new Error('title 需要一行 1–80 字符的主标题');
  if (!line(film.opening)) throw new Error('opening 需要一行至多 80 字符的开场文字');
  if (!inRange(film.duration, ...durationRange) || !Number.isInteger(film.duration)) throw new Error('duration 需要 4–20 秒的整数');
  if (typeof film.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(film.color)) throw new Error('color 需要 #RRGGBB 格式');
  if (config.particles !== undefined && !isObject(config.particles)) throw new Error('particles 需要是对象');
  const { count, seed, glyphs } = film.particles;
  if (!inRange(count, 0, 1000) || !Number.isInteger(count)) throw new Error('particles.count 需要 0–1000 的整数');
  if (!inRange(seed, 0, 0xffffffff) || !Number.isInteger(seed)) throw new Error('particles.seed 需要 0–4294967295 的整数');
  if (!Array.isArray(glyphs) || !inRange(glyphs.length, 1, 48) ||
      glyphs.some(glyph => !line(glyph) || !glyph.trim() || [...glyph].length > 4)) {
    throw new Error('particles.glyphs 需要 1–48 个符号，每个符号 1–4 字符');
  }
  if (config.audio !== undefined && !isObject(config.audio)) throw new Error('audio 需要是对象');
  if (typeof film.audio.enabled !== 'boolean') throw new Error('audio.enabled 需要是布尔值');
  if (!inRange(film.audio.volume, 0, 1)) throw new Error('audio.volume 需要在 0–1 之间');
  if (film.audio.path !== undefined && (typeof film.audio.path !== 'string' || !film.audio.path.trim() || path.isAbsolute(film.audio.path))) {
    throw new Error('audio.path 需要是项目内的相对路径');
  }
  return film;
}

export async function assembleHorizon(config, configFile, out, target) {
  const film = normalize(config);
  const project = await canonicalPath(path.dirname(configFile));
  const destination = await canonicalPath(target);
  const source = path.join(out, 'source');
  await mkdir(source, { recursive: true });
  const { audio, ...visuals } = film;
  const tracks = [];
  if (audio.enabled) {
    const extension = audio.path === undefined ? '.wav' : path.extname(audio.path).toLowerCase();
    if (!['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac'].includes(extension)) throw new Error('audio.path 的音频格式不受支持');
    const relative = `audio/music${extension}`;
    await mkdir(path.join(out, 'audio'), { recursive: true });
    if (audio.path === undefined) {
      await writeScore(path.join(out, relative), film.duration);
    } else {
      const file = await resolveProjectFile(project, audio.path);
      if (containsPath(destination, file)) throw new Error('输出目录包含源音轨，不能替换');
      await copyFile(file, path.join(out, relative));
      await mkdir(path.join(source, 'audio'), { recursive: true });
      await copyFile(file, path.join(source, relative));
      audio.path = relative;
    }
    tracks.push({ name: 'music', path: relative, volume: audio.volume });
  }
  await copyFile(path.join(project, 'SOURCE.md'), path.join(source, 'SOURCE.md')).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  const fadeOut = openingOut[0] * film.duration / duration;
  const fadeIn = titleIn[0] * film.duration / duration;
  await Promise.all([
    writeFile(path.join(out, 'film.json'), json(visuals)),
    writeFile(path.join(source, 'config.json'), json(film)),
    writeFile(path.join(out, 'studio.json'), json({
      template: film.template, title: film.title, width: 1920, height: 1080, duration: film.duration, fps: 60,
      segments: [
        { id: '01-opening', name: '开场', start: 0, end: fadeOut },
        { id: '02-transition', name: '淡出与换字', start: fadeOut, end: fadeIn },
        { id: '03-title', name: '主标题', start: fadeIn, end: film.duration },
      ],
      audio: tracks,
    })),
    copyFile(new URL('./styles.css', import.meta.url), path.join(out, 'styles.css')),
  ]);
  return fileURLToPath(new URL('./scene.js', import.meta.url));
}
