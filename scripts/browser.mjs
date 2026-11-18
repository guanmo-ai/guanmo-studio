import { chromium } from 'playwright';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

export function browserExecutable({ env = process.env } = {}) {
  const executable = env.STUDIO_BROWSER_EXECUTABLE ? path.resolve(env.STUDIO_BROWSER_EXECUTABLE) : chromium.executablePath();
  if (!existsSync(executable) || !statSync(executable).isFile()) throw new Error('未找到独立 Chromium；请运行 npm run setup，或通过 STUDIO_BROWSER_EXECUTABLE 指定自动化浏览器的完整路径');
  return executable;
}

export function browserLaunchOptions({ env = process.env, platform = process.platform } = {}) {
  const mode = env.STUDIO_GL || 'auto';
  if (!['auto', 'software', 'metal'].includes(mode) || (mode === 'metal' && platform !== 'darwin')) throw new Error('STUDIO_GL 仅支持 auto、software；metal 仅适用于 macOS');
  return {
    headless: true,
    executablePath: browserExecutable({ env }),
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
      ...(mode === 'software' ? ['--use-angle=swiftshader'] : platform === 'darwin' ? ['--use-angle=metal'] : [])],
  };
}
