/* ═══════════════════════════════════════════════════════
   EMBEDDED PORTFOLIO — MAIN JS
   ═══════════════════════════════════════════════════════ */

/* ── THEME TOGGLE ───────────────────────────────────────── */
const html        = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeIcon   = themeToggle.querySelector('.theme-icon');

// Default: dark
let isDark = localStorage.getItem('theme') !== 'light';
applyTheme();

themeToggle.addEventListener('click', () => {
  isDark = !isDark;
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  applyTheme();
});

function applyTheme() {
  html.setAttribute('data-theme', isDark ? 'dark' : 'light');
  themeIcon.textContent = isDark ? '☀' : '🌙';
}

/* ── NAV SCROLL ─────────────────────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ── HAMBURGER ──────────────────────────────────────────── */
const hamburger  = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

function closeMobile() {
  mobileMenu.classList.remove('open');
}

/* ── OSCILLOSCOPE CANVAS ────────────────────────────────── */
(function initOscilloscope() {
  const canvas = document.getElementById('oscilloscope');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, raf;

  const WAVES = [
    { freq: 0.006, amp: 0.10, phase: 0,    speed: 0.012, color: '#00FF88' },
    { freq: 0.009, amp: 0.05, phase: 2.1,  speed: 0.007, color: '#FFB800' },
    { freq: 0.004, amp: 0.07, phase: 4.3,  speed: 0.004, color: '#00CCFF' },
  ];

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();

  let t = 0;

  function draw() {
    ctx.clearRect(0, 0, W, H);

    WAVES.forEach(wave => {
      ctx.beginPath();
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = wave.color;
      ctx.shadowBlur = 8;

      for (let x = 0; x <= W; x += 2) {
        const y = H / 2
          + Math.sin(x * wave.freq + t * wave.speed + wave.phase) * (H * wave.amp)
          + Math.sin(x * wave.freq * 0.5 + t * wave.speed * 0.6) * (H * wave.amp * 0.4);

        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    t++;
    raf = requestAnimationFrame(draw);
  }

  // Pause when tab not visible (performance)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else draw();
  });

  draw();
})();

/* ── INTERSECTION OBSERVER — FADE UP ────────────────────── */
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);

// Mark elements and observe
document.querySelectorAll(
  '.section-title, .section-label, .section-sub, ' +
  '.project-card, .skill-category, .cert-card, ' +
  '.tl-item, .oss-card, .about-card, .contact-item'
).forEach(el => {
  el.classList.add('fade-up');
  observer.observe(el);
});

/* ── SKILL BAR TRIGGER ──────────────────────────────────── */
// Re-trigger CSS animation when skill bars scroll into view
const skillObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.animation = 'none';
        e.target.offsetHeight; // reflow
        e.target.style.animation = '';
        skillObserver.unobserve(e.target);
      }
    });
  },
  { threshold: 0.5 }
);
document.querySelectorAll('.skill-fill').forEach(el => skillObserver.observe(el));

/* ── ACTIVE NAV LINK ────────────────────────────────────── */
const sections  = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('.nav-links a');

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(a => a.style.color = '');
        const id = e.target.id;
        const active = document.querySelector(`.nav-links a[href="#${id}"]`);
        if (active) active.style.color = 'var(--accent)';
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);
sections.forEach(s => sectionObserver.observe(s));

/* ── CONTACT FORM ───────────────────────────────────────── */
function handleForm(e) {
  e.preventDefault();
  const msg = document.getElementById('formMsg');

  // Simulate submit (replace with Formspree / EmailJS endpoint)
  msg.textContent = 'Message sent! I\'ll get back to you soon.';
  msg.className = 'form-msg success';
  e.target.reset();

  setTimeout(() => { msg.textContent = ''; msg.className = 'form-msg'; }, 5000);
}

/* ── FOOTER UPTIME CLOCK ────────────────────────────────── */
(function clock() {
  const el = document.getElementById('uptime');
  if (!el) return;

  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    el.textContent = `SYSTEM TIME ${h}:${m}:${s}`;
  }
  tick();
  setInterval(tick, 1000);
})();

/* ── SMOOTH ANCHOR SCROLL ───────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const id = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();

    const navH = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--nav-h'), 10) || 64;

    window.scrollTo({
      top: target.offsetTop - navH,
      behavior: 'smooth',
    });
  });
});
