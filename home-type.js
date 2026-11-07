// The home page's big word (index.html, h1.giant). It is set as wide as the page (but never taller than about a
// third of the window), each letter in a box of its resting width, so a letter can change weight without pushing
// its neighbours. On load the letters rise out of the line one after another, settling from thin to their weight.
// Then the word leans towards the pointer: Unbounded is a variable font (weight 200..900), so the letters near the
// pointer get heavy and turn lavender, the ones far from it get thin. Without a pointer on the word (phones, or the
// mouse elsewhere) a slow wave of weight runs through it.
//
//   mountGiant(document.querySelector('.giant'));

const REST = 600, NEAR = 880, FAR = 260;
const BOX = 850; // each letter's box is as wide as the letter at this weight, so heavy letters barely touch
const WAVE = 90; // the idle wave's reach around REST
const EASE = 0.12; // how quickly a letter follows its target, per frame

export function mountGiant(el) {
  const word = el.textContent.trim();
  el.setAttribute('aria-label', word);
  el.textContent = '';
  const letters = [...word].map((ch, i) => {
    const s = document.createElement('span');
    s.className = 'g-l';
    s.textContent = ch;
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--i', i);
    el.append(s);
    return { el: s, w: REST, k: 0, cx: 0, cy: 0 };
  });
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let size = 100;

  // as large as the box is wide, capped by the window's height; then each letter's box is fixed at its width
  const fit = () => {
    el.style.fontSize = '100px';
    letters.forEach(l => { l.el.style.width = ''; l.el.style.fontWeight = BOX; });
    const avail = el.clientWidth;
    const wide = letters.reduce((sum, l) => sum + l.el.getBoundingClientRect().width, 0);
    size = Math.min((100 * avail) / wide, innerHeight * 0.34);
    el.style.fontSize = `${size}px`;
    letters.forEach(l => { l.el.style.width = `${l.el.getBoundingClientRect().width / size}em`; });
    letters.forEach(l => { l.el.style.fontWeight = l.w.toFixed(1); });
    measure();
  };
  const measure = () => letters.forEach(l => {
    const r = l.el.getBoundingClientRect();
    l.cx = r.left + r.width / 2;
    l.cy = r.top + r.height / 2;
  });
  document.fonts.ready.then(fit);
  addEventListener('resize', fit);
  if (still) return;

  // the pointer, while it is over the page
  const ptr = { x: 0, y: 0, on: false };
  addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = e.pointerType === 'mouse' || e.buttons > 0; });
  document.documentElement.addEventListener('pointerleave', () => { ptr.on = false; });
  addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') ptr.on = false; });
  addEventListener('blur', () => { ptr.on = false; });

  const frame = now => {
    const t = now / 1000, reach = size * 1.15;
    letters.forEach((l, i) => {
      let w, k;
      if (ptr.on) {
        const d = Math.hypot(ptr.x - l.cx, (ptr.y - l.cy) * 1.4);
        const near = Math.exp(-((d / reach) ** 2));
        w = FAR + (NEAR - FAR) * near;
        k = near;
      } else {
        w = REST + WAVE * Math.sin(t * 1.1 - i * 0.75);
        k = 0;
      }
      l.w += (w - l.w) * EASE;
      l.k += (k - l.k) * EASE;
      l.el.style.fontWeight = l.w.toFixed(1);
      l.el.style.setProperty('--k', l.k.toFixed(3));
    });
    requestAnimationFrame(frame);
  };
  // the rise first (CSS, .g-l), then the letters are handed to the loop
  Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)).catch(() => {}).then(() => {
    el.classList.add('live');
    measure();
    requestAnimationFrame(frame);
  });
}
