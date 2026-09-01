/* ═══════════════════════════════════════════════════════════
   TELEVIZIO — lookup.js
   The subscriber lookup: language, menu, and the form itself.

   Deliberately does not load main.js. That file carries GSAP, a WebGL
   field and a scroll-driven guide, none of which a form needs; the two
   modules this page actually wants are small enough to repeat.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* The project URL and publishable key are public by design — they ship
     inside this file to every visitor. They are safe here because row level
     security denies anon every table; the lookup itself runs server-side
     with a key that never leaves Supabase. */
  var API = 'https://krwisemsvmwpvunnsnwp.supabase.co';
  var KEY = 'sb_publishable_PUbcv-rydmq6yjgrejYUyA_-swvdXcM';

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

  /* ── 3. the lookup ────────────────────────────────────── */
  (function lookup() {
    var form = document.getElementById('lkForm');
    if (!form) return;

    var no = document.getElementById('lkNo');
    var pin = document.getElementById('lkPin');
    var go = document.getElementById('lkGo');
    var msg = document.getElementById('lkMsg');
    var card = document.getElementById('lkCard');

    /* Every message exists in both languages, the same way every other
       string on the site does: two spans, and the CSS shows one. */
    var SAY = {
      nomatch: ['ნომერი ან ბოლო ოთხი ციფრი არ ემთხვევა. შეამოწმე და სცადე თავიდან.',
                'That number and those four digits do not match. Check them and try again.'],
      toomany: ['ძალიან ბევრი მცდელობა. სცადე რამდენიმე წუთში.',
                'Too many attempts. Try again in a few minutes.'],
      offline: ['კავშირი ვერ დამყარდა. შეამოწმე ინტერნეტი და სცადე თავიდან.',
                'Could not reach the server. Check your connection and try again.'],
      short:   ['შეავსე ორივე ველი: ნომერი და ბოლო ოთხი ციფრი.',
                'Fill in both fields: your number and the last four digits.'],
      working: ['მოწმდება…', 'Checking…']
    };

    function pair(ka, en) {
      return '<span class="ka">' + ka + '</span><span class="en">' + en + '</span>';
    }

    function say(which, tone) {
      msg.className = 'lk__msg' + (tone ? ' lk__msg--' + tone : '');
      msg.innerHTML = pair(SAY[which][0], SAY[which][1]);
      msg.hidden = false;
    }

    function clear() {
      msg.hidden = true;
      card.hidden = true;
    }

    /* Digits only, and never more than four — the field is a PIN, not a
       phone number, even when someone pastes a whole one in. */
    pin.addEventListener('input', function () {
      pin.value = pin.value.replace(/\D/g, '').slice(-4);
    });

    function show(data) {
      document.getElementById('lkOutNo').textContent = data.subscriber_no;

      var plan = document.getElementById('lkOutPlan');
      if (data.plan_name_ka) {
        plan.innerHTML = pair(data.plan_name_ka, data.plan_name_en || data.plan_name_ka);
      } else {
        plan.innerHTML = pair('პაკეტი არ არის', 'No plan yet');
      }

      document.getElementById('lkOutDue').textContent = data.due_on || '—';

      var left = document.getElementById('lkOutLeft');
      if (data.days_left === null || data.days_left === undefined) {
        left.textContent = '—';
      } else if (data.days_left < 0) {
        left.innerHTML = pair(
          'ვადა გავიდა ' + Math.abs(data.days_left) + ' დღის წინ',
          Math.abs(data.days_left) + ' days overdue');
      } else {
        left.innerHTML = pair(data.days_left + ' დღე', data.days_left + ' days');
      }

      document.getElementById('lkOutDev').textContent =
        data.device_count === null || data.device_count === undefined
          ? '—' : String(data.device_count);

      var state = document.getElementById('lkOutState');
      var overdue = typeof data.days_left === 'number' && data.days_left < 0;
      var soon = typeof data.days_left === 'number'
        && data.days_left >= 0 && data.days_left <= 7;

      state.className = 'lk__state'
        + (data.account_status !== 'active' || overdue ? ' is-bad'
           : soon ? ' is-soon' : ' is-ok');

      if (data.account_status === 'suspended') {
        state.innerHTML = pair('ანგარიში შეჩერებულია — დაგვირეკე.',
                               'This account is suspended — please call us.');
      } else if (data.status === 'none') {
        state.innerHTML = pair('აქტიური გამოწერა არ არის.',
                               'No active subscription on this account.');
      } else if (overdue) {
        state.innerHTML = pair('გამოწერის ვადა გასულია.',
                               'This subscription is past its due date.');
      } else if (soon) {
        state.innerHTML = pair('ვადა მალე იწურება.', 'Renewal is due soon.');
      } else {
        state.innerHTML = pair('გამოწერა აქტიურია.', 'This subscription is active.');
      }

      card.hidden = false;
      msg.hidden = true;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clear();

      var number = no.value.trim();
      var digits = pin.value.replace(/\D/g, '');
      if (!number || digits.length !== 4) { say('short'); return; }

      go.disabled = true;
      say('working');

      fetch(API + '/functions/v1/lookup', {
        method: 'POST',
        headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriber_no: number, phone_last4: digits })
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; })
            .then(function (body) { return { status: res.status, body: body }; });
        })
        .then(function (r) {
          if (r.status === 200) { show(r.body); return; }
          if (r.status === 429) { say('toomany', 'bad'); return; }
          say('nomatch', 'bad');
        })
        .catch(function () { say('offline', 'bad'); })
        .then(function () { go.disabled = false; });
    });
  })();
})();
