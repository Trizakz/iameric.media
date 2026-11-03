// The living part of the holo badges on the about page, on one 2D canvas laid over the pile: very small
// specks drift slowly away from the edge like the fine dust of the home page, with a few large, soft,
// out-of-focus discs (bokeh) among them; now and then a soft light passes across the badge, and the
// rainbow follows the pointer. Hovering a holo badge makes it give off far more, and faster. It stops while off screen, and is left out for reduced motion.
//
//   const fx = mountBadgeFx(pile, badges);   // pile: the .ab-pile element, badges: with their `level`
//   fx.arrive();                             // the badges land now: holo ends it with a flash of light and dust
//   fx.dispose();

const HOLO_LEVEL = 2;
const COLORS = ['#ffffff', '#ffffff', '#ffd6c2', '#ffc2a8', '#ffe6cc'];
const RATE = 0.5; // specks per second, per badge: few, there are many holo badges
const BOKEH_RATE = 0.1; // discs per second, per badge
const HOT = 5; // how many times as many while hovered
const BOKEH = ['#ffb48a', '#ff9a80', '#ffd59a', '#ffe7cf', '#ff8f5c'];

// one tiny soft dot per colour, drawn once and stamped from then on
function sprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d'), r = g.createRadialGradient(8, 8, 0, 8, 8, 8);
  r.addColorStop(0, color);
  r.addColorStop(0.3, color);
  r.addColorStop(1, 'transparent');
  g.fillStyle = r;
  g.fillRect(0, 0, 16, 16);
  return c;
}

// an out-of-focus disc: nearly flat, slightly brighter towards its soft rim
function disc(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, color + '99');
  r.addColorStop(0.72, color + 'b3');
  r.addColorStop(0.9, color + 'ee');
  r.addColorStop(1, color + '00');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export function mountBadgeFx(pile, badges) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { arrive() {}, dispose() {} };
  const holo = [...pile.querySelectorAll('.ab-badge')].filter(el => badges.find(b => b.id === el.dataset.badge)?.level === HOLO_LEVEL);
  if (!holo.length) return { arrive() {}, dispose() {} };

  const canvas = document.createElement('canvas');
  canvas.className = 'ab-fx';
  canvas.setAttribute('aria-hidden', 'true');
  pile.append(canvas);
  const ctx = canvas.getContext('2d');
  const sprites = COLORS.map(sprite), discs = BOKEH.map(disc);
  const BLEED = 90; // the canvas reaches this far past the pile (.ab-fx in about.css)
  let dpr = 1;
  const fit = () => {
    dpr = Math.min(devicePixelRatio, 2);
    canvas.width = (pile.clientWidth + 2 * BLEED) * dpr;
    canvas.height = (pile.clientHeight + 2 * BLEED) * dpr;
  };
  const resize = new ResizeObserver(fit);
  resize.observe(pile);

  const specks = [], warm = new Set();
  // a point on the hexagon's edge, seen from the canvas, and the way out from there
  function spawn(el, bokeh, hot) {
    const box = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
    const a = Math.random() * Math.PI * 2, R = (r.width / 2) * 0.86, cos = Math.cos(a), sin = Math.sin(a);
    const edge = R / Math.max(Math.abs(cos) * 1.155, Math.abs(cos) * 0.577 + Math.abs(sin)); // on the pointy-top hexagon
    const speed = (bokeh ? 2 + Math.random() * 3 : 3 + Math.random() * 6) * (hot ? 2.4 : 1);
    specks.push({
      x: r.left + r.width / 2 + cos * edge - box.left,
      y: r.top + r.height / 2 + sin * edge - box.top,
      vx: cos * speed,
      vy: sin * speed - 3,
      age: 0,
      life: bokeh ? 6 + Math.random() * 5 : 4 + Math.random() * 4,
      size: bokeh ? 7 + Math.random() * 13 : 1.2 + Math.random() * 1.6,
      peak: bokeh ? (hot ? 0.16 : 0.06) + Math.random() * 0.08 : hot ? 0.8 : 0.45,
      bokeh,
      seed: Math.random() * 6,
      img: bokeh ? discs[Math.floor(Math.random() * discs.length)] : sprites[Math.floor(Math.random() * sprites.length)],
    });
  }

  // the rainbow leans with the pointer
  const lean = e => {
    const el = e.currentTarget, r = el.getBoundingClientRect();
    el.style.setProperty('--ix', `${((e.clientX - r.left) / r.width - 0.5) * 120}px`);
    el.style.setProperty('--iy', `${((e.clientY - r.top) / r.height - 0.5) * 120}px`);
  };
  holo.forEach(el => el.addEventListener('pointermove', lean));

  // the light: slow and faint, each badge on its own long rhythm
  const timers = holo.map(el => {
    const timer = {};
    const pass = () => {
      el.querySelector('.shine')?.animate({ translate: ['-200px 0', '200px 0'] }, { duration: 3600, easing: 'ease-in-out' });
      timer.id = setTimeout(pass, 9000 + Math.random() * 7000);
    };
    timer.id = setTimeout(pass, 2000 + Math.random() * 6000);
    return timer;
  });

  let last = 0, raf = 0, shown = false;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    for (const el of holo) {
      const hot = el.matches(':hover'), k = hot ? HOT : 1;
      // arriving on the badge shakes loose a small cloud at once
      if (hot && !warm.has(el)) for (let i = 0; i < 5; i++) spawn(el, i < 1, true);
      warm[hot ? 'add' : 'delete'](el);
      if (Math.random() < RATE * k * dt) spawn(el, false, hot);
      if (Math.random() < BOKEH_RATE * k * dt) spawn(el, true, hot);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = specks.length - 1; i >= 0; i--) {
      const s = specks[i];
      s.age += dt;
      if (s.age >= s.life) { specks.splice(i, 1); continue; }
      s.x += (s.vx + Math.sin(s.age * 0.8 + s.seed) * 2) * dt; // a lazy sway
      s.y += s.vy * dt;
      const k = s.age / s.life;
      const twinkle = s.bokeh ? 1 : 0.6 + 0.4 * Math.sin(s.age * 2.2 + s.seed);
      ctx.globalAlpha = s.peak * Math.min(1, k * (s.bokeh ? 3 : 5)) * (1 - k) * twinkle;
      ctx.drawImage(s.img, s.x - s.size, s.y - s.size, s.size * 2, s.size * 2);
    }
  }
  const seen = new IntersectionObserver(([e]) => {
    if (e.isIntersecting === shown) return;
    shown = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (shown) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  seen.observe(pile);

  const landings = [];
  return {
    arrive() {
      for (const el of holo) {
        landings.push(setTimeout(() => {
          el.querySelector('.shine')?.animate({ translate: ['-200px 0', '200px 0'] }, { duration: 1300, easing: 'ease-out' });
          for (let i = 0; i < 5; i++) spawn(el, false);
          spawn(el, true);
        }, (parseFloat(el.style.getPropertyValue('--d')) + 0.45) * 1000));
      }
    },
    dispose() {
      landings.forEach(clearTimeout);
      seen.disconnect();
      holo.forEach(el => el.removeEventListener('pointermove', lean));
      resize.disconnect();
      cancelAnimationFrame(raf);
      timers.forEach(t => clearTimeout(t.id));
      canvas.remove();
    },
  };
}
