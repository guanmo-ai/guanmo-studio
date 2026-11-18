// 同一随机种子在网页和视频里得到相同分配，数量差最多一张。
export function distributeCards(cardIds, paletteIds, seed=0) {
  const ids=[...cardIds].sort(),styles=[...paletteIds];
  if(!styles.length||styles.length>ids.length||new Set(styles).size!==styles.length)throw new Error('样式数量需要在1和卡片数量之间，且不能重复');
  let state=Number(seed)>>>0;
  const random=()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
  const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const order=shuffle([...styles]),base=Math.floor(ids.length/styles.length),remainder=ids.length%styles.length;
  const counts=Object.fromEntries(styles.map(id=>[id,base]));order.slice(0,remainder).forEach(id=>counts[id]++);
  const pool=shuffle(styles.flatMap(id=>Array(counts[id]).fill(id)));
  return {assignments:Object.fromEntries(ids.map((id,i)=>[id,pool[i]])),counts};
}
