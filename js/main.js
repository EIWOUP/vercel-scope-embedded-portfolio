/**
 * liquid-glass-magnifier.js
 * Apple-style liquid glass cursor magnifier
 * Drop into /js/ and add <script src="js/liquid-glass-magnifier.js" defer></script>
 * just before </body> in index.html
 */

(function () {
  'use strict';

  /* ── Config ──────────────────────────────── */
  const MAG_SIZE   = 160;          // px — match --mag-size in CSS
  const ZOOM_STEP  = 0.25;
  const ZOOM_MIN   = 1.5;
  const ZOOM_MAX   = 4.0;
  let   zoomLevel  = 2.0;

  /* ── State ───────────────────────────────── */
  let magEnabled  = false;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let curX   = mouseX;
  let curY   = mouseY;
  let dotX   = mouseX;
  let dotY   = mouseY;
  let rafId  = null;

  /* ── Build DOM ───────────────────────────── */
  const mag = document.createElement('div');
  mag.id = 'liquid-glass-mag';

  const magInner = document.createElement('div');
  magInner.className = 'mag-inner';
  mag.appendChild(magInner);

  const dot    = document.createElement('div');  dot.id    = 'cursor-dot';
  const ring   = document.createElement('div');  ring.id   = 'cursor-ring';
  const badge  = document.createElement('div');  badge.id  = 'mag-zoom-badge';
  const btn    = document.createElement('button'); btn.id  = 'mag-toggle-btn';
  const prog   = document.createElement('div');  prog.id   = 'scroll-progress';

  btn.innerHTML  = '⊕';
  btn.title      = 'Toggle Magnifier';
  badge.textContent = `${zoomLevel.toFixed(1)}×`;

  document.body.appendChild(mag);
  document.body.appendChild(dot);
  document.body.appendChild(ring);
  document.body.appendChild(badge);
  document.body.appendChild(btn);
  document.body.appendChild(prog);

  /* ── Scroll progress ─────────────────────── */
  function updateScroll() {
    const h   = document.documentElement;
    const pct = h.scrollTop / (h.scrollHeight - h.clientHeight) * 100;
    prog.style.width = Math.min(pct, 100) + '%';
  }
  document.addEventListener('scroll', updateScroll, { passive: true });

  /* ── Cursor tracking ─────────────────────── */
  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  /* interactive-element hover state */
  document.addEventListener('mouseover', e => {
    if (e.target.matches('a,button,input,textarea,[role="button"],.project-card,.skill-item')) {
      document.body.classList.add('hovering');
    }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.matches('a,button,input,textarea,[role="button"],.project-card,.skill-item')) {
      document.body.classList.remove('hovering');
    }
  });

  /* press squish */
  document.addEventListener('mousedown', () => { if (magEnabled) mag.classList.add('pressed'); });
  document.addEventListener('mouseup',   () => { mag.classList.remove('pressed'); });

  /* ── Toggle ──────────────────────────────── */
  function enableMag() {
    magEnabled = true;
    mag.classList.add('active');
    document.body.classList.add('mag-on');
    btn.classList.add('active');
    btn.innerHTML = '⊗';
    badge.classList.add('visible');
    buildMagContent();
  }

  function disableMag() {
    magEnabled = false;
    mag.classList.remove('active', 'pressed');
    document.body.classList.remove('mag-on');
    btn.classList.remove('active');
    btn.innerHTML = '⊕';
    badge.classList.remove('visible');
    magInner.innerHTML = '';
  }

  btn.addEventListener('click', () => {
    magEnabled ? disableMag() : enableMag();
  });

  /* ── Keyboard shortcuts ──────────────────── */
  document.addEventListener('keydown', e => {
    if (e.key === 'm' || e.key === 'M') {
      magEnabled ? disableMag() : enableMag();
    }
    if (magEnabled) {
      if (e.key === '+' || e.key === '=') adjustZoom(ZOOM_STEP);
      if (e.key === '-' || e.key === '_') adjustZoom(-ZOOM_STEP);
    }
  });

  /* ── Scroll wheel zoom inside magnifier ─── */
  document.addEventListener('wheel', e => {
    if (!magEnabled) return;
    e.preventDefault();
    adjustZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  }, { passive: false });

  function adjustZoom(delta) {
    zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel + delta));
    badge.textContent = `${zoomLevel.toFixed(1)}×`;
    updateMagTransform(curX, curY);
  }

  /* ── Clone page content into magnifier ──── */
  let cloneRoot = null;

  function buildMagContent() {
    magInner.innerHTML = '';

    /* Clone the page body into the mag lens */
    cloneRoot = document.body.cloneNode(true);

    /* strip the UI elements we injected */
    ['liquid-glass-mag','cursor-dot','cursor-ring',
     'mag-zoom-badge','mag-toggle-btn','scroll-progress'].forEach(id => {
      const el = cloneRoot.querySelector('#' + id);
      if (el) el.remove();
    });

    /* copy stylesheets as a single blob to force same rendering */
    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
    const styleBlob  = styleLinks.map(l => {
      if (l.tagName === 'STYLE') return l.outerHTML;
      return `<link rel="stylesheet" href="${l.href}">`;
    }).join('\n');

    /* wrap in an iframe for isolated rendering */
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `
      position: absolute;
      width:  ${window.innerWidth}px;
      height: ${window.innerHeight}px;
      top: 0; left: 0;
      border: none;
      pointer-events: none;
      background: transparent;
    `;
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    magInner.appendChild(iframe);

    /* write page HTML into iframe */
    iframe.addEventListener('load', () => {
      syncIframeScroll(iframe);
    });

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <base href="${location.origin}${location.pathname}">
      ${styleBlob}
      <style>
        html,body{margin:0;padding:0;overflow:hidden!important;background:#0a0a0a;}
        /* hide sticky nav inside glass */
        nav,header{display:none!important;}
        /* no cursor inside */
        *{cursor:none!important;}
      </style>
    </head><body>${cloneRoot.innerHTML}</body></html>`);
    doc.close();

    cloneRoot._iframe = iframe;
  }

  function syncIframeScroll(iframe) {
    try {
      const iwin = iframe.contentWindow;
      if (!iwin) return;
      iwin.scrollTo(0, window.scrollY);
    } catch (e) { /* cross-origin guard */ }
  }

  /* ── Remap magnifier viewport ────────────── */
  function updateMagTransform(x, y) {
    if (!magEnabled) return;
    const iframe = magInner.querySelector('iframe');
    if (!iframe) return;

    /* scroll sync */
    syncIframeScroll(iframe);

    /* update iframe dimensions if window resized */
    iframe.style.width  = window.innerWidth  + 'px';
    iframe.style.height = window.innerHeight + 'px';

    /* 
     * The iframe shows the full page at 1:1.
     * We scale it by zoomLevel from a transform-origin
     * that places the cursor position at the center of the lens.
     *
     * transform-origin (in iframe-space) = cursor position
     * After scaling, the cursor maps to center of the MAG_SIZE circle.
     */
    const halfMag = MAG_SIZE / 2;
    const ox = x;           /* origin x in page coords */
    const oy = y;           /* origin y in page coords */

    /* 
     * We want: after scale, point (ox,oy) appears at center of magInner.
     * magInner top-left is at (x - halfMag, y - halfMag) page coords.
     * iframe top-left = 0,0. So iframe's offset inside magInner = -(x-halfMag), -(y-halfMag)?
     * Easier: let CSS transform-origin do the work.
     */
    magInner.style.transformOrigin = `${ox}px ${oy}px`;
    magInner.style.transform = `scale(${zoomLevel})`;
    /* shift magInner so that (ox,oy)*scale ends up at lens center */
    magInner.style.left = `${halfMag - ox * zoomLevel}px`;
    magInner.style.top  = `${halfMag - oy * zoomLevel}px`;
    magInner.style.transformOrigin = '0 0';
  }

  /* ── Animation loop ──────────────────────── */
  const LERP_CURSOR = 0.18;
  const LERP_DOT    = 0.38;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function tick() {
    /* smooth cursor ring */
    curX = lerp(curX, mouseX, LERP_CURSOR);
    curY = lerp(curY, mouseY, LERP_CURSOR);

    /* snappy dot */
    dotX = lerp(dotX, mouseX, LERP_DOT);
    dotY = lerp(dotY, mouseY, LERP_DOT);

    dot.style.left  = dotX + 'px';
    dot.style.top   = dotY + 'px';
    ring.style.left = curX + 'px';
    ring.style.top  = curY + 'px';

    if (magEnabled) {
      mag.style.left = curX + 'px';
      mag.style.top  = curY + 'px';
      updateMagTransform(mouseX, mouseY);
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  /* ── Touch: disable on mobile ────────────── */
  if ('ontouchstart' in window) {
    disableMag();
    btn.style.display = 'none';
    dot.style.display = 'none';
    ring.style.display = 'none';
    document.body.style.cursor = 'auto';
  }

})();
