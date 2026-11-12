/* Nurture lines: the home page background inside the reel frame.
   Endless scribbles in the spirit of Porter Robinson's "Nurture" visuals: pens scribble on a flat plane that a
   constant twist deformer (vertex shader) winds into a helix, while the camera zooms along the twist axis forever.
   Lines never fade; a segment is dropped only after the camera has flown past it. Rendered at 1/3 resolution and
   scaled up without smoothing, for the pixel look.
   The playground with a tuning panel is _nurture-lines.html (local only); the values below are the ones Eric
   chose there on 2026-11-11.

   mountNurtureLines(container, { background, clear }) puts a canvas into the container and returns { stop }.
   `clear` is an element (the text over the lines): lines running behind its text lines are dimmed in soft zones that
   follow each line's length, so it stays readable. */
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const P = {
  pens: 3,          // pens drawing at once
  speed: 80,        // pen speed (units/s)
  width: 242,       // half width of the drawing plane
  sharp: 0.02,      // chance per step of a sharp zigzag corner
  frantic: 0.004,   // chance per step of a frantic back-and-forth burst
  burst: 3.2,       // speed multiplier during a burst
  tempo: 0.6,       // how much the calm speed varies
  climb: 0.012,     // pull back to the pen's home spot
  zoom: 45,         // endless zoom speed (units/s)
  pixel: 3,         // one render pixel in CSS px
  depth: 420,       // depth of the drawing area along the axis
  twist: 45,        // degrees per 100 units along the axis
  bend: 45,         // slow S-bend of the axis
  camDist: 560, camOff: 70,
  thick: 2.4, bloom: 0.07, tipGlow: 1.2,
};
const STEP = 2.5;   // segment length
const MAX_ZONES = 8; // text lines that can get a clearing box
const INK = new THREE.Color('#eeeae0');

const DEFORM = /* glsl */`
  uniform float uTwist, uBend, uTime;
  uniform float uNear, uFar;
  attribute float instanceBirth;
  varying float vBirth;
  varying float vFade;
  vec3 deform(vec3 p) {
    p.x += uBend * sin(p.y * 0.0042);
    p += 1.6 * vec3(sin(p.y * 0.03 + uTime * 0.8), cos(p.x * 0.03 + uTime * 0.7), sin(p.y * 0.025 + uTime * 0.6));
    float a = uTwist * p.y;
    float c = cos(a), s = sin(a);
    return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  }
`;

export function mountNurtureLines(container, { background = '#0a0b0d', clear = null } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1 / P.pixel);
  const canvas = renderer.domElement;
  canvas.className = 'reel-lines';
  canvas.setAttribute('aria-hidden', 'true');
  container.prepend(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 5000);
  const world = new THREE.Group();
  world.rotation.x = -Math.PI / 2;   // local (x, y, z) -> world (x, z, -y): the twist axis points into the screen
  scene.add(world);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), P.bloom, 0.25, 0.3));
  composer.addPass(new OutputPass());

  const life = (P.camDist + P.depth * 0.5 + P.width) / P.zoom + 2;   // by then a segment is behind the camera
  const U = {
    uTwist: { value: THREE.MathUtils.degToRad(P.twist) / 100 }, uBend: { value: P.bend }, uTime: { value: 0 },
    uLife: { value: life }, uBg: { value: new THREE.Color(background) }, uTipGlow: { value: P.tipGlow },
    uNear: { value: P.camDist * 0.6 }, uFar: { value: P.camDist + P.depth + 300 },
    // one clearing box per text line of the `clear` element, in drawing-buffer pixels (x0, y0, x1, y1; y from the bottom)
    uClear: { value: Array.from({ length: MAX_ZONES }, () => new THREE.Vector4(-1e4, -1e4, -1e4, -1e4)) },
    uClearN: { value: 0 }, uFeather: { value: 1 },
  };

  // opaque lines (overlapping segment caps would add up into dots); fading = mixing toward the background
  const mat = new LineMaterial({ linewidth: P.thick, worldUnits: true, vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = DEFORM + sh.vertexShader
      .replace('vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );',
               'vec4 start = modelViewMatrix * vec4( deform(instanceStart), 1.0 );')
      .replace('vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );',
               'vec4 end = modelViewMatrix * vec4( deform(instanceEnd), 1.0 );\n' +
               'vBirth = instanceBirth;\n' +
               'float dist = -start.z;\n' +
               'vFade = mix( 0.06, 1.0, smoothstep( uFar, uNear, dist ) ) * step( 0.0, dist );');
    sh.fragmentShader = 'uniform float uTime, uLife, uTipGlow, uFeather;\nuniform int uClearN;\nuniform vec4 uClear[ ' + MAX_ZONES + ' ];\nuniform vec3 uBg;\nvarying float vBirth;\nvarying float vFade;\n' + sh.fragmentShader
      .replace('float alpha = opacity;',
               'float age = uTime - vBirth;\n' +
               'if ( age > uLife || age < 0.0 ) discard;\n' +
               'float alpha = opacity * vFade;\n' +
               // distance to the nearest text line box: inside one, lines drop to 10 %, then come back over uFeather px
               'float cdist = 1e5;\n' +
               'for ( int i = 0; i < ' + MAX_ZONES + '; i++ ) {\n' +
               '  if ( i >= uClearN ) break;\n' +
               '  vec2 cd = max( max( uClear[ i ].xy - gl_FragCoord.xy, gl_FragCoord.xy - uClear[ i ].zw ), 0.0 );\n' +
               '  cdist = min( cdist, length( cd ) );\n' +
               '}\n' +
               'alpha *= mix( 0.1, 1.0, smoothstep( 0.0, uFeather, cdist ) );')
      .replace('gl_FragColor = vec4( diffuseColor.rgb, alpha );',
               'gl_FragColor = vec4( mix( uBg, diffuseColor.rgb * ( 1.0 + uTipGlow * exp( -age * 2.2 ) ), alpha ), 1.0 );');
  };

  // ring buffer of segments
  const cap = Math.ceil(P.pens * (P.speed * (1 + P.tempo) / STEP * 1.6) * life * 1.3);
  const geo = new LineSegmentsGeometry();
  geo.setPositions(new Float32Array(cap * 6));
  geo.setColors(new Float32Array(cap * 6));
  geo.setAttribute('instanceBirth', new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(-1e6), 1));
  const pos = geo.attributes.instanceStart.data, col = geo.attributes.instanceColorStart.data, bir = geo.attributes.instanceBirth;
  const mesh = new LineSegments2(geo, mat);
  mesh.frustumCulled = false;
  world.add(mesh);
  let ri = 0, rn = 0;
  const push = (a, b, t) => {
    const k = ri * 6, p = pos.array, q = col.array;
    p[k] = a[0]; p[k + 1] = a[1]; p[k + 2] = a[2]; p[k + 3] = b[0]; p[k + 4] = b[1]; p[k + 5] = b[2];
    q[k] = q[k + 3] = INK.r; q[k + 1] = q[k + 4] = INK.g; q[k + 2] = q[k + 5] = INK.b;
    bir.array[ri] = t;
    ri = (ri + 1) % cap; rn++;
  };
  const flush = () => {
    if (!rn) return;
    const n = Math.min(rn, cap), s = (ri - n + cap) % cap;
    const spans = s + n <= cap ? [[s, n]] : [[s, cap - s], [0, n - (cap - s)]];
    for (const [a, c] of spans) { pos.addUpdateRange(a * 6, c * 6); col.addUpdateRange(a * 6, c * 6); bir.addUpdateRange(a, c); }
    pos.needsUpdate = col.needsUpdate = bir.needsUpdate = true;
    rn = 0;
  };

  // pens: each scribbles around its own home spot in a frame that rides ahead of the camera
  const rnd = Math.random;
  const wrap = (d) => Math.atan2(Math.sin(d), Math.cos(d));
  const cam = { v: 0 };
  let clock = 0;
  const order = [...Array(P.pens).keys()].sort(() => rnd() - 0.5);
  const pens = order.map((lane, i) => ({
    home: -P.width + 2 * P.width * (lane + 0.5) / P.pens,
    vOff: P.depth * (0.5 - i / Math.max(P.pens - 1, 1)),
    w: 0, z: (rnd() - 0.5) * 120, a: Math.PI / 2 + (rnd() - 0.5) * 2, k: 0,
    mul: 1, mulTarget: 1, acc: 0, frantic: 0, zigs: 0, last: null,
  }));
  pens.forEach((p) => { p.u = p.home; p.v = p.vOff; });

  function move(p) {
    p.u += Math.cos(p.a) * STEP;
    p.w += Math.sin(p.a) * STEP;
    p.v = cam.v + p.vOff + p.w;
  }
  function stepPen(p) {
    if (rnd() < 0.012) p.mulTarget = 1 + (rnd() * 2 - 1) * P.tempo;
    p.mul += (p.mulTarget - p.mul) * 0.04;
    // frantic burst: fast long strokes with near-full reversals, like scribbling hard back and forth
    if (!p.frantic && rnd() < P.frantic) { p.frantic = 25 + Math.floor(rnd() * 70); p.fGap = 0; p.zigDir = rnd() < 0.5 ? -1 : 1; }
    if (p.frantic > 0) {
      p.frantic--;
      if (--p.fGap <= 0) {
        p.a += p.zigDir * (2.65 + rnd() * 0.45);
        p.zigDir = -p.zigDir;
        p.fGap = 6 + Math.floor(rnd() * 16);
      }
      p.a += (rnd() - 0.5) * 0.05;
      if (Math.abs(p.u) > P.width * 1.2 || Math.abs(p.w) > P.depth * 0.6) p.a += wrap(Math.atan2(-p.w, p.home - p.u) - p.a) * 0.2;
      p.k = 0;
      move(p);
      return;
    }
    // calm: wandering curvature, cursive loops, a soft pull home
    p.k += (rnd() - 0.5) * 0.07;
    p.k *= 0.95;
    if (rnd() < 0.014) p.k = (rnd() < 0.5 ? -1 : 1) * (0.16 + rnd() * 0.18);
    const looping = Math.abs(p.k) > 0.1;
    const out = Math.abs(p.u) > P.width || Math.abs(p.w) > P.depth * 0.5;
    const want = Math.atan2(-p.w / (P.depth * 0.5 + 1), (p.home - p.u) / P.width);
    p.a += wrap(want - p.a) * (looping ? 0.001 : out ? 0.08 : P.climb);
    p.a += p.k;
    // sharp zigzag corners
    if (!p.zigs && rnd() < P.sharp) { p.zigs = 1 + Math.floor(rnd() * 4); p.zigGap = 0; p.zigDir = rnd() < 0.5 ? -1 : 1; }
    if (p.zigs > 0 && --p.zigGap <= 0) {
      p.a += p.zigDir * (1.9 + rnd() * 0.9);
      p.zigDir = -p.zigDir;
      p.k = 0;
      p.zigs--;
      p.zigGap = 3 + Math.floor(rnd() * 9);
    }
    move(p);
  }

  function simulate(dt) {
    clock += dt;
    cam.v += P.zoom * dt;
    for (const p of pens) {
      p.acc += P.speed * p.mul * (p.frantic > 0 ? P.burst : 1) * dt;
      while (p.acc >= STEP) {
        p.acc -= STEP;
        stepPen(p);
        const cur = [p.u, p.v, p.z];
        if (p.last) push(p.last, cur, clock);
        p.last = cur;
      }
    }
    flush();
  }

  const back = new THREE.Vector3(), ahead = new THREE.Vector3();
  const deformJS = (v, out) => {
    const x = U.uBend.value * Math.sin(v * 0.0042), a = U.uTwist.value * v;
    return out.set(Math.cos(a) * x, v, Math.sin(a) * x);
  };
  function render() {
    U.uTime.value = clock;
    deformJS(cam.v - P.camDist, back);
    deformJS(cam.v + 150, ahead);
    camera.position.set(back.x + P.camOff, back.z + P.camOff * 0.5, -back.y);
    camera.lookAt(ahead.x, ahead.z, -ahead.y);
    composer.render();
  }

  // one box per rendered text line (the line's real length), in drawing-buffer pixels, with a little air around it
  const PAD = 10, FEATHER = 48;
  const range = document.createRange();
  function updateClear() {
    if (!clear) return;
    range.selectNodeContents(clear);
    const lines = [];
    for (const r of [...range.getClientRects()].sort((a, b) => a.top - b.top || a.left - b.left)) {
      if (!r.width) continue;
      const line = lines.find((l) => Math.abs(l.top - r.top) < r.height / 2);   // pieces of the same line (spans, link)
      if (line) { line.left = Math.min(line.left, r.left); line.right = Math.max(line.right, r.right); line.bottom = Math.max(line.bottom, r.bottom); }
      else lines.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
    }
    const c = container.getBoundingClientRect(), k = 1 / P.pixel;
    lines.slice(0, MAX_ZONES).forEach((l, i) => U.uClear.value[i].set(
      (l.left - c.left - PAD) * k, (c.bottom - l.bottom - PAD) * k, (l.right - c.left + PAD) * k, (c.bottom - l.top + PAD) * k));
    U.uClearN.value = Math.min(lines.length, MAX_ZONES);
    U.uFeather.value = FEATHER * k;
  }

  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(1 / P.pixel);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(1 / P.pixel);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 50 + 20 * (1 - w / h) : 50;   // narrow frames: wider view
    camera.updateProjectionMatrix();
    mat.resolution.set(w, h);
    updateClear();
    if (reduced) render();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  if (clear) ro.observe(clear);   // the text rewraps with the width and when the font arrives
  resize();

  // the scene starts already drawn, so the frame never opens on an empty screen
  for (let i = 0; i < 240; i++) simulate(1 / 60);

  if (reduced) {
    render();
    return { stop() { ro.disconnect(); renderer.dispose(); } };
  }

  // run only while the frame is on screen and the tab is visible
  let last = performance.now(), onScreen = true;
  const frame = (now) => {
    simulate(Math.min((now - last) / 1000, 1 / 20));
    last = now;
    render();
  };
  const sync = () => {
    last = performance.now();
    renderer.setAnimationLoop(onScreen && !document.hidden ? frame : null);
  };
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); });
  io.observe(container);
  document.addEventListener('visibilitychange', sync);
  sync();
  return {
    stop() {
      renderer.setAnimationLoop(null);
      io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', sync);
      renderer.dispose();
    },
  };
}
