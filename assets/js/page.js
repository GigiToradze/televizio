/* ═══════════════════════════════════════════════════════════
   TELEVIZIO — page.js
   The chrome every plain page needs: language and the mobile menu.

   The legal pages carry no animation, so they load this instead of
   main.js — which drags in GSAP, a WebGL field and a scroll-driven
   guide that a page of running text has no use for.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ── 1. language ──────────────────────────────────────── */
  (function language() {
    var toggle = document.getElementById('lang');
    var stored = null;
    try { stored = localStorage.getItem('televizio-lang'); } catch (e) {}

    function apply(lang) {
      root.setAttribute('lang', lang);
      root.setAttribute('data-lang', lang);
      if (toggle) {
        toggle.setAttribute('aria-label',
          lang === 'ka' ? 'Switch to English' : 'ქართულად გადართვა');
      }
      try { localStorage.setItem('televizio-lang', lang); } catch (e) {}
    }

    if (stored === 'en' || stored === 'ka') apply(stored);

    if (toggle) {
      toggle.addEventListener('click', function () {
        apply(root.getAttribute('data-lang') === 'ka' ? 'en' : 'ka');
      });
    }
  })();

  /* ── 2. mobile menu ───────────────────────────────────── */
  (function menu() {
    var burger = document.getElementById('burger');
    var panel = document.getElementById('menu');
    if (!burger || !panel) return;

    burger.addEventListener('click', function () {
      var open = panel.hidden;
      panel.hidden = !open;
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('is-locked', open);
    });

    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        panel.hidden = true;
        burger.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('is-locked');
      }
    });
  })();
})();
