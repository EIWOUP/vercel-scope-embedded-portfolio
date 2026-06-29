/* ═══════════════════════════════════════════════════════════════
   BHAVIK K. — EMBEDDED PORTFOLIO — main.js
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
   1.  GLOBAL BACKGROUND PARTICLE FIELD  (space / deep ocean)
       Fixed canvas behind everything.
       Many particles: varied size, opacity, speed, colour hue.
       Some drift like plankton, some float like deep space debris.
   ═══════════════════════════════════════════════════════════════ */
(function initGlobalParticles() {
  const canvas = document.getElementById('particle-field');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];
  const COUNT = 220;

  const PALETTES = [
    'rgba(0,210,150,',   // green
    'rgba(0,198,255,',   // cyan
    'rgba(0,150,220,',   // blue
    'rgba(180,255,220,', // pale green
    'rgba(100,200,255,', // sky
    'rgba(255,255,255,', // white
  ];

  class Particle {
    constructor() { this.reset(true); }

    reset(initial = false) {
      this.x = initial ? rand(0, W) : (Math.random() > 0.5 ? rand(-10, 0) : rand(W, W + 10));
      this.y = rand(0, H);
      this.r = rand(0.4, 3.2);
      this.baseOpacity = rand(0.04, 0.38);
      this.opacity = this.baseOpacity;
      this.opacityDir = Math.random() > 0.5 ? 1 : -1;
      this.opacitySpeed = rand(0.0005, 0.003);
      this.vx = rand(-0.12, 0.12);
      this.vy = rand(-0.08, 0.08);
      this.colour = PALETTES[randInt(0, PALETTES.length - 1)];
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
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.colour + this.opacity.toFixed(3) + ')';
      ctx.fill();
    }
  }

  // Larger, slow-drifting "nebula" blobs
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
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < -200 || this.x > W + 200 || this.y < -200 || this.y > H + 200) this.reset();
    }
    draw() {
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
      g.addColorStop(0, this.colour + this.opacity + ')');
      g.addColorStop(1, this.colour + '0)');
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
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

  function loop() {
    ctx.clearRect(0, 0, W, H);
    blobs.forEach(b => { b.update(); b.draw(); });
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();
  loop();
})();

/* ═══════════════════════════════════════════════════════════════
   2.  OSCILLOSCOPE  (hero canvas — already solid, keep as-is)
       Multi-channel: UART clock, SPI data, PWM waveform, noise.
   ═══════════════════════════════════════════════════════════════ */
(function initOscilloscope() {
  const canvas = document.getElementById('oscilloscope');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, t = 0;

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  /* waveform helpers */
  const sq = (x, freq) => Math.sign(Math.sin(x * freq));
  const pw = (x, freq, duty) => (((x * freq) % (Math.PI * 2)) < (Math.PI * 2 * duty)) ? 1 : -1;
  const sawtooth = (x, freq) => 2 * ((x * freq / (Math.PI * 2)) % 1) - 1;

  // Channel configs: { y-centre (0‒1), amplitude (px), colour, line, waveformFn }
  function channels(W, H) {
    return [
      /* CLK — square wave */
      {
        cy: .15, amp: H * .06, col: '#00d296', lw: 1.3,
        fn: (x, t) => sq(x / W * 40 + t * 0.8, 1)
      },
      /* SPI DATA — noisy square bursts */
      {
        cy: .32, amp: H * .055, col: '#00c6ff', lw: 1.2,
        fn: (x, t) => {
          const base = sq(x / W * 28 + t * 0.55, 1);
          return base + (Math.random() - 0.5) * 0.18;
        }
      },
      /* PWM — variable duty */
      {
        cy: .50, amp: H * .06, col: '#f59e0b', lw: 1.2,
        fn: (x, t) => pw(x / W * 24 + t * 0.45, 1, 0.3 + 0.25 * Math.sin(t * 0.2))
      },
      /* UART — complex signal */
      {
        cy: .68, amp: H * .05, col: '#a78bfa', lw: 1.0,
        fn: (x, t) => {
          const beat = Math.floor((x / W * 18 + t * 0.5) % 10);
          return [1,-1,1,1,-1,-1,1,-1,1,-1][beat] * (0.8 + Math.random() * 0.2);
        }
      },
      /* Analog noise — ECG style */
      {
        cy: .84, amp: H * .045, col: 'rgba(0,210,150,.5)', lw: 0.8,
        fn: (x, t) => Math.sin(x / W * 60 + t * 1.1) * 0.5 + Math.sin(x / W * 20 + t) * 0.4 +
                      (Math.random() - 0.5) * 0.12
      },
    ];
  }

  // Grid lines
  function drawGrid() {
    ctx.strokeStyle = 'rgba(0,210,150,.07)';
    ctx.lineWidth = .5;
    const cols = 20, rows = 12;
    for (let i = 0; i <= cols; i++) {
      const x = (W / cols) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let i = 0; i <= rows; i++) {
      const y = (H / rows) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // centre cross hairs
    ctx.strokeStyle = 'rgba(0,210,150,.14)';
    ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  }

  function drawChannel(ch) {
    const cy = ch.cy * H;
    ctx.beginPath();
    ctx.strokeStyle = ch.col;
    ctx.lineWidth = ch.lw;
    ctx.shadowBlur = 6;
    ctx.shadowColor = ch.col;
    for (let x = 0; x < W; x++) {
      const y = cy - ch.fn(x, t) * ch.amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Channel labels
  function drawLabels() {
    ctx.font = '11px JetBrains Mono, monospace';
    const labels = ['CLK', 'MOSI', 'PWM', 'UART', 'ADC'];
    channels(W, H).forEach((ch, i) => {
      ctx.fillStyle = ch.col;
      ctx.fillText(labels[i], 8, ch.cy * H - ch.amp - 4);
    });
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    channels(W, H).forEach(ch => drawChannel(ch));
    drawLabels();
    t += 0.016;
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  resize();
  loop();
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
  const COUNT = 80;

  class FloatParticle {
    constructor() { this.init(); }
    init() {
      this.x = rand(0, W || 100);
      this.y = rand(0, H || 100);
      this.r = rand(0.6, 2.5);
      this.op = rand(0.05, 0.3);
      this.vx = rand(-0.08, 0.08);
      this.vy = rand(-0.06, 0.04);
      this.phase = rand(0, Math.PI * 2);
      this.freq  = rand(0.008, 0.025);
      this.t = 0;
      this.col = Math.random() > 0.6
        ? `rgba(0,210,150,`
        : `rgba(0,180,255,`;
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
      ctx.fillStyle = this.col + this.op + ')';
      ctx.fill();
    }
  }

  function resize() {
    const rect = section.getBoundingClientRect();
    W = canvas.width  = section.offsetWidth;
    H = canvas.height = section.offsetHeight;
    if (pts.length === 0) for (let i = 0; i < COUNT; i++) pts.push(new FloatParticle());
  }

  let animId;
  function loop() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => { p.update(); p.draw(); });
    animId = requestAnimationFrame(loop);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(section);
  resize();
  loop();
})();

/* ═══════════════════════════════════════════════════════════════
   4.  PROJECTS SECTION — circuit-board mesh background
       Nodes connected by thin traces, occasional signal pulse
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
  const NODE_COUNT = 55;
  const MAX_DIST = 160;

  function buildGraph() {
    nodes = [];
    edges = [];
    pulses = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: rand(20, W - 20),
        y: rand(20, H - 20),
        r: rand(1.5, 4),
        glow: Math.random() > 0.7,
      });
    }
    // connect nearby nodes (circuit traces)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < MAX_DIST) {
          edges.push({ a: i, b: j, d });
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

  setInterval(spawnPulse, 400);

  function resize() {
    W = canvas.width  = section.offsetWidth;
    H = canvas.height = section.offsetHeight;
    buildGraph();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Traces
    edges.forEach(e => {
      const a = nodes[e.a], b = nodes[e.b];
      const alpha = lerp(0.04, 0.12, 1 - e.d / MAX_DIST);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(0,210,150,${alpha})`;
      ctx.lineWidth = .5;
      ctx.stroke();
    });

    // Pulses
    pulses = pulses.filter(p => {
      p.t += p.speed;
      if (p.t > 1) return false;
      const a = nodes[p.edge.a], b = nodes[p.edge.b];
      const px = lerp(a.x, b.x, p.t);
      const py = lerp(a.y, b.y, p.t);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,210,150,.85)';
      ctx.shadowBlur = 10; ctx.shadowColor = '#00d296';
      ctx.fill();
      ctx.shadowBlur = 0;
      return true;
    });

    // Nodes
    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      if (n.glow) {
        ctx.shadowBlur = 8; ctx.shadowColor = '#00d296';
        ctx.fillStyle = 'rgba(0,210,150,.65)';
      } else {
        ctx.fillStyle = 'rgba(0,210,150,.3)';
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    requestAnimationFrame(draw);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(section);
  resize();
  draw();
})();

/* ═══════════════════════════════════════════════════════════════
   5.  SKILLS SECTION — constellation nebula background
       Stars + constellation lines
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
  const STAR_COUNT = 90;
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
          conLines.push({ i, j, d });
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

  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.5;

    // Constellation lines
    conLines.forEach(cl => {
      const a = stars[cl.i], b = stars[cl.j];
      const alpha = lerp(0.015, 0.06, 1 - cl.d / 120);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(0,210,150,${alpha})`;
      ctx.lineWidth = .4;
      ctx.stroke();
    });

    // Stars
    stars.forEach(s => { s.update(t); s.draw(); });

    requestAnimationFrame(draw);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(section);
  resize();
  draw();
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
    { text: '$ load_portfolio --engineer=bhavik', cls: 'mono' },
    { text: '  >> projects[]   : 8 loaded', cls: 't-line-dim' },
    { text: '  >> skills[]     : 24 tagged', cls: 't-line-dim' },
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
   ═══════════════════════════════════════════════════════════════ */
(function initNav() {
  const nav = document.getElementById('nav');
  const links = $$('.nav-link');
  const hamburger = document.getElementById('hamburger');
  const sections = $$('section[id]');

  // Scroll → shadow
  window.addEventListener('scroll', () => {
    nav.style.background = window.scrollY > 50
      ? 'rgba(5,10,14,.96)'
      : 'rgba(5,10,14,.82)';
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
   9.  PROJECT FILTER
   ═══════════════════════════════════════════════════════════════ */
(function initFilter() {
  const btns  = $$('.filter-btn');
  const cards = $$('.proj-card');
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
