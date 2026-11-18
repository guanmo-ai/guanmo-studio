import { buildScene } from './scene.js';
import { film } from './data.js';
import { buildHud } from './hud.js';

const root = document.querySelector('#stage');
const host = window.TenrecMotionHost;

const loadImage = (name) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('image failed: ' + name));
  img.src = host.resourceUrl(root, 'assets/' + name);
});

let stage = null, hud = null, lastT = 0, inspectionTilt = { x: 0, y: 0 };
const ready = (async () => {
  const fonts = window.__tenrecMotionFonts;
  if (fonts && fonts.ready) await fonts.ready;       // 画布文字要等字体到位再画
  const images = {};
  await Promise.all(film.images.map((name) => loadImage(name).then((im) => { images[name] = im; })));
  stage = buildScene(document.querySelector('#gl'), images);
  hud = buildHud(document.querySelector('#hud'));
  window.__cardCarousel = {
    setAppearance: patch => { stage.setAppearance(patch); draw(lastT); },
    setInspection: options => { stage.setInspection(options);document.querySelector('#hud').style.display=options?'none':'';draw(lastT); },
    setInspectionTilt: tilt => { inspectionTilt = tilt; draw(lastT); },
  };
  host.onDispose(() => stage.dispose());
  draw(lastT);
})();
host.trackResource(ready);

function draw(t) {
  stage.render(t, inspectionTilt);
  hud.update(t);
}
window.addEventListener('hf-seek', (event) => {
  lastT = event.detail.time;
  if (stage) draw(lastT);
  else event.detail.waitUntil(ready.then(() => draw(lastT)));
});
