import path from 'node:path';
import { realpath } from 'node:fs/promises';

export function containsPath(parent, child, pathApi = path) {
  const relative = pathApi.relative(pathApi.resolve(parent), pathApi.resolve(child));
  return !relative || (relative !== '..' && !relative.startsWith('..' + pathApi.sep) && !pathApi.isAbsolute(relative));
}

// 输出可能尚未存在，从最近一个已存在的上级解析目录别名。
export async function canonicalPath(file) {
  const absolute = path.resolve(file);
  try { return await realpath(absolute); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const parent = path.dirname(absolute);
    if (parent === absolute) throw error;
    return path.join(await canonicalPath(parent), path.basename(absolute));
  }
}

export function quoteShell(value, shell = 'bash') {
  return "'" + value.replaceAll("'", shell === 'powershell' ? "''" : "'\"'\"'") + "'";
}
