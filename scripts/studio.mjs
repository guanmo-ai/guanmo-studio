import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './server.mjs';
import { prepareCardStudio } from './card-studio.mjs';
import { parseCli } from './cli.mjs';

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  const { values } = parseCli({ cards: { type: 'boolean' }, port: { type: 'string' } }, { maxPositionals: 0 });
  if (values.help) console.log('用法：npm run studio -- [--cards] [--port 端口]\n默认只在 127.0.0.1 提供服务。');
  else {
    const port = Number(values.port ?? process.env.PORT ?? (values.cards ? 4318 : 4317));
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('端口必须是 0—65535 的整数');
    const selectionFile = path.join(repository, '.local/card-style-selection.json');
    await prepareCardStudio({ selectionFile });
    let server;
    try { server = await serve(repository, port, { selectionFile }); }
    catch (error) { if (error.code !== 'EADDRINUSE') throw error; server = await serve(repository, 0, { selectionFile }); }
    console.log(`Guanmo Studio 风格预览：${server.url}web/${values.cards ? 'card-studio/' : ''}\n按 Ctrl+C 结束`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
  }
} catch (error) { console.error(`启动失败：${error.message}`); process.exitCode = 1; }
