// sub pages: the title as large as the width allows, like on the tag's screen, but never taller than
// a third of the window. Runs on its own on a stand-alone sub page; the home page calls it for the
// sub page it opens over itself.
window.fitSubTitle = root => {
  const h1 = root.querySelector('h1'), screen = root.querySelector('.screen');
  if (!h1 || !screen) return;
  h1.style.setProperty('--title', '100px');
  const pad = parseFloat(getComputedStyle(screen).paddingLeft);
  const avail = screen.clientWidth - 2 * pad;
  h1.style.setProperty('--title', `${Math.min((100 * avail) / h1.scrollWidth, innerHeight * 0.34)}px`);
};
if (document.body.classList.contains('subpage')) {
  // launched in 2026: "2026" that year, "2026 – <current year>" afterwards
  const LAUNCH = 2026, thisYear = new Date().getFullYear();
  document.querySelectorAll('.year').forEach(el => {
    el.textContent = thisYear > LAUNCH ? `${LAUNCH} – ${thisYear}` : String(LAUNCH);
  });
  document.fonts.ready.then(() => fitSubTitle(document.body));
  addEventListener('resize', () => fitSubTitle(document.body));
  // the wordmark's logo builds itself on every load, as on the home page
  const logo = document.querySelector('.sub-mark .mark-logo');
  if (logo && !matchMedia('(prefers-reduced-motion: reduce)').matches) import('./logo-build.js').then(m => m.buildMark(logo));
  // a few specks floating up through the glow
  import('./glow-dust.js').then(m => m.mountDust(document.body));
}
