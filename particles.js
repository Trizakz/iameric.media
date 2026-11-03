// PS5-style ambience over the whole window: a wide, soft shaft of light from above the top left and a few hundred
// specks of dust drifting through the room. Specks near the viewer are large, out-of-focus discs
// (bokeh), far ones tiny points; they twinkle and light up where they cross the beam.
//
//
//   const particles = mountParticles(element);   // fills the element with its own canvas
//   particles.setPaused(true);                   // stop drawing while something covers the page

import * as THREE from 'three';

// light adds onto what is under it; the shaders output premultiplied colour
const ADD = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
const shared = /* glsl */ `
  uniform float uTime, uAspect;
  // the light shaft: a wide, soft cone from above the top left, slanting down to the right (screen
  // units, y up); it drifts and swings very slowly, so it never looks pinned to the edge
  float beam(vec2 s) {
    vec2 o = vec2((-0.4 + 0.1 * sin(uTime * 0.05)) * uAspect, 1.35);
    vec2 dir = normalize(vec2(0.38 + 0.06 * sin(uTime * 0.07 + 1.0), -1.0));
    vec2 d = s - o;
    float along = dot(d, dir), across = abs(d.x * dir.y - d.y * dir.x);
    float width = 0.3 + along * 0.5; // widens as it falls
    return exp(-pow(across / width, 2.0)) * smoothstep(-0.2, 0.6, along) * smoothstep(3.4, 1.2, along);
  }
`;
const VARIANTS = {
  // the home page: the PS5 look, a shaft from the top left and plenty of bright dust
  home: {
    count: 520,
    // off-white like the tags' side parts, with a little of the accent
    colors: ['#f2f0ea', '#f2f0ea', '#f2f0ea', '#dcd8cd', '#ffa67f'],
    light: shared,
    // slow drift: upwards and to the right, faster when near (parallax), with a lazy sway
    motion: 'position.xy + vec2(0.012, 0.02) * uTime * (0.3 + z * 1.2) + 0.03 * vec2(sin(uTime * 0.21 + seed * 40.0), cos(uTime * 0.17 + seed * 30.0))',
    lit: '0.1 + 1.2 * beam(s)',
    twinkle: 1.5,
    size: [2.0, 5.0, 7.0],
    bokeh: 0.07,
    haze: [0.95, 0.94, 0.92, 0.1],
  },
};

function dust(v) {
  const COUNT = v.count, COLORS = v.colors.map(c => new THREE.Color(c));
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3), seed = new Float32Array(COUNT), col = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random()], i * 3); // x, y in the window, depth 0 far .. 1 near
    seed[i] = Math.random();
    COLORS[Math.floor(Math.random() * COLORS.length)].toArray(col, i * 3);
  }
  // most specks far away, only a few close to the viewer
  for (let i = 0; i < COUNT; i++) pos[i * 3 + 2] = Math.pow(pos[i * 3 + 2], 3.0);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAspect: { value: 1 }, uScale: { value: 1 }, uFade: { value: 0 } },
    transparent: true,
    depthWrite: false,
    ...ADD,
    vertexShader: v.light + /* glsl */ `
      uniform float uScale;
      attribute float seed;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vAlpha, vSoft;
      void main() {
        float z = position.z;
        vec2 p = ${v.motion};
        p = mod(p + 1.1, 2.2) - 1.1; // wrap around the window, a little beyond its edges
        vec2 s = vec2(p.x * uAspect, p.y);
        float twinkle = 0.55 + 0.45 * sin(uTime * (1.2 + seed * 2.5) + seed * 60.0);
        float lit = ${v.lit};
        vSoft = smoothstep(0.7, 0.95, z); // near: an out-of-focus disc
        vAlpha = lit * mix(twinkle * ${v.twinkle.toFixed(2)}, 0.3, vSoft) * mix(1.0, ${v.bokeh.toFixed(2)}, vSoft); // bokeh stays faint
        vColor = color;
        gl_PointSize = uScale * mix(${v.size[0].toFixed(1)}, ${v.size[1].toFixed(1)}, z * z) * (1.0 + vSoft * ${v.size[2].toFixed(1)});
        gl_Position = vec4(p, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying vec3 vColor;
      varying float vAlpha, vSoft;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        // far: a bright core with a little glow; near: a flat disc with a soft, slightly brighter edge
        float point = exp(-r * r * 6.0);
        float disc = smoothstep(1.0, 0.82, r) * (0.75 + 0.25 * smoothstep(0.5, 0.95, r));
        float a = mix(point, disc, vSoft) * vAlpha * uFade;
        gl_FragColor = vec4(vColor * a, a);
      }`,
  });
  return new THREE.Points(geo, mat);
}

// the shaft itself: a faint warm haze, additive over the page
function shaft(v) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAspect: { value: 1 }, uFade: { value: 0 } },
    transparent: true,
    depthWrite: false,
    ...ADD,
    vertexShader: 'varying vec2 vS; uniform float uAspect; void main() { vS = vec2(position.x * uAspect, position.y); gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: v.light + /* glsl */ `
      uniform float uFade;
      varying vec2 vS;
      void main() {
        float b = beam(vS) * (0.85 + 0.15 * sin(uTime * 0.3)); // breathes very slowly
        vec3 c = vec3(${v.haze.slice(0, 3).map(n => n.toFixed(2)).join(', ')}) * b * ${v.haze[3].toFixed(2)} * uFade;
        gl_FragColor = vec4(c, 0.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  return mesh;
}

export function mountParticles(container) {
  const v = VARIANTS.home;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  container.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.Camera(); // the shaders work in clip space
  const light = shaft(v), specks = dust(v);
  specks.frustumCulled = false;
  scene.add(light, specks);
  const mats = [light.material, specks.material];

  function fit() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    mats.forEach(m => { m.uniforms.uAspect.value = w / h; });
    specks.material.uniforms.uScale.value = dpr * Math.min(1.4, Math.max(0.8, h / 900));
  }
  const resize = new ResizeObserver(fit);
  resize.observe(container);
  fit();

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let start = null;
  function render(now) {
    start ??= now;
    const t = (now - start) / 1000;
    mats.forEach(m => {
      m.uniforms.uTime.value = still ? 0 : t + 40; // start mid-drift, not with every speck at its seed
      m.uniforms.uFade.value = still ? 1 : Math.min(1, t / 2.5); // fades in with the intro
    });
    renderer.render(scene, camera);
  }

  let paused = false;
  const loop = () => renderer.setAnimationLoop(!paused && !document.hidden ? render : null);
  document.addEventListener('visibilitychange', loop);
  loop();

  return {
    setPaused(on) { paused = on; loop(); },
  };
}
