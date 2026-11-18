import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { buildFilm } from '../scripts/build.mjs';
import { resolvePython, runPython, pythonEnvironment } from '../scripts/environment.mjs';
import { containsPath, quoteShell } from '../scripts/paths.mjs';
import { setupEnvironment } from '../scripts/setup.mjs';

test('Windows 的 python 别名不可用时改用 py -3，保留参数与UTF-8输出', () => {
  const calls = [];
  const python = resolvePython({ platform: 'win32', env: {}, exists: () => false, run(file, args, options) {
    calls.push({file,args,options});
    return file === 'py' ? {status:0,stdout:'3.12.10\n'} : {status:9009,stdout:''};
  }});
  assert.equal(python.file,'py'); assert.deepEqual(python.args,['-3']);
  assert.equal(calls[1].args[0],'-3'); assert.equal(calls[1].options.env.PYTHONUTF8,'1'); assert.equal(calls[1].options.env.PYTHONIOENCODING,'utf-8');
});

test('解释器路径包含空格与中文时保持完整，显式覆盖失效不静默切换环境', () => {
  const file='C:\\Program Files\\Python 中文\\python.exe'; const calls=[];
  const python=resolvePython({platform:'win32',env:{PYTHON:file},exists:()=>false,run(command,args){calls.push({command,args});return {status:0,stdout:'3.13.2\n'};}});
  assert.equal(python.file,file); assert.equal(calls[0].command,file);
  assert.throws(()=>resolvePython({env:{PYTHON:'missing python'},run:()=>({status:1}),exists:()=>false}),/未找到/);
  assert.equal(pythonEnvironment({CUSTOM:'retained'}).CUSTOM,'retained');
});

test('Windows 虚拟环境优先使用 Scripts/python.exe', () => {
  const root=path.resolve('fixture 中文 space');let selected;
  resolvePython({root,platform:'win32',env:{},exists:()=>true,run(file){selected=file;return {status:0,stdout:'3.12.1\n'};}});
  assert.equal(selected,path.join(root,'.venv','Scripts/python.exe'));
});

test('Windows 路径包含判断处理盘符大小写、跨盘、UNC和相似目录名', () => {
  const api=path.win32;
  assert.ok(containsPath('C:\\Studio','c:\\studio\\assets\\图片.png',api));
  assert.ok(containsPath('C:\\','C:\\Studio',api));
  assert.equal(containsPath('C:\\Studio','D:\\Studio\\out',api),false);
  assert.equal(containsPath('C:\\Studio','C:\\Studio-other',api),false);
  assert.equal(containsPath('\\\\host\\share','\\\\host\\other\\out',api),false);
  assert.equal(containsPath('/work/studio','/work/studio-other',path.posix),false);
});

test('剪辑包为 PowerShell 和 Bash 分别转义带引号的路径', () => {
  assert.equal(quoteShell("C:\\User's folder\\配置.json",'powershell'),"'C:\\User''s folder\\配置.json'");
  assert.equal(quoteShell("a'b",'bash'),"'a'\"'\"'b'");
  assert.equal(quoteShell('x$(echo hello)','powershell'),"'x$(echo hello)'");
});

test('Python 清单支持Windows跨盘输出，原导入模式仍明确拒绝跨盘', () => {
  const script = `import importlib.util, ntpath, sys
s=importlib.util.spec_from_file_location('studio_builder',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
assert m.manifest_directory(r'D:\\Output 中文',r'C:\\Studio',True,ntpath)=='D:/Output 中文'
try: m.manifest_directory(r'D:\\Output',r'C:\\Studio',False,ntpath)
except ValueError: pass
else: raise AssertionError('import mode must reject cross-drive paths')
print('cross-drive passed')`;
  const result=runPython(['-c',script,path.resolve('templates/card-carousel/scripts/build_film.py')]);
  assert.equal(result.status,0,result.stdout+result.stderr);
});

test('含空格与中文目录、JSON大写扩展名的配置可以实际构建', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'studio 中文 space-'));
  try {
    const config=path.join(root,'CONFIG.JSON'),out=path.join(root,'成片 build');
    await writeFile(config,await readFile(new URL('../examples/starter/config.json',import.meta.url)));
    await buildFilm(config,out);
    const meta=JSON.parse(await readFile(path.join(out,'studio.json'),'utf8'));
    assert.equal(meta.duration,15);assert.equal(meta.width,1920);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('Windows 编辑器保存的 UTF-8 BOM 配置可以构建并搬移重建', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'studio-bom-'));
  try {
    const config=path.join(root,'config.json'),out=path.join(root,'film');
    await writeFile(config,'\uFEFF'+await readFile(new URL('../examples/starter/config.json',import.meta.url),'utf8'));
    await buildFilm(config,out);
    const source=path.join(out,'source/config.json');
    assert.equal(JSON.parse(await readFile(source,'utf8')).brand.wordmark,'Your Project');
    await buildFilm(source,path.join(root,'rebuilt'));
    assert.equal((await readFile(config,'utf8')).charCodeAt(0),0xFEFF,'不改写原配置');
  } finally {await rm(root,{recursive:true,force:true});}
});

test('setup 沿用显式 PYTHON 环境，与构建使用的解释器一致，不另建无效虚拟环境', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'studio-setup-'));
  try {
    const probe=runPython(['-c','import sys; print(sys.executable)']);assert.equal(probe.status,0,probe.stderr);
    const executable=probe.stdout.trim();
    await writeFile(path.join(root,'requirements.txt'),await readFile(new URL('../requirements.txt',import.meta.url)));
    const report=await setupEnvironment({root,env:{...process.env,PYTHON:executable},skipBrowser:true});
    assert.equal(report.python,executable);
    assert.equal(JSON.parse(await readFile(path.join(root,'.local/setup.json'),'utf8')).python,executable);
    await assert.rejects(access(path.join(root,'.venv')), {code:'ENOENT'});
    const runtime=resolvePython({root,env:{...process.env,PYTHON:executable}});
    assert.equal(runtime.file,report.python);
  } finally {await rm(root,{recursive:true,force:true});}
});
