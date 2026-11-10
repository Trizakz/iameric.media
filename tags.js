// 3D tags: small handheld devices (two-tone rounded body, backlit main screen, a narrow icon screen,
// a milky play button that wraps around the end, side parts), stacked at angles and floating
// gently. Built from code, no model files. The body is matte.
// Idle, the main screen is in always-on mode: black, only the title and subtitle in white. On hover it
// switches on: moving gradient in the key colour with the full layout in dark ink. The icon screen is
// always on.
// On load the tags boot one after another: each slides up into place, its icon screen flickers on,
// then the title fades in on the main screen.
//
// Usage:
//   import { mountTags } from './tags.js';
//   const tags = await mountTags(document.querySelector('.tags'), [
//     { title: 'projects', sub: 'video, editing, web', icon: 'movie', href: 'projects.html', scheme: 'a' },
//   ]);
//   tags.highlight(0);          // light up a tag from outside, -1 for none
//   tags.setSchemes({ a: {...}, b: {...} }); // recolour (same shape as SCHEMES)
//
// Options (third argument): `{ focusBlur: true }` gives the stack a depth of field: while a tag is
// hovered or focused, the others go slightly soft and a little darker so the selected one stands out.
//
// `icon` is a Material Symbols name; the page must load that icon in its Material Symbols font link.
//
// The materials, studio light and glass are exported too, so other 3D devices on the site can be made
// of exactly the same stuff.
//
// `{ returnTo: i }`: the page was entered by coming back from tag i's page, so instead of the intro
// that tag starts zoomed in (screen covering the window) and flies back to its place.
//
// Events on the container: `tagactive` (detail: index of the hovered/focused tag, -1 for none) and
// `taglaunch` (detail: { href, color }) when a tag has zoomed in after a click; call preventDefault()
// on it to do the page change yourself (e.g. with a fade), otherwise the module navigates.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// two colour schemes (one dark-green ramp, cream side part), both with a coloured two-tone body: `front` and `back` are the two
// shells, `side` is the neutral right part of the front shell (the icon screen and play button column),
// `keys` colours the play button and the side button; the screen gradients run from a lighter to a
// darker shade of `keys`
export const SCHEMES = {
  a: { front: '#232327', back: '#131316', side: '#dcd8cd', keys: '#a68cff' },
  b: { front: '#45464d', back: '#232327', side: '#dcd8cd', keys: '#cbbcff' },
};
export const COLORS = {
  bezel: '#121411',
  port: '#1c1e19',
  ink: '#1d211a',
  aod: '#eef2ea', // always-on text
  page: '#0b0b0c', // the sub pages' dark ground (same as the home page's --bg); a zooming screen ends in this colour
};

// device size in scene units (landscape, like the reference)
const W = 2.4, H = 1.1, D = 0.34, R = 0.18;
const SCREEN_W = 1.43, SCREEN_H = 0.76;
const BEZEL_TOP = (SCREEN_H + 0.12) / 2; // the icon screen lines up with the main screen's top edge
const SPLIT = 0.02; // z where the front shell meets the coloured back shell
const SPLIT_X = 0.51; // x where the front shell's coloured left part meets its neutral right part
// where the raised parts sit on the body (also used for the ambient occlusion in twoTone)
const SCREEN_X = -0.33; // main screen centre
const COL_X = 0.8; // right column: icon screen and play button
const ICON_BEZEL_H = 0.2;
const PLAY_X0 = 0.57, PLAY_YB = -0.36, PLAY_YT = -0.06; // play sleeve: left edge, bottom, top
// left end: USB-C port in the middle, 3.5 mm jack below it (sizes roughly true to scale, 1 unit ~ 40 mm)
const USB_H = 0.21, USB_W = 0.066;
const JACK_Y = -0.27, JACK_R = 0.045; // jack: hole radius
const PORT_DEPTH = 0.07; // how far both openings go into the body
// lanyard: two small holes either side of the top-right corner, one in the top edge and one in the
// right end, so a strap would run through the corner (the strap itself is not modelled)
const LANYARD_TOP_X = W / 2 - 0.2, LANYARD_END_Y = H / 2 - 0.2, LANYARD_R = 0.017;
const LIP = 0.007; // width of the metal rim round each opening
// volume rocker on the bottom edge
const ROCKER_X = -0.25, ROCKER_L = 0.9, ROCKER_W = 0.11;
const f3 = v => v.toFixed(3);

export function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// additive blending that adds light but leaves alpha alone. Plain AdditiveBlending also adds to alpha,
// which pushes it past 1 in the float render targets and breaks the depth of field, where the soft
// tags are slid in behind using the frame's alpha.
export const ADD_LIGHT = {
  blending: THREE.CustomBlending,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};

export function canvasTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// the main screen's foreground, divided like the reference: the link title very large, the subtitle,
// a rule, and a dark bar at the bottom with an "open" prompt and the target path. Transparent canvas;
// the screen colour comes from the gradient layer underneath. With `aod` only the title and subtitle
// are drawn, in white, for the always-on look on the black idle screen.
function screenTexture(tag, aod) {
  const c = document.createElement('canvas');
  c.width = 1144;
  c.height = 608;
  const g = c.getContext('2d');
  g.fillStyle = g.strokeStyle = aod ? COLORS.aod : COLORS.ink;

  // the link title, as large as the width allows
  const title = tag.title || '';
  g.font = '500 250px "DM Sans", sans-serif';
  if ('letterSpacing' in g) g.letterSpacing = '-9px';
  const fit = Math.min(1, (c.width - 112) / g.measureText(title).width);
  g.font = `500 ${Math.floor(250 * fit)}px "DM Sans", sans-serif`;
  g.fillText(title, 50, 260);
  if ('letterSpacing' in g) g.letterSpacing = '0px';

  g.font = '400 50px "Fira Mono", monospace';
  // full strength on the lit screen, where the gradient's darker end would swallow a faded line
  g.globalAlpha = aod ? 0.75 : 1;
  g.fillText(tag.sub || '', 58, 350, c.width - 116);
  g.globalAlpha = 1;
  if (aod) return canvasTexture(c);
  g.fillRect(56, 396, c.width - 112, 4);

  // bottom bar: ▶ open on the left, the path on the right of a divider
  g.beginPath();
  g.roundRect(48, 438, c.width - 96, 116, 18);
  g.fill();
  g.fillStyle = '#eef4e1';
  g.beginPath();
  g.moveTo(92, 470);
  g.lineTo(130, 496);
  g.lineTo(92, 522);
  g.fill();
  g.font = '400 46px "Fira Mono", monospace';
  g.fillText('open', 152, 512);
  g.fillRect(c.width - 400, 462, 3, 68);
  g.textAlign = 'right';
  g.fillText(`/${tag.title}`, c.width - 92, 512); // the page's name
  return canvasTexture(c);
}

// terminal cursor "_" right after the title on the lit screen, on its own layer so it can blink;
// same canvas size and title metrics as screenTexture
function cursorTexture(tag) {
  const c = document.createElement('canvas');
  c.width = 1144;
  c.height = 608;
  const g = c.getContext('2d');
  const title = tag.title || '';
  g.font = '500 250px "DM Sans", sans-serif';
  if ('letterSpacing' in g) g.letterSpacing = '-9px';
  const size = Math.floor(250 * Math.min(1, (c.width - 112) / g.measureText(title).width));
  g.font = `500 ${size}px "DM Sans", sans-serif`;
  const x = 50 + g.measureText(title).width + size * 0.06;
  g.fillStyle = COLORS.ink;
  g.fillRect(x, 260 + size * 0.02, size * 0.4, size * 0.075);
  return canvasTexture(c);
}

// the narrow icon screen's foreground, redrawn when something changes: the link's icon, the local time
// in Halle (Saale), a divider and the iameric logo (assets/logo.svg). Transparent canvas over the gradient;
// `color` is the ink.
export const CLOCK = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
// the logo's parts in its own 22..178 box (assets/logo.svg): the i dot, the join, the ring with its eye
const LOGO = new Path2D('M39.52 58.45a18.93 18.93 0 1 0 37.86 0a18.93 18.93 0 1 0 -37.86 0Z'
  + 'M105.15 58.45A36.4 36.4 0 1 1 141.55 94.85A46.7 46.7 0 0 0 94.85 141.55A36.4 36.4 0 1 1 58.45 105.15A46.7 46.7 0 0 0 105.15 58.45Z'
  + 'M105.15 141.55a36.4 36.4 0 1 0 72.8 0a36.4 36.4 0 1 0 -72.8 0ZM117.53 134.27a16.74 16.74 0 1 0 33.49 0a16.74 16.74 0 1 0 -33.49 0Z');
function iconScreen(tag, color) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 224;
  const g = c.getContext('2d');
  const texture = canvasTexture(c);
  let drawn = '';
  return {
    texture,
    draw(time) {
      const key = time;
      if (key === drawn) return;
      drawn = key;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = g.strokeStyle = color;
      g.textBaseline = 'middle';
      g.font = '120px "Material Symbols Rounded"';
      g.fillText(tag.icon || '', 26, c.height / 2 + 4);
      g.font = '400 74px "Fira Mono", monospace';
      g.fillText(time, 166, c.height / 2 + 4);
      g.fillRect(430, 52, 3, 120);
      // the logo, 104 px square, where the battery used to be
      g.save();
      g.translate(470, c.height / 2 - 52);
      g.scale(104 / 155.9, 104 / 155.9);
      g.translate(-22.05, -22.05);
      g.fill(LOGO, 'evenodd');
      g.restore();
      texture.needsUpdate = true;
    },
  };
}

// screen background: black when off, switching on to a gradient between a lighter and a darker shade
// of the key colour that drifts slowly back and forth, under a fine dot matrix like a real display.
// uFill 0..1 switches it on, uLevel scales the brightness, uCells sets the dot matrix density.
function gradientMaterial(color, cells, fill) {
  const base = new THREE.Color(color);
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: base.clone().offsetHSL(0, 0, 0.1) },
      uColor2: { value: base.clone().offsetHSL(0, 0, -0.12) },
      uTime: { value: 0 },
      uLevel: { value: 1 },
      uFill: { value: fill },
      uCells: { value: new THREE.Vector2(cells[0], cells[1]) },
      // during the zoom into a page the screen turns into the page's dark ground
      uDark: { value: new THREE.Color(COLORS.page) },
      uDarkMix: { value: 0 },
      // 0..1: a band of light running from the play button (right) across the screen after a press
      uWave: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uColor2;
      uniform float uTime;
      uniform float uLevel;
      uniform float uFill;
      uniform vec2 uCells;
      uniform vec3 uDark;
      uniform float uDarkMix;
      uniform float uWave;
      varying vec2 vUv;
      void main() {
        float edge = 0.55 + 0.22 * sin(uTime * 0.5) + 0.08 * sin(uTime * 1.3 + vUv.y * 3.0);
        float m = smoothstep(edge - 0.45, edge + 0.35, vUv.x);
        vec3 col = mix(vec3(0.0), mix(uColor, uColor2, m), uFill);
        // dot matrix, anti-aliased: dot edges are as soft as one screen pixel, and the pattern fades out
        // once a cell gets smaller than ~4 pixels, where it would only shimmer (moire)
        vec2 cellUv = vUv * uCells;
        vec2 cell = fract(cellUv) - 0.5;
        float px = max(fwidth(cellUv.x), fwidth(cellUv.y)); // cells per screen pixel
        float dotMask = smoothstep(0.36 + px, 0.36 - px, length(cell));
        col *= mix(1.0, mix(0.9, 1.0, dotMask), 1.0 - smoothstep(0.15, 0.3, px));
        // the bezel's lip shades the screen's edge a little
        vec2 e = min(vUv, 1.0 - vUv) * uCells / max(uCells.x, uCells.y);
        col *= mix(0.72, 1.0, smoothstep(0.0, 0.035, min(e.x, e.y)));
        float wave = uWave > 0.0 ? exp(-pow((vUv.x - (1.15 - uWave * 1.4)) * 5.0, 2.0)) * (1.0 - uWave) : 0.0;
        col += vec3(0.5) * wave * uFill;
        gl_FragColor = vec4(mix(col * uLevel, uDark, uDarkMix), 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

// soft spot used as the light the screen spills onto the bezel
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  r.addColorStop(0, 'rgba(240, 255, 220, 1)');
  r.addColorStop(1, 'rgba(240, 255, 220, 0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  return canvasTexture(c);
}
const GLOW = glowTexture();

// rounded-rect plane whose UVs run 0..1 across its width and height
export function panel(w, h, r, material) {
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(w, h, r), 8), material);
  const uv = mesh.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5);
  return mesh;
}

// photo-studio environment for the reflections, like an HDRI in Blender: a dark room with a large
// softbox overhead, a tall strip light on each side and a warm bounce card low in front. The rounded
// plastic and the screen glass pick these up as long, soft highlights.
export function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color('#08080a');
  const card = (w, h, color, power, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  card(7, 4, '#fff4e6', 6, [-1.5, 6, 3]); // key softbox
  card(1.4, 8, '#ffffff', 3, [-6, 0.5, 1.5]); // strip left
  card(1.4, 8, '#ececea', 2, [6, 0, -1]); // strip right
  card(9, 2.5, '#d6d2c8', 0.6, [0, -5, 4]); // warm bounce from below
  const pmrem = new THREE.PMREMGenerator(renderer);
  // a little blur keeps the softbox edges from turning into thin, flickering highlights on small bevels
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  return tex;
}

// soft-touch coating: a fine, slightly blurred stipple as bump (R) and a roughness of ~0.74-0.86 (G),
// so the rubber looks velvety and its highlights stay broad. The noise wraps round the tile edges.
function grainTexture() {
  const N = 256;
  const noise = Float32Array.from({ length: N * N }, Math.random);
  const at = (x, y) => noise[((y + N) % N) * N + (x + N) % N];
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // 3x3 tent blur: soft stipple instead of single-pixel noise, which sparkles while the tags move
      const h = (4 * at(x, y) + 2 * (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1))
        + at(x - 1, y - 1) + at(x + 1, y - 1) + at(x - 1, y + 1) + at(x + 1, y + 1)) / 16;
      const i = (y * N + x) * 4;
      img.data[i] = 90 + h * 80;
      img.data[i + 1] = 189 + (at(x * 7, y * 3) - 0.5) * 30;
      img.data[i + 2] = 0;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 3);
  t.anisotropy = 8;
  return t;
}
export const GRAIN = grainTexture();

// soft-touch rubber coating: rough (~0.8 from the grain map), a weak specular and a broad, velvety sheen
// at grazing angles, which is what makes rubberised plastic read as soft
export const matte = color => new THREE.MeshPhysicalMaterial({
  color,
  roughness: 1,
  roughnessMap: GRAIN,
  bumpMap: GRAIN,
  bumpScale: 0.22, // kept low: fine bump detail makes highlights sparkle while the tags move
  metalness: 0,
  specularIntensity: 0.5,
  sheen: 0.3,
  sheenRoughness: 0.9,
  sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.3), // a white sheen washed the green out
});

// a thin slab with rounded, bevelled edges that catch the light (the screen bezels)
export function bevelSlab(w, h, r, material) {
  const b = 0.008;
  const geo = new THREE.ExtrudeGeometry(roundedRect(w - 2 * b, h - 2 * b, r - b), { depth: 0.004, bevelEnabled: true, bevelThickness: 0.006, bevelSize: b, bevelSegments: 4, curveSegments: 10 });
  return new THREE.Mesh(geo, material);
}

// cover glass over the screens, modelled on studio product shots of phones and laptops: a flat screen
// does not show thin highlight lines (those come from curved glass), it mirrors one large softbox,
// which reads as a single soft diagonal sheen, brightest towards the top-left corner and fading out
// across the glass. The sheen's edge is placed from the tag's own view angle, so it drifts slowly as
// the tag floats and sweeps across the screen when the tag straightens on hover. Fresnel makes it a
// little stronger at grazing angles, and the glass's top and left edges catch a fine line of light.
// Additive and capped at a low level, so the text underneath always stays readable.
export function glassMaterial(aspect) {
  return new THREE.ShaderMaterial({
    uniforms: { uAspect: { value: aspect }, uFade: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vView; // towards the camera, in the panel's own space
      void main() {
        vUv = uv;
        vView = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz - position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uAspect;
      uniform float uFade; // 1 = no reflection (the screen has gone dark for the page change)
      varying vec2 vUv;
      varying vec3 vView;
      void main() {
        vec3 v = normalize(vView);
        vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);
        // signed distance across a diagonal (bottom-left to top-right) edge; the softbox reflection
        // covers the top-left side, its edge shifted by the view angle
        float d = dot(p, normalize(vec2(1.0, -1.0))) + 0.1 - (v.x * 0.9 + v.y * 0.6);
        float sheen = 1.0 - smoothstep(-0.04, 0.22, d);
        sheen *= mix(0.4, 1.0, smoothstep(0.0, -0.9, d)); // brighter towards the corner
        float fresnel = 0.75 + 1.5 * pow(1.0 - clamp(v.z, 0.0, 1.0), 3.0);
        // fine light line along the top and left edges of the glass, about a pixel wide
        float edge = max(1.0 - smoothstep(0.0, 1.5 * fwidth(vUv.y), 1.0 - vUv.y),
                         1.0 - smoothstep(0.0, 1.5 * fwidth(vUv.x), vUv.x));
        // like real cover glass with an anti-reflective coating, the reflection takes on a faint green
        // tint the flatter the glass is seen
        vec3 tint = mix(vec3(0.95, 0.98, 1.0), vec3(0.74, 1.0, 0.84), 0.7 * smoothstep(0.1, 0.8, 1.0 - v.z));
        vec3 col = (tint * 0.11 * sheen * fresnel + vec3(0.95, 0.98, 1.0) * 0.12 * edge) * (1.0 - uFade);
        gl_FragColor = vec4(col, 1.0);
      }`,
    transparent: true,
    ...ADD_LIGHT,
    depthWrite: false,
    toneMapped: false,
  });
}
const GLASS_MAIN_ASPECT = (SCREEN_W + 0.12) / (SCREEN_H + 0.12); // each tag gets its own main glass (fades on zoom)
const GLASS_ICON = glassMaterial(0.46 / ICON_BEZEL_H);

// ambient occlusion for the body, worked out from where the raised parts sit (like an AO bake in
// Blender): a soft darkening that fades out ~6 mm around each bezel, the play sleeve, the side button,
// the rail and the port, plus a soft groove along the parting lines. It mostly dims the light bouncing
// in from the environment and only half the direct light, as real contact shadow does.
const AO_GLSL = `
  float sdBox(vec2 p, vec2 c, vec2 h, float r) {
    vec2 q = abs(p - c) - h + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  float occl(float d, float strength) {
    return 1.0 - strength * (1.0 - smoothstep(0.0, 0.06, max(d, 0.0)));
  }
  // the USB-C and jack openings in the left end and the lanyard holes at the top-right corner
  // (negative inside an opening)
  float portCut(vec3 p) {
    if (p.y > ${f3(H / 2 - 0.04)}) return length(p.xz - vec2(${f3(LANYARD_TOP_X)}, 0.0)) - ${f3(LANYARD_R)};
    if (p.x > ${f3(W / 2 - 0.04)}) return length(p.yz - vec2(${f3(LANYARD_END_Y)}, 0.0)) - ${f3(LANYARD_R)};
    if (p.x > ${f3(-W / 2 + 0.04)}) return 1.0;
    float usb = sdBox(p.yz, vec2(0.0), vec2(${f3(USB_H / 2 + LIP)}, ${f3(USB_W / 2 + LIP)}), ${f3(USB_W / 2 + LIP)});
    return min(usb, length(p.yz - vec2(${f3(JACK_Y)}, 0.0)) - ${f3(JACK_R + LIP)});
  }
  float bodyAO(vec3 p) {
    float front = smoothstep(${f3(D / 2 - 0.07)}, ${f3(D / 2 - 0.01)}, p.z);
    float back = smoothstep(${f3(D / 2 - 0.07)}, ${f3(D / 2 - 0.01)}, -p.z);
    float top = smoothstep(${f3(H / 2 - 0.12)}, ${f3(H / 2 - 0.03)}, p.y);
    float bottom = smoothstep(${f3(H / 2 - 0.12)}, ${f3(H / 2 - 0.03)}, -p.y);
    float leftEnd = smoothstep(${f3(W / 2 - 0.12)}, ${f3(W / 2 - 0.03)}, -p.x);
    float endCap = step(${f3(W / 2 - D / 2)}, p.x);
    float ao = 1.0;
    // screen bezels on the front
    ao *= mix(1.0, occl(sdBox(p.xy, vec2(${f3(SCREEN_X)}, 0.0), vec2(${f3((SCREEN_W + 0.12) / 2)}, ${f3((SCREEN_H + 0.12) / 2)}), 0.1), 0.55), front);
    ao *= mix(1.0, occl(sdBox(p.xy, vec2(${f3(COL_X)}, ${f3(BEZEL_TOP - ICON_BEZEL_H / 2)}), vec2(0.23, ${f3(ICON_BEZEL_H / 2)}), 0.05), 0.55), front);
    // play sleeve: front and back plates and round the end
    float sleeve = sdBox(p.xy, vec2(${f3(PLAY_X0 + 1)}, ${f3((PLAY_YB + PLAY_YT) / 2)}), vec2(1.0, ${f3((PLAY_YT - PLAY_YB) / 2)}), 0.08);
    ao *= mix(1.0, occl(sleeve, 0.45), max(max(front, back), endCap));
    // side button on top, rail underneath, port on the left end
    ao *= mix(1.0, occl(sdBox(p.xz, vec2(-0.7, 0.0), vec2(0.17, 0.06), 0.025), 0.5), top);
    ao *= mix(1.0, occl(sdBox(p.xz, vec2(${f3(ROCKER_X)}, 0.0), vec2(${f3(ROCKER_L / 2)}, ${f3(ROCKER_W / 2)}), ${f3(ROCKER_W / 2)}), 0.5), bottom);
    ao *= mix(1.0, occl(sdBox(p.yz, vec2(0.0), vec2(${f3(USB_H / 2 + LIP)}, ${f3(USB_W / 2 + LIP)}), ${f3(USB_W / 2 + LIP)}), 0.3), leftEnd);
    ao *= mix(1.0, occl(length(p.yz - vec2(${f3(JACK_Y)}, 0.0)) - ${f3(JACK_R + LIP)}, 0.3), leftEnd);
    return ao;
  }
`;

// body in three colours: right of SPLIT_X the side colour all the way round; left of it the front colour
// in front of SPLIT and the back colour behind it, with fine parting lines between the parts. The two
// coloured shells are soft-touch rubber (matte); the side part is glazed ceramic: smooth, a glossy
// clearcoat for the glaze, no rubber sheen.
// Other devices pass their own `splitX` / `splitZ` and `tagParts: false`, which leaves out the tag's
// port openings and its baked AO (both are laid out for the tag's shape).
export function twoTone(front, back, side, { splitX = SPLIT_X, splitZ = SPLIT, tagParts = true } = {}) {
  const m = matte(front);
  m.clearcoat = 1; // switched off on the rubber parts in the shader; set here so three compiles it in
  m.clearcoatRoughness = 0.06;
  m.onBeforeCompile = shader => {
    shader.uniforms.uBack = { value: new THREE.Color(back) };
    shader.uniforms.uSide = { value: new THREE.Color(side) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLocal;
        uniform vec3 uBack;
        uniform vec3 uSide;
        float bumpK = 1.0; // bump strength per part: full on the rubber, almost none under the glaze` + AO_GLSL)
      .replace('#include <bumpmap_pars_fragment>', THREE.ShaderChunk.bumpmap_pars_fragment.replaceAll('bumpScale *', 'bumpScale * bumpK *'))
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${tagParts ? 'if (portCut(vLocal) < 0.0) discard; // real openings: the cavities behind are separate meshes' : ''}
        float dz = vLocal.z - ${splitZ.toFixed(3)}, dx = vLocal.x - ${splitX.toFixed(3)};
        float ceramic = step(0.0, dx);
        if (dx > 0.0) diffuseColor.rgb = uSide;
        else if (dz < 0.0) diffuseColor.rgb = uBack;
        float seam = min(abs(dx), dx < 0.0 ? abs(dz) : 1.0);
        diffuseColor.rgb *= mix(0.45, 1.0, smoothstep(0.0, 0.006, seam)) * mix(0.8, 1.0, smoothstep(0.0, 0.03, seam));
        bumpK = mix(1.0, 0.08, ceramic);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.32 + (roughnessFactor - 0.74) * 0.5, ceramic); // clay under the glaze`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        material.clearcoat *= ceramic * smoothstep(0.0, 0.004, dx); // glaze ends right at the parting line
        material.sheenColor *= 1.0 - ceramic;`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        float bodyOcc = ${tagParts ? 'bodyAO(vLocal)' : '1.0'};
        reflectedLight.indirectDiffuse *= bodyOcc;
        reflectedLight.indirectSpecular *= bodyOcc;
        reflectedLight.directDiffuse *= mix(1.0, bodyOcc, 0.5);
        reflectedLight.directSpecular *= mix(1.0, bodyOcc, 0.5);
        clearcoatSpecularIndirect *= bodyOcc;`);
  };
  return m;
}

// play button: a sleeve over the right end of the body. On the front and back it is a plate with rounded
// left corners (radius 0.08, like the page's panels), around the end it follows the body's curve.
function playSleeve(material, x0, yb, yt, t) {
  const group = new THREE.Group();
  const x1 = W / 2 - D / 2; // where the body's end starts to curve
  const rl = 0.08;
  const plate = new THREE.Shape();
  plate.moveTo(x1, yb);
  plate.lineTo(x1, yt);
  plate.lineTo(x0 + rl, yt);
  plate.quadraticCurveTo(x0, yt, x0, yt - rl);
  plate.lineTo(x0, yb + rl);
  plate.quadraticCurveTo(x0, yb, x0 + rl, yb);
  plate.closePath();
  const plateGeo = new THREE.ExtrudeGeometry(plate, { depth: t, bevelEnabled: false, curveSegments: 12 });
  const front = new THREE.Mesh(plateGeo, material);
  front.position.z = D / 2 - 0.002;
  const back = new THREE.Mesh(plateGeo, material);
  back.position.z = -D / 2 - t + 0.002;
  // the curved part: half a ring in the XZ plane, extruded down along y
  const ring = new THREE.Shape();
  ring.absarc(0, 0, D / 2 + t, -Math.PI / 2, Math.PI / 2, false);
  ring.absarc(0, 0, D / 2 - 0.004, Math.PI / 2, -Math.PI / 2, true);
  const sleeve = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: yt - yb, bevelEnabled: false, curveSegments: 32 }), material);
  sleeve.rotation.x = Math.PI / 2; // shape y -> world z, extrusion -> world -y
  sleeve.position.set(x1, yt, 0);
  group.add(front, back, sleeve);
  return group;
}

// pill outline (stadium) centred on the origin, long side along y
function stadium(w, h) {
  const s = new THREE.Shape();
  const r = w / 2, y = h / 2 - r;
  s.moveTo(-r, -y);
  s.absarc(0, -y, r, Math.PI, 0, false);
  s.lineTo(r, y);
  s.absarc(0, y, r, 0, Math.PI, false);
  s.closePath();
  return s;
}

// openings in the left end. The body shader cuts the holes (portCut, to the outer edge of the metal rim);
// these meshes fill them: a flush metal rim, walls running PORT_DEPTH into the body and a floor at the
// back. Built facing +z with z = 0 at the surface and negative z going inwards, then turned to face -x.
// Nothing stands proud of the surface.
const SILVER = new THREE.MeshStandardMaterial({ color: '#d6d8d2', metalness: 1, roughness: 0.26 });
const SILVER_INSIDE = new THREE.MeshStandardMaterial({ color: '#c4c6c0', metalness: 1, roughness: 0.3, side: THREE.BackSide });
const PORT_WALL = new THREE.MeshStandardMaterial({ color: '#0d0e0c', roughness: 0.9, side: THREE.BackSide });
const PORT_HOLE = new THREE.MeshStandardMaterial({ color: '#040504', roughness: 1 });
const PORT_TONGUE = new THREE.MeshStandardMaterial({ color: '#2a2c28', roughness: 0.55 });
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
const RIM_DEPTH = 0.012;

function circleShape(r) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  return s;
}

// `outline` is the opening, `outer` the rim's outer edge: a metal collar between them, flush with the
// surface, then walls and a floor further in. Without `outer` it is a plain hole.
function opening(outline, outer, rimMaterial, wallMaterial) {
  const g = new THREE.Group();
  if (outer) {
    outer.holes.push(outline);
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: RIM_DEPTH, bevelEnabled: false, curveSegments: 32 }), rimMaterial);
    rim.position.z = -RIM_DEPTH;
    g.add(rim);
  }
  // ExtrudeGeometry puts the caps in material group 0 and the walls in group 1: caps hidden, the
  // floor is added on its own
  const wallDepth = PORT_DEPTH - (outer ? RIM_DEPTH : 0);
  const walls = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: wallDepth, bevelEnabled: false, curveSegments: 32 }), [HIDDEN, wallMaterial]);
  walls.position.z = -PORT_DEPTH;
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(outline, 32), PORT_HOLE);
  floor.position.z = -PORT_DEPTH + 0.001;
  g.add(walls, floor);
  return g;
}

// USB-C: silver shell (rim and lining) with the dark contact tongue in the middle, its contacts a
// thin metal strip across both faces
function usbC() {
  const g = opening(stadium(USB_W, USB_H), stadium(USB_W + 2 * LIP, USB_H + 2 * LIP), SILVER, SILVER_INSIDE);
  const tongue = new THREE.Mesh(new RoundedBoxGeometry(0.013, USB_H * 0.7, 0.05, 2, 0.003), PORT_TONGUE);
  tongue.position.z = -0.012 - 0.025;
  const contacts = new THREE.Mesh(new THREE.BoxGeometry(0.0138, USB_H * 0.56, 0.012), SILVER);
  contacts.position.z = -0.012 - 0.008;
  g.add(tongue, contacts);
  return g;
}

// 3.5 mm jack: round hole with dark walls inside a thin silver ring (same metal as the USB-C shell)
function jack() {
  return opening(circleShape(JACK_R), circleShape(JACK_R + LIP), SILVER, PORT_WALL);
}

// volume rocker: two halves split in the middle, pill-round at the outer ends, square at the split,
// as narrow as the old rail. Built in the xy plane, then laid onto the bottom edge.
function volumeRocker(material) {
  const g = new THREE.Group();
  const b = 0.01, gap = 0.006; // bevel (softens every edge), gap at the split
  const x0 = gap / 2 + b, x1 = ROCKER_L / 2 - b, r = ROCKER_W / 2 - b;
  const half = new THREE.Shape();
  half.moveTo(x0, -r);
  half.lineTo(x1 - r, -r);
  half.absarc(x1 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  half.lineTo(x0, r);
  half.closePath();
  const geo = new THREE.ExtrudeGeometry(half, { depth: 0.03, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 16 });
  const plus = new THREE.Mesh(geo, material);
  const minus = new THREE.Mesh(geo, material);
  minus.scale.x = -1;
  g.add(plus, minus);
  g.rotation.x = Math.PI / 2; // shape y -> world z, extrusion -> world -y
  return g;
}

// milky, opaque plastic in a deep, saturated version of the key colour, so it stands out; it does not glow
export function keyPlastic(keys) {
  const keyColor = new THREE.Color(keys);
  const hsl = keyColor.getHSL({});
  const buttonColor = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 2.2), hsl.l * 0.42);
  const milky = new THREE.MeshPhysicalMaterial({
    color: buttonColor,
    roughness: 0.38,
    bumpMap: GRAIN, // faint injection-moulding grain, so the hard plastic is not CG-smooth
    bumpScale: 0.05,
    specularIntensity: 0.8,
    sheen: 0.15,
    sheenRoughness: 0.5,
    sheenColor: keyColor, // a white sheen washed the colour out
  });
  return { keyColor, buttonColor, milky };
}

function buildTag(tag, scheme) {
  const group = new THREE.Group();
  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); group.add(mesh); return mesh; };
  const fz = D / 2;

  add(new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 12, R), twoTone(scheme.front, scheme.back, scheme.side)), 0, 0, 0);

  // main screen: black bezel so it stands apart from the body, light spill, backlit panel
  // no clearcoat: on the thin bevel its sharp highlight was a line under a pixel wide that crawled
  const bezelMat = new THREE.MeshPhysicalMaterial({ color: COLORS.bezel, roughness: 0.42 });
  const sx = SCREEN_X;
  add(bevelSlab(SCREEN_W + 0.12, SCREEN_H + 0.12, 0.1, bezelMat), sx, 0, fz - 0.008);
  const glowMat = new THREE.MeshBasicMaterial({ map: GLOW, transparent: true, opacity: 0, ...ADD_LIGHT, depthWrite: false });
  add(new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W + 0.7, SCREEN_H + 0.7), glowMat), sx, 0, fz + 0.003);
  const screenGrad = gradientMaterial(scheme.keys, [190, 100], 0);
  add(panel(SCREEN_W, SCREEN_H, 0.05, screenGrad), sx, 0, fz + 0.004);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture(tag, false), transparent: true, opacity: 0, toneMapped: false });
  add(panel(SCREEN_W, SCREEN_H, 0.05, screenMat), sx, 0, fz + 0.005);
  const cursorMat = new THREE.MeshBasicMaterial({ map: cursorTexture(tag), transparent: true, opacity: 0, toneMapped: false });
  add(panel(SCREEN_W, SCREEN_H, 0.05, cursorMat), sx, 0, fz + 0.0052);
  const screenAod = new THREE.MeshBasicMaterial({ map: screenTexture(tag, true), transparent: true, toneMapped: false });
  add(panel(SCREEN_W, SCREEN_H, 0.05, screenAod), sx, 0, fz + 0.0055);
  const glassMain = glassMaterial(GLASS_MAIN_ASPECT);
  add(panel(SCREEN_W + 0.12, SCREEN_H + 0.12, 0.1, glassMain), sx, 0, fz + 0.007);

  // right column: icon screen on top, play button below
  const cx = COL_X;
  const iconBezelH = ICON_BEZEL_H;
  add(bevelSlab(0.46, iconBezelH, 0.05, bezelMat), cx, BEZEL_TOP - iconBezelH / 2, fz - 0.008);
  const gradMat = gradientMaterial(scheme.keys, [96, 34], 1);
  add(panel(0.4, 0.14, 0.03, gradMat), cx, BEZEL_TOP - iconBezelH / 2, fz + 0.005);
  const icon = iconScreen(tag, COLORS.ink);
  icon.draw(CLOCK.format(new Date()));
  const iconMat = new THREE.MeshBasicMaterial({ map: icon.texture, transparent: true, toneMapped: false });
  add(panel(0.4, 0.14, 0.03, iconMat), cx, BEZEL_TOP - iconBezelH / 2, fz + 0.006);
  add(panel(0.46, iconBezelH, 0.05, GLASS_ICON), cx, BEZEL_TOP - iconBezelH / 2, fz + 0.007);

  const { keyColor, buttonColor, milky } = keyPlastic(scheme.keys);
  const playX0 = PLAY_X0, playYb = PLAY_YB, playYt = PLAY_YT, playT = 0.014;
  const sleeve = playSleeve(milky, playX0, playYb, playYt, playT);
  group.add(sleeve);
  const tri = new THREE.Shape();
  tri.moveTo(-0.05, -0.065);
  tri.lineTo(0.075, 0);
  tri.lineTo(-0.05, 0.065);
  tri.closePath();
  const iconInk = new THREE.MeshStandardMaterial({ color: buttonColor.clone().multiplyScalar(0.35), roughness: 0.7 }); // a darker shade of the button
  const triMesh = add(new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.004, bevelEnabled: false }), iconInk), 0.79, (playYb + playYt) / 2, fz + playT - 0.002);

  // side parts, kept nearly flush: side button on the top edge, volume rocker on the bottom edge,
  // USB-C port and headphone jack on the left end, a speaker grille on the back
  add(new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.06, 0.12, 4, 0.025), milky), -0.7, H / 2 - 0.012, 0);
  const rail = new THREE.Color(scheme.back).lerp(new THREE.Color(scheme.front), 0.4);
  add(volumeRocker(matte(rail)), ROCKER_X, -H / 2 + 0.014 + 0.015, 0);
  add(usbC(), -W / 2, 0, 0).rotation.y = -Math.PI / 2;
  add(jack(), -W / 2, JACK_Y, 0).rotation.y = -Math.PI / 2;
  add(opening(circleShape(LANYARD_R), null, null, PORT_WALL), LANYARD_TOP_X, H / 2, 0).rotation.x = -Math.PI / 2;
  add(opening(circleShape(LANYARD_R), null, null, PORT_WALL), W / 2, LANYARD_END_Y, 0).rotation.y = Math.PI / 2;
  const portMat = new THREE.MeshStandardMaterial({ color: COLORS.port, roughness: 0.8 });
  // speaker grille, merged into one mesh (one draw call instead of ten)
  const holes = [];
  for (const [gx, n] of [[-0.06, 3], [0, 4], [0.06, 3]]) {
    for (let k = 0; k < n; k++) {
      holes.push(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12).rotateX(Math.PI / 2).translate(-0.4 + gx, (k - (n - 1) / 2) * 0.06, -D / 2 - 0.004));
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(holes), portMat));

  // the screen also lights the device around it a little
  const lamp = new THREE.PointLight('#f2f0ea', 0, 2.2, 2);
  add(lamp, sx, 0, fz + 0.35);

  const unlit = [glowMat, screenGrad, screenMat, cursorMat, screenAod, gradMat, iconMat, glassMain, GLASS_ICON];
  group.traverse(o => { if (o.isMesh && !unlit.includes(o.material)) { o.castShadow = true; o.receiveShadow = true; } });
  group.userData.parts = { glassMain, screenGrad, screenMat, cursorMat, screenAod, gradMat, iconMat, glowMat, lamp, icon, press: [sleeve, triMesh], iconInk, milky, keyColor };
  group.userData.screenColor = COLORS.page; // what the screen shows once it covers the window
  return group;
}

// depth of field for `focusBlur`: every tag has its own blur amount that eases in and out. Sharp tags are
// drawn straight to the screen; each soft tag is rendered alone into a texture, blurred at half resolution
// and slid in *behind* what is already in the frame. The tag is rendered into its texture exactly as it
// would be on screen (same tone mapping, same sRGB output, see `sharp` below), so a tag looks identical
// sharp or soft and nothing jumps in brightness when it changes over. Textures hold premultiplied colour.
const FULLSCREEN = new THREE.PlaneGeometry(2, 2);
const PASS_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function blurMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { tMap: { value: null }, uStep: { value: new THREE.Vector2() } },
    vertexShader: PASS_VERT,
    fragmentShader: `
      uniform sampler2D tMap;
      uniform vec2 uStep;
      varying vec2 vUv;
      void main() {
        // 9-tap gaussian along uStep
        // samples clamped: additive layers (screen glow, cover glass) can push the float texture past 1
        #define S(o) clamp(texture2D(tMap, vUv + (o)), 0.0, 1.0)
        vec4 c = S(vec2(0.0)) * 0.2270270;
        c += (S(uStep * 1.3846) + S(-uStep * 1.3846)) * 0.3162162;
        c += (S(uStep * 3.2308) + S(-uStep * 3.2308)) * 0.0702703;
        gl_FragColor = c;
      }`,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}
function compositeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { tSharp: { value: null }, tSoft: { value: null }, uAmount: { value: 0 } },
    vertexShader: PASS_VERT,
    fragmentShader: `
      uniform sampler2D tSharp, tSoft;
      uniform float uAmount;
      varying vec2 vUv;
      void main() {
        vec4 c = clamp(mix(texture2D(tSharp, vUv), texture2D(tSoft, vUv), smoothstep(0.0, 0.35, uAmount)), 0.0, 1.0);
        // already tone mapped and in sRGB; only dim it a little
        gl_FragColor = vec4(c.rgb * (1.0 - 0.12 * uAmount), c.a);
      }`,
    transparent: true,
    toneMapped: false,
    // "destination over": the soft tag only fills what the sharp tags left empty
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneMinusDstAlphaFactor,
    blendDst: THREE.OneFactor,
    depthTest: false,
    depthWrite: false,
  });
}

// downsample filter for the supersampled frame: a tent filter about 1.6 output pixels wide over the
// SS x SS block under each pixel and a little of its neighbours, so edges come out smooth and don't
// crawl while the tags move. The frame is already tone mapped and in sRGB, so it is copied as it is.
function resolveMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { tMap: { value: null }, SS: { value: 1 } },
    defines: { R: 4 }, // enough for SS up to 3
    vertexShader: PASS_VERT,
    fragmentShader: `
      uniform sampler2D tMap;
      uniform float SS;
      void main() {
        ivec2 size = textureSize(tMap, 0);
        vec2 c = gl_FragCoord.xy * SS; // this pixel's centre in the big frame
        vec4 sum = vec4(0.0);
        float wsum = 0.0;
        for (int y = -R; y < R; y++) {
          for (int x = -R; x < R; x++) {
            vec2 p = floor(c) + vec2(x, y) + 0.5;
            vec2 d = abs(p - c) / (SS * 0.8);
            float w = max(0.0, 1.0 - d.x) * max(0.0, 1.0 - d.y);
            if (w <= 0.0) continue;
            sum += clamp(texelFetch(tMap, clamp(ivec2(p), ivec2(0), size - 1), 0), 0.0, 1.0) * w;
            wsum += w;
          }
        }
        gl_FragColor = sum / wsum;
      }`,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
}

export async function mountTags(container, tags, { focusBlur = false, returnTo = null } = {}) {
  // the screens are drawn with the page fonts; load them explicitly, a canvas does not trigger the download
  await Promise.all([
    document.fonts.load('500 150px "DM Sans"'),
    document.fonts.load('400 64px "Fira Mono"'),
    document.fonts.load('96px "Material Symbols Rounded"', 'mail'),
  ]);

  const renderer = new THREE.WebGLRenderer({ alpha: true });
  // supersampling (SSAA), the WebGL stand-in for DLSS: the scene is drawn into an internal frame at SS
  // times the canvas resolution and filtered down to the canvas (resolveMaterial). SS is 3 on normal
  // screens, 2 on high-density ones and 1 beyond that; lower it if a weak GPU stutters. No MSAA on the
  // internal targets: SS already gives 4-9 samples per pixel, and three@0.160's multisample resolve
  // also blits depth, which WebGL rejects for these targets.
  // phones (touch) start at 2x at most: their 3x screens cost more than twice the pixels for a
  // difference nobody sees on the tags, and their GPUs are the weakest
  const dpr = Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 2 : 3);
  const maxSS = dpr < 1.5 ? 3 : dpr < 2.5 ? 2 : 1;
  const minRatio = Math.min(dpr, 1);
  let SS = maxSS; // lowered at runtime if the GPU can't keep up, see adapt()
  let ratio = dpr; // the pixel ratio, lowered after SS once that is down to 1, see adapt()
  renderer.setPixelRatio(ratio);
  const frame = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  // drawn exactly as it would be on screen: three.js applies tone mapping and sRGB output to a render
  // target only when it is flagged as an XR target (render-target internals of three@0.160)
  frame.isXRRenderTarget = true;
  frame.texture.colorSpace = THREE.SRGBColorSpace;
  const resolve = new THREE.Mesh(FULLSCREEN, resolveMaterial());
  resolve.frustumCulled = false;
  const resolveScene = new THREE.Scene().add(resolve);
  const resolveCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // AgX, Blender's own view transform: softer highlight roll-off and more natural colour than ACES
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  // the canvas covers the whole window, so tags can rise from below the page and zoom right up to the
  // viewer without being cut off at a box edge; the container only frames where the stack sits (fit)
  Object.assign(renderer.domElement.style, { display: 'block', position: 'fixed', inset: '0', width: '100%', height: '100%' });
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  // studio lighting: soft environment reflections, a warm key light with soft shadows,
  // and two rim lights from behind (tinted with the scheme colours) that draw the edges out of the dark page
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  const key = new THREE.DirectionalLight('#fff4e2', 1.6);
  key.position.set(-3, 5, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -4;
  key.shadow.camera.right = key.shadow.camera.top = 4;
  key.shadow.radius = 10;
  key.shadow.blurSamples = 12; // the shadows are wide and soft; more samples cost time without showing
  key.shadow.bias = -0.0005;
  scene.add(key);
  const rimA = new THREE.DirectionalLight('#ffffff', 1.4);
  rimA.position.set(-5, 2, -4);
  scene.add(rimA);
  const rimB = new THREE.DirectionalLight('#ffffff', 1.2);
  rimB.position.set(5, -1.5, -4);
  scene.add(rimB);
  scene.add(new THREE.HemisphereLight('#ffffff', '#141416', 0.3));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  // the lights shine on both depth-of-field layers (see renderDof)
  scene.children.forEach(o => o.isLight && o.layers.enableAll());

  // depth of field passes (only built with `focusBlur`)
  let dof = null;
  if (focusBlur) {
    const rt = (scale, samples) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthBuffer: scale === 1 });
    const quad = new THREE.Mesh(FULLSCREEN);
    quad.frustumCulled = false;
    dof = {
      sharp: rt(1, 0), a: rt(0.5, 0), b: rt(0.5, 0), probe: rt(1, 0),
      blur: blurMaterial(), composite: compositeMaterial(),
      quad, quadScene: new THREE.Scene().add(quad), quadCam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    };
    // render the soft tags with the screen's own tone mapping and sRGB output: three.js applies those to
    // a render target only when it is flagged as an XR target (render-target internals of three@0.160)
    dof.sharp.isXRRenderTarget = true;
    dof.sharp.texture.colorSpace = THREE.SRGBColorSpace;
    // shadows are updated once per frame with every tag present (see renderDof)
    renderer.shadowMap.autoUpdate = false;
  }

  // stacked like the reference: each tag a bit lower, alternating tilt
  let schemes = SCHEMES, items = [];
  function build() {
    items.forEach(it => scene.remove(it.mesh));
    items = tags.map((tag, i) => {
      const mesh = buildTag(tag, schemes[tag.scheme] || schemes.a);
      mesh.userData.index = i;
      const side = i % 2 ? -1 : 1;
      const base = {
        x: side * 0.35,
        y: ((tags.length - 1) / 2 - i) * 1.35,
        rx: -0.35,
        ry: side * 0.42,
        rz: side * 0.3,
      };
      scene.add(mesh);
      const prev = items[i] || {};
      return {
        mesh, base, phase: i * 1.7, href: tag.href, lift: prev.lift || 0, blur: prev.blur || 0,
      };
    });
    rimA.color.set(schemes.b.keys);
    rimB.color.set(schemes.a.keys);
  }
  build();

  function fit() {
    const w = document.documentElement.clientWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    // the canvas is now window-sized: keep the supersampled frame under ~10 million pixels
    SS = Math.max(1, Math.min(SS, Math.floor(Math.sqrt(10e6 / (buf.x * buf.y)))));
    const fw = buf.x * SS, fh = buf.y * SS;
    resolve.material.uniforms.SS.value = SS;
    frame.setSize(fw, fh);
    if (dof) {
      dof.sharp.setSize(fw, fh);
      dof.a.setSize(Math.round(fw / 2), Math.round(fh / 2));
      dof.b.setSize(Math.round(fw / 2), Math.round(fh / 2));
    }
    camera.aspect = w / h;
    frameStack();
  }

  // frame the stack inside the container's box although the canvas fills the window: the camera
  // distance makes the stack fit the box, and a view offset moves it onto the box's centre (on phones
  // the box scrolls with the page, so this runs every frame)
  const box = { w: 0, h: 0, x: 0, y: 0 };
  function frameStack() {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    const r = container.getBoundingClientRect();
    if (r.width === box.w && r.height === box.h && r.left === box.x && r.top === box.y && camera.userData.size === `${w}x${h}`) return;
    Object.assign(box, { w: r.width, h: r.height, x: r.left, y: r.top });
    camera.userData.size = `${w}x${h}`;
    const stackH = tags.length * 1.35 + 0.6, stackW = W + 1.0;
    const dist = Math.max(stackH / r.height, stackW / r.width) * h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.set(0, 0, dist + 1);
    camera.setViewOffset(w, h, w / 2 - (r.left + r.width / 2), h / 2 - (r.top + r.height / 2), w, h);
  }

  // hover: the tag under the pointer comes forward and straightens; a click opens its page
  let hovered = -1, focused = -1;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  ray.layers.enableAll(); // the depth of field moves each tag onto its own layer
  const canvas = renderer.domElement;
  // index of the tag under the pointer, -1 for none
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let hit = ray.intersectObjects(items.map(it => it.mesh), true)[0]?.object;
    while (hit && hit.userData.index === undefined) hit = hit.parent;
    return hit ? hit.userData.index : -1;
  }
  // the tag under the pointer is picked again every frame, not only when the pointer moves: tags move
  // under a resting cursor too (a tag flying back from its page covers the whole window on the way)
  let pointer = null;
  canvas.addEventListener('pointermove', e => { pointer = { clientX: e.clientX, clientY: e.clientY }; });
  canvas.addEventListener('pointerleave', () => { pointer = null; });
  function updateHover() {
    const h = pointer && !launch && !returning ? pick(pointer) : -1; // no hover while a tag flies
    if (h === hovered) return;
    hovered = h;
    canvas.style.cursor = h >= 0 && items[h].href ? 'pointer' : '';
  }
  // picked again on click, so a tap on a touch screen works without a hover first
  canvas.addEventListener('click', e => {
    const i = pick(e);
    if (i >= 0 && items[i].href) launchTag(i);
  });

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // click: the play button presses in, then the tag straightens and flies at the viewer until its screen
  // fills the view; then `taglaunch` fires and the page changes
  let launch = null;
  function launchTag(i) {
    if (launch) return;
    if (still) return void (location.href = items[i].href);
    launch = { i, start: performance.now(), fired: false };
    container.dispatchEvent(new CustomEvent('taglaunchstart', { detail: i }));
  }
  const launchTarget = new THREE.Vector3();
  const easeInOut = v => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
  let lastActive = -1;
  // coming back with the browser's back button restores the page as it was left: mid-zoom
  // the reverse: coming back from a tag's page, that tag starts zoomed in and flies back to its place
  let returning = Number.isInteger(returnTo) && returnTo >= 0 && returnTo < tags.length ? { i: returnTo, start: null } : null;
  // back button with the page restored from the browser's cache: it was left mid-zoom, so fly back
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    if (launch) returning = { i: launch.i, start: null };
    launch = null;
    hovered = focused = -1;
  });
  // boot timeline per tag (seconds after mount): slide in, icon screen flickers on, title fades in
  // the intro starts with the first animated frame (after the warm-up below), not at mount time
  let bootStart = still || returning ? -Infinity : null;
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const easeOut = v => 1 - Math.pow(1 - v, 3);
  function flicker(v) {
    if (v <= 0) return 0;
    if (v >= 1) return 1;
    return Math.sin(v * 47) > 0.2 - v ? 0.4 + 0.6 * v : 0.05; // a few uneven blinks, then steady
  }
  // adaptive quality, like drei's PerformanceMonitor: frame times are averaged over one-second
  // windows; two slow windows in a row (under ~50 fps) drop the supersampling one step, and once that
  // is down to 1 the pixel ratio by half steps (to 1 at the least); a long run of smooth windows raises
  // them again, pixel ratio first. It may rise at most twice, so it can't keep flip-flopping.
  let last = 0, sum = 0, frames = 0, slow = 0, smooth = 0, raises = 0;
  function adapt(time) {
    // only judge steady frames: not a render outside the loop (resize), not the intro or a zoom
    if (!time || bootStart === null || time - bootStart < 4000 || launch || returning) { last = 0; sum = frames = 0; return; }
    const dt = last ? time - last : 0;
    last = time;
    if (dt <= 0 || dt > 250) return; // first frame, or back from a pause
    sum += dt;
    frames++;
    if (sum < 1000) return;
    const avg = sum / frames;
    sum = frames = 0;
    if (avg > 20) { slow++; smooth = 0; } else if (avg < 17.5) { smooth++; slow = 0; } else { slow = smooth = 0; }
    if (slow >= 2 && (SS > 1 || ratio > minRatio)) {
      if (SS > 1) SS--;
      else renderer.setPixelRatio((ratio = Math.max(minRatio, ratio - 0.5)));
      slow = 0;
      fit();
    }
    if (smooth >= 8 && (ratio < dpr || SS < maxSS) && raises < 2) {
      if (ratio < dpr) renderer.setPixelRatio((ratio = Math.min(dpr, ratio + 0.5)));
      else SS++;
      raises++;
      smooth = 0;
      fit();
    }
  }

  function render(time) {
    adapt(time);
    frameStack();
    const t = still ? 0 : time / 1000;
    const now = performance.now();
    if (time && bootStart === null) bootStart = now;
    if (time && returning && returning.start === null) returning.start = now;
    // a tag flying back from its page is not selected: it returns straight to its resting state
    updateHover();
    const active = launch ? launch.i : hovered >= 0 ? hovered : focused;
    if (active !== lastActive) {
      lastActive = active;
      container.dispatchEvent(new CustomEvent('tagactive', { detail: active }));
    }
    const bt = bootStart === null ? 0 : (now - bootStart) / 1000; // before the intro starts: its first frame
    const clock = CLOCK.format(new Date());
    const blink = still || Math.floor(now / 530) % 2 === 0 ? 1 : 0;
    // the studio key light wanders slowly, so highlights and shadows shift over time
    if (!still) key.position.set(-3 + Math.sin(t * 0.06) * 2.6, 5 + Math.sin(t * 0.045) * 0.8, 6);
    items.forEach((it, i) => {
      const { mesh, base, phase } = it;
      const t0 = 0.2 + i * 0.22;
      const slide = easeOut(clamp01((bt - t0) / 0.8));
      const screenOn = flicker((bt - t0 - 0.7) / 0.35);
      const title = clamp01((bt - t0 - 1.0) / 0.4);
      it.lift += ((i === active ? 1 : 0) - it.lift) * (still ? 1 : 0.12);
      if (returning && returning.i === i) it.lift = 0; // idle pose and black always-on screen, no hover look
      it.blur += ((active >= 0 && i !== active ? 1 : 0) - it.blur) * (still ? 1 : 0.1);
      const k = 1 - it.lift * 0.65; // straighten towards the viewer
      mesh.position.set(base.x * k, base.y + Math.sin(t * 0.7 + phase) * 0.06 - (1 - slide) * 6, it.lift * 0.9);
      mesh.rotation.set((base.rx + Math.sin(t * 0.5 + phase) * 0.04) * k + (1 - slide) * 0.6, (base.ry + Math.sin(t * 0.4 + phase) * 0.08) * k, base.rz * k);
      mesh.scale.setScalar(1 + it.lift * 0.06);

      const { press } = mesh.userData.parts;
      let pressed = 0, textFade = 1, e = 0, dark = 0, flash = 0, wave = 0;
      if (launch && launch.i === i) {
        const lt = (now - launch.start) / 1000;
        // the press, readable on its own before anything flies: in (0.12 s), held, out again (0.13 s);
        // the whole tag gives a little under the finger and the button lights up in the key colour,
        // its light running across the screen
        pressed = lt < 0.12 ? easeOut(lt / 0.12) : lt < 0.27 ? 1 : 1 - easeOut(clamp01((lt - 0.27) / 0.13));
        mesh.position.z -= pressed * 0.12;
        flash = clamp01(lt / 0.08) * (1 - clamp01((lt - 0.2) / 0.45));
        wave = clamp01((lt - 0.12) / 0.5);
        // then the zoom, once the button is back up
        e = easeInOut(clamp01((lt - 0.38) / 1.0));
        if (lt > 1.33 && !launch.fired) { // screen covers the window: hand over to the page
          launch.fired = true;
          const ev = new CustomEvent('taglaunch', { cancelable: true, detail: { index: i, href: it.href, color: mesh.userData.screenColor } });
          if (container.dispatchEvent(ev)) location.href = it.href;
        }
      } else if (returning && returning.i === i) {
        // back from its page: from covering the window to its place, a touch slower than the way in
        const rt = returning.start === null ? 0 : (now - returning.start) / 1000;
        e = 1 - easeInOut(clamp01((rt - 0.1) / 1.2));
        if (rt > 1.4) returning = null;
      }
      if (e > 0) {
        // zoomed: straight on, centred on the middle of the window, at the distance where the screen's
        // shorter side fills the view, so the screen just covers the window
        const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), s = mesh.scale.x;
        const d = Math.min((SCREEN_H * s) / (2 * tan), (SCREEN_W * s) / (2 * tan * camera.aspect)) * 0.97;
        launchTarget.set(0, 0, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(d).add(camera.position);
        launchTarget.x -= SCREEN_X * s;
        mesh.position.lerp(launchTarget, e);
        mesh.rotation.set(mesh.rotation.x * (1 - e), mesh.rotation.y * (1 - e), mesh.rotation.z * (1 - e));
        // the writing fades as it grows, so the screen arrives as a clean field of colour
        textFade = 1 - clamp01((e - 0.45) / 0.4);
        dark = clamp01((e - 0.3) / 0.55); // and the screen dims into the page's dark ground
      }
      // the sleeve's front plate is 0.014 thick; 0.011 sinks it almost flush with the body
      press.forEach(m => { m.position.z = (m.userData.z0 ??= m.position.z) - pressed * 0.011; });
      const { iconInk, milky, keyColor } = mesh.userData.parts;
      iconInk.emissive.copy(keyColor).multiplyScalar(flash * 3);
      milky.emissive.copy(keyColor).multiplyScalar(flash * 0.35);

      mesh.userData.parts.icon.draw(clock);
      // selected: the main screen switches from always-on (black, white text) to the gradient with the
      // full layout, and lights its surroundings a little
      const { screenGrad, screenMat, cursorMat, screenAod, gradMat, iconMat, glowMat, lamp, glassMain } = mesh.userData.parts;
      screenGrad.uniforms.uFill.value = it.lift;
      screenGrad.uniforms.uDarkMix.value = dark;
      screenGrad.uniforms.uWave.value = wave;
      glassMain.uniforms.uFade.value = dark;
      screenGrad.uniforms.uTime.value = t + phase * 3;
      screenMat.opacity = it.lift * textFade;
      cursorMat.opacity = it.lift > 0.6 ? blink * textFade : 0; // terminal cursor only on the selected, lit screen
      screenAod.opacity = (1 - it.lift) * title * textFade;
      gradMat.uniforms.uTime.value = t + phase * 3;
      gradMat.uniforms.uLevel.value = screenOn;
      iconMat.opacity = screenOn;
      glowMat.opacity = 0.12 * it.lift * (1 - dark);
      lamp.intensity = 0.2 * it.lift * (1 - dark);
    });
    renderer.setRenderTarget(frame);
    if (dof) renderDof();
    else renderer.render(scene, camera);
    // filter the supersampled frame down to the canvas
    renderer.setRenderTarget(null);
    resolve.material.uniforms.tMap.value = frame.texture;
    renderer.render(resolveScene, resolveCam);
  }

  // tag i lives on layer i + 1, so each one can be drawn on its own
  function renderDof() {
    const { sharp, a, b, probe, blur, composite, quad, quadScene, quadCam } = dof;
    items.forEach((it, i) => it.mesh.traverse(o => (o.isLight ? o.layers.enableAll() : o.layers.set(i + 1))));
    const soft = items.filter(it => it.blur > 0.005).sort((p, q) => q.mesh.position.z - p.mesh.position.z);
    const clear = renderer.getClearAlpha();
    renderer.setClearAlpha(0);

    // shadow update with all tags, so sharp and soft tags still shade each other; drawn into a 1px target
    camera.layers.enableAll();
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(probe);
    renderer.render(scene, camera);

    // sharp tags straight into the frame
    camera.layers.set(0); // anything that is not a tag
    items.forEach((it, i) => it.blur <= 0.005 && camera.layers.enable(i + 1));
    renderer.setRenderTarget(frame);
    renderer.render(scene, camera);

    // each soft tag: render alone, two rounds of horizontal + vertical blur at half resolution, slide in behind
    const pr = renderer.getPixelRatio() * SS;
    soft.forEach(it => {
      camera.layers.set(items.indexOf(it) + 1);
      renderer.setRenderTarget(sharp);
      renderer.render(scene, camera);

      quad.material = blur;
      const r = 0.4 * it.blur * pr;
      let src = sharp;
      for (let n = 0; n < 2; n++) {
        [[r / a.width, 0, a], [0, r / a.height, b]].forEach(([x, y, dst]) => {
          blur.uniforms.tMap.value = src.texture;
          blur.uniforms.uStep.value.set(x, y);
          renderer.setRenderTarget(dst);
          renderer.render(quadScene, quadCam);
          src = dst;
        });
      }

      renderer.setRenderTarget(frame);
      renderer.autoClear = false;
      quad.material = composite;
      composite.uniforms.tSharp.value = sharp.texture;
      composite.uniforms.tSoft.value = src.texture;
      composite.uniforms.uAmount.value = it.blur;
      renderer.render(quadScene, quadCam);
      renderer.autoClear = true;
    });

    camera.layers.enableAll();
    renderer.setClearAlpha(clear);
  }

  new ResizeObserver(() => { fit(); render(0); }).observe(container);
  window.addEventListener('resize', () => { fit(); render(0); });
  fit();
  // warm-up: compile every shader and upload every texture before the first animated frame. Otherwise
  // each tag's programs compile the moment it first slides into view, and the intro stutters. One frame
  // with the tags in place and soft (depth of field passes), one sharp; both are overdrawn before the
  // first paint.
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  else renderer.compile(scene, camera);
  const boot = bootStart;
  bootStart = -Infinity;
  items.forEach(it => { it.blur = 1; });
  render(0);
  items.forEach(it => { it.blur = 0; });
  render(0);
  bootStart = boot;
  render(0); // leave the intro's first frame on the canvas, not the warm-up pose
  // only animate while the tags are on screen and the tab is visible
  let onScreen = true, paused = false;
  const loop = () => {
    last = 0;
    renderer.setAnimationLoop(onScreen && !paused && !document.hidden ? render : null);
  };
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; loop(); }).observe(container);
  document.addEventListener('visibilitychange', loop);
  loop();

  return {
    // lets the page highlight a tag from elsewhere, e.g. while its keyboard link has focus (-1 = none)
    highlight(i) { focused = i; },
    // stop or restart rendering, e.g. while a sub page covers the window
    setPaused(on) { paused = on; loop(); },
    // fly tag i back from covering the window to its place (the reverse of the zoom after a click)
    returnFrom(i) { launch = null; hovered = focused = -1; returning = { i, start: null }; },
    // swaps the colour schemes and rebuilds the tags
    setSchemes(next) { schemes = next; build(); },
  };
}
