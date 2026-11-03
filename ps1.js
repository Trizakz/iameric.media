// PS1 look on the particle effects only (home dust, holo badge specks): one SVG filter that
//   1. pixelates: keeps one sample per PX x PX block and grows it over the block (low internal resolution)
//   2. dithers: adds a 4x4 Bayer threshold (masked by alpha, so the canvas stays clear around the specks)
//   3. cuts the colour depth to LEVELS steps per channel
//   4. darkens every second pixel row (scanlines)
(() => {
  const PX = 3;        // one framebuffer pixel in CSS px, odd so the dilate radius stays whole
  const LEVELS = 16;   // colour steps per channel (15-bit would be 32, fewer reads more like the games)
  const SCAN = 0.86;   // brightness of the darker scanline rows

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const svgURI = (w, h, body) =>
    'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" shape-rendering="crispEdges">${body}</svg>`);
  const bayer = svgURI(PX * 4, PX * 4, BAYER.map((v, i) => {
    const g = Math.round((v + 0.5) / 16 * 255);
    return `<rect x="${(i % 4) * PX}" y="${(i >> 2) * PX}" width="${PX}" height="${PX}" fill="rgb(${g},${g},${g})"/>`;
  }).join(''));
  const s = Math.round(SCAN * 255);
  const scan = svgURI(1, PX * 2, `<rect width="1" height="${PX * 2}" fill="#fff"/><rect y="${PX}" width="1" height="${PX}" fill="rgb(${s},${s},${s})"/>`);
  const steps = Array.from({ length: LEVELS }, (_, i) => (i / (LEVELS - 1)).toFixed(4)).join(' ');
  const r = (PX - 1) / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0">
    <filter id="ps1" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feFlood x="${r}" y="${r}" width="1" height="1" flood-color="#fff"/>
      <feComposite width="${PX}" height="${PX}"/>
      <feTile result="grid"/>
      <feComposite in="SourceGraphic" in2="grid" operator="in"/>
      <feMorphology operator="dilate" radius="${r}" result="low"/>
      <feImage href="${bayer}" x="0" y="0" width="${PX * 4}" height="${PX * 4}"/>
      <feTile result="dither"/>
      <feComposite in="dither" in2="low" operator="in" result="ditherA"/>
      <feComposite in="low" in2="ditherA" operator="arithmetic" k2="1" k3="${(1 / LEVELS).toFixed(4)}"/>
      <feComponentTransfer result="cut">
        <feFuncR type="discrete" tableValues="${steps}"/>
        <feFuncG type="discrete" tableValues="${steps}"/>
        <feFuncB type="discrete" tableValues="${steps}"/>
      </feComponentTransfer>
      <feImage href="${scan}" x="0" y="0" width="1" height="${PX * 2}" preserveAspectRatio="none"/>
      <feTile result="lines"/>
      <feComposite in="cut" in2="lines" operator="arithmetic" k1="1"/>
    </filter>
  </svg>`;


  const style = document.createElement('style');
  style.textContent = '.particles canvas, canvas.ab-fx { filter: url(#ps1); }';
  document.head.append(style);
  const mount = () => document.body.insertAdjacentHTML('beforeend', svg);
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
