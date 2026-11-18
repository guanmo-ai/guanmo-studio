import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { serve } from '../scripts/server.mjs';

test('视频服务支持完整长度、HEAD和播放器范围读取', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'guanmo-server-'));
  let server;
  try {
    await writeFile(path.join(root, 'video.mp4'), Buffer.from('0123456789'));
    server = await serve(root);
    const url = server.url + 'video.mp4';
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), '10');
    assert.equal(head.headers.get('accept-ranges'), 'bytes'); assert.equal(await head.text(), '');
    for (const [range, content, returned] of [['bytes=0-1','01','bytes 0-1/10'], ['bytes=7-','789','bytes 7-9/10'], ['bytes=-3','789','bytes 7-9/10'], ['bytes=8-20','89','bytes 8-9/10']]) {
      const response = await fetch(url, { headers: { Range: range } });
      assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), returned);
      assert.equal(response.headers.get('content-length'), String(content.length)); assert.equal(await response.text(), content);
    }
    for (const range of ['bytes=20-', 'bytes=8-2', 'bytes=-0', 'bytes=-', 'garbage']) {
      const response = await fetch(url, { headers: { Range: range } });
      assert.equal(response.status, 416, range); assert.equal(response.headers.get('content-range'), 'bytes */10');
    }
  } finally {
    if (server) await server.close(); await rm(root, { recursive: true, force: true });
  }
});

test('样式选择按完整目录校验并保存，错误选项和跨来源写入被拒绝', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'guanmo-style-save-'));let server;
  try {
    await mkdir(path.join(root,'templates/card-carousel'),{recursive:true});
    const catalog=JSON.parse(await readFile(new URL('../templates/card-carousel/front-styles.json',import.meta.url),'utf8'));
    await writeFile(path.join(root,'templates/card-carousel/front-styles.json'),JSON.stringify(catalog));
    const selectionFile=path.join(root,'selection.json');server=await serve(root,0,{selectionFile});
    const url=server.url+'api/card-style-selection';assert.deepEqual(await (await fetch(url)).json(),{selection:null});
    const choice={project:'studio-demo',palette:'study-apple-jet-mirror',layout:'split',back:'type',material:'metal',light:41,time:2.75};
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(choice)});assert.equal(response.status,200);
    const saved=JSON.parse(await readFile(selectionFile,'utf8'));for(const [key,value] of Object.entries(choice))assert.equal(saved[key],value);
    assert.equal((await(await fetch(url)).json()).selection.palette,choice.palette);
    const mix={...choice,palettes:['study-apple-jet-mirror','study-warm','study-wwdc','study-budapest'],seed:123456,material:'auto'};
    assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mix)})).status,200);
    const mixedSaved=JSON.parse(await readFile(selectionFile,'utf8'));assert.deepEqual(mixedSaved.palettes,mix.palettes);assert.equal(mixedSaved.seed,123456);
    for(const patch of [{palette:'missing'},{light:101},{material:'wrong'}])assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...choice,...patch})})).status,400);
    assert.equal((await fetch(url,{method:'POST',headers:{Origin:'https://other.example'},body:JSON.stringify(choice)})).status,403);
    assert.equal(JSON.parse(await readFile(selectionFile,'utf8')).palette,choice.palette);
    assert.equal(catalog.palettes.filter(p=>p.origin==='study').length,20);
    assert.equal(new Set(catalog.palettes.map(p=>p.id)).size,catalog.palettes.length);
  }finally{if(server)await server.close();await rm(root,{recursive:true,force:true});}
});

test('损坏或失效的本机样式返回可恢复提示，保留原文件，重新保存后恢复正常', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'studio-recover-selection-'));let server;
  try {
    await mkdir(path.join(root,'templates/card-carousel'),{recursive:true});
    await writeFile(path.join(root,'templates/card-carousel/front-styles.json'),await readFile(new URL('../templates/card-carousel/front-styles.json',import.meta.url)));
    const selectionFile=path.join(root,'selection.json');server=await serve(root,0,{selectionFile});
    const url=server.url+'api/card-style-selection';
    const choice={project:'studio-demo',palette:'porcelain',layout:'poster',back:'number',time:2.75};
    for(const raw of ['{broken',JSON.stringify({...choice,palettes:['missing']})]){
      await writeFile(selectionFile,raw);const response=await fetch(url);assert.equal(response.status,200);
      const result=await response.json();assert.equal(result.selection,null);assert.match(result.warning,/原文件已保留/);
      assert.equal(await readFile(selectionFile,'utf8'),raw);
    }
    assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(choice)})).status,200);
    const saved=await readFile(selectionFile,'utf8');await writeFile(selectionFile,'\uFEFF'+saved);
    const recovered=await(await fetch(url)).json();assert.equal(recovered.warning,undefined);
    assert.equal(recovered.selection.savedAt,JSON.parse(saved).savedAt);
    assert.equal((await readFile(selectionFile,'utf8')).charCodeAt(0),0xFEFF);
  } finally {await server?.close();await rm(root,{recursive:true,force:true});}
});
