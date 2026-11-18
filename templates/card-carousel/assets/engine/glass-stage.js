// 玻璃舞台：按边缘坡度折射后方光场；坐标、光照和缓动只由时间决定。
// 设计依据：design-style / 014-liquid-glass 的无色玻璃、边缘折射与光池。
import * as THREE from 'three';

export function glassStage() {
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      precision highp float;
      uniform float time;
      varying vec2 vUv;
      float bell(vec2 p,vec2 c,vec2 s){vec2 d=(p-c)/s;return exp(-dot(d,d)*2.0);}
      vec3 lightField(vec2 p){
        vec3 c=vec3(0.027,0.019,0.021);
        c+=vec3(0.13,0.084,0.057)*bell(p,vec2(1060.0,580.0),vec2(1150.0,800.0));
        c+=vec3(0.29,0.18,0.11)*bell(p,vec2(1030.0,1080.0),vec2(1350.0,430.0));
        c+=vec3(0.031,0.054,0.10)*bell(p,vec2(1690.0,160.0),vec2(650.0,800.0));
        float sweep=p.y-(1020.0-0.09*p.x+12.0*sin(time*0.12));
        c+=vec3(0.11,0.072,0.042)*exp(-pow(sweep/100.0,2.0))*smoothstep(600.0,1600.0,p.x);
        return c;
      }
      float ribbon(vec2 p,int id){
        vec2 center=id==0?vec2(2360.0+35.0*sin(time*0.1),30.0):vec2(-520.0,1940.0+20.0*sin(time*0.09));
        vec2 radii=id==0?vec2(1390.0,1460.0):vec2(2440.0,1030.0);
        float width=id==0?110.0:75.0;
        return abs(length((p-center)/radii)-1.0)*min(radii.x,radii.y)-width;
      }
      vec3 glass(vec2 p,vec3 c,int id){
        float d=ribbon(p,id);
        vec2 e=vec2(0.8,0.0);
        vec2 normal=normalize(vec2(ribbon(p+e.xy,id)-ribbon(p-e.xy,id),ribbon(p+e.yx,id)-ribbon(p-e.yx,id))+vec2(0.00001));
        float shadow=exp(-max(ribbon(p-vec2(11.0,24.0),id),0.0)/25.0)*(1.0-smoothstep(-10.0,0.0,d));
        c*=1.0-0.10*shadow;
        if(d<1.5){
          float depth=max(-d,0.0);
          float slope=pow(1.0-clamp(depth/84.0,0.0,1.0),2.4);
          vec2 offset=-normal*(72.0*slope+4.0);
          vec3 refracted=vec3(lightField(p+offset*1.025).r,lightField(p+offset).g,lightField(p+offset*0.975).b);
          float face=1.0-smoothstep(-1.5,1.5,d);
          c=mix(c,refracted*0.95+vec3(0.009,0.010,0.016),face);
          float fresnel=exp(-depth/21.0);
          float facing=dot(normal,normalize(vec2(-0.65,-0.76)));
          vec3 reflection=mix(vec3(0.42,0.54,0.80),vec3(0.95,0.78,0.56),smoothstep(-0.5,0.8,facing));
          c+=reflection*(0.065+0.23*pow(abs(facing),7.0))*fresnel*face;
          float edge=exp(-pow(depth/1.8,2.0));
          c+=vec3(0.8,0.86,0.96)*edge*(0.08+0.25*max(facing,0.0))*face;
          float caustic=exp(-pow((depth-35.0)/13.0,2.0));
          c+=vec3(0.12,0.076,0.039)*caustic*pow(max(facing,0.0),3.0)*face;
        }
        return c;
      }
      void main(){
        vec2 p=vec2(vUv.x,1.0-vUv.y)*vec2(1920.0,1080.0);
        vec3 c=lightField(p);
        c=glass(p,c,1);c=glass(p,c,0);
        gl_FragColor=vec4(c,1.0);
      }`,
    depthTest: false, depthWrite: false, fog: false,
  });
  return { material, update: time => { material.uniforms.time.value = time; } };
}
