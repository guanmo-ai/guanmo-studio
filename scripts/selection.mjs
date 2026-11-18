export const CARD_STUDIO_PROJECT = 'studio-demo';

export function validateSelection(selection,catalog,{allowEmpty=false}={}) {
  if (!selection || selection.project !== CARD_STUDIO_PROJECT) throw new Error('样式只适用于当前演示项目');
  for(const [key,group] of [['palette','palettes'],['layout','layouts'],['back','backs']]) {
    if(!catalog[group].some(x=>x.id===selection[key])) throw new Error(`无效的${key}选项`);
  }
  if(!Number.isFinite(selection.time)||selection.time<0||selection.time>=15)throw new Error('预览时间超出范围');
  const palettes=selection.palettes||[selection.palette],seed=selection.seed??0;
  if(!Array.isArray(palettes)||(!allowEmpty&&!palettes.length)||palettes.length>21||new Set(palettes).size!==palettes.length||palettes.some(id=>!catalog.palettes.some(p=>p.id===id))||(palettes.length>0&&!palettes.includes(selection.palette)))throw new Error('请选择1—21种不重复的样式');
  if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('随机种子无效');
  const material=selection.material||'auto',light=selection.light??28;
  if(!['auto','matte','metal','glass'].includes(material)||!Number.isFinite(light)||light<0||light>100)throw new Error('材质或主光位置无效');
  return {version:2,project:CARD_STUDIO_PROJECT,palette:selection.palette,palettes,seed,layout:selection.layout,back:selection.back,material,light,time:selection.time,savedAt:new Date().toISOString()};
}
