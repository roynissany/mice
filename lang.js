/* HU / EN switch for the Balaton Park microsites.
 *
 * The English stays where it is, in the page. Hungarian lives in hu.js as a
 * table keyed by the English string itself, so a wording change in the HTML
 * never needs a key renamed: if a string has no Hungarian yet, the English
 * simply shows until the table catches up.
 *
 * Same rule as the gift shop: the visitor's browser language decides unless
 * they press HU or EN, and that press is remembered. A ?lang=hu or ?lang=en
 * on the URL wins over both, so an outreach link can land in one language.
 *
 * Labels that live in attributes (aria-label, title, placeholder) are swapped
 * too. A key may hold %n in place of a number, so one entry covers Slide 1,
 * Slide 2 and the rest.
 */
(function (global) {
  'use strict';

  var STORE = 'bpc-lang';
  var HU = global.BPC_HU || {};
  var FORMAT = { STRONG: 1, EM: 1, B: 1, I: 1, SUP: 1, SUB: 1, U: 1, SMALL: 1 };
  var INLINE = { STRONG: 1, EM: 1, B: 1, I: 1, SUP: 1, SUB: 1, U: 1, SMALL: 1, BR: 1, SPAN: 1, A: 1 };
  var SKIP = 'script,style,noscript,svg,.marquee-track,.langpick,[data-no-i18n]';
  var LETTER = /[A-Za-zÀ-ſ]/;

  var ATTRS = ['aria-label', 'title', 'placeholder'];

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  // A key may carry %n where a number sits, so "Slide 1" and "Slide 2" both
  // come off one entry.
  function lookup(en) {
    var k = norm(en), t = HU[k];
    if (t) return t;
    var m = k.match(/^(.*?)(\d+)(.*)$/);
    if (m) {
      var tpl = HU[m[1] + '%n' + m[3]];
      if (tpl) return tpl.replace('%n', m[2]);
    }
    return null;
  }

  // An element is translated whole only if everything inside it is inline
  // text furniture. Anything holding blocks is left alone and its loose text
  // is handled node by node, so a gallery or a button never gets rebuilt.
  function inlineOnly(el) {
    var all = el.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) if (!INLINE[all[i].tagName]) return false;
    return true;
  }

  var units = null, attrs = null;

  function collectAttrs() {
    var out = [];
    ATTRS.forEach(function (a) {
      document.querySelectorAll('[' + a + ']').forEach(function (el) {
        if (el.closest(SKIP)) return;
        var v = el.getAttribute(a);
        if (v && LETTER.test(v)) out.push({ el: el, attr: a, en: v });
      });
    });
    return out;
  }

  function collect() {
    var out = [], seen = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      if (!LETTER.test(n.nodeValue)) continue;
      var p = n.parentElement;
      if (!p || p.closest(SKIP)) continue;
      var u = p.closest('[data-edit]');
      if (!u) { u = p; while (FORMAT[u.tagName] && u.parentElement) u = u.parentElement; }
      if (inlineOnly(u)) {
        if (seen.indexOf(u) === -1) { seen.push(u); out.push({ el: u, en: u.innerHTML }); }
      } else {
        out.push({ node: n, en: n.nodeValue });
      }
    }
    return out;
  }

  var meta = null;

  function apply(lang) {
    if (!units) {
      units = collect();
      attrs = collectAttrs();
      var d = document.querySelector('meta[name="description"]');
      meta = { title: document.title, desc: d, descEn: d ? d.getAttribute('content') : '' };
    }
    var hu = lang === 'hu';
    units.forEach(function (u) {
      // data-hu on an element overrides the table, for the few places where
      // the same English needs different Hungarian depending on the sentence.
      var tr = hu ? ((u.el && u.el.getAttribute('data-hu')) || lookup(u.en)) : null;
      if (u.el) {
        u.el.innerHTML = tr || u.en;
      } else {
        // keep the node's own leading and trailing space
        var lead = u.en.match(/^\s*/)[0], tail = u.en.match(/\s*$/)[0];
        u.node.nodeValue = tr ? lead + tr + tail : u.en;
      }
    });
    attrs.forEach(function (a) {
      var tr = hu ? lookup(a.en) : null;
      a.el.setAttribute(a.attr, tr || a.en);
    });
    document.title = (hu && lookup(meta.title)) || meta.title;
    if (meta.desc) meta.desc.setAttribute('content', (hu && lookup(meta.descEn)) || meta.descEn);
    document.documentElement.lang = hu ? 'hu' : 'en';
    document.querySelectorAll('.langpick button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
    });
  }

  function saved() {
    try { return localStorage.getItem(STORE); } catch (e) { return null; }
  }
  // ?lang=hu or ?lang=en on the URL wins, and is remembered from then on.
  function fromQuery() {
    var m = /[?&]lang=(hu|en)(?![a-z])/i.exec(location.search);
    return m ? m[1].toLowerCase() : null;
  }

  function initial() {
    var q = fromQuery();
    if (q) {
      try { localStorage.setItem(STORE, q); } catch (e) {}
      return q;
    }
    var s = saved();
    if (s === 'hu' || s === 'en') return s;
    var nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    return nav.indexOf('hu') === 0 ? 'hu' : 'en';
  }

  var lang = initial();

  function set(next) {
    lang = next === 'hu' ? 'hu' : 'en';
    try { localStorage.setItem(STORE, lang); } catch (e) {}
    apply(lang);
  }

  // Same picker as the gift shop: HU first, the active one filled blue.
  var CSS =
    '.langpick{position:fixed;top:22px;right:40px;z-index:90;display:flex;gap:6px}' +
    '.langpick button{min-height:44px;min-width:52px;padding:0 14px;cursor:pointer;' +
      'background:rgba(10,20,34,.55);color:rgba(245,247,251,.72);' +
      'border:1px solid rgba(255,255,255,.28);border-radius:0;' +
      "font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:17px;letter-spacing:.08em;" +
      'transition:background .2s,color .2s,border-color .2s;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}' +
    '.langpick button:hover{color:#f5f7fb;border-color:rgba(255,255,255,.55)}' +
    '.langpick button[aria-pressed=true]{background:#427AB7;color:#fff;border-color:#427AB7}' +
    '@media(max-width:760px){.langpick{top:12px;right:14px}' +
      '.langpick button{min-height:38px;min-width:44px;padding:0 10px;font-size:15px}}';

  function mount() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    var host = document.createElement('div');
    host.className = 'langpick';
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Change language');
    host.innerHTML =
      '<button type="button" data-lang="hu">HU</button>' +
      '<button type="button" data-lang="en">EN</button>';
    host.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-lang]');
      if (b) set(b.getAttribute('data-lang'));
    });
    document.body.appendChild(host);
    apply(lang);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  // Used by the build check that lists what still has no Hungarian.
  global.BPC_LANG = {
    get lang() { return lang; },
    set: set,
    keys: function () {
      var k = (units || collect()).map(function (u) { return norm(u.en); });
      var d = document.querySelector('meta[name="description"]');
      k.push(norm(meta ? meta.title : document.title));
      if (d) k.push(norm(meta ? meta.descEn : d.getAttribute('content')));
      return k;
    }
  };
})(window);
