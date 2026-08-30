/* ═══════════════════════════════════════════════════════════
   TELEVIZIO — main.js
   1 language   2 menu      3 hero       4 chrome (meter/nav/dock)
   5 reveals    6 counters  7 live guide 8 ticker
   9 product video          10 signal field (WebGL)
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var NL = String.fromCharCode(10);   // shader line break
  var root = document.documentElement;
  var HERE = (document.currentScript && document.currentScript.src) || '';
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

  /* ── 2. mobile menu ───────────────────────────────────── */
  (function menu() {
    var burger = document.getElementById('burger');
    var panel = document.getElementById('menu');
    if (!burger || !panel) return;

    function focusables() {
      return panel.querySelectorAll('a[href], button:not([disabled])');
    }

    function close() {
      panel.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-locked');
    }
    function open() {
      panel.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('is-locked');
      var f = focusables();
      if (f.length) f[0].focus();
    }

    burger.addEventListener('click', function () {
      if (burger.getAttribute('aria-expanded') === 'true') close(); else open();
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (panel.hidden) return;
      if (e.key === 'Escape') { close(); burger.focus(); return; }
      if (e.key !== 'Tab') return;

      /* keep tabbing inside the open panel */
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900 && !panel.hidden) close();
    });
  })();

  /* ── 3. hero: three rooms, crossfading ───────────────── */
  (function hero() {
    var section = document.getElementById('hero');
    var plate = document.getElementById('plate');
    var copy = document.getElementById('heroCopy');
    var dotBox = document.getElementById('heroDots');
    var scenes = document.querySelectorAll('.hero__scene');
    var dots = dotBox ? dotBox.querySelectorAll('button') : [];
    if (!section || !plate) return;

    var HOLD = 6.5;          // seconds a room stays up
    var FADE = 1.4;          // seconds to cross to the next
    var at = 0;
    var timer = null;

    function mark(i) {
      for (var d = 0; d < dots.length; d++) {
        dots[d].setAttribute('aria-selected', String(d === i));
      }
    }

    /* no GSAP or no appetite for motion: first room, no rotation */
    if (!hasGSAP || reduced) {
      mark(0);
      if (dots.length) {
        dots.forEach(function (dot, i) {
          dot.addEventListener('click', function () {
            scenes.forEach(function (s, n) { s.classList.toggle('is-on', n === i); });
            mark(i);
          });
        });
      }
      return;
    }

    gsap.set(scenes, { opacity: 0 });
    gsap.set(scenes[0], { opacity: 1 });
    mark(0);

    function show(next) {
      if (next === at) return;
      gsap.to(scenes[at], { opacity: 0, duration: FADE, ease: 'power1.inOut' });
      gsap.to(scenes[next], { opacity: 1, duration: FADE, ease: 'power1.inOut' });
      at = next;
      mark(next);
    }

    function queue() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        show((at + 1) % scenes.length);
        queue();
      }, HOLD * 1000);
    }
    queue();

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { show(i); queue(); });
    });

    /* a room nobody is looking at does not need to change */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) queue(); else clearTimeout(timer);
      }, { threshold: 0 }).observe(section);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearTimeout(timer); else queue();
    });

    /* the opening, and the drift as the section leaves */
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo(plate,
        { scale: 1.14, filter: 'brightness(.15) saturate(.4)' },
        { scale: 1, filter: 'brightness(1) saturate(1)', duration: 1.5 })
      .from('.hero__kick', { y: 14, opacity: 0, duration: 0.7 }, 0.55)
      .from('.hero__h1', {
        y: 26, opacity: 0, duration: 0.9,
        clipPath: 'inset(0% 0% 100% 0%)'
      }, 0.7)
      .from('.hero__lede', { y: 16, opacity: 0, duration: 0.7 }, 0.95)
      .from('.hero__cta > *', { y: 14, opacity: 0, duration: 0.6, stagger: 0.08 }, 1.05)
      .from(dotBox, { opacity: 0, duration: 0.6 }, 1.2);

    gsap.to(plate, {
      yPercent: 9, scale: 1.04, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true }
    });
    gsap.to(copy, {
      yPercent: -14, opacity: 0, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true }
    });
  })();

  /* ── 4. header meter, current section, order dock ─────── */
  (function chrome() {
    if (!hasGSAP) return;

    var bar = document.getElementById('meter');
    if (bar) {
      gsap.to(bar, {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
      });
    }

    /* mark the section you are actually reading */
    var links = {};
    document.querySelectorAll('.hdr__nav a[href^="#"]').forEach(function (a) {
      links[a.getAttribute('href').slice(1)] = a;
    });
    function setCurrent(id) {
      for (var key in links) links[key].setAttribute('aria-current', String(key === id));
    }
    Object.keys(links).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      ScrollTrigger.create({
        trigger: el, start: 'top 55%', end: 'bottom 55%',
        onEnter: function () { setCurrent(id); },
        onEnterBack: function () { setCurrent(id); }
      });
    });
    ScrollTrigger.create({
      trigger: '#hero', start: 'top 55%', end: 'bottom 55%',
      onEnter: function () { setCurrent(''); },
      onEnterBack: function () { setCurrent(''); }
    });

    /* on phones, keep the price and the order button within thumb reach —
       except where the page is already asking for the sale */
    var dock = document.getElementById('dock');
    if (!dock) return;
    var dockCta = dock.querySelector('a');
    var shown = false;
    function show(on) {
      if (on === shown) return;
      shown = on;
      dock.classList.toggle('is-on', on);
      dock.setAttribute('aria-hidden', String(!on));
      if (dockCta) dockCta.tabIndex = on ? 0 : -1;
    }
    ScrollTrigger.create({
      trigger: '#hero', start: 'bottom 90%',
      onEnter: function () { show(true); },
      onLeaveBack: function () { show(false); }
    });
    ScrollTrigger.create({
      trigger: '#price', start: 'top 90%', endTrigger: 'footer', end: 'bottom bottom',
      onEnter: function () { show(false); },
      onLeaveBack: function () { show(true); }
    });
  })();

  /* ── 5. reveals ───────────────────────────────────────── */
  (function reveals() {
    if (!hasGSAP || reduced) return;

    var groups = [
      '.sec:not(#channels) .sec__head > *',
      '.step', '.plan', '.qa', '.cta > *', '.ftr__logo'
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
            opacity: 1, y: 0, duration: 0.75, ease: 'power3.out',
            stagger: 0.07, overwrite: true
          });
        }
      });
    });
  })();

  /* ── 5b. the statistics open from the middle out ──────── */
  /* Scrubbed, like the wall: the middle number arrives first, then the
     pair either side, then the outer pair, and each one counts as it
     lands. Scroll back and it runs in reverse. */
  (function statsScroll() {
    var stats = document.querySelector('.stats');
    if (!stats) return;
    var cells = Array.prototype.slice.call(stats.querySelectorAll('[data-tier]'));
    var counted = Array.prototype.slice.call(stats.querySelectorAll('[data-count]'));
    if (!cells.length) return;

    function write(el, n) {
      var v = Math.round(n);
      el.textContent = el.dataset.format === 'space'
        ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
        : String(v);
    }

    if (!hasGSAP || reduced) {
      counted.forEach(function (el) { write(el, +el.dataset.count); });
      return;
    }

    counted.forEach(function (el) { write(el, 0); });
    gsap.set(cells, { opacity: 0, y: 30, scale: 0.94 });

    /* the stage is sticky, so this maps onto the whole time it holds
       the screen, with the tail left as a beat where all five stand */
    var run = document.querySelector('.stats__run');
    var tl = gsap.timeline({
      scrollTrigger: run
        ? { trigger: run, start: 'top top', end: 'bottom bottom', scrub: 0.5 }
        : { trigger: stats, start: 'top 88%', end: 'top 32%', scrub: 0.5 }
    });

    [0, 1, 2].forEach(function (tier) {
      var group = cells.filter(function (c) { return +c.dataset.tier === tier; });
      var at = tier * 0.55;

      tl.to(group, {
        opacity: 1, y: 0, scale: 1, duration: 1, ease: 'power2.out'
      }, at);

      group.forEach(function (cell) {
        var el = cell.querySelector('[data-count]');
        if (!el) return;
        var box = { n: 0 };
        tl.to(box, {
          n: +el.dataset.count, duration: 1.1, ease: 'power2.out',
          onUpdate: function () { write(el, box.n); }
        }, at);
      });
    });

    tl.to({}, { duration: 0.85 });   // hold, all five standing
  })();

  /* ── 5a. the guide fills in while the section holds ───── */
  (function guideScroll() {
    var run = document.querySelector('.guide__run');
    var head = document.querySelector('.guide .sec__head');
    var epg = document.querySelector('.guide .epg');
    if (!run || !head || !epg || !hasGSAP || reduced) return;

    var h2 = head.querySelector('.dsp');
    var lede = head.querySelector('.lede');
    var ruler = epg.querySelector('.epg__ruler');
    var rows = epg.querySelectorAll('.epg__row');
    var hint = epg.querySelector('.epg__hint');

    var pinned = window.matchMedia('(min-width:1200px) and (min-height:640px)').matches;

    gsap.set([h2, lede], { opacity: 0, y: 24 });
    gsap.set(epg, { opacity: 0 });
    gsap.set(ruler, { opacity: 0 });
    gsap.set(rows, { opacity: 0, x: -18 });
    if (hint) gsap.set(hint, { opacity: 0 });

    var tl = gsap.timeline({
      scrollTrigger: pinned
        ? { trigger: run, start: 'top top', end: 'bottom bottom', scrub: 0.5 }
        : { trigger: run, start: 'top 78%', end: 'top 12%', scrub: 0.5 }
    });

    tl.to(h2,    { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 0)
      .to(lede,  { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 0.4)
      .to(epg,   { opacity: 1, duration: 0.5 }, 0.7)
      .to(ruler, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.7)
      /* the guide tunes in one channel at a time */
      .to(rows,  { opacity: 1, x: 0, duration: 0.45, ease: 'power2.out', stagger: 0.13 }, 0.95)
      .to(hint,  { opacity: 1, duration: 0.5 }, 2.3)
      .to({},    { duration: pinned ? 0.9 : 0.2 });   // hold
  })();

  /* ── 5c. the box reports itself, row by row ───────────── */
  (function boxScroll() {
    var run = document.querySelector('.box__run');
    var film = document.querySelector('.box__film');
    var copy = document.querySelector('.box__copy');
    if (!run || !film || !copy || !hasGSAP || reduced) return;

    var head = copy.querySelector('.dsp');
    var lede = copy.querySelector('.lede');
    var rows = copy.querySelectorAll('.spec tbody tr');
    var note = copy.querySelector('.box__note');

    var pinned = window.matchMedia('(min-width:1000px) and (min-height:760px)').matches;

    var cap = copy.querySelector('.box__cap');
    gsap.set([head, lede, note, cap], { opacity: 0, y: 24 });
    gsap.set(rows, { opacity: 0, y: 14 });
    gsap.set(film, { opacity: 0 });

    var tl = gsap.timeline({
      scrollTrigger: pinned
        ? { trigger: run, start: 'top top', end: 'bottom bottom', scrub: 0.5 }
        : { trigger: run, start: 'top 78%', end: 'top 18%', scrub: 0.5 }
    });

    tl.to(film, { opacity: 1, duration: 1.1, ease: 'power2.out' }, 0)
      .to(head,  { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 0.35)
      .to(lede,  { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 0.75)
      /* the spec sheet fills in a line at a time, like the box
         listing what it is */
      .to(rows,  { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.16 }, 1.05)
      .to([note, cap], { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.1 }, 2.35)
      .to({},    { duration: pinned ? 0.9 : 0.2 });   // hold
  })();

  /* ── 6. counters ──────────────────────────────────────── */
  (function counters() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-count]'))
      .filter(function (el) { return !el.closest('.stats'); });
    if (!els.length) return;

    function write(el, n) {
      var v = Math.round(n);
      el.textContent = el.dataset.format === 'space'
        ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
        : String(v);
    }

    if (!hasGSAP || reduced) {
      els.forEach(function (el) { write(el, +el.dataset.count); });
      return;
    }

    els.forEach(function (el) {
      var target = +el.dataset.count;
      var box = { n: 0 };
      write(el, 0);
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: function () {
          gsap.to(box, {
            n: target, duration: 1.5, ease: 'power2.out',
            onUpdate: function () { write(el, box.n); }
          });
        }
      });
    });
  })();

  /* ── 7. the guide runs on the real clock ──────────────── */
  (function liveGuide() {
    var body = document.getElementById('epgBody');
    var times = document.getElementById('epgTimes');
    var now = document.getElementById('epgNow');
    if (!body || !times || !now) return;

    var COLS = 12;             // twelve half-hour columns
    var SPAN = 6 * 3600e3;     // six hours across the grid
    var label = now.querySelector('b');

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    function tick() {
      var t = new Date();
      /* the grid opens two hours before the top of this hour, so "now"
         always sits a third of the way in with some history still visible */
      var start = new Date(t);
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() - 2);

      var labels = times.children;
      for (var i = 0; i < labels.length; i++) {
        var h = new Date(start.getTime() + i * 3600e3);
        labels[i].textContent = pad(h.getHours()) + ':00';
      }

      var p = (t - start) / SPAN;
      now.style.setProperty('--now', p.toFixed(4));
      if (label) label.textContent = pad(t.getHours()) + ':' + pad(t.getMinutes());

      /* whichever block the playhead sits inside is on air */
      var col = p * COLS;
      body.querySelectorAll('.epg__row').forEach(function (row) {
        var at = 0;
        row.querySelectorAll('.prog').forEach(function (prog) {
          var span = parseFloat(getComputedStyle(prog).getPropertyValue('--span')) || 2;
          prog.classList.toggle('is-live', col >= at && col < at + span);
          at += span;
        });
      });
    }

    tick();
    setInterval(tick, 30000);
  })();

  /* ── 8. the scan lane answers to the scroll ───────────── */
  (function scanLane() {
    var row = document.getElementById('scanLane');
    if (!row || !hasGSAP || reduced) return;

    var tape = gsap.to(row, { xPercent: -50, duration: 74, ease: 'none', repeat: -1 });
    var settle;
    var held = false;

    /* a logo you are looking at should not slide out from under you */
    var strip = row.closest('.scan');
    if (strip) {
      strip.addEventListener('pointerenter', function () {
        held = true;
        gsap.to(tape, { timeScale: 0.12, duration: 0.5, ease: 'power2.out' });
      });
      strip.addEventListener('pointerleave', function () {
        held = false;
        gsap.to(tape, { timeScale: 1, duration: 0.9, ease: 'power2.out' });
      });
    }

    /* scrolling drags the tape along with you, then it settles back */
    ScrollTrigger.create({
      onUpdate: function (self) {
        if (held) return;
        var v = Math.abs(gsap.utils.clamp(-6, 6, self.getVelocity() / 320));
        tape.timeScale(1 + v);
        clearTimeout(settle);
        settle = setTimeout(function () {
          if (!held) gsap.to(tape, { timeScale: 1, duration: 1.2, ease: 'power2.out' });
        }, 140);
      }
    });
  })();

  /* ── 8b. the signal reaching each stage ───────────────── */
  (function signalRail() {
    var rail = document.getElementById('rail');
    var steps = document.querySelectorAll('.steps .step');
    if (!rail || !steps.length) return;

    if (!hasGSAP || reduced) {
      gsap && gsap.set ? gsap.set(rail, { scaleX: 1 }) : (rail.style.transform = 'scaleX(1)');
      steps.forEach(function (s) { s.classList.add('is-on'); });
      return;
    }

    ScrollTrigger.create({
      trigger: '.steps',
      start: 'top 78%',
      end: 'bottom 62%',
      scrub: 0.6,
      onUpdate: function (self) {
        var p = self.progress;
        rail.style.transform = 'scaleX(' + p.toFixed(4) + ')';
        steps.forEach(function (step, i) {
          step.classList.toggle('is-on', p >= (i + 0.55) / steps.length);
        });
      }
    });
  })();

  /* ── 9. ambient product video ─────────────────────────── */
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
        if (e.isIntersecting) { v.preload = 'auto'; v.play().catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.25 });

    vids.forEach(function (v) { io.observe(v); });
  })();

  /* three.js is ~188 KB gzipped, so it is fetched once, lazily, and
     only when one of the two WebGL sections is nearly in view. */
  var threePromise = null;
  function loadThree() {
    if (!threePromise) {
      var url = HERE ? new URL('vendor/three.module.min.js', HERE).href
                     : 'assets/js/vendor/three.module.min.js';
      threePromise = import(url);
    }
    return threePromise;
  }
  function whenNear(el, margin, run) {
    var armed = false;
    var watcher = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || armed) return;
      armed = true;
      watcher.disconnect();
      loadThree().then(run).catch(function () {});
    }, { rootMargin: margin });
    watcher.observe(el);
  }

  /* ── 10. the wall — 1,024 channels finding their places ─ */
  (function channelWall() {
    var canvas = document.getElementById('wallCanvas');
    if (!canvas || !hasGSAP || reduced) return;
    if (!('IntersectionObserver' in window)) return;

    whenNear(canvas, '600px', function (THREE) {
      var stage = canvas.parentNode;
      var renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
      } catch (e) { return; }
      renderer.setClearColor(0x000000, 0);

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0, 9);

      var SIDE = 32, N = SIDE * SIDE;        // 1,024
      var PITCH = 0.2, CELL = 0.155;

      var base = new THREE.PlaneGeometry(CELL, CELL * 0.62);
      var geo = new THREE.InstancedBufferGeometry();
      geo.index = base.index;
      geo.attributes.position = base.attributes.position;
      geo.attributes.uv = base.attributes.uv;
      geo.instanceCount = N;

      var target = new Float32Array(N * 3);
      var origin = new Float32Array(N * 3);
      var phase = new Float32Array(N);
      var half = (SIDE - 1) * PITCH / 2;

      for (var i = 0; i < N; i++) {
        var col = i % SIDE, rowI = Math.floor(i / SIDE);
        target[i * 3]     = col * PITCH - half;
        target[i * 3 + 1] = rowI * PITCH * 0.68 - half * 0.68;
        target[i * 3 + 2] = 0;
        /* scattered through depth, further out the later they land */
        var ang = Math.random() * Math.PI * 2;
        var rad = 3.5 + Math.random() * 7;
        origin[i * 3]     = Math.cos(ang) * rad;
        origin[i * 3 + 1] = Math.sin(ang) * rad * 0.7;
        origin[i * 3 + 2] = -14 - Math.random() * 22;
        phase[i] = Math.random();
      }

      geo.setAttribute('aTarget', new THREE.InstancedBufferAttribute(target, 3));
      geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origin, 3));
      geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));

      var uniforms = { uP: { value: 0 }, uTime: { value: 0 } };

      var mat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: [
          'attribute vec3 aTarget; attribute vec3 aOrigin; attribute float aPhase;',
          'uniform float uP; uniform float uTime;',
          'varying float vB; varying vec2 vUv;',
          'void main(){',
          '  float e = clamp((uP - aPhase * 0.42) / 0.58, 0.0, 1.0);',
          '  e = e * e * (3.0 - 2.0 * e);',
          '  vec3 c = mix(aOrigin, aTarget, e);',
          '  vec3 p = position * mix(0.35, 1.0, e) + c;',
          '  float flick = 0.72 + 0.28 * sin(uTime * 2.4 + aPhase * 53.0);',
          '  vB = e * mix(0.35, flick, e);',
          '  vUv = uv;',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
          '}'
        ].join(NL),
        fragmentShader: [
          'varying float vB; varying vec2 vUv;',
          'void main(){',
          '  vec2 d = abs(vUv - 0.5);',
          '  float edge = smoothstep(0.42, 0.5, max(d.x, d.y));',
          '  vec3 col = vec3(0.894, 0.129, 0.110);',
          '  float a = (0.30 + edge * 0.95) * vB;',
          '  if (a < 0.004) discard;',
          '  gl_FragColor = vec4(col + edge * vB * 0.45, a);',
          '}'
        ].join(NL)
      });

      var mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      scene.add(mesh);

      function resize() {
        var w = stage.clientWidth, h = stage.clientHeight;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        /* keep the grid inside the frame on narrow screens */
        var fit = Math.min(1, (w / h) / 1.35);
        mesh.scale.setScalar(0.75 + 0.25 * fit);
        camera.position.z = 9 / Math.max(0.55, fit);
        /* on wide screens push the grid right, clear of the headline */
        mesh.position.x = w / h > 1.25 ? 1.9 : 0;
        mesh.position.y = w / h > 1.25 ? 0 : 1.15;
      }
      resize();
      window.addEventListener('resize', resize);

      ScrollTrigger.create({
        trigger: '.wall__run',
        start: 'top top', end: 'bottom bottom', scrub: 0.4,
        onUpdate: function (self) {
          /* land the grid at 76% and let the rest of the runway hold it */
          uniforms.uP.value = Math.min(1, self.progress / 0.76);
        }
      });

      var visible = false, running = false;
      var t0 = performance.now();
      function loop() {
        if (!visible) { running = false; return; }
        uniforms.uTime.value = (performance.now() - t0) / 1000;
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
      }
      new IntersectionObserver(function (e) {
        visible = e[0].isIntersecting;
        if (visible && !running) { running = true; loop(); }
      }, { threshold: 0 }).observe(canvas);
    });
  })();

  /* ── 10b. the wall's headline lands with the first cells ─ */
  (function wallCopy() {
    var run = document.querySelector('.wall__run');
    var copy = document.querySelector('.wall__copy');
    if (!run || !copy || !hasGSAP || reduced) return;

    gsap.set(copy, { opacity: 0, y: 26 });
    gsap.to(copy, {
      opacity: 1, y: 0, ease: 'power2.out',
      scrollTrigger: { trigger: run, start: 'top top', end: '26% top', scrub: 0.5 }
    });
  })();

  /* ── 11. the signal field ─────────────────────────────── */
  (function signalField() {
    var canvas = document.getElementById('field');
    if (!canvas || reduced) return;
    if (!('IntersectionObserver' in window)) return;

    whenNear(canvas, '500px', start);

    function start(THREE) {
      var section = canvas.closest('section');
      var renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
      } catch (e) { return; }
      renderer.setClearColor(0x000000, 0);

      var scene = new THREE.Scene();
      var camera = new THREE.Camera();          // the shader writes clip space itself

      var COLS = 132, ROWS = 38;
      var pos = new Float32Array(COLS * ROWS * 3);
      var k = 0;
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          pos[k++] = (x / (COLS - 1)) * 2 - 1;
          pos[k++] = (y / (ROWS - 1)) * 2 - 1;
          pos[k++] = 0;
        }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

      var uniforms = {
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, -3) },
        uAspect: { value: 1 },
        uDpr: { value: 1 },
        uIn: { value: 0 }
      };

      var mat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: [
          'uniform float uTime;   uniform vec2  uPointer;',
          'uniform float uAspect; uniform float uDpr; uniform float uIn;',
          'varying float vI;',
          'void main(){',
          '  vec3 p = position;',
          '  vec2 a = vec2(p.x * uAspect, p.y);',
          '  float d = length(a);',
          '  float ring = sin(d * 3.1 - uTime * 1.05);',
          '  vec2 pa = vec2((p.x - uPointer.x) * uAspect, p.y - uPointer.y);',
          '  float bulge = exp(-dot(pa, pa) * 5.0);',
          '  float edge = smoothstep(2.5, 0.10, d);',
          '  float crest = pow(0.5 + 0.5 * ring, 2.4);',
          '  vI = (crest * 1.0 + bulge * 1.25) * edge * uIn;',
          '  p.y += (ring * 0.022 + bulge * 0.055) * edge;',
          '  gl_Position = vec4(p, 1.0);',
          '  gl_PointSize = (1.2 + vI * 4.2) * uDpr;',
          '}'
        ].join(NL),
        fragmentShader: [
          'varying float vI;',
          'void main(){',
          '  float m = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));',
          '  if (m * vI < 0.01) discard;',
          '  gl_FragColor = vec4(0.894, 0.129, 0.110, m * vI);',
          '}'
        ].join(NL)
      });

      scene.add(new THREE.Points(geo, mat));

      function resize() {
        var w = canvas.clientWidth || section.clientWidth;
        var h = canvas.clientHeight || section.clientHeight;
        var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        uniforms.uAspect.value = w / h;
        uniforms.uDpr.value = dpr;
      }
      resize();
      window.addEventListener('resize', resize);

      section.addEventListener('pointermove', function (e) {
        var r = section.getBoundingClientRect();
        uniforms.uPointer.value.set(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -(((e.clientY - r.top) / r.height) * 2 - 1)
        );
      });
      section.addEventListener('pointerleave', function () {
        uniforms.uPointer.value.set(0, -3);
      });

      canvas.classList.add('is-on');

      /* only draw while it is on screen */
      var visible = false;
      var running = false;
      var t0 = performance.now();

      function loop() {
        if (!visible) { running = false; return; }
        var t = (performance.now() - t0) / 1000;
        uniforms.uTime.value = t;
        uniforms.uIn.value = Math.min(1, t / 1.6);
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
      }

      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !running) { running = true; loop(); }
      }, { threshold: 0 }).observe(canvas);
    }
  })();

})();
