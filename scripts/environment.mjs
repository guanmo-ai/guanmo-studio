import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const pythonEnvironment = env => ({ ...(env || process.env), PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' });
export const venvPython = (root = repository, platform = process.platform) => path.join(root, '.venv', platform === 'win32' ? 'Scripts/python.exe' : 'bin/python3');

export function resolvePython({ root = repository, platform = process.platform, env = process.env, preferVenv = true, exists = existsSync, run = spawnSync } = {}) {
  let candidates;
  if (env.PYTHON) candidates = [{ file: env.PYTHON, args: [] }];
  else if (preferVenv && exists(path.join(root, '.venv'))) candidates = [{ file: venvPython(root, platform), args: [] }];
  else candidates = (platform === 'win32' ? [['python', []], ['py', ['-3']], ['python3', []]] : [['python3', []], ['python', []]]).map(([file, args]) => ({ file, args }));
  const details = [];
  for (const candidate of candidates) {
    const result = run(candidate.file, [...candidate.args, '-c', 'import sys; assert sys.version_info >= (3, 10); print(sys.version.split()[0])'], { encoding: 'utf8', env: pythonEnvironment(env), timeout: 10000, windowsHide: true });
    if (result.status === 0) return { ...candidate, version: result.stdout.trim() };
    details.push(candidate.file);
  }
  throw new Error(`未找到可用的 Python 3.10+（已检查 ${details.join('、')}）。请安装 Python 后重试；已有 .venv 或 PYTHON 覆盖时请先检查该环境。`);
}

export function runPython(args, options = {}) {
  const { python = resolvePython(), env, ...rest } = options;
  return spawnSync(python.file, [...python.args, ...args], { encoding: 'utf8', windowsHide: true, ...rest, env: pythonEnvironment(env) });
}

export const installHints = platform => platform === 'win32'
  ? '安装 Python 3.10+；FFmpeg 可通过 winget install --id Gyan.FFmpeg --exact 安装，安装后重新打开终端'
  : platform === 'darwin'
    ? '安装 Python 3.10+；已有 Homebrew 时可运行 brew install python ffmpeg'
    : '安装 Python 3.10+、venv 和 FFmpeg；Debian/Ubuntu 可运行 sudo apt-get install python3-venv ffmpeg';
