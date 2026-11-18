// 三维场景：一圈牌 + 拆包零件 + 背景。render(t) 把整个画面当作时间的纯函数重算，
// 并在 1/120 秒的快门里取若干子帧做运动模糊。
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clamp, lerp, rad, smooth, hash } from './lib.js';
import * as C from './choreo.js';
import { film, CARDS } from './data.js';
import * as X from './tex.js';
import { buildKit } from './kit.js';
import { glassStage } from './glass-stage.js';
import { faceCanvas } from './card-face.js';
import { distributeCards } from './card-distribution.js';

export const W = 1920, H = 1080, CW = 640, CH = 360, SHUTTER = 1 / 120;
const draftRender = new URLSearchParams(location.search).has('draft');
const stillRender = new URLSearchParams(location.search).has('still');
// 子帧数跟着转速走：转得越快取得越密，快门里不留叠影
const subCount = (t) => {
  if (stillRender) return 1;
  if (draftRender) return 3;
  const w = Math.abs(C.theta(t + 0.004) - C.theta(t - 0.004)) / 0.008;
  const fly = t > 10.15 && t < 11.0 ? 44 : t < 2.1 || (t > 5.9 && t < 6.7) || t > 10.1 ? 28 : 12;
  return Math.min(72, Math.ceil(fly + 5 * w));
};

export function buildScene(canvasEl, images) {
  const ST = film.theme.stage;
  const background = film.background || {};
  THREE.ColorManagement.enabled = false;            // 颜色原样进出，不做线性转换
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = false;
  renderer.debug.onShaderError = () => { throw new Error('Shader compilation failed'); };
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (src) => {
    const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src);
    t.anisotropy = maxAniso; t.needsUpdate = true;
    return t;
  };

  const scene = new THREE.Scene();
  const surface = film.theme.surface;
  const faceMaterial=(map,material='matte')=>material==='matte'?new THREE.MeshBasicMaterial({map}):new THREE.MeshPhysicalMaterial({map,metalness:material==='metal'?.42:0,roughness:material==='metal'?.38:.18,clearcoat:material==='glass'?.65:0,transmission:material==='glass'?.2:0,thickness:14,ior:1.46,envMapIntensity:material==='metal'?.045:.025});
  let environment = null;
  let appearanceKey = null;
  if (surface || CARDS.some(c=>c.face)) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environment = pmrem.fromScene(room, 0.06);
    scene.environment = environment.texture;
    room.dispose(); pmrem.dispose();
    const face=CARDS.find(c=>c.face)?.face;
    const key = new THREE.DirectionalLight(surface?.key || '#fff4e6', 0.45); key.position.set(face?((face.light??face.colors.lightPosition??28)/100-.5)*9000:-2500, 4000, 4500); scene.add(key);appearanceKey=key;
    const fill = new THREE.DirectionalLight(surface?.fill || '#e1dad2', 0.2); fill.position.set(4000, 600, -1800); scene.add(fill);
    scene.add(new THREE.HemisphereLight(surface?.key || '#fff4e6', ST.bg, 0.25));
  }
  const BG = new THREE.Color(ST.bg);
  const BG_KIT = new THREE.Color(ST.kitFog);   // 拆包时雾的颜色：贴近幕布中段，后面的环融进去而不是变成黑块
  // 环越大，远端离镜头越远；雾的远端跟着放，让环远端的牌保持同样的可见度（22 张牌时 = 9500）
  const FOG_RING = 2600 + Math.max(600, (2 * C.RING - 1410) / 0.5058);
  scene.fog = new THREE.Fog(BG, 2600, 9500);
  const camera = new THREE.PerspectiveCamera(42, W / H, 20, 80000);
  scene.add(camera);
  let opticalStage = null;
  let glassRibbon = null;
  if (ST.mode === 'glass' && !background.image) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-10000, -5500, 0), new THREE.Vector3(-2800, -3200, 200),
      new THREE.Vector3(2800, -2350, 400), new THREE.Vector3(6200, -500, 100),
      new THREE.Vector3(6500, 6500, -300),
    ]);
    const geometry = new THREE.TubeGeometry(curve, 128, 440, 20, false);
    geometry.scale(1, 1, 0.36);
    const material = new THREE.MeshPhysicalMaterial({ color: '#f5f0ed', metalness: 0, roughness: 0.13, transmission: 0.96, thickness: 220, ior: 1.46, clearcoat: 0.25, envMapIntensity: 0.045, fog: false });
    glassRibbon = new THREE.Mesh(geometry, material);
    glassRibbon.position.z = -12500;
    camera.add(glassRibbon);
  }

  // 背景固定在画面空间，替换图片不影响卡片轨道和镜头；cover 保持宽高比
  {
    const [c, g] = X.canvas(W, H);
    if (background.image) {
      const image = images[background.image];
      const scale = Math.max(W / image.width, H / image.height);
      const w = image.width * scale, h = image.height * scale;
      g.drawImage(image, (W - w) / 2, (H - h) / 2, w, h);
    } else if (ST.mode === 'studio') {
      g.fillStyle = ST.bg; g.fillRect(0, 0, W, H);
      // 大面积柔光与低位反射形成抽象摄影棚空间，沿用原片的暗场留白。
      const pool = (x, y, sx, sy, stops) => {
        g.save(); g.translate(x * W, y * H); g.scale(sx * W, sy * H);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        stops.forEach(([offset, color]) => gr.addColorStop(offset, color));
        g.fillStyle = gr; g.fillRect(-3, -3, 6, 6); g.restore();
      };
      pool(0.52, 0.48, 0.82, 0.88, [[0, ST.backdrop[0]], [0.5, ST.backdrop[1]], [1, ST.backdrop[2]]]);
      pool(0.85, 0.08, 0.65, 0.9, [[0, `rgba(${ST.glow[0]},0.10)`], [1, `rgba(${ST.glow[0]},0)`]]);
      pool(0.38, 0.92, 0.8, 0.22, [[0, `rgba(${ST.glow[1]},0.10)`], [1, `rgba(${ST.glow[1]},0)`]]);
    } else {
      const gr = g.createRadialGradient(W / 2, H * 120 / 288, W * 10 / 512, W / 2, H * 150 / 288, W * 330 / 512);
      gr.addColorStop(0, ST.backdrop[0]); gr.addColorStop(0.45, ST.backdrop[1]); gr.addColorStop(1, ST.backdrop[2]);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    g.fillStyle = `rgba(0,0,0,${background.dim || 0})`; g.fillRect(0, 0, W, H);
    const d = 60000, hh = 2 * d * Math.tan(rad(21));
    if (ST.mode === 'glass' && !background.image) opticalStage = glassStage();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(hh * (W / H), hh), opticalStage?.material ||
      new THREE.MeshBasicMaterial({ map: tex(c), fog: false, depthTest: false, depthWrite: false }));
    m.position.z = -d; m.renderOrder = -10;
    camera.add(m);
  }
  // 地面上的一圈光
  {
    const [c, g] = X.canvas(512, 512);
    const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    gr.addColorStop(0, `rgba(${ST.glow[0]},0.30)`); gr.addColorStop(0.5, `rgba(${ST.glow[1]},0.10)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(11000, 11000),
      new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = -90; m.renderOrder = -5;
    m.visible = background.glow !== false;
    scene.add(m);
  }
  // 浮尘
  const dust = (() => {
    const n = 520, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (hash(i * 3 + 1) - 0.5) * 9000;
      pos[i * 3 + 1] = hash(i * 3 + 2) * 3200 - 300;
      pos[i * 3 + 2] = (hash(i * 3 + 3) - 0.5) * 10500;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const [c, g] = X.canvas(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${ST.dust},1)`); gr.addColorStop(1, `rgba(${ST.dust},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex(c), size: 20, transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    p.visible = background.particles !== false;
    scene.add(p);
    return p;
  })();

  // 牌：正面是图片（没有图片就用代表色和大字），背面是代表色和编号，下面挂一条名字；最后一张是字标牌
  const geoCard = X.roundedGeo(THREE, CW, CH, 22);
  const geoBody = surface ? X.roundedBody(THREE, CW, CH, 22) : null;
  const geoLabel = new THREE.PlaneGeometry(CW * 1.25, 70);
  const logo = film.brand.logo ? images[film.brand.logo] : null;
  const cards = [];
  for (let i = 0; i < C.N; i++) {
    const brand = i === C.BRAND, card = brand ? null : CARDS[i];
    const g = new THREE.Group();
    const styledFront = card?.face && card.front !== 'image';
    const frontMap = tex(brand ? X.brandCanvas(logo) : styledFront ? faceCanvas(card, images[card.face.icon]) : card.img ? (card.rim ? X.rimCanvas(images[card.img]) : images[card.img]) : X.textFrontCanvas(card));
    const fm = styledFront ? faceMaterial(frontMap, card.face.material || card.face.colors.material) : new THREE.MeshBasicMaterial({ map: frontMap });
    const backMap = tex(brand ? X.brandBackCanvas(logo) : X.backCanvas(card));
    const style = card?.backStyle;
    const bm = card?.face?faceMaterial(backMap,card.face.material||card.face.colors.material):style ? new THREE.MeshPhysicalMaterial({ map: backMap, metalness: style.metalness, roughness: style.roughness, clearcoat: style.material === 'glass' ? 0.5 : 0, transmission: style.material === 'glass' ? 0.18 : 0, thickness: 12, ior: 1.46, envMapIntensity: style.material === 'glass' ? 0.08 : 0.035 }) : surface?.glass ? new THREE.MeshBasicMaterial({ map: backMap, transparent: true, depthWrite: false }) : surface ? new THREE.MeshPhysicalMaterial({ map: backMap, metalness: surface.metalness, roughness: surface.roughness, clearcoat: 0, envMapIntensity: 0.06 }) : new THREE.MeshBasicMaterial({ map: backMap });
    if (surface?.glass && !style) bm.userData.keepTransparent = true;
    const edge = style ? new THREE.MeshPhysicalMaterial({ color: style.edge, metalness: style.metalness, roughness: style.roughness, transmission: style.material === 'glass' ? 0.6 : 0, thickness: 18, ior: 1.46, clearcoat: 0.4, envMapIntensity: 0.24 }) : surface?.glass ? new THREE.MeshPhysicalMaterial({ color: '#eff1ff', metalness: 0, roughness: 0.12, transmission: 0.9, thickness: 18, ior: 1.46, attenuationColor: '#d7cff0', attenuationDistance: 240, clearcoat: 0.7, envMapIntensity: 0.25 }) : surface ? new THREE.MeshPhysicalMaterial({ color: surface.edge, metalness: 0.8, roughness: 0.32, envMapIntensity: 0.28 }) : null;
    const front = new THREE.Mesh(geoCard, fm);
    const back = new THREE.Mesh(geoCard, bm);
    back.rotation.y = Math.PI; back.position.z = surface ? -6.2 : -1.5;
    if (surface) { front.position.z = 0.2; g.add(new THREE.Mesh(geoBody, edge)); }
    g.add(front, back);
    let lm = null;
    if (!brand) {
      lm = new THREE.MeshBasicMaterial({ map: tex(labelCanvas(card)), transparent: true, opacity: 0, depthWrite: false, fog: false });
      const label = new THREE.Mesh(geoLabel, lm);
      label.position.set(0, -CH / 2 - 58, 2); label.renderOrder = 5;
      g.add(label);
    }
    scene.add(g);
    const faceGain=card?.face&&(card.face.material||card.face.colors.material)!=='matte'?.72:1;
    cards.push({ g, fm, bm, lm, edge, front, back, frontGain: styledFront ? faceGain : 1, backGain:card?.face ? faceGain : style?.id === 'berry' ? 0.65 : 1 });
  }
  const kit = buildKit(THREE, scene, images, tex);
  const inspectionGroup=new THREE.Group();inspectionGroup.visible=false;scene.add(inspectionGroup);
  let inspection=null,inspectionSignature='';

  function setState(t) {
    opticalStage?.update(t);
    const cam = C.camera(t);
    camera.position.set(cam.p[0], cam.p[1], cam.p[2]);
    camera.lookAt(cam.g[0], cam.g[1], cam.g[2]);
    const P = C.ringParams(t);
    const kd = C.kitDim(t);
    if (glassRibbon) {
      const end = smooth(13.0, 13.7, t);
      glassRibbon.rotation.z = 0.022 * Math.sin(t * 0.12);
      glassRibbon.position.x = 1700 * kd + 1000 * end;
      glassRibbon.position.y = 50 * Math.sin(t * 0.15) - 1500 * kd - 1000 * end;
    }
    // 拆包时雾收近：后面的环沉进背景里，只剩一点轮廓
    scene.fog.near = lerp(lerp(2600, 5200, P.v), 1700, kd);
    scene.fog.far = lerp(lerp(lerp(9500, FOG_RING, P.m), 16000, P.v), 3950, kd);
    scene.fog.color.copy(BG).lerp(BG_KIT, kd);
    const hw = clamp(C.heroW(t));
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i], pose = C.cardPose(i, t);
      c.g.visible = !(surface && i !== C.HERO && kd > 0.999);
      c.g.position.set(pose.p[0], pose.p[1], pose.p[2]);
      c.g.quaternion.set(pose.q[0], pose.q[1], pose.q[2], pose.q[3]);
      c.g.scale.setScalar(pose.s);
      const dim = i === C.HERO ? 1 : 1 - 0.5 * kd;
      c.fm.color.setScalar(dim * c.frontGain); c.bm.color.setScalar(dim * c.backGain);
      if (i !== C.HERO) {
        // 只在拆包这一幕走透明通道，其余时间牌是实心的
        const tr = kd > 0.002;
        for (const material of [c.fm, c.bm, c.edge].filter(Boolean)) {
          const transparent = tr || material.userData.keepTransparent === true;
          if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
          // 淡出的面不能继续挡住地面光和玻璃的透射，否则会留下方形残影。
          material.depthWrite = !transparent;
        }
        // 图片背景没有可匹配的单色雾面，拆解时将远牌完全淡出，避免实色方块
        c.fm.opacity = 1 - (background.image || surface ? 1 : 0.74) * kd; c.bm.opacity = c.fm.opacity;
        if (c.edge) c.edge.opacity = c.fm.opacity;
      }
      if (c.lm) {
        const f = C.ringPose(i, t).front;
        const o = f * f * P.pop * (1 - kd) * (i === C.HERO ? 1 - hw : 1);
        c.lm.opacity = o; c.lm.visible = o > 0.004;
      }
    }
    kit.update(t);
    dust.rotation.y = t * 0.015; dust.position.y = t * 14;
  }

  // 运动模糊：子帧累加到半浮点缓冲，再叠加可配置暗角；不添加颗粒
  const rtScene = new THREE.WebGLRenderTarget(W, H, { samples: 4, depthBuffer: true });
  const rtAcc = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const addMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: rtScene.texture }, k: { value: 1 } }, vertexShader: vs,
    fragmentShader: 'uniform sampler2D map; uniform float k; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(map, vUv).rgb * k, 1.0); }',
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    depthTest: false, depthWrite: false,
  });
  const outMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: rtAcc.texture }, vignette: { value: background.vignette ?? 0.42 } }, vertexShader: vs,
    fragmentShader: `uniform sampler2D map; uniform float vignette; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(map, vUv).rgb;
        vec2 d = vUv - 0.5; d.x *= 1.25;
        c *= 1.0 - vignette * smoothstep(0.32, 0.86, length(d));
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const addQuad = new THREE.Mesh(quadGeo, addMat), outQuad = new THREE.Mesh(quadGeo, outMat);
  addQuad.frustumCulled = false; outQuad.frustumCulled = false;

  function render(t, inspectionTilt = { x: 0, y: 0 }) {
    kit.frame(t);
    const SUB = subCount(t);
    addMat.uniforms.k.value = 1 / SUB;
    renderer.setRenderTarget(rtAcc); renderer.setClearColor(0x000000, 1); renderer.clear();
    for (let k = 0; k < SUB; k++) {
      setState(t + ((k + 0.5) / SUB - 0.5) * SHUTTER * smooth(0, 0.25, t));   // 第 0 帧是封面：快门从 0 开到位，封面是清楚的
      inspectionGroup.visible=Boolean(inspection);
      if(inspection){
        cards.forEach(c=>{c.g.visible=false;});camera.position.set(0,0,650);camera.lookAt(0,0,0);
        inspectionGroup.position.set(inspectionTilt.x*4,-inspectionTilt.y*3,0);
        inspectionGroup.rotation.set(.025-inspectionTilt.y*.12, (inspection.side==='back'?Math.PI+.08:-.08)+inspectionTilt.x*.22, -.008-inspectionTilt.x*.012);
      }
      const hidden=inspection?scene.children.filter(o=>o!==inspectionGroup&&!o.isCamera&&!o.isLight).map(o=>[o,o.visible]):[];
      hidden.forEach(([o])=>{o.visible=false;});
      renderer.setRenderTarget(rtScene); renderer.setClearColor(BG, 1); renderer.clear();
      renderer.render(scene, camera);
      hidden.forEach(([o,visible])=>{o.visible=visible;});
      renderer.setRenderTarget(rtAcc);
      renderer.render(addQuad, ortho);
    }
    renderer.setRenderTarget(null); renderer.clear();
    renderer.render(outQuad, ortho);
  }
  let appearanceSignature=null;
  function setInspection(options){
    inspection=options;if(!options){inspectionGroup.visible=false;return;}
    const p=options.palette,material=options.material==='auto'?(p.material||'matte'):options.material||'matte';
    if(appearanceKey)appearanceKey.position.x=((options.light??28)/100-.5)*9000;
    const signature=JSON.stringify([p.id,options.layout,options.back,material]);if(signature===inspectionSignature)return;inspectionSignature=signature;
    while(inspectionGroup.children.length){const mesh=inspectionGroup.children[0];mesh.material.map?.dispose();mesh.material.dispose();inspectionGroup.remove(mesh);}
    const original=CARDS.find(card=>card.face);if(!original)return;
    const card={...original,face:{...original.face,colors:p,layout:options.layout,back:options.back,material}};
    const frontMaterial=faceMaterial(tex(faceCanvas(card,images[original.face.icon])),material),backMaterial=faceMaterial(tex(X.backCanvas(card)),material);
    const gain=material==='matte'?1:.72;frontMaterial.color.setScalar(gain);backMaterial.color.setScalar(gain);
    const front=new THREE.Mesh(geoCard,frontMaterial),back=new THREE.Mesh(geoCard,backMaterial);front.position.z=.2;back.rotation.y=Math.PI;back.position.z=-1.5;inspectionGroup.add(front,back);
  }
  function setAppearance({palette, palettes, seed=0, layout, back, material='auto', light=28}) {
    const selected=palettes||[palette],pool=Object.fromEntries(selected.map(p=>[p.id,p]));
    const distribution=distributeCards(CARDS.map(c=>c.id||c.no),selected.map(p=>p.id),seed);
    if(appearanceKey)appearanceKey.position.x=(light/100-.5)*9000;
    const signature=JSON.stringify([selected.map(p=>p.id),seed,layout,back,material]);if(signature===appearanceSignature)return;appearanceSignature=signature;
    for (let i=0;i<CARDS.length;i++) {
      const card=CARDS[i]; if (!card.face) continue;
      const p=pool[distribution.assignments[card.id||card.no]],surfaceMaterial=material==='auto'?(p.material||'matte'):material;
      Object.assign(card.face,{colors:p,palette:p.id,layout,back,material:surfaceMaterial,light});
      const item = cards[i];
      const gain = surfaceMaterial === 'matte' ? 1 : .72;
      if (card.front !== 'image') {
        item.fm.map?.dispose(); item.fm.dispose();
        item.fm = faceMaterial(tex(faceCanvas(card, images[card.face.icon])), surfaceMaterial);
        item.front.material = item.fm; item.frontGain = gain;
      }
      item.bm.map?.dispose(); item.bm.dispose();
      item.bm = faceMaterial(tex(X.backCanvas(card)), surfaceMaterial);
      item.back.material = item.bm; item.backGain = gain;
    }
    film.brand.paper=selected[0].light;film.brand.ink=selected[0].ink;film.brand.back=selected[0].papers[0];
    const brand=cards[C.BRAND];brand.fm.map?.dispose();brand.bm.map?.dispose();brand.fm.map=tex(X.brandCanvas(logo));brand.bm.map=tex(X.brandBackCanvas(logo));
  }
  return { render, renderer, setAppearance, setInspection, dispose: () => { rtScene.dispose(); rtAcc.dispose(); environment?.dispose(); geoBody?.dispose(); glassRibbon?.geometry.dispose(); glassRibbon?.material.dispose(); renderer.dispose(); } };
}

// 牌下面的名字：编号 + 名字 + 补充说明；太长就整行缩小
function labelCanvas(card) {
  const [c, g] = X.canvas(1600, 140);
  g.textBaseline = 'middle';
  const parts = [
    [card.no, `600 44px ${X.FONT.MONO}`, X.HL],
    [card.title, `800 62px ${X.FONT.SANS}`, '#fffdf8'],
    [card.sub || '', `500 40px ${X.FONT.LATIN}`, 'rgba(255,253,248,0.66)'],
  ].filter((p) => p[0]);
  let total = 0;
  for (const p of parts) { g.font = p[1]; p.push(g.measureText(p[0]).width); total += p[3]; }
  total += 28 * (parts.length - 1);
  const k = Math.min(1, 1540 / total);
  g.translate(800, 74); g.scale(k, k);
  let x = -total / 2;
  for (const p of parts) { g.font = p[1]; g.fillStyle = p[2]; g.fillText(p[0], x, 0); x += p[3] + 28; }
  return c;
}
