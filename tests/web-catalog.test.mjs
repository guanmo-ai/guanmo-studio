import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { activeThemes, filterThemes, initialThemeId } from '../web/catalog.js';

const backgrounds = [
  { id: 'amber', name: '琥珀舞台', en: 'Amber stage', category: 'stage', family: 'warm' },
  { id: 'copper', name: '铜色舞台', en: 'Copper stage', category: 'stage', family: 'warm' },
  { id: 'indigo', name: '靛蓝暮光', en: 'Indigo dusk', category: 'sky', status: 'pending' },
  { id: 'archived', status: 'superseded', replacedBy: 'copper' },
  { id: 'removed', status: 'removed' }
];
const themes = activeThemes(backgrounds);

test('背景库排除归档与已删除背景，保留待定状态', () => {
  assert.deepEqual(themes.map(theme => theme.id), ['amber', 'copper', 'indigo']);
  assert.equal(themes[2].status, 'pending');
});

test('分类和关键词组合筛选，支持中文、英文、多词和空结果', () => {
  assert.equal(filterThemes(themes, 'warm').length, 2);
  assert.equal(filterThemes(themes, 'sky').length, 1);
  assert.deepEqual(filterThemes(themes, 'stage', '铜色').map(theme => theme.id), ['copper']);
  assert.deepEqual(filterThemes(themes, 'sky', 'INDIGO   暮光').map(theme => theme.id), ['indigo']);
  assert.equal(filterThemes(themes, 'warm', '暮光').length, 0);
  assert.equal(filterThemes(themes, 'all', '   ').length, themes.length);
});

test('旧背景地址转向替代图，已删除或无效地址安全回退', () => {
  assert.equal(initialThemeId(backgrounds, 'archived'), 'copper');
  assert.equal(initialThemeId(backgrounds, 'indigo'), 'indigo');
  assert.equal(initialThemeId(backgrounds, 'removed'), themes[0].id);
  assert.equal(initialThemeId(backgrounds, 'missing'), themes[0].id);
  assert.equal(initialThemeId([], 'missing'), undefined);
});

test('发布目录可下载背景原图并显示预览', async () => {
  const root = new URL('../', import.meta.url);
  const catalog = JSON.parse(await readFile(new URL('assets/backgrounds/catalog.json', root), 'utf8'));
  const published = activeThemes(catalog.backgrounds);
  assert.ok(published.some(theme => theme.id === 'studio-amber'));
  for (const theme of published) {
    for (const file of [theme.image, `assets/backgrounds/previews/${theme.id}.webp`]) {
      const info = await stat(new URL(file, root));
      assert.ok(info.isFile() && info.size > 0, file);
    }
  }
});
