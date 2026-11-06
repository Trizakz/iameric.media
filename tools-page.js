// tools page behaviour: one card per tool from tools.js, newest update first; the whole card opens the tool.
// Same cards as the projects page (.pj-* in sub.css). Runs on the stand-alone tools.html (mount(document.body))
// and inside the home page's overlay (index.html imports the module named in <main data-page>).

import { TOOLS } from './tools.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const shown = date => date.split('-').reverse().join('.'); // 'YYYY-MM-DD' -> 'DD.MM.YYYY'

function card(t) {
  const pic = t.thumb ? `<img src="${esc(t.thumb)}" alt="" loading="lazy">` : '<span class="pj-ph" aria-hidden="true"><i></i></span>';
  return `<li class="pj-card tl-card"><div class="pj-pic">${pic}</div><time class="pj-date" datetime="${esc(t.date)}">${shown(t.date)}</time>`
    + `<div class="pj-info"><h2 class="pj-name"><a class="tl-open" href="${esc(t.href)}">${esc(t.title)}</a></h2>`
    + `<p class="tl-desc">${esc(t.description)}</p><ul class="pj-cats" aria-label="version"><li>v${esc(t.version)}</li></ul></div></li>`;
}

export function mount(root) {
  const list = root.querySelector('.pj-list');
  if (list) list.innerHTML = [...TOOLS].sort((a, b) => b.date.localeCompare(a.date)).map(card).join('');
  return { dispose() {} };
}
