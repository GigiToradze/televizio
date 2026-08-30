/* ═══════════════════════════════════════════════════════════
   TELEVIZIO — main.js
   1 language   2 menu      3 hero       4 chrome (meter/nav/dock)
   5 reveals    6 counters  7 live guide 8 ticker
   9 product video          10 signal field (WebGL)
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

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

  /* ── 3. hero ──────────────────────────────────────────── */
  (function hero() {
    var section = document.getElementById('hero');
    var plate = document.getElementById('plate');
    var copy = document.getElementById('heroCopy');
    if (!section || !plate) return;

    if (!hasGSAP || reduced) {
      section.style.setProperty('--tvglow', '.74');
      return;
    }

    /* the set powers on: the room lifts out of the dark, then the copy lands */
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo(plate,
        { scale: 1.14, filter: 'brightness(.15) saturate(.4)' },
        { scale: 1, filter: 'brightness(1) saturate(1)', duration: 1.5 })
      .fromTo(section,
        { '--tvglow': 0 },
        { '--tvglow': 0.74, duration: 1.6 }, 0.2)
      .from('.hero__kick', { y: 14, opacity: 0, duration: 0.7 }, 0.55)
      .from('.hero__h1', {
        y: 26, opacity: 0, duration: 0.9,
        clipPath: 'inset(0% 0% 100% 0%)'
      }, 0.7)
      .from('.hero__lede', { y: 16, opacity: 0, duration: 0.7 }, 0.95)
      .from('.hero__cta > *', { y: 14, opacity: 0, duration: 0.6, stagger: 0.08 }, 1.05);

    /* and drifts away as the section leaves */
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
      '.sec__head > *', '.epg', '.stats > div', '.box__media', '.box__copy > *',
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

  /* ── 6. counters ──────────────────────────────────────── */
  (function counters() {
    var els = document.querySelectorAll('[data-count]');
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

  /* ── 8. the ticker answers to the scroll ──────────────── */
  (function ticker() {
    var row = document.querySelector('.ticker__row');
    if (!row || !hasGSAP || reduced) return;

    row.style.animation = 'none';           // GSAP takes the wheel
    var tape = gsap.to(row, { xPercent: -50, duration: 58, ease: 'none', repeat: -1 });
    var settle;

    /* scrolling drags the tape along with you, then it settles back */
    ScrollTrigger.create({
      onUpdate: function (self) {
        var v = Math.abs(gsap.utils.clamp(-6, 6, self.getVelocity() / 320));
        tape.timeScale(1 + v);
        clearTimeout(settle);
        settle = setTimeout(function () {
          gsap.to(tape, { timeScale: 1, duration: 1.2, ease: 'power2.out' });
        }, 140);
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

  /* ── 10. the signal field ─────────────────────────────── */
  (function signalField() {
    var canvas = document.getElementById('field');
    if (!canvas || reduced) return;
    if (!('IntersectionObserver' in window)) return;

    /* three.js is ~188 KB gzipped — it only loads if you scroll this far */
    var armed = false;
    var watcher = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || armed) return;
      armed = true;
      watcher.disconnect();
      var url = HERE ? new URL('vendor/three.module.min.js', HERE).href
                     : 'assets/js/vendor/three.module.min.js';
      import(url).then(start).catch(function () {});
    }, { rootMargin: '500px' });
    watcher.observe(canvas);

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
        ].join('\n'),
        fragmentShader: [
          'varying float vI;',
          'void main(){',
          '  float m = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));',
          '  if (m * vI < 0.01) discard;',
          '  gl_FragColor = vec4(0.894, 0.129, 0.110, m * vI);',
          '}'
        ].join('\n')
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
