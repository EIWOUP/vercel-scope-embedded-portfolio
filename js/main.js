/* ══════════════════════════════════════════════════════════
   EMBEDDED PORTFOLIO — MAIN.JS
   ══════════════════════════════════════════════════════════ */

/* ─── OSCILLOSCOPE CANVAS ───────────────────────────────── */
(function initOscilloscope() {
  const canvas = document.getElementById('oscilloscope');
  const ctx    = canvas.getContext('2d');

  let W, H, t = 0;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Three wave configs — each mimics a different signal channel
  const waves = [
    {
      // Channel 1 — smooth sine, primary (bright phosphor)
      freq: 1.8, amp: 0.11, speed: 0.018,
      yBase: 0.30,
      color: 'rgba(0, 255, 136, 0.85)',
      glow:  'rgba(0, 255, 136, 0.20)',
      width: 2.2,
      noise: 0.006,
      type: 'sine'
    },
    {
      // Channel 2 — noisy square-ish wave (digital signal look)
      freq: 2.6, amp: 0.07, speed: 0.012,
      yBase: 0.60,
      color: 'rgba(0, 200, 255, 0.55)',
      glow:  'rgba(0, 200, 255, 0.12)',
      width: 1.6,
      noise: 0.018,
      type: 'square'
    },
    {
      // Channel 3 — fast, tight sawtooth (clock signal)
      freq: 5.2, amp: 0.045, speed: 0.028,
      yBase: 0.78,
      color: 'rgba(255, 140, 0, 0.40)',
      glow:  'rgba(255, 140, 0, 0.08)',
      width: 1.2,
      noise: 0.012,
      type: 'sawtooth'
    }
  ];

  function sampleWave(wave, x, t) {
    const phase = (x / W) * Math.PI * 2 * wave.freq + t * wave.speed * 100;
    let val = 0;
    if (wave.type === 'sine') {
      val = Math.sin(phase);
    } else if (wave.type === 'square') {
      val = Math.sign(Math.sin(phase)) * 0.85 + Math.sin(phase * 0.5) * 0.15;
    } else if (wave.type === 'sawtooth') {
      val = ((phase / (Math.PI)) % 2) - 1;
      val = Math.max(-1, Math.min(1, val));
    }
    // add a little bit of gaussian noise
    val += (Math.random() - 0.5) * wave.noise * 2;
    return val;
  }

  function drawWave(wave) {
    const points = [];
    const step   = 3; // px per sample

    for (let x = 0; x <= W; x += step) {
      const y = H * wave.yBase + sampleWave(wave, x, t) * H * wave.amp;
      points.push({ x, y });
    }

    // Draw glow layer (fat, transparent)
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const mx = (points[i-1].x + points[i].x) / 2;
      const my = (points[i-1].y + points[i].y) / 2;
      ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, mx, my);
    }
    ctx.strokeStyle = wave.glow;
    ctx.lineWidth   = wave.width * 6;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Draw sharp line on top
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const mx = (points[i-1].x + points[i].x) / 2;
      const my = (points[i-1].y + points[i].y) / 2;
      ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, mx, my);
    }
    ctx.strokeStyle = wave.color;
    ctx.lineWidth   = wave.width;
    ctx.stroke();
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(0,255,136,0.04)';
    ctx.lineWidth   = 1;
    const cols = 12, rows = 8;
    for (let i = 0; i <= cols; i++) {
      const x = (W / cols) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      const y = (H / rows) * j;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // center cross
    ctx.strokeStyle = 'rgba(0,255,136,0.08)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    waves.forEach(drawWave);
    t++;
    requestAnimationFrame(frame);
  }
  frame();
})();


/* ─── TERMINAL TYPEWRITER ────────────────────────────────── */
(function initTerminal() {
  const body = document.getElementById('terminal-body');
  if (!body) return;

  const lines = [
    { type: 'cmd',  text: 'whoami' },
    { type: 'out',  text: 'bhavik — embedded_dev' },
    { type: 'cmd',  text: 'cat skills.h' },
    { type: 'out',  text: '#define MCU   STM32 | ESP32 | RP2040' },
    { type: 'out',  text: '#define PROTO  I2C | SPI | UART | CAN' },
    { type: 'out',  text: '#define RTOS   FreeRTOS | bare-metal' },
    { type: 'cmd',  text: 'ls projects/' },
    { type: 'out',  text: 'env_monitor/  motor_driver/  lora_mesh/' },
    { type: 'cmd',  text: 'echo $STATUS' },
    { type: 'out',  text: 'open_to_work=true  📡' },
  ];

  let lineIdx = 0, charIdx = 0;
  let currentEl = null;

  function nextLine() {
    if (lineIdx >= lines.length) return;
    const line = lines[lineIdx];

    const row    = document.createElement('div');
    row.className = 'term-line';

    if (line.type === 'cmd') {
      const prompt = document.createElement('span');
      prompt.className = 'term-prompt';
      prompt.textContent = '$ ';
      row.appendChild(prompt);
      currentEl = document.createElement('span');
      row.appendChild(currentEl);
    } else {
      currentEl = document.createElement('span');
      currentEl.className = 'term-out';
      row.appendChild(currentEl);
    }

    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    charIdx = 0;
    typeChar(line.text);
  }

  function typeChar(text) {
    if (charIdx < text.length) {
      currentEl.textContent += text[charIdx++];
      body.scrollTop = body.scrollHeight;
      setTimeout(() => typeChar(text), lines[lineIdx].type === 'cmd' ? 55 : 18);
    } else {
      lineIdx++;
      if (lineIdx < lines.length) {
        setTimeout(nextLine, lines[lineIdx-1].type === 'cmd' ? 350 : 80);
      } else {
        // Add blinking cursor at end
        const cur = document.createElement('span');
        cur.className = 'term-cursor';
        currentEl.parentElement.appendChild(cur);
      }
    }
  }

  setTimeout(nextLine, 800);
})();


/* ─── NAV SCROLL EFFECT ──────────────────────────────────── */
(function initNav() {
  const nav  = document.getElementById('nav');
  const links = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);

    // Active link tracking
    let current = '';
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 120) current = s.id;
    });
    links.forEach(l => {
      l.classList.toggle('active', l.getAttribute('href') === '#' + current);
    });
  });

  // Hamburger toggle
  const ham = document.getElementById('hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (ham) {
    ham.addEventListener('click', () => {
      navLinks && navLinks.classList.toggle('mobile-open');
    });
  }
})();


/* ─── PROJECT SLIDER ─────────────────────────────────────── */
const sliderState = {};

function slideProj(trackId, dotsId, dir) {
  const track  = document.getElementById(trackId);
  const dotsEl = document.getElementById(dotsId);
  if (!track) return;

  const slides = track.querySelectorAll('.slide');
  const total  = slides.length;
  if (!sliderState[trackId]) sliderState[trackId] = 0;

  sliderState[trackId] = (sliderState[trackId] + dir + total) % total;
  track.style.transform = `translateX(-${sliderState[trackId] * 100}%)`;

  // Update dots
  if (dotsEl) {
    dotsEl.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('active', i === sliderState[trackId]);
    });
  }
}

// Dot click support
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.slide-dots').forEach(dotsEl => {
    const dotsId  = dotsEl.id;
    const trackId = dotsId.replace('dots-', 'track-');
    dotsEl.querySelectorAll('.dot').forEach((dot, i) => {
      dot.addEventListener('click', () => {
        const track = document.getElementById(trackId);
        if (!track) return;
        sliderState[trackId] = i;
        track.style.transform = `translateX(-${i * 100}%)`;
        dotsEl.querySelectorAll('.dot').forEach((d, j) => d.classList.toggle('active', j === i));
      });
    });
  });

  // Touch swipe support
  document.querySelectorAll('.proj-slider').forEach(slider => {
    let startX = 0;
    slider.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 40) return;
      const track = slider.querySelector('.slider-track');
      const dots  = slider.querySelector('.slide-dots');
      if (track && dots) slideProj(track.id, dots.id, dx < 0 ? 1 : -1);
    });
  });
});


/* ─── PROJECT FILTER ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards      = document.querySelectorAll('.proj-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      cards.forEach(card => {
        const cat = card.dataset.category || '';
        if (filter === 'all' || cat.includes(filter)) {
          card.classList.remove('hidden');
          card.style.animation = 'none';
          requestAnimationFrame(() => { card.style.animation = ''; });
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });
});


/* ─── SKILL BAR ANIMATION ────────────────────────────────── */
(function initSkillBars() {
  const fills = document.querySelectorAll('.skill-fill');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('animated');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.3 });
  fills.forEach(f => observer.observe(f));
})();


/* ─── FADE-IN ON SCROLL ──────────────────────────────────── */
(function initFadeIn() {
  const els = document.querySelectorAll(
    '.proj-card, .skill-category, .blog-card, .tl-item, .about-card, .contact-link-item'
  );
  els.forEach(el => el.classList.add('fade-in'));

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => observer.observe(el));
})();


/* ─── CONTACT FORM ───────────────────────────────────────── */
function submitForm() {
  const status = document.getElementById('form-status');
  const inputs = document.querySelectorAll('#contact-form .form-input');
  let allFilled = true;
  inputs.forEach(i => { if (!i.value.trim()) allFilled = false; });
  if (!allFilled) {
    status.textContent = '⚠ Please fill out all fields.';
    status.style.color = 'var(--amber)';
    return;
  }
  status.textContent = '✓ Message sent! I\'ll get back to you soon.';
  status.style.color = 'var(--green)';
  inputs.forEach(i => { i.value = ''; });
}


/* ─── FOOTER UPTIME COUNTER ──────────────────────────────── */
(function initUptime() {
  const el = document.getElementById('uptime');
  const start = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    el.textContent = h ? `${h}h ${m}m ${sec}s` : m ? `${m}m ${sec}s` : `${sec}s`;
  }, 1000);
})();


/* ─── SMOOTH NAV CLICK ───────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 68;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});
