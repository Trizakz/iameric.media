// "Liquid glass" for a widget (index.html .glass), after Apple's material: the page behind it is blurred a little,
// and near the rounded edges it is bent inwards, like looking through the thick rim of a glass lens. The bending is
// an SVG displacement map drawn for the widget's exact size and corner radius, used as a backdrop filter. Only
// Chromium can use an SVG filter as a backdrop filter; other browsers keep the plain frosted glass from the CSS.
//
//   mountGlass(document.querySelector('.glass'));

const BEZEL = 22; // how far in from the edge the glass bends the view (px)
const SCALE = 46; // how strongly (px of shift at the very edge)
let uid = 0;

export function mountGlass(el) {
  if (!navigator.userAgentData) return; // not Chromium: keep the CSS fallback
  const id = `glass-${uid++}`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  document.body.append(svg);

  const build = () => {
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    svg.innerHTML = `<filter id="${id}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`
      + `<feImage href="${map(w, h, r)}" x="0" y="0" width="${w}" height="${h}" result="map"/>`
      + `<feDisplacementMap in="SourceGraphic" in2="map" scale="${SCALE}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
    el.style.backdropFilter = `url(#${id}) blur(3px) saturate(1.6) brightness(1.08)`;
  };
  build();
  new ResizeObserver(build).observe(el);
}

// the displacement map: red is the shift along x, green along y (128 = none). Inside the bezel each pixel is pushed
// towards the inside along the edge's normal, more the closer it is to the edge (a smooth, lens-like curve)
function map(w, h, r) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const hw = w / 2, hh = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // signed distance to the rounded rectangle (negative inside), and its direction
      const px = x + 0.5 - hw, py = y + 0.5 - hh;
      const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
      const d = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
      let nx, ny;
      if (qx > 0 && qy > 0) { const l = Math.hypot(ox, oy) || 1; nx = ox / l; ny = oy / l; }
      else if (qx > qy) { nx = 1; ny = 0; }
      else { nx = 0; ny = 1; }
      nx *= Math.sign(px) || 1;
      ny *= Math.sign(py) || 1;
      const k = Math.max(0, 1 + d / BEZEL); // 1 at the edge, 0 at BEZEL inside
      const m = k * k * (3 - 2 * k);
      const i = (y * w + x) * 4;
      img.data[i] = 128 + nx * m * 127;
      img.data[i + 1] = 128 + ny * m * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}
