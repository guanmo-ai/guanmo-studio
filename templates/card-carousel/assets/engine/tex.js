// 画布贴图与几何：牌面、牌背、字标牌、说明文字、标签、打字面板。颜色取自 film.json 的 theme。
import { film } from './data.js';
import { faceCanvas } from './card-face.js';

const SANS = '"Noto Sans SC","Geist",sans-serif';
const LATIN = '"Geist","Noto Sans SC",sans-serif';
const SERIF = '"Instrument Serif","Noto Sans SC",serif';
const MONO = '"JetBrains Mono","Noto Sans SC",monospace';
export const FONT = { SANS, LATIN, SERIF, MONO };
const TH = film.theme;
export const INK = TH.ink, PAPER = TH.paper, ACCENT = TH.accent, HL = TH.highlight;

function roundedShape(THREE, w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function roundedBody(THREE, w, h, r) {
  const g = new THREE.ExtrudeGeometry(roundedShape(THREE, w - 2.4, h - 2.4, r), { depth: 3.6, bevelEnabled: true, bevelSize: 1.2, bevelThickness: 1.2, bevelSegments: 3, curveSegments: 10, steps: 1 });
  g.translate(0, 0, -4.8);
  return g;
}
export function roundedGeo(THREE, w, h, r) {
  const g = new THREE.ShapeGeometry(roundedShape(THREE, w, h, r), 10);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  return g;
}
export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
const lum = (h) => (parseInt(h.slice(1, 3), 16) * 0.299 + parseInt(h.slice(3, 5), 16) * 0.587 + parseInt(h.slice(5, 7), 16) * 0.114) / 255;
const inkOn = (bg) => (lum(bg) < 0.55 ? 'rgba(255,253,248,' : 'rgba(20,17,15,');
const alpha = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
// 把字号缩到一行放得下
function fitFont(g, text, weight, size, family, maxW) {
  g.font = `${weight} ${size}px ${family}`;
  const w = g.measureText(text).width;
  if (w > maxW) { size = Math.floor((size * maxW) / w); g.font = `${weight} ${size}px ${family}`; }
  return size;
}
const ascii = (s) => /^[\x20-\x7e]*$/.test(s);

// 连续的深浅和柔光，不添加噪点；真正随角度变化的反射交给三维材质。
export function satinFill(g, w, h, color) {
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  const light = g.createLinearGradient(0, 0, w, h);
  light.addColorStop(0, 'rgba(255,255,255,0.16)'); light.addColorStop(0.35, 'rgba(255,255,255,0.025)');
  light.addColorStop(0.65, 'rgba(0,0,0,0.09)'); light.addColorStop(1, 'rgba(0,0,0,0.34)');
  g.fillStyle = light; g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w * 0.25, 0, 0, w * 0.25, 0, w * 0.85);
  glow.addColorStop(0, 'rgba(235,241,255,0.12)'); glow.addColorStop(1, 'rgba(235,241,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(238,243,255,0.25)'; g.lineWidth = 1.5;
  g.beginPath(); g.roundRect(7, 7, w - 14, h - 14, 24); g.stroke();
}

// 牌背：这张牌的代表色 + 编号 + 名字
export function backCanvas(card) {
  if (card.face) return faceCanvas(card, null, true);
  const [c, g] = canvas(960, 540);
  if (TH.surface) {
    const style = card.backStyle;
    if (style) {
      const wash = g.createLinearGradient(0, 0, 960, 680);
      wash.addColorStop(0, style.light); wash.addColorStop(0.28, style.base);
      wash.addColorStop(0.7, style.base); wash.addColorStop(1, style.shade);
      g.fillStyle = wash; g.fillRect(0, 0, 960, 540);
      const sheen = g.createLinearGradient(0, 0, 960, 540);
      sheen.addColorStop(0, alpha(style.ink, 0.12)); sheen.addColorStop(0.42, alpha(style.ink, 0));
      sheen.addColorStop(0.8, alpha(style.edge, 0.04)); sheen.addColorStop(1, alpha(style.edge, 0.16));
      g.fillStyle = sheen; g.fillRect(0, 0, 960, 540);
      g.strokeStyle = alpha(style.edge, 0.55); g.lineWidth = 1.8;
      g.beginPath(); g.roundRect(10, 10, 940, 520, 25); g.stroke();
      g.fillStyle = style.accent; g.beginPath(); g.arc(880, 466, 6, 0, Math.PI * 2); g.fill();
    } else if (!TH.surface.glass) satinFill(g, 960, 540, card.back || card.color);
    const ink = style?.ink || '#f6f7f9';
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillStyle = alpha(ink, 0.7); fitFont(g, card.no, 300, 210, LATIN, 840); g.fillText(card.no, 58, 318);
    g.fillStyle = alpha(ink, 0.97); fitFont(g, card.title, 600, 51, SANS, 840); g.fillText(card.title, 62, 418);
    if (card.sub) { g.fillStyle = alpha(ink, 0.7); fitFont(g, card.sub, 400, 30, LATIN, 795); g.fillText(card.sub, 64, 474); }
    g.fillStyle = alpha(style?.accent || ink, 0.35); g.fillRect(64, 360, 830, 1);
    if (card.tag) { g.fillStyle = alpha(ink, 0.65); g.textAlign = 'right'; g.font = `400 26px ${MONO}`; g.fillText(card.tag, 894, 82); }
    return c;
  }
  const back = card.back || card.color;
  g.fillStyle = back; g.fillRect(0, 0, 960, 540);
  const ink = inkOn(back);
  g.fillStyle = ink + '0.92)';
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  fitFont(g, card.no, 800, 250, LATIN, 840);
  g.fillText(card.no, 54, 330);
  fitFont(g, card.title, 700, 54, SANS, 840); g.fillText(card.title, 60, 420);
  if (card.sub) { fitFont(g, card.sub, 500, 34, LATIN, 840); g.fillStyle = ink + '0.7)'; g.fillText(card.sub, 60, 474); }
  if (card.tag) { g.fillStyle = ink + '0.7)'; g.textAlign = 'right'; g.font = `500 30px ${MONO}`; g.fillText(card.tag, 900, 86); }
  return c;
}
// 没有图片的牌：用代表色和大字做牌面
export function textFrontCanvas(card) {
  const [c, g] = canvas(1280, 720);
  g.fillStyle = card.color; g.fillRect(0, 0, 1280, 720);
  const ink = inkOn(card.color);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.fillStyle = ink + '0.72)'; g.font = `600 40px ${MONO}`;
  g.fillText(card.no, 76, 118);
  if (card.tag) { g.textAlign = 'right'; g.fillText(card.tag, 1204, 118); g.textAlign = 'left'; }
  g.fillStyle = ink + '0.95)';
  const big = ascii(card.title) ? 210 : 190;
  const size = fitFont(g, card.title, 800, big, ascii(card.title) ? LATIN : SANS, 1128);
  g.fillText(card.title, 72, 430 + size * 0.18);
  if (card.sub) { g.fillStyle = ink + '0.74)'; fitFont(g, card.sub, 500, 50, SANS, 1128); g.fillText(card.sub, 78, 600); }
  g.fillStyle = ink + '0.9)'; g.fillRect(78, 640, 120, 10);
  return c;
}
// 深色图片做牌面：沿牌边加一道细亮边，在深色舞台上才分得出边界
export function rimCanvas(img) {
  const [c, g] = canvas(1024, 576);
  g.drawImage(img, 0, 0, 1024, 576);
  g.strokeStyle = 'rgba(255,255,255,0.26)'; g.lineWidth = 4;
  g.beginPath(); g.roundRect(2, 2, 1020, 572, 34); g.stroke();
  return c;
}
// 把一张图染成单色剪影
function silhouette(img, w, h, color) {
  const [c, g] = canvas(w, h);
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, w, h);
  return c;
}
const wordFont = (b) => (b.font === 'sans' ? [800, ascii(b.wordmark) ? LATIN : SANS] : b.font === 'mono' ? [700, MONO] : b.font === 'serif' ? [400, SERIF] : ascii(b.wordmark) ? [400, SERIF] : [800, SANS]);
// 字标牌背面：强调色 + 标志剪影（没有标志就写字标）
export function brandBackCanvas(logo) {
  const b = film.brand;
  const [c, g] = canvas(960, 540);
  if (TH.surface?.glass) { /* 透明玻璃后的字标单独印在表面。 */ }
  else if (TH.surface) satinFill(g, 960, 540, b.back);
  else { g.fillStyle = b.back; g.fillRect(0, 0, 960, 540); }
  const fg = lum(b.back) < 0.55 ? PAPER : INK;
  if (logo) {
    const h = 140, w = Math.round((h * logo.naturalWidth) / logo.naturalHeight) || h;
    g.drawImage(silhouette(logo, w, h, fg), 480 - w / 2, 270 - h / 2);
  } else {
    const [wt, fam] = wordFont(b);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitFont(g, b.wordmark, wt, 150, fam, 800);
    g.fillText(b.wordmark, 480, 276);
  }
  return c;
}
// 字标牌正面：标志 + 字标（第一个句点画成强调色圆点）+ 一句话
export function brandCanvas(logo) {
  const b = film.brand;
  const [c, g] = canvas(1280, 720);
  const bp = b.paper || PAPER, bi = b.ink || INK;
  const bs = b.paper ? (lum(bp) < 0.55 ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.55)') : '#786f65';
  g.fillStyle = bp; g.fillRect(0, 0, 1280, 720);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const [wt, fam] = wordFont(b);
  const cut = b.dot === false ? -1 : b.wordmark.indexOf('.');
  const a = cut < 0 ? b.wordmark : b.wordmark.slice(0, cut), z = cut < 0 ? '' : b.wordmark.slice(cut + 1);
  let size = 232;
  const measure = () => {
    g.font = `${wt} ${size}px ${fam}`;
    const w1 = g.measureText(a).width, w2 = z ? g.measureText(z).width : 0;
    const dot = size * 0.1207, gap = size * 0.069;
    return { w1, w2, dot, gap, total: z ? w1 + gap + dot * 2 + gap + w2 : w1 };
  };
  let m = measure();
  if (m.total > 1160) { size = Math.floor((size * 1160) / m.total); m = measure(); }
  let x = (1280 - m.total) / 2;
  const y = logo ? 430 : 400;
  g.fillStyle = bi; g.fillText(a, x, y); x += m.w1;
  if (z) {
    x += m.gap;
    g.fillStyle = ACCENT; g.beginPath(); g.arc(x + m.dot, y - m.dot + 2, m.dot, 0, Math.PI * 2); g.fill(); x += m.dot * 2 + m.gap;
    g.fillStyle = bi; g.fillText(z, x, y);
  }
  if (b.tagline) {
    g.font = `500 40px ${SANS}`; g.fillStyle = bs; g.textAlign = 'center';
    try { g.letterSpacing = ascii(b.tagline) ? '4px' : '14px'; } catch (e) {}
    g.fillText(b.tagline, 640 + (ascii(b.tagline) ? 2 : 7), y + 110);
    try { g.letterSpacing = '0px'; } catch (e) {}
  }
  if (logo) {
    const h = 80, w = Math.round((h * logo.naturalWidth) / logo.naturalHeight) || h;
    g.drawImage(logo, 640 - w / 2, 120, w, h);
  }
  return c;
}
// 透明底的一行说明：粗体主词 + 细体补充
export function captionCanvas(main, sub, wUnits, hUnits, k = 2) {
  const [c, g] = canvas(wUnits * k, hUnits * k);
  g.textBaseline = 'middle';
  const fMain = `800 ${30 * k}px ${SANS}`, fSub = `500 ${22 * k}px ${SANS}`;
  g.font = fMain; const w = g.measureText(main).width;
  g.font = fSub; const total = w + (sub ? 18 * k + g.measureText(sub).width : 0);
  const s = Math.min(1, c.width / total);              // 一行放不下就整行缩小
  g.translate(0, c.height / 2); g.scale(s, s);
  g.font = fMain; g.fillStyle = '#fffdf8'; g.fillText(main, 0, 2);
  if (sub) { g.font = fSub; g.fillStyle = 'rgba(255,253,248,0.62)'; g.fillText(sub, w + 18 * k, 3); }
  return c;
}
// 纸色小标签
export function chipCanvas(lead, text, wUnits, hUnits, mono = false, k = 2) {
  const [c, g] = canvas(wUnits * k, hUnits * k);
  g.fillStyle = PAPER; g.fillRect(0, 0, c.width, c.height);
  g.textBaseline = 'middle';
  let x = 18 * k;
  if (lead) {
    g.font = `600 ${17 * k}px ${MONO}`;
    const faint = lum(ACCENT) > 0.6 && lum(PAPER) > 0.6;
    g.fillStyle = faint ? INK : ACCENT; g.globalAlpha = faint ? 0.5 : 1;
    g.fillText(lead, x, c.height / 2 + 1); x += g.measureText(lead).width + 9 * k;
    g.globalAlpha = 1;
  }
  g.font = mono ? `600 ${20 * k}px ${MONO}` : `800 ${25 * k}px ${SANS}`;
  g.fillStyle = INK; g.fillText(text, x, c.height / 2 + 2);
  return c;
}
export function chipWidth(lead, text, mono = false) {
  const [, g] = canvas(4, 4);
  let w = 36;
  if (lead) { g.font = `600 17px ${MONO}`; w += g.measureText(lead).width + 9; }
  g.font = mono ? `600 20px ${MONO}` : `800 25px ${SANS}`;
  return Math.ceil(w + g.measureText(text).width);
}
// 文字小卡（没有图片时顶替缩略图）：一个大字或数字 + 一行说明
export function tileCanvas(item, i) {
  const [c, g] = canvas(640, 800);
  const bg = item.color || (TH.surface ? TH.surface.palette[(i + 2) % TH.surface.palette.length] : i % 2 ? PAPER : '#191614');
  if (TH.surface) satinFill(g, 640, 800, bg);
  else { g.fillStyle = bg; g.fillRect(0, 0, 640, 800); }
  const ink = inkOn(bg);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = ink + '0.95)';
  const size = fitFont(g, item.big, 800, 320, ascii(item.big) ? LATIN : SANS, 540);
  g.fillText(item.big, 320, (item.small ? 380 : 430) + size * 0.36);
  if (item.small) { g.fillStyle = ink + '0.7)'; fitFont(g, item.small, 600, 76, SANS, 540); g.fillText(item.small, 320, 640); }
  return c;
}
// 打字面板：标题条 + 逐字打出来的正文（等宽，按空格折行；没有空格的长串按字折）
export function typingDraw(c, g, panel, n, k = 2) {
  const W = c.width, H = c.height, text = panel.text;
  g.clearRect(0, 0, W, H);
  g.fillStyle = TH.surface?.panel || '#191614'; g.fillRect(0, 0, W, H);
  g.fillStyle = TH.surface?.panelBar || '#26211e'; g.fillRect(0, 0, W, 50 * k);
  g.textBaseline = 'middle';
  g.font = `800 ${24 * k}px ${SANS}`; g.fillStyle = '#fffdf8';
  g.fillText(panel.title, 22 * k, 25 * k + 2);
  const w0 = g.measureText(panel.title).width;
  if (panel.sub) {
    g.font = `500 ${19 * k}px ${SANS}`; g.fillStyle = 'rgba(255,253,248,0.55)';
    g.fillText(panel.sub, 22 * k + w0 + 14 * k, 25 * k + 3);
  }
  g.font = `500 ${21 * k}px ${MONO}`; g.fillStyle = TH.surface?.mono || '#f3dfb6';
  const maxW = W - 44 * k, lh = 34 * k, x = 22 * k;
  let y = 50 * k + 34 * k, line = '';
  const flush = () => { g.fillText(line, x, y); y += lh; line = ''; };
  text.slice(0, n).split('\n').forEach((para, pi) => {
    if (pi > 0) flush();                                  // 换行符：另起一行
    for (let wd of para.split(' ')) {
      const test = line ? line + ' ' + wd : wd;
      if (g.measureText(test).width <= maxW) { line = test; continue; }
      if (line) flush();
      while (g.measureText(wd).width > maxW) {            // 一个词比一行还长：按字切
        let cut = wd.length;
        while (cut > 1 && g.measureText(wd.slice(0, cut)).width > maxW) cut--;
        line = wd.slice(0, cut); flush(); wd = wd.slice(cut);
      }
      line = wd;
    }
  });
  g.fillText(line, x, y);
  if (n < text.length || n === 0) {
    g.fillStyle = TH.cursor;
    g.fillRect(x + g.measureText(line).width + 4 * k, y - 13 * k, 11 * k, 26 * k);
  }
}
