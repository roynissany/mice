/* Balaton Park microsites - visit statistics.
 *
 * Records one row per page view: where the visitor came from, how long the
 * page was actually on screen, how far they scrolled and whether they used
 * the contact button, plus their city and the kind of device. No cookie, no IP
 * address and no visitor id is stored, so two visits by the same person are
 * simply two rows. The city comes from an IP lookup made in the visitor's own
 * browser (the same service the client hub uses); only the city and country
 * are sent on.
 *
 * Tag a link to name its source:  https://mice.balatonpark.com/?s=li
 * Stop counting this device:      add ?notrack=1 once  (undo with ?notrack=0)
 */
(function () {
  'use strict';
  var me = document.currentScript;
  var SITE = me && me.getAttribute('data-site');
  if (!SITE) return;

  var API = 'https://hbosxvmprhzrheilwwfv.supabase.co/rest/v1/rpc/';
  var KEY = 'sb_publishable_Vkz4kA1P_VlVr-NaxD-nDA_gL-xxBtm';
  var q = new URLSearchParams(location.search);

  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { /* private mode */ }
    return null;
  }

  if (q.get('notrack') === '1') store('bpc-notrack', '1');
  if (q.get('notrack') === '0') store('bpc-notrack', null);
  if (store('bpc-notrack') === '1') return;

  var live = /(^|\.)balatonpark\.com$/.test(location.hostname);
  if (!live && store('bpc-tracktest') !== '1') return;
  if (navigator.webdriver) return;
  if (/bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp|telegram/i.test(navigator.userAgent)) return;

  // ---- where did they come from
  var NAMES = { li: 'linkedin', lnkd: 'linkedin', in: 'linkedin', fb: 'facebook', ig: 'instagram', wa: 'whatsapp', em: 'email', mail: 'email' };
  function source() {
    var tag = (q.get('s') || q.get('src') || q.get('utm_source') || '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (tag) return NAMES[tag] || tag;
    var host = '';
    try { host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) {}
    if (!host || host === location.hostname) return 'direct';
    if (/linkedin\.|lnkd\.in/.test(host)) return 'linkedin';
    if (/(^|\.)google\./.test(host)) return 'google';
    if (/(^|\.)bing\.com$/.test(host)) return 'bing';
    if (/facebook\.com$|fb\.com$/.test(host)) return 'facebook';
    if (/instagram\.com$/.test(host)) return 'instagram';
    if (/^t\.co$|twitter\.com$|x\.com$/.test(host)) return 'x';
    return host;
  }

  function call(fn, body, last) {
    return fetch(API + fn, {
      method: 'POST',
      keepalive: !!last,
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
      body: JSON.stringify(body)
    });
  }

  var sections = Array.prototype.slice.call(document.querySelectorAll('section'));
  var id = null, sent = '', active = 0, since = document.visibilityState === 'visible' ? Date.now() : 0;
  var scroll = 0, deepest = sections.length ? 1 : 0, cta = false;

  function seconds() { return Math.round((active + (since ? Date.now() - since : 0)) / 1000); }

  function measure() {
    var el = document.scrollingElement || document.documentElement;
    var room = el.scrollHeight - el.clientHeight;
    var pct = room > 0 ? Math.round(el.scrollTop / room * 100) : 100;
    if (pct > scroll) scroll = Math.min(pct, 100);
    var mid = el.scrollTop + el.clientHeight / 2;
    for (var i = sections.length - 1; i >= 0; i--) {
      if (sections[i].offsetTop <= mid) { if (i + 1 > deepest) deepest = i + 1; break; }
    }
  }

  function push(last) {
    if (!id) return;
    measure();
    var body = { p_id: id, p_duration: seconds(), p_scroll: scroll, p_section: deepest, p_cta: cta };
    var sig = JSON.stringify(body);
    if (sig === sent) return;
    sent = sig;
    call('web_visit_update', body, last).catch(function () {});
  }

  var tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}

  // ---- what they are on, and roughly where
  function os() {
    var u = navigator.userAgent;
    if (/iPhone|iPod/.test(u)) return 'iPhone';
    if (/iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/Android/.test(u)) return 'Android';
    if (/Windows/.test(u)) return 'Windows';
    if (/Macintosh|Mac OS X/.test(u)) return 'Mac';
    if (/CrOS/.test(u)) return 'ChromeOS';
    if (/Linux/.test(u)) return 'Linux';
    return '';
  }
  function browser() {
    var u = navigator.userAgent;
    if (/Edg(e|A|iOS)?\//.test(u)) return 'Edge';
    if (/OPR\/|Opera/.test(u)) return 'Opera';
    if (/SamsungBrowser/.test(u)) return 'Samsung Internet';
    if (/FxiOS|Firefox\//.test(u)) return 'Firefox';
    if (/CriOS|Chrome\//.test(u)) return 'Chrome';
    if (/Safari\//.test(u)) return 'Safari';
    return '';
  }
  var place = new Promise(function (done) {
    var t = setTimeout(function () { done({}); }, 4000);
    fetch('https://ipapi.co/json/').then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (g) { clearTimeout(t); done(g && !g.error ? g : {}); })
      .catch(function () { clearTimeout(t); done({}); });
  });
  function detail() {
    place.then(function (g) {
      call('web_visit_detail', { p_id: id, p_city: g.city || '', p_country: g.country_name || '', p_os: os(), p_browser: browser() }).catch(function () {});
    });
  }

  call('web_visit_start', {
    p_site: SITE,
    p_source: source(),
    p_lang: (document.documentElement.lang || 'en').slice(0, 2),
    p_device: (window.matchMedia && matchMedia('(max-width: 820px), (pointer: coarse)').matches) ? 'mobile' : 'desktop',
    p_tz: tz,
    p_sections: sections.length
  }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
    if (typeof v !== 'string') return;
    id = v;
    detail();
    setTimeout(push, 5000);
    setInterval(function () { if (document.visibilityState === 'visible') push(); }, 15000);
  }).catch(function () {});

  var ticking = false;
  addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    setTimeout(function () { ticking = false; measure(); }, 250);
  }, { passive: true });

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href^="mailto:"], a[href^="tel:"], a[href*="wa.me"]');
    if (a) { cta = true; push(true); }
  }, true);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (since) { active += Date.now() - since; since = 0; }
      push(true);
    } else if (!since) {
      since = Date.now();
    }
  });
  addEventListener('pagehide', function () { push(true); });
})();
