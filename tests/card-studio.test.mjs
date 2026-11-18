import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {distributeCards} from '../templates/card-carousel/assets/engine/card-distribution.js';

test('完整研究色卡不漏项、不改色，现有模板和五组卡背也可追溯',async()=>{
 const read=async file=>JSON.parse(await readFile(new URL('../templates/card-carousel/'+file,import.meta.url),'utf8'));
 const [{studies},catalog,looks,backs]=await Promise.all(['studies.json','front-styles.json','looks.json','card-styles.json'].map(read));
 assert.equal(studies.length,20);assert.equal(catalog.palettes.length,30);
 for(const s of studies){const p=catalog.palettes.find(p=>p.studyId===s.id);assert.ok(p,s.name);assert.equal(p.name,s.name);assert.deepEqual(p.swatches,s.colors);assert.equal(p.material,s.material);assert.equal(p.lightPosition,s.lightPosition);}
 for(const id of Object.keys(looks))assert.ok(catalog.palettes.some(p=>p.id==='look-'+id));
 for(const id of Object.keys(backs))assert.ok(catalog.palettes.some(p=>p.backStyle===id));
 assert.equal(new Set(catalog.palettes.map(p=>p.id)).size,30);
});

test('21张卡片的四种样式按6/5/5/5分配，换种子打散，切镜头保持分配',()=>{
 const ids=Array.from({length:21},(_,i)=>'service-'+i),styles=['a','b','c','d'];
 const first=distributeCards(ids,styles,12345);
 assert.deepEqual(Object.values(first.counts).sort((a,b)=>a-b),[5,5,5,6]);
 assert.equal(Object.keys(first.assignments).length,21);assert.ok(Object.values(first.assignments).every(p=>styles.includes(p)));
 assert.deepEqual(first,distributeCards([...ids].reverse(),styles,12345));
 assert.notDeepEqual(first.assignments,distributeCards(ids,styles,54321).assignments);
 assert.throws(()=>distributeCards(ids,[],0));assert.throws(()=>distributeCards(ids,['a','a'],0));
});
