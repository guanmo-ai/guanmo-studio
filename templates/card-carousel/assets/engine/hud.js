// 屏幕上的字（DOM）。每一行都从遮罩里升起、再从遮罩里落下；状态只由时间决定。
// 文字来自 film.json；太长的行在初始化时按给定宽度缩小字号，不折行。
import { ph, eo5, ei3, clamp, smooth } from './lib.js';
import { film } from './data.js';

// 字后面的暗角：[class, 入, 出]，让压在牌上的小字读得清
const SCRIMS = [['tl', 1.9, 4.95]];

// 每行：块、样式、文字、入场时刻、退场时刻、最大宽度（像素）、是否按 HTML 写入
function lines() {
  const F = film, L = [];
  const add = (blk, cls, text, a, b, fit, html = false) => { if (text) L.push({ blk, cls, text, a, b, fit, html }); };
  add('hook', 'kicker', F.hook.kicker, -1, 0.72, 720);
  F.hook.title.forEach((s, i) => add('hook', 'mega', s, -1, 0.76 + i * 0.04, 720));
  add('hook', 'sub', F.hook.sub, -1, 0.84, 720);

  add('count', 'big', F.count.big, 2.02, 4.82, 1150, true);
  add('count', 'sub', F.count.sub, 2.12, 4.88, 1150);

  add('kit', 'head', F.kit.head, 6.12, 10.12, 1000);
  add('kitpath', 'path', F.kit.path, 6.2, 10.16, 640);

  add('open', 'mega', F.payoff, 11.06, 12.72, 720);

  add('end', 'title', F.end.title, 13.56, 99, 880);
  add('end', 'sub', F.end.sub, 13.64, 99, 880);
  add('end', 'url', F.end.url, 13.74, 99, 880);
  add('end', 'credit', F.end.credit, 13.84, 99, 760);
  return L;
}

export function buildHud(el) {
  const TH = film.theme;
  el.classList.toggle('image-background', Boolean(film.background?.image));
  el.style.setProperty('--hl', TH.highlight);
  el.style.setProperty('--seal', TH.seal);
  el.style.setProperty('--paper', TH.paper);
  // 印章颜色很浅时，章里的字和内圈改成深色
  const light = (h) => (parseInt(h.slice(1, 3), 16) * 0.299 + parseInt(h.slice(3, 5), 16) * 0.587 + parseInt(h.slice(5, 7), 16) * 0.114) / 255 > 0.6;
  if (light(TH.seal)) { el.style.setProperty('--seal-ink', '#15110f'); el.style.setProperty('--seal-ring', 'rgba(21, 17, 15, 0.8)'); }
  el.style.setProperty('--scrim', TH.stage.scrim);
  const scrims = SCRIMS.map(([cls, a, b]) => {
    const d = document.createElement('div');
    d.className = 'scrim scrim-' + cls;
    d.style.height = `${film.background?.titleScrimHeight ?? 400}px`;
    el.appendChild(d);
    return { d, a, b };
  });
  const blocks = {};
  const all = lines().map((L) => {
    if (!blocks[L.blk]) {
      const d = document.createElement('div');
      d.className = 'blk blk-' + L.blk;
      el.appendChild(d); blocks[L.blk] = d;
    }
    const ln = document.createElement('div');
    ln.className = 'ln ' + L.cls;
    const inner = document.createElement('span');
    if (L.cls === 'url') {
      const p = document.createElement('span');
      p.className = 'pill'; p.textContent = L.text; inner.appendChild(p);
    } else if (L.cls === 'credit') {
      inner.textContent = L.text;
      if (film.end.handle) { const em = document.createElement('em'); em.textContent = film.end.handle; inner.append(' ', em); }
    } else if (L.html) inner.innerHTML = L.text;
    else inner.textContent = L.text;
    ln.appendChild(inner); blocks[L.blk].appendChild(ln);
    // 一行放不下就缩小字号（只在初始化时量一次）
    const w = inner.offsetWidth;
    if (L.fit && w > L.fit) {
      const target = L.cls === 'url' ? inner.firstChild : inner;
      const fs = parseFloat(getComputedStyle(target).fontSize);
      target.style.fontSize = ((fs * L.fit) / w).toFixed(2) + 'px';
    }
    return { ln, inner, a: L.a, b: L.b, cls: L.cls, blk: L.blk };
  });
  // 开场两行大标题用同一个字号：有一行被缩小，另一行跟着缩
  const megas = all.filter((x) => x.blk === 'hook' && x.cls === 'mega');
  const sizes = megas.map((x) => parseFloat(getComputedStyle(x.inner).fontSize));
  if (sizes.length > 1 && Math.max(...sizes) - Math.min(...sizes) > 0.5) for (const x of megas) x.inner.style.fontSize = Math.min(...sizes).toFixed(2) + 'px';
  // 开场标题只有一行时，整块往下挪一点，保持在画面中段
  if (film.hook.title.length < 2) blocks.hook.style.top = '418px';

  // 署名印章：跟在署名那一行的右边
  let seal = null;
  const chars = Array.from(film.end.seal || '').slice(0, 2);
  const credit = all.find((x) => x.cls === 'credit');
  if (chars.length && credit) {
    seal = document.createElement('div');
    seal.className = 'seal';
    for (const ch of chars) { const s = document.createElement('span'); s.textContent = ch; seal.appendChild(s); }
    el.appendChild(seal);
    seal.style.left = Math.round(blocks.end.offsetLeft + credit.inner.offsetWidth + 44) + 'px';
    seal.style.top = Math.round(blocks.end.offsetTop + credit.ln.offsetTop - 9) + 'px';
  }

  function update(t) {
    for (const S of scrims) S.d.style.opacity = (smooth(S.a, S.a + 0.35, t) * (1 - smooth(S.b, S.b + 0.3, t))).toFixed(3);
    for (const L of all) {
      const i = eo5(ph(t, L.a, L.a + 0.3));
      const o = ei3(ph(t, L.b, L.b + 0.2));
      const on = t >= L.a && t < L.b + 0.2;
      L.ln.style.visibility = on ? 'visible' : 'hidden';
      if (on) L.inner.style.transform = `translateY(${((1 - i) * 112 - o * 112).toFixed(2)}%)`;
    }
    if (!seal) return;
    // 盖章：14.0 s 落下，7 帧从 1.7 倍压回 1
    const x = t - 14.0;
    if (x < 0) seal.style.visibility = 'hidden';
    else {
      const k = clamp(x / 0.117);
      const s = 1.7 - 0.7 * eo5(k) + 0.05 * Math.exp(-14 * x) * Math.sin(40 * x);
      seal.style.visibility = 'visible';
      seal.style.opacity = clamp(x / 0.05).toFixed(3);
      seal.style.transform = `rotate(-7deg) scale(${s.toFixed(4)})`;
    }
  }
  return { update };
}
