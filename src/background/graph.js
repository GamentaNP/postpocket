/*
 * PostPocket — Meta Graph API connector.
 * Uses the user's normal browser session (credentials: 'include'); no OAuth,
 * no tokens, no signup. Still subject to Meta's policies around data access.
 */
(function (global) {
  'use strict';

  var BASE = 'https://graph.facebook.com';

  async function get(path, params) {
    var p = String(path || '').replace(/^\/+/, '');
    if (!p) throw new Error('No Graph API path given');
    var q = Object.keys(params || {})
      .filter(function (k) { return params[k] !== undefined && params[k] !== '' && params[k] !== null; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
    var url = BASE + '/' + p + (q ? '?' + q : '');
    var res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    var body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) {
      var msg = (body && body.error && body.error.message) || ('Graph API HTTP ' + res.status);
      throw new Error(msg);
    }
    return body || {};
  }

  /** Accepts Graph API shapes like { data: [ { picture, name }, ... ] } or { items: [...] }. */
  function extractImages(data) {
    var out = [];
    var lists = ['data', 'items', 'photos', 'videos'];
    var arr = null;
    for (var i = 0; i < lists.length && !arr; i++) {
      if (data && Array.isArray(data[lists[i]])) arr = data[lists[i]];
    }
    if (!arr && data && Array.isArray(data)) arr = data;
    if (arr) arr.forEach(function (item) {
      if (!item || !item.picture) return;
      var url = item.picture;
      if (!/^https?:/i.test(url)) return;
      out.push({
        url: url,
        alternates: [],
        ext: 'jpg',
        sourceUrl: item.source_url || item.link || ''
      });
    });
    return out;
  }

  async function load(path, params) {
    var body = await get(path, params);
    var images = extractImages(body);
    return { ok: true, images: images, count: (body && body.length) || 0 };
  }

  global.PPGraph = { BASE: BASE, get: get, extractImages: extractImages, load: load };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
