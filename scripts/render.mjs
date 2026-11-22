import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir, writeFile, mkdtemp, rm, lstat } from 'node:fs/promises';
import { commitArtifacts, assertOutputDirectory, assertOutsideProject } from './artifacts.mjs';
import { withCancellation } from './cancellation.mjs';
import { parseCli } from './cli.mjs';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { serve } from './server.mjs';
import { exportEditPack } from './edit-pack.mjs';
import { browserLaunchOptions } from './browser.mjs';
import { readFilmMetadata } from './film-metadata.mjs';
import { duration as horizonDuration, proofTimes as horizonProofs } from '../templates/digital-horizon/timing.js';

export async function renderFilm(directory, { output, proofOnly = false, fps, editPack = false, draft = false, frame, signal, encoderCommand } = {}) {
  signal?.throwIfAborted();
  const started = performance.now();
  const root = path.resolve(directory);
  const target = path.resolve(output || `renders/${path.basename(root)}${draft ? '.draft' : ''}.mp4`);
  if (!target.toLowerCase().endsWith('.mp4')) throw new Error('--out 要以 .mp4 结尾');
  try { if (!(await lstat(target)).isFile()) throw new Error('MP4 输出不能覆盖目录、符号链接或其他非普通文件'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await assertOutsideProject(target, root);
  if (proofOnly && editPack) throw new Error('关键帧模式不生成剪辑包');
  const meta = await readFilmMetadata(root);
  if (frame !== undefined) {
    if (!Number.isFinite(frame) || frame < 0 || frame >= meta.duration) throw new Error(`--frame 要在 0—${meta.duration} 秒之间（不含片尾）`);
    if (editPack) throw new Error('单帧审阅不生成剪辑包');
    proofOnly = true;
  }
  fps ??= draft ? 30 : 60;
  if (![30, 60].includes(fps)) throw new Error('帧率只支持 30 或 60');
  if (draft && editPack) throw new Error('快速预览不生成剪辑包；定稿时去掉 --draft 并使用 --edit-pack');
  const scale = draft ? 0.5 : 1;
  const width = Math.round(meta.width * scale), height = Math.round(meta.height * scale);
  const encoderProgram = encoderCommand || { file: process.env.FFMPEG || 'ffmpeg', args: [] };
  if (!encoderProgram.file || !Array.isArray(encoderProgram.args)) throw new Error('编码器命令需要file和args数组');
  if (!proofOnly) for (const executable of [encoderProgram, { file: process.env.FFPROBE || 'ffprobe', args: [] }]) {
    const check = spawnSync(executable.file, [...executable.args, '-version'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    if (check.status !== 0) throw new Error(`无法运行 ${executable.file}，请运行 npm run doctor -- --render`);
  }
  const editTarget = target.replace(/\.mp4$/i, '') + '-edit';
  const basename = target.replace(/\.mp4$/i, '');
  const proofName = basename.toLowerCase().endsWith('.proof');
  if (!proofOnly && proofName) throw new Error('成片文件名不能以 .proof.mp4 结尾，请换一个文件名');
  const evidenceTarget = basename + (proofOnly && !proofName ? '.proof' : '') + '-checks';
  await assertOutsideProject(evidenceTarget, root);
  await assertOutputDirectory(evidenceTarget, [root, target], ['report.json']);
  if (editPack) {
    await assertOutsideProject(editTarget, root);
    await assertOutputDirectory(editTarget, [root, target], ['timeline.json', 'project']);
  }
  await mkdir(path.dirname(target), { recursive: true });
  const workspace = await mkdtemp(path.join(path.dirname(target), 'studio-render-'));
  const temporaryVideo = path.join(workspace, path.basename(target));
  const evidence = path.join(workspace, 'checks');
  await mkdir(evidence);
  let server, browser, encoder, encoding;
  const errors = [], consoleErrors = [];
  const abort = () => { encoder?.kill('SIGTERM'); browser?.close().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    signal?.throwIfAborted();
    server = await serve(root);
    browser = await chromium.launch(browserLaunchOptions());
    signal?.throwIfAborted();
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') consoleErrors.push(`${e.text()}${e.location().url ? ' · ' + e.location().url : ''}`); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(server.url + '?render=1' + (draft ? '&draft=1' : '') + (frame !== undefined ? '&still=1' : ''), { waitUntil: 'networkidle' });
    if (errors.length || consoleErrors.length) throw new Error('播放器资源加载失败：' + [...errors, ...consoleErrors].join('\n'));
    if (draft) await page.addStyleTag({ content: `#stage{transform:scale(${scale});transform-origin:top left}` });
    await page.waitForFunction(() => window.__studio?.ready || window.__studioErrors?.length, undefined, { timeout: 120000 });
    const startupErrors = await page.evaluate(() => window.__studioErrors || []);
    if (startupErrors.length) throw new Error(startupErrors.join('\n'));
    const gpu = await page.evaluate(() => {
      const gl = document.querySelector('canvas').getContext('webgl2');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), fonts: document.fonts.status };
    });
    const proofTimes = meta.template === 'digital-horizon'
      ? horizonProofs.map(time => time * meta.duration / horizonDuration)
      : [0, 0.7, 2.3, 3.4, 6.1, 6.3, 6.37, 7.6, 10, 10.45, 11.6, 14.9];
    const proofs = [];
    for (const time of frame === undefined ? proofTimes : [frame]) {
      signal?.throwIfAborted();
      await page.evaluate(t => window.__studio.seek(t), time);
      const file = `frame-${time.toFixed(2)}.png`;
      await page.screenshot({ path: path.join(evidence, file) });
      const text = await page.locator('#hud').innerText();
      proofs.push({ time, file, visibleText: text });
    }
    if (errors.length || consoleErrors.length) throw new Error([...errors, ...consoleErrors].join('\n'));
    if (!proofOnly) {
      const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', 'pipe:0'];
      for (const item of meta.audio) args.push('-i', path.join(root, item.path));
      if (meta.audio.length) {
        const filters = meta.audio.map((item, i) => `[${i + 1}:a]volume=${item.volume},apad,atrim=duration=${meta.duration}[a${i}]`);
        filters.push(meta.audio.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${meta.audio.length}:duration=longest:normalize=0[mix]`);
        args.push('-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[mix]', '-c:a', 'aac', '-b:a', '320k');
      } else args.push('-map', '0:v', '-an');
      args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-t', String(meta.duration), '-movflags', '+faststart', temporaryVideo);
      encoder = spawn(encoderProgram.file, [...encoderProgram.args, ...args], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
      let stderr = '';
      encoder.stderr.on('data', data => { stderr = (stderr + data).slice(-12000); });
      let encoderError;
      encoder.stdin.on('error', error => { encoderError = error; });
      encoding = new Promise((resolve, reject) => { encoder.on('error', reject); encoder.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg 失败 (${code}): ${stderr}`))); });
      encoding.catch(() => {});
      const frames = Math.round(meta.duration * fps);
      const start = performance.now();
      for (let i = 0; i < frames; i++) {
        signal?.throwIfAborted();
        if (encoderError || encoder.exitCode !== null) throw encoderError || new Error(stderr);
        await page.evaluate(t => window.__studio.seek(t), i / fps);
        const buffer = await page.screenshot({ type: 'png' });
        if (!encoder.stdin.write(buffer)) await Promise.race([once(encoder.stdin, 'drain'), encoding.then(() => { throw new Error('编码器提前退出'); })]);
        if (i % fps === 0) console.log(`渲染 ${i}/${frames} 帧，已用 ${((performance.now() - start) / 1000).toFixed(1)} 秒`);
      }
      encoder.stdin.end(); await encoding;
      const probe = spawnSync(process.env.FFPROBE || 'ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', temporaryVideo], { encoding: 'utf8', windowsHide: true });
      if (probe.status !== 0) throw new Error(`无法读取导出规格：${probe.stderr || probe.error?.message || probe.status}`);
      const media = JSON.parse(probe.stdout);
      const video = media.streams.find(s => s.codec_type === 'video');
      const audio = media.streams.find(s => s.codec_type === 'audio');
      const [rate, divisor] = video?.avg_frame_rate?.split('/').map(Number) || [];
      const duration = Number(media.format?.duration);
      if (video?.codec_name !== 'h264' || rate / divisor !== fps || (meta.audio.length ? audio?.codec_name !== 'aac' : audio) ||
          Number(video.nb_read_frames) !== frames || video.width !== width || video.height !== height ||
          !Number.isFinite(duration) || Math.abs(duration - meta.duration) > 0.05) throw new Error('导出规格检查失败');
      media.format.filename = target;
      await writeFile(path.join(evidence, 'ffprobe.json'), JSON.stringify(media, null, 2) + '\n');
    }
    errors.push(...await page.evaluate(() => window.__studioErrors));
    if (errors.length || consoleErrors.length) throw new Error([...errors, ...consoleErrors].join('\n'));
    signal?.throwIfAborted();
    const artifacts = [{ staged: evidence, target: evidenceTarget }];
    if (!proofOnly) {
      if (editPack) {
        await exportEditPack(root, temporaryVideo, { fps, output: path.join(workspace, 'edit'), finalDirectory: editTarget, signal });
        artifacts.push({ staged: path.join(workspace, 'edit'), target: editTarget });
      }
      artifacts.push({ staged: temporaryVideo, target });
    }
    const elapsedSeconds = Number(((performance.now() - started) / 1000).toFixed(2));
    await writeFile(path.join(evidence, 'report.json'), JSON.stringify({ project: meta.title, output: proofOnly ? null : target, mode: proofOnly ? 'proof-only' : 'full-render', quality: draft ? 'draft' : 'final', motionBlur: meta.template === 'card-carousel' && frame === undefined, width, height, fps, duration: meta.duration, elapsedSeconds, gpu, proofs, errors, consoleErrors }, null, 2) + '\n');
    await commitArtifacts(artifacts, { signal });
    if (editPack) console.log(`剪辑素材已导出：${editTarget}`);
    console.log(proofOnly ? `关键帧已保存：${evidenceTarget}` : `成片已导出并核对规格：${target}`);
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort);
    if (encoder && encoder.exitCode === null) encoder.kill('SIGTERM');
    if (encoding) {
      const force = setTimeout(() => { if (encoder.exitCode === null) encoder.kill('SIGKILL'); }, 2000);
      try { await encoding.catch(() => {}); } finally { clearTimeout(force); }
    }
    await rm(workspace, { recursive: true, force: true });
    if (browser) await browser.close();
    await server?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values, positionals } = parseCli({ out: { type: 'string' }, fps: { type: 'string' }, frame: { type: 'string' }, 'proof-only': { type: 'boolean' }, 'edit-pack': { type: 'boolean' }, draft: { type: 'boolean' } });
    if (values.help) console.log('用法：npm run render -- [构建目录] [--out 成片.mp4] [--proof-only | --frame 秒] [--draft] [--fps 30|60] [--edit-pack]');
    else await withCancellation(signal => renderFilm(positionals[0] || 'build/starter', { signal, output: values.out, proofOnly: values['proof-only'], fps: values.fps === undefined ? undefined : Number(values.fps), editPack: values['edit-pack'], draft: values.draft, frame: values.frame === undefined ? undefined : Number(values.frame) }));
  } catch (error) { console.error(error.stack); process.exitCode ||= 1; }
}
