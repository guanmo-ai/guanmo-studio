import path from 'node:path';
import { buildFilm } from './build.mjs';
import { renderFilm } from './render.mjs';
import { prepareCardStudio } from './card-studio.mjs';
import { CARD_STUDIO_PROJECT } from './selection.mjs';
import { withCancellation } from './cancellation.mjs';
import { parseCli } from './cli.mjs';

try {
  const { values, positionals } = parseCli({ out: { type: 'string' }, final: { type: 'boolean' }, draft: { type: 'boolean' }, 'edit-pack': { type: 'boolean' }, 'saved-style': { type: 'boolean' } });
  if (values.help) {
    console.log('用法：npm run update -- [项目名或配置.json] [--draft | --final] [--out 成片.mp4] [--edit-pack] [--saved-style]\n默认生成 starter 的快速关键帧。剪辑包需要 --final。');
  } else {
    if (values.final && values.draft) throw new Error('--final 与 --draft 只选一个');
    if (values['edit-pack'] && !values.final) throw new Error('--edit-pack 需要同时使用 --final');
    if (values.out && !values.out.toLowerCase().endsWith('.mp4')) throw new Error('--out 要以 .mp4 结尾');
    const input = positionals[0] || 'starter';
    if (values['saved-style'] && input !== CARD_STUDIO_PROJECT) throw new Error(`--saved-style 当前仅适用于 ${CARD_STUDIO_PROJECT}`);
    const root = values['saved-style']
      ? await prepareCardStudio({ requireSelection: true, output: path.resolve('build', `${CARD_STUDIO_PROJECT}-selected`) })
      : await buildFilm(input);
    await withCancellation(signal => renderFilm(root, { signal,
      draft: !values.final,
      proofOnly: !values.final && !values.draft,
      output: values.out || path.join('renders', `${path.basename(root)}${values.final ? '' : values.draft ? '.draft' : '.proof'}.mp4`),
      editPack: values['edit-pack'],
    }));
  }
} catch (error) { console.error(error.message); process.exitCode ||= 1; }
