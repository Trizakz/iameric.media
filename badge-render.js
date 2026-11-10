// The badges as SVG, drawn from plain data (badges.js). Used by the about page and by badge-editor.html, so a
// badge looks the same in both. A badge is a square tile with soft corners, the icon above the title, and its
// `level` says how much the interest means: 1 cream, 2 holo (the same size, its own finish and effects). The colour is
// soft patches running into each other, set a little differently per badge; soft occlusion along the
// edges. Icons are Google Material
// Symbols, always filled (drawn as ligature text, so any icon name works), text is set in the site's
// fonts. badge-fx.js adds the holo badges' light and specks on the about page.
//
//   import { badgeSVG, ensureFonts } from './badge-render.js';
//   el.innerHTML = badgeSVG(badge);      // one <svg class="ab-badge">
//   ensureFonts(document, badges);      // loads the weights and icons the badges use
//   const g = gridLayout(badges, cols); // the tile board: g.aspect, g.w, g.wOf(b) and g.cell(col, row) -> { x, y }

// the levels, lowest first, with the colour of icon and text
export const LEVELS = [
  { name: 'creme', ink: '#17130c' }, // dark ink on the light pearl plate
  { name: 'holo', ink: '#ffffff' }, // white on the deep cobalt gradient
];

// every setting a badge can have, with its default. badges.js only needs to store what differs.
export const DEFAULTS = {
  id: 'badge',
  title: 'badge',
  // place on the tile board
  col: 0,
  row: 0,
  x: 0,
  y: 0,
  w: 16,
  level: 1, // 1 or 2, see LEVELS
  // icon
  icon: 'star',
  iconSize: 64,
  iconWeight: 500,
  iconGrade: 0,
  iconRot: 0,
  // text
  font: 'DM Sans',
  weight: 500,
  fontSize: 20, // same face, weight and tracking as the page's headings
  tracking: -4, // in 1/100 em
  lineHeight: 1.05,
  case: 'none', // none, lower, upper
  gap: 6, // between icon and text
  shadow: 0.45,
  opacity: 1,
};

export const FONTS = {
  Unbounded: { css: '"Unbounded", sans-serif', weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  'DM Sans': { css: '"DM Sans", sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  'Fira Mono': { css: '"Fira Mono", monospace', weights: [300, 400, 500] },
};

export const withDefaults = b => ({ ...DEFAULTS, ...b });
const f = n => Math.round(n * 10) / 10;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// a square tile in the 200 x 200 box with soft corners (the name HEX stays for the editor's cells)
const C = 100, M = 4, RAD = 46;
const tile = (inset = M, r = RAD) => { const a = inset, z = 200 - inset;
  return `M${a + r} ${a}H${z - r}Q${z} ${a} ${z} ${a + r}V${z - r}Q${z} ${z} ${z - r} ${z}H${a + r}Q${a} ${z} ${a} ${z - r}V${a + r}Q${a} ${a} ${a + r} ${a}Z`; };
export const HEX = tile();

// each level's colours: the ground, then soft patches as [colour, x, y, radius] in shares of the plate
const FINISH = [
  { // the first tier (still called cream): a light, near neutral pearl plate, a white glow rising from its
    // bottom edge, only a breath of lavender in the corners
    base: '#d9d8de',
    fades: [['#ffffff', 0.5, 1.08, 0.6], ['#f4f3f7', 0.5, 0.7, 0.4], ['#c9c6d4', 0.15, 0.12, 0.55], ['#cfcdd6', 0.88, 0.2, 0.5]],
    occlusion: '#2a2733',
    outline: HEX,
    plane: 'rgba(255, 255, 255, 0.18)',
  },
  { // holo: the projects' placeholder gradient (sub.css .pj-ph), deep violet at the top into the lavender of
    // --signal at the bottom, a lavender glow rising from the bottom edge, lilac iridescent bands flowing across
    base: '#2f5bff',
    grad: [['#14287a', 0], ['#2f5bff', 0.38], ['#5c7dff', 0.72], ['#aab9ff', 1]], // top to bottom
    fades: [['#7f97ff', 0.5, 1.04, 0.5]],
    iris: ['#f2f5ff', '#b8c6ff', '#e4eaff', '#8fa5ff', '#f8faff', '#cdd8ff', '#dde5ff', '#f2f5ff', '#b8c6ff', '#e4eaff', '#8fa5ff', '#f8faff', '#cdd8ff'],
    occlusion: '#16224d',
    gloss: 0.6,
    outline: HEX,
  },
];
const random = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const seedOf = s => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 2147483646, 7) + 1;

const cased = (s, c) => (c === 'upper' ? s.toUpperCase() : c === 'lower' ? s.toLowerCase() : s);

// the icon above the title, in the middle
function content(b, ink, id) {
  const cx = C;
  const lines = cased(b.title, b.case).split('\n'), lh = b.fontSize * b.lineHeight;
  const size = b.icon ? b.iconSize : 0, textH = b.fontSize + (lines.length - 1) * lh;
  const total = size + (size ? b.gap : 0) + textH, top = C - total / 2, y = top + total - textH + b.fontSize / 2;
  const icon = b.icon
    ? `<text x="${f(cx)}" y="${f(top + size / 2)}" class="ab-icon" filter="url(#${id}-press)" text-anchor="middle" dominant-baseline="central" fill="${ink}" font-family="Material Symbols Rounded" font-size="${size}" style="font-variation-settings:'wght' ${b.iconWeight},'GRAD' ${b.iconGrade},'opsz' 48"${b.iconRot ? ` transform="rotate(${b.iconRot} ${f(cx)} ${f(top + size / 2)})"` : ''}>${esc(b.icon)}</text>`
    : '';
  const text = `<text y="${f(y)}" text-anchor="middle" dominant-baseline="central" fill="${ink}" font-family='${FONTS[b.font]?.css || FONTS['DM Sans'].css}' font-weight="${b.weight}" font-size="${b.fontSize}" letter-spacing="${b.tracking / 100}em">${lines.map((l, i) => `<tspan x="${f(cx)}" dy="${i ? f(lh) : 0}">${esc(l)}</tspan>`).join('')}</text>`;
  return icon + text;
}

// the board: a square grid in the units of a badge's 200 x 200 box, a gap between the cells, one tile per cell
const GAP = 16, STEP = 200 + GAP;
export const span = () => 1; // every tile takes one cell (holo ones too)
export function gridLayout(badges, cols, extraRows = 0) {
  const rows = Math.max(0, ...badges.map(b => { const d = withDefaults(b); return d.row + span(d); })) + extraRows;
  const width = cols * STEP - GAP, height = Math.max(1, rows) * STEP - GAP;
  const share = n => ((n * STEP - GAP) / width) * 100;
  return {
    rows,
    aspect: width / height,
    w: share(1),
    wOf: b => share(span(b)),
    cell: (col, row) => ({ x: f(((col * STEP) / width) * 1000) / 10, y: f(((row * STEP) / height) * 1000) / 10 }),
    // the cell nearest to a point given in % of the pile
    nearest(px, py) {
      const col = Math.floor(((px / 100) * width) / STEP), row = Math.floor(((py / 100) * height) / STEP);
      return { col: Math.max(0, Math.min(cols - 1, col)), row: Math.max(0, row) };
    },
  };
}
// the badges in reading order, packed into `cols` columns: each takes the first place it fits (phones, a narrower
// board, a badge turned holo)
export function flow(badges, cols) {
  const list = [...badges].map(withDefaults).sort((a, b) => a.row - b.row || a.col - b.col), taken = new Set();
  const free = (c, r, n) => { for (let y = r; y < r + n; y++) for (let x = c; x < c + n; x++) if (x >= cols || taken.has(`${x},${y}`)) return false; return true; };
  return list.map(b => {
    const n = Math.min(span(b), cols);
    for (let r = 0; ; r++) for (let c = 0; c <= cols - n; c++) if (free(c, r, n)) {
      for (let y = r; y < r + n; y++) for (let x = c; x < c + n; x++) taken.add(`${x},${y}`);
      return { ...b, col: c, row: r };
    }
  });
}

export function badgeSVG(input, { uid = input.id, cls = 'ab-badge', place = true } = {}) {
  const b = withDefaults(input);
  const id = `bs-${String(uid).replace(/[^\w-]/g, '')}`;
  const level = Math.min(LEVELS.length, Math.max(1, b.level)), t = LEVELS[level - 1], l = FINISH[level - 1], holo = level === LEVELS.length;
  const style = place ? ` style="--x: ${b.x}%; --y: ${b.y}%; --w: ${b.w}%; --r: 0deg; --shadow: ${b.shadow}; opacity: ${b.opacity}"` : '';
  const shape = l.outline, rnd = random(seedOf(String(uid)));

  // the patches sit a little differently on every badge
  const fades = l.fades.map(([color, x, y, r]) => ({ color, x: (x + (rnd() - 0.5) * 0.16) * 200, y: (y + (rnd() - 0.5) * 0.16) * 200, r: r * 200 }));
  let defs = `<mask id="${id}-plate" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><path d="${shape}" fill="#fff"/></mask>`
    + fades.map((p, i) => `<radialGradient id="${id}-f${i}" gradientUnits="userSpaceOnUse" cx="${f(p.x)}" cy="${f(p.y)}" r="${f(p.r)}"><stop offset="0" stop-color="${p.color}"/><stop offset="1" stop-color="${p.color}" stop-opacity="0"/></radialGradient>`).join('')
    // the edge: a wide soft occlusion all round it, inside the plate
    + `<filter id="${id}-edge" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">`
    + `<feGaussianBlur in="SourceAlpha" stdDeviation="9" result="w"/><feComposite in="SourceAlpha" in2="w" operator="out" result="near"/><feFlood flood-color="${l.occlusion}" flood-opacity="0.5"/><feComposite in2="near" operator="in" result="ao"/>`
    + `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="ao"/></feMerge></filter>`
    + `<filter id="${id}-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2"/></filter>`
    // pressed in: a shadow along the top edge of the icon's hollow, a lit lip along the bottom
    + `<filter id="${id}-press" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">`
    + `<feOffset in="SourceAlpha" dy="1.5" result="down"/><feFlood flood-color="#fff" flood-opacity="0.8"/><feComposite in2="down" operator="in" result="lip"/>`
    + `<feOffset in="SourceAlpha" dy="-0.6"/><feGaussianBlur stdDeviation="1.8" result="up"/><feFlood flood-color="#000" flood-opacity="0.42"/><feComposite in2="up" operator="in" result="rim"/>`
    + `<feMerge><feMergeNode in="rim"/><feMergeNode in="lip"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  if (l.grad) defs += `<linearGradient id="${id}-grad" x2="0" y2="1">${l.grad.map(([c, o]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  let plate = `<rect width="200" height="200" fill="${l.grad ? `url(#${id}-grad)` : l.base}"/>` + fades.map((p, i) => `<rect width="200" height="200" fill="url(#${id}-f${i})"/>`).join('');
  if (l.plane) {
    const y = 88 + rnd() * 24;
    plate += `<path d="M-30 ${f(y + 46)}L230 ${f(y - 46)}V240H-30Z" fill="${l.plane}"/>`;
  }
  // the gloss: one soft diagonal reflection across the plate
  if (l.gloss) {
    defs += `<linearGradient id="${id}-gloss" x2="1" y2="1"><stop offset="0.12" stop-color="#fff" stop-opacity="${l.gloss}"/><stop offset="0.34" stop-color="#fff" stop-opacity="0.04"/><stop offset="0.42" stop-color="#fff" stop-opacity="0"/><stop offset="0.62" stop-color="#fff" stop-opacity="0"/><stop offset="0.7" stop-color="#fff" stop-opacity="${l.gloss * 0.34}"/><stop offset="0.8" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  }
  const gloss = l.gloss ? `<rect width="200" height="200" fill="url(#${id}-gloss)"/>` : '';
  // a groove is the outline again, smaller: a dark cut with a lit lip just below it
  const groove = k => {
    const at = dy => `transform="translate(100 ${100 + dy}) scale(${k}) translate(-100 -100)"`, w = f(2.4 / k);
    return `<path d="${shape}" fill="none" stroke="#2a1600" stroke-opacity="0.26" stroke-width="${f(7 / k)}" filter="url(#${id}-soft)" ${at(0)}/><path d="${shape}" fill="none" stroke="#fff" stroke-opacity="0.65" stroke-width="${w}" ${at(1.6)}/><path d="${shape}" fill="none" stroke="#2a1600" stroke-opacity="0.42" stroke-width="${w}" ${at(0)}/>`;
  };
  const grooves = (l.grooves || []).map(groove).join('');
  // the hover ring: a white line just outside the plate, a plain tile, lit when the badge is hovered (about.css)
  const ring = `<path class="ring" d="${HEX}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" transform="translate(100 100) scale(0.93) translate(-100 -100)" pointer-events="none"/>`;
  let halo = '', shine = '', iris = '';
  if (holo) {
    const colors = l.iris;
    defs += `<linearGradient id="${id}-iris" x2="1" y2="1">${colors.map((c, i) => `<stop offset="${f((i / (colors.length - 1)) * 100)}%" stop-color="${c}"/>`).join('')}</linearGradient>`
      + `<filter id="${id}-halo" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>`
      + `<linearGradient id="${id}-shine" x1="0" x2="1"><stop offset="0.2" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.5"/><stop offset="0.8" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
    // the iridescence: a wide band of colours, far larger than the plate, that drifts and follows the pointer
    // kept out of the plate's edge filter (in its own masked group, below), so the drift never makes the
    // browser run that filter again: Safari keeps a filter's result as long as what it filters stays the same
    iris = `<g class="iris-layer" mask="url(#${id}-plate)"><g class="iris-hand"><g class="iris"><rect x="-120" y="-120" width="440" height="440" fill="url(#${id}-iris)"/></g></g></g>`;
    halo = `<path class="halo" d="${shape}" fill="url(#${id}-iris)" filter="url(#${id}-halo)"/>`;
    // a soft band of light, parked outside the badge until badge-fx.js sends it across
    shine = `<g mask="url(#${id}-plate)" pointer-events="none"><g class="shine" style="translate: -200px 0"><rect x="10" y="-60" width="180" height="320" fill="url(#${id}-shine)" transform="rotate(18 100 100)"/></g></g>`;
  }

  return `<svg class="${cls}" data-badge="${esc(b.id)}" data-level="${level}" viewBox="0 0 200 200" shape-rendering="geometricPrecision"${style} role="img" aria-label="badge: ${esc(b.title.replace(/\n/g, ' '))}, level ${level} of ${LEVELS.length}"><defs>${defs}</defs>`
    + halo
    + `<g transform="translate(100 100) scale(0.86) translate(-100 -100)">`
    + `<g filter="url(#${id}-edge)"><g mask="url(#${id}-plate)">${plate}${gloss}${grooves}</g></g>`
    + iris
    + content(b, t.ink, id)
    + shine
    + `</g>`
    + ring
    + `<path class="hit" d="${HEX}" fill="transparent"/></svg>`; // the only part the pointer can touch

}

// loads what the badges need: every weight of the site's three fonts, and one Material Symbols font
// with all the page's icons plus the badges' icons (with the fill, weight and grade axes). It must be a
// superset of the page's own icon links: the later subset wins, so any icon it lacks breaks.
export function ensureFonts(doc, badges, { allIcons = false } = {}) {
  const head = doc.head;
  if (!head.querySelector('link[data-badge-fonts]')) {
    const l = doc.createElement('link');
    l.rel = 'stylesheet';
    l.dataset.badgeFonts = '';
    l.href = 'https://fonts.googleapis.com/css2?family=Fira+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,100..900&family=Unbounded:wght@200..900&display=swap';
    head.append(l);
  }
  const names = new Set(badges.map(b => b.icon).filter(Boolean));
  doc.querySelectorAll('.material-symbols-rounded').forEach(el => names.add(el.textContent.trim()));
  // also every icon the page's own icon links load: some are only drawn on canvas (the home page's 3D
  // tags draw person, mail, ... on their screens), so they are not in the DOM, and a subset without
  // them would win and turn those icons into their plain names
  doc.querySelectorAll('link[href*="Material+Symbols"]').forEach(l => {
    const m = l.href.match(/icon_names=([^&]+)/);
    if (m) decodeURIComponent(m[1]).split(',').forEach(n => names.add(n));
  });
  const key = allIcons ? '*' : [...names].sort().join(',');
  const old = head.querySelector('link[data-badge-icons]');
  if (old && old.dataset.badgeIcons === key) return;
  const l = doc.createElement('link');
  l.rel = 'stylesheet';
  l.dataset.badgeIcons = key;
  l.href = `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,1,-50..200${allIcons ? '' : `&icon_names=${key}`}&display=block`;
  head.append(l);
  if (old) l.addEventListener('load', () => old.remove());
}
