// projects page behaviour: the insight card on top (when the projects came out), the command bar (search with live
// suggestions, sort, grid or table, category chips with their counts) and the projects as folder cards or as a
// table. Runs on the stand-alone projects.html (mount(document.body)) and inside the home page's overlay
// (index.html imports the module named in <main data-page> and calls mount(panel)).
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
export const BAND_DEFAULTS = { photo: '#f2c66d', video: '#ff6b57', graphics: '#8fd0a8', web: '#5c7dff', tool: '#c9c3b6' };
// the projects plus every tool from tools.js (written by web-tools/publish.js), as a project in the category "tool"
const ALL = [...PROJECTS, ...TOOLS.map(t => ({ id: t.id, title: t.title, date: t.date, categories: ['tool'], thumb: t.thumb }))];
export const bandColor = (k, styles = CATEGORY_STYLES) => styles[k] || BAND_DEFAULTS[k] || '#c9c3b6';
const catsOf = p => p.categories.filter(c => CATEGORIES[c]);

// a card: a square folder (sub.css .pj-folder), like the tool tiles. Inside its rim: the project's picture over the
// top part (without a thumb, the first category's colour blurred into a soft light), the date on the picture's top
// right, and the dark body in front with the title on its tab. The categories are small icons pressed into coloured
// bands wrapped round the whole folder's foot.
// BODY: the body's outline in the folder's 288 x 288 inner box: a tab on the left, stepping down into the body
const BODY = 'M0 134Q0 118 16 118H176C188 118 192 122 198 128L206 136C211 141 215 142 224 142H272Q288 142 288 158V288H0Z';
export function card(p) {
  const cats = catsOf(p);
  const pic = p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : '<span class="pj-ph" aria-hidden="true"></span>';
  const labels = cats.map(c => CATEGORIES[c].label).join(', ');
  return `<li class="pj-card" data-id="${esc(p.id)}" style="--c: var(--band-${cats[0] || 'tool'})"><div class="pj-folder"><div class="pj-clip">`
    + `<div class="pj-pic">${pic}</div><time class="pj-tab" datetime="${esc(p.date)}">${shown(p.date)}</time>`
    + `<div class="pj-front"><svg class="pj-body" viewBox="0 0 288 288" aria-hidden="true"><path d="${BODY}"/></svg>`
    + `<h2 class="pj-name">${esc(p.title)}</h2></div></div>`
    + `<p class="pj-stamp" aria-label="${esc(labels)}">${cats.map(c => `<span class="pj-band" style="--band: var(--band-${c})">${icon(CATEGORIES[c].icon)}</span>`).join('')}</p></div></li>`;
}

// the table view (after beautifului.dev's filter table): a small picture and the title, the date, the categories as
// tinted tags in their band colours
function table(items) {
  const rows = items.map(p => {
    const cats = catsOf(p);
    const pic = p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : '';
    return `<tr data-id="${esc(p.id)}" style="--c: var(--band-${cats[0] || 'tool'})"><td><span class="pt-name"><span class="pt-pic" aria-hidden="true">${pic}</span>${esc(p.title)}</span></td>`
      + `<td><time datetime="${esc(p.date)}">${shown(p.date)}</time></td>`
      + `<td><span class="pt-tags">${cats.map(c => `<span class="pt-tag" style="--band: var(--band-${c})">${icon(CATEGORIES[c].icon)}${CATEGORIES[c].label}</span>`).join('')}</span></td></tr>`;
  }).join('');
  return `<table class="pj-table"><thead><tr><th scope="col">project</th><th scope="col">released</th><th scope="col">category</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ---- the insight tiles (after beautifului.dev's insight cards): when the projects came out, and the categories ----
const year = d => +d.slice(0, 4);
const time = d => new Date(d + 'T12:00:00').getTime();
const SORTED = [...ALL].sort((a, b) => a.date.localeCompare(b.date));
function categories(box) {
  const counts = Object.keys(CATEGORIES).map(k => [k, ALL.filter(p => p.categories.includes(k)).length]).filter(([, n]) => n);
  const top = Math.max(...counts.map(([, n]) => n));
  box.innerHTML = `<ul class="in-bars">${counts.map(([k, n]) => `<li style="--band: var(--band-${k}); --w: ${(n / top) * 100}%">`
    + `<span class="in-k">${icon(CATEGORIES[k].icon)}${CATEGORIES[k].label}</span><span class="in-track"><i></i></span><span class="in-n">${n}</span></li>`).join('')}</ul>`;
}
// the years as a line, each project a dot at its day in its first category's colour; dots in the same month stack
// upwards. Moving over the line reads the nearest project out above it. The wheel zooms in and out round the
// pointer, dragging moves the view sideways (and up and down while a stack is taller than the tile); never further
// than the first and the last project
const DAY = 864e5;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function timeline(box) {
  box.innerHTML = '<div class="in-panel"><p class="in-read" aria-live="polite"><span class="in-read-text">scroll to zoom, drag to move</span></p>'
    + '<div class="in-chart" role="img" aria-label="when the projects came out, as dots on a line of the years"></div></div>';
  const el = box.querySelector('.in-chart'), read = box.querySelector('.in-read-text');
  const first = time(SORTED[0].date), last = time(SORTED[SORTED.length - 1].date);
  const edge = Math.max(20 * DAY, (last - first) * 0.04);
  const lo = first - edge, hi = last + edge, MIN = 45 * DAY; // the whole range, and the closest zoom
  let v0 = lo, v1 = hi, yOff = 0, dots = [], best = -1, drag = null;
  const H = 92, pad = 10, base = H - 24, top = 8;
  const stackOf = {};
  const items = SORTED.map(p => { const k = p.date.slice(0, 7); return { p, t: time(p.date), i: (stackOf[k] = (stackOf[k] ?? -1) + 1) }; });
  const width = () => el.clientWidth || 400;
  // the dots of one month sit close together whatever the zoom, packed tighter if a stack would not fit
  const tallest = Math.max(...items.map(d => d.i));
  const gap = () => (tallest ? Math.min(11, (base - top - 15) / tallest) : 11);
  const yRoom = () => Math.max(0, Math.max(...items.map(d => d.i)) * gap() + 9 - (base - top - 6));
  const clampView = () => {
    const span = Math.min(hi - lo, Math.max(MIN, v1 - v0));
    if (v0 < lo) v0 = lo;
    v1 = v0 + span;
    if (v1 > hi) { v1 = hi; v0 = hi - span; }
    yOff = Math.max(0, Math.min(yRoom(), yOff));
  };
  const draw = () => {
    const W = width(), x = t => pad + ((t - v0) / (v1 - v0)) * (W - pad * 2), span = v1 - v0;
    dots = items.map(d => ({ ...d, x: x(d.t), y: base - 9 - d.i * gap() + yOff }));
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><clipPath id="in-clip"><rect x="0" y="0" width="${W}" height="${base + 1}"/></clipPath></defs>`
      + `<line class="in-axis" x1="${pad}" x2="${W - pad}" y1="${base}" y2="${base}"/>`;
    // ticks: every year, and every month (or every third) once the view is close enough to read them
    const d0 = new Date(v0), monthly = span < 900 * DAY, step = span < 400 * DAY ? 1 : 3;
    for (let y = d0.getFullYear(), m = monthly ? d0.getMonth() : 0; ; m += monthly ? 1 : 12) {
      const t = new Date(y, m, 1).getTime(), X = x(t);
      if (t > v1) break;
      if (t < v0) continue;
      const mo = new Date(t).getMonth(), jan = mo === 0;
      if (!jan && mo % step) continue;
      svg += `<line class="in-tick${jan ? '' : ' minor'}" x1="${X}" x2="${X}" y1="${base}" y2="${base + (jan ? 5 : 3)}"/>`;
      if (X < W - 26) svg += `<text class="in-year${jan ? '' : ' minor'}" x="${X + 4}" y="${H - 4}">${jan ? new Date(t).getFullYear() : MONTHS[mo]}</text>`;
    }
    svg += `<line class="in-cursor" x1="0" x2="0" y1="${top}" y2="${base}"/><g clip-path="url(#in-clip)">`;
    svg += dots.map((d, i) => `<circle class="in-dot${i === best ? ' on' : ''}" cx="${d.x}" cy="${d.y}" r="4.5" style="--band: var(--band-${catsOf(d.p)[0] || 'tool'})"/>`).join('');
    el.innerHTML = svg + '</g></svg>';
    if (best >= 0) mark();
  };
  const mark = () => {
    const s = el.querySelector('svg'), d = dots[best], cur = s.querySelector('.in-cursor');
    cur.setAttribute('x1', d.x); cur.setAttribute('x2', d.x); s.classList.add('reading');
    read.innerHTML = `<b>${esc(d.p.title)}</b> <time>${shown(d.p.date)}</time>`;
  };
  // the dot nearest the pointer, among those in view
  const pick = e => {
    const r = el.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    let b = -1, bd = Infinity;
    dots.forEach((d, i) => {
      if (d.x < 0 || d.x > r.width) return;
      const dist = Math.abs(d.x - px) + Math.abs(d.y - py) * 0.35;
      if (dist < bd) { bd = dist; b = i; }
    });
    if (b < 0) return;
    best = b;
    el.querySelectorAll('.in-dot').forEach((c, i) => c.classList.toggle('on', i === best));
    mark();
  };
  el.addEventListener('wheel', e => {
    e.preventDefault();
    const r = el.getBoundingClientRect(), W = r.width, at = v0 + ((e.clientX - r.left - pad) / (W - pad * 2)) * (v1 - v0);
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { // a sideways swipe moves the view
      const dt = (e.deltaX / W) * (v1 - v0); v0 += dt; v1 += dt;
    } else {
      const k = Math.exp(e.deltaY * 0.0018), span = Math.min(hi - lo, Math.max(MIN, (v1 - v0) * k));
      const f = (at - v0) / (v1 - v0);
      v0 = at - f * span; v1 = v0 + span;
    }
    clampView(); draw(); pick(e);
  }, { passive: false });
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    el.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, v0, v1, yOff };
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', e => {
    if (!drag) { pick(e); return; }
    const W = el.getBoundingClientRect().width, dt = ((e.clientX - drag.x) / (W - pad * 2)) * (drag.v1 - drag.v0);
    v0 = drag.v0 - dt; v1 = drag.v1 - dt; yOff = drag.yOff + (e.clientY - drag.y);
    clampView(); draw();
  });
  const end = () => { drag = null; el.classList.remove('dragging'); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  const ro = new ResizeObserver(draw);
  draw();
  ro.observe(box);
  return () => ro.disconnect();
}
function insights(root) {
  const t = root.querySelector('[data-insight="timeline"]'), c = root.querySelector('[data-insight="categories"]');
  if (c) categories(c);
  return t ? timeline(t) : () => {};
}

export function mount(root) {
  const page = root.querySelector('.pj');
  if (!page) return { dispose() {} };
  const search = page.querySelector('.pj-search input'), sort = page.querySelector('.pj-sort');
  const chips = page.querySelector('.pj-chips'), list = page.querySelector('.pj-list'), empty = page.querySelector('.pj-empty');
  const views = page.querySelector('.pj-views'), suggest = page.querySelector('.pj-suggest'), tableBox = page.querySelector('.pj-tablebox');
  let filter = 'all', newest = true, rows = false, active = -1, found = [];
  Object.keys(CATEGORIES).forEach(k => page.style.setProperty(`--band-${k}`, bandColor(k)));
  const stopInsight = insights(page);
  // the pencil, only while working on the site locally, never for visitors
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) import('./projects-edit.js').then(m => m.mountEditor(root, page));

  const query = () => search.value.trim().toLowerCase();
  const matches = (p, q) => !q || [p.title, ...p.categories.map(c => CATEGORIES[c]?.label || c)].join(' ').toLowerCase().includes(q);

  // the chips: each category with a dot in its colour and how many projects it holds under the current search
  const drawChips = q => {
    const hits = ALL.filter(p => matches(p, q));
    chips.innerHTML = [['all', 'All', hits.length], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.label, hits.filter(p => p.categories.includes(k)).length])]
      .map(([k, label, n]) => `<button type="button" class="pj-chip" data-cat="${k}" aria-pressed="${k === filter}"${k === 'all' ? '' : ` style="--band: var(--band-${k})"`}>`
        + `${k === 'all' ? '' : '<i aria-hidden="true"></i>'}${label}<span class="pj-n">${n}</span></button>`).join('');
  };

  const render = () => {
    const q = query();
    const items = ALL
      .filter(p => filter === 'all' || p.categories.includes(filter))
      .filter(p => matches(p, q))
      .sort((a, b) => (newest ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
    drawChips(q);
    list.innerHTML = rows ? '' : items.map(card).join('');
    tableBox.innerHTML = rows && items.length ? table(items) : '';
    list.hidden = rows;
    empty.hidden = items.length > 0;
    if (!items.length) {
      empty.innerHTML = `${icon('search_off')}<b>nothing found</b><span>${q ? `no project matches “${esc(search.value.trim())}”` : 'no project in this category yet'}${filter !== 'all' ? ` in ${CATEGORIES[filter].label.toLowerCase()}` : ''}.</span>`
        + '<button type="button" data-reset>show all projects</button>';
    }
    drawSuggest(q);
  };

  // the live suggestions under the bar while typing: up to five titles, arrow keys and Enter jump to one
  const drawSuggest = q => {
    found = q ? ALL.filter(p => matches(p, q)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5) : [];
    active = Math.min(active, found.length - 1);
    if (!q || document.activeElement !== search) { suggest.hidden = true; search.setAttribute('aria-expanded', 'false'); return; }
    suggest.hidden = false;
    search.setAttribute('aria-expanded', 'true');
    suggest.innerHTML = found.length
      ? found.map((p, i) => `<li role="option" id="pj-opt-${i}" data-id="${esc(p.id)}" aria-selected="${i === active}">`
        + `<span class="sg-ico" style="--band: var(--band-${catsOf(p)[0] || 'tool'})">${icon(CATEGORIES[catsOf(p)[0] || 'tool'].icon)}</span>`
        + `<span class="sg-name">${mark(p.title, q)}</span><time>${shown(p.date)}</time></li>`).join('')
      : `<li class="sg-none" role="option" aria-disabled="true">${icon('search_off')}no project matches “${esc(search.value.trim())}”</li>`;
    if (active >= 0) search.setAttribute('aria-activedescendant', `pj-opt-${active}`); else search.removeAttribute('aria-activedescendant');
  };
  const mark = (title, q) => {
    const i = title.toLowerCase().indexOf(q);
    return i < 0 ? esc(title) : esc(title.slice(0, i)) + `<mark>${esc(title.slice(i, i + q.length))}</mark>` + esc(title.slice(i + q.length));
  };
  // jumping to a project: the search takes its title, the page scrolls to it and it lights up once
  const jump = id => {
    const p = ALL.find(x => x.id === id);
    if (!p) return;
    search.value = p.title;
    filter = 'all';
    active = -1;
    render();
    suggest.hidden = true;
    const el = page.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      el.classList.remove('pj-hit'); void el.offsetWidth; el.classList.add('pj-hit');
    }
  };

  const onChip = e => {
    const chip = e.target.closest('.pj-chip');
    if (!chip) return;
    filter = chip.dataset.cat;
    render();
  };
  const onSort = () => {
    newest = !newest;
    sort.classList.toggle('flipped', !newest);
    sort.setAttribute('aria-label', newest ? 'sorted newest first, show oldest first' : 'sorted oldest first, show newest first');
    render();
  };
  // grid or table
  const onView = e => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    rows = btn.dataset.view === 'rows';
    views.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    render();
  };
  const onKey = e => {
    if (e.key === 'Escape') { search.value = ''; active = -1; render(); return; }
    if (!found.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + found.length) % found.length;
      drawSuggest(query());
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      jump(found[active].id);
    }
  };
  const onInput = () => { active = -1; render(); };
  const onFocus = () => drawSuggest(query());
  const onBlur = () => setTimeout(() => { if (document.activeElement !== search) suggest.hidden = true; }, 120);
  const onPick = e => {
    const li = e.target.closest('li[data-id]');
    if (li) { e.preventDefault(); jump(li.dataset.id); }
  };
  const onReset = e => {
    if (!e.target.closest('[data-reset]')) return;
    search.value = ''; filter = 'all'; render(); search.focus();
  };
  chips.addEventListener('click', onChip);
  views.addEventListener('click', onView);
  sort.addEventListener('click', onSort);
  search.addEventListener('input', onInput);
  search.addEventListener('keydown', onKey);
  search.addEventListener('focus', onFocus);
  search.addEventListener('blur', onBlur);
  suggest.addEventListener('mousedown', onPick);
  empty.addEventListener('click', onReset);
  render();

  return {
    dispose() {
      stopInsight();
      chips.removeEventListener('click', onChip);
      views.removeEventListener('click', onView);
      sort.removeEventListener('click', onSort);
      search.removeEventListener('input', onInput);
      search.removeEventListener('keydown', onKey);
      search.removeEventListener('focus', onFocus);
      search.removeEventListener('blur', onBlur);
      suggest.removeEventListener('mousedown', onPick);
      empty.removeEventListener('click', onReset);
    },
  };
}
