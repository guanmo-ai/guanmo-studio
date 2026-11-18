import { parseArgs } from 'node:util';

export function parseCli(options, { maxPositionals = 1 } = {}) {
  const parsed = parseArgs({ options: { ...options, help: { type: 'boolean', short: 'h' } }, allowPositionals: true, strict: true });
  if (parsed.positionals.length > maxPositionals) throw new Error('位置参数过多，请使用 --help 查看用法');
  for (const [key, value] of Object.entries(parsed.values)) {
    if (typeof value === 'string' && (!value.trim() || value.startsWith('--'))) throw new Error(`--${key} 缺少有效值`);
  }
  return parsed;
}
