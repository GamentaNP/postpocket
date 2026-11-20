/*
 * PostPocket — shared utilities.
 * Pure helpers usable from content scripts, service workers and UI pages.
 */
(function (global) {
  'use strict';

  var FS_INVALID = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;

  function sanitizeSegment(input, maxLen) {
    maxLen = maxLen || 60;
    if (input === undefined || input === null) return 'unknown';
    var s = String(input)
      .replace(FS_INVALID, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+|\.+$/g, '')
      .trim();
    if (!s) return 'unknown';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)) s = '_' + s;
    if (s.length > maxLen) s = s.slice(0, maxLen).replace(/[\s\-_]+$/g, '');
    return s || 'unknown';
  }

  function pathSegment(input, maxLen) {
    return sanitizeSegment(String(input || '').replace(/\s+/g, '_'), maxLen);
  }

  function slug(input, maxLen) {
    maxLen = maxLen || 48;
    var s = String(input || '')
      .replace(/[^\p{L}\p{N}]+/gu, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    if (!s) return 'post';
    if (s.length > maxLen) s = s.slice(0, maxLen).replace(/_+$/g, '');
    return s || 'post';
  }

  function parseSrcset(srcset) {
    if (!srcset) return [];
    return String(srcset).split(',').map(function (part) {
      var bits = part.trim().split(/\s+/);
      var url = bits.shift() || '';
      var w = 0;
      bits.forEach(function (token) {
        var m = token.match(/^([\d.]+)(w|x)$/i);
        if (!m) return;
        var n = parseFloat(m[1]);
        if (!isNaN(n)) w = m[2].toLowerCase() === 'x' ? n * 1000 : n;
      });
      return { url: url, w: w };
    }).filter(function (x) { return x.url && /^https?:\/\//i.test(x.url); })
      .sort(function (a, b) { return b.w - a.w; });
  }

  function extFromUrl(url) {
    var u = String(url || '');
    var m = u.match(/stp=dst-([a-z0-9]+)/i);
    if (m) {
      var f = m[1].toLowerCase();
      if (f === 'jpeg') return 'jpg';
      if (['jpg', 'png', 'gif', 'webp', 'bmp'].indexOf(f) !== -1) return f;
    }
    m = u.match(/\.(jpe?g|png|gif|webp|bmp)(\?|$)/i);
    return m ? (m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()) : 'jpg';
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatDateFromUtime(utime) {
    var n = Number(utime);
    if (!n || isNaN(n)) return '';
    var d = new Date(n * 1000);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function shortId(id) {
    var s = String(id || '').replace(/[^0-9a-z]/gi, '').slice(-10);
    return s || 'na';
  }

  function hashShort(str) {
    var h = 5381, s = String(str || '');
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return (h >>> 0).toString(36).slice(0, 8);
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function formatBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 200);
    };
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function safeJsonParse(str, fallback) {
    try { return JSON.parse(str); } catch (e) { return fallback; }
  }

  /** Convert a Blob to a data URL. Works in service workers (no FileReader). */
  async function blobToDataUrl(blob) {
    var bytes = new Uint8Array(await blob.arrayBuffer());
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + btoa(binary);
  }

  function monthKey(dateStr) {
    return String(dateStr || '').slice(0, 7);
  }

  global.FBPUtils = {
    sanitizeSegment: sanitizeSegment,
    pathSegment: pathSegment,
    slug: slug,
    parseSrcset: parseSrcset,
    extFromUrl: extFromUrl,
    formatDateFromUtime: formatDateFromUtime,
    todayISO: todayISO,
    shortId: shortId,
    hashShort: hashShort,
    uid: uid,
    escapeHtml: escapeHtml,
    formatBytes: formatBytes,
    debounce: debounce,
    sleep: sleep,
    safeJsonParse: safeJsonParse,
    blobToDataUrl: blobToDataUrl,
    monthKey: monthKey
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
