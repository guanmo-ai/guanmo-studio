import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { repository } from './environment.mjs';

const input = process.argv.slice(2);
const reuseImage = input[0] === '--no-build';
if (reuseImage) input.shift();
const [command, ...parameters] = input;
const allowed = ['doctor', 'build', 'update', 'render', 'test', 'test:smoke', 'check', 'release:check'];
if (!command || ['--help','-h'].includes(command)) console.log('用法：npm run container -- [--no-build] <doctor|build|update|render|test|test:smoke|check|release:check> [参数]\n例如 npm run container -- update starter --draft。需要Docker与Compose v2；默认构建本地镜像。--no-build 复用已有镜像，不拉取或重建，升级工具后需去掉此选项重新构建。仅挂载examples（只读）和renders。');
else if (!allowed.includes(command)) { console.error('不支持的容器命令，请使用 --help 查看用法'); process.exitCode = 1; }
else {
  try {
    if (reuseImage) {
      const check = spawnSync('docker', ['image', 'inspect', 'guanmo-studio:local'], { encoding: 'utf8', timeout: 15000, windowsHide: true });
      if (check.status !== 0) throw new Error(`无法复用本地镜像，请确认 Docker 正在运行，并先去掉 --no-build 构建一次。${check.error?.message || check.stderr?.trim() || ''}`);
    }
    await mkdir(path.join(repository, 'renders'), { recursive: true });
    const env = { ...process.env, STUDIO_UID: process.env.STUDIO_UID || String(process.getuid?.() ?? 1000), STUDIO_GID: process.env.STUDIO_GID || String(process.getgid?.() ?? 1000) };
    const args = ['compose', '--file', path.join(repository,'compose.yaml'), 'run', ...(reuseImage ? ['--pull', 'never'] : ['--build']), '--rm', 'studio', 'npm', 'run', command, '--', ...(parameters[0] === '--' ? parameters.slice(1) : parameters)];
    const child = spawn('docker', args, { cwd: repository, stdio: 'inherit', env, windowsHide: true });
    child.once('error', error => { console.error(`无法运行Docker：${error.message}`); process.exitCode = 1; });
    child.once('close', code => { process.exitCode = code ?? 1; });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
