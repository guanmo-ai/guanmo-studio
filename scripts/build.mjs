import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, cp, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { writeNotices } from './notices.mjs';
import { runPython } from './environment.mjs';
import { assertOutputDirectory, commitArtifacts } from './artifacts.mjs';
import { canonicalPath, containsPath } from './paths.mjs';
import { parseCli } from './cli.mjs';

export const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readConfig = async file => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));

// 保留真正可再次编辑的原配置和原素材，导出包不依赖本机绝对路径。
async function snapshotSource(config, out, targetDirectory) {
  const cfg = await readConfig(config);
  const root = path.dirname(config), source = path.join(out, 'source');
  await mkdir(path.join(source, 'assets'), { recursive: true });
  const destination = await canonicalPath(targetDirectory);
  const copySource = async (file, target) => {
    if (containsPath(destination, await canonicalPath(file))) throw new Error(`输出目录包含源素材，不能替换：${file}`);
    await copyFile(file, target);
  };
  const copyField = async (object, key, name) => {
    if (!object?.[key]) return;
    const file = path.resolve(root, object[key]);
    const target = `assets/${name}${path.extname(file).toLowerCase()}`;
    await copySource(file, path.join(source, target));
    object[key] = target;
  };
  await copyField(cfg.brand, 'logo', 'logo');
  for (const [i, card] of cfg.cards.entries()) await copyField(card, 'image', `card-${i}`);
  for (const [i, card] of cfg.cards.entries()) await copyField(card.face, 'icon', `icon-${i}`);
  for (const [i, tile] of (cfg.kit.tiles.items || []).entries()) await copyField(tile, 'image', `tile-${i}`);
  if (cfg.background?.preset) {
    const catalog = JSON.parse(await readFile(path.join(repository, 'assets/backgrounds/catalog.json'), 'utf8'));
    cfg.background.image = path.join(repository, catalog.backgrounds.find(b => b.id === cfg.background.preset).image);
    delete cfg.background.preset;
  }
  await copyField(cfg.background, 'image', 'background');
  for (const name of ['music', 'sfx']) {
    if (cfg.audio?.[name]?.enabled === false) continue;
    cfg.audio ||= {};
    cfg.audio[name] ||= {};
    cfg.audio[name].path ||= path.join(repository, 'templates/card-carousel/assets/audio', `${name}.wav`);
    await copyField(cfg.audio[name], 'path', name);
  }
  await writeFile(path.join(source, 'config.json'), JSON.stringify(cfg, null, 2) + '\n');
  if (existsSync(path.join(root, 'SOURCE.md'))) await copySource(path.join(root, 'SOURCE.md'), path.join(source, 'SOURCE.md'));
}

async function assembleFilm(input, output, targetDirectory) {
  const config = path.resolve(input.toLowerCase().endsWith('.json') ? input : path.join(repository, 'examples', input, 'config.json'));
  const name = path.basename(path.dirname(config));
  const out = path.resolve(output || path.join(repository, 'build', name));
  const builder = path.join(repository, 'templates/card-carousel/scripts/build_film.py');
  const result = runPython([builder, config, '--out', out, '--root', path.dirname(config), '--standalone'], { cwd: repository });
  if (result.status !== 0) throw new Error(result.error ? `无法运行 Python：${result.error.message}。请运行 npm run doctor` : result.stdout + result.stderr);
  console.log(result.stdout.trim());
  await mkdir(path.join(out, 'fonts'), { recursive: true });
  await cp(path.join(repository, 'assets/fonts'), path.join(out, 'fonts'), { recursive: true });
  const fonts = [
    ['Noto Sans SC', 'NotoSansSC.otf', 'normal', '100 900'],
    ['Instrument Serif', 'InstrumentSerif-Regular.otf', 'normal', '400'],
    ['Instrument Serif', 'InstrumentSerif-Italic.otf', 'italic', '400'],
    ['Geist', 'Geist.otf', 'normal', '100 900'],
    ['JetBrains Mono', 'JetBrainsMono.otf', 'normal', '100 800'],
  ];
  const faces = fonts.map(([family, file, style, weight]) => `@font-face{font-family:"${family}";src:url("./fonts/${file}");font-style:${style};font-weight:${weight};font-display:block}`).join('\n');
  await writeFile(path.join(out, 'fonts.css'), faces);
  const safeName = name.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  await writeFile(path.join(out, 'index.html'), `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guanmo Studio · ${safeName}</title>
<link rel="icon" href="data:,"><link rel="stylesheet" href="./fonts.css"><link rel="stylesheet" href="./styles.css"><style>html,body{margin:0;background:#15110f;overflow:hidden}button,input{font:inherit}button{cursor:pointer}</style></head>
<body><main id="stage" data-composition-id="motion"><canvas id="gl" width="1920" height="1080"></canvas><div id="hud"></div></main><script type="module" src="./app.js"></script></body></html>`);
  const host = path.join(repository, 'scripts/player.mjs');
  await build({
    stdin: { contents: `import { installHost, finishLoading } from ${JSON.stringify(host)}; installHost(); await import(${JSON.stringify(path.join(out, 'main.js'))}); await finishLoading();`, resolveDir: repository },
    bundle: true, format: 'esm', target: 'es2022', outfile: path.join(out, 'app.js'), logLevel: 'warning', nodePaths: [path.join(repository, 'node_modules')],
  });
  const cfg = await readConfig(config);
  const film = JSON.parse(await readFile(path.join(out, 'film.json'), 'utf8'));
  const timeline = JSON.parse(await readFile(path.join(repository, 'templates/card-carousel/timeline.json'), 'utf8'));
  await writeFile(path.join(out, 'studio.json'), JSON.stringify({ template: 'card-carousel', title: cfg.brand.wordmark, width: 1920, height: 1080, ...timeline, audio: film.audio }, null, 2) + '\n');
  await snapshotSource(config, out, targetDirectory);
  await writeNotices(out);
  console.log(`独立工程已构建：${out}`);
  return out;
}

export async function buildFilm(input = 'starter', output) {
  const config = path.resolve(input.toLowerCase().endsWith('.json') ? input : path.join(repository, 'examples', input, 'config.json'));
  const out = path.resolve(output || path.join(repository, 'build', path.basename(path.dirname(config))));
  await assertOutputDirectory(out, [repository, config], ['studio.json', 'film.json']);
  await mkdir(path.dirname(out), { recursive: true });
  const staging = await mkdtemp(path.join(path.dirname(out), 'studio-build-'));
  try {
    await assembleFilm(config, staging, out);
    const manifestName = path.basename(staging) + '.motion.json';
    const manifest = JSON.parse(await readFile(path.join(staging, manifestName), 'utf8'));
    const from = path.relative(repository, staging).split(path.sep).join('/');
    const to = path.relative(repository, out).split(path.sep).join('/');
    for (const group of ['filePaths', 'resourceFiles']) for (const key of Object.keys(manifest[group])) manifest[group][key] = manifest[group][key].replace(from + '/', to + '/');
    await rm(path.join(staging, manifestName));
    await writeFile(path.join(staging, path.basename(out) + '.motion.json'), JSON.stringify(manifest, null, 2) + '\n');
    await commitArtifacts([{ staged: staging, target: out }]);
    console.log(`可用工程：${out}`);
    return out;
  } finally { await rm(staging, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values, positionals } = parseCli({ out: { type: 'string' } });
    if (values.help) console.log('用法：npm run build -- [示例名或配置.json] [--out 构建目录]');
    else await buildFilm(positionals[0] || 'starter', values.out);
  }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
