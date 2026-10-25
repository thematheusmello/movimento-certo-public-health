(function () {
  'use strict';
  window.MC_READY = false;
  var C = window.MC_CONFIG || {};
  var API = C.apiBase || '/api';
  // Local preview (file:// or localhost): no network calls, the form only simulates success.
  var PREVIEW = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { params = { get: function () { return null; } }; }

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function show(el, on) { if (el) el.hidden = !on; }

  // 1. Text that comes from the config
  $all('[data-cfg]').forEach(function (el) {
    var v = C[el.getAttribute('data-cfg')];
    if (v !== undefined && v !== null && v !== '') el.textContent = String(v);
  });
  $all('[data-cfg-mail]').forEach(function (el) {
    var v = C[el.getAttribute('data-cfg-mail')];
    if (!v) return;
    el.setAttribute('href', 'mailto:' + v);
    if (el.textContent.indexOf('@') !== -1) el.textContent = v;
  });
  if (C.crefito) {
    var cl = $('#crefito-line');
    if (cl) { cl.textContent = 'Responsável técnico: Thiago Nishida, fisioterapeuta, ' + C.crefito + '.'; cl.hidden = false; }
  }
  if (C.founderPriceValue && document.getElementById('per-month')) {
    var pm = Math.ceil((Number(C.founderPriceValue) / 12) * 10) / 10;
    document.getElementById('per-month').textContent = 'R$ ' + pm.toFixed(2).replace('.', ',');
  }
  if (C.existingBuyersAreFounders === false) { show($('#faq-existing'), false); show($('#existing-note'), false); }

  // 2. Where the visitor came from (?src=yt-lombar). Only the link tag, never personal data.
  var source = 'site';
  try {
    var raw = (params.get('src') || params.get('utm_campaign') || params.get('utm_source') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    if (raw) { source = raw; try { sessionStorage.setItem('mc_src', raw); } catch (e) {} }
    else { try { source = sessionStorage.getItem('mc_src') || 'site'; } catch (e) {} }
  } catch (e) {}

  // 3. Founder plan: the server enforces the cutoff; the page also updates stale/cached CTAs.
  var end = Date.parse(C.founderDeadlineISO || '');
  var open = false;
  var checkoutHref = API + '/checkout?src=' + encodeURIComponent(source);
  function syncOffer() {
    var ended = (Number.isFinite(end) && Date.now() >= end) || params.get('encerrado') === '1';
    open = Number.isFinite(end) && !ended && (!!C.founderOpen || params.get('teste') === 'fundador');
    show($('#founder-open'), open);
    show($('#founder-closed'), !open);
    $all('#checkout-btn, [data-checkout-link]').forEach(function (a) {
      a.setAttribute('href', open ? checkoutHref : '#lista');
      if (!open) { a.removeAttribute('aria-disabled'); a.removeAttribute('data-label'); }
    });
    $all('[data-founder-cta]').forEach(function (a) {
      a.setAttribute('href', open ? '#fundador' : '#lista');
    });
    var tb = $('[data-founder-cta="topbar"]');
    if (tb) tb.textContent = open ? 'Ser fundador' : 'Entrar na lista';
    if (ended) {
      var closed = $('#founder-closed');
      var closedLink = closed && closed.querySelector('a');
      var closedNote = closed && closed.querySelector('.pay-note');
      if (closedLink) closedLink.textContent = 'Quero acompanhar o lançamento';
      if (closedNote) {
        closedNote.setAttribute('role', 'status');
        closedNote.textContent = 'A pré-venda encerrou. Quem comprou receberá o resultado e os próximos passos por e-mail.';
      }
      $all('[data-checkout-link], [data-founder-cta]').forEach(function (a) { a.textContent = 'Acompanhar o lançamento'; });
      if (tb) tb.textContent = 'Entrar na lista';
    }
    if (!open) { show($('#founder-progress'), false); show($('#upsell'), false); show($('#countdown'), false); }
  }
  syncOffer();
  if (params.get('erro') === 'checkout') show($('#checkout-error'), true);

  function busy(a) {
    a.setAttribute('aria-disabled', 'true');
    a.setAttribute('data-label', a.innerHTML);
    a.textContent = 'Abrindo o pagamento...';
  }
  $all('#checkout-btn, [data-checkout-link]').forEach(function (a) {
    a.addEventListener('click', function () { syncOffer(); if (open) busy(a); });
  });
  $all('[data-founder-cta]').forEach(function (a) { a.addEventListener('click', syncOffer); });
  // Coming back from Stripe with the browser's back button restores the page from cache: reset the buttons.
  window.addEventListener('pageshow', function () {
    $all('[data-label]').forEach(function (a) { a.innerHTML = a.getAttribute('data-label'); a.removeAttribute('data-label'); a.removeAttribute('aria-disabled'); });
    syncOffer();
  });

  // 4. Countdown to the end of the founder plan
  function tick() {
    syncOffer();
    var el = $('#countdown');
    var ms = end - Date.now();
    if (!open || !(ms > 0) || !el) { show(el, false); return; }
    var d = Math.floor(ms / 86400000);
    var h = Math.floor((ms % 86400000) / 3600000);
    $('#countdown-t').textContent = d >= 2 ? 'Faltam ' + d + ' dias para o fim do plano de fundador'
      : d === 1 ? 'Falta 1 dia para o fim do plano de fundador'
      : 'Faltam ' + Math.max(h, 1) + ' horas para o fim do plano de fundador';
    show(el, true);
  }
  tick();
  setInterval(tick, 60000);

  // 5. Live numbers (counts only)
  function showStats(s) {
    if (!s || !s.ok) return;
    var goal = Number(C.founderGoal) || 50;
    var f = Number(s.founders) || 0;
    if (open && f >= (Number(C.showFoundersFrom) || 10)) {
      $('#founder-count').textContent = f.toLocaleString('pt-BR');
      show($('#founder-progress'), true);
      requestAnimationFrame(function () { $('#founder-fill').style.width = Math.min(100, (f / goal) * 100) + '%'; });
      var n = String(f + 1);
      $('#member-n').textContent = 'Nº ' + (n.length < 3 ? ('00' + n).slice(-3) : n);
    }
    var w = Number(s.waitlist) || 0;
    if (w >= (Number(C.showWaitlistCountFrom) || 50)) {
      $('#waitlist-count').textContent = w.toLocaleString('pt-BR');
      show($('#count-line'), true);
    }
  }
  if (!PREVIEW) {
    fetch(API + '/stats', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(showStats)
      .catch(function () {});
  }

  // 6. Waitlist form
  var form = $('#waitlist-form'), msg = $('#form-msg'), btn = $('#submit-btn');
  var cond = $('#f-cond'), healthWrap = $('#health-wrap'), health = $('#f-health');
  var ERRORS = {
    invalid_name: ['Escreva o seu nome.', '#f-name'],
    invalid_email: ['Confira o seu e-mail.', '#f-email'],
    invalid_whatsapp: ['Confira o WhatsApp, com DDD.', '#f-wpp'],
    consent_required: ['Marque a autorização para receber os avisos.', '#f-consent'],
    health_consent_required: ['Para guardar onde dói, marque a autorização sobre a sua dor, ou escolha "Prefiro não dizer".', '#f-health']
  };
  function syncHealth() {
    var on = !!cond.value;
    healthWrap.hidden = !on;
    health.required = on;
    if (!on) health.checked = false;
  }
  cond.addEventListener('change', syncHealth);
  syncHealth();

  function fail(code, text) {
    var e = ERRORS[code];
    msg.textContent = text || (e ? e[0] : 'Confira os campos.');
    var el = e ? $(e[1]) : null;
    if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
  }
  $all('#waitlist-form input, #waitlist-form select').forEach(function (el) {
    el.addEventListener('input', function () { el.removeAttribute('aria-invalid'); msg.textContent = ''; });
    el.addEventListener('change', function () { el.removeAttribute('aria-invalid'); msg.textContent = ''; });
  });

  var firstName = '';
  function done() {
    syncOffer();
    form.hidden = true;
    $('#done-name').textContent = firstName ? firstName + ', você está' : 'Você está';
    show($('#preview-flag'), PREVIEW);
    show($('#upsell'), open);
    var d = $('#done');
    d.hidden = false;
    d.focus({ preventScroll: true });
    var card = d.closest('.form-card');
    if (card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    msg.textContent = '';
    var name = $('#f-name').value.trim().replace(/\s+/g, ' ');
    var email = $('#f-email').value.trim();
    var wpp = $('#f-wpp').value.trim();
    if (name.length < 2) return fail('invalid_name');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('invalid_email');
    if (wpp && wpp.replace(/\D/g, '').length < 10) return fail('invalid_whatsapp');
    if (!$('#f-consent').checked) return fail('consent_required');
    if (cond.value && !health.checked) return fail('health_consent_required');
    firstName = name.split(' ')[0];

    var payload = {
      name: name, email: email, whatsapp: wpp, condition: cond.value || null,
      consent_marketing: true, consent_health: !!(cond.value && health.checked),
      source: source, website: $('#f-site').value
    };
    btn.setAttribute('aria-disabled', 'true');
    btn.textContent = 'Enviando...';
    var reset = function () { btn.removeAttribute('aria-disabled'); btn.textContent = 'Entrar na lista'; };
    if (PREVIEW) { setTimeout(done, 400); return; }

    fetch(API + '/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.ok) return done();
        reset();
        var code = res.j && res.j.error;
        if (ERRORS[code]) return fail(code);
        fail(null, 'Não conseguimos salvar agora. Tente de novo em instantes.');
      })
      .catch(function () { reset(); fail(null, 'Sem conexão. Confira a internet e tente de novo.'); });
  });

  // 7. Share after signing up
  var shareUrl = (PREVIEW ? 'https://movimentocerto.app' : location.origin) + '/?src=indicacao';
  $('#share-wpp').setAttribute('href', 'https://wa.me/?text=' + encodeURIComponent(
    'Lembrei de você: o Movimento Certo é um app de exercícios guiados para a dor, com o fisioterapeuta Thiago Nishida. Dá para entrar na lista de espera aqui: ' + shareUrl));
  $('#copy-link').addEventListener('click', function () {
    var b = this, label = b.querySelector('span');
    var ok = function () { label.textContent = 'Link copiado'; setTimeout(function () { label.textContent = 'Copiar link'; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(ok, function () { window.prompt('Copie o link:', shareUrl); });
    } else { window.prompt('Copie o link:', shareUrl); }
  });

  // 8. "Contar onde dói" and similar links: jump to the form and focus the right field
  $all('[data-focus]').forEach(function (a) {
    a.addEventListener('click', function () {
      var id = a.getAttribute('data-focus');
      setTimeout(function () { var el = document.getElementById(id); if (el && !form.hidden) el.focus({ preventScroll: true }); }, 650);
    });
  });

  // 9. Top bar shadow, and the phone-width sticky buttons (hidden while the hero, the offer or the form are on screen)
  var topbar = $('#topbar');
  var onScroll = function () { topbar.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window) {
    var sticky = $('#sticky-cta');
    var seen = {};
    var update = function () {
      var hide = seen.hero || seen.founder || seen.list || seen.final;
      sticky.classList.toggle('show', !hide);
      sticky.setAttribute('aria-hidden', hide ? 'true' : 'false');
      $all('#sticky-cta a').forEach(function (a) { a.tabIndex = hide ? -1 : 0; });
    };
    [['hero', '.hero-ctas'], ['founder', '#price-card'], ['list', '#lista .form-card'], ['final', '.final']].forEach(function (pair) {
      var el = $(pair[1]);
      if (!el) return;
      new IntersectionObserver(function (es) { seen[pair[0]] = es[0].isIntersecting; update(); }).observe(el);
    });

  }

  // 10. Motion: blocks fade in as they arrive, numbers count up. Blocks that arrive together are staggered.
  // The observer can miss fast jumps (anchor links, smooth scroll), so a scroll check and two timers reveal
  // anything already on or above the screen. Nothing stays hidden.
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pending = $all('.reveal');

  function countUp(el) {
    var final = el.textContent;
    var m = final.match(/^(\D*)(\d+(?:,\d+)?)(.*)$/);
    if (!m || reduced) return;
    var target = parseFloat(m[2].replace(',', '.'));
    var dec = (m[2].split(',')[1] || '').length;
    var t0 = null, dur = 1300;
    var html = el instanceof HTMLElement;
    if (html) el.style.minWidth = el.getBoundingClientRect().width + 'px'; // no layout shift while the digits change
    function frame(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      var v = target * (1 - Math.pow(1 - k, 3));
      el.textContent = k < 1 ? m[1] + v.toFixed(dec).replace('.', ',') + m[3] : final;
      if (k < 1) requestAnimationFrame(frame);
      else if (html) el.style.minWidth = '';
    }
    requestAnimationFrame(frame);
  }
  function arrive(el, delay) {
    if (el.classList.contains('in')) return;
    if (delay) el.style.setProperty('--rd', delay + 'ms');
    el.classList.add('in');
    Array.prototype.forEach.call(el.querySelectorAll('[data-count]'), function (n) { setTimeout(function () { countUp(n); }, delay || 0); });
  }
  function sweep() {
    var vh = window.innerHeight || 800;
    pending = pending.filter(function (el) {
      if (el.classList.contains('in')) return false;
      if (el.getBoundingClientRect().top < vh * 0.96) { arrive(el, 0); return false; }
      return true;
    });
  }
  if (reduced || !('IntersectionObserver' in window)) {
    pending.forEach(function (el) { el.classList.add('in'); });
    pending = [];
  } else {
    var io = new IntersectionObserver(function (es) {
      var batch = es.filter(function (e) { return e.isIntersecting; }).map(function (e) { return e.target; });
      batch.forEach(function (el, i) { io.unobserve(el); arrive(el, Math.min(i, 4) * 90); });
      if (batch.length) pending = pending.filter(function (el) { return !el.classList.contains('in'); });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    pending.forEach(function (el) { io.observe(el); });
    var queued = false;
    window.addEventListener('scroll', function () {
      if (queued || !pending.length) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; sweep(); });
    }, { passive: true });
    window.addEventListener('load', function () { setTimeout(sweep, 1200); setTimeout(sweep, 4000); });
    window.addEventListener('beforeprint', function () { pending.forEach(function (el) { el.classList.add('in'); }); pending = []; });
  }
  // The hero numbers are on screen from the start
  $all('.hero [data-count]').forEach(function (n) { setTimeout(function () { countUp(n); }, 550); });
  var ringText = $('.phone-front .ring text');
  if (ringText && !reduced) setTimeout(function () { countUp(ringText); }, 1000);
  window.MC_READY = true;
})();
