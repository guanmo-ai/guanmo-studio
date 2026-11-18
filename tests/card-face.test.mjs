import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { faceCanvas } from '../templates/card-carousel/assets/engine/card-face.js';

const { palettes } = JSON.parse(await readFile(new URL('../templates/card-carousel/front-styles.json', import.meta.url), 'utf8'));

function renderedText(face, back = false) {
  const previous = globalThis.document;
  const text = [];
  const context = new Proxy({
    fillText(value) { text.push(String(value)); },
    measureText(value) { return { width: String(value).length * 20 }; },
    createLinearGradient() { return { addColorStop() {} }; },
  }, { get(target, key) { return target[key] ?? (() => {}); } });
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  try {
    faceCanvas({ no: '01', title: '整理资料', sub: 'Research', face: { colors: palettes[0], ...face } }, null, back);
    return text;
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

test('新项目所有卡面和卡背使用自己的品牌，不残留MCP字样', () => {
  for (const layout of ['editorial', 'poster', 'split', 'minimal']) {
    const text = renderedText({ layout, brand: 'Paper Nest', kicker: '研究工作台' });
    assert.ok(text.includes('Paper Nest'));
    assert.ok(text.includes('01 / PAPER NEST'));
    assert.ok(text.includes('研究工作台'));
    assert.ok(!text.some(value => /Agent MCP|AGENT MCP|国内官方接入索引/.test(value)));
  }
  for (const back of ['number', 'type', 'minimal']) {
    const text = renderedText({ brand: 'Paper Nest', back }, true);
    assert.ok(text.includes('PAPER NEST'));
    if (back === 'minimal') assert.ok(text.includes('Paper Nest'));
    assert.ok(!text.some(value => /Agent MCP|AGENT MCP/.test(value)));
  }
});

test('缺省卡面使用工具品牌，既有配置和显式空标识按原值呈现', () => {
  const fallback = renderedText({});
  assert.ok(fallback.includes('Guanmo Studio'));
  assert.ok(fallback.includes('01 / GUANMO STUDIO'));
  const legacy = renderedText({ brand: 'Agent MCP', kicker: '国内官方接入索引' });
  assert.ok(legacy.includes('国内官方接入索引'));
  assert.ok(legacy.includes('Agent MCP'));
  const blank = renderedText({ brand: '', kicker: '' });
  assert.ok(!blank.some(value => /Guanmo Studio|GUANMO STUDIO|Agent MCP|AGENT MCP|国内官方接入索引/.test(value)));
});
