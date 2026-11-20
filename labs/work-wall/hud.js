// 文字层：所有字都是时间的纯函数。逐字从下方升起（带一点过冲），离场时整行向上收走。
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const outBack = x => { const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const outExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const inCubic = x => x * x * x;

export function buildHud(root, cfg, { W, H, B }) {
  const U = Math.min(W, H) / 100;
  root.style.setProperty('--u', U + 'px');
  const el = (cls, html = '', parent = root) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; parent.appendChild(d); return d; };

  // 一行逐字出现的文字
  function line(parent, text, cls) {
    const box = el('line ' + (cls || ''), '', parent);
    const chars = [...text].map(ch => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch === ' ' ? ' ' : ch; box.appendChild(s); return s; });
    return { box, chars, text };
  }
  function play(l, t, tin, tout, { stagger = .022, dur = .32, rise = 1 } = {}) {
    const leaving = tout != null ? prog(t, tout, tout + .28) : 0;
    l.box.style.display = t < tin - .01 || leaving >= 1 ? 'none' : '';
    l.chars.forEach((c, i) => {
      const p = prog(t, tin + i * stagger, tin + i * stagger + dur);
      const y = (1 - outBack(p)) * 110 * rise - inCubic(leaving) * 120;
      c.style.transform = `translateY(${y}%)`;
      c.style.opacity = clamp(p * 3) * (1 - leaving);
    });
  }

  // ---------- 开场 ----------
  const hook = el('block hook');
  const hookKicker = line(hook, cfg.hook.kicker, 'kicker');
  const hookLines = cfg.hook.lines.map(s => line(hook, s, 'headline'));
  const hookSub = line(hook, cfg.hook.sub, 'sub');

  // ---------- 每道波的标签 ----------
  const waveBox = el('block wave');
  const waveLabels = cfg.waves.filter(w => w.label).map((w, i, arr) => {
    const g = el('wave-item', '', waveBox);
    const no = line(g, `${String(i + 1).padStart(2, '0')} / ${String(arr.length).padStart(2, '0')}`, 'kicker');
    const big = line(g, w.label, 'label');
    const sub = w.sub ? line(g, w.sub, 'sub') : null;
    return { w, no, big, sub, g };
  });

  // ---------- 主角 ----------
  const heroBox = el('block herolabel');
  const heroNo = line(heroBox, cfg.hero.kicker, 'kicker');
  const heroTitle = line(heroBox, cfg.hero.title, 'label');
  const heroSub = cfg.hero.sub ? line(heroBox, cfg.hero.sub, 'sub') : null;

  // ---------- 收获 ----------
  const pay = el('block payoff');
  const payTitle = line(pay, cfg.payoff.title, 'headline');
  const chipRow = el('chips', '', pay);
  const chips = cfg.payoff.chips.map(c => el('chip', `<i></i>${c}`, chipRow));

  // ---------- 片尾 ----------
  const end = el('block end');
  const [wm1, wm2] = cfg.end.wordmark.split('.');
  const word = el('wordmark', `<span class="w1">${wm1}</span><span class="dot"></span><span class="w2">${wm2 ?? ''}</span>`, end);
  const endSub = line(end, cfg.end.sub, 'sub big');
  const url = el('url', cfg.end.url, end);
  const credit = el('credit', `<span>${cfg.end.credit}</span><span class="seal">${cfg.end.seal}</span>`, end);
  const seal = credit.querySelector('.seal');

  const scrim = el('scrim');
  const T = cfg.timeline;

  return {
    update(t) {
      // 开场：第 0 帧已经是完整的标题（首行不做入场），第二行在第二拍砸上
      play(hookKicker, t, -1, T.hookOut);
      hookLines.forEach((l, i) => play(l, t, i === 0 ? -1 : cfg.hook.lineAt[i], T.hookOut, { stagger: .03 }));
      play(hookSub, t, cfg.hook.subAt, T.hookOut);

      waveLabels.forEach(({ w, no, big, sub }, i) => {
        const next = waveLabels[i + 1]?.w.at ?? T.heroOut - .1;
        play(no, t, w.at, next - .3);
        play(big, t, w.at + .04, next - .3, { stagger: .035 });
        if (sub) play(sub, t, w.at + .12, next - .3);
      });

      play(heroNo, t, cfg.hero.labelAt, cfg.hero.back[0]);
      play(heroTitle, t, cfg.hero.labelAt + .05, cfg.hero.back[0], { stagger: .04 });
      if (heroSub) play(heroSub, t, cfg.hero.labelAt + .15, cfg.hero.back[0]);

      play(payTitle, t, T.payoff, T.endIn - .2, { stagger: .03 });
      chips.forEach((c, i) => {
        const a = T.payoff + B * .5 + i * B * .5;
        const p = outBack(prog(t, a, a + .3)), leave = prog(t, T.endIn - .2, T.endIn + .1);
        c.style.opacity = clamp(p * 2) * (1 - leave);
        c.style.transform = `translateY(${(1 - p) * 60 - leave * 40}%) scale(${.7 + .3 * clamp(p)})`;
      });

      // 片尾：字标从圆点里长出来，章在拍点盖下
      const e = prog(t, T.endIn, T.endIn + .5);
      end.style.display = t < T.endIn ? 'none' : '';
      const dotP = outBack(prog(t, T.endIn, T.endIn + .35));
      word.querySelector('.dot').style.transform = `scale(${dotP})`;
      const spread = outExpo(prog(t, T.endIn + .2, T.endIn + .8));
      word.querySelector('.w1').style.clipPath = `inset(0 0 0 ${(1 - spread) * 100}%)`;
      word.querySelector('.w2').style.clipPath = `inset(0 ${(1 - spread) * 100}% 0 0)`;
      word.querySelector('.w1').style.transform = `translateX(${(1 - spread) * 40}%)`;
      word.querySelector('.w2').style.transform = `translateX(${-(1 - spread) * 40}%)`;
      play(endSub, t, T.endIn + .55, null, { stagger: .018 });
      const up = outExpo(prog(t, T.endIn + .8, T.endIn + 1.2));
      url.style.opacity = up; url.style.transform = `translateY(${(1 - up) * 40}%)`;
      const cr = outExpo(prog(t, T.endIn + 1, T.endIn + 1.4));
      credit.style.opacity = cr;
      // 盖章：从大到小砸下，过冲一点
      const st = prog(t, T.stamp, T.stamp + .22);
      seal.style.opacity = st > 0 ? 1 : 0;
      seal.style.transform = `scale(${st >= 1 ? 1 : 2.4 - 1.4 * outBack(st)}) rotate(${-8 + 8 * st}deg)`;

      // 字下面的暗区：有字的时候才出现
      const textOn = Math.max(1 - prog(t, T.hookOut, T.hookOut + .3), prog(t, T.payoff - .3, T.payoff), e);
      const w0 = cfg.waves.find(w => w.label).at;
      const waveScrim = prog(t, w0 - .3, w0) * (1 - prog(t, T.heroOut, T.heroOut + .4));
      scrim.style.opacity = .85 * textOn + .35 * (1 - textOn) * waveScrim;
      void e;
    },
  };
}
