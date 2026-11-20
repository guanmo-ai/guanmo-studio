// 用法：node render.cjs <模板目录> <输出.mp4|proofs目录> [--w 1920 --h 1080 --fps 30 --scale 1 --audio x.wav --proof 0,1,2]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const args = process.argv.slice(2); const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const dir = path.resolve(args[0]), out = path.resolve(args[1]);
const W = +(opt('w') || 1920), H = +(opt('h') || 1080), fps = +(opt('fps') || 30), audio = opt('audio'), proof = opt('proof');
const root = dir;
const types = { '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.otf': 'font/otf', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => { const f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/index.html?w=${W}&h=${H}${opt('q') ? '&q=' + opt('q') : ''}`;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('response', r => r.status() >= 400 && !r.url().endsWith('favicon.ico') && errs.push(r.status() + ' ' + r.url()));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.evaluate(() => window.__proto.ready);
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  const dur = await p.evaluate(() => window.__proto.duration);
  if (opt('frames')) {
    const [a, z] = opt('frames').split('-').map(Number); fs.mkdirSync(out, { recursive: true });
    for (let i = a; i <= z; i++) { await p.evaluate(t => window.__proto.seek(t), i / fps); await p.screenshot({ path: path.join(out, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 97 }); }
  } else if (proof) {
    fs.mkdirSync(out, { recursive: true });
    for (const t of proof.split(',').map(Number)) { await p.evaluate(t => window.__proto.seek(t), t); await p.screenshot({ path: path.join(out, `t${t.toFixed(2)}.png`) }); }
  } else {
    const a = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', 'pipe:0'];
    if (audio) a.push('-i', audio, '-af', `apad,atrim=duration=${dur}`, '-c:a', 'aac', '-b:a', '256k');
    a.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-t', String(dur), '-movflags', '+faststart', out);
    const ff = spawn('ffmpeg', a, { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round(dur * fps), t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await p.evaluate(t => window.__proto.seek(t), i / fps);
      const buf = await p.screenshot({ type: 'jpeg', quality: 97 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % (fps * 3) === 0) console.log(`${i}/${n} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  if (errs.length) console.error('页面错误：' + errs.join('\n'));
  await b.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
