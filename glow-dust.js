// A few specks of light floating up through the sub pages' glow, like the dust on a console's home screen: soft
// lavender points that drift slowly upwards with a little sway, brighten and fade out again, then start over
// somewhere else. Only a handful, on one 2D canvas fixed behind the page's content. Left out for reduced motion.
// Used by sub.js (a page of its own) and by the home page's overlay (index.html).
//
//   const dust = mountDust(panel);   // panel: the .subpage element
//   dust.dispose();                  // the overlay is closing

const PER_AREA = 1 / 70000; // specks per square pixel of window: about a dozen on a laptop
const MAX = 18;

// one soft dot, drawn once and stamped for every speck
function sprite(color) {
  const c = document.createElement('canvas'), s = 64;
  c.width = c.height = s;
  const g = c.getContext('2d'), r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, color);
  r.addColorStop(0.18, color);
  r.addColorStop(0.4, color.replace(/[\d.]+\)$/, '0.25)'));
  r.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
  return c;
}

export function mountDust(panel) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { dispose() {} };
  const canvas = document.createElement('canvas');
  canvas.className = 'glow-dust';
  canvas.setAttribute('aria-hidden', 'true');
  panel.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const sprites = [sprite('rgba(236, 228, 255, 1)'), sprite('rgba(190, 172, 255, 1)')];
  let w = 0, h = 0, specks = [], raf = 0, last = performance.now();

  // a new speck: anywhere, but more often low, where the glow is
  const spawn = (fresh = false) => ({
    x: Math.random() * w,
    y: h * (1 - Math.pow(Math.random(), 1.6) * 0.95),
    size: 5 + Math.random() * 9, // the sprite's size: the bright core is about a fifth of it
    rise: 5 + Math.random() * 9, // px per second
    sway: 6 + Math.random() * 10,
    phase: Math.random() * Math.PI * 2,
    life: 7 + Math.random() * 7, // seconds
    age: fresh ? Math.random() * 7 : 0,
    peak: 0.35 + Math.random() * 0.5,
    img: sprites[Math.random() < 0.6 ? 0 : 1],
  });
  const fit = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth;
    h = innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(MAX, Math.round(w * h * PER_AREA));
    while (specks.length < n) specks.push(spawn(true));
    specks.length = n;
  };
  fit();
  addEventListener('resize', fit);

  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < specks.length; i++) {
      const s = specks[i];
      s.age += dt;
      if (s.age >= s.life) { specks[i] = spawn(); continue; }
      const k = s.age / s.life;
      // in and out softly, a slow twinkle on top
      const a = s.peak * Math.sin(Math.PI * k) * (0.8 + 0.2 * Math.sin(s.age * 2.3 + s.phase));
      const x = s.x + Math.sin(s.age * 0.5 + s.phase) * s.sway, y = s.y - s.rise * s.age;
      ctx.globalAlpha = a;
      ctx.drawImage(s.img, x - s.size / 2, y - s.size / 2, s.size, s.size);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener('resize', fit);
      canvas.remove();
    },
  };
}
