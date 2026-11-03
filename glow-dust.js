// A few specks of light floating up through the sub pages' glow, like the dust on the home page (particles.js):
// tiny sharp points, mostly off-white with some lavender, that drift slowly upwards with a little sway and twinkle,
// fade out again, then start over somewhere else. Only a handful, on one 2D canvas fixed behind the page's content. Left out for reduced motion.
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
  // a sharp core with only a thin halo: a glint, not a disc
  r.addColorStop(0, color);
  r.addColorStop(0.22, color);
  r.addColorStop(0.45, color.replace(/[\d.]+\)$/, '0.18)'));
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
  // the home page's dust colours: off-white, now and then the accent
  const sprites = [sprite('rgba(242, 240, 234, 1)'), sprite('rgba(201, 184, 255, 1)')];
  let w = 0, h = 0, specks = [], raf = 0, last = performance.now();

  // a new speck: anywhere, but more often low, where the glow is
  const spawn = (fresh = false) => ({
    x: Math.random() * w,
    y: h * (1 - Math.pow(Math.random(), 1.6) * 0.95),
    size: 3 + Math.random() * 3.5, // the sprite's size: the bright core is about a fifth of it, 1 to 1.5px
    rise: 5 + Math.random() * 9, // px per second
    sway: 6 + Math.random() * 10,
    phase: Math.random() * Math.PI * 2,
    life: 7 + Math.random() * 7, // seconds
    age: fresh ? Math.random() * 7 : 0,
    peak: 0.6 + Math.random() * 0.4,
    blink: 1.2 + Math.random() * 2.5, // twinkle speed, as on the home page
    img: sprites[Math.random() < 0.75 ? 0 : 1],
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
      // in and out softly, a quick twinkle on top (like the home page's dust)
      const a = s.peak * Math.sin(Math.PI * k) * (0.55 + 0.45 * Math.sin(s.age * s.blink + s.phase));
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
