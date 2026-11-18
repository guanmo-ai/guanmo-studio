import path from 'node:path';
import { serve } from './server.mjs';
import { parseCli } from './cli.mjs';
try {
  const { values, positionals } = parseCli({});
  if (values.help) console.log('用法：npm run preview -- [构建目录]');
  else {
    const server = await serve(path.resolve(positionals[0] || 'build/starter'));
    console.log(`预览地址：${server.url}\n按 Ctrl+C 结束`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
