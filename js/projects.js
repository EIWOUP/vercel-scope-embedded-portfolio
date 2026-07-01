/* ═══════════════════════════════════════════════════════════════
   PROJECTS PAGE — js/projects.js
   Mini oscilloscope hero · circuit mesh bg · slider · filter+search
   Reuses the same visual language/utilities as main.js
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const $$pp = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const $pp  = (sel, ctx = document) => ctx.querySelector(sel);
const ppRand = (min, max) => Math.random() * (max - min) + min;
const ppRandInt = (min, max) => Math.floor(ppRand(min, max + 1));
const ppLerp = (a, b, t) => a + (b - a) * t;

/* ── PERF UTILITIES (mirrors main.js — kept local since this file
   can run standalone) ──────────────────────────────────────────
   debounce(): collapses rapid resize/observer events into one.
   ppOnVisible(): pauses/resumes a rAF loop via IntersectionObserver
   so off-screen canvases (e.g. the hero osc once you've scrolled
   down to the grid) stop computing entirely instead of running
   forever in the background. */
function ppDebounce(fn, wait = 120) {
  let id;
  return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), wait); };
}
function ppOnVisible(el, startLoop, stopLoop) {
  let running = false;
  const tryStart = () => { if (!running && !document.hidden) { running = true; startLoop(); } };
  const tryStop  = () => { if (running) { running = false; stopLoop(); } };
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => e.isIntersecting ? tryStart() : tryStop());
  }, { rootMargin: '50px 0px 50px 0px', threshold: 0 });
  io.observe(el);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) tryStop();
    else {
      const r = el.getBoundingClientRect();
      if (r.bottom > -200 && r.top < innerHeight + 200) tryStart();
    }
  });
  return { tryStart, tryStop };
}

/* ═══════════════════════════════════════════════════════════════
   1.  PAGE-HERO MINI OSCILLOSCOPE (lighter version of main hero)
       PERF: channel config cached (was rebuilt every frame), grid
       batched into one path, shadowBlur swapped for a cheap two-pass
       stroke, loop pauses once the hero scrolls out of view.
   ═══════════════════════════════════════════════════════════════ */
(function initPPOsc() {
  const canvas = document.getElementById('pp-osc');
  if (!canvas) return;
  const section = canvas.closest('section') || canvas.parentElement;
  const ctx = canvas.getContext('2d');
  let W, H, t = 0;
  let chans = [];

  const sq = (x, freq) => Math.sign(Math.sin(x * freq));

  function buildChannels() {
    chans = [
      { cy: .3 * H, amp: H * .05, col: '#00d296', fn: (x, tt) => sq(x / W * 30 + tt * 0.7, 1) },
      { cy: .55 * H, amp: H * .045, col: '#00c6ff', fn: (x, tt) => Math.sin(x / W * 26 + tt) },
      { cy: .78 * H, amp: H * .04, col: '#f59e0b', fn: (x, tt) => sq(x / W * 18 + tt * 0.4, 1) * 0.6 + Math.sin(x/W*40+tt)*0.2 },
    ];
  }

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    buildChannels();
  }

  function drawGrid() {
    const cols = 16, rows = 8;
    ctx.beginPath();
    for (let i = 0; i <= cols; i++) {
      const x = (W / cols) * i;
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    for (let i = 0; i <= rows; i++) {
      const y = (H / rows) * i;
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.strokeStyle = 'rgba(0,210,150,.05)';
    ctx.lineWidth = .5;
    ctx.stroke();
  }

  function drawChannel(ch) {
    ctx.beginPath();
    for (let x = 0; x < W; x += 2) {
      const y = ch.cy - ch.fn(x, t) * ch.amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = ch.col;
    // glow pass — 15% more bloom than before (alpha + spread both up)
    ctx.globalAlpha = .2875;
    ctx.lineWidth = 3.68;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  let rafId = null;
  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    for (const ch of chans) drawChannel(ch);
    t += 0.014;
    rafId = requestAnimationFrame(loop);
  }
  function start() { if (rafId === null) loop(); }
  function stop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

  window.addEventListener('resize', ppDebounce(resize, 150));
  resize();
  ppOnVisible(section, start, stop);
})();

/* ═══════════════════════════════════════════════════════════════
   2.  CIRCUIT-MESH BACKGROUND (same recipe as home Projects section)
   Tiny, numerous nodes that drift and softly collide, linked by
   live (recomputed every frame) traces. Every node draws a soft
   pre-rendered halo behind its sharp core — a cheap, canvas-native
   "bokeh blur" so the crisp particles read as in front of a blurry
   depth layer.
   PERF: edges batched into a handful of alpha-bucketed paths instead
   of one stroke() per edge. Halos use pre-rendered radial-gradient
   sprites blitted via drawImage() rather than ctx.shadowBlur or a
   CSS filter — CSS `filter: blur()` is effectively free on a GPU but
   measured ~2x slower without one, so it's avoided entirely; sprite
   blits cost the same regardless of GPU availability. The pairwise
   distance/collision pass is O(n²) but nodes are tiny and n is
   modest, so it stays well inside a 60fps budget. This section is
   the tallest on the page, so without a visibility pause it would
   otherwise run nonstop the entire time someone reads project cards
   far below it — onVisible() stops it once it's scrolled away.
   ═══════════════════════════════════════════════════════════════ */
(function initPPBg() {
  const section = document.getElementById('pp-list');
  if (!section) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'pp-bg-canvas';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  section.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, nodes = [], edges = [], pulses = [];
  const NODE_COUNT = 110; // tiny dots stay cheap even at a much higher count; this canvas spans the whole tall card grid, not just one viewport
  const MAX_DIST = 130;
  const MAX_SPEED = 0.5;

  function ppRandByte() {
    return '0x' + Math.floor(Math.random() * 256)
      .toString(16).toUpperCase().padStart(2, '0');
  }

  const PP_FONT = '13px "JetBrains Mono", monospace';

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
    nodes = []; pulses = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const colIdx = ppRandInt(0, COLOURS.length - 1);
      nodes.push({
        x:         ppRand(0, W),
        y:         ppRand(0, H),
        r:         3,
        vx:        ppRand(-MAX_SPEED, MAX_SPEED),
        vy:        ppRand(-MAX_SPEED, MAX_SPEED),
        glow:      Math.random() > 0.72,
        glowAlpha: ppRand(0.22, 0.5),
        alpha:     ppRand(0.22, 0.42),
        colIdx,
        col:  COLOURS[colIdx].hex,
        byte: ppRandByte(),
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
        if (dist < MAX_DIST) edges.push({ a: i, b: j, alpha: ppLerp(0.07, 0.24, 1 - dist / MAX_DIST) });
      }
    }
  }

  function spawnPulse() {
    if (!edges.length) return;
    pulses.push({ edge: edges[ppRandInt(0, edges.length - 1)], t: 0, speed: ppRand(0.005, 0.015) });
  }
  setInterval(spawnPulse, 380);

  function resize() {
    W = canvas.width  = section.offsetWidth;
    H = canvas.height = section.offsetHeight;
    buildGraph();
  }

  function drawEdges() {
    const BUCKETS = 4;
    for (let b = 0; b < BUCKETS; b++) {
      const lo = b / BUCKETS, hi = (b + 1) / BUCKETS;
      ctx.beginPath();
      let any = false;
      for (const e of edges) {
        const norm = (e.alpha - 0.07) / (0.24 - 0.07);
        if (norm < lo || norm >= hi) continue;
        const a = nodes[e.a], bN = nodes[e.b];
        ctx.moveTo(a.x, a.y); ctx.lineTo(bN.x, bN.y);
        any = true;
      }
      if (!any) continue;
      ctx.strokeStyle = `rgba(0,210,150,${ppLerp(0.07, 0.24, (lo + hi) / 2).toFixed(3)})`;
      ctx.lineWidth = .5;
      ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    physics();
    drawEdges();
    /* Pulse dots along edges */
    pulses = pulses.filter(p => {
      p.t += p.speed;
      if (p.t > 1) return false;
      const a = nodes[p.edge.a], b = nodes[p.edge.b];
      const px = ppLerp(a.x, b.x, p.t), py = ppLerp(a.y, b.y, p.t);
      drawGlow(0, px, py, 1.0, 0.38);
      ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#00d296'; ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });

    /* Hex byte text nodes */
    ctx.font = PP_FONT;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    nodes.forEach(n => {
      if (n.glow) drawGlow(n.colIdx, n.x, n.y, 1.6, n.glowAlpha);
    });
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
  function stop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

  const ro = new ResizeObserver(ppDebounce(resize, 100));
  ro.observe(section);
  resize();
  ppOnVisible(section, start, stop);
})();

/* ═══════════════════════════════════════════════════════════════
   3.  SLIDER (mirrors home's slideProj, namespaced for this page)
   ═══════════════════════════════════════════════════════════════ */
function ppSlide(trackId, dotsId, dir) {
  const track = document.getElementById(trackId);
  const dots = document.getElementById(dotsId);
  if (!track) return;
  const slides = track.querySelectorAll('.pp-slide');
  const total = slides.length;
  let cur = track._cur || 0;
  cur = (cur + dir + total) % total;
  track._cur = cur;
  track.style.transform = `translateX(-${cur * 100}%)`;
  if (dots) dots.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === cur));
}

(function ppAutoSlide() {
  const ids = [1, 2, 3, 4, 5, 6, 7, 8];
  ids.forEach((n, i) => {
    setInterval(() => ppSlide(`pp-track-${n}`, `pp-dots-${n}`, 1), 4500 + i * 550);
  });
})();

/* ═══════════════════════════════════════════════════════════════
   4.  FILTER + LIVE SEARCH (combined)
   ═══════════════════════════════════════════════════════════════ */
(function initPPFilterSearch() {
  const btns = $$pp('.pp-filter .filter-btn');
  const cards = $$pp('.pp-card');
  const searchInput = $pp('#pp-search');
  const emptyMsg = $pp('#pp-empty');
  const statShown = $pp('#pp-stat-shown');
  let activeFilter = 'all';

  function applyFilters() {
    const query = (searchInput && searchInput.value || '').trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach(card => {
      const cat = card.dataset.category || '';
      const search = card.dataset.search || '';
      const matchesFilter = activeFilter === 'all' || cat.includes(activeFilter);
      const titleEl = card.querySelector('.pp-card-title');
      const titleText = titleEl ? titleEl.textContent.toLowerCase() : '';
      const matchesQuery = !query || search.includes(query) || titleText.includes(query);
      const show = matchesFilter && matchesQuery;

      if (show) {
        card.classList.remove('pp-hide', 'pp-filtering-out');
        visibleCount++;
      } else {
        card.classList.add('pp-filtering-out');
        setTimeout(() => card.classList.add('pp-hide'), 220);
      }
    });

    if (statShown) statShown.textContent = visibleCount;
    if (emptyMsg) emptyMsg.hidden = visibleCount !== 0;
  }

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      applyFilters();
    });
  });

  if (searchInput) {
    let debounceId;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceId);
      debounceId = setTimeout(applyFilters, 120);
    });
  }

  applyFilters();
})();

/* ═══════════════════════════════════════════════════════════════
   5.  SCROLL REVEAL for page elements not already animated
   ═══════════════════════════════════════════════════════════════ */
(function ppReveal() {
  const els = $$pp('.pp-hero-content');
  els.forEach(el => el.classList.add('reveal', 'visible'));
})();
