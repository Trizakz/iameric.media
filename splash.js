// The home page's splash: the logo builds itself (one drop, a soft half turn, the eyeball flung out of the top
// circle, the little dot shot through the stroke), then the eye and the dot orbit the stroke's thin middle like two
// moons while the page loads; once the page is ready it fades out on the next resting logo. The animation is the one
// approved in logo/animation/logo-loop-final.html (logo-build.js).
//
//   index.html marks <html class="splash"> and holds <div class="splash-screen"> while it should run;
//   this module draws into it and ends it once window gets the event 'iameric:ready' (or on a click or a key),
//   then fires 'iameric:splashdone' and removes it.

import { BUILD, CYCLE, HOLD, loopState, drawState } from './logo-build.js';

const screen = document.querySelector('.splash-screen');
if (screen) {
  const canvas = screen.querySelector('canvas');
  const fit = () => {
    const size = canvas.getBoundingClientRect().width * Math.min(devicePixelRatio || 1, 2);
    canvas.width = canvas.height = Math.max(64, Math.round(size));
  };
  fit();
  addEventListener('resize', fit);
  let ready = false, ending = false, raf = 0;
  const start = performance.now();
  addEventListener('iameric:ready', () => { ready = true; }, { once: true });
  const end = () => {
    if (ending) return;
    ending = true;
    screen.classList.add('out');
    setTimeout(() => {
      cancelAnimationFrame(raf);
      canvas._gl?.gl.getExtension('WEBGL_lose_context')?.loseContext(); // give the GPU context back to the page
      screen.remove();
      document.documentElement.classList.remove('splash');
      dispatchEvent(new Event('iameric:splashdone'));
    }, 600);
  };
  const skip = () => end();
  screen.addEventListener('click', skip);
  addEventListener('keydown', skip, { once: true });
  const frame = now => {
    const ms = now - start;
    drawState(loopState(ms), '.splash-screen canvas');
    // once the page is ready and the logo has built, end on the next moment the logo rests upright
    if (ready && ms >= BUILD && (ms - BUILD) % CYCLE < HOLD) end();
    if (!ending || screen.isConnected) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
