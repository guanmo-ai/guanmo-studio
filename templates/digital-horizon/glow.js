const vertex = `#version 300 es
void main() {
  vec2 pt = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pt * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform vec3 uTint;
uniform float uTime;
out vec4 pixel;

float bell(float a) { return exp(-a*a); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(91.17, 47.53))) * 43758.5453); }
float cloud(vec2 p) {
  vec2 cell = floor(p), v = fract(p);
  v = v*v*(3.0-2.0*v);
  return mix(mix(hash(cell), hash(cell + vec2(1,0)), v.x),
             mix(hash(cell + vec2(0,1)), hash(cell + vec2(1,1)), v.x), v.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float x = (uv.x - 0.5) * 1920.0;
  float y = (1.0 - uv.y) * 1080.0;
  float side = x / 960.0;
  float bend = 5.0 * bell((abs(x) - 560.0) / 275.0) - 2.6 * smoothstep(760.0, 960.0, abs(x));
  float arcOffset = -0.61 + side * (2.96 + side * (-1.71 + side * (-2.50 + 5.02 * side)));
  float edge = 627.0 + (2960.0 - sqrt(2960.0*2960.0 - x*x)) + bend + x / 540.0 + arcOffset;
  float d = y - edge;
  float above = max(-d, 0.0), below = max(d, 0.0);
  float softMask = smoothstep(-2.0, 8.0, d);

  // 按参考片的弧光、天空和下方暗面分别校准颜色。
  float center = bell((x + 28.0) / 343.0);
  float air = exp(-above / 55.0) * (1.0 - 0.53 * center);
  air *= 0.91 + 0.09 * bell(x / 800.0);
  vec2 drift = vec2((x + 28.0) / 265.0, (y - 627.0) / 150.0);
  float veil = 0.975 + 0.05 * cloud(drift + vec2(uTime * 0.075, -uTime * 0.11));
  float plume = bell((y - 624.0) / 174.0) * center;
  float upperHaze = bell((y - 500.0) / 118.0) * bell((x + 25.0) / 466.0);
  vec3 sky = vec3(0.455, 0.237, 0.096) * air
           + vec3(0.728, 0.539, 0.377) * plume * veil
           + vec3(0.092, 0.043, 0.014) * upperHaze;

  float shade = bell((x + 20.0) / 592.0);
  vec3 face = vec3(0.328, 0.172, 0.065) * bell(below / 215.0) * shade
            + vec3(0.102, 0.039, 0.011) * (1.0 - 0.55 * shade) * exp(-below / 47.0)
            + vec3(0.050, 0.088, 0.122) * bell(below / 110.0) * bell((x + 21.0) / 350.0);
  vec3 light = mix(sky, face, softMask);

  float rim = exp(-pow(abs(d + 0.33) / 1.48, 1.55));
  vec3 rimColor = mix(vec3(0.47, 0.315, 0.180), vec3(0.54, 0.485, 0.422), bell(x / 520.0));
  light += rimColor * rim + vec3(0.184, 0.137, 0.098) * exp(-abs(d) / 12.0);

  float sunX = x + 6.0 + 1.65 * sin(uTime * 0.67);
  float pulse = 1.0 + 0.013 * sin(uTime * 1.65);
  vec3 flare = vec3(0.32, 0.33, 0.345) * bell(sunX / 44.0) * bell((y - 620.0) / 23.0)
             + vec3(0.140, 0.247, 0.337) * bell(sunX / 124.0) * bell((y - 619.0) / 53.0);
  light += flare * pulse;
  light += vec3(0.184, 0.088, 0.019) * bell(sunX / 106.0) * bell((y - 649.0) / 38.0) * softMask;
  // #ffa466 对应参考色。自选色只调弧光的色差，保留接近白色的光心。
  vec3 referenceTint = vec3(1.0, 164.0 / 255.0, 102.0 / 255.0);
  float chroma = max(0.0, light.r - min(light.g, light.b));
  light += 1.4 * chroma * (uTint - referenceTint);
  // 固定在画面上的亚像素抖动，用于压低暗部色带。
  float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
  pixel = vec4(clamp(light + dither / 255.0, 0.0, 1.0), 1.0);
}`;

export function drawHorizon(canvas, tint) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
  if (!gl) throw new Error('数字地平线需要 WebGL2');
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), canvas.width, canvas.height);
  gl.uniform3fv(gl.getUniformLocation(program, 'uTint'), tint);
  const time = gl.getUniformLocation(program, 'uTime');
  return seconds => {
    gl.uniform1f(time, seconds);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}
