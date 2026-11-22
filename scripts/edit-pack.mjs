import { quoteShell } from './paths.mjs';
import { setImmediate } from 'node:timers/promises';
import { withCancellation } from './cancellation.mjs';
import path from 'node:path';
import { mkdir, cp, copyFile, writeFile, readFile, realpath, lstat, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { commitArtifacts, assertOutputDirectory, assertOutsideProject } from './artifacts.mjs';
import { writeNotices } from './notices.mjs';
import { parseCli } from './cli.mjs';
import { readFilmMetadata, resolveProjectFile } from './film-metadata.mjs';

function ffmpeg(args) {
  const result = spawnSync(process.env.FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`剪辑素材导出失败：${result.stderr || result.error?.message}`);
}

async function assembleEditPack(directory, video, { output, fps, finalDirectory, signal } = {}) {
  const root = await realpath(directory);
  const meta = await readFilmMetadata(root);
  fps ??= meta.fps;
  if (![30, 60].includes(fps)) throw new Error('帧率只支持 30 或 60');
  const film = JSON.parse(await readFile(path.join(root, 'film.json'), 'utf8'));
  const image = film.background?.image;
  let background;
  if (image !== undefined) {
    if (typeof image !== 'string' || !/^background\.(png|jpe?g|webp|gif)$/.test(image)) throw new Error('构建清单的背景文件名无效，请重新运行 npm run build');
    background = await resolveProjectFile(root, `assets/${image}`);
  }
  const probe = spawnSync(process.env.FFPROBE || 'ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_streams', '-of', 'json', path.resolve(video)], { encoding: 'utf8', windowsHide: true });
  if (probe.status !== 0) throw new Error(`无法读取成片：${probe.stderr || probe.error?.message}`);
  const stream = JSON.parse(probe.stdout).streams[0];
  const rate = stream?.avg_frame_rate?.split('/').map(Number);
  if (!stream || !rate || rate[0] / rate[1] !== fps || Number(stream.nb_read_frames) !== Math.round(meta.duration * fps) || stream.width !== meta.width || stream.height !== meta.height) {
    throw new Error('成片规格与构建目录不一致，请使用同一版配置导出的完整视频');
  }
  const target = path.resolve(output || video.replace(/\.mp4$/i, '') + '-edit');
  await mkdir(path.join(target, 'clips'), { recursive: true });
  await mkdir(path.join(target, 'audio'), { recursive: true });
  await cp(path.join(root, 'source'), path.join(target, 'project'), {
    recursive: true,
    async filter(file) {
      const info = await lstat(file);
      if (!info.isFile() && !info.isDirectory()) throw new Error('构建快照含符号链接或特殊文件，请重新运行 npm run build 后再导出剪辑包');
      return true;
    },
  });
  // 按帧切开、重新编码，不能 stream-copy 到临近关键帧。
  const segments = [];
  for (const segment of meta.segments) {
    await setImmediate(); signal?.throwIfAborted();
    const startFrame = Math.round(segment.start * fps), endFrame = Math.round(segment.end * fps);
    const file = `clips/${segment.id}.mp4`;
    ffmpeg(['-i', path.resolve(video), '-vf', `trim=start_frame=${startFrame}:end_frame=${endFrame},setpts=PTS-STARTPTS`, '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', path.join(target, file)]);
    segments.push({ ...segment, startFrame, endFrame, frames: endFrame - startFrame, file });
  }
  const tracks = [];
  for (const track of meta.audio) {
    await setImmediate(); signal?.throwIfAborted();
    const file = `audio/${track.name}.wav`;
    ffmpeg(['-i', path.join(root, track.path), '-af', `volume=${track.volume},apad,atrim=duration=${meta.duration}`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', path.join(target, file)]);
    tracks.push({ name: track.name, file, start: 0, duration: meta.duration, volumeApplied: track.volume });
  }
  await writeNotices(target);
  if (background) await copyFile(background, path.join(target, image));
  await writeFile(path.join(target, 'timeline.json'), JSON.stringify({ template: meta.template, width: meta.width, height: meta.height, fps, duration: meta.duration, segments, audio: tracks }, null, 2) + '\n');
  await writeFile(path.join(target, 'markers.csv'), 'name,start_seconds,end_seconds,start_frame,end_frame\n' + segments.map(s => `"${s.name.replaceAll('"', '""')}",${s.start},${s.end},${s.startFrame},${s.endFrame}`).join('\n') + '\n');
  await writeFile(path.join(target, 'README.md'), `# 剪辑素材\n\n将 clips/ 中的 ${segments.length} 段无声视频按编号放到同一视频轨。audio/ 中的启用音轨从 0 秒开始放到独立轨道。总时长 ${meta.duration} 秒，${fps}fps，1920×1080。导入后保持 0dB 即可复现混音。\n\n段落边界见 timeline.json 和 markers.csv。要替换画面内容，编辑 project/config.json，并在 Guanmo Studio 仓库根目录执行以下命令。\n\n\`\`\`${process.platform === 'win32' ? 'powershell' : 'bash'}\nnpm run build -- ${shellQuote(path.join(finalDirectory || target, 'project/config.json'))} --out build/reedit\nnpm run render -- build/reedit --out renders/reedit.mp4 --edit-pack\n\`\`\`\n\nproject/ 保留原素材和相对路径配置，可整体搬移并用 Guanmo Studio 重新渲染。素材许可沿用原项目记录。\n`);

  return target;
}

const shellQuote = value => quoteShell(value, process.platform === 'win32' ? 'powershell' : 'bash');

export async function exportEditPack(directory, video, { output, fps, finalDirectory, signal } = {}) {
  const root = path.resolve(directory), movie = path.resolve(video);
  const target = path.resolve(output || movie.replace(/\.mp4$/i, '') + '-edit');
  const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  await assertOutputDirectory(target, [repository, root, movie], ['timeline.json', 'project']);
  await assertOutsideProject(target, root);
  await mkdir(path.dirname(target), { recursive: true });
  const staged = await mkdtemp(path.join(path.dirname(target), 'studio-edit-'));
  try {
    await assembleEditPack(root, movie, { output: staged, fps, finalDirectory: finalDirectory || target, signal });
    await commitArtifacts([{ staged, target }], { signal });
    if (!finalDirectory) console.log(`剪辑素材已导出：${target}`);
    return target;
  } finally { await rm(staged, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values, positionals } = parseCli({ out: { type: 'string' } }, { maxPositionals: 2 });
    if (values.help) console.log('用法：node scripts/edit-pack.mjs <构建目录> <成片.mp4> [--out 目录]');
    else {
      if (positionals.length !== 2) throw new Error('需要构建目录和成片路径，请使用 --help 查看用法');
      await withCancellation(signal => exportEditPack(positionals[0], positionals[1], { output: values.out, signal }));
    }
  } catch (error) { console.error(error.message); process.exitCode ||= 1; }
}
