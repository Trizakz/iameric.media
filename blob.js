// Glass blob: a soft, slowly morphing drop of clear glass that floats behind the 3D tags in place of
// the CSS sphere. It refracts a glowing disc behind it, reflects a small studio of softboxes and has a
// thin-film (iridescent) sheen and rainbow dispersion at its edges.
//
//   const blob = await mountBlob(element, { idle, colors });  // fills the element with its own canvas
//   blob.setActive(i);   // tag i is hovered (-1: none): the disc behind slowly takes colors[i]
//   blob.dispose();      // stop for good and free the GPU (a sub page that closes)
//
// The backdrop light is an opaque-pass disc (transmission only sees opaque objects) that writes
// premultiplied alpha, so outside the light the canvas stays see-through onto the page.

// a newer three.js than the tags use: dispersion (rainbow edges in glass) arrived in r163
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

// Ashima 3D simplex noise (MIT), used for the blob's shape
const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

// a small studio for the reflections: a bright key softbox, coloured strips at the sides
function studio(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color('#070708');
  const card = (w, h, color, power, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  card(5, 3, '#f4fff6', 5, [-2.5, 5, 4]); // key softbox, top left
  card(1.2, 7, '#e8e6e0', 2.5, [6, 0.5, 1]); // strip right
  card(1.2, 7, '#d8d6d0', 1.6, [-6, -0.5, 0]); // strip left
  card(8, 2, '#8a8a90', 1.2, [0, -5, 3]); // grey bounce from below
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.03).texture;
  pmrem.dispose();
  return tex;
}

// the light behind the glass: a glowing disc like the old CSS sphere, a little smaller than the blob so
// its rim runs through the glass and shows the refraction; colour spots orbit inside it and a soft
// halo glows around it. All shades come from uColor, in display (sRGB) values: the shader writes
// straight to the canvas, without colour management.
function backdrop() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uLinear: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // no blending in the opaque pass: colour and alpha go to the canvas as they are (premultiplied)
    fragmentShader: /* glsl */ `
      uniform float uTime, uLinear; uniform vec3 uColor; varying vec2 vUv;
      // soft colour spots orbiting inside the disc, like the old CSS sphere (its periods: 23, 31, 19, 27 s)
      float spot(vec2 p, float period, float phase, float dist, float r) {
        float a = uTime * 6.2832 / period + phase;
        vec2 c = dist * vec2(cos(a), sin(a));
        return exp(-dot(p - c, p - c) / (r * r));
      }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);
        // shades of the current colour: deep, mid, light, and a cooler, bluer accent (a warm one turned the lavender peach)
        vec3 deep = uColor * 0.25, light = mix(uColor, vec3(1.0), 0.55), accent = uColor * vec3(0.9, 0.95, 1.3);
        vec3 inside = deep;
        inside = mix(inside, deep * 1.3, spot(p, 23.0, 0.0, 0.2, 0.22));
        inside = mix(inside, uColor, spot(p, -31.0, 2.0, 0.18, 0.2));
        inside = mix(inside, light, spot(p, 19.0, 4.0, 0.16, 0.17));
        inside = mix(inside, accent, 0.9 * spot(p, -27.0, 1.0, 0.2, 0.15));
        // coloured fringe just inside the rim, lighter on the lower left, like light splitting at a lens edge
        float fringe = smoothstep(0.24, 0.335, d) * smoothstep(0.345, 0.33, d);
        inside += fringe * mix(uColor, light, 0.5 - 0.5 * normalize(p + 1e-4).x) * 0.5;
        float disc = smoothstep(0.35, 0.33, d);
        float halo = exp(-pow(max(d - 0.33, 0.0) / 0.16, 2.0)) * 0.35;
        vec3 c = disc * inside + (1.0 - disc) * halo * uColor;
        // the glass reads this as linear light and encodes it again: give it linear values, or it washes out
        if (uLinear > 0.5) c = pow(c, vec3(2.2));
        gl_FragColor = vec4(c, clamp(max(disc, max(c.r, max(c.g, c.b)) * 1.6), 0.0, 1.0));
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  // the transmission pass (what the glass sees) renders into a render target, the screen pass into none
  mesh.onBeforeRender = renderer => { mat.uniforms.uLinear.value = renderer.getRenderTarget() ? 1 : 0; };
  return mesh;
}

// clear glass with a thin-film sheen; its shape is a sphere pushed in and out by two layers of noise
function glassBlob(envMap) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    transmission: 1,
    thickness: 0.4,
    ior: 1.5,
    roughness: 0.0,
    metalness: 0,
    dispersion: 5, // each colour bends a little differently: rainbow fringes where the glass is steep
    iridescence: 0.4,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [180, 700],
    specularIntensity: 1,
    envMap,
    envMapIntensity: 0.4,
    transparent: true, // for the soft outline // the studio's reflections also whiten the edges at grazing angles
  });
  const uniforms = { uTime: { value: 0 }, uAmp: { value: 0.14 } };
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uAmp;
        ${NOISE_GLSL}
        float blobD(vec3 p) {
          return uAmp * (snoise(p * 0.8 + vec3(0.0, uTime * 0.1, uTime * 0.05))
            + 0.2 * snoise(p * 1.7 - vec3(uTime * 0.12, 0.0, uTime * 0.08)));
        }
        vec3 blobP(vec3 p) { return p * (1.0 + blobD(p)); }`)
      // the normal of the pushed surface, from two neighbouring points on the sphere
      .replace('#include <beginnormal_vertex>', `
        vec3 bN = normalize(position);
        vec3 bT = normalize(cross(bN, abs(bN.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 bB = cross(bN, bT);
        vec3 bP = blobP(position);
        vec3 bP1 = blobP(normalize(position + bT * 0.01) * length(position));
        vec3 bP2 = blobP(normalize(position + bB * 0.01) * length(position));
        vec3 objectNormal = normalize(cross(bP1 - bP, bP2 - bP));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = bP;');
    // soft outline: the glass fades out where its surface turns away from the viewer, so the silhouette
    // is a blur instead of a sharp line
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
      gl_FragColor.a *= smoothstep(0.0, 0.4, saturate(dot(normal, normalize(vViewPosition))));`);
  };
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 48), mat);
  mesh.userData.uniforms = uniforms;
  return mesh;
}

export async function mountBlob(container, { idle = '#45464d', colors = [] } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.2;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  container.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0, 6.2);
  const back = backdrop();
  back.scale.setScalar(2.1);
  back.position.z = -1.6;
  scene.add(back);
  const blob = glassBlob(studio(renderer));
  scene.add(blob);

  function fit() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const resize = new ResizeObserver(fit);
  resize.observe(container);
  fit();

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // hover: the disc behind slowly takes the hovered tag's colour, and goes back to idle after
  const display = hex => new THREE.Color(hex).convertLinearToSRGB();
  let target = display(idle);
  const u = blob.userData.uniforms, bu = back.material.uniforms;
  bu.uColor.value.copy(target);
  let last = performance.now();

  function render(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = still ? 0 : now / 1000;
    u.uTime.value = t;
    bu.uTime.value = t;
    bu.uColor.value.lerp(target, 1 - Math.exp(-dt * 1.6)); // about 1.5 s to arrive
    blob.rotation.set(Math.sin(t * 0.07) * 0.25, t * 0.04, 0);
    renderer.render(scene, camera);
  }
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  render(performance.now());

  let onScreen = true, paused = false;
  const loop = () => renderer.setAnimationLoop(onScreen && !paused && !document.hidden ? render : null);
  const seen = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; loop(); });
  seen.observe(container);
  document.addEventListener('visibilitychange', loop);
  loop();

  return {
    // stop drawing while something covers it (e.g. an open sub page)
    setPaused(on) { paused = on; loop(); },
    setActive(i) {
      target = display(i >= 0 && colors[i] ? colors[i] : idle);
    },
    dispose() {
      paused = true;
      loop();
      resize.disconnect();
      seen.disconnect();
      document.removeEventListener('visibilitychange', loop);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
