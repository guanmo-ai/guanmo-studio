const pending = [];
let meta;
export function installHost() {
  window.__studioErrors = [];
  window.addEventListener('error', e => window.__studioErrors.push(e.message));
  window.addEventListener('unhandledrejection', e => window.__studioErrors.push(String(e.reason)));
  window.TenrecMotionHost = {
    resourceUrl: (_root, name) => new URL(name, location.href).href,
    trackResource: promise => pending.push(promise),
    onDispose: fn => window.addEventListener('pagehide', fn, { once: true }),
  };
  window.__tenrecMotionFonts = { ready: Promise.all([
    document.fonts.load('900 48px "Noto Sans SC"', '观默设计风格'),
    document.fonts.load('400 48px "Instrument Serif"'),
    document.fonts.load('italic 400 48px "Instrument Serif"'),
    document.fonts.load('800 48px "Geist"'),
    document.fonts.load('600 48px "JetBrains Mono"'),
  ]) };
}

export async function finishLoading() {
  await Promise.all(pending);
  meta = await fetch('./studio.json').then(r => { if (!r.ok) throw new Error('studio.json 加载失败'); return r.json(); });
  async function seek(time) {
    if (!Number.isFinite(time)) throw new Error('时间必须是有限数字');
    const waits = [];
    window.dispatchEvent(new CustomEvent('hf-seek', { detail: { time: Math.max(0, Math.min(meta.duration - 1 / meta.fps, time)), waitUntil: promise => waits.push(promise) } }));
    await Promise.all(waits);
  }
  window.__studio = { ...meta, seek, ready: true };
  await seek(0);
  if (new URLSearchParams(location.search).has('render')) return;
  const stage = document.getElementById('stage');
  const controls = document.createElement('div');
  controls.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:56px;display:flex;align-items:center;gap:16px;padding:0 24px;background:#211d1b;color:#fffdf8;font:16px system-ui;box-sizing:border-box';
  controls.innerHTML = `<button type="button">播放</button><input aria-label="播放位置" type="range" min="0" max="${Math.round(meta.duration * meta.fps) - 1}" step="1" value="0" style="flex:1;accent-color:#c48d78"><span>0.00 / ${meta.duration.toFixed(2)}</span>`;
  document.body.append(controls);
  const [button, slider, timeLabel] = controls.children;
  const audio = meta.audio.map(item => { const a = new Audio(item.path); a.volume = item.volume; return a; });
  let playing = false, time = 0, start = 0;
  function resize() {
    const scale = Math.min(innerWidth / meta.width, (innerHeight - 56) / meta.height);
    stage.style.cssText += `;position:absolute;left:50%;top:${(innerHeight - 56) / 2}px;transform:translate(-50%,-50%) scale(${scale});transform-origin:center`;
  }
  resize(); window.addEventListener('resize', resize);
  function pause() { playing = false; button.textContent = '播放'; audio.forEach(a => a.pause()); }
  async function draw() {
    await seek(time); slider.value = Math.round(time * meta.fps); timeLabel.textContent = `${time.toFixed(2)} / ${meta.duration.toFixed(2)}`;
  }
  async function tick() {
    if (!playing) return;
    time = Math.min(meta.duration - 1 / meta.fps, (performance.now() - start) / 1000);
    await draw();
    if (time >= meta.duration - 1 / meta.fps) pause();
    else requestAnimationFrame(tick);
  }
  button.addEventListener('click', async () => {
    if (playing) return pause();
    if (time >= meta.duration - 1 / meta.fps) time = 0;
    start = performance.now() - time * 1000; playing = true; button.textContent = '暂停';
    for (const a of audio) { a.currentTime = Math.min(time, Number.isFinite(a.duration) ? a.duration : time); a.play().catch(() => {}); }
    requestAnimationFrame(tick);
  });
  slider.addEventListener('input', async () => { pause(); time = Number(slider.value) / meta.fps; await draw(); });
}
