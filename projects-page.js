// projects page behaviour: the cards drawn from projects.js, searched, filtered by category and sorted by date
// (newest first; the arrow in the search bar turns and flips the order). Runs on the stand-alone projects.html
// (mount(document.body)) and inside the home page's overlay (index.html imports the module named in
// <main data-page> and calls mount(panel)).
//
//   const page = mount(root);
//   page.dispose();   // the overlay is closing

import { CATEGORIES, PROJECTS } from './projects.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const shown = date => date.split('-').reverse().join('.'); // 'YYYY-MM-DD' -> 'DD.MM.YYYY'
const icon = name => `<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;

// a card: a pearl plate (like the about page's connections) with the picture inset and the date in a notch cut into
// its top right corner; below, the title and the categories as tags. Without a thumb every card gets the same
// placeholder picture: a gradient with the logo, faint, in white
function card(p) {
  const cats = p.categories.filter(c => CATEGORIES[c]);
  const pic = p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : '<span class="pj-ph" aria-hidden="true"><i></i></span>';
  const date = `datetime="${esc(p.date)}">${shown(p.date)}</time>`;
  return `<li class="pj-card" data-id="${esc(p.id)}"><div class="pj-pic">${pic}</div><time class="pj-date" ${date}`
    + `<div class="pj-info"><h2 class="pj-name">${esc(p.title)}</h2><time class="pj-when" aria-hidden="true" ${date}`
    + `<ul class="pj-cats" aria-label="categories">${cats.map(c => `<li>${icon(CATEGORIES[c].icon)}${CATEGORIES[c].label}</li>`).join('')}</ul></div></li>`;
}

export function mount(root) {
  const page = root.querySelector('.pj');
  if (!page) return { dispose() {} };
  const search = page.querySelector('.pj-search input'), sort = page.querySelector('.pj-sort');
  const chips = page.querySelector('.pj-chips'), list = page.querySelector('.pj-list'), empty = page.querySelector('.pj-empty');
  const views = page.querySelector('.pj-views');
  let filter = 'all', newest = true;

  chips.innerHTML = [['all', 'All'], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.label])]
    .map(([k, label]) => `<button type="button" class="pj-chip" data-cat="${k}" aria-pressed="${k === filter}">${label}</button>`).join('');

  const render = () => {
    const q = search.value.trim().toLowerCase();
    const items = PROJECTS
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
