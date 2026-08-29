/* ═══════════════════════════════════════════════════════════
   TELEVIZIO — main.js
   1. language switch  2. hero parallax  3. scroll-scrubbed film
   4. signal meter      5. reveals + ambient video
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ── 1. language ──────────────────────────────────────── */
  (function language() {
    var buttons = document.querySelectorAll('[data-setlang]');
    var stored = null;
    try { stored = localStorage.getItem('televizio-lang'); } catch (e) {}

    function apply(lang) {
      root.setAttribute('lang', lang);
      root.setAttribute('data-lang', lang);
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.setlang === lang));
      });
      try { localStorage.setItem('televizio-lang', lang); } catch (e) {}
      if (hasGSAP) ScrollTrigger.refresh();
    }

    if (stored === 'en' || stored === 'ka') apply(stored);

    buttons.forEach(function (b) {
      b.addEventListener('click', function () { apply(b.dataset.setlang); });
    });
  })();

  /* ── 1b. mobile menu ──────────────────────────────────── */
  (function menu() {
    var burger = document.getElementById('burger');
    var panel = document.getElementById('menu');
    if (!burger || !panel) return;

    function close() {
      panel.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-locked');
    }
    function open() {
      panel.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('is-locked');
    }

    burger.addEventListener('click', function () {
      if (burger.getAttribute('aria-expanded') === 'true') close(); else open();
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { close(); burger.focus(); }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900 && !panel.hidden) close();
    });
  })();

  /* ── 2. hero: the room tilted in 3D ───────────────────── */
  (function heroTilt() {
    var hero  = document.getElementById('hero');
    var plate = document.getElementById('plate');
    var copy  = document.getElementById('heroCopy');
    var sheen = document.getElementById('sheen');
    var glow  = document.getElementById('tvglow');
    if (!hero || !plate) return;

    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* the set sits here in the frame — used for both the sheen and the
       "the room lights up as you approach the screen" response */
    var TV = { x: 0.733, y: 0.365 };

    /* scroll parallax: the plate drifts and settles as the hero leaves */
    if (hasGSAP && !reduced) {
      gsap.to(plate, {
        yPercent: 9, scale: 1.04, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
      });
      gsap.to(copy, {
        yPercent: -14, opacity: 0, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
      });
    }

    if (!fine || reduced || !hasGSAP) {
      hero.style.setProperty('--tvglow', '.78');
      return;
    }

    var TILT = 4.2;   // degrees at the far edge
    var rx = gsap.quickTo(plate, 'rotationX', { duration: 0.7, ease: 'power3.out' });
    var ry = gsap.quickTo(plate, 'rotationY', { duration: 0.7, ease: 'power3.out' });
    var cx = gsap.quickTo(copy,  'x',         { duration: 0.9, ease: 'power3.out' });
    var cy = gsap.quickTo(copy,  'y',         { duration: 0.9, ease: 'power3.out' });

    var idle = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 7, ease: 'sine.inOut' } })
      .fromTo(plate, { rotationY: -1.1, rotationX: 0.6 }, { rotationY: 1.1, rotationX: -0.6 });

    function onMove(e) {
      var r = hero.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width;
      var ny = (e.clientY - r.top) / r.height;

      if (idle) { idle.kill(); idle = null; }
      ry(( nx - 0.5) * 2 * TILT);
      rx((0.5 - ny) * 2 * TILT);
      cx((0.5 - nx) * 16);
      cy((0.5 - ny) * 10);

      if (sheen) {
        sheen.style.setProperty('--mx', (nx * 100).toFixed(1) + '%');
        sheen.style.setProperty('--my', (ny * 100).toFixed(1) + '%');
      }

      /* nearer the set, brighter the room */
      if (glow) {
        var d = Math.hypot(nx - TV.x, (ny - TV.y) * 0.62);
        gsap.to(hero, {
          duration: 0.6, ease: 'power2.out', overwrite: 'auto',
          '--tvglow': (0.62 + 0.5 * Math.max(0, 1 - d / 0.55)).toFixed(3)
        });
      }
    }

    function onLeave() {
      hero.classList.remove('is-live');
      rx(0); ry(0); cx(0); cy(0);
      gsap.to(hero, { duration: 0.9, ease: 'power2.out', '--tvglow': 0.7 });
    }

    hero.addEventListener('pointerenter', function () { hero.classList.add('is-live'); });
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
  })();

  /* ── 2. the scroll-scrubbed film ──────────────────────── */
  (function filmScrub() {
    var film = document.getElementById('film');
    var canvas = document.getElementById('filmCanvas');
    var bloom = document.getElementById('bloom');
    var cue = document.getElementById('cue');
    var cta = document.getElementById('filmCta');
    var beats = Array.prototype.slice.call(document.querySelectorAll('.beat'));
    if (!film || !canvas) return;

    var COUNT = 97;                       // assets/frames/f001..f097.webp
    var ctx = canvas.getContext('2d', { alpha: false });
    var images = new Array(COUNT);
    var loaded = new Array(COUNT);
    var current = -1;
    var lastDrawn = 0;

    /* Reduced motion or no GSAP: play the plain video instead. */
    if (reduced || !hasGSAP) {
      film.classList.add('is-fallback');
      var v = document.getElementById('filmVideo');
      if (v) { v.preload = 'auto'; v.play().catch(function () {}); }
      beats.forEach(function (b, i) { b.classList.toggle('is-on', i === 2); });
      if (cta) cta.classList.add('is-on');
      if (cue) cue.style.opacity = '0';
      return;
    }

    function src(i) {
      return 'assets/frames/f' + String(i + 1).padStart(3, '0') + '.webp';
    }

    function sizeCanvas() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      draw(lastDrawn, true);
    }

    /* cover on landscape-ish viewports, contain on tall ones —
       letterboxing is invisible because the footage sits on pure black */
    function draw(i, force) {
      if (!force && i === current) return;
      var img = images[i];
      if (!img || !loaded[i]) {
        for (var k = i; k >= 0; k--) { if (loaded[k]) { img = images[k]; i = k; break; } }
        if (!img) return;
      }
      current = i;
      lastDrawn = i;

      var cw = canvas.width, ch = canvas.height;
      var iw = img.naturalWidth, ih = img.naturalHeight;
      var wide = cw / ch >= 1.15;
      var fit = wide ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih);
      var dw = iw * fit, dh = ih * fit;
      /* on portrait the copy owns the lower third, so sit the film above it */
      var anchor = wide ? 0.5 : 0.40;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) * anchor, dw, dh);
    }

    /* Load frame 1 first so the stage is never empty, then stream the rest. */
    function load(i, cb) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { loaded[i] = true; if (cb) cb(); };
      img.onerror = function () { if (cb) cb(); };
      img.src = src(i);
      images[i] = img;
    }

    load(0, function () { sizeCanvas(); });

    var next = 1;
    function stream() {
      if (next >= COUNT) return;
      var i = next++;
      load(i, function () {
        if (i === current) draw(i, true);
        stream();
      });
    }
    // two parallel streams keeps the sequence ahead of a fast scroll
    setTimeout(function () { stream(); stream(); }, 200);

    window.addEventListener('resize', sizeCanvas);
    sizeCanvas();

    /* --- beat sequencing -------------------------------- */
    var BEATS = [
      { in: 0.00, out: 0.235 },   // tangled cables
      { in: 0.305, out: 0.495 },  // the spark
      { in: 0.735, out: 1.01 }    // the box
    ];

    function setBeats(p) {
      for (var i = 0; i < beats.length; i++) {
        var on = p >= BEATS[i].in && p < BEATS[i].out;
        if (beats[i].classList.contains('is-on') !== on) beats[i].classList.toggle('is-on', on);
      }
      if (cta) cta.classList.toggle('is-on', p >= 0.80);
    }

    /* bloom peaks with the explosion (~0.46–0.62) */
    function bloomAt(p) {
      if (p < 0.30 || p > 0.80) return 0;
      if (p < 0.50) return (p - 0.30) / 0.20 * 0.9;
      if (p < 0.60) return 0.9 + (p - 0.50) / 0.10 * 0.1;
      return Math.max(0, 1 - (p - 0.60) / 0.20);
    }

    ScrollTrigger.create({
      trigger: film,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: function (self) {
        var p = self.progress;
        draw(Math.min(COUNT - 1, Math.round(p * (COUNT - 1))));
        setBeats(p);
        if (bloom) bloom.style.opacity = bloomAt(p).toFixed(3);
        if (cue) cue.style.opacity = String(Math.max(0, 1 - p * 14));
      }
    });

    setBeats(0);
  })();

  /* ── 3. header signal meter ───────────────────────────── */
  (function meter() {
    var bar = document.getElementById('meter');
    if (!bar || !hasGSAP) return;
    gsap.to(bar, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
    });
  })();

  /* ── 4. reveals ───────────────────────────────────────── */
  (function reveals() {
    if (!hasGSAP || reduced) return;

    var groups = [
      '.sec__head > *',
      '.epg',
      '.stats > div',
      '.box__media',
      '.box__copy > *',
      '.step',
      '.plan',
      '.qa',
      '.cta > *',
      '.ftr__logo'
    ];

    groups.forEach(function (sel) {
      var els = document.querySelectorAll(sel);
      if (!els.length) return;
      els.forEach(function (el) { el.classList.add('rv'); });

      ScrollTrigger.batch(els, {
        start: 'top 88%',
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, {
            opacity: 1, y: 0, duration: 0.75, ease: 'power3.out', stagger: 0.07,
            overwrite: true
          });
        }
      });
    });
  })();

  /* ── 5. ambient product video ─────────────────────────── */
  (function ambient() {
    var vids = document.querySelectorAll('video[data-autoplay]');
    if (!vids.length) return;

    if (!('IntersectionObserver' in window)) {
      vids.forEach(function (v) { v.preload = 'auto'; v.play().catch(function () {}); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          v.preload = 'auto';
          v.play().catch(function () {});
        } else if (!v.ended) {
          v.pause();
        }
      });
    }, { threshold: 0.25 });

    vids.forEach(function (v) { io.observe(v); });
  })();

})();
