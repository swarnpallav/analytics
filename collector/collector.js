/*
 * NavAIgate collector. Add to any site:
 *   <script async src="https://YOUR-NAVAIGATE-HOST/collector.js"></script>
 *
 * Captures, with no other code changes:
 *   - page views (initial load + SPA navigations via history API)
 *   - GTM / gtag events pushed to window.dataLayer
 *   - Segment analytics.track / page / identify
 *   - Mixpanel mixpanel.track / identify
 * and sends them in batches to <script origin>/api/events.
 *
 * Optional attributes on the script tag:
 *   data-endpoint="https://host/api/events"  override where events go
 *   data-site="my-shop"                      label events (default: location.hostname)
 *   data-pageviews="false"                   disable automatic page views
 *   data-debug="true"                        log captured events to the console
 * Manual tracking: window.navaigate.track('signup_clicked', { plan: 'pro' })
 *
 * DevTools console mode: set window.NAVAIGATE_CONFIG = { endpoint, site, pageviews, debug } and paste
 * this file into the console. Config keys mirror the data-* attributes above.
 */
(function () {
  var config = window.NAVAIGATE_CONFIG || null;
  if (window.navaigate && window.navaigate.loaded) {
    if (config) console.log('[navaigate] already recording on this page');
    return;
  }

  var script = config ? null : (document.currentScript || document.querySelector('script[src*="collector.js"]'));
  var attr = function (name) {
    if (config) return config[name] == null ? null : String(config[name]);
    return script && script.getAttribute('data-' + name);
  };
  var origin = script && script.src ? new URL(script.src, location.href).origin : location.origin;
  var endpoint = attr('endpoint') || origin + '/api/events';
  var site = attr('site') || location.hostname;
  var debug = attr('debug') === 'true';

  var SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  var FLUSH_INTERVAL_MS = 2000;
  var DATALAYER_SCAN_MS = 250;
  var MAX_BATCH = 20;
  var WRAPPED = '__navaigateWrapped'; // marks vendor methods already wrapped

  // ---------- identity ----------

  var memory = {};
  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  function get(kind, key) {
    var s = store(kind);
    try { return s ? s.getItem(key) : memory[key]; } catch (e) { return memory[key]; }
  }
  function set(kind, key, value) {
    var s = store(kind);
    try { if (s) { s.setItem(key, value); return; } } catch (e) { /* storage blocked */ }
    memory[key] = value;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  var anonymousId = get('localStorage', 'nvg_aid');
  if (!anonymousId) { anonymousId = uuid(); set('localStorage', 'nvg_aid', anonymousId); }
  var userId = get('localStorage', 'nvg_uid') || '';

  // A session ends after 30 minutes of inactivity.
  function sessionId() {
    var now = Date.now();
    var id = get('localStorage', 'nvg_sid');
    var last = Number(get('localStorage', 'nvg_last') || 0);
    if (!id || now - last > SESSION_TIMEOUT_MS) { id = uuid(); set('localStorage', 'nvg_sid', id); }
    set('localStorage', 'nvg_last', String(now));
    return id;
  }

  function identify(id) {
    if (id == null || id === '') return;
    userId = String(id);
    set('localStorage', 'nvg_uid', userId);
  }

  // ---------- queue & transport ----------

  var queue = [];

  function safeProps(value) {
    // Drop functions, DOM nodes and cycles so the payload always serialises.
    var seen = [];
    try {
      return JSON.parse(JSON.stringify(value == null ? {} : value, function (k, v) {
        if (typeof v === 'function') return undefined;
        if (typeof Node !== 'undefined' && v instanceof Node) return undefined;
        if (v && typeof v === 'object') {
          if (seen.indexOf(v) !== -1) return undefined;
          seen.push(v);
        }
        return v;
      }));
    } catch (e) {
      return {};
    }
  }

  function capture(name, properties, source) {
    if (!name) return;
    var evt = {
      event: String(name),
      // Stable per browser, so a journey is not split when the visitor logs in mid-way.
      userId: anonymousId,
      identifiedUserId: userId || undefined,
      sessionId: sessionId(),
      timestamp: new Date().toISOString(),
      page: location.pathname,
      url: location.href,
      title: document.title,
      referrer: document.referrer,
      site: site,
      source: source,
      properties: safeProps(properties)
    };
    if (debug) console.log('[navaigate]', evt.event, evt);
    queue.push(evt);
    if (queue.length >= MAX_BATCH) flush();
  }

  // text/plain keeps the request CORS-simple (no preflight) and works with sendBeacon.
  function flush(useBeacon) {
    scanDataLayer();
    if (!queue.length) return;
    var body = JSON.stringify(queue.splice(0, queue.length));
    if (useBeacon && navigator.sendBeacon) {
      if (navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }))) return;
    }
    try {
      fetch(endpoint, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, mode: 'cors' })
        .catch(function () { /* network errors are ignored; analytics must never break the site */ });
    } catch (e) { /* fetch unavailable */ }
  }

  setInterval(flush, FLUSH_INTERVAL_MS);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', function () { flush(true); });

  // ---------- page views ----------

  if (attr('pageviews') !== 'false') {
    var lastPath = null;
    var pageView = function () {
      var path = location.pathname + location.search;
      if (path === lastPath) return;
      lastPath = path;
      capture('page_view', {}, 'pageview');
    };
    ['pushState', 'replaceState'].forEach(function (method) {
      var original = history[method];
      history[method] = function () {
        var result = original.apply(this, arguments);
        pageView(); // synchronous, so it precedes events fired on the new page
        return result;
      };
    });
    window.addEventListener('popstate', pageView);
    pageView();
  }

  // ---------- GTM / gtag dataLayer ----------

  function fromDataLayer(entry) {
    if (!entry || typeof entry !== 'object') return;
    // gtag('event', name, params) pushes an Arguments object.
    if (typeof entry.length === 'number' && entry[0] === 'event') {
      capture(entry[1], entry[2], 'gtag');
      return;
    }
    if (typeof entry.length === 'number') {
      if (entry[0] === 'set' && entry[1] && entry[1].user_id) identify(entry[1].user_id);
      return;
    }
    var name = entry.event;
    if (!name || /^gtm\./.test(name)) return; // GTM lifecycle noise
    var props = {};
    for (var k in entry) if (k !== 'event' && k.indexOf('gtm.') !== 0) props[k] = entry[k];
    if (props.user_id) identify(props.user_id);
    capture(name, props, 'dataLayer');
  }

  // Read new entries by position instead of wrapping push(): GTM replaces push() with its own
  // wrapper, and index-based scanning is immune to whoever wraps it and in what order.
  var scannedLayer = null;
  var scannedCount = 0;
  function scanDataLayer() {
    var dl = window.dataLayer;
    if (!dl || typeof dl.length !== 'number') return;
    if (dl !== scannedLayer) { scannedLayer = dl; scannedCount = 0; } // site reassigned window.dataLayer
    while (scannedCount < dl.length) fromDataLayer(dl[scannedCount++]);
  }

  // ---------- Segment & Mixpanel ----------
  // Their snippets install a queueing stub that the real library later replaces and replays into.
  // Only the real library is wrapped, so replayed calls are not counted twice.

  function wrap(obj, method, handler) {
    if (!obj || typeof obj[method] !== 'function' || obj[method][WRAPPED]) return;
    var original = obj[method];
    obj[method] = function () {
      try { handler.apply(null, arguments); } catch (e) { /* never break the host call */ }
      return original.apply(this, arguments);
    };
    obj[method][WRAPPED] = true;
  }

  function hookVendors() {
    var a = window.analytics;
    if (Array.isArray(a)) a = null; // Segment snippet stub
    wrap(a, 'track', function (name, props) { capture(name, props, 'segment'); });
    wrap(a, 'page', function (category, name, props) {
      if (typeof category === 'object') props = category;
      else if (typeof name === 'object') props = name;
      capture('segment_page', props, 'segment');
    });
    wrap(a, 'identify', function (id) { if (typeof id !== 'object') identify(id); });

    var mp = window.mixpanel;
    if (mp && !mp.__loaded) mp = null; // Mixpanel snippet stub
    wrap(mp, 'track', function (name, props) { capture(name, props, 'mixpanel'); });
    wrap(mp, 'identify', function (id) { identify(id); });
  }

  scanDataLayer();
  setInterval(scanDataLayer, DATALAYER_SCAN_MS);
  hookVendors();
  var checks = 0;
  var poll = setInterval(function () {
    hookVendors();
    if (++checks > 60) clearInterval(poll); // give async vendor libraries 30 seconds to load
  }, 500);

  window.navaigate = {
    loaded: true,
    track: function (name, props) { capture(name, props, 'manual'); },
    identify: identify,
    flush: flush
  };

  if (config) {
    console.log('[navaigate] recording events on ' + site + ' -> ' + endpoint +
      '. Recording stops on a full page reload; paste again to resume.');
  }
})();
