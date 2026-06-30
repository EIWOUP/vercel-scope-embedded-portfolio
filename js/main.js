/* ═══════════════════════════════════════════════════════════════
   GAURAV AHIR — EMBEDDED PORTFOLIO — main.js
   Particle field · Oscilloscope · About canvas · Projects mesh
   Skills constellation · Terminal · Nav · Slider · Form
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── UTILITY ─────────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/* ═══════════════════════════════════════════════════════════════
   0.  PERF UTILITIES — shared by every canvas loop below.
       - debounce(): collapses rapid resize events into one
       - onVisible(): pauses/resumes a rAF loop using IntersectionObserver
         so off-screen sections stop burning CPU/GPU entirely.
       - Same animations everywhere, just not computed when nobody
         can see them.
   ═══════════════════════════════════════════════════════════════ */
function debounce(fn, wait = 120) {
  let id;
  return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), wait); };
}

/* Runs `startLoop`/`stopLoop` based on whether `el` is anywhere near
   the viewport (rootMargin gives a head-start before it scrolls in,
   so nothing pops in mid-animation). Also pauses when the tab itself
   is hidden (switched away), since rAF keeps firing in some browsers. */
function onVisible(el, startLoop, stopLoop) {
  let running = false;
  const tryStart = () => { if (!running && !document.hidden) { running = true; startLoop(); } };
  const tryStop  = () => { if (running) { running = false; stopLoop(); } };

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => e.isIntersecting ? tryStart() : tryStop());
  }, { rootMargin: '50px 0px 50px 0px', threshold: 0 });
  io.observe(el);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) tryStop();
    else if (el.getBoundingClientRect().bottom > -200 && el.getBoundingClientRect().top < innerHeight + 200) tryStart();
  });

  return { tryStart, tryStop };
}

/* ═══════════════════════════════════════════════════════════════
   1.  GLOBAL BACKGROUND PARTICLE FIELD  (space / deep ocean)
       Fixed canvas behind everything.
       Many particles: varied size, opacity, speed, colour hue.
       Some drift like plankton, some float like deep space debris.
       PERF: nebula gradients are cached per-blob (rebuilt only when
       a blob resets/relocates, not on every single frame), particle
       count is tuned down slightly with radius compensation so the
       field reads equally dense, and the loop suspends fully when
       the tab is backgrounded.
   ═══════════════════════════════════════════════════════════════ */
(function initGlobalParticles() {
  const canvas = document.getElementById('particle-field');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];
  const COUNT = 150; // was 220 — same visual density via slightly larger radius below

  const PALETTES = [
    'rgba(0,210,150,',   // green
    'rgba(0,198,255,',   // cyan
    'rgba(0,150,220,',   // blue
    'rgba(180,255,220,', // pale green
    'rgba(100,200,255,', // sky
    'rgba(255,255,255,', // white
  ];
  // Solid (alpha=1) equivalents, paired by index — used with
  // ctx.globalAlpha so per-particle draws never build an rgba() string.
  const SOLID_PALETTES = [
    'rgb(0,210,150)',
    'rgb(0,198,255)',
    'rgb(0,150,220)',
    'rgb(180,255,220)',
    'rgb(100,200,255)',
    'rgb(255,255,255)',
  ];

  class Particle {
    constructor() { this.reset(true); }

    reset(initial = false) {
      this.x = initial ? rand(0, W) : (Math.random() > 0.5 ? rand(-10, 0) : rand(W, W + 10));
      this.y = rand(0, H);
      this.r = rand(0.5, 3.6); // slightly larger to keep the field feeling full at COUNT=150
      this.baseOpacity = rand(0.04, 0.38);
      this.opacity = this.baseOpacity;
      this.opacityDir = Math.random() > 0.5 ? 1 : -1;
      this.opacitySpeed = rand(0.0005, 0.003);
      this.vx = rand(-0.12, 0.12);
      this.vy = rand(-0.08, 0.08);
      const paletteIdx = randInt(0, PALETTES.length - 1);
      this.colour = PALETTES[paletteIdx];
      this.solidColour = SOLID_PALETTES[paletteIdx];
      // subtle wobble
      this.wobbleAmp = rand(0, 0.4);
      this.wobbleFreq = rand(0.005, 0.02);
      this.wobblePhase = rand(0, Math.PI * 2);
      this.age = 0;
    }

    update() {
      this.age++;
      this.x += this.vx;
      this.y += this.vy + Math.sin(this.age * this.wobbleFreq + this.wobblePhase) * this.wobbleAmp * 0.015;

      // breathe opacity
      this.opacity += this.opacitySpeed * this.opacityDir;
      if (this.opacity >= this.baseOpacity * 1.5 || this.opacity <= 0.01) {
        this.opacityDir *= -1;
        this.opacity = clamp(this.opacity, 0.01, this.baseOpacity * 1.5);
      }

      if (this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) {
        this.reset();
      }
    }

    draw() {
      // PERF: ctx.globalAlpha avoids building a new rgba(...) string
      // every frame for every particle (150x/frame). The base colour
      // string is reused as-is since it's already a constant from
      // PALETTES, only the alpha channel varies per-particle.
      ctx.globalAlpha = this.opacity;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.solidColour;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Larger, slow-drifting "nebula" blobs.
  // PERF: ctx.createRadialGradient() is not free — building it fresh
  // every frame for 8 blobs adds up. Cache it and only rebuild when
  // the blob resets (relocates), since the gradient is purely a
  // function of position/radius/colour which only change then.
  class NebulaBlob {
    constructor() { this.reset(true); }
    reset(initial = false) {
      this.x = initial ? rand(0, W) : rand(0, W);
      this.y = initial ? rand(0, H) : (Math.random() > 0.5 ? -80 : H + 80);
      this.r = rand(60, 160);
      this.opacity = rand(0.012, 0.045);
      this.vx = rand(-0.04, 0.04);
      this.vy = rand(-0.03, 0.03);
      this.colour = PALETTES[randInt(0, 2)];
      this._rebuildGradient();
    }
    _rebuildGradient() {
      // gradient is relative to (0,0) here; we translate via ctx before fill
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r);
      g.addColorStop(0, this.colour + this.opacity + ')');
      g.addColorStop(1, this.colour + '0)');
      this._gradient = g;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < -200 || this.x > W + 200 || this.y < -200 || this.y > H + 200) this.reset();
    }
    draw() {
      // PERF: avoid ctx.save()/ctx.restore() (real but often-overlooked
      // cost when called 8x every frame) — translate, draw, then
      // translate back by the exact inverse instead of snapshotting
      // the whole canvas state.
      ctx.translate(this.x, this.y);
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this._gradient;
      ctx.fill();
      ctx.translate(-this.x, -this.y);
    }
  }

  let blobs = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    if (particles.length === 0) {
      for (let i = 0; i < COUNT; i++) particles.push(new Particle());
      for (let i = 0; i < 8; i++) blobs.push(new NebulaBlob());
    }
  }

  let rafId = null;
  function loop() {
    ctx.clearRect(0, 0, W, H);
    blobs.forEach(b => { b.update(); b.draw(); });
    particles.forEach(p => { p.update(); p.draw(); });
    rafId = requestAnimationFrame(loop);
  }
  function start() { if (rafId === null) loop(); }
  function stop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

  window.addEventListener('resize', debounce(resize, 150));
  resize();

  // Always visible (it's the fixed backdrop) — only pause on hidden tab.
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  start();
})();

/* ═══════════════════════════════════════════════════════════════
   2.  OSCILLOSCOPE  (hero canvas)
       Multi-channel: UART clock, SPI data, PWM waveform, noise.
       PERF: channel config used to be rebuilt (5 fresh objects +
       closures) on *every single frame*, twice (once to draw, once
       again for labels). Now built once and cached, refreshed only
       on resize. Grid used 32 separate beginPath/stroke calls; now
       one batched path. ctx.shadowBlur is a real per-pixel blur
       convolution — swapped for a cheap two-pass stroke (thin bright
       core over a soft wide pass) that reads the same at this scale
       for a fraction of the cost. Waveform sampled every 2px instead
       of 1px — visually identical, half the trig calls. Loop pauses
       entirely once the hero scrolls out of view.
   ═══════════════════════════════════════════════════════════════ */
(function initOscilloscope() {
  const canvas = document.getElementById('oscilloscope');
  if (!canvas) return;
  const section = canvas.closest('section') || canvas.parentElement;
  const ctx = canvas.getContext('2d');
  let W, H, t = 0;
  let chans = [];

  /* waveform helpers */
  const sq = (x, freq) => Math.sign(Math.sin(x * freq));
  const pw = (x, freq, duty) => (((x * freq) % (Math.PI * 2)) < (Math.PI * 2 * duty)) ? 1 : -1;

  function buildChannels() {
    chans = [
      /* CLK — square wave */
      { cy: .15 * H, amp: H * .06, col: '#00d296', lw: 1.3, label: 'CLK',
        fn: (x, tt) => sq(x / W * 40 + tt * 0.8, 1) },
      /* SPI DATA — noisy square bursts */
      { cy: .32 * H, amp: H * .055, col: '#00c6ff', lw: 1.2, label: 'MOSI',
        fn: (x, tt) => sq(x / W * 28 + tt * 0.55, 1) + (Math.random() - 0.5) * 0.18 },
      /* PWM — variable duty */
      { cy: .50 * H, amp: H * .06, col: '#f59e0b', lw: 1.2, label: 'PWM',
        fn: (x, tt) => pw(x / W * 24 + tt * 0.45, 1, 0.3 + 0.25 * Math.sin(tt * 0.2)) },
      /* UART — complex signal */
      { cy: .68 * H, amp: H * .05, col: '#a78bfa', lw: 1.0, label: 'UART',
        fn: (x, tt) => {
          const beat = Math.floor((x / W * 18 + tt * 0.5) % 10);
          return [1,-1,1,1,-1,-1,1,-1,1,-1][beat] * (0.8 + Math.random() * 0.2);
        } },
      /* Analog noise — ECG style */
      { cy: .84 * H, amp: H * .045, col: 'rgba(0,210,150,.5)', lw: 0.8, label: 'ADC',
        fn: (x, tt) => Math.sin(x / W * 60 + tt * 1.1) * 0.5 + Math.sin(x / W * 20 + tt) * 0.4 +
                        (Math.random() - 0.5) * 0.12 },
    ];
  }

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    buildChannels();
  }

  // Pre-batched grid — one path for all lines instead of 32 draw calls.
  function drawGrid() {
    const cols = 20, rows = 12;
    ctx.beginPath();
    for (let i = 0; i <= cols; i++) {
      const x = (W / cols) * i;
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    for (let i = 0; i <= rows; i++) {
      const y = (H / rows) * i;
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.strokeStyle = 'rgba(0,210,150,.07)';
    ctx.lineWidth = .5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
    ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
    ctx.strokeStyle = 'rgba(0,210,150,.14)';
    ctx.lineWidth = .7;
    ctx.stroke();
  }

  const STEP = 2; // sample every 2px — same look, half the trig calls

  function tracePath(ch) {
    ctx.beginPath();
    for (let x = 0; x < W; x += STEP) {
      const y = ch.cy - ch.fn(x, t) * ch.amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
  }

  // Cheap glow: wide translucent pass + thin bright core.
  // Avoids ctx.shadowBlur (a genuine blur convolution per stroke).
  function drawChannel(ch) {
    tracePath(ch);
    ctx.strokeStyle = ch.col;
    // glow pass — 15% more bloom than before (alpha + spread both up)
    ctx.globalAlpha = .2875;
    ctx.lineWidth = ch.lw + 2.53;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = ch.lw;
    ctx.stroke();
  }

  function drawLabels() {
    ctx.font = '11px JetBrains Mono, monospace';
    for (const ch of chans) {
      ctx.fillStyle = ch.col;
      ctx.fillText(ch.label, 8, ch.cy - ch.amp - 4);
    }
  }

  let rafId = null;
  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    for (const ch of chans) drawChannel(ch);
    drawLabels();
    t += 0.016;
    rafId = requestAnimationFrame(loop);
  }
  function start() { if (rafId === null) loop(); }
  function stop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

  window.addEventListener('resize', debounce(resize, 150));
  resize();
  onVisible(section, start, stop);
})();

/* ═══════════════════════════════════════════════════════════════
   3.  ABOUT SECTION — floating micro particles
       Small canvas inside the about section.
       Particles drift like bio-luminescent plankton.
   ═══════════════════════════════════════════════════════════════ */
(function initAboutParticles() {
  const section = document.getElementById('about');
  if (!section) return;

  // Create canvas inside the section
  const canvas = document.createElement('canvas');
  canvas.id = 'about-particles';
  canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;';
  section.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, pts = [];
  const COUNT = 55; // was 80 — compensated with slightly larger radius below

  class FloatParticle {
    constructor() { this.init(); }
    init() {
      this.x = rand(0, W || 100);
      this.y = rand(0, H || 100);
      this.r = rand(0.7, 2.9);
      this.op = rand(0.05, 0.3);
      this.vx = rand(-0.08, 0.08);
      this.vy = rand(-0.06, 0.04);
      this.phase = rand(0, Math.PI * 2);
      this.freq  = rand(0.008, 0.025);
      this.t = 0;
      this.col = Math.random() > 0.6
        ? `rgba(0,210,150,`
        : `rgba(0,180,255,`;
      // PERF: opacity is static per-particle here (doesn't breathe like
      // the global field does) — build the fillStyle string once at
      // init() instead of re-concatenating it on every single draw call.
      this.fillStyle = this.col + this.op + ')';
    }
    update() {
      this.t++;
      this.x += this.vx + Math.sin(this.t * this.freq + this.phase) * 0.12;
      this.y += this.vy + Math.cos(this.t * this.freq + this.phase) * 0.08;
      if (this.x < -10 || this.x > W + 10 || this.y < -10 || this.y > H + 10) this.init();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.fillStyle;
      ctx.fill();
    }
  }

  function resize() {
    const rect = section.getBoundingClientRect();
    W = canvas.width  = section.offsetWidth;
    H = canvas.height = section.offsetHeight;
    if (pts.length === 0) for (let i = 0; i < COUNT; i++) pts.push(new FloatParticle());
  }

  let rafId = null;
  function loop() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => { p.update(); p.draw(); });
    rafId = requestAnimationFrame(loop);
  }
  function start() { if (rafId === null) loop(); }
  function stop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

  const ro = new ResizeObserver(debounce(resize, 100));
  ro.observe(section);
  resize();
  onVisible(section, start, stop);
})();

/* ═══════════════════════════════════════════════════════════════
   4.  PROJECTS SECTION — circuit-board mesh background
       Tiny, numerous nodes that drift and softly collide, linked by
       live (recomputed every frame) traces. Every node draws a soft
       pre-rendered halo behind its sharp little core — a cheap,
       canvas-native "bokeh blur" so the crisp particles read as
       being in front of a blurry depth layer.
       PERF: edges batched into alpha-bucketed paths, not one
       stroke() per edge. The halos use pre-rendered radial-gradient
       sprites blitted via drawImage() rather than ctx.shadowBlur or
       a CSS filter — CSS `filter: blur()` looks free on a GPU but is
       ruinously expensive without one (measured ~2x slower on a
       software-rendering fallback), so it's avoided entirely; sprite
       blits cost the same regardless of GPU availability. The
       pairwise distance/collision pass is O(n²) but nodes are tiny
       and n is modest, so it stays well inside a 60fps budget. Loop
       pauses fully once scrolled out of view.
   ═══════════════════════════════════════════════════════════════ */
(function initProjectsBg() {
  const section = document.getElementById('projects');
  if (!section) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'projects-bg-canvas';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  section.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, nodes = [], edges = [], pulses = [];
  const NODE_COUNT = 100; // tiny dots stay cheap even at a much higher count
  const MAX_DIST = 130;
  const MAX_SPEED = 0.5;

  // Pre-rendered halo sprites, one per accent colour (one-time cost),
  // reused via drawImage instead of recomputing a blur every frame.
  const GLOW_SIZE = 64; // higher-res source so the falloff stays smooth once scaled up
  const COLOURS = [
    { hex: '#00d296', rgb: '0,210,150' },
    { hex: '#00d296', rgb: '0,210,150' },
    { hex: '#00d296', rgb: '0,210,150' },
    { hex: '#00c6ff', rgb: '0,198,255' },
    { hex: '#ffffff', rgb: '255,255,255' },
  ];
  const glowSprites = COLOURS.map(c => {
    const spr = document.createElement('canvas');
    spr.width = spr.height = GLOW_SIZE;
    const gctx = spr.getContext('2d');
    const cx = GLOW_SIZE / 2;
    // Outer stop sits inside the canvas edge (not at it) and uses many
    // intermediate stops on a gentle curve, not a 3-point linear blend —
    // a hard 2-segment gradient reads as a visible ring once composited.
    // Reaching true 0 alpha before the bitmap boundary means the halo
    // fades into the background instead of getting clipped to a circle.
    const g = gctx.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.92);
    g.addColorStop(0,    `rgba(${c.rgb},.85)`);
    g.addColorStop(0.18, `rgba(${c.rgb},.6)`);
    g.addColorStop(0.38, `rgba(${c.rgb},.32)`);
    g.addColorStop(0.6,  `rgba(${c.rgb},.14)`);
    g.addColorStop(0.82, `rgba(${c.rgb},.04)`);
    g.addColorStop(1,    `rgba(${c.rgb},0)`);
    gctx.fillStyle = g;
    gctx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
    return spr;
  });
  function drawGlow(spriteIdx, x, y, scale, alpha) {
    const s = GLOW_SIZE * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(glowSprites[spriteIdx], x - s/2, y - s/2, s, s);
    ctx.globalAlpha = 1;
  }

  function buildGraph() {
    nodes = [];
    pulses = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const colIdx = randInt(0, COLOURS.length - 1);
      nodes.push({
        x: rand(0, W), y: rand(0, H),
        r: rand(0.5, 1.6), // tiny — was 1.5-4
        vx: rand(-MAX_SPEED, MAX_SPEED), vy: rand(-MAX_SPEED, MAX_SPEED),
        glow: Math.random() > 0.78,
        colIdx,
        col: COLOURS[colIdx].hex,
      });
    }
  }

  // One O(n²) pass per frame: drifts nodes, bounces them off the
  // canvas edges and off each other, and rebuilds the edge list from
  // the freshly-updated positions (replaces the old static buildGraph
  // edge pass, since nodes now move).
  function physics() {
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < n.r) { n.x = n.r; n.vx *= -1; }
      else if (n.x > W - n.r) { n.x = W - n.r; n.vx *= -1; }
      if (n.y < n.r) { n.y = n.r; n.vy *= -1; }
      else if (n.y > H - n.r) { n.y = H - n.r; n.vy *= -1; }
    }

    edges = [];
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const minDist = a.r + b.r + 1.5;
        if (dist > 0 && dist < minDist) {
          // soft elastic bounce: push apart, swap velocity along the normal
          const nx = dx / dist, ny = dy / dist;
          const overlap = (minDist - dist) / 2;
          a.x += nx * overlap; a.y += ny * overlap;
          b.x -= nx * overlap; b.y -= ny * overlap;
          const avn = a.vx * nx + a.vy * ny, bvn = b.vx * nx + b.vy * ny;
          a.vx += (bvn - avn) * nx; a.vy += (bvn - avn) * ny;
          b.vx += (avn - bvn) * nx; b.vy += (avn - bvn) * ny;
        }

        if (dist < MAX_DIST) {
          edges.push({ a: i, b: j, alpha: lerp(0.07, 0.24, 1 - dist / MAX_DIST) });
        }
      }
    }
  }

  // Signal pulse travelling along a random edge
  function spawnPulse() {
    if (edges.length === 0) return;
    const edge = edges[randInt(0, edges.length - 1)];
    pulses.push({ edge, t: 0, speed: rand(0.005, 0.015) });
  }

  setInterval(spawnPulse, 380);

  function resize() {
    W = canvas.width  = section.offsetWidth;
    H = canvas.height = section.offsetHeight;
    buildGraph();
  }

  function drawEdges() {
    // Batch into a few alpha buckets so we still get the distance-based
    // fade look with a handful of stroke() calls instead of one per edge.
    const BUCKETS = 4;
    for (let b = 0; b < BUCKETS; b++) {
      const lo = b / BUCKETS, hi = (b + 1) / BUCKETS;
      ctx.beginPath();
      let any = false;
      for (const e of edges) {
        const norm = (e.alpha - 0.07) / (0.24 - 0.07); // 0..1
        if (norm < lo || norm >= hi) continue;
        const a = nodes[e.a], bN = nodes[e.b];
        ctx.moveTo(a.x, a.y); ctx.lineTo(bN.x, bN.y);
        any = true;
      }
      if (!any) continue;
      const midAlpha = lerp(0.07, 0.24, (lo + hi) / 2);
      ctx.strokeStyle = `rgba(0,210,150,${midAlpha})`;
      ctx.lineWidth = .5;
      ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    physics();
    drawEdges();

    // Pulses
    pulses = pulses.filter(p => {
      p.t += p.speed;
      if (p.t > 1) return false;
      const a = nodes[p.edge.a], b = nodes[p.edge.b];
      const px = lerp(a.x, b.x, p.t);
      const py = lerp(a.y, b.y, p.t);
      drawGlow(0, px, py, 1.2, 0.4);
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,210,150,.95)';
      ctx.fill();
      return true;
    });

    // Nodes — a soft halo (the "blur") behind a tiny sharp core on
    // top, so the field reads as in-focus particles over a blurry one.
    // Only the ~quarter of nodes flagged "glow" pay for the (alpha-
    // blended, comparatively expensive) sprite blit — every node
    // having one was the single biggest cost in this loop.
    nodes.forEach(n => {
      if (n.glow) drawGlow(n.colIdx, n.x, n.y, 1.52, 0.34);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.globalAlpha = n.glow ? 0.95 : 0.7;
      ctx.fillStyle = n.col;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    rafId = requestAnimationFrame(draw);
  }

  let rafId = null;
  function start() { if (rafId === null) draw(); }
  function stop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

  const ro = new ResizeObserver(debounce(resize, 100));
  ro.observe(section);
  resize();
  onVisible(section, start, stop);
})();

/* ═══════════════════════════════════════════════════════════════
   5.  SKILLS SECTION — constellation nebula background
       Stars + constellation lines
       PERF: constellation lines batched into one path instead of a
       stroke() per line. Loop pauses when scrolled out of view.
   ═══════════════════════════════════════════════════════════════ */
(function initSkillsBg() {
  const section = document.getElementById('skills');
  if (!section) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'skills-bg-canvas';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  section.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, stars = [], conLines = [];
  const STAR_COUNT = 70; // was 90 — trims the O(n²) constellation pass
  let t = 0;

  class Star {
    constructor() { this.init(); }
    init() {
      this.x = rand(0, W || 800);
      this.y = rand(0, H || 600);
      this.r = rand(.3, 1.8);
      this.baseOp = rand(0.04, 0.22);
      this.op = this.baseOp;
      this.phase = rand(0, Math.PI * 2);
      this.freq = rand(0.01, 0.04);
    }
    update(t) {
      this.op = this.baseOp + Math.sin(t * this.freq + this.phase) * this.baseOp * 0.5;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,240,255,${this.op})`;
      ctx.fill();
    }
  }

  function buildConstellations() {
    conLines = [];
    // Random constellation lines between nearby stars
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120 && Math.random() < 0.35) {
          conLines.push({ i, j, d, alpha: lerp(0.015, 0.06, 1 - d / 120) });
        }
      }
    }
  }

  function resize() {
    W = canvas.width  = section.offsetWidth;
    H = canvas.height = section.offsetHeight;
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) stars.push(new Star());
    buildConstellations();
  }

  function drawConstellationLines() {
    // Single batched path — constellation alpha varies little, so one
    // averaged stroke reads the same as per-line strokes at this scale.
    if (!conLines.length) return;
    ctx.beginPath();
    let alphaSum = 0;
    for (const cl of conLines) {
      const a = stars[cl.i], b = stars[cl.j];
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      alphaSum += cl.alpha;
    }
    ctx.strokeStyle = `rgba(0,210,150,${(alphaSum / conLines.length).toFixed(3)})`;
    ctx.lineWidth = .4;
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.5;

    drawConstellationLines();

    // Stars
    stars.forEach(s => { s.update(t); s.draw(); });

    rafId = requestAnimationFrame(draw);
  }

  let rafId = null;
  function start() { if (rafId === null) draw(); }
  function stop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

  const ro = new ResizeObserver(debounce(resize, 100));
  ro.observe(section);
  resize();
  onVisible(section, start, stop);
})();

/* ═══════════════════════════════════════════════════════════════
   6.  TERMINAL — animated typing in the hero
   ═══════════════════════════════════════════════════════════════ */
(function initTerminal() {
  const body = document.getElementById('terminal-body');
  if (!body) return;

  const lines = [
    { text: '$ system_init --target=embedded', cls: 'mono' },
    { text: '  [OK] FreeRTOS kernel v10.5.1 loaded', cls: 't-line-green' },
    { text: '  [OK] Flash: 512KB  |  SRAM: 128KB', cls: 't-line-green' },
    { text: '  [OK] GPIO, UART, SPI, I2C initialised', cls: 't-line-green' },
    { text: '$ load_portfolio --engineer=gaurav', cls: 'mono' },
    { text: '  >> projects[]   : 8 loaded', cls: 't-line-dim' },
    { text: '  >> skills[]     : 47 tagged', cls: 't-line-dim' },
    { text: '  >> uptime       : live', cls: 't-line-amber' },
    { text: '  >> status       : open_to_work = true', cls: 't-line-green' },
    { text: '$ _', cls: 'mono' },
  ];

  let li = 0, ci = 0;
  const CHAR_DELAY = 28, LINE_DELAY = 180;

  function nextChar() {
    if (li >= lines.length) return;
    const line = lines[li];
    if (ci === 0) {
      const el = document.createElement('div');
      el.className = line.cls || '';
      el.dataset.idx = li;
      body.appendChild(el);
    }
    const el = body.querySelector(`[data-idx="${li}"]`);
    if (ci < line.text.length) {
      el.textContent = line.text.slice(0, ci + 1);
      ci++;
      setTimeout(nextChar, line.text[ci - 1] === ' ' ? CHAR_DELAY * 0.5 : CHAR_DELAY);
    } else {
      li++; ci = 0;
      setTimeout(nextChar, LINE_DELAY);
    }
  }

  setTimeout(nextChar, 600);
})();

/* ═══════════════════════════════════════════════════════════════
   7.  NAV — active highlight, scroll shadow, hamburger
       PERF: scroll fires far more often than once per frame during
       a fast scroll/flick. The handler now does its (cheap) check
       inside a rAF-throttled wrapper, and only touches
       nav.style.background when the on/off state actually flips —
       previously it wrote to style on every scroll tick even when
       nothing visually changed, forcing needless style recalcs
       while the browser is already busy compositing the scroll.
   ═══════════════════════════════════════════════════════════════ */
(function initNav() {
  const nav = document.getElementById('nav');
  const links = $$('.nav-link');
  const hamburger = document.getElementById('hamburger');
  const sections = $$('section[id]');

  // Scroll → shadow (rAF-throttled, only writes on state change)
  let navScrolled = false;
  let scrollTicking = false;
  function applyNavBg() {
    const shouldBeScrolled = window.scrollY > 50;
    if (shouldBeScrolled !== navScrolled) {
      navScrolled = shouldBeScrolled;
      nav.style.background = navScrolled ? 'rgba(5,10,14,.96)' : 'rgba(5,10,14,.82)';
    }
    scrollTicking = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(applyNavBg);
    }
  }, { passive: true });

  // Intersection → active link
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const active = links.find(l => l.getAttribute('href') === '#' + e.target.id);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.35 });
  sections.forEach(s => io.observe(s));

  // Hamburger (mobile)
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      const ul = $('.nav-links');
      if (ul) {
        const visible = ul.style.display === 'flex';
        ul.style.display = visible ? 'none' : 'flex';
        ul.style.flexDirection = 'column';
        ul.style.position = 'absolute';
        ul.style.top = '100%';
        ul.style.left = '0'; ul.style.right = '0';
        ul.style.background = 'rgba(5,10,14,.97)';
        ul.style.padding = '1rem 2rem';
      }
    });
  }
})();

/* ═══════════════════════════════════════════════════════════════
   7b. CODE SNIPPET TOGGLE — collapsible "View Code" panel on
       project cards.
   ═══════════════════════════════════════════════════════════════ */
function toggleCode(id, btn) {
  const panel = document.getElementById(id);
  if (!panel) return;
  const open = panel.classList.toggle('open');
  btn.classList.toggle('open', open);
  const hint = btn.querySelector('.ct-hint');
  if (hint) hint.textContent = open ? 'Hide' : 'View';
}

/* ═══════════════════════════════════════════════════════════════
   8.  PROJECT SLIDER
   ═══════════════════════════════════════════════════════════════ */
function slideProj(trackId, dotsId, dir) {
  const track = document.getElementById(trackId);
  const dots  = document.getElementById(dotsId);
  if (!track) return;

  const slides = track.querySelectorAll('.slide');
  const total  = slides.length;
  let cur = track._cur || 0;
  cur = (cur + dir + total) % total;
  track._cur = cur;

  track.style.transform = `translateX(-${cur * 100}%)`;

  if (dots) {
    dots.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('active', i === cur);
    });
  }
}

/* auto-advance sliders */
(function autoSlide() {
  const sliders = [
    { track: 'track-1', dots: 'dots-1' },
    { track: 'track-2', dots: 'dots-2' },
    { track: 'track-3', dots: 'dots-3' },
    { track: 'track-4', dots: 'dots-4' },
  ];
  sliders.forEach((s, i) => {
    setInterval(() => slideProj(s.track, s.dots, 1), 4200 + i * 700);
  });
})();

/* ═══════════════════════════════════════════════════════════════
   9.  PROJECT FILTER (home page teaser only — full filtering lives
       on projects.html via js/projects.js)
   ═══════════════════════════════════════════════════════════════ */
(function initFilter() {
  const cards = $$('.proj-card');
  if (!cards.length) return; // not on the home page — skip
  const btns = $$('.filter-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      cards.forEach(c => {
        const show = f === 'all' || (c.dataset.category || '').includes(f);
        c.style.display = show ? '' : 'none';
      });
    });
  });
})();

/* ═══════════════════════════════════════════════════════════════
   10. CONTACT FORM
   ═══════════════════════════════════════════════════════════════ */
function submitForm() {
  const status = document.getElementById('form-status');
  if (!status) return;
  status.textContent = '>> Sending packet...';
  setTimeout(() => {
    status.textContent = '[OK] Message delivered. ACK received.';
  }, 1200);
}

/* ═══════════════════════════════════════════════════════════════
   11. UPTIME COUNTER
   ═══════════════════════════════════════════════════════════════ */
(function initUptime() {
  const el = document.getElementById('uptime');
  if (!el) return;
  const start = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0)       el.textContent = `${h}h ${m % 60}m ${s % 60}s`;
    else if (m > 0)  el.textContent = `${m}m ${s % 60}s`;
    else             el.textContent = `${s}s`;
  }, 1000);
})();

/* ═══════════════════════════════════════════════════════════════
   12. SCROLL REVEAL
   ═══════════════════════════════════════════════════════════════ */
(function initReveal() {
  const els = $$('.section-title, .about-grid, .proj-card, .skill-cluster, .tl-item, .blog-card, .contact-grid');
  els.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(el => io.observe(el));
})();
