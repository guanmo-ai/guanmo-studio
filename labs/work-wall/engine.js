// Work Wall 作品墙：一面真实作品组成的墙，翻牌的波一拍一拍扫过，一张牌冲到全屏播放，再拉远收束。
// 画面上的每一样东西都是时间 t 的纯函数：seek(t) 之后截图即可逐帧导出。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildHud } from './hud.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1920, H = +q.get('h') || 1080;
const QUALITY = q.get('q') || 'final';                // draft：不做景深、不做倒影
const cfg = await (await fetch(q.get('config') || 'config.json')).json();
const B = 60 / cfg.bpm;

// ---------- 数学 ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, x) => a + (b - a) * x;
const smooth = x => x * x * (3 - 2 * x);
const inOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const outExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
// 欠阻尼弹簧的阶跃响应：ζ=0.7 时过冲约 4.6%
function spring(tau, omega = 22, zeta = 0.7) {
  if (tau <= 0) return 0;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * tau) * (Math.cos(wd * tau) + (zeta * omega / wd) * Math.sin(wd * tau));
}
// 伪随机（确定性）
const rand = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- 时间表（秒，均落在拍点） ----------
const TL = cfg.timeline;   // 由配置给出，见 config.json

// ---------- 渲染器 ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY === 'draft', preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const BG = new THREE.Color(cfg.theme.stage);
scene.background = BG;
scene.fog = new THREE.FogExp2(BG, 0.035);
const camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 200);

// ---------- 灯光：一盏跟着波走的聚光 + 很弱的环境光 ----------
scene.add(new THREE.HemisphereLight(0xfff1e6, 0x1a1412, 0.9));
// 柔和的摄影棚反射：牌翻起来的时候，表面会掠过一层光
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .35;
const key = new THREE.SpotLight(0xffe2c4, 220, 40, Math.PI / 5, 0.85, 1.6);
key.position.set(0, 4, 9); scene.add(key); scene.add(key.target);
const rim = new THREE.DirectionalLight(0x9db7ff, 0.35); rim.position.set(-6, 3, -4); scene.add(rim);

// ---------- 纹理 ----------
const loader = new THREE.TextureLoader();
const texCache = new Map();
const tex = src => {
  if (!texCache.has(src)) {
    const t = loader.load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.minFilter = THREE.LinearMipmapLinearFilter; texCache.set(src, t);
  }
  return texCache.get(src);
};

// ---------- 牌 ----------
const TW = cfg.wall.tile[0], TH = cfg.wall.tile[1], GAP = cfg.wall.gap;
const ROWS = cfg.wall.rows, COLS = cfg.wall.cols;
function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 6);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x) / w, (p.getY(i) - y) / h);
  return g;
}
const tileGeo = roundedRect(TW, TH, cfg.wall.radius);
const backGeo = tileGeo.clone(); backGeo.rotateY(Math.PI);
const edgeMat = new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: .6 });
const stages = cfg.stages;                          // 每一面墙的内容：stages[k].tiles[i]
const pick = (k, i) => { const list = stages[k].tiles; return list[i % list.length]; };
// 相邻的牌错开取图：按格子坐标做一个不重复的序号

const wall = new THREE.Group(); scene.add(wall);
const tiles = [];
const x0 = -(COLS - 1) / 2 * (TW + GAP), y0 = -(ROWS - 1) / 2 * (TH + GAP);
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const i = tiles.length;
  const g = new THREE.Group();
  const front = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({ roughness: .32, metalness: 0 }));
  const back = new THREE.Mesh(backGeo, new THREE.MeshStandardMaterial({ roughness: .32, metalness: 0 }));
  const slab = new THREE.Mesh(new THREE.BoxGeometry(TW * .985, TH * .985, .012), edgeMat);   // 牌有厚度，翻起来看得到侧边
  front.position.z = .0075; back.position.z = -.0075;
  g.add(front, back, slab);
  const x = x0 + c * (TW + GAP), y = y0 + r * (TH + GAP);
  g.position.set(x, y, 0);
  // 打乱：相邻牌不取同一期
  const order = (c * 7 + r * 11 + Math.floor(rand(i, 3) * 3)) ;
  tiles.push({ g, front, back, x, y, r, c, order, faces: [] });
  wall.add(g);
}
// 背板：一块暗色哑光面，让聚光落在墙上，牌和背板之间有阴影的距离感
const board = new THREE.Mesh(new THREE.PlaneGeometry(COLS * (TW + GAP) + 4, ROWS * (TH + GAP) + 4), new THREE.MeshStandardMaterial({ color: cfg.theme.board, roughness: .92 }));
board.position.z = -.16; scene.add(board);

// 主角牌：哪一格、显示什么
const heroSlot = tiles.findIndex(t => t.r === cfg.hero.slot[1] && t.c === cfg.hero.slot[0]);
const hero = tiles[heroSlot];

// ---------- 翻牌：第 k 次波到达之后，牌停在第 k 面 ----------
const waves = cfg.waves;            // [{at, stage, origin:[x,y], speed}]
function waveArrival(w, tile) {
  const dx = tile.x - w.origin[0], dy = tile.y - w.origin[1];
  const d = w.radial ? Math.hypot(dx, dy) : Math.max(0, dx) + Math.abs(dy) * .15;
  return w.at + d / w.speed + rand(tile.order, 9) * .04;
}
// 一张牌依次要显示的面：初始面 + 每道波带来的面
const faceSeq = [cfg.initialStage, ...waves.map(w => w.stage)];
function tileState(tile, t) {
  let turns = 0, lift = 0;
  for (const w of waves) {
    const tau = t - waveArrival(w, tile);
    if (tau < 0) break;
    turns += spring(tau, 20, .68);
    lift = Math.max(lift, Math.sin(Math.PI * clamp(tau / .42)) * (1 - clamp(tau / .42) * .2));
  }
  const n = Math.min(faceSeq.length - 1, Math.floor(turns + .5));      // 朝外的是第 n 面
  const hidden = turns < n ? faceSeq[Math.max(0, n - 1)] : faceSeq[Math.min(faceSeq.length - 1, n + 1)];
  return { turns, n, visible: faceSeq[n], hidden, lift };
}
// 给每一面墙预先分好图：相邻（左、下、左下、右下）不重复，用得最少的优先，打平时按确定性随机挑
const assign = {};
for (const [name, st] of Object.entries(stages)) {
  const L = st.tiles.length, used = new Array(L).fill(0), grid = new Map();
  assign[name] = tiles.map((tile, i) => {
    const near = new Set([[-1, 0], [0, -1], [-1, -1], [1, -1], [-2, 0], [0, -2]].map(([dc, dr]) => grid.get(`${tile.c + dc},${tile.r + dr}`)).filter(v => v != null));
    let best = -1, bestScore = 1e9;
    for (let j = 0; j < L; j++) {
      if (near.has(j) && L > near.size) continue;
      const score = used[j] + rand(i * 31 + j, name.length) * .9;
      if (score < bestScore) { bestScore = score; best = j; }
    }
    used[best]++; grid.set(`${tile.c},${tile.r}`, best);
    return st.tiles[best];
  });
}
const faceSrc = (stage, tile) => stage === 'back' ? cfg.backFace : (tile === hero && stage === cfg.hero.stage ? cfg.hero.face : assign[stage][tiles.indexOf(tile)]);

// ---------- 主角片段：逐帧图片 ----------
const heroFrames = cfg.hero.frames;   // {dir, count, fps}
let heroTex = null, heroIdx = -1;
async function setHeroFrame(n) {
  n = clamp(Math.round(n), 0, heroFrames.count - 1);
  if (n === heroIdx) return;
  heroIdx = n;
  const img = new Image(); img.src = `${heroFrames.dir}/${String(n + 1).padStart(4, '0')}.jpg`;
  await img.decode();
  if (!heroTex) { heroTex = new THREE.Texture(img); heroTex.colorSpace = THREE.SRGBColorSpace; heroTex.minFilter = THREE.LinearFilter; heroTex.generateMipmaps = false; }
  else heroTex.image = img;
  heroTex.needsUpdate = true;
}
const heroMat = new THREE.MeshBasicMaterial({ toneMapped: false, fog: false, transparent: true });
const heroMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), heroMat);
heroMesh.visible = false; scene.add(heroMesh);

// ---------- 镜头：关键帧 + Catmull-Rom（位置和速度都连续） ----------
const keys = cfg.camera.map(k => ({ t: k.t, p: new THREE.Vector3(...k.pos), l: new THREE.Vector3(...k.look), fov: k.fov, focus: k.focus ?? null, blur: k.blur ?? 0 }));
function camAt(t) {
  t = clamp(t, keys[0].t, keys[keys.length - 1].t);
  let i = keys.findIndex((k, j) => j < keys.length - 1 && t >= k.t && t <= keys[j + 1].t);
  if (i < 0) i = keys.length - 2;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = (t - k1.t) / (k2.t - k1.t);
  const e = k1.ease === false ? u : u;     // 各段内用 Catmull-Rom 的自然速度
  const cr = (a, b, c, d) => {             // 非均匀时间的 Catmull-Rom（切线按相邻段时长归一）
    const m1 = b.clone().sub(a).multiplyScalar(1 / Math.max(1e-3, k1.t - k0.t || 1)).add(c.clone().sub(b).multiplyScalar(1 / (k2.t - k1.t))).multiplyScalar(.5 * (k2.t - k1.t));
    const m2 = c.clone().sub(b).multiplyScalar(1 / (k2.t - k1.t)).add(d.clone().sub(c).multiplyScalar(1 / Math.max(1e-3, k3.t - k2.t || 1))).multiplyScalar(.5 * (k2.t - k1.t));
    if (k1 === k0) m1.copy(c.clone().sub(b)).multiplyScalar(0);   // 起点静止
    if (k3 === k2) m2.multiplyScalar(0);                          // 终点静止
    const h00 = 2 * e ** 3 - 3 * e ** 2 + 1, h10 = e ** 3 - 2 * e ** 2 + e, h01 = -2 * e ** 3 + 3 * e ** 2, h11 = e ** 3 - e ** 2;
    return b.clone().multiplyScalar(h00).add(m1.multiplyScalar(h10)).add(c.clone().multiplyScalar(h01)).add(m2.multiplyScalar(h11));
  };
  const s = smooth(u);
  return { p: cr(k0.p, k1.p, k2.p, k3.p), l: cr(k0.l, k1.l, k2.l, k3.l), fov: lerp(k1.fov, k2.fov, s), focus: lerp(k1.focus ?? 8, k2.focus ?? 8, s), blur: lerp(k1.blur, k2.blur, s) };
}

// ---------- 后期：景深（按深度的散景收集）+ 暗角 + 颗粒 ----------
const depthTarget = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
depthTarget.depthTexture = new THREE.DepthTexture(W, H);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: QUALITY === 'draft' ? 0 : 4 }));
composer.setPixelRatio(1); composer.setSize(W, H);
const renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
const dof = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, near: { value: .05 }, far: { value: 200 }, focus: { value: 8 }, aperture: { value: 0 }, maxBlur: { value: 14 }, res: { value: new THREE.Vector2(W, H) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    #include <packing>
    uniform sampler2D tDiffuse, tDepth; uniform float near, far, focus, aperture, maxBlur; uniform vec2 res; varying vec2 vUv;
    float viewZ(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
    float coc(float z){ return clamp(aperture * abs(z - focus) / z, 0., 1.) * maxBlur; }
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      float c0 = coc(viewZ(vUv));
      if (c0 < .5) { gl_FragColor = base; return; }
      vec3 acc = base.rgb; float wsum = 1.;
      const int N = 24;
      for (int i = 0; i < N; i++) {
        float fi = float(i) + .5;
        float r = sqrt(fi / float(N)) * c0;
        float a = fi * 2.39996;
        vec2 o = vec2(cos(a), sin(a)) * r / res;
        vec3 s = texture2D(tDiffuse, vUv + o).rgb;
        float cs = coc(viewZ(vUv + o));
        float w = smoothstep(0., 1., cs - r + 1.) * (1. + dot(s, vec3(.6)) * 1.4);   // 亮处权重大一点，像散景
        acc += s * w; wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, 1.);
    }`,
});
composer.addPass(dof);
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: .32 }, grain: { value: .035 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vig, grain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time * 61.7) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - .5; c.rgb *= 1. - vig * dot(d, d) * 2.2;
      c.rgb += (h(vUv * 1000.) - .5) * grain; gl_FragColor = c; }`,
});
composer.addPass(finish);
composer.addPass(new OutputPass());

const hud = buildHud(document.getElementById('hud'), cfg, { W, H, B });

// ---------- 一帧 ----------
const tmpV = new THREE.Vector3();
async function render(t) {
  const cam = camAt(t);
  camera.position.copy(cam.p); camera.lookAt(cam.l); camera.fov = cam.fov; camera.updateProjectionMatrix();

  scene.fog.density = clamp(.21 / Math.max(.5, cam.p.z), .006, .07);

  // 主光沿墙缓慢来回漂移（连续，不跟随波前跳动）
  const front = cam.l.x + 2.6 * Math.sin(t * .9 - .6);
  key.position.set(lerp(cam.l.x, front, .7), cam.l.y + 5, cam.p.z + 3); key.target.position.set(front, cam.l.y, 0);
  key.intensity = cfg.light.key * (1 - prog(t, TL.end - B * 2, TL.end) * .55);

  for (const tile of tiles) {
    const s = tileState(tile, t);
    // 偶数面在正面那一侧，奇数面在背面那一侧
    const frontStage = s.n % 2 === 0 ? s.visible : s.hidden, backStage = s.n % 2 === 0 ? s.hidden : s.visible;
    const fSrc = faceSrc(frontStage, tile), bSrc = faceSrc(backStage, tile);
    if (tile.front.material.map?.userData.src !== fSrc) { tile.front.material.map = tex(fSrc); tile.front.material.map.userData.src = fSrc; tile.front.material.needsUpdate = true; }
    if (tile.back.material.map?.userData.src !== bSrc) { tile.back.material.map = tex(bSrc); tile.back.material.map.userData.src = bSrc; tile.back.material.needsUpdate = true; }
    tile.g.rotation.y = Math.PI * s.turns;
    tile.g.position.set(tile.x, tile.y, s.lift * .38);
    tile.g.rotation.x = s.lift * .08;
    tile.g.visible = true;
  }

  // 主角：从墙上的格子飞到镜头前铺满画面，宽高比从 4:5 变到 16:9，同时开始播放
  const hp = cfg.hero;
  const up = inOut(prog(t, hp.out[0], hp.out[1])), down = inOut(prog(t, hp.back[0], hp.back[1]));
  const k = up * (1 - down);
  if (t >= hp.out[0] && t < hp.back[1]) {
    const film = clamp(t - hp.out[0], 0, 1e9) * heroFrames.fps * (hp.speed ?? 1);
    await setHeroFrame(film);
    heroMat.map = heroTex; heroMat.needsUpdate = true;
    // 交叉淡化：离开墙面的前 12% 里，平面从透明到不透明，牌位随之空出来
    heroMat.opacity = clamp(k / .12);
    hero.g.visible = k < .12;
    heroMesh.visible = k > 0;
    // 起点：墙上那一格（4:5，居中裁切）；终点：镜头前铺满（16:9）
    const d = 1.2, fh = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), fw = fh * camera.aspect;
    const end = camera.position.clone().add(camera.getWorldDirection(tmpV).multiplyScalar(d));
    const start = new THREE.Vector3(hero.x, hero.y, .02);
    // 路径带一点弧线，先离开墙面
    const mid = start.clone().lerp(end, .5).add(new THREE.Vector3(0, .25, .6));
    const p = start.clone().multiplyScalar((1 - k) ** 2).add(mid.multiplyScalar(2 * k * (1 - k))).add(end.clone().multiplyScalar(k * k));
    heroMesh.position.copy(p);
    heroMesh.quaternion.copy(camera.quaternion).slerp(new THREE.Quaternion(), 1 - k);
    heroMesh.rotateY(Math.sin(Math.PI * k) * -.35);
    const w = lerp(TW, fw * 1.002, k), h = lerp(TH, fh * 1.002, k);
    heroMesh.scale.set(w, h, 1);
    // 裁切：开始只显示中间 4:5，逐渐露出完整 16:9
    const aspectNow = w / h, src = 16 / 9;
    const rx = Math.min(1, aspectNow / src);
    heroTex.repeat.set(rx, 1); heroTex.offset.set((1 - rx) / 2, 0);
  } else { heroMesh.visible = false; hero.g.visible = true; heroMat.opacity = 1; }

  // 景深：主角飞出来时焦点跟着它，铺满时完全清晰
  const hk = t >= cfg.hero.out[0] && t < cfg.hero.back[1] ? inOut(prog(t, cfg.hero.out[0], cfg.hero.out[1])) * (1 - inOut(prog(t, cfg.hero.back[0], cfg.hero.back[1]))) : 0;
  if (hk > 0) { cam.focus = lerp(cam.focus, 1.2, hk); cam.blur = cam.blur * (1 - hk); }
  const useDof = QUALITY !== 'draft' && cam.blur > .01;
  dof.enabled = useDof;
  if (useDof) {
    dof.uniforms.focus.value = cam.focus; dof.uniforms.aperture.value = cam.blur;
    renderer.setRenderTarget(depthTarget); renderer.render(scene, camera); renderer.setRenderTarget(null);
    dof.uniforms.tDepth.value = depthTarget.depthTexture;
  }
  finish.uniforms.time.value = Math.floor(t * 60);
  composer.render();
  hud.update(t);
}

// 等所有贴图到位
async function preload() {
  const all = new Set([cfg.backFace]);
  Object.values(stages).forEach(s => s.tiles.forEach(x => all.add(x))); all.add(cfg.hero.face);
  await Promise.all([...all].map(src => new Promise((res, rej) => { const tx = tex(src); if (tx.image) return res(); loader.load(src, im => { tx.image = im.image; tx.needsUpdate = true; res(); }, undefined, rej); })));
  await document.fonts.ready;
  await setHeroFrame(0);
}
await preload();
await render(0);
window.__dbg = () => { const t = tiles.find(x => x.r === 6 && x.c === 10); return [t.front.material.map?.userData.src, t.back.material.map?.userData.src, t.g.rotation.y.toFixed(2)]; };
window.__proto = { duration: TL.end, seek: async t => { await render(t); }, ready: Promise.resolve(true) };
