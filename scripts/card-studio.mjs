import { readSavedSelection } from './saved-selection.mjs';
import { CARD_STUDIO_PROJECT } from './selection.mjs';
import path from 'node:path';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { buildFilm, repository } from './build.mjs';
import { distributeCards } from '../templates/card-carousel/assets/engine/card-distribution.js';

export async function prepareCardStudio({ selectionFile = path.join(repository, '.local/card-style-selection.json'), output = path.join(repository, 'build/card-style-preview'), requireSelection = false } = {}) {
  const folder = path.join(repository, 'examples', CARD_STUDIO_PROJECT);
  const cfg = JSON.parse(await readFile(path.join(folder, 'config.json'), 'utf8'));
  const catalog = JSON.parse(await readFile(path.join(repository, 'templates/card-carousel/front-styles.json'), 'utf8'));
  let selection = {
    project: CARD_STUDIO_PROJECT, palette: 'porcelain', palettes: ['porcelain'], seed: 0,
    layout: 'poster', back: 'number', material: 'auto', light: 28, time: 2.75,
  };
  try {
    const saved = await readSavedSelection(selectionFile, catalog);
    if (saved) selection = saved;
    else if (requireSelection) throw new Error('尚未保存样式，请先在卡片工作台点击保存');
  } catch (error) {
    if (requireSelection || error.code !== 'INVALID_SELECTION') throw error;
    console.warn(`${error.message} 本次使用默认样式预览。`);
  }
  const { assignments } = distributeCards(cfg.cards.map(card => card.id), selection.palettes, selection.seed);
  for (const card of cfg.cards) {
    const palette = catalog.palettes.find(option => option.id === assignments[card.id]);
    delete card.image;
    delete card.front;
    card.face = {
      ...card.face,
      palette: palette.id,
      layout: selection.layout,
      back: selection.back,
      material: selection.material === 'auto' ? (palette.material || 'matte') : selection.material,
      light: selection.light,
    };
    if (card.face.icon) card.face.icon = path.resolve(folder, card.face.icon);
  }
  if (cfg.brand.logo) cfg.brand.logo = path.resolve(folder, cfg.brand.logo);
  for (const item of cfg.kit?.tiles?.items || []) {
    if (item.image) item.image = path.resolve(folder, item.image);
  }
  if (cfg.background?.image) cfg.background.image = path.resolve(folder, cfg.background.image);
  for (const name of ['music', 'sfx']) {
    if (cfg.audio?.[name]?.path) cfg.audio[name].path = path.resolve(folder, cfg.audio[name].path);
  }
  cfg.brand.font = 'sans';
  cfg.background = { ...cfg.background, titleScrimHeight: 280 };
  const brandPalette = catalog.palettes.find(palette => palette.id === selection.palettes[0]);
  Object.assign(cfg.brand, { paper: brandPalette.light, ink: brandPalette.ink, back: brandPalette.papers[0] });
  cfg.styleSelection = selection;
  await mkdir(path.join(repository, '.local'), { recursive: true });
  const temp = await mkdtemp(path.join(repository, '.local/card-studio-'));
  try {
    await writeFile(path.join(temp, 'SOURCE.md'), await readFile(path.join(folder, 'SOURCE.md')));
    await writeFile(path.join(temp, 'config.json'), JSON.stringify(cfg, null, 2) + '\n');
    return await buildFilm(path.join(temp, 'config.json'), output);
  } finally { await rm(temp, { recursive: true, force: true }); }
}

export { validateSelection } from './selection.mjs';
