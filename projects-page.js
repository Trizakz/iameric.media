// projects page behaviour: the cards drawn from projects.js, searched, filtered by category and sorted by date
// (newest first; the arrow in the search bar turns and flips the order). Runs on the stand-alone projects.html
// (mount(document.body)) and inside the home page's overlay (index.html imports the module named in
// <main data-page> and calls mount(panel)).
//
//   const page = mount(root);
//   page.dispose();   // the overlay is closing

import { CATEGORIES, PROJECTS } from './projects.js';
import { TOOLS } from './tools.js';
import { CATEGORY_STYLES } from './category-styles.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const shown = date => date.split('-').reverse().join('.'); // 'YYYY-MM-DD' -> 'DD.MM.YYYY'
const icon = name => `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
// each category's band colour (the bands round the folders' foot): category-styles.js, set with the pencil beside
// the title (projects-edit.js, only on localhost); these until one is set
export const BAND_DEFAULTS = { photo: '#ffc59e', video: '#ffa7c4', graphics: '#9fe3c1', web: '#9fcfff', tool: '#8f7bff' };
// the projects plus every tool from tools.js (written by web-tools/publish.js), as a project in the category "tool"
const ALL = [...PROJECTS, ...TOOLS.map(t => ({ id: t.id, title: t.title, date: t.date, categories: ['tool'], thumb: t.thumb }))];
export const bandColor = (k, styles = CATEGORY_STYLES) => styles[k] || BAND_DEFAULTS[k] || '#c9b8ff';

// a card: a folder (sub.css .pj-folder): its dark back with the tab and the date on it, the project's picture
// standing straight inside, its top just out of the folder, and a frosted glass front with the title in the middle
// and the categories as small icons pressed into coloured bands round the folder's foot. Without a thumb every card gets the same
// placeholder picture: a gradient with the logo, faint, in white. .pj-info repeats title, date and categories beside
// the small folder in rows.
// BACK: the back's outline in a 250 x 216 box (the back's own proportions, so nothing stretches): a tab on the left,
// stepping down into the body. It is the back's mask (--pj-back) and the path of its lit edge
const BACK = 'M0 18Q0 0 18 0H90C100 0 104 3 110 9L116 15C120 19 124 20 132 20H232Q250 20 250 38V198Q250 216 232 216H18Q0 216 0 198Z';
const BACK_MASK = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 250 216' preserveAspectRatio='none'><path d='${BACK}'/></svg>`)}")`;
function card(p) {
  const cats = p.categories.filter(c => CATEGORIES[c]);
  const pic = p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : '<span class="pj-ph" aria-hidden="true"><i></i></span>';
  const date = `datetime="${esc(p.date)}">${shown(p.date)}</time>`;
  const labels = cats.map(c => CATEGORIES[c].label).join(', ');
  return `<li class="pj-card" data-id="${esc(p.id)}"><div class="pj-folder"><span class="pj-back" aria-hidden="true"></span>`
    + `<svg class="pj-edge" viewBox="0 0 250 216" preserveAspectRatio="none" aria-hidden="true"><path d="${BACK}"/></svg><time class="pj-tab" ${date}`
    + `<div class="pj-pic">${pic}</div><div class="pj-front"><h2 class="pj-name">${esc(p.title)}</h2>`
    + `<p class="pj-stamp" aria-label="${esc(labels)}">${cats.map(c => `<span class="pj-band" style="--band: var(--band-${c})">${icon(CATEGORIES[c].icon)}</span>`).join('')}</p></div></div>`
    + `<div class="pj-info" aria-hidden="true"><p class="pj-row-name">${esc(p.title)}</p><time class="pj-when" ${date}`
    + `<ul class="pj-cats">${cats.map(c => `<li>${icon(CATEGORIES[c].icon)}${CATEGORIES[c].label}</li>`).join('')}</ul></div></li>`;
}

export function mount(root) {
  const page = root.querySelector('.pj');
  if (!page) return { dispose() {} };
  const search = page.querySelector('.pj-search input'), sort = page.querySelector('.pj-sort');
  const chips = page.querySelector('.pj-chips'), list = page.querySelector('.pj-list'), empty = page.querySelector('.pj-empty');
  const views = page.querySelector('.pj-views');
  let filter = 'all', newest = true;
  list.style.setProperty('--pj-back', BACK_MASK);
  Object.keys(CATEGORIES).forEach(k => list.style.setProperty(`--band-${k}`, bandColor(k)));
  // the pencil, only while working on the site locally, never for visitors
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) import('./projects-edit.js').then(m => m.mountEditor(root, list));

  chips.innerHTML = [['all', 'All'], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.label])]
    .map(([k, label]) => `<button type="button" class="pj-chip" data-cat="${k}" aria-pressed="${k === filter}">${label}</button>`).join('');

  const render = () => {
    const q = search.value.trim().toLowerCase();
    const items = ALL
      .filter(p => filter === 'all' || p.categories.includes(filter))
      .filter(p => !q || [p.title, ...p.categories.map(c => CATEGORIES[c]?.label || c)].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (newest ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
    list.innerHTML = items.map(card).join('');
    empty.hidden = items.length > 0;
  };

  const onChip = e => {
    const chip = e.target.closest('.pj-chip');
    if (!chip) return;
    filter = chip.dataset.cat;
    chips.querySelectorAll('.pj-chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
    render();
  };
  const onSort = () => {
    newest = !newest;
    sort.classList.toggle('flipped', !newest);
    sort.setAttribute('aria-label', newest ? 'sorted newest first, show oldest first' : 'sorted oldest first, show newest first');
    render();
  };
  // grid or rows: the same cards, laid out by CSS (.pj-list.rows)
  const onView = e => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    list.classList.toggle('rows', btn.dataset.view === 'rows');
    views.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  };
  chips.addEventListener('click', onChip);
  views.addEventListener('click', onView);
  sort.addEventListener('click', onSort);
  search.addEventListener('input', render);
  render();

  return {
    dispose() {
      chips.removeEventListener('click', onChip);
      views.removeEventListener('click', onView);
      sort.removeEventListener('click', onSort);
      search.removeEventListener('input', render);
    },
  };
}
