import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repository } from './build.mjs';

const errors = [];
let scripts = 0, jsonFiles = 0, links = 0;
async function visit(dir) {
  for (const entry of await readdir(path.join(repository, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.name.startsWith('.') || ['node_modules', 'build', 'renders', '__pycache__', 'reviews'].includes(entry.name)) continue;
    if (entry.isDirectory()) { await visit(relative); continue; }
    const file = path.join(repository, relative);
    if (/\.(mjs|js)$/.test(file)) {
      scripts++;
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) errors.push(`${relative}: ${result.stderr}`);
    }
    if (file.endsWith('.json')) {
      jsonFiles++;
      try { JSON.parse(await readFile(file, 'utf8')); } catch (error) { errors.push(`${relative}: ${error.message}`); }
    }
    if (file.endsWith('.md')) {
      const source = (await readFile(file, 'utf8')).replace(/```[\s\S]*?```/g, '');
      for (const match of source.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
        const target = match[1].replace(/^<|>$/g, '').split('#')[0];
        if (!target || /^[a-z]+:|^\//i.test(target)) continue;
        links++;
        try { await access(path.resolve(path.dirname(file), decodeURIComponent(target))); }
        catch { errors.push(`${relative}: 链接不存在 ${target}`); }
      }
    }
  }
}
await visit('');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`检查通过：${scripts} 个 JS 文件、${jsonFiles} 个 JSON 文件、${links} 个本地文档链接`);
