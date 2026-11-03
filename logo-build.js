// The logo's build and orbit, one signed distance field drawn with WebGL (see FRAG), as approved in
// logo/animation/logo-loop-final.html. Used by splash.js (the home page's splash) and by the home page's wordmark
// intro (the logo builds itself, small, before the word sweeps in).
//
//   drawState(buildState(t), 'canvas.x');   // the build at t (0..1, over BUILD ms) into every matching canvas
//   drawState(loopState(ms), 'canvas.x');   // the build once, then the orbit; ms since the start
//   (each canvas takes its colour from its CSS color)

  const RING = { x: 141.55, y: 141.55, r: 36.4 }, HOLE = { x: 134.27, y: 134.27, r: 16.74 };
  const TL = { x: 58.45, y: 58.45 }, TR = { x: 141.55, y: 58.45 }, BL = { x: 58.45, y: 141.55 }, MID = { x: 100, y: 100 };
  const DOT_R = 18.93, BIG = 36.4, NECK = 26, LOOP = 4200;
  // ---- the build: one drop -> a cell division into the stroke's two drops (still joined) while the ring buds off
  // and tears away -> the eye opens -> a little drop squeezes out of the eye, flows through the stroke and settles
  // as the i dot. The whole shape turns into place the whole time and ends as the sharp logo
  const BUILD = 3800;
  const clamp01 = k => Math.min(1, Math.max(0, k));
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const back = k => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }; // overshoots a little, then settles
  const seg = (t, a, b, e = easeInOut) => e(clamp01((t - a) / (b - a)));
  const inOut5 = k => (k < 0.5 ? 16 * k ** 5 : 1 - Math.pow(-2 * k + 2, 5) / 2); // soft at both ends, quick in the middle
  const out5 = k => 1 - Math.pow(1 - k, 5); // a long, soft landing
  const smooth = k => k * k * (3 - 2 * k);
  // a CSS-style cubic-bezier easing (x1, y1, x2, y2), solved for x by a few Newton steps
  const bezier = (x1, y1, x2, y2) => k => {
    const B = (a, b, u) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
    let u = k;
    for (let n = 0; n < 8; n++) {
      const x = B(x1, x2, u) - k, dx = 3 * x1 * (1 - u) ** 2 + 6 * (x2 - x1) * u * (1 - u) + 3 * (1 - x2) * u * u;
      if (Math.abs(dx) < 1e-6) break;
      u = clamp01(u - x / dx);
    }
    return B(y1, y2, u);
  };
  const longOut = bezier(0.45, 0, 0.1, 1); // a soft start, then a long, slow arrival
  const L = (a, b, k) => a + (b - a) * k, LP = (p, q, k) => ({ x: L(p.x, q.x, k), y: L(p.y, q.y, k) });
  const s_ = TR.x - TL.x; // the grid spacing (83.1)
  const BR = { x: RING.x, y: RING.y }, HOLE_OFF = Math.hypot(HOLE.x - RING.x, HOLE.y - RING.y);
  function buildState(t) {
    // every move of every blob eases in and out (no springs, no overshoot, no hard stops)
    const io = (a, b) => seg(t, a, b, easeInOut);
    // 1. one drop grows and pulls apart into the stroke's two joined circles; the turn already eases in meanwhile
    const pop = io(0, 0.1);
    const apart = io(0.03, 0.22);
    const top = { ...LP(MID, TR, apart), r: L(30, BIG, apart) * pop };
    const bottom = { ...LP(MID, BL, apart), r: L(30, BIG, apart) * pop };
    const shaped = io(0.26, 0.42); // soft waist -> the logo's stroke, while it turns
    // 2. half a turn clockwise (-180 -> 0: the stroke looks the same either way, so the logo lands upright)
    const rot = 180 * (seg(t, 0.05, 0.66, longOut) - 1); // eases in while the stroke forms, then a long, slow ease out
    // 3. as the turn slows down, the eyeball keeps going: it slides out of the top circle, straight down, small at
    // first and growing as it goes, pulling a liquid neck behind it that thins and tears once it is clear
    const FLING = 0.24; // while it is still turning: the eyeball slides out as the turn begins to slow
    const fly = seg(t, FLING, 0.7, longOut);
    const ring = { ...LP(TR, BR, fly), r: t < FLING ? 0 : L(7, BIG, seg(t, FLING, 0.7, longOut)) };
    // ring and stroke stay joined by the liquid until the little drop shoots through: only then does the gap open
    const kRing = t < FLING ? 0 : 32 * io(FLING, 0.32) * (1 - io(0.74, 0.88));
    // 4. the eye opens
    const open = io(0.58, 0.7);
    // 5. a little drop forms in the eye, then travels through the ring and the stroke's middle to the top left
    // the shot: slow out of the eye, quick through the middle, a soft landing (a strong ease in and out)
    const born = io(0.64, 0.71), shoot = seg(t, 0.7, 1, longOut);
    const dot = { ...LP(BR, TL, shoot), r: t < 0.64 ? 0 : L(8, DOT_R, seg(t, 0.72, 1, longOut)) * born }; // small in the eye, grows on the way
    const kDot = t < 0.64 ? 0 : 22 * (1 - io(0.84, 1));
    // the eye looks at the drop as it travels
    const ang0 = Math.atan2(dot.y - ring.y, dot.x - ring.x), off = HOLE_OFF * seg(t, 0.72, 1, longOut);
    const hole = { x: ring.x + off * Math.cos(ang0), y: ring.y + off * Math.sin(ang0), r: HOLE.r * open };
    return { top, bottom, ring, hole, dot, rot, lift: 0, shaped, kRing, kDot };
  }
  // the renderer: a signed distance field (after Inigo Quilez's 2D distance functions and smooth minimum).
  // Each part is a distance to its edge; the stroke is the tube between its two drops, pushed away by the dot
  // and the ring; a smooth minimum melts parts into a neck wherever they come within K of each other and
  // leaves them alone further apart, so the logo at rest (gaps of 10.3) comes out exactly
  const K = 9;
  const FRAG = `precision highp float;
    uniform vec2 uRes; uniform vec3 uA, uB, uD, uE, uH, uColor; uniform float uRot, uLift, uKR, uKD, uShaped;
    uniform float uOrbit, uGap, uAlpha, uW; uniform vec3 uOrder, uN, uH2;
    float circ(vec2 p, vec3 c) { return length(p - c.xy) - c.z; }
    float tube(vec2 p, vec3 a, vec3 b) {
      vec2 pa = p - a.xy, ba = b.xy - a.xy; float l = dot(ba, ba);
      float h = l < 1e-4 ? 0.0 : clamp(dot(pa, ba) / l, 0.0, 1.0);
      return length(pa - ba * h) - mix(a.z, b.z, h);
    }
    // the logo's join: the quadrilateral between the points where each drop faces the dot and the ring
    // (the tangent points of the logo's construction), as the largest of its four edge distances
    float edge(vec2 p, vec2 a, vec2 b, vec2 inside) {
      vec2 n = normalize(vec2(b.y - a.y, a.x - b.x));
      if (dot(inside - a, n) > 0.0) n = -n;
      return dot(p - a, n);
    }
    float join(vec2 p, vec3 a, vec3 b, vec2 d, vec2 e) {
      vec2 p1 = a.xy + a.z * normalize(d - a.xy), p2 = a.xy + a.z * normalize(e - a.xy);
      vec2 p3 = b.xy + b.z * normalize(e - b.xy), p4 = b.xy + b.z * normalize(d - b.xy);
      vec2 m = (p1 + p2 + p3 + p4) * 0.25;
      return max(max(edge(p, p1, p2, m), edge(p, p2, p3, m)), max(edge(p, p3, p4, m), edge(p, p4, p1, m)));
    }
    float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
    // the smooth counterpart of cutting: the liquid is pressed in with a soft, rounded edge instead of cut off
    float smax(float a, float b, float k) { return k <= 0.01 ? max(a, b) : -smin(-a, -b, k); }
    void main() {
      // pixel -> the logo's units (the 6..194 box), turned and lifted like the whole shape
      vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * 188.0 + 6.0;
      p -= vec2(100.0, 100.0 + uLift);
      float c = cos(-uRot), s = sin(-uRot);
      p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 100.0;
      // the stroke carries the logo's own shape, wherever its two drops are: the square they span on their
      // diagonal gives the other two corners, and around those the flanks curve (a module plus the gap, s - r)
      float d0 = length(uB.xy - uA.xy);
      vec2 u = (uB.xy - uA.xy) / max(d0, 1e-3), nn = vec2(-u.y, u.x), mid = (uA.xy + uB.xy) * 0.5;
      float side = d0 * 0.70710678, push = side - uA.z;
      vec2 c1 = mid + nn * d0 * 0.5, c2 = mid - nn * d0 * 0.5; // where the dot and the ring sit in the logo
      float shaped = min(join(p, uA, uB, c1, c2), min(circ(p, uA), circ(p, uB)));
      shaped = max(shaped, max(push - length(p - c1), push - length(p - c2)));
      float soft = smin(circ(p, uA), circ(p, uB), 95.0);
      float stroke = mix(soft, shaped, uShaped);
      // dot and ring are free; each joins the rest only through its own liquid blend
      // each pair has its own blend, so the drop can melt into the stroke and out of the ring without
      // gluing the ring back onto the stroke
      float ring = uH.z > 2.0 ? smax(circ(p, uE), -circ(p, uH), 2.0) : circ(p, uE);
      float dot_ = circ(p, uD);
      float d = stroke;
      if (uE.z > 0.01) d = min(d, uKR > 0.02 ? smin(stroke, ring, uKR) : min(stroke, ring));
      if (uD.z > 0.01) {
        d = min(d, uKD > 0.02 ? smin(stroke, dot_, uKD) : dot_);
        if (uE.z > 0.01) d = min(d, uKD > 0.02 ? smin(ring, dot_, min(uKD, 5.0)) : dot_); // a light blend: the eye stays open around the drop
      }
      if (uOrbit > 0.5) {
        // the eye as a real ball: a sphere with a round opening on its surface (around the direction uN, of angular
        // radius uAlpha). Its outline stays a circle from every side; the opening travels over the ball, narrows
        // towards its edge and disappears behind it. uW blends from the logo's flat hole (uH2) at rest
        vec2 v = (p - uE.xy) / uE.z;
        float rr = dot(v, v);
        float opening = 1e3;
        if (rr < 1.0) {
          vec3 sp = vec3(v, sqrt(1.0 - rr)); // the visible surface point (x right, y down, z towards you)
          opening = (acos(clamp(dot(sp, uN), -1.0, 1.0)) - uAlpha) * uE.z;
        }
        float flat_ = length(p - uH2.xy) - uH2.z;
        float pupil = mix(flat_, opening, uW);
        float ball = circ(p, uE);
        // back to front: each layer cuts a gap into what lies behind it, then covers it. The eye covers with its
        // whole ball and then paints its opening dark (a pupil on its surface, not a hole to look through)
        d = 1e3;
        for (int i = 0; i < 3; i++) {
          float id = i == 0 ? uOrder.x : (i == 1 ? uOrder.y : uOrder.z);
          float L = id < 0.5 ? stroke : (id < 1.5 ? ball : dot_);
          d = i == 0 ? L : min(max(d, uGap - L), L);
          if (id > 0.5 && id < 1.5) d = max(d, -pupil);
        }
      }
      float px = 188.0 / uRes.x; // logo units per pixel: one pixel of soft edge
      float a = clamp(0.5 - d / px, 0.0, 1.0);
      gl_FragColor = vec4(uColor * a, a);
    }`;
  function glFor(canvas) {
    if (canvas._gl) return canvas._gl;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true });
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 q; void main() { gl_Position = vec4(q, 0.0, 1.0); }'));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'q');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = n => gl.getUniformLocation(prog, n);
    const col = getComputedStyle(canvas).color.match(/[\d.]+/g).slice(0, 3).map(v => v / 255);
    return (canvas._gl = { gl, u, col });
  }
  function drawState(st, sel) {
    for (const canvas of document.querySelectorAll(sel)) {
      const { gl, u, col } = glFor(canvas);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u('uRes'), canvas.width, canvas.height);
      const v3 = (n, c) => gl.uniform3f(u(n), c.x, c.y, Math.max(0, c.r));
      v3('uA', st.top); v3('uB', st.bottom); v3('uD', st.dot); v3('uE', st.ring); v3('uH', st.hole);
      gl.uniform3f(u('uColor'), col[0], col[1], col[2]);
      gl.uniform1f(u('uRot'), st.rot * Math.PI / 180); gl.uniform1f(u('uLift'), st.lift); gl.uniform1f(u('uKR'), st.kRing); gl.uniform1f(u('uKD'), st.kDot); gl.uniform1f(u('uShaped'), st.shaped);
      const o = st.orbit;
      gl.uniform1f(u('uOrbit'), o ? 1 : 0);
      if (o) {
        gl.uniform1f(u('uGap'), o.gap); gl.uniform1f(u('uAlpha'), o.alpha); gl.uniform1f(u('uW'), o.w);
        gl.uniform3f(u('uN'), o.n[0], o.n[1], o.n[2]); gl.uniform3f(u('uH2'), o.flat.x, o.flat.y, o.flat.r);
        gl.uniform3f(u('uOrder'), o.order[0], o.order[1], o.order[2]);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
  // ---- the orbit: the logo stays; the eye and the dot circle the stroke's thin middle like two moons. They sit
  // opposite each other across the stroke, both ORB from its middle, so they share one orbit around the stroke's
  // axis, half a turn apart. Depth shows as perspective (nearer is bigger), the ring tilts as a disc (edge on when it
  // passes the middle), and whatever is in front cuts a gap into what lies behind, like the gaps of the logo
  const AXIS = { x: -Math.SQRT1_2, y: Math.SQRT1_2 }, PERP = { x: Math.SQRT1_2, y: Math.SQRT1_2 }; // along the stroke, and across it towards the ring
  const ORB = Math.hypot(BR.x - MID.x, BR.y - MID.y), FOCAL = 240, GAP_3D = 6;
  // the eye's opening on the ball: tilted BETA from facing you towards the stroke (that gives the logo's offset
  // hole), ALPHA wide (that gives the logo's hole size)
  const BETA = Math.asin(HOLE_OFF / BIG), ALPHA = Math.asin(HOLE.r / BIG);
  function orbitState(theta) {
    const body = (phase, r) => {
      const c = Math.cos(phase), z = ORB * Math.sin(phase), k = FOCAL / (FOCAL - z);
      return { x: MID.x + PERP.x * ORB * c * k, y: MID.y + PERP.y * ORB * c * k, r: r * k, z, c, k };
    };
    const ring = body(theta, BIG), dot = body(theta + Math.PI, DOT_R);
    // the eye keeps looking at you, tilted a little towards the stroke's axis (as in the logo): an eye that follows
    // you as it passes. out = from the axis to the ball
    const c = Math.cos(theta), sn = Math.sin(theta);
    const out = [PERP.x * c, PERP.y * c, sn];
    const raw = [0, 0, 1].map((z, i) => z * Math.cos(BETA) - out[i] * Math.sin(BETA)), len = Math.hypot(...raw);
    const n = raw.map(v => v / len);
    // layers back to front: 0 the stroke (depth 0), 1 the ring, 2 the dot
    const order = [[0, 0], [1, ring.z], [2, dot.z]].sort((a, b) => a[1] - b[1]).map(e => e[0]);
    return {
      top: { ...TR, r: BIG }, bottom: { ...BL, r: BIG }, ring, dot, hole: { x: ring.x, y: ring.y, r: HOLE.r * ring.k },
      rot: 0, lift: 0, shaped: 1, kRing: 0, kDot: 0,
      orbit: {
        gap: GAP_3D, order, n, alpha: ALPHA,
        w: sn * sn, // 0 where the balls rest (on either side), 1 a quarter round: the logo's flat hole -> the ball's opening
        flat: { x: ring.x - PERP.x * Math.sign(c || 1) * HOLE_OFF * ring.k, y: ring.y - PERP.y * Math.sign(c || 1) * HOLE_OFF * ring.k, r: HOLE.r * ring.k },
      },
    };
  }
  // the loop: the build, once; then the logo rests a moment, the moons go half way round (so the eye and the dot
  // swap places), and the whole logo turns half way clockwise, which puts them back: every round lands upright.
  // Every move eases in and out
  const HOLD = 500, ORBIT = 1800, TURN = 1400, CYCLE = HOLD + ORBIT + TURN;
  function loopState(ms) {
    if (ms < BUILD) return buildState(ms / BUILD);
    const c = (ms - BUILD) % CYCLE;
    const theta = c < HOLD ? 0 : Math.PI * easeInOut(Math.min(1, (c - HOLD) / ORBIT));
    const st = orbitState(theta);
    st.rot = c < HOLD + ORBIT ? 0 : 180 * easeInOut((c - HOLD - ORBIT) / TURN);
    return st;
  }

export { BUILD, CYCLE, HOLD, buildState, orbitState, loopState, drawState };
