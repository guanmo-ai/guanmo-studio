// 全片编排：每个量都是时间 t（秒）的纯函数。拍点 = 0.5 s（120 BPM），小节 = 2 s。
import { clamp, lerp, ph, eio, eo3, eo5, snap, rad, v3, qyxz, qrot, qslerp, blendPose, smooth } from './lib.js';

const TAU = Math.PI * 2;
const DH = TAU / 7.3;         // 螺旋里相邻两张牌的夹角（固定；牌多就多绕几圈）
export const STEPS = [2.5, 3.0, 3.5, 4.0, 4.5];
// 以下几个量由 setup(牌的总数, 每拍转几张) 决定。默认值 = 21 张内容牌 + 1 张字标牌、每拍转 3 张。
// N 牌的总数；BRAND 字标牌的槽位（最后一张）；HERO 被拆开的那张牌的槽位；K 每拍转几张；
// DR 环上相邻两张牌的夹角；RING 环的半径；DZ 相对默认半径的差（镜头和拆包位置跟着平移）。
export let N = 22, BRAND = 21, HERO = 18, K = 3, DR = TAU / 22, RING = 2450, DZ = 0;
export let KIT = [0, 500, 3100];   // 拆包时主角牌停在哪
let PITCH_H = 72, PITCH_V = 50, LAND = 0.05, BURST = 0.046, CAM = [];
export const T = { ring: 2.0, spin: 5.0, hero: 6.0, pack: 10.25, riser: 10.6, slam: 13.5, seal: 14.0, end: 15 };

// 旋转木马的转角。slow=true 是牌面朝向用的版本：晚 45 ms、带过冲，牌身先到、牌面甩回来。
export function theta(t, slow = false) {
  const d = slow ? 0.045 : 0;
  let th = 0.85 * TAU * (1 - eo3(ph(t, -0.7, 2.0)));
  for (const b of STEPS) {
    if (slow) {
      const x = t - d - (b - 0.04);
      th -= K * DR * (x <= 0 ? 0 : 1 - Math.exp(-13 * x) * Math.cos(17 * x));
    } else th -= K * DR * snap(ph(t, b - 0.04, b + 0.3));
  }
  th += 0.4 * DR * eio(ph(t - d, 4.7, 5.0));               // 起势：先往回拧
  th -= (N + K + 0.4) * DR * snap(ph(t - d, 5.0, 6.02));   // 一整圈 + K 张，正好落在主角牌
  if (slow) { const x = t - 5.96; if (x > 0) th += 0.5 * DR * Math.exp(-7 * x) * Math.sin(15 * x); }
  th -= (3 * TAU / 22) * eio(ph(t, 6.1, 10.7));            // 拆包时背景的环继续慢慢转
  th -= 2.1 * TAU * Math.pow(ph(t - d, 10.6, 13.7), 2.3);  // 收束：越转越快
  return th;
}
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

export function ringParams(t) {
  const m = eio(ph(t, 0.62, 2.0));    // 螺旋 → 环
  const v = eio(ph(t, 10.7, 12.7));   // 环 → 漩涡
  return {
    m, v,
    D: lerp(lerp(DH, DR, m), DH, v),
    R: lerp(lerp(672, RING, m), 880, v),
    ks: lerp(0.9, 1, m),
    pitch: lerp(lerp(PITCH_H, 0, m), PITCH_V, v),
    y0: lerp(lerp(260, 300, m), 210, v),
    pop: smooth(1.8, 2.1, t) * (1 - smooth(10.5, 10.9, t)),
  };
}
// 拆包时整个环往后退、暗下去，把舞台让给零件
export const kitDim = (t) => smooth(5.85, 6.35, t) * (1 - smooth(10.42, 11.0, t));
export function ringPose(i, t) {
  const P = ringParams(t);
  const kd = kitDim(t);
  const thF = theta(t), thS = theta(t, true);
  const aF = thF + i * P.D, aS = thS + i * P.D;
  const front = Math.max(0, 1 - Math.abs(wrap(aF)) / DR);
  const pop = P.pop * front * front;
  const R = P.R + 150 * pop;
  const w = (theta(t + 0.004) - theta(t - 0.004)) / 0.008;   // 角速度 → 往运动方向倾
  return {
    p: [R * Math.sin(aF), P.y0 + i * P.pitch + 26 * pop - 90 * kd, R * Math.cos(aF) - 1700 * kd],
    q: qyxz(aS, 0, clamp(-w * 0.012, -0.22, 0.22)),
    s: (1 + 0.07 * pop) * P.ks,
    front,
  };
}

// 牌堆：j = 从顶往下第几张
const deckOrder = (i) => (i === BRAND ? 0 : i + 1);
function deckPose(j, c, yaw, pitch, s, gap, push = 0) {
  const q = qyxz(yaw, pitch, 0);
  const n = qrot(q, [0, 0, 1]);
  return { p: v3.add(c, v3.mul(n, -j * gap * s - push)), q, s };
}
function deck0(i) { return deckPose(deckOrder(i), [0, 1050, 0], rad(-19), rad(-4), 1, 8); }
export function deck1(i, t) {
  const x = t - T.slam, x2 = t - T.seal;
  const yaw = rad(26 + 210 * (1 - eo3(ph(t, 11.9, 13.9))) + 5.5 * Math.max(0, x));
  const gap = 9 * (x < 0 ? 1.6 : 1 + 0.6 * Math.exp(-10 * x) * Math.cos(21 * x));
  let push = x > 0 ? 70 * Math.exp(-7 * x) * Math.sin(17 * x) : 0;
  if (x2 > 0) push += 26 * Math.exp(-9 * x2) * Math.sin(20 * x2);
  return deckPose(deckOrder(i), [0, 520, 0], yaw, rad(-5), 1.3, gap, push);
}

// 停下来以后也不死：整张牌慢慢呼吸、左右微微摆
const heroKitPose = (t) => ({
  p: v3.add(KIT, [-440 + 5 * Math.sin(t * 1.1 + 0.6), 150 + 7 * Math.sin(t * 1.7), 0]),
  q: qyxz(rad(4.5 * Math.sin(t * 1.25 + 1.0)), rad(2.2 * Math.sin(t * 0.9)), rad(0.8 * Math.sin(t * 1.4 + 2.0))),
  s: 1.125,
});
export const heroW = (t) => {
  const a = ph(t, 5.98, 6.55), b = ph(t, 10.42, 10.95);
  const back = 1 + 1.7 * Math.pow(a - 1, 3) + 0.7 * Math.pow(a - 1, 2);
  return (a <= 0 ? 0 : back) * (1 - eio(b));
};

export function cardPose(i, t) {
  let pose = ringPose(i, t);
  if (t < 3) {                                    // 开场：牌堆炸成螺旋
    const j = deckOrder(i), t0 = -1.0 + j * BURST;
    const w = eo5(ph(t, t0, t0 + 0.8));
    if (w < 1) pose = blendPose(deck0(i), pose, w);
  } else if (t > 11) {                            // 收束：漩涡一张张落回牌堆
    const land = T.slam - deckOrder(i) * LAND;
    const u = ph(t, land - (i === BRAND ? 1.05 : 0.7), land);
    if (u > 0) {
      // 先转正、对准自己的位置，再从牌堆正面拍下去：后落的牌永远在先落的牌前面，不会互相穿过
      const dk = deck1(i, t), n = qrot(dk.q, [0, 0, 1]);
      const wp = smooth(0, 0.78, u), wq = smooth(0, 0.62, u);
      const lift = (i === BRAND ? 520 : 390) * smooth(0, 0.4, u) * (1 - u * u);
      pose = { p: v3.add(v3.mix(pose.p, dk.p, wp), v3.mul(n, lift)), q: qslerp(pose.q, dk.q, wq), s: lerp(pose.s, dk.s, wp) };
    }
  }
  if (i === HERO) { const w = heroW(t); if (w !== 0) pose = blendPose(pose, heroKitPose(t), w); }
  return pose;
}

// 镜头：若干段缓动位移叠加，段与段重叠，所以从不停顿、速度连续
// 环的半径变了，镜头和拆包的位置跟着前后平移（z）；俯视镜头按半径拉高
function buildCam() {
  const z = DZ, s = clamp(RING / 2450, 0.55, 1.6);
  return [
    { a: -9, b: -8, p: [-990, 820, 2600], g: [-715, 1010, 0] },
    { a: -0.6, b: 1.7, p: [-720, 900, 2380], g: [-620, 1040, 0] },
    { a: 0.6, b: 2.1, p: [150, 660, 3640 + z], g: [150, 300, 2450 + z] },
    { a: 2.0, b: 4.9, p: [150, 630, 3540 + z], g: [150, 300, 2450 + z] },
    { a: 4.75, b: 5.5, p: [150, 690, 3780 + z], g: [150, 320, 2450 + z] },
    { a: 5.45, b: 6.6, p: [-110, 545, 4650 + z], g: [0, 500, 3100 + z] },
    { a: 6.4, b: 10.4, p: [80, 565, 4480 + z], g: [0, 500, 3100 + z] },
    { a: 10.25, b: 11.9, p: [0, 2500 * s, 5300 * s], g: [0, 330, 0] },
    { a: 12.0, b: 13.62, p: [430, 560, 2050], g: [560, 500, 0] },
    { a: 13.5, b: 15.6, p: [505, 540, 1850], g: [560, 500, 0] },
  ];
}
export function camera(t) {
  let p = CAM[0].p, g = CAM[0].g;
  for (let k = 1; k < CAM.length; k++) {
    const e = eio(ph(t, CAM[k].a, CAM[k].b));
    if (e <= 0) continue;
    p = v3.add(p, v3.mul(v3.sub(CAM[k].p, CAM[k - 1].p), e));
    g = v3.add(g, v3.mul(v3.sub(CAM[k].g, CAM[k - 1].g), e));
  }
  // 三次“咚”：只往前顶一下，不来回颤
  let kick = 0;
  for (const [tk, amp] of [[T.hero, 38], [T.slam, 60], [T.seal, 26]]) {
    const x = t - tk; if (x > 0) kick += amp * Math.exp(-9 * x) * Math.sin(Math.min(x * 14, Math.PI));
  }
  if (kick) { const d = v3.sub(g, p), L = Math.hypot(...d); p = v3.add(p, v3.mul(d, kick / L)); }
  return { p, g, fov: 42 };
}
// 字幕转轮要用：当前正对镜头的是第几张（浮点）
export const frontIndex = (t) => -theta(t) / DR;


// 牌的总数（含字标牌）和每拍转几张。主角牌固定在第 6×K 个槽位：五拍之后再转一整圈 + K 张，正好停在它上面。
export function setup(n, k) {
  N = n; BRAND = n - 1; K = k; HERO = (6 * k) % n; DR = TAU / n;
  RING = Math.round((n * 70) / TAU) * 10;      // 每张牌占 700 宽；22 张 → 2450
  DZ = RING - 2450;
  KIT = [0, 500, 3100 + DZ];
  PITCH_H = 1584 / n; PITCH_V = 1100 / n;      // 螺旋、漩涡的总高度不随张数变
  LAND = 1.05 / (n - 1); BURST = 0.966 / (n - 1);
  CAM = buildCam();
}
setup(22, 3);
