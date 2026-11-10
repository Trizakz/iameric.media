// the home page's start animation (intro.css): "iameric" typed on letter by letter on a tilted plane of plus signs,
// "(media designer)" typed after it, a short hold, then the plane tips away and the home shows. Runs only
// when the head script set html.intro-on (first visit in this tab, motion allowed); a click or key skips to the end.

const root = document.documentElement;
const box = document.querySelector('.intro-anim');

if (box && root.classList.contains('intro-on')) {
  const plane = box.querySelector('.ia-plane'), field = box.querySelector('.ia-field');
  // the letters as spans, so each can be typed on
  box.querySelectorAll('.ia-word, .ia-add').forEach(el => {
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = [...el.textContent].map(c => `<span>${c}</span>`).join('');
  });
  const big = [...box.querySelectorAll('.ia-word span')], small = [...box.querySelectorAll('.ia-add span')];
  const out = 'cubic-bezier(0.22, 1, 0.36, 1)', pop = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const anims = [];
  const run = (el, frames, opts) => { const a = el.animate(frames, { fill: 'forwards', ...opts }); anims.push(a); return a; };

  // the field comes up and drifts the whole time
  run(field, [{ opacity: 0 }, { opacity: 0.55 }], { duration: 600, easing: out });
  run(field, [{ translate: '0 0' }, { translate: '-80px -120px' }], { duration: 4000, easing: 'linear' });
  // the plane leans in a little while the words are typed
  run(plane, [{ scale: 0.92 }, { scale: 1 }], { duration: 2200, easing: out });
  // the big word: one letter after another, each popping up out of the plane
  big.forEach((s, i) => run(s, [
    { opacity: 0, transform: 'translateY(0.2em) scale(0.6)' },
    { opacity: 1, transform: 'translateY(0) scale(1)' },
  ], { duration: 360, delay: 250 + i * 75, easing: pop }));
  // the addition in brackets, typed quickly like on a keyboard
  const t1 = 250 + big.length * 75 + 150;
  small.forEach((s, i) => run(s, [{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: t1 + i * 24 }));

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    // the home's own entrance runs from here, under the leaving plane
    root.classList.remove('intro-on');
    box.style.display = 'grid';
    anims.forEach(a => a.pause());
    const leave = { duration: 800, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' };
    plane.animate([{ transform: getComputedStyle(plane).transform, opacity: 1 }, { transform: 'rotateX(70deg) rotateY(-16deg) rotateZ(-7deg) translateY(-30%)', opacity: 0 }], leave);
    box.animate([{ opacity: 1 }, { opacity: 0 }], { ...leave, duration: 700, delay: 150 }).finished.then(() => box.remove());
  };
  const end = t1 + small.length * 24 + 900;
  const timer = setTimeout(finish, end);
  const skip = () => { clearTimeout(timer); finish(); };
  box.addEventListener('pointerdown', skip, { once: true });
  addEventListener('keydown', skip, { once: true });
} else {
  box?.remove();
}
