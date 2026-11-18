import path from 'node:path';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const copies = new Map([
  ['LICENSE', 'TEMPLATE-LICENSE.txt'],
  ['docs/SOURCES.md', 'TEMPLATE-SOURCES.md'],
  ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
  ['docs/asset-licenses.json', 'asset-licenses.json'],
  ['templates/card-carousel/assets/audio/MUSIC.md', 'MUSIC.md'],
]);

export async function writeNotices(directory) {
  for (const [source, target] of copies) {
    let contents = await readFile(path.join(repository, source), 'utf8');
    if (source.endsWith('.md')) contents = contents.replace(/\]\(([^\s)]+)\)/g, (match, href) => {
      if (/^[a-z]+:|^#/i.test(href)) return match;
      const [file, anchor] = href.split('#');
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(source), file));
      const resolved = copies.get(relative) || `https://github.com/guanmo-ai/guanmo-studio/blob/main/${relative.split('/').map(encodeURIComponent).join('/')}`;
      return `](${resolved}${anchor ? '#' + anchor : ''})`;
    });
    await writeFile(path.join(directory, target), contents);
  }
  await mkdir(path.join(directory, 'licenses'), { recursive: true });
  await cp(path.join(repository, 'assets/fonts/licenses'), path.join(directory, 'licenses/fonts'), { recursive: true });
  await cp(path.join(repository, 'templates/card-carousel/assets/audio/SFX-LICENSES.txt'), path.join(directory, 'SFX-LICENSES.txt'));
}
