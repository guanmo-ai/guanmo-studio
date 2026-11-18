import { readFile } from 'node:fs/promises';
import { validateSelection } from './selection.mjs';

export const selectionWarning = '本机保存的样式文件损坏或选项已失效。原文件已保留，可重新选择样式后保存。';

export async function readSavedSelection(file, catalog) {
  let raw;
  try { raw = await readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  try {
    const saved = JSON.parse(raw.replace(/^\uFEFF/, ''));
    return { ...validateSelection(saved, catalog), savedAt: saved.savedAt };
  } catch (cause) {
    const error = new Error(selectionWarning, { cause });
    error.code = 'INVALID_SELECTION';
    throw error;
  }
}
