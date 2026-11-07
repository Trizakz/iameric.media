// tools page behaviour: one tile per tool from tools.js, newest update first, numbered 01, 02, ... in that order; the
// whole tile opens the tool (in this tab). A tile (sub.css .tl-tile) is a square in
// the tool's colour with a cream note (title, description), the tool's logo as an app icon in the corner and the
// version small in the bottom right corner, the number pressed into a band round the tile's foot, in the "tool" category's band colour (as on the project folders).
// Colour and logo come from tool-styles.js; without an entry a tool takes the next colour of PALETTE and the cube.
// Working on the site locally, a pencil beside the title edits them (tools-edit.js). Runs on tools.html
// (mount(document.body)).

import { TOOLS } from './tools.js';
import { TOOL_STYLES } from './tool-styles.js';
import { bandColor } from './projects-page.js';

export const PALETTE = ['#b9a7ff', '#9fcfff', '#9fe3c1', '#ffc59e', '#ffa7c4'];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const sorted = () => [...TOOLS].sort((a, b) => b.date.localeCompare(a.date));
export const styleOf = (t, i, styles = TOOL_STYLES) => ({
  color: styles[t.id]?.color || PALETTE[i % PALETTE.length],
  logo: styles[t.id]?.logo || null,
});
export const logoHTML = logo => (logo ? `<img src="${esc(logo)}" alt="">` : '<span class="material-symbols-rounded">deployed_code</span>');

function card(t, i, styles) {
  const { color, logo } = styleOf(t, i, styles);
  return `<li class="tl-card" style="--tile: ${esc(color)}"><div class="tl-tile"><div class="tl-note">`
    + `<h2 class="tl-name"><a class="tl-open" href="${esc(t.href)}">${esc(t.title)}</a></h2>`
    + `<p class="tl-desc">${esc(t.description)}</p></div><span class="tl-logo" aria-hidden="true">${logoHTML(logo)}</span>`
    + `<span class="tl-band" aria-hidden="true"><span class="tl-num">${String(i + 1).padStart(2, '0')}</span></span>`
    + `<span class="tl-ver">v${esc(t.version)}</span></div></li>`;
}

// each description as large as its note allows (13 px down to 8.5 px), so it is always whole
function fitNotes(list) {
  list.querySelectorAll('.tl-note').forEach(note => {
    const desc = note.querySelector('.tl-desc');
    let size = 13;
    desc.style.fontSize = size + 'px';
    while (note.scrollHeight > note.clientHeight + 1 && size > 8.5) desc.style.fontSize = (size -= 0.5) + 'px';
  });
}

export function render(list, styles = TOOL_STYLES) {
  list.innerHTML = sorted().map((t, i) => card(t, i, styles)).join('');
  fitNotes(list);
}

export function mount(root) {
  const list = root.querySelector('.pj-list');
  if (!list) return { dispose() {} };
  list.style.setProperty('--band-tool', bandColor('tool'));
  render(list);
  document.fonts.ready.then(() => fitNotes(list));
  addEventListener('resize', () => fitNotes(list));
  // the pencil, only while working on the site locally, never for visitors
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) import('./tools-edit.js').then(m => m.mountEditor(root, list));
  return { dispose() {} };
}
