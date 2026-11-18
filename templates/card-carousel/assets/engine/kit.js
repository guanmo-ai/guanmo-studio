// “拆开一张牌”：主角牌停在左边，它的东西一件件弹出来排在右边和下面，10.2 秒收回牌里。
// 所有零件都在同一个朝向镜头的平面上（中心 = C.KIT），坐标单位 ≈ 1.08 像素。
// 版式固定：左栏 = 主角牌 + 牌下一行字 + 打字面板；右栏 = 一排小图 + 三行（圆点 / 标签 / 等宽标签）。
import { clamp, ph, back, ei3, rad, hash, v3 } from './lib.js';
import * as C from './choreo.js';
import { film } from './data.js';
import * as X from './tex.js';

const PACK = 10.2;
const ROW_W = 770;                                   // 右栏一行最多这么宽，超了整行缩小
// 右栏三行各自的：标题 y、内容 y、出现时刻
const SLOTS = [{ cap: 60, y: -4, a: 7.0 }, { cap: -101, y: -160, a: 7.5 }, { cap: -251, y: -308, a: 9.0 }];

export function buildKit(THREE, scene, images, tex) {
  const K = film.kit;
  const parts = [];
  let src = 'card';   // 'card' = 从牌背后飞出来；'near' = 在自己这一行就近弹出
  const add = (mesh, x, y, a, tilt = 0, fade = false, k = 1) => {
    mesh.material.fog = false;
    if (fade) { mesh.material.transparent = true; mesh.material.depthWrite = false; }
    mesh.visible = false; mesh.renderOrder = fade ? 8 : 6;
    scene.add(mesh);
    parts.push({ mesh, x, y, a, tilt, fade, src, k, n: parts.length });
    return mesh;
  };
  const plane = (w, h, canvasEl) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(canvasEl) }));
  const pill = (w, h, canvasEl, r = h / 2) => new THREE.Mesh(X.roundedGeo(THREE, w, h, r), new THREE.MeshBasicMaterial({ map: tex(canvasEl) }));
  const caption = (main, sub, xLeft, y, a) => {
    const w = 640, h = 46, s = 1.12;
    const m = plane(w * s, h * s, X.captionCanvas(main, sub, w, h));
    add(m, xLeft + (w * s) / 2, y, a, 0, true);
  };

  // 左栏：牌下面的一行字
  if (K.under) caption(K.under[0], K.under[1] || '', -800, -92, 6.18);

  // 右栏顶：一排竖版小图（图片，或一个大字 + 一行小字）
  K.tiles.items.forEach((s, i) => {
    const map = s.img ? tex(images[s.img]) : tex(X.tileCanvas(s, i));
    const m = new THREE.Mesh(X.roundedGeo(THREE, 160, 200, 8), new THREE.MeshBasicMaterial({ map }));
    add(m, 120 + i * 186, 226, 6.5 + i * 0.07, rad(i % 2 ? 2.2 : -2.2));
  });
  caption(K.tiles.title, K.tiles.sub || K.tiles.items.map((s) => s.label).filter(Boolean).join(' · '), 40, 358, 6.46);

  // 一行标签：量宽度，超了整行缩小；最后一行放不下时折成两行
  const chipRow = (items, slot, opt) => {
    const widths = items.map((t, i) => X.chipWidth(opt.lead ? opt.lead(i) : null, t, opt.mono));
    const total = (ws) => ws.reduce((s, w) => s + w, 0) + 12 * (ws.length - 1);
    let rows = [items.map((_, i) => i)];
    if (opt.wrap && total(widths) > ROW_W && items.length > 1) {
      let best = 1, bestW = Infinity;                 // 在让两行最宽者最窄的地方断开
      for (let c = 1; c < items.length; c++) {
        const m = Math.max(total(widths.slice(0, c)), total(widths.slice(c)));
        if (m < bestW) { bestW = m; best = c; }
      }
      rows = [rows[0].slice(0, best), rows[0].slice(best)];
    }
    let n = 0;
    rows.forEach((row, r) => {
      const k = Math.min(1, ROW_W / total(row.map((i) => widths[i])));
      let x = 40;
      row.forEach((i) => {
        const w = widths[i], lead = opt.lead ? opt.lead(i) : null;
        const m = pill(w, opt.h, X.chipCanvas(lead, items[i], w, opt.h, opt.mono), opt.r);
        add(m, x + (w * k) / 2, slot.y - r * (opt.h + 10), slot.a + 0.04 + n * opt.dt, opt.tilt ? rad(i % 2 ? -1.5 : 1.5) : 0, false, k);
        x += (w + 12) * k; n++;
      });
    });
  };
  const row = (spec, slot, last) => {
    if (!spec) return;
    caption(spec.title, spec.sub || '', 40, slot.cap, slot.a);
    if (spec.kind === 'dots') {
      spec.items.forEach((hex, i) => {
        const ring = new THREE.Mesh(new THREE.CircleGeometry(31, 48), new THREE.MeshBasicMaterial({ color: X.PAPER }));
        const dot = new THREE.Mesh(new THREE.CircleGeometry(27, 48), new THREE.MeshBasicMaterial({ color: hex }));
        dot.position.z = 0.6; ring.add(dot);
        add(ring, 71 + i * 72, slot.y, slot.a + 0.04 + i * 0.03);
      });
      if (spec.chip) {
        const w = X.chipWidth(null, spec.chip, true);
        add(pill(w, 48, X.chipCanvas(null, spec.chip, w, 48, true)), 71 + (spec.items.length - 1) * 72 + 69 + w / 2, slot.y, slot.a + 0.3);
      }
    } else if (spec.kind === 'mono') {
      chipRow(spec.items, slot, { mono: true, h: 46, r: 10, dt: 0.055, wrap: last });
    } else {
      const numbered = spec.numbered !== false;
      chipRow(spec.items, slot, { h: 50, dt: 0.05, tilt: true, wrap: last, lead: numbered ? (i) => String(i + 1).padStart(2, '0') : null });
    }
  };

  src = 'near';
  row(K.rows[0], SLOTS[0], K.rows.length === 1);
  row(K.rows[1], SLOTS[1], K.rows.length === 2);

  // 左栏下：打字面板，8.1–10.12 秒逐字打出来
  const [pc, pg] = X.canvas(1440, 500);
  X.typingDraw(pc, pg, K.typing, 0);
  const typingTex = tex(pc);
  const panel = new THREE.Mesh(X.roundedGeo(THREE, 720, 250, 14), new THREE.MeshBasicMaterial({ map: typingTex }));
  src = 'card';
  add(panel, -440, -264, 8.0);
  src = 'near';
  let shown = -1;

  row(K.rows[2], SLOTS[2], true);

  function update(t) {
    const origin = C.cardPose(C.HERO, t).p;
    for (const p of parts) {
      if (t < p.a) { p.mesh.visible = false; continue; }
      const eIn = back(ph(t, p.a, p.a + 0.46));
      const q = ph(t, PACK + hash(p.n) * 0.06, PACK + 0.36 + hash(p.n) * 0.06);
      const eOut = ei3(q);                       // 位置：晚走
      const sOut = 1 - Math.pow(1 - q, 2.4);     // 大小：先缩
      if (q >= 1) { p.mesh.visible = false; continue; }
      p.mesh.visible = true;
      const rest = v3.add(C.KIT, [p.x, p.y, 3]);
      const card = v3.add(origin, [0, 0, -8]);
      const start = p.src === 'card' ? card : [rest[0] - 170, rest[1], rest[2]];
      // 入场：从起点弹到位；退场：全部飞回牌里
      const u = clamp(eIn, 0, 1.2);
      let x = start[0] + (rest[0] - start[0]) * u, y = start[1] + (rest[1] - start[1]) * u, z = start[2] + (rest[2] - start[2]) * Math.min(1, u);
      x += (card[0] - x) * eOut; y += (card[1] - y) * eOut; z += (card[2] - z) * eOut;
      // 落定以后轻轻浮动：一道沿着位置传播的波，同一行的东西保持对齐
      const fl = Math.min(1, eIn) * (1 - eOut);
      x += 2.2 * Math.sin(t * 1.3 + p.y * 0.012) * fl;
      y += 4.2 * Math.sin(t * 1.9 + p.x * 0.005 + p.y * 0.004) * fl;
      p.mesh.position.set(x, y, z);
      p.mesh.scale.setScalar(Math.max(0.001, p.k * (0.12 + 0.88 * eIn) * (1 - 0.97 * sOut)));
      p.mesh.rotation.z = p.tilt + (1 - Math.min(1, eIn)) * (p.n % 2 ? 0.5 : -0.5) + (p.n % 2 ? 0.22 : -0.22) * eOut;
      if (p.fade) p.mesh.material.opacity = clamp(eIn * 1.4) * (1 - sOut);
    }
  }
  // 每帧一次（不随子帧）：打到第几个字
  function frame(t) {
    const n = Math.floor(K.typing.text.length * ph(t, 8.1, 10.12));
    if (n !== shown) { shown = n; X.typingDraw(pc, pg, K.typing, n); typingTex.needsUpdate = true; }
  }
  return { update, frame };
}
