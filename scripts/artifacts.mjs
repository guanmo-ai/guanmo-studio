import { canonicalPath, containsPath } from './paths.mjs';
import path from 'node:path';
import { lstat, mkdir, readdir, rename, rm, rmdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// 全部产物已验证后才安装；任一移动失败，恢复本次移动过的旧产物。
export async function commitArtifacts(artifacts, { signal } = {}) {
  const targets = await Promise.all(artifacts.map(({ target }) => canonicalPath(target)));
  const locks = [];
  try {
    for (const target of targets) {
      signal?.throwIfAborted();
      const lock = path.join(path.dirname(target), `.${path.basename(target)}.studio-lock`);
      try { await mkdir(lock); }
      catch (error) {
        if (error.code === 'EEXIST') throw new Error(`该输出正在保存，或有上次异常退出留下的锁：${target}`);
        throw error;
      }
      locks.push(lock);
    }
    await replaceArtifacts(artifacts, signal);
  } finally {
    for (const lock of locks.reverse()) {
      try { await rmdir(lock); }
      catch (error) { if (error.code !== 'ENOENT') console.warn(`输出锁待清理：${lock}`); }
    }
  }
}

async function replaceArtifacts(artifacts, signal) {
  const changes = [];
  try {
    for (const { staged, target } of artifacts) {
      signal?.throwIfAborted();
      const change = { target: path.resolve(target), backup: `${target}.${randomUUID()}.backup`, moved: false, installed: false };
      changes.push(change);
      try { await rename(change.target, change.backup); change.moved = true; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await rename(staged, change.target);
      change.installed = true;
    }
    signal?.throwIfAborted();
  } catch (error) {
    const failures = [];
    for (const change of changes.reverse()) {
      try {
        if (change.installed) await rm(change.target, { recursive: true, force: true });
        if (change.moved) await rename(change.backup, change.target);
      } catch (restoreError) { failures.push(restoreError); }
    }
    if (failures.length) throw new AggregateError([error, ...failures], '产物保存失败，部分恢复失败；请保留 .backup 文件');
    throw error;
  }
  for (const change of changes) if (change.moved) {
    try { await rm(change.backup, { recursive: true, force: true }); }
    catch { console.warn(`产物已保存，旧备份待清理：${change.backup}`); }
  }
}

export async function assertOutputDirectory(directory, protectedPaths, markers) {
  const target = path.resolve(directory);
  const canonical = await canonicalPath(target);
  const protectedFiles = await Promise.all(protectedPaths.map(canonicalPath));
  if (protectedFiles.some(file => containsPath(canonical, file))) throw new Error('输出目录不能覆盖仓库、源配置、源工程或成片');
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('输出目录必须是普通目录');
    const entries = await readdir(target);
    if (entries.length && !markers.every(marker => entries.includes(marker))) throw new Error('输出目录含有非生成文件，请使用新的目录');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export async function assertOutsideProject(output, project) {
  const [target, root] = await Promise.all([canonicalPath(output), canonicalPath(project)]);
  if (containsPath(root, target)) throw new Error('输出不能放在输入工程内，请选择独立目录');
}
