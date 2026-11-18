import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { parseCli } from './cli.mjs';
import { resolvePython, runPython, installHints } from './environment.mjs';
import { browserExecutable, browserLaunchOptions } from './browser.mjs';

try {
  const { values } = parseCli({ render: { type: 'boolean' }, probe: { type: 'boolean' }, json: { type: 'boolean' } }, { maxPositionals: 0 });
  if (values.help) console.log('用法：npm run doctor -- [--render] [--probe] [--json]\n--probe 实际启动独立 Chromium 并检查 WebGL2，同时检查 FFmpeg 编码器。不安装软件，不访问外网。');
  else {
    const checks = [];
    const check = (name, ok, detail) => checks.push({ name, ok, detail });
    check('Node.js', Number(process.versions.node.split('.')[0]) >= 22, process.version + '（需要22+）');
    try {
      const python = resolvePython();
      const result = runPython(['-c', 'import PIL; print(PIL.__version__)'], { python, timeout: 10000 });
      check('Python / Pillow', result.status === 0, result.status === 0 ? `${python.version} / Pillow ${result.stdout.trim()} / ${python.file}` : 'Python可运行，但缺少Pillow；请运行 npm run setup');
    } catch (error) { check('Python / Pillow', false, error.message + ' ' + installHints(process.platform)); }
    if (values.render || values.probe) {
      try { check('独立 Chromium', true, browserExecutable()); }
      catch (error) { check('独立 Chromium', false, error.message); }
      for (const [label, command] of [['FFmpeg', process.env.FFMPEG || 'ffmpeg'], ['ffprobe', process.env.FFPROBE || 'ffprobe']]) {
        const result = spawnSync(command, ['-version'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
        check(label, result.status === 0, result.status === 0 ? result.stdout.split('\n')[0] : installHints(process.platform));
      }
      const encoders = spawnSync(process.env.FFMPEG || 'ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
      check('H.264 / AAC 编码器', encoders.status === 0 && /\blibx264\b/.test(encoders.stdout) && /\baac\b/.test(encoders.stdout), '需要libx264与aac；ffmpeg -version成功不代表编码器齐全');
    }
    if (values.probe) {
      let browser;
      try {
        browser = await chromium.launch(browserLaunchOptions());
        const page = await browser.newPage();
        const gpu = await page.evaluate(() => {
          const gl = document.createElement('canvas').getContext('webgl2');
          if (!gl) throw new Error('无法创建WebGL2上下文');
          const debug = gl.getExtension('WEBGL_debug_renderer_info');
          return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        });
        check('Chromium / WebGL2 实际启动', true, gpu);
      } catch (error) { check('Chromium / WebGL2 实际启动', false, `${error.message}；Linux可先运行 npm run setup -- --with-deps，或设置 STUDIO_GL=software`); }
      finally { await browser?.close(); }
    }
    const report = { platform: process.platform, arch: process.arch, node: process.version, gl: process.env.STUDIO_GL || 'auto', checks, ok: checks.every(item => item.ok) };
    if (values.json) console.log(JSON.stringify(report, null, 2));
    else for (const item of checks) console.log(`${item.ok ? '通过' : '缺失'} · ${item.name}：${item.detail}`);
    if (!report.ok) process.exitCode = 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
