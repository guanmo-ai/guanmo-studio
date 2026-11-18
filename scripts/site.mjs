// 生成可直接托管的静态网站（GitHub Pages）：背景画廊、模板详情、色卡库与卡片工作台的只读预览。
import path from 'node:path';
import { cp, mkdir, mkdtemp, rm, writeFile, rename } from 'node:fs/promises';
import { repository } from './build.mjs';
import { prepareCardStudio } from './card-studio.mjs';
import { parseCli } from './cli.mjs';

const copied = ['web', 'assets', 'templates', 'examples'];
const skip = source => !/(^|[\\/])(__pycache__|reviews)([\\/]|$)/.test(path.relative(repository, source)) && !source.endsWith('.pyc');

export async function buildSite(output = path.join(repository, 'build/site')) {
  const out = path.resolve(output);
  await mkdir(path.dirname(out), { recursive: true });
  const staging = await mkdtemp(path.join(path.dirname(out), 'site-'));
  try {
    for (const name of copied) await cp(path.join(repository, name), path.join(staging, name), { recursive: true, filter: skip });
    // 卡片工作台在浏览器中复用的样式校验（无其他依赖）。
    await mkdir(path.join(staging, 'scripts'));
    await cp(path.join(repository, 'scripts/selection.mjs'), path.join(staging, 'scripts/selection.mjs'));
    // 在线版始终使用默认样式，不读取本机保存的选择。
    await prepareCardStudio({ selectionFile: path.join(staging, '.no-selection.json'), output: path.join(staging, 'build/card-style-preview') });
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
    if (values.help) console.log('用法：npm run site -- [--out build/site]\n生成可托管到 GitHub Pages 的静态网站，卡片工作台为只读预览。');
    else console.log(`静态网站已生成：${await buildSite(values.out)}`);
  } catch (error) { console.error(`生成失败：${error.message}`); process.exitCode = 1; }
}
