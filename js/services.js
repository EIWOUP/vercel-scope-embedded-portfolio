/* ═══════════════════════════════════════════════════════════════
   GAURAV AHIR — SERVICES PAGE  js/services.js
   Hero oscilloscope · Slider · Hex particles · Scroll vine · Reveal
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── UTILITIES ────────────────────────────────────────────────
   const/let in main.js are script-scoped, not on window, so we
   redeclare the helpers we need rather than relying on shared state.
   ──────────────────────────────────────────────────────────────── */
const _rand  = (min, max) => Math.random() * (max - min) + min;
const _rInt  = (min, max) => Math.floor(_rand(min, max + 1));
const _clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const _lerp  = (a, b, t) => a + (b - a) * t;

function _debounce(fn, wait = 120) {
  let id;
  return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), wait); };
}

/* Pause/resume a rAF loop when the given element scrolls into/out-of view. */
function _onVisible(el, startLoop, stopLoop) {
  let running = false;
  const tryStart = () => { if (!running && !document.hidden) { running = true; startLoop(); } };
  const tryStop  = () => { if (running) { running = false; stopLoop(); } };
  const io = new IntersectionObserver(
    entries => entries.forEach(e => e.isIntersecting ? tryStart() : tryStop()),
    { rootMargin: '60px 0px 60px 0px', threshold: 0 }
  );
  io.observe(el);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) tryStop();
    else {
      const r = el.getBoundingClientRect();
      if (r.bottom > -200 && r.top < innerHeight + 200) tryStart();
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   1.  HERO OSCILLOSCOPE  (#sp-osc)
       3 channels — CLK, DATA, UART — same cheap-glow technique as
       the home page oscilloscope (wide translucent + thin bright pass
       instead of ctx.shadowBlur).
   ═══════════════════════════════════════════════════════════════ */
(function initServiceOsc() {
  const canvas = document.getElementById('sp-osc');
  if (!canvas) return;
  const section = canvas.closest('section') || canvas.parentElement;
  const ctx = canvas.getContext('2d');
  let W, H, t = 0, chans = [];

  const sq = (x, f) => Math.sign(Math.sin(x * f));

  function buildChannels() {
    chans = [
      { cy: .22 * H, amp: H * .065, col: '#00d296', lw: 1.3, label: 'CLK',
        fn: (x, tt) => sq(x / W * 38 + tt * 0.75, 1) },
      { cy: .5  * H, amp: H * .06,  col: '#00c6ff', lw: 1.2, label: 'DATA',
        fn: (x, tt) => sq(x / W * 26 + tt * 0.52, 1) + (Math.random() - 0.5) * 0.18 },
      { cy: .78 * H, amp: H * .055, col: '#a78bfa', lw: 1.0, label: 'UART',
        fn: (x, tt) => {
          const beat = Math.floor((x / W * 18 + tt * 0.48) % 10);
          return [1,-1,1,1,-1,-1,1,-1,1,-1][beat] * (0.82 + Math.random() * 0.18);
        } },
    ];
  }

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    buildChannels();
  }

  function drawGrid() {
    ctx.beginPath();
    const cols = 18, rows = 8;
    for (let i = 0; i <= cols; i++) { const x = W / cols * i; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let i = 0; i <= rows; i++) { const y = H / rows * i; ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.strokeStyle = 'rgba(0,210,150,.055)';
    ctx.lineWidth = .5; ctx.stroke();
  }

  function drawChannel(ch) {
    ctx.beginPath();
    for (let x = 0; x < W; x += 2) {
      const y = ch.cy - ch.fn(x, t) * ch.amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = ch.col;
    ctx.globalAlpha = .26; ctx.lineWidth = ch.lw + 2.6; ctx.stroke();
    ctx.globalAlpha = 1;   ctx.lineWidth = ch.lw;       ctx.stroke();
  }

  let rafId = null;
  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    chans.forEach(ch => drawChannel(ch));
    ctx.font = '10px JetBrains Mono, monospace';
    chans.forEach(ch => { ctx.fillStyle = ch.col; ctx.fillText(ch.label, 8, ch.cy - ch.amp - 4); });
    t += 0.016;
    rafId = requestAnimationFrame(loop);
  }
  function start() { if (rafId === null) loop(); }
  function stop()  { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

  window.addEventListener('resize', _debounce(resize, 150));
  resize();
  _onVisible(section, start, stop);
})();

/* ═══════════════════════════════════════════════════════════════
   2.  IMAGE SLIDER  (spSlide / auto-advance)
       Same mechanics as ppSlide() in projects.js.
   ═══════════════════════════════════════════════════════════════ */
function spSlide(trackId, dotsId, dir) {
  const track = document.getElementById(trackId);
  const dotsEl = document.getElementById(dotsId);
  if (!track) return;
  const slides = [...track.querySelectorAll('.sp-slide')];
  const total = slides.length;
  let cur = track._cur || 0;
  cur = (cur + dir + total) % total;
  track._cur = cur;
  track.style.transform = `translateX(-${cur * 100}%)`;
  if (dotsEl) {
    dotsEl.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === cur));
  }
}

(function autoSlideServices() {
  [
    ['sp-track-0', 'sp-dots-0'],
    ['sp-track-1', 'sp-dots-1'],
    ['sp-track-2', 'sp-dots-2'],
    ['sp-track-3', 'sp-dots-3'],
    ['sp-track-4', 'sp-dots-4'],
  ].forEach(([track, dots], i) => {
    setInterval(() => spSlide(track, dots, 1), 4600 + i * 550);
  });
})();

/* ═══════════════════════════════════════════════════════════════
   3.  HEXAGON OVERLAY  (#sp-hex-canvas)
       Wireframe hexagons drawn in the same style as the particle
       connection lines (lineWidth 0.5, low alpha).  Each hex orbits
       a slowly drifting centre point — giving genuine orbital motion
       rather than a simple linear drift.  Vertex dots mimic particle
       nodes.  Random sizes (20 – 100 px).
   ═══════════════════════════════════════════════════════════════ */
(function initHexParticles() {
  const section = document.getElementById('sp-services');
  const canvas  = document.getElementById('sp-hex-canvas');
  if (!section || !canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, hexes = [];
  const COUNT = 16;
  const COLS  = ['0,210,150', '0,198,255', '0,210,150'];

  class HexOrbit {
    constructor(initial = false) { this.reset(initial); }

    reset(initial = false) {
      /* Centre point that itself drifts slowly */
      this.cx = initial ? _rand(0, W) : _rand(-80, W + 80);
      this.cy = initial ? _rand(0, H) : _rand(-80, H + 80);
      this.vx = _rand(-.045, .045);
      this.vy = _rand(-.03,  .03);

      /* Orbital motion around the centre */
      this.orbitR     = _rand(18, 72);
      this.orbitAngle = _rand(0, Math.PI * 2);
      this.orbitSpeed = _rand(.00025, .0009) * (Math.random() > .5 ? 1 : -1);

      /* Self-rotation of the hex shape */
      this.rotation = _rand(0, Math.PI * 2);
      this.rotSpeed = _rand(-.0045, .0045);

      /* Visual */
      this.size    = _rand(20, 100);
      this.opacity = _rand(.07, .2);
      this.colRgb  = COLS[_rInt(0, COLS.length - 1)];

      /* Current world position (recomputed each tick) */
      this.x = this.cx;
      this.y = this.cy;
    }

    update() {
      /* Drift the centre */
      this.cx += this.vx;
      this.cy += this.vy;

      /* Orbit */
      this.orbitAngle += this.orbitSpeed;
      this.x = this.cx + Math.cos(this.orbitAngle) * this.orbitR;
      this.y = this.cy + Math.sin(this.orbitAngle) * this.orbitR;

      /* Self-spin */
      this.rotation += this.rotSpeed;

      /* Cull when the centre has drifted far off-screen */
      const pad = this.size * 3 + this.orbitR;
      if (this.cx < -pad || this.cx > W + pad || this.cy < -pad || this.cy > H + pad) {
        this.reset();
      }
    }

    draw() {
      /* Compute 6 vertices */
      const verts = Array.from({ length: 6 }, (_, i) => {
        const a = this.rotation + (i / 6) * Math.PI * 2;
        return { x: this.x + Math.cos(a) * this.size,
                 y: this.y + Math.sin(a) * this.size };
      });

      /* Sides — same style as particle connection lines */
      ctx.beginPath();
      verts.forEach((v, i) => {
        const nv = verts[(i + 1) % 6];
        ctx.moveTo(v.x, v.y); ctx.lineTo(nv.x, nv.y);
      });
      ctx.strokeStyle = `rgba(${this.colRgb},${this.opacity})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      /* Vertex dots — same style as particle nodes */
      verts.forEach(v => {
        ctx.beginPath();
        ctx.arc(v.x, v.y, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.colRgb},${Math.min(this.opacity * 1.6, 0.35)})`;
        ctx.fill();
      });

      /* Centre dot */
      ctx.beginPath();
      ctx.arc(this.x, this.y, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.colRgb},${this.opacity * 0.8})`;
      ctx.fill();
    }
  }

  function resize() {
    W = canvas.width  = section.offsetWidth;
    H = canvas.height = section.offsetHeight;
    if (hexes.length === 0)
      for (let i = 0; i < COUNT; i++) hexes.push(new HexOrbit(true));
  }

  let rafId = null;
  function loop() {
    ctx.clearRect(0, 0, W, H);
    hexes.forEach(h => { h.update(); h.draw(); });
    rafId = requestAnimationFrame(loop);
  }
  function start() { if (rafId === null) loop(); }
  function stop()  { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

  const ro = new ResizeObserver(_debounce(resize, 100));
  ro.observe(section);
  resize();
  _onVisible(section, start, stop);
})();


/* ═══════════════════════════════════════════════════════════════
   4.  SERVICES SECTION PARTICLE NETWORK  (#sp-services)
       Same moving-nodes + connecting-lines + pulse system as the
       projects page (initPPBg), ported to services.js utilities.
   ═══════════════════════════════════════════════════════════════ */
(function initServicesBg() {
  const section = document.getElementById('sp-services');
  if (!section) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'sp-bg-canvas';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  section.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, nodes = [], edges = [], pulses = [];
  const NODE_COUNT = 110;
  const MAX_DIST   = 130;
  const MAX_SPEED  = 0.5;

  /* Random hex byte string like "0x7E", "0xAF" */
  function randByte() {
    return '0x' + Math.floor(Math.random() * 256)
      .toString(16).toUpperCase().padStart(2, '0');
  }

  const FONT = '13px "JetBrains Mono", monospace';

  /* Pre-rendered glow sprites */
  const GLOW_SIZE = 80;
  const COLOURS = [
    { hex: '#00d296', rgb: '0,210,150' },
    { hex: '#00d296', rgb: '0,210,150' },
    { hex: '#00d296', rgb: '0,210,150' },
    { hex: '#00c6ff', rgb: '0,198,255' },
    { hex: '#c8fff0', rgb: '200,255,240' },
  ];
  const glowSprites = COLOURS.map(c => {
    const spr = document.createElement('canvas');
    spr.width = spr.height = GLOW_SIZE;
    const gc = spr.getContext('2d');
    const cx = GLOW_SIZE / 2;
    const g = gc.createRadialGradient(cx, cx, 0, cx, cx, cx * 0.92);
    g.addColorStop(0,    `rgba(${c.rgb},.85)`);
    g.addColorStop(0.18, `rgba(${c.rgb},.6)`);
    g.addColorStop(0.38, `rgba(${c.rgb},.32)`);
    g.addColorStop(0.6,  `rgba(${c.rgb},.14)`);
    g.addColorStop(0.82, `rgba(${c.rgb},.04)`);
    g.addColorStop(1,    `rgba(${c.rgb},0)`);
    gc.fillStyle = g;
    gc.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
    return spr;
  });
  function drawGlow(si, x, y, scale, alpha) {
    const s = GLOW_SIZE * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(glowSprites[si], x - s / 2, y - s / 2, s, s);
    ctx.globalAlpha = 1;
  }

  function buildGraph() {
    nodes = []; pulses = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const ci = _rInt(0, COLOURS.length - 1);
      nodes.push({
        x:         _rand(0, W),
        y:         _rand(0, H),
        r:         3,
        vx:        _rand(-MAX_SPEED, MAX_SPEED),
        vy:        _rand(-MAX_SPEED, MAX_SPEED),
        glow:      Math.random() > 0.72,
        glowAlpha: _rand(0.22, 0.5),
        alpha:     _rand(0.22, 0.42),
        ci,
        col:  COLOURS[ci].hex,
        byte: randByte(),
      });
    }
  }

  function physics() {
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0) { n.x = 0; n.vx *= -1; }
      else if (n.x > W) { n.x = W; n.vx *= -1; }
      if (n.y < 0) { n.y = 0; n.vy *= -1; }
      else if (n.y > H) { n.y = H; n.vy *= -1; }
    }
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST)
          edges.push({ a: i, b: j, alpha: _lerp(0.07, 0.24, 1 - dist / MAX_DIST) });
      }
    }
  }

  function spawnPulse() {
    if (!edges.length) return;
    pulses.push({ edge: edges[_rInt(0, edges.length - 1)], t: 0, speed: _rand(0.005, 0.015) });
  }
  setInterval(spawnPulse, 380);

  function drawEdges() {
    const BUCKETS = 4;
    for (let b = 0; b < BUCKETS; b++) {
      const lo = b / BUCKETS, hi = (b + 1) / BUCKETS;
      ctx.beginPath();
      let any = false;
      for (const e of edges) {
        const norm = (e.alpha - 0.07) / (0.24 - 0.07);
        if (norm < lo || norm >= hi) continue;
        const a = nodes[e.a], nb = nodes[e.b];
        ctx.moveTo(a.x, a.y); ctx.lineTo(nb.x, nb.y);
        any = true;
      }
      if (!any) continue;
      ctx.strokeStyle = `rgba(0,210,150,${_lerp(0.07, 0.24, (lo + hi) / 2).toFixed(3)})`;
      ctx.lineWidth = .5;
      ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    physics();
    drawEdges();
    /* Pulse dots travelling along edges */
    pulses = pulses.filter(p => {
      p.t += p.speed;
      if (p.t > 1) return false;
      const a = nodes[p.edge.a], b = nodes[p.edge.b];
      const px = _lerp(a.x, b.x, p.t), py = _lerp(a.y, b.y, p.t);
      drawGlow(0, px, py, 1.0, 0.38);
      ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#00d296'; ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });

    /* ── Hex byte text nodes ─────────────────────────────────── */
    ctx.font = FONT;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    /* Pass 1 — glow halo sprite behind each glowing byte */
    nodes.forEach(n => {
      if (n.glow) drawGlow(n.ci, n.x, n.y, 1.6, n.glowAlpha);
    });

    /* Pass 2 — draw all bytes */
    nodes.forEach(n => {
      ctx.globalAlpha = n.glow ? Math.min(n.glowAlpha * 1.9, 1) : n.alpha;
      ctx.fillStyle   = n.col;
      ctx.fillText(n.byte, n.x, n.y);
    });

    ctx.globalAlpha  = 1;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
    rafId = requestAnimationFrame(draw);
  }

  let rafId = null;
  function start() { if (rafId === null) draw(); }
  function stop()  { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

  function resize() {
    W = canvas.width  = section.offsetWidth;
    H = canvas.height = section.offsetHeight;
    buildGraph();
  }

  const ro = new ResizeObserver(_debounce(resize, 100));
  ro.observe(section);
  resize();
  _onVisible(section, start, stop);
})();

/* ═══════════════════════════════════════════════════════════════
   5.  CARD SCROLL REVEAL + ACTIVE GLOW
       .visible  → opacity reveal (one-shot, threshold 0.06)
       .active   → border pulse + left-edge glow while in viewport
   ═══════════════════════════════════════════════════════════════ */
(function initCardReveal() {
  const cards = [...document.querySelectorAll('.sp-card')];
  if (!cards.length) return;

  /* One-shot reveal */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), +e.target.dataset.idx * 80);
        revealIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.06 });

  /* Continuous active glow while card is centred */
  const activeIO = new IntersectionObserver(entries => {
    entries.forEach(e => e.target.classList.toggle('active', e.isIntersecting));
  }, { threshold: 0.45 });

  cards.forEach(c => { revealIO.observe(c); activeIO.observe(c); });
})();
