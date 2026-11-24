/*
 * PostPocket — Facebook post scanner.
 * Reads only the DOM the user is already viewing. No crawling, no API calls,
 * no credential access. Every step has fallbacks because Facebook's markup
 * changes frequently.
 */
(function (global) {
  'use strict';
  var U = global.FBPUtils;

  var POST_SELECTORS = [
    '[data-testid="post"]',
    '[data-testid="fb-user-content"]',
    '.userContentWrapper',
    '[data-pagelet^="FeedUnit"]',
    '[data-testid^="post"]',
    'div[role="article"]',
    '._5jmm',
    '._5pcr'
  ];

  var NON_SOURCE_PATHS = /^\/(home|settings|watch|reels?|photo|photos|groups|pages|pg|marketplace|games|events|notes|help|privacy|policies)(\/|$)/i;

  function stripNested(found) {
    return found.filter(function (n) {
      return !found.some(function (other) { return other !== n && other.contains(n); });
    });
  }

  function findPostContainers(doc) {
    var found = [], seen = new Set();

    // Modern Facebook hides posts behind obfuscated classes and no longer
    // puts data-testid/role on the post wrapper. The per-post actions button
    // is the most reliable stable anchor: walk up to the first ancestor that
    // actually contains media.
    var actions = [];
    try { actions = Array.prototype.slice.call(doc.querySelectorAll('[aria-label*="Actions for this post"]')); } catch (e) {}
    actions.forEach(function (btn) {
      var node = btn;
      for (var i = 0; i < 10 && node.parentElement; i++) {
        node = node.parentElement;
        if (node.querySelectorAll('img, video').length >= 1) {
          if (!seen.has(node)) { seen.add(node); found.push(node); }
          break;
        }
      }
    });
    if (found.length) return stripNested(found);

    POST_SELECTORS.forEach(function (sel) {
      var nodes;
      try { nodes = doc.querySelectorAll(sel); } catch (e) { return; }
      Array.prototype.forEach.call(nodes, function (n) {
        if (!seen.has(n)) { seen.add(n); found.push(n); }
      });
    });
    if (!found.length) {
      var times = [];
      try { times = Array.prototype.slice.call(doc.querySelectorAll('abbr[data-utime], time[datetime]')); } catch (e) {}
      times.forEach(function (t) {
        var node = t;
        for (var i = 0; i < 8 && node.parentElement; i++) {
          node = node.parentElement;
          if (node.querySelectorAll('img').length >= 1) { found.push(node); break; }
        }
      });
    }
    return stripNested(found);
  }

  function getPostIdFromUrl(url) {
    var u = String(url || '');
    var patterns = [
      /\/posts\/(\d+)/, /story_fbid=(\d+)/, /[?&]fbid=(\d+)/,
      /\/photos\/[^/]*?-?(\d+)\/?(?:\?|$)/, /photo\.php\?[^#]*?fbid=(\d+)/
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = u.match(patterns[i]);
      if (m) return m[1];
    }
    return '';
  }

  function extractPostIdFromDOM(post) {
    if (!post) return '';
    var html = '';
    try { html = post.outerHTML || ''; } catch (e) { html = post.innerHTML || ''; }
    var m = html.match(/\/posts\/(\d+)/) || html.match(/story_fbid=(\d+)/) || html.match(/fbid=(\d+)/);
    if (m) return m[1];
    m = (post.id || '').match(/(\d{8,})/);
    return m ? m[1] : '';
  }

  function choosePost(doc, url, viewport) {
    var containers = findPostContainers(doc);
    if (!containers.length) return null;
    var postId = getPostIdFromUrl(url);
    if (postId) {
      var exact = containers.find(function (c) {
        try { return c.outerHTML.indexOf(postId) !== -1; } catch (e) { return false; }
      });
      if (exact) return exact;
    }
    var vh = (viewport && viewport.h) || doc.documentElement.clientHeight;
    var vw = (viewport && viewport.w) || doc.documentElement.clientWidth;
    var best = null, bestScore = -Infinity;
    containers.forEach(function (c) {
      var r = c.getBoundingClientRect();
      var visibleH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      var visibleW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      if (visibleH <= 0 || visibleW <= 0) return;
      var score = visibleH * visibleW - Math.max(0, r.top) * 500;
      if (score > bestScore) { bestScore = score; best = c; }
    });
    return best || containers[0];
  }

  function detectSource(doc, url, post) {
    var type = 'Other';
    var m = String(url || '').match(/\/groups\/(\d+)/);
    var path = '';
    try { path = new URL(url).pathname; } catch (e) {}
    if (m || /\/groups\//i.test(path)) type = 'Group';
    else if (/\/pages\/|\/pg\//i.test(path)) type = 'Page';
    else if (/profile\.php/i.test(path)) type = 'Profile';
    else {
      var seg = path.split('/').filter(Boolean)[0] || '';
      if (seg && !NON_SOURCE_PATHS.test('/' + seg)) type = 'Profile';
    }
    var scope = post || doc;
    var links = [];
    try { links = Array.prototype.slice.call(scope.querySelectorAll('a[href]')); } catch (e) {}
    var candidates = [];
    links.forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var text = (a.innerText || a.textContent || '').trim();
      if (!text || text.length > 80) return;
      var t = '';
      if (/\/groups\/\d+/.test(href)) t = 'Group';
      else if (/\/pages\/|\/pg\//i.test(href)) t = 'Page';
      else if (/profile\.php\?id=/.test(href)) t = 'Profile';
      else if (/^\/[A-Za-z0-9._-]+\/?(?:\?|$)/.test(href) && !NON_SOURCE_PATHS.test(href)) t = 'Profile';
      if (t) candidates.push({ t: t, text: text, href: href });
    });
    var hit = candidates.find(function (c) { return c.t === type; }) || candidates[0];
    if (hit) type = hit.t;
    var name = hit ? hit.text : '';
    if (!name) {
      var parts = (doc.title || '').split('|').map(function (s) { return s.trim(); })
        .filter(function (s) { return s && !/facebook/i.test(s); });
      if (parts.length) name = parts[parts.length - 1];
    }
    return { sourceType: type, sourceName: name || 'Unknown' };
  }

  function extractAuthor(doc, post) {
    var scope = post || doc;
    // Most reliable on modern Facebook: "Actions for this post by <name>".
    var action = scope.querySelector ? scope.querySelector('[aria-label*="Actions for this post by"]') : null;
    if (action) {
      var m = (action.getAttribute('aria-label') || '').match(/by\s+(.+)$/i);
      if (m && m[1].trim()) return m[1].trim().slice(0, 60);
    }
    var links = [];
    try { links = Array.prototype.slice.call(scope.querySelectorAll('a[role="link"], a[tabindex="0"]')); } catch (e) {}
    var profileLinks = links.filter(function (a) {
      var h = a.getAttribute('href') || '';
      return /profile\.php|^\/[A-Za-z0-9._-]+\/?(?:\?|$)/.test(h) && !NON_SOURCE_PATHS.test(h);
    });
    var pool = profileLinks.length ? profileLinks : links;
    for (var i = 0; i < pool.length; i++) {
      var t = (pool[i].innerText || pool[i].textContent || '').trim();
      if (t && t.length <= 60 && !/facebook/i.test(t)) return t;
    }
    var strong = scope.querySelector('h3, strong');
    return strong ? (strong.innerText || strong.textContent || '').trim().slice(0, 60) : '';
  }

  function extractDate(scope) {
    if (!scope) return U.todayISO();
    var abbr = scope.querySelector('abbr[data-utime], abbr[title]');
    if (abbr) {
      var utime = abbr.getAttribute('data-utime');
      if (utime) return U.formatDateFromUtime(utime);
      var parsed = Date.parse(abbr.getAttribute('title') || '');
      if (!isNaN(parsed)) return U.formatDateFromUtime(parsed / 1000);
    }
    var timed = scope.querySelector('[data-utime]');
    return timed ? U.formatDateFromUtime(timed.getAttribute('data-utime')) : U.todayISO();
  }

  function extractText(scope) {
    if (!scope) return '';
    var candidates = [];
    try {
      candidates = Array.prototype.slice.call(
        scope.querySelectorAll('[data-testid="post_message"], .userContent, div[dir="auto"]')
      );
    } catch (e) {}
    var best = '';
    candidates.forEach(function (el) {
      var t = (el.innerText || el.textContent || '').trim();
      if (t.length > best.length && t.length < 4000) best = t;
    });
    return best.slice(0, 4000);
  }

  function isContentPhoto(img, fbcdn, rect, naturalW, naturalH) {
    var a = img.closest ? img.closest('a[href]') : null;
    var href = a ? (a.getAttribute('href') || '') : '';
    var contentLink = /photo\.php|photos?\/|fbid=/i.test(href);
    if (contentLink && fbcdn) return true;
    var inChrome = img.closest('button, [role="button"], [data-testid*="avatar"], [class*="avatar"], [aria-label*="Like"], [aria-label*="Comment"], [aria-label*="Reaction"]');
    if (inChrome && !contentLink) return false;
    var rendered = Math.max(rect.width, rect.height);
    if (rendered > 0 && rendered < 90 && !contentLink) return false;
    if (!fbcdn && (naturalW < 180 || naturalH < 180)) return false;
    return true;
  }

  function extractImages(post) {
    if (!post) return [];
    var imgs = [];
    try { imgs = Array.prototype.slice.call(post.querySelectorAll('img')); } catch (e) {}
    var out = [], seen = new Set();
    imgs.forEach(function (img) {
      var src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
      var fbcdn = /fbcdn\.net|scontent/i.test(src);
      var naturalW = img.naturalWidth || parseInt(img.getAttribute('width'), 10) || 0;
      var naturalH = img.naturalHeight || parseInt(img.getAttribute('height'), 10) || 0;
      var rect = img.getBoundingClientRect ? img.getBoundingClientRect() : { width: 0, height: 0 };
      if (!isContentPhoto(img, fbcdn, rect, naturalW, naturalH)) return;

      var candidates = [];
      function add(u, score) { if (u && /^https?:\/\//i.test(u)) candidates.push({ url: u, score: score }); }
      add(img.getAttribute('data-original') || img.getAttribute('data-full-src') || '', 100);
      U.parseSrcset(img.getAttribute('srcset') || img.getAttribute('data-srcset') || '')
        .forEach(function (c) { add(c.url, 60 + Math.min(40, c.w / 1000)); });
      var a = img.closest ? img.closest('a[href]') : null;
      if (a) {
        var href = a.getAttribute('href') || '';
        if (/fbcdn|photo\.php|photos?\//i.test(href)) add(href, 70);
      }
      add(img.getAttribute('data-src') || '', 55);
      add(img.currentSrc || '', 50);
      add(img.src || '', 40);
      if (!candidates.length) return;

      candidates.sort(function (x, y) { return y.score - x.score; });
      var url = candidates[0].url;
      if (seen.has(url)) return;
      seen.add(url);
      var alts = [];
      for (var k = 1; k < candidates.length && alts.length < 3; k++) {
        var alt = candidates[k].url;
        if (alt !== url && alts.indexOf(alt) === -1) alts.push(alt);
      }
      out.push({ url: url, alternates: alts, width: naturalW, height: naturalH, ext: U.extFromUrl(url) });
    });
    return out.concat(collectVideos(post));
  }

  /** Videos/Reels/Stories: capture the video source URLs and any poster frame. */
  function collectVideos(post) {
    if (!post) return [];
    var out = [], seen = new Set();
    Array.prototype.forEach.call(post.querySelectorAll('video'), function (v) {
      var src = v.currentSrc || v.getAttribute('src') || '';
      if (!/^https?:/i.test(src)) return;
      var key = src.split('?')[0];
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        url: src,
        alternates: [],
        ext: U.extFromUrl(src),
        video: true,
        poster: v.getAttribute('poster') || '',
        width: v.naturalWidth || 0,
        height: v.naturalHeight || 0
      });
    });
    return out;
  }

  function shortenTitle(str, max) {
    str = String(str || '').trim();
    if (str.length <= max) return str;
    var cut = str.slice(0, max), space = cut.lastIndexOf(' ');
    if (space > max * 0.6) cut = cut.slice(0, space);
    return cut.replace(/[\s\-–—,;:]+$/g, '') + '…';
  }

  function scanNode(post, doc, url, index) {
    var source = detectSource(doc, url, post);
    var scope = post || doc;
    var id = getPostIdFromUrl(url) || extractPostIdFromDOM(post);
    var text = extractText(scope);
    var titleLine = shortenTitle((text.split('\n').find(function (l) { return l.trim(); }) || ''), 72);
    if (!id) id = U.hashShort((url || '') + titleLine + (index || 0));
    var plus = scope.querySelector ? scope.querySelector('a[aria-label*="remaining items"]') : null;
    var extraCount = 0, expandHref = '';
    if (plus) {
      expandHref = plus.getAttribute('href') || '';
      var m = (plus.getAttribute('aria-label') || '').match(/(\d+)\s+remaining/i);
      extraCount = m ? Number(m[1]) : 0;
    }
    return {
      found: true,
      id: U.uid('post'),
      postId: id,
      index: (index || 0) + 1,
      sourceType: source.sourceType,
      sourceName: source.sourceName,
      author: extractAuthor(doc, post),
      date: extractDate(scope),
      time: '',
      text: text,
      title: titleLine || 'post',
      topic: 'General',
      postUrl: url || '',
      images: extractImages(post),
      extraCount: extraCount,
      expandHref: expandHref,
      host: (function () { try { return new URL(url).hostname; } catch (e) { return ''; } })()
    };
  }

  function scanPost(doc, url, viewport) {
    var post = choosePost(doc, url, viewport);
    if (!post) return { found: false, postId: '', sourceType: 'Other', sourceName: 'Unknown', author: '', date: U.todayISO(), text: '', title: '', postUrl: url || '', images: [], host: '' };
    return scanNode(post, doc, url, 0);
  }

  function scanAllPosts(doc, url, viewport) {
    var containers = findPostContainers(doc);
    return containers.map(function (c, i) { return scanNode(c, doc, url, i); })
      .filter(function (p) { return p.images.length > 0; })
      .slice(0, 100);
  }

  global.FBPostScanner = {
    scanPost: scanPost,
    scanAllPosts: scanAllPosts,
    scanElement: scanNode,
    findPostContainers: findPostContainers,
    choosePost: choosePost,
    extractImages: extractImages,
    detectSource: detectSource,
    getPostIdFromUrl: getPostIdFromUrl
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
