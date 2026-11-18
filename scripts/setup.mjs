import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseCli } from './cli.mjs';
import { repository, resolvePython, runPython, venvPython, pythonEnvironment, installHints } from './environment.mjs';

const require = createRequire(import.meta.url);
async function run(file, args, root, env) {
  const child = spawn(file, args, { cwd: root, stdio: 'inherit', env: pythonEnvironment(env), windowsHide: true });
  await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(new Error(`安装步骤失败，退出码 ${code}`))); });
}
export async function setupEnvironment({ root = repository, env = process.env, skipBrowser = false, withDeps = false } = {}) {
  if (withDeps && skipBrowser) throw new Error('--with-deps 与 --skip-browser 不能同时使用');
  if (withDeps && process.platform !== 'linux') throw new Error('--with-deps 仅用于 Linux；其他系统直接运行 npm run setup');
  const requirements = await readFile(path.join(root, 'requirements.txt'), 'utf8');
  const pillow = /^Pillow==([^\s]+)/m.exec(requirements)?.[1];
  if (!pillow) throw new Error('requirements.txt 缺少锁定版本的 Pillow');
  const local = venvPython(root);
  if (!env.PYTHON && !existsSync(path.join(root, '.venv'))) {
    const python = resolvePython({ root, env, preferVenv: false });
    console.log(`创建独立 Python 环境（${python.version}）…`);
    await run(python.file, [...python.args, '-m', 'venv', path.join(root, '.venv')], root, env);
  }
  if (!env.PYTHON && !existsSync(local)) throw new Error('已有 .venv 缺少解释器；请先重命名该目录再重试，不会自动删除');
  const python = resolvePython({ root, env });
  const check = runPython(['-c', `import PIL; assert PIL.__version__ == ${JSON.stringify(pillow)}`], { python, env });
  if (check.status !== 0) await run(python.file, [...python.args, '-m', 'pip', 'install', '-r', path.join(root, 'requirements.txt')], root, env);
  else console.log(`Pillow ${pillow} 已就绪`);
  if (!skipBrowser) {
    const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
    await run(process.execPath, [cli, 'install', '--no-shell', ...(withDeps ? ['--with-deps'] : []), 'chromium'], root, env);
  }
  const report = { at: new Date().toISOString(), platform: process.platform, arch: process.arch, python: python.file, browserInstalled: !skipBrowser };
  await mkdir(path.join(root, '.local'), { recursive: true });
  await writeFile(path.join(root, '.local/setup.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`环境准备完成。${installHints(process.platform)}。\n运行 npm run doctor -- --render --probe 检查实际渲染能力。`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values } = parseCli({ 'skip-browser': { type: 'boolean' }, 'with-deps': { type: 'boolean' } }, { maxPositionals: 0 });
    if (values.help) console.log('用法：npm run setup -- [--skip-browser] [--with-deps]\n默认创建/复用仓库 .venv；显式 PYTHON 指定时安装到该环境。安装锁定的 Pillow 和匹配 Chromium。Linux 的 --with-deps 会安装浏览器系统依赖。不会自动安装系统 Python 或 FFmpeg。');
    else await setupEnvironment({ skipBrowser: values['skip-browser'], withDeps: values['with-deps'] });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
