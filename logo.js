// The logo as a small loader: the eye rests on the "i", looks round once and comes back ("glance",
// logo/animation/logo-loader-final.html).
//
//   el.innerHTML = iamericGlance(32);  // a looping loader, 32 px
(() => {
  // the logo's three parts (assets/logo.svg): the i dot, the join, the ring; the eye is cut by a mask so it can turn
  const DOT = 'M39.52 58.45a18.93 18.93 0 1 0 37.86 0a18.93 18.93 0 1 0 -37.86 0Z';
  const JOIN = 'M105.15 58.45A36.4 36.4 0 1 1 141.55 94.85A46.7 46.7 0 0 0 94.85 141.55A36.4 36.4 0 1 1 58.45 105.15A46.7 46.7 0 0 0 105.15 58.45Z';
  const C = '141.55 141.55'; // the ring's centre: the eye turns round it
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let uid = 0;

  // spin: the SMIL timing of the eye's turn
  function mark(spin, attrs) {
    const id = `ia-eye-${uid++}`;
    return `<svg viewBox="22.05 22.05 155.9 155.9" fill="currentColor" aria-hidden="true" ${attrs}>`
      + `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><rect width="200" height="200" fill="#fff"/>`
      + `<g><circle cx="134.27" cy="134.27" r="16.74" fill="#000"/>${spin && !still ? `<animateTransform attributeName="transform" type="rotate" ${spin}/>` : ''}</g></mask>`
      + `<path d="${DOT}"/><path d="${JOIN}"/><circle cx="141.55" cy="141.55" r="36.4" mask="url(#${id})"/></svg>`;
  }

  // the loader: the eye rests on the "i", looks round once (eased), and so on
  const GLANCE = `values="0 ${C};0 ${C};360 ${C}" keyTimes="0;0.4;1" calcMode="spline" keySplines="0 0 1 1;0.65 0 0.25 1" dur="3.2s" repeatCount="indefinite"`;
  window.iamericGlance = size => mark(GLANCE, `width="${size}" height="${size}" class="glance"`);

})();
