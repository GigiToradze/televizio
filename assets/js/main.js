/* ═══════════════════════════════════════════════════════════
   TELEVIZIO — main.js
   1. language switch      2. scroll-scrubbed hero film
   3. header signal meter  4. reveals + ambient video
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

  /* ── 2. hero film ─────────────────────────────────────── */
  (function film() {
    var hero = document.getElementById('hero');
    var canvas = document.getElementById('film');
    var bloom = document.getElementById('bloom');
    var cue = document.getElementById('cue');
    var cta = document.getElementById('heroCta');
    var beats = Array.prototype.slice.call(document.querySelectorAll('.beat'));
    if (!hero || !canvas) return;

    var COUNT = 97;                       // assets/frames/f001..f097.webp
    var ctx = canvas.getContext('2d', { alpha: false });
    var images = new Array(COUNT);
    var loaded = new Array(COUNT);
    var current = -1;
    var lastDrawn = 0;

    /* Reduced motion or no GSAP: play the plain video instead. */
    if (reduced || !hasGSAP) {
      hero.classList.add('is-fallback');
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

    /* Load frame 1 first so the hero is never empty, then stream the rest. */
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
      trigger: hero,
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
