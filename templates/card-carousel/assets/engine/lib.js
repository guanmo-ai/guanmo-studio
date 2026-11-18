// 通用数学：缓动、向量、相机。所有状态都是时间的纯函数。
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const ph = (t, a, b) => clamp((t - a) / (b - a));
export const eio = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
export const eio5 = (u) => (u < 0.5 ? 16 * u ** 5 : 1 - Math.pow(-2 * u + 2, 5) / 2);
export const eo3 = (u) => 1 - Math.pow(1 - u, 3);
export const eo5 = (u) => 1 - Math.pow(1 - u, 5);
export const ei2 = (u) => u * u;
export const ei3 = (u) => u * u * u;
// 起步为零、很快冲出去、长收尾：峰值速度在 15% 处
export const snap = (u) => 1 - Math.pow(1 - Math.pow(u, 1.5), 4);
// 过冲约 6% 的落定
export const back = (u) => {
  const c = 1.1;
  return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
};
// 阻尼弹簧：0 → 1，过冲后抖回来
export const spring = (u, f = 9, d = 5.5) => (u <= 0 ? 0 : 1 - Math.exp(-d * u) * Math.cos(f * u));
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
// 确定性伪随机
export const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};
export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  mix: (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)],
};

// 相机：{p 位置, g 注视点, roll 度, f 焦距像素}
export const mixCam = (a, b, u) => ({
  p: v3.mix(a.p, b.p, u),
  g: v3.mix(a.g, b.g, u),
  roll: lerp(a.roll, b.roll, u),
  f: lerp(a.f, b.f, u),
});
// 世界容器要用的两个角（CSS rotateY / rotateX，弧度）
export const camAngles = (c) => {
  const v = v3.sub(c.g, c.p);
  const h = Math.hypot(v[0], v[2]);
  return { ry: Math.atan2(v[0], -v[2]), rx: Math.atan2(-v[1], h) };
};
export const camCss = (c) => {
  const { ry, rx } = camAngles(c);
  return `translateZ(${c.f.toFixed(2)}px) rotateZ(${(-c.roll).toFixed(3)}deg) rotateX(${deg(rx).toFixed(4)}deg) rotateY(${deg(ry).toFixed(4)}deg) translate3d(${(-c.p[0]).toFixed(2)}px,${(-c.p[1]).toFixed(2)}px,${(-c.p[2]).toFixed(2)}px)`;
};
// 世界点 → 视空间：返回 [屏幕x, 屏幕y, 深度]
export const project = (c, pt) => {
  const { ry, rx } = camAngles(c);
  const q = v3.sub(pt, c.p);
  const x1 = q[0] * Math.cos(ry) + q[2] * Math.sin(ry);
  const z1 = -q[0] * Math.sin(ry) + q[2] * Math.cos(ry);
  const y2 = q[1] * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = q[1] * Math.sin(rx) + z1 * Math.cos(rx);
  const d = -z2;
  return [(x1 * c.f) / d, (y2 * c.f) / d, d];
};

// 物体姿态：{p, ry, rx, rz 度, s 缩放}
export const mixPose = (a, b, u) => ({
  p: v3.mix(a.p, b.p, u),
  ry: lerp(a.ry, b.ry, u),
  rx: lerp(a.rx, b.rx, u),
  rz: lerp(a.rz, b.rz, u),
  s: lerp(a.s, b.s, u),
});
export const poseCss = (o) =>
  `translate3d(${o.p[0].toFixed(2)}px,${o.p[1].toFixed(2)}px,${o.p[2].toFixed(2)}px) rotateY(${o.ry.toFixed(3)}deg) rotateX(${o.rx.toFixed(3)}deg) rotateZ(${o.rz.toFixed(3)}deg) scale(${Math.max(0.0001, o.s).toFixed(4)})`;
// 姿态的法线（正面朝向）
export const normal = (o) => {
  const a = rad(o.ry), b = rad(o.rx);
  return [Math.cos(b) * Math.sin(a), -Math.sin(b), Math.cos(b) * Math.cos(a)];
};
// 颜色
export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mixRgb = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
export const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// 四元数 [x,y,z,w]，与 Three.js 同序
export const qaxis = (ax, ang) => {
  const s = Math.sin(ang / 2);
  return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)];
};
export const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qyxz = (yaw, pitch = 0, roll = 0) =>
  qmul(qmul(qaxis([0, 1, 0], yaw), qaxis([1, 0, 0], pitch)), qaxis([0, 0, 1], roll));
export const qrot = (q, v) => {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
};
export const qslerp = (a, b, u) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  if (d > 0.9995) {
    const r = [lerp(a[0], bb[0], u), lerp(a[1], bb[1], u), lerp(a[2], bb[2], u), lerp(a[3], bb[3], u)];
    const n = Math.hypot(...r);
    return r.map((x) => x / n);
  }
  const th = Math.acos(d), s = Math.sin(th);
  const ka = Math.sin((1 - u) * th) / s, kb = Math.sin(u * th) / s;
  return [a[0] * ka + bb[0] * kb, a[1] * ka + bb[1] * kb, a[2] * ka + bb[2] * kb, a[3] * ka + bb[3] * kb];
};
// 位姿 {p,q,s} 的混合
export const blendPose = (a, b, u) => ({ p: v3.mix(a.p, b.p, u), q: qslerp(a.q, b.q, u), s: lerp(a.s, b.s, u) });
export const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
