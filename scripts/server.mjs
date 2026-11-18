import { containsPath } from './paths.mjs';
import http from 'node:http';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { readFile, realpath, mkdir, writeFile, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { validateSelection } from './selection.mjs';
import { readSavedSelection } from './saved-selection.mjs';

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
  '.otf': 'font/otf', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp4': 'video/mp4',
};
const blocked = new Set(['node_modules', '__pycache__']);
const inside = (root, file) => file !== root && containsPath(root, file);

export async function serve(directory, port = 0, { selectionFile } = {}) {
  const root = await realpath(directory);
  const server = http.createServer(async (req, res) => {
    const reply = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(value));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    try {
      // 只接受本机地址，阻止外站借 DNS rebinding 读取项目文件。
      const hosts = [`127.0.0.1:${server.address().port}`, `localhost:${server.address().port}`];
      if (!hosts.includes(req.headers.host) || req.headers['sec-fetch-site'] === 'cross-site') {
        reply(403, { error: '仅接受本机页面请求' }); return;
      }
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
      catch { reply(400, { error: '无效的文件地址' }); return; }
      if (pathname.includes('\0') || pathname.includes('\\')) { reply(400, { error: '无效的文件地址' }); return; }
      if (pathname === '/api/card-style-selection' && selectionFile) {
        if (req.method === 'GET') {
          try {
            const catalog = JSON.parse(await readFile(path.join(root, 'templates/card-carousel/front-styles.json'), 'utf8'));
            reply(200, { selection: await readSavedSelection(selectionFile, catalog) });
          } catch (error) {
            if (error.code !== 'INVALID_SELECTION') throw error;
            reply(200, { selection: null, warning: error.message });
          }
          return;
        }
        if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); reply(405, { error: '不支持的操作' }); return; }
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
          reply(403, { error: '仅接受本地页面的选择' }); return;
        }
        if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
          reply(415, { error: '请使用 application/json 保存选择' }); return;
        }
        const chunks = []; let length = 0;
        for await (const chunk of req) {
          length += chunk.length;
          if (length > 8192) { reply(413, { error: '选择内容过大' }); return; }
          chunks.push(chunk);
        }
        let selection;
        try {
          const catalog = JSON.parse(await readFile(path.join(root, 'templates/card-carousel/front-styles.json'), 'utf8'));
          selection = validateSelection(JSON.parse(Buffer.concat(chunks).toString('utf8')), catalog);
        } catch (e) { reply(400, { error: e.message }); return; }
        await mkdir(path.dirname(selectionFile), { recursive: true });
        const temp = `${selectionFile}.${randomUUID()}.tmp`;
        try { await writeFile(temp, JSON.stringify(selection, null, 2) + '\n', { mode: 0o600 }); await rename(temp, selectionFile); }
        finally { await rm(temp, { force: true }); }
        reply(200, { selection }); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); reply(405, { error: '不支持的操作' }); return; }
      const forbidden = file => path.relative(root, file).split(path.sep).some(part => part.startsWith('.') || blocked.has(part.toLowerCase()));
      const requested = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!inside(root, requested) || forbidden(requested)) { reply(403, { error: '禁止访问此文件' }); return; }
      const file = await realpath(requested);
      if (!inside(root, file) || forbidden(file)) { reply(403, { error: '禁止访问此文件' }); return; }
      const info = await stat(file);
      if (!info.isFile()) { reply(404, { error: '未找到文件' }); return; }
      const headers = { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
      let start = 0, end = info.size - 1, status = 200;
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        start = match?.[1] ? Number(match[1]) : Math.max(0, info.size - Number(match?.[2]));
        end = match?.[1] && match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
        if (!match || !(match[1] || match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= info.size) {
          res.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` }); res.end(); return;
        }
        status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
      }
      res.writeHead(status, { ...headers, 'Content-Length': Math.max(0, end - start + 1) });
      if (req.method === 'HEAD' || info.size === 0) { res.end(); return; }
      await pipeline(createReadStream(file, { start, end }), res);
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      reply(['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500, { error: ['ENOENT', 'ENOTDIR'].includes(error.code) ? '未找到文件' : '本地服务处理失败' });
    }
  });
  server.requestTimeout = 15000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(resolve => server.close(resolve)) };
}
