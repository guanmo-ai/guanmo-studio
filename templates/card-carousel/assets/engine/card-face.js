// 网页选择器和视频共用的卡面绘制；内容、色板和版式由配置提供。
const sans='"Noto Sans SC",sans-serif', latin='"Geist","Noto Sans SC",sans-serif';
const rgba=(h,a)=>`rgba(${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)},${a})`;
function text(g,s,x,y,size,weight=500,font=sans,max=1100){g.font=`${weight} ${size}px ${font}`;if(g.measureText(s).width>max)g.font=`${weight} ${size*max/g.measureText(s).width}px ${font}`;g.fillText(s,x,y);}
function rule(g,x,y,w,color){g.fillStyle=color;g.fillRect(x,y,w,1.5);}
function lines(g,s,x,y,max,size){g.font=`400 ${size}px ${sans}`;let line='',row=0;for(const c of s){if(g.measureText(line+c).width>max){g.fillText(line,x,y+row*size*1.6);line=c;row++;if(row===2){line+='…';break;}}else line+=c;}g.fillText(line,x,y+row*size*1.6);}
function icon(g,img,x,y,size,p){if(!img)return;g.save();g.fillStyle=p.light;g.beginPath();g.roundRect(x,y,size,size,size*.22);g.fill();g.beginPath();g.roundRect(x+3,y+3,size-6,size-6,size*.2);g.clip();g.filter='grayscale(1) sepia(0.25)';g.drawImage(img,x+5,y+5,size-10,size-10);g.restore();}
export function faceCanvas(card,img,back=false){
  const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d'),f=card.face,p=f.colors;
  const brand=f.brand??'Guanmo Studio',brandLabel=brand.toUpperCase(),kicker=f.kicker??card.tag??'';
  const paper=p.papers[(Number(card.no)||0)%p.papers.length];
  const gradient=g.createLinearGradient(0,0,1280,850);gradient.addColorStop(0,p.light);gradient.addColorStop(.65,paper);gradient.addColorStop(1,paper);g.fillStyle=gradient;g.fillRect(0,0,1280,720);
  g.fillStyle=p.ink;g.textBaseline='alphabetic';
  if(back){
    const mode=f.back||'number';g.fillStyle=rgba(p.ink,.7);text(g,card.tag||brandLabel,76,85,24,500,latin);
    if(mode==='number'){g.fillStyle=p.ink;text(g,card.no,68,410,290,350,latin);rule(g,78,465,1124,rgba(p.accent,.35));g.fillStyle=p.ink;text(g,card.title,78,560,55,600);g.fillStyle=rgba(p.ink,.65);text(g,card.sub||'',80,623,28,400,latin);}
    else if(mode==='type'){g.fillStyle=rgba(p.accent,.35);text(g,card.no,74,590,510,300,latin);g.fillStyle=p.ink;text(g,card.title,82,382,110,600,sans,1100);rule(g,82,430,160,p.accent);}
    else{g.textAlign='center';text(g,brand,640,345,100,500,latin);g.fillStyle=rgba(p.ink,.65);text(g,card.title,640,415,38,400);g.textAlign='left';}
    g.fillStyle=p.accent;g.beginPath();g.arc(1190,625,7,0,Math.PI*2);g.fill();return c;
  }
  const layout=f.layout||'editorial';g.fillStyle=p.accent;text(g,kicker,72,75,23,500);g.textAlign='right';text(g,`${card.no} / ${brandLabel}`,1208,75,23,500,latin);g.textAlign='left';
  if(layout==='poster'){
    icon(g,img,596,145,88,p);g.textAlign='center';g.fillStyle=p.ink;text(g,card.title,640,382,155,700,sans,1110);g.fillStyle=rgba(p.ink,.5);text(g,f.nameEn||'',640,438,31,400,latin);g.textAlign='left';g.fillStyle=rgba(p.ink,.72);lines(g,f.summary||'',128,520,1024,28);
  }else if(layout==='split'){
    g.fillStyle=rgba(p.accent,.12);g.fillRect(0,112,455,514);icon(g,img,177,190,100,p);g.fillStyle=p.ink;g.textAlign='center';text(g,card.title,228,400,68,650,sans,380);g.fillStyle=rgba(p.ink,.55);text(g,f.nameEn||'',228,449,23,400,latin,360);g.textAlign='left';g.fillStyle=p.accent;text(g,card.sub||'',520,254,38,500,latin,680);rule(g,520,294,665,rgba(p.accent,.35));g.fillStyle=p.ink;lines(g,f.summary||'',520,369,650,34);
  }else if(layout==='minimal'){
    icon(g,img,1104,143,88,p);g.fillStyle=p.ink;text(g,card.title,72,326,152,500,sans,1030);g.fillStyle=rgba(p.ink,.55);text(g,f.nameEn||'',80,386,29,400,latin);rule(g,80,448,130,p.accent);g.fillStyle=rgba(p.ink,.72);lines(g,f.summary||'',80,511,1090,31);
  }else{
    icon(g,img,76,183,112,p);g.fillStyle=p.ink;text(g,card.title,218,261,88,650,sans,950);g.fillStyle=rgba(p.ink,.5);text(g,f.nameEn||'',222,312,25,400,latin);g.fillStyle=rgba(p.ink,.76);lines(g,f.summary||'',80,414,1110,31);
  }
  if(layout==='editorial'||layout==='split'){
    let x=layout==='split'?520:80,y=layout==='split'?535:536;
    for(const value of (card.sub||'').split(' · ')){g.font=`500 24px ${latin}`;const w=g.measureText(value).width+36;g.strokeStyle=rgba(p.accent,.45);g.lineWidth=1;g.beginPath();g.roundRect(x,y-31,w,45,6);g.stroke();g.fillStyle=p.ink;g.fillText(value,x+18,y);x+=w+12;}
  }
  rule(g,76,634,1128,rgba(p.accent,.3));g.fillStyle=p.accent;text(g,card.sub||'',78,679,20,400,latin);g.textAlign='right';text(g,brand,1204,679,23,550,latin);return c;
}
