#!/usr/bin/env python3
"""导入本人现有色卡页，保留完整研究数据与可交互材质样板。"""
import json,re,sys
from pathlib import Path

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]);html=source.read_text()
destination=root/'web/palettes/index.html'; library=destination.read_text()
pattern=r'const studies\s*=\s*(\[.*?\]);\s*const stage'
match=re.search(pattern,html,re.S)
library_match=re.search(pattern,library,re.S)
if not match or not library_match: raise SystemExit('来源或色卡库中没有找到完整的 studies 色卡数据')
studies=json.loads(match.group(1))
clean=[{k:v for k,v in x.items() if k not in ('image','imageUrl','localImagePath')} for x in studies]
target=root/'templates/card-carousel';(target/'studies.json').write_text(json.dumps({'method':'本人既有研究色卡，色值为设计转译而非品牌官方标准色','studies':clean},ensure_ascii=False,indent=2)+'\n')
def blend(a,b,k=.12):
    rgb=[round(int(a[i:i+2],16)*(1-k)+int(b[i:i+2],16)*k) for i in (1,3,5)]
    return '#'+''.join(f'{x:02x}' for x in rgb)
catalog=json.loads((target/'front-styles.json').read_text())
light=[{**p,'group':'light','material':'matte','origin':'light'} for p in catalog['palettes'] if p.get('origin') not in ('study','look')]
palettes=[]
back_ids={'titanium':'titanium','wwdc':'dusk','dune':'sand','blade':'amber','budapest':'berry'}
for s in clean:
    bg,face,edge,accent,ink=s['colors']
    palettes.append({**s,'id':'study-'+s['id'],'studyId':s['id'],'origin':'study','note':s['description'],'papers':[face],'light':blend(face,edge),'ink':ink,'accent':accent,'edge':edge,'stageColor':bg,'swatches':s['colors'],'backStyle':back_ids.get(s['id'])})
looks=json.loads((target/'looks.json').read_text())
for key,look in looks.items():
    surf=look['surface'];palettes.append({'id':'look-'+key,'origin':'look','group':'template','name':look['name'],'note':'项目已有整套配色','source':'Guanmo Studio · '+key,'papers':surf['palette'],'light':blend(surf['palette'][0],surf['edge']),'ink':'#f4f1eb','accent':look['theme']['highlight'],'edge':surf['edge'],'material':'glass' if surf.get('glass') else 'metal','swatches':surf['palette'],'roughness':surf['roughness'],'metalness':surf['metalness']})
catalog['palettes']=palettes+light
catalog['groups']=[{'id':'all','name':'全部'},{'id':'new','name':'本轮新增'},{'id':'liked','name':'之前喜欢'},{'id':'round2','name':'上轮延伸'},{'id':'other','name':'其他研究'},{'id':'template','name':'模板配色'},{'id':'light','name':'浅色试配'}]
(target/'front-styles.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
# 保留原页面的原创材质与布局；不打包参考照片，不自动加载第三方图片。
placeholder='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22/%3E'
portable=[{**x,'image':placeholder} for x in clean]
destination.write_text(library[:library_match.start(1)] + json.dumps(portable, ensure_ascii=False) + library[library_match.end(1):])
print(f'已导入 {len(clean)} 组研究色卡、{len(looks)} 组模板配色、{len(light)} 组浅色试配，共 {len(catalog["palettes"])} 组；5组卡背材质关联原色卡')
