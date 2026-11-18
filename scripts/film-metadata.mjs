import path from 'node:path';
import { readFile, realpath, stat } from 'node:fs/promises';
import { containsPath } from './paths.mjs';

function invalid(field) {
  return new Error(`构建清单的 ${field} 无效，请用源配置重新运行 npm run build`);
}

export async function readFilmMetadata(directory) {
  let meta;
  try { meta = JSON.parse(await readFile(path.join(directory, 'studio.json'), 'utf8')); }
  catch (cause) { throw new Error('无法读取构建清单 studio.json，请用源配置运行 npm run build', { cause }); }
  if (meta?.template !== 'card-carousel' || meta.width !== 1920 || meta.height !== 1080 || meta.duration !== 15 || meta.fps !== 60) {
    throw invalid('模板或视频规格');
  }
  if (!Array.isArray(meta.segments) || meta.segments.length !== 6) throw invalid('segments');
  const ids = new Set();
  let end = 0;
  for (const segment of meta.segments) {
    if (typeof segment?.id !== 'string' || !/^\d{2}-[a-z0-9-]+$/.test(segment.id) || ids.has(segment.id) ||
        typeof segment.name !== 'string' || !segment.name.trim() || segment.start !== end ||
        !Number.isFinite(segment.end) || segment.end - segment.start < 1 / 30 || segment.end > meta.duration) throw invalid('segments');
    ids.add(segment.id);
    end = segment.end;
  }
  if (end !== meta.duration) throw invalid('segments');
  if (!Array.isArray(meta.audio)) throw invalid('audio');
  const names = new Set();
  const root = await realpath(directory);
  for (const track of meta.audio) {
    if (!['music', 'sfx'].includes(track?.name) || names.has(track.name) ||
        !['wav', 'mp3', 'm4a', 'aac', 'ogg', 'flac'].some(ext => track.path === `audio/${track.name}.${ext}`) ||
        !Number.isFinite(track.volume) || track.volume < 0 || track.volume > 1) throw invalid('audio');
    names.add(track.name);
    await resolveProjectFile(root, track.path);
  }
  return meta;
}

export async function resolveProjectFile(root, relative) {
  try {
    const file = await realpath(path.resolve(root, relative));
    if (containsPath(root, file) && (await stat(file)).isFile()) return file;
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
  }
  throw invalid('素材路径');
}
