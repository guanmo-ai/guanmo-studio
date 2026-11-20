const fs = require('fs'), path = require('path');
const W = process.argv[2]; const tiles = fs.readdirSync(path.join(W, 'assets/tiles'));
const list = p => tiles.filter(f => f.startsWith(p + '-')).sort().map(f => 'assets/tiles/' + f);
const B = .5;
const cfg = {
  bpm: 120,
  theme: { stage: '#0f0c0b', board: '#171210' },
  light: { key: 360 },
  wall: { tile: [0.8, 1.0], gap: 0.09, radius: 0.035, rows: 13, cols: 26 },
  stages: { mix: { tiles: [...list('poster'), ...list('cheat'), ...list('app'), ...list('film0'), ...list('film1')] }, film0: { tiles: list('film0') }, poster: { tiles: list('poster') }, cheat: { tiles: list('cheat') }, app: { tiles: list('app') }, film1: { tiles: list('film1') } },
  initialStage: 'film0',
  backFace: 'assets/tiles/back.jpg',
  waves: [
    { at: -0.3, stage: 'film1', origin: [-12, 0], speed: 9 },
    { at: 2.0, stage: 'poster', origin: [-5.4, 0], speed: 20, label: '风格海报', sub: '每期一张，一眼认出这种风格' },
    { at: 3.0, stage: 'cheat', origin: [-5.4, 0], speed: 20, label: '速查卡', sub: '颜色、字体、规则，数值都写上' },
    { at: 4.0, stage: 'app', origin: [-5.4, 0], speed: 20, label: '落到界面', sub: '这种风格做成 App 的样子' },
    { at: 5.0, stage: 'film0', origin: [-5.4, 0], speed: 20, label: '动效短片', sub: '每期 15—20 秒，代码全部开源' },
    { at: 9.72, stage: 'mix', origin: [0.45, 0], speed: 7, radial: true },
    { at: 13.0, stage: 'back', origin: [0, 0], speed: 14, radial: true },
  ],
  hero: { slot: [13, 6], stage: 'film0', face: 'assets/tiles/hero-face.jpg', frames: { dir: 'assets/hero', count: 222, fps: 60 }, out: [6.0, 7.0], back: [8.75, 9.75], labelAt: 6.6, kicker: '025 · PLUSH', title: '毛绒', sub: '' },
  hook: { kicker: 'DESIGN.STYLE', lines: ['25 种设计风格', '一面墙看完'], lineAt: [0, 0.5], sub: '每天拆解一种，全部开源', subAt: 1.0 },
  payoff: { title: '每一期都能带走', chips: ['15 秒短片', '4 张风格图', '规则指南', '设计令牌', 'AI 提示词', '全部源码'] },
  end: { wordmark: 'Design.style', sub: '设计参考库 · 给人看，也给 AI 用', url: 'github.com/guanmo-ai/design-style', credit: '观默 @guanmo_ai', seal: '观默' },
  timeline: { hookOut: 1.8, heroOut: 6.0, payoff: 10.5, endIn: 13.0, stamp: 14.0, end: 15.0 },
  camera: [
    { t: 0.0, pos: [-10.4, -1.5, 2.1], look: [-5.6, -0.8, 0], fov: 36, focus: 3.4, blur: .85 },
    { t: 1.0, pos: [-6.2, -0.7, 2.7], look: [-1.4, -0.35, 0], fov: 35, focus: 4.0, blur: .7 },
    { t: 2.0, pos: [-1.2, 0.15, 6.3], look: [0.25, 0, 0], fov: 36, focus: 6.4, blur: .15 },
    { t: 4.0, pos: [0.3, -0.1, 6.7], look: [0.4, -0.05, 0], fov: 36, focus: 6.7, blur: .12 },
    { t: 6.0, pos: [0.9, 0.0, 6.4], look: [0.45, 0, 0], fov: 36, focus: 6.4, blur: .12 },
    { t: 8.75, pos: [0.7, 0.0, 6.0], look: [0.45, 0, 0], fov: 36, focus: 6.0, blur: .1 },
    { t: 9.35, pos: [0.55, 0.05, 8.6], look: [0.4, 0, 0], fov: 35.5, focus: 8.6, blur: 0 },
    { t: 9.95, pos: [0.35, 0.12, 12.6], look: [0.3, 0, 0], fov: 35, focus: 12.6, blur: 0 },
    { t: 10.6, pos: [0.15, 0.22, 18.4], look: [0.1, 0, 0], fov: 34.5, focus: 18.4, blur: 0 },
    { t: 11.4, pos: [0.0, 0.3, 24.5], look: [0, 0, 0], fov: 34, focus: 24.5, blur: .1 },
    { t: 13.0, pos: [-1.0, 0.2, 22.5], look: [0, 0, 0], fov: 34, focus: 9, blur: .6 },
    { t: 15.0, pos: [-1.6, 0.1, 21.5], look: [0, 0, 0], fov: 34, focus: 9, blur: .7 },
  ],
};
cfg.stages.film1.tiles = cfg.stages.film1.tiles; // 主角那一格在引擎里换成 hero.face
fs.writeFileSync(path.join(W, 'config.json'), JSON.stringify(cfg, null, 2));
console.log(Object.fromEntries(Object.entries(cfg.stages).map(([k, v]) => [k, v.tiles.length])));
