// the menu bar (nav.css): marks it .scrolled as soon as whatever scrolls the page (the window, or a sub page's own
// panel) has left the top
const nav = document.querySelector('.site-nav');
if (nav) {
  addEventListener('scroll', e => {
    const el = e.target === document ? document.scrollingElement : e.target;
    nav.classList.toggle('scrolled', el.scrollTop > 4);
  }, { capture: true, passive: true });
}

// the pill in the links' track: it rests under the current page and slides to whichever link the pointer or the
// focus is on (nav.css .nav-links::before reads --x, --w and --on)
const track = document.querySelector('.nav-links');
if (track) {
  const current = track.querySelector('[aria-current="page"]');
  const moveTo = a => {
    if (!a) return track.style.setProperty('--on', '0');
    track.style.setProperty('--x', `${a.offsetLeft}px`);
    track.style.setProperty('--w', `${a.offsetWidth}px`);
    track.style.setProperty('--on', '1');
  };
  const rest = () => moveTo(current);
  // place it without sliding the first time
  const place = () => {
    track.classList.remove('ready');
    track.style.transition = 'none';
    rest();
    requestAnimationFrame(() => { track.style.transition = ''; track.classList.add('ready'); });
  };
  track.querySelectorAll('a').forEach(a => {
    a.addEventListener('pointerenter', () => moveTo(a));
    a.addEventListener('focus', () => moveTo(a));
  });
  track.addEventListener('pointerleave', rest);
  track.addEventListener('focusout', e => { if (!track.contains(e.relatedTarget)) rest(); });
  document.fonts?.ready.then(place);
  addEventListener('resize', place);
  place();
}
