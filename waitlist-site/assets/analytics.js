(function () {
  'use strict';
  const id = window.MC_CONFIG?.analyticsMeasurementId;
  const query = new URLSearchParams(location.search);
  if (!/^G-[A-Z0-9]{6,24}$/.test(id || '') || location.origin !== 'https://movimentocerto.app'
      || location.pathname !== '/' || query.has('teste')) return;

  const panel = document.getElementById('analytics-consent');
  const allow = document.getElementById('analytics-allow');
  const deny = document.getElementById('analytics-deny');
  const settings = document.getElementById('analytics-settings');
  if (!panel || !allow || !deny || !settings) return;

  const choiceKey = 'mc.analytics.v1';
  const disabledKey = 'ga-disable-' + id;
  const cookiePrefix = 'mc_stats';
  const channels = {
    youtube: ['video', 'https://www.youtube.com/'],
    instagram: ['social', 'https://www.instagram.com/'],
    facebook: ['social', 'https://www.facebook.com/'],
    whatsapp: ['social', 'https://www.whatsapp.com/'],
    thiago: ['referral', 'https://thiagonishida.com.br/'],
  };
  const label = (query.get('src') || query.get('utm_source') || '').toLowerCase();
  let referrer = '';
  try { referrer = new URL(document.referrer).hostname.toLowerCase(); } catch (_) {}
  const matches = (host, domain) => host === domain || host.endsWith('.' + domain);
  const channel = /^(yt|youtube)(-|$)/.test(label) ? 'youtube'
    : /^(ig|instagram)(-|$)/.test(label) ? 'instagram'
    : /^(wpp|whatsapp)(-|$)/.test(label) ? 'whatsapp'
    : /^(fb|facebook)(-|$)/.test(label) ? 'facebook'
    : label === 'site-thiago' ? 'thiago'
    : Object.keys(channels).find((name) => {
      const domain = new URL(channels[name][1]).hostname.replace(/^www\./, '');
      return matches(referrer, domain) || (name === 'youtube' && matches(referrer, 'youtu.be'));
    });
  const page = {
    page_location: location.origin + '/',
    page_title: 'Movimento Certo',
    page_referrer: channel ? channels[channel][1] : '',
  };
  if (channel) {
    page.campaign_source = channel;
    page.campaign_medium = channels[channel][0];
    page.campaign_name = 'pre_venda';
  }
  let loaded = false;
  let accepted = false;

  function choice() {
    try { return localStorage.getItem(choiceKey); } catch (_) { return null; }
  }

  function event(name, options) {
    if (accepted) gtag('event', name, { send_to: id, ...page, ...options });
  }

  function checkoutClick(navigate) {
    if (!accepted) return false;
    if (!navigate) {
      event('checkout_click');
      return false;
    }
    let finished = false;
    function proceed() {
      if (finished) return;
      finished = true;
      clearTimeout(fallback);
      navigate();
    }
    const fallback = setTimeout(proceed, 500);
    event('checkout_click', { event_callback: proceed, event_timeout: 500 });
    return true;
  }

  function gtag() {
    window.dataLayer.push(arguments);
  }

  function start() {
    accepted = true;
    window[disabledKey] = false;
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    });
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', id, {
      ...page,
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_prefix: cookiePrefix,
      cookie_domain: 'none',
      cookie_flags: 'SameSite=Lax;Secure',
      cookie_expires: 15552000,
      cookie_update: false,
    });
    event('page_view');
    const tag = document.createElement('script');
    tag.async = true;
    tag.referrerPolicy = 'no-referrer';
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.append(tag);
  }

  function stop() {
    accepted = false;
    window[disabledKey] = true;
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (name.startsWith(cookiePrefix + '_')) {
        document.cookie = name + '=; Max-Age=0; Path=/; Secure; SameSite=Lax';
      }
    }
  }

  function choose(value) {
    try { localStorage.setItem(choiceKey, value); } catch (_) {}
    if (value === 'yes') start();
    else stop();
    const restoreFocus = panel.dataset.openedFromSettings === 'true';
    delete panel.dataset.openedFromSettings;
    panel.hidden = true;
    if (restoreFocus) settings.focus();
  }

  function sync() {
    const value = choice();
    if (value === 'yes') start();
    else stop();
    panel.hidden = value === 'yes' || value === 'no';
  }

  allow.addEventListener('click', () => choose('yes'));
  deny.addEventListener('click', () => choose('no'));
  settings.addEventListener('click', (click) => {
    click.preventDefault();
    panel.dataset.openedFromSettings = 'true';
    panel.hidden = false;
    allow.focus();
  });
  window.addEventListener('storage', (change) => {
    if (change.key === choiceKey || change.key === null) sync();
  });
  window.addEventListener('pageshow', (show) => { if (show.persisted) sync(); });
  settings.hidden = false;
  window.MC_ANALYTICS = { checkoutClick };
  sync();
}());
