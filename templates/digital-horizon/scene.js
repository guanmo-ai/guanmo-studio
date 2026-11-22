import { drawHorizon } from './glow.js';
import { drawParticles } from './particles.js';
import { duration, openingIn, openingOut, titleIn } from './timing.js';

const film = await fetch('./film.json').then(response => {
  if (!response.ok) throw new Error('数字地平线配置加载失败');
  return response.json();
});
await Promise.all([
  window.__tenrecMotionFonts.ready,
  document.fonts.load('450 106px Geist', film.title + film.opening),
  document.fonts.load('450 106px "Noto Sans SC"', film.title + film.opening),
  document.fonts.load('550 62px "JetBrains Mono"', film.particles.glyphs.join('')),
]);
const params = new URLSearchParams(location.search);
const canvas = document.getElementById('gl');
const glyphs = document.createElement('canvas');
glyphs.className = 'glyphs';
glyphs.setAttribute('aria-hidden', 'true');
if (params.has('draft')) {
  canvas.width = 960;
  canvas.height = 540;
}
glyphs.width = canvas.width;
glyphs.height = canvas.height;
canvas.after(glyphs);
const hud = document.getElementById('hud');
const rgb = film.color.slice(1).match(/../g).map(value => Number.parseInt(value, 16) / 255);
const horizon = drawHorizon(canvas, rgb);
const particles = drawParticles(glyphs, film.particles, rgb);

function makeCopy(text, className, tag) {
  const element = document.createElement(tag);
  element.className = `horizon-copy ${className}`;
  element.textContent = text;
  hud.append(element);
  const width = element.offsetWidth;
  if (width > 1660) element.style.transform = `translateX(-50%) scale(${1660 / width})`;
  return element;
}
const opening = makeCopy(film.opening, 'horizon-opening', 'p');
const title = makeCopy(film.title, '', 'h1');

function ease(time, [from, to]) {
  const progress = Math.max(0, Math.min(1, (time - from) / (to - from)));
  return progress * progress * (3 - 2 * progress);
}

function display(element, opacity) {
  element.style.visibility = opacity > 0 ? 'visible' : 'hidden';
  element.style.opacity = opacity;
}

window.addEventListener('hf-seek', ({ detail: { time } }) => {
  const cue = time * duration / film.duration;
  horizon(time);
  particles(time);
  display(opening, ease(cue, openingIn) * (1 - ease(cue, openingOut)));
  display(title, ease(cue, titleIn));
});
