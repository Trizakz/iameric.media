// tools page behaviour: one tile per tool from tools.js, newest update first; the
// whole tile opens the tool (in this tab). A tile (sub.css .tl-tile) is a square in
// the tool's colour with a cream note (title, description), the tool's logo as an app icon in the corner and the
// version small in the bottom right corner. The logo is two or three letters in the tool's colour on a dark square
// (like Adobe's app icons), else an image, else the cube.
// Colour, letters and logo come from tool-styles.js; without an entry a tool takes the next colour of PALETTE.
// Working on the site locally, a pencil beside the title leads to the Site Manager, where they are edited. Runs on tools.html
// (mount(document.body)).

import { TOOLS } from './tools.js';
import { TOOL_STYLES } from './tool-styles.js';

export const PALETTE = ['#2f5bff', '#ff6b57', '#8fd0a8', '#f2c66d', '#c9c3b6'];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const sorted = () => TOOLS.filter(t => !t.hidden).sort((a, b) => b.date.localeCompare(a.date));   // hidden: "public" off in the Site Manager
export const styleOf = (t, i, styles = TOOL_STYLES) => ({
  color: styles[t.id]?.color || PALETTE[i % PALETTE.length],
  logo: styles[t.id]?.logo || null,
  letters: styles[t.id]?.letters || '',
});
export const logoHTML = (logo, letters) => (letters ? `<b class="tl-letters">${esc(letters)}</b>`
  : logo ? `<img src="${esc(logo)}" alt="">` : '<span class="material-symbols-rounded">deployed_code</span>');

function card(t, i, styles) {
  const { color, logo, letters } = styleOf(t, i, styles);
  return `<li class="tl-card" style="--tile: ${esc(color)}"><div class="tl-tile"><div class="tl-note">`
    + `<h2 class="tl-name"><a class="tl-open" href="${esc(t.href)}">${esc(t.title)}</a></h2>`
    + `<p class="tl-desc">${esc(t.description)}</p></div><span class="tl-logo${letters ? ' is-letters' : ''}" aria-hidden="true">${logoHTML(logo, letters)}</span>`
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

// the changelog (after beautifului.dev's task rows): per tool its versions as capsule rows, the newest marked
// "latest"; a row opens to list what changed. Only the newest few show
const SHOW = 3;
const day = d => d.split('-').reverse().join('.');
function changelog(box, styles = TOOL_STYLES) {
  const tools = sorted().filter(t => t.changelog?.length);
  if (!tools.length) { box.hidden = true; return; }
  box.insertAdjacentHTML('beforeend', tools.map(t => {
    const i = sorted().indexOf(t), { color, logo, letters } = styleOf(t, i, styles);
    const rows = t.changelog.slice(0, SHOW).map((v, k) => `<li class="lg-row"><details${k === 0 ? ' open' : ''}><summary>`
      + `<span class="lg-ok" aria-hidden="true"><span class="material-symbols-rounded">check</span></span>`
      + `<span class="lg-v">v${esc(v.version)}</span><span class="lg-t">${esc(v.title)}</span>`
      + `<span class="lg-meta">${v.changes.length} ${v.changes.length === 1 ? 'change' : 'changes'}</span>`
      + `<span class="lg-pill${k === 0 ? ' is-latest' : ''}">${k === 0 ? 'latest' : 'released'}</span>`
      + `<time datetime="${esc(v.date)}">${day(v.date)}</time><span class="material-symbols-rounded lg-chev" aria-hidden="true">expand_more</span></summary>`
      + `<ul class="lg-changes">${v.changes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details></li>`).join('');
    return `<div class="lg-tool"><p class="lg-head"><span class="lg-logo tl-logo${letters ? ' is-letters' : ''}" style="--tile: ${esc(color)}" aria-hidden="true">${logoHTML(logo, letters)}</span>`
      + `<a href="${esc(t.href)}">${esc(t.title)}</a></p><ul class="lg-rows">${rows}</ul></div>`;
  }).join(''));

}

export function mount(root) {
  const list = root.querySelector('.pj-list');
  if (!list) return { dispose() {} };
  render(list);
  const log = root.querySelector('.tl-log');
  if (log) changelog(log);
  document.fonts.ready.then(() => fitNotes(list));
  addEventListener('resize', () => fitNotes(list));
  // the pencil, only while working on the site locally, never for visitors
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    root.querySelector('h1').insertAdjacentHTML('beforeend', '<a class="tl-edit" href="/manage/#tools" aria-label="edit in the Site Manager" title="Site Manager"><span class="material-symbols-rounded" aria-hidden="true">edit</span></a>');
    window.fitSubTitle?.(root);
  }
  return { dispose() {} };
}
