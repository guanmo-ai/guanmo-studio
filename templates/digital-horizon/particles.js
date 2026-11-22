const unit = Math.PI * 2;
const wrap = value => value - Math.floor(value);
const mix = (a, b, t) => a + (b - a) * t;
const cssRgb = (tint, white) => `rgb(${tint.map(c => Math.round(mix(c, 1, white) * 255)).join(',')})`;

function random(seed) {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function makeGlyph(character, tint) {
  const stamp = document.createElement('canvas');
  const ctx = stamp.getContext('2d');
  stamp.width = 220;
  stamp.height = 96;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '550 62px "JetBrains Mono", "Noto Sans SC", monospace';
  ctx.shadowBlur = 9;
  ctx.shadowColor = cssRgb(tint, 0.15);
  ctx.fillStyle = cssRgb(tint, 0.46);
  ctx.fillText(character, stamp.width / 2, stamp.height / 2 + 3, stamp.width - 16);
  return stamp;
}

export function drawParticles(canvas, { count, seed, glyphs }, tint) {
  const rand = random(seed);
  const sprites = glyphs.map(glyph => makeGlyph(glyph, tint));
  const ctx = canvas.getContext('2d');
  const scale = canvas.width / 1920;
  const particles = Array.from({ length: count }, () => ({
    sprite: sprites[Math.floor(rand() * sprites.length)],
    phase: rand(),
    drift: mix(0.102, 0.195, rand()),
    spread: (rand() < 0.5 ? -1 : 1) * mix(30, 704, rand() ** 0.84),
    path: rand() * unit,
    size: mix(8, 28, rand() ** 1.78),
    opacity: mix(0.08, 0.61, rand() ** 1.45),
    spin: mix(-0.99, 0.99, rand()),
    tilt: rand() * unit,
  }));
  return time => {
    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      const age = wrap(p.phase + time * p.drift);
      const y = -108 + age * 735;
      const remaining = 1 - age;
      const spread = 0.09 + 1.09 * remaining ** 0.99;
      const x = 954 + p.spread * spread + Math.sin(p.path + age * 5.5) * 62 * remaining;
      const lift = Math.min(1, age / 0.14, remaining / 0.08);
      const alpha = p.opacity * (0.83 + 0.68 * age + 1.29 * age ** 3) * lift;
      const turn = p.tilt + p.spin * time;
      const angle = p.tilt + p.spin * time * 0.62 + 0.24 * Math.sin(age * 5.1 + p.path);
      const facing = 0.16 + 0.84 * Math.abs(Math.cos(turn));
      const size = p.size * (1.04 - 0.28 * age);
      const width = size * (p.sprite.width / 62);
      const height = size * (p.sprite.height / 62);
      ctx.setTransform(scale, 0, 0, scale, x * scale, y * scale);
      ctx.rotate(angle);
      ctx.scale(facing, 0.66 + 0.34 * Math.abs(Math.sin(turn + 1.4)));
      ctx.globalAlpha = Math.min(1, alpha * (0.62 + 0.38 * facing));
      ctx.drawImage(p.sprite, -width / 2, -height / 2, width, height);
    }
  };
}
