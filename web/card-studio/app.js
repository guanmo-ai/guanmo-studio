import { CARD_STUDIO_PROJECT, validateSelection } from '../../scripts/selection.mjs';
import { faceCanvas } from '../../templates/card-carousel/assets/engine/card-face.js';
import { distributeCards } from '../../templates/card-carousel/assets/engine/card-distribution.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const storageKey = `guanmo-card-studio-${CARD_STUDIO_PROJECT}-v1`;
const demoConfig = new URL(`../../examples/${CARD_STUDIO_PROJECT}/config.json`, import.meta.url);
const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
let hoverFrame=0,hoverStamp=0;
const hoverTilt={x:0,y:0},hoverTarget={x:0,y:0},hoverVelocity={x:0,y:0};
let savedSelection=null,saving=false;
let catalog,source,icon,ready=false,view='front',group='all',state={version:2,project:CARD_STUDIO_PROJECT,palette:'porcelain',previewPalette:'porcelain',palettes:[],seed:crypto.getRandomValues(new Uint32Array(1))[0],layout:'poster',back:'number',material:'auto',light:28,time:2.75};
const status=(text,error=false)=>{$('#save-status').textContent=text;$('#save-status').classList.toggle('error',error);};
const palette=()=>catalog.palettes.find(p=>p.id===(state.previewPalette||state.palette))||catalog.palettes[0];
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}}
function valid(s){try{validateSelection(s,catalog,{allowEmpty:true});return true;}catch{return false;}}
const selectionKey=value=>{const {savedAt,...selection}=validateSelection(value,catalog);return JSON.stringify(selection);};
function matchesSaved(){try{return Boolean(savedSelection)&&selectionKey(state)===selectionKey(savedSelection);}catch{return false;}}
const selected=()=>state.palettes||[state.palette];
const distribution=()=>selected().length?distributeCards(source.cards.map(c=>c.id),selected(),state.seed):{assignments:{},counts:{}};
function sample() {
  const card = source.cards[0];
  return {
    ...card,
    no: card.no || '01',
    face: {
      brand: source.brand.wordmark,
      ...card.face,
      colors: palette(),
      layout: state.layout,
      back: state.back,
      material: state.material,
      light: state.light,
    },
  };
}
function flat(){const c=faceCanvas(sample(),icon,view==='back');const target=$('#flat-card');target.getContext('2d').clearRect(0,0,1280,720);target.getContext('2d').drawImage(c,0,0);}
function sizeScene(){const w=$('#scene').contentWindow,stage=w.document.querySelector('#stage');if(!stage)return;const scale=Math.min(w.innerWidth/1920,w.innerHeight/1080);stage.style.cssText=`position:absolute;left:0;top:0;transform:scale(${scale});transform-origin:top left`;}
function applyResearch(){const p=palette(),api=$('#study-reference').contentWindow?.__studyPreview;if(api)api.apply(p,state.material==='auto'?(p.material||'matte'):state.material,state.light);}
function previewStyle(id){state.previewPalette=id;setView('front');apply({changed:false});status(selected().includes(id)?'已加入':'仅预览，点「加入」使用');if(matchMedia('(max-width:760px)').matches)document.querySelector('.preview-column').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}
function removeStyle(id){state.palettes=selected().filter(p=>p!==id);if(!state.palettes.includes(state.palette))state.palette=state.palettes[0]||palette().id;if(!selected().length&&view==='scene')setView('front');apply();}
function selectedSummary(){const d=distribution();$('#selected-count').textContent=`${selected().length} 种`;$('#reshuffle').disabled=selected().length<2;$('#clear-selection').disabled=!selected().length;
 $('#selected-styles').replaceChildren(...selected().map(id=>{const p=catalog.palettes.find(p=>p.id===id),item=document.createElement('div'),b=document.createElement('button'),remove=document.createElement('button');item.className='selected-style-item';b.setAttribute('aria-pressed',palette().id===id);b.setAttribute('aria-label',`近看${p.name}，分配${d.counts[id]}张`);b.innerHTML=`<i style="background:${p.papers[0]}"></i><span>${p.name}</span><strong>${d.counts[id]}张</strong>`;b.onclick=()=>previewStyle(id);remove.className='remove-style';remove.textContent='×';remove.setAttribute('aria-label','移除'+p.name);remove.onclick=()=>removeStyle(id);item.append(b,remove);return item;}));
 if(!selected().length){const p=document.createElement('p');p.className='selected-empty';p.textContent='预览后，点「加入」';$('#selected-styles').append(p);}
 $('#distribution-note').textContent=selected().length?`${source.cards.length} 张 · ${selected().map(id=>d.counts[id]).join(' / ')}`:'加入后均分';
}
async function apply({changed=true}={}){
  const p=palette(),layout=catalog.layouts.find(x=>x.id===state.layout);
  selectedSummary();const counts=distribution().counts;
  $$('[data-palette]').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.palette===p.id);b.dataset.used=selected().includes(b.dataset.palette);b.querySelector('.check').textContent=(counts[b.dataset.palette]||0)+'张';});
  $$('[data-layout]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.layout===state.layout));
  $$('[data-back]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.back===state.back));
  $$('[data-material]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.material===state.material));
  $('#light').value=state.light;$('#light-value').textContent=state.light+'%';
  $$('[data-time]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.time)===state.time));
  $('#look-name').textContent=view==='scene'?`${selected().length}种样式混排 · ${layout.name}`:`${p.name} · ${layout.name}`;$('#look-description').textContent=p.source||p.note;$('#layout-note').textContent=layout.note;
  const included=selected().includes(p.id);$('#add-preview').disabled=!ready||included;$('#add-preview').textContent=included?'✓ 已加入':'＋ 加入';$('#save').disabled=saving||!ready||!selected().length;$('#restore-saved').disabled=saving||!savedSelection;$('#export').disabled=!ready||!selected().length;
  $('#palette-readout').replaceChildren(...(p.swatches||[p.light,...p.papers,p.ink]).map(color=>{const s=document.createElement('span');s.style.background=color;s.title=color;return s;}));
  $('#time-readout').textContent=`${state.time.toFixed(2).padStart(5,'0')} / 15s`;
  flat();applyResearch();persist();if(changed)status(saving?'正在保存到本机…':matchesSaved()?'已保存 · 制作时请使用下方命令':'尚未保存 · 满意后保存这套样式');
  if(ready){const w=$('#scene').contentWindow;if(selected().length)w.__cardCarousel.setAppearance({palettes:selected().map(id=>catalog.palettes.find(p=>p.id===id)),seed:state.seed,layout:state.layout,back:state.back,material:state.material,light:state.light});w.__cardCarousel.setInspection(['front','back'].includes(view)?{palette:p,layout:state.layout,back:state.back,material:state.material,light:state.light,side:view}:null);await w.__studio.seek(state.time);}
}
function resetHover(){
  cancelAnimationFrame(hoverFrame);hoverFrame=0;hoverStamp=0;
  hoverTarget.x=hoverTarget.y=hoverTilt.x=hoverTilt.y=hoverVelocity.x=hoverVelocity.y=0;
  if(ready)$('#scene').contentWindow.__cardCarousel.setInspectionTilt(hoverTilt);
}
function setHover(x=0,y=0){
  if(!ready||!['front','back'].includes(view)||document.hidden)return;
  hoverTarget.x=reducedMotion.matches?0:x;hoverTarget.y=reducedMotion.matches?0:y;
  if(hoverFrame)return;
  function tick(now){
    const dt=Math.min(hoverStamp?(now-hoverStamp)/1000:1/60,.05);hoverStamp=now;
    // 临界阻尼保留速度，让跟随和回正都柔和起停；回正再慢一些。
    const speed=hoverTarget.x===0&&hoverTarget.y===0?5.5:6.5,decay=Math.exp(-speed*dt);
    let settled=true;
    for(const axis of ['x','y']){
      const offset=hoverTilt[axis]-hoverTarget[axis],step=(hoverVelocity[axis]+speed*offset)*dt;
      hoverTilt[axis]=hoverTarget[axis]+(offset+step)*decay;
      hoverVelocity[axis]=(hoverVelocity[axis]-speed*step)*decay;
      if(Math.abs(hoverTarget[axis]-hoverTilt[axis])>.001||Math.abs(hoverVelocity[axis])>.003)settled=false;
    }
    if(settled)for(const axis of ['x','y']){hoverTilt[axis]=hoverTarget[axis];hoverVelocity[axis]=0;}
    $('#scene').contentWindow.__cardCarousel.setInspectionTilt(hoverTilt);
    hoverFrame=settled?0:requestAnimationFrame(tick);if(settled)hoverStamp=0;
  }
  hoverFrame=requestAnimationFrame(tick);
}
function syncHover(){
  resetHover();
  const inspecting=['front','back'].includes(view);
  $('#inspection-motion').hidden=!inspecting;$('.frame-choices').hidden=view!=='scene';$('#time-readout').hidden=view!=='scene';
}
function setView(next){if(next==='scene'&&!selected().length){status('先加入一种样式，再查看混排效果');return;}view=next;$$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));$('#scene').hidden=view==='material';$('#study-reference').hidden=view!=='material';$('#flat-card').hidden=true;if(view==='material')applyResearch();else if(ready)sizeScene();syncHover();}
function renderPalettes(){
  const query=$('#palette-search').value.trim().toLowerCase();const visible=catalog.palettes.filter(p=>(group==='all'||p.group===group)&&[p.name,p.note,p.source,p.family,p.material,({matte:'哑光',metal:'金属',glass:'玻璃'})[p.material]].join(' ').toLowerCase().includes(query));
  $('#palette-count').textContent=`${visible.length} / ${catalog.palettes.length} 组`;
  const counts=distribution().counts;
  $('#palettes').replaceChildren(...visible.map(p=>{const b=document.createElement('button');b.className='palette-option';b.dataset.palette=p.id;b.dataset.used=selected().includes(p.id);b.setAttribute('aria-label',`预览${p.name} · ${catalog.groups.find(g=>g.id===p.group)?.name||''}`);b.setAttribute('aria-pressed',palette().id===p.id);b.title=p.note;b.innerHTML=`<span class="swatches">${(p.swatches||[p.light,...p.papers,p.ink]).map(c=>`<i style="background:${c}"></i>`).join('')}</span><span class="name">${p.name}</span><span class="check" aria-hidden="true">${counts[p.id]||0}张</span>`;b.onclick=()=>previewStyle(p.id);return b;}));
  if(!visible.length){const p=document.createElement('p');p.className='palette-empty';p.textContent='没有匹配的色卡，试试其他名称';$('#palettes').append(p);}
}
function controls(){
  $('#palette-groups').replaceChildren(...catalog.groups.map(g=>{const b=document.createElement('button');b.dataset.group=g.id;b.textContent=g.name;b.setAttribute('aria-pressed',g.id===group);b.onclick=()=>{group=g.id;$$('[data-group]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.group===group));renderPalettes();};return b;}));
  $('#palette-search').addEventListener('input',renderPalettes);renderPalettes();
  $('#layouts').replaceChildren(...catalog.layouts.map(l=>{const b=document.createElement('button');b.className='layout-option';b.dataset.layout=l.id;b.innerHTML=`<div class="layout-icon ${l.id}" aria-hidden="true"><i></i><i></i><i></i></div><span>${l.name}</span>`;b.onclick=()=>{state.layout=l.id;apply();};return b;}));
  $('#backs').replaceChildren(...catalog.backs.map(back=>{const b=document.createElement('button');b.dataset.back=back.id;b.textContent=back.name;b.onclick=()=>{state.back=back.id;apply();};return b;}));
}
async function init(){
  const responses = await Promise.all([
    fetch('../../templates/card-carousel/front-styles.json'),
    fetch(demoConfig),
  ]);
  if(responses.some(r=>!r.ok))throw new Error('样式或卡片内容加载失败');
  [catalog,source]=await Promise.all(responses.map(r=>r.json()));
  let previous,selectionWarning='';try{previous=JSON.parse(localStorage.getItem(storageKey));}catch{}
  try{const r=await fetch('/api/card-style-selection');const result=await r.json();if(r.ok){selectionWarning=result.warning||'';const saved=result.selection;if(valid(saved)){savedSelection=saved;if(!valid(previous))previous=saved;}}else selectionWarning='暂时无法读取本机保存的样式，当前可继续预览，重新保存前请检查本地文件权限。';}catch{selectionWarning='暂时无法读取本机保存的样式，请检查工作室连接后刷新。';}
  if(valid(previous)){state={...state,...validateSelection(previous,catalog,{allowEmpty:true}),previewPalette:previous.previewPalette||previous.palette};if(previous.version!==2){state.material='auto';state.version=2;}}
  const sampleCard = source.cards[0];
  const fontLoads = [
    document.fonts.load('650 84px "Noto Sans SC"', sampleCard.title),
    document.fonts.load('500 40px Geist'),
  ];
  if (sampleCard.face?.icon) {
    icon = new Image();
    icon.src = new URL(sampleCard.face.icon, demoConfig).href;
    fontLoads.push(icon.decode());
  }
  await Promise.all(fontLoads);
  controls();await apply({changed:false});
  $$('[data-view]').forEach(b=>b.onclick=()=>{setView(b.dataset.view);apply({changed:false});});
  $$('[data-time]').forEach(b=>b.onclick=()=>{state.time=Number(b.dataset.time);setView('scene');apply();});
  $$('[data-material]').forEach(b=>b.onclick=()=>{state.material=b.dataset.material;apply();});
  $('#light').addEventListener('input',e=>{state.light=Number(e.target.value);apply();});
  document.addEventListener('visibilitychange',resetHover);
  window.addEventListener('pagehide',resetHover);
  reducedMotion.addEventListener('change',resetHover);
  $('#reshuffle').onclick=()=>{state.seed=crypto.getRandomValues(new Uint32Array(1))[0];apply();};
  $('#clear-selection').onclick=()=>{state.palettes=[];state.palette=palette().id;setView('front');apply();};
  $('#add-preview').onclick=()=>{const id=palette().id;if(selected().includes(id))return;if(selected().length>=source.cards.length){status(`最多加入${source.cards.length}种样式，请先移除一种`);return;}state.palettes=[...selected(),id];state.palette=id;apply();};
  $('#fullscreen').onclick=async()=>{try{await $('#viewport').requestFullscreen();}catch{status('当前窗口暂不支持全屏，可以直接放大浏览器窗口');}};
  $('#export').onclick=()=>{const blob=new Blob([JSON.stringify({...state,version:2,distribution:distribution()},null,2)+'\n'],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`${CARD_STUDIO_PROJECT}-card-style.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
  $('#restore-saved').onclick=async()=>{
    if(!savedSelection||saving)return;
    state={...state,...validateSelection(savedSelection,catalog),previewPalette:savedSelection.palette};
    setView('front');await apply({changed:false});status('已恢复上次保存的方案 · 文件保持原样');
  };
  $('#save').onclick=async()=>{
    if(saving||!selected().length)return;
    const payload=validateSelection(state,catalog),button=$('#save');
    saving=true;button.disabled=true;button.setAttribute('aria-busy','true');$('#restore-saved').disabled=true;status('正在保存到本机…');
    try{
      const r=await fetch('/api/card-style-selection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result=await r.json();if(!r.ok)throw new Error(result.error||'保存失败');
      savedSelection=result.selection;
      const unchanged=matchesSaved();
      persist();status(unchanged?'已保存 · 制作时请使用下方命令':'已保存先前方案 · 当前修改尚未保存');
    }catch(e){status(`本地文件保存失败：${e.message}。当前浏览器仍保留选择`,true);}
    finally{saving=false;button.disabled=!ready||!selected().length;button.removeAttribute('aria-busy');$('#restore-saved').disabled=!savedSelection;}
  };
  const frame=$('#scene');const began=Date.now();
  while(!frame.contentWindow?.__studio?.ready || !frame.contentWindow?.__cardCarousel || !$('#study-reference').contentWindow?.__studyPreview){if(Date.now()-began>30000)throw new Error('视频预览尚未准备好，请重新启动工作室后刷新');await new Promise(r=>setTimeout(r,60));}
  ready=true;setView('front');sizeScene();frame.contentWindow.addEventListener('resize',sizeScene);await apply({changed:false});$('#loading').hidden=true;
  frame.contentWindow.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const w=frame.contentWindow;setHover(Math.max(-1,Math.min(1,e.clientX/w.innerWidth*2-1)),Math.max(-1,Math.min(1,e.clientY/w.innerHeight*2-1)));});
  frame.contentWindow.document.documentElement.addEventListener('pointerleave',()=>setHover());
  frame.contentWindow.addEventListener('blur',()=>setHover());
  $('#viewport').addEventListener('pointerleave',()=>setHover());
  window.__cardStudio={getSelection:()=>({...state}),ready:true};
  if(selectionWarning)status(selectionWarning,true);
}
const libraryDialog = $('#library-dialog');
const libraryFrame = $('#library-frame');
$('#open-library').addEventListener('click', () => {
  if (!libraryFrame.hasAttribute('src')) libraryFrame.src = '../palettes/?library=1';
  libraryDialog.showModal();
});
libraryFrame.addEventListener('load', () => {
  libraryFrame.contentDocument?.addEventListener('keydown', event => {
    if (event.key === 'Escape' && libraryDialog.open) {
      event.preventDefault();
      libraryDialog.close();
    }
  });
});

init().catch(e=>{$('#loading').innerHTML='';const p=document.createElement('p');p.textContent=e.message;$('#loading').append(p);status(e.message,true);});
