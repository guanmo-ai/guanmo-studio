// 生成可直接托管的模板与案例展示页（GitHub Pages）。
import path from 'node:path';
import { cp, mkdir, mkdtemp, rm, writeFile, rename } from 'node:fs/promises';
import { repository } from './build.mjs';
import { parseCli } from './cli.mjs';

const copied = ['web', 'assets', 'templates', 'examples'];
const localPages = new Set(['web/card-studio', 'web/palettes']);
const include = source => {
  const relative = path.relative(repository, source).split(path.sep).join('/');
  return !localPages.has(relative) && !/(^|\/)(__pycache__|reviews)(\/|$)/.test(relative) && !source.endsWith('.pyc');
};

export async function buildSite(output = path.join(repository, 'build/site')) {
  const out = path.resolve(output);
  await mkdir(path.dirname(out), { recursive: true });
  const staging = await mkdtemp(path.join(path.dirname(out), 'site-'));
  try {
    for (const name of copied) await cp(path.join(repository, name), path.join(staging, name), { recursive: true, filter: include });
    await writeFile(path.join(staging, '.nojekyll'), '');
    await writeFile(path.join(staging, 'index.html'), `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>Guanmo Studio</title>
<meta http-equiv="refresh" content="0; url=./web/">
<link rel="canonical" href="./web/">
</head>
<body><p><a href="./web/">打开 Guanmo Studio</a></p></body>
</html>
`);
    await rm(out, { recursive: true, force: true });
    await rename(staging, out);
    return out;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('site.mjs')) {
  try {
    const { values } = parseCli({ out: { type: 'string' } }, { maxPositionals: 0 });
    if (values.help) console.log('用法：npm run site -- [--out build/site]\n生成可托管到 GitHub Pages 的模板与案例展示页。');
    else console.log(`静态网站已生成：${await buildSite(values.out)}`);
  } catch (error) { console.error(`生成失败：${error.message}`); process.exitCode = 1; }
}
