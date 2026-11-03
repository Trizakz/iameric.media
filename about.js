// about page behaviour: the badge pile (drawn
// from badges.js). Runs on the stand-alone about.html (mount(document.body)) and inside
// the home page's overlay (index.html imports the module named in <main data-page> and calls mount(panel)).
//
//   const about = mount(root);
//   about.dispose();   // the overlay is closing

import { BADGES, PILE } from './badges.js';
import { badgeSVG, ensureFonts, flow, gridLayout, withDefaults } from './badge-render.js';
import { mountBadgeFx } from './badge-fx.js';

export function mount(root) {
  const page = root.querySelector('.screen.long');
  if (!page) return { dispose() {} };
  page.classList.add('ab-js');

  // the badges
  const pile = page.querySelector('.ab-pile');
  // a shortcut to the badge editor, only while working on the site locally, never for visitors
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    page.querySelector('.ab-free-text').insertAdjacentHTML('beforeend', '<a class="ab-edit" href="badge-editor.html" target="_blank" rel="noopener" aria-label="edit the badges" title="badge editor"><span class="material-symbols-outlined" aria-hidden="true">edit</span></a>');
  }
  ensureFonts(document, BADGES);
  pile.innerHTML = BADGES.map(b => badgeSVG(b)).join('');
  const els = [...pile.querySelectorAll('.ab-badge')];
  // the honeycomb from badges.js; phones pour the badges into four columns, reading order kept.
  // They arrive one after another in reading order
  const phone = matchMedia('(max-width: 760px)');
  const arrange = () => {
    const list = phone.matches ? flow(BADGES, 4) : BADGES, cols = phone.matches ? 4 : PILE.cols, grid = gridLayout(list, cols);
    pile.style.setProperty('--pile', grid.aspect);
    const order = [...list].sort((a, b) => (a.row ?? 0) - (b.row ?? 0) || (a.col ?? 0) - (b.col ?? 0));
    const delay = new Map(order.map((b, i) => [b.id, 0.1 + i * 0.04]));
    list.forEach(b => {
      const el = els.find(e => e.dataset.badge === b.id), { x, y } = grid.cell(b.col ?? 0, b.row ?? 0);
      el.style.setProperty('--x', `${x}%`);
      el.style.setProperty('--y', `${y}%`);
      el.style.setProperty('--w', `${grid.w}%`);
      el.style.setProperty('--d', `${delay.get(b.id).toFixed(2)}s`);
    });
  };
  arrange();
  phone.addEventListener('change', arrange);
  const fx = mountBadgeFx(pile, BADGES.map(withDefaults));

  // the badges arrive once the pile is in view
  const seen = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      seen.unobserve(e.target);
      // after the badges have landed, hovers and drags get their quick transition back
      if (e.target === pile) {
        fx.arrive();
        setTimeout(() => pile.classList.add('settled'), 2400);
      }
    }
  }, { threshold: 0.15 });
  seen.observe(pile);

  return {
    dispose() {
      seen.disconnect();
      phone.removeEventListener('change', arrange);
      fx.dispose();
    },
  };
}
