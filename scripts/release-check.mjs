import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const localDirectories = new Set(['.git', '.local', '.venv', 'node_modules', 'build', 'renders']);
const mediaExtension = /\.(?:avif|png|jpe?g|webp|svg|gif|ico|wav|mp3|m4a|aac|ogg|flac|mp4|m4v|mov|mkv|webm|otf|ttf|woff2?)$/i;
const entries = new Map();
const checksums = new Map();
const errors = [];

async function walk(directory = '') {
  for (const entry of await readdir(path.join(repository, directory), { withFileTypes: true })) {
    if ((!directory && localDirectories.has(entry.name)) || entry.name === '__pycache__') continue;
    const name = path.posix.join(directory, entry.name);
    entries.set(name, entry);
    if (entry.isDirectory()) await walk(name);
    else if (!entry.isFile()) errors.push(`发布目录只允许普通文件和目录：${name}`);
  }
}

function relativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':')) return false;
  return value.split('/').every(part => part && part !== '.' && part !== '..');
}

function requireFile(value, label, extension) {
  if (!relativePath(value) || !entries.get(value)?.isFile() || (extension && !extension.test(value))) {
    errors.push(`${label}必须指向发布目录内的有效文件：${value}`);
    return false;
  }
  return true;
}

async function readJSON(file) {
  if (!requireFile(file, '清单')) return {};
  try { return JSON.parse(await readFile(path.join(repository, file), 'utf8')) ?? {}; }
  catch (error) {
    errors.push(`${file} 无法读取：${error.message}`);
    return {};
  }
}

async function checksum(file) {
  if (checksums.has(file)) return checksums.get(file);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path.join(repository, file))) hash.update(chunk);
  const digest = hash.digest('hex');
  checksums.set(file, digest);
  return digest;
}

async function verifyHash(file, expected) {
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || await checksum(file) !== expected) {
    errors.push(`SHA256 与清单不符：${file}`);
  }
}

function verifyLicenses(manifest, media) {
  if (!Array.isArray(manifest.groups) || !manifest.groups.length) {
    errors.push('素材许可清单缺少许可分组');
    return;
  }
  const coverage = new Map(media.map(file => [file, 0]));
  for (const group of manifest.groups) {
    const evidence = typeof group?.evidence === 'string' ? group.evidence.replace(/\/$/, '') : '';
    const evidenceEntry = relativePath(evidence) ? entries.get(evidence) : undefined;
    if (!evidenceEntry?.isFile() && !evidenceEntry?.isDirectory()) errors.push(`许可证据不存在：${group?.id}`);
    if (group?.status !== 'documented' || typeof group.license !== 'string' || !group.license.trim() || group.license === 'NOASSERTION') {
      errors.push(`${group?.id}：${group?.note || '许可待核实'}`);
    }
    if (!Array.isArray(group?.paths) || !group.paths.length) {
      errors.push(`许可分组缺少素材路径：${group?.id}`);
      continue;
    }
    for (const rule of group.paths) {
      const directory = typeof rule === 'string' && rule.endsWith('/');
      const name = directory ? rule.slice(0, -1) : rule;
      const matches = relativePath(name) ? media.filter(file => directory ? file.startsWith(rule) : file === rule) : [];
      if (!matches.length) errors.push(`许可清单中的路径没有对应媒体：${rule}`);
      for (const file of matches) coverage.set(file, coverage.get(file) + 1);
    }
  }
  for (const [file, count] of coverage) {
    if (count !== 1) errors.push(`素材需要唯一许可记录：${file}`);
  }
}

async function verifyExamples(manifest, catalog) {
  const byFile = new Map();
  if (!Array.isArray(manifest.approvedExamples) || !manifest.approvedExamples.length) errors.push('案例清单缺少可分发成片');
  for (const example of Array.isArray(manifest.approvedExamples) ? manifest.approvedExamples : []) {
    if (!requireFile(example?.file, '案例成片', /\.mp4$/i)) continue;
    if (byFile.has(example.file)) errors.push(`案例成片重复登记：${example.file}`);
    byFile.set(example.file, example);
    if (requireFile(example.poster, '案例封面', /\.(?:jpe?g|png|webp)$/i) && (await stat(path.join(repository, example.poster))).size === 0) {
      errors.push(`案例封面为空：${example.poster}`);
    }
    requireFile(example.config, '案例配置', /\.json$/i);
    const info = await stat(path.join(repository, example.file));
    if (info.size <= 0 || info.size !== example.bytes) errors.push(`成片字节数与清单不符：${example.file}`);
    await verifyHash(example.file, example.sha256);
  }
  if (!Array.isArray(catalog.templates) || !catalog.templates.length) errors.push('模板目录缺少可播放模板');
  const displayed = new Set();
  for (const template of Array.isArray(catalog.templates) ? catalog.templates : []) {
    requireFile(template?.poster, '模板封面', /\.(?:jpe?g|png|webp)$/i);
    requireFile(template?.prompt, '模板提示词', /\.md$/i);
    if (!Array.isArray(template?.examples) || !template.examples.length) {
      errors.push(`模板缺少可播放案例：${template?.id}`);
      continue;
    }
    for (const example of template.examples) {
      const entry = byFile.get(example?.video);
      if (!entry || entry.poster !== example.poster) errors.push(`模板案例的视频与封面需对应案例清单：${example?.video}`);
      else displayed.add(example.video);
    }
  }
  for (const file of byFile.keys()) {
    if (!displayed.has(file)) errors.push(`成片未列入模板目录：${file}`);
  }
}

await walk();
const media = [...entries].filter(([file, entry]) => entry.isFile() && mediaExtension.test(file)).map(([file]) => file);
const manifest = await readJSON('docs/asset-licenses.json');
verifyLicenses(manifest, media);
const digests = manifest.sha256 && typeof manifest.sha256 === 'object' && !Array.isArray(manifest.sha256) ? manifest.sha256 : {};
for (const name of ['music.wav', 'sfx.wav', 'sfx-synth.wav']) {
  const file = `templates/card-carousel/assets/audio/${name}`;
  if (!Object.hasOwn(digests, file)) errors.push(`内置音轨缺少 SHA256 记录：${file}`);
}
for (const [file, expected] of Object.entries(digests)) {
  if (requireFile(file, 'SHA256 记录')) await verifyHash(file, expected);
}
await verifyExamples(await readJSON('docs/example-videos.json'), await readJSON('templates/catalog.json'));
if (requireFile('LICENSE', '仓库许可') && !/MIT License/.test(await readFile(path.join(repository, 'LICENSE'), 'utf8'))) errors.push('缺少 MIT 许可正文');
if (errors.length) {
  console.error(`发布检查未通过（已核对 ${media.length} 个媒体文件）：\n${errors.map(error => '· ' + error).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`发布资料检查通过：${media.length} 个媒体文件均有记录，已登记文件及案例成片的指纹一致。授权依据由维护者核实。`);
}
