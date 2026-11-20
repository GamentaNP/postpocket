/*
 * PostPocket content script.
 * - Bridges scan requests from the popup (with small thumbnails).
 * - Injects a compact floating widget on each Facebook post.
 * - Expand posts with a "+N remaining items" photo viewer to capture every image.
 */
(function () {
  'use strict';
  var S = window.FBPostScanner;
  var U = window.FBPUtils;

  var STYLE_ID = 'ppf-styles';
  var CSS = [
    '.ppf-widget{position:absolute;top:8px;right:8px;z-index:2147483000;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.ppf-btn{display:flex;align-items:center;gap:5px;border:1px solid #fff;border-radius:999px;',
    'background:#fff;color:#000;font-size:13px;font-weight:800;padding:6px 10px;',
    'cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.5);transition:.16s ease}',
    '.ppf-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(255,255,255,.25)}',
    '.ppf-btn b{font-size:11px;background:rgba(0,0,0,.14);border-radius:999px;padding:1px 6px}',
    '.ppf-panel{position:absolute;top:38px;right:0;width:286px;background:#000;color:#fff;border:1px solid #2a2a2a;',
    'border-radius:13px;padding:11px;box-shadow:0 14px 38px rgba(0,0,0,.8)}',
    '.ppf-head{font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:#a3a3a3;margin-bottom:8px}',
    '.ppf-row{display:flex;gap:6px;margin-bottom:9px}',
    '.ppf-row button{flex:1;border:1px solid #2a2a2a;border-radius:8px;background:#0d0d0d;color:#fff;padding:7px 6px;font-size:11px;font-weight:700;cursor:pointer}',
    '.ppf-row button.primary{background:#fff;color:#000;border-color:#fff}',
    '.ppf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-height:310px;overflow:auto}',
    '.ppf-grid button{position:relative;padding:0;border:2px solid transparent;border-radius:9px;overflow:hidden;background:#141414;aspect-ratio:4/3;cursor:pointer}',
    '.ppf-grid em{position:absolute;left:4px;top:4px;z-index:2;font-style:normal;font-family:monospace;font-size:10px;background:#fff;color:#000;border-radius:4px;padding:0 4px}',
    '.ppf-grid button:hover{border-color:#fff}',
    '.ppf-grid img{width:100%;height:100%;object-fit:cover;display:block}',
    '.ppf-note{font-size:10px;color:#6b6b6b;margin-top:8px;line-height:1.4}',
    '.ppf-done{background:#fff!important;color:#000!important}'
  ].join('\n');

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  async function withThumbs(data) {
    if (!data) return data;
    var posts = Array.isArray(data) ? data : [data];
    await Promise.all(posts.map(function (post) {
      if (!post || !post.images) return Promise.resolve();
      // Only the first few thumbnails are needed for the preview; keep the
      // scan fast even when a post has 20+ photos.
      return Promise.all(post.images.slice(0, 9).map(async function (im) {
        try {
          if (!im.url || !/^https?:/i.test(im.url)) return;
          var controller = new AbortController();
          var timer = setTimeout(function () { controller.abort(); }, 1800);
          var res;
          try { res = await fetch(im.url, { credentials: 'include', signal: controller.signal }); }
          finally { clearTimeout(timer); }
          if (!res.ok) return;
          var blob = await res.blob();
          var bmp = await createImageBitmap(blob);
          var scale = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(bmp.width * scale));
          canvas.height = Math.max(1, Math.round(bmp.height * scale));
          canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
          im.thumb = canvas.toDataURL('image/jpeg', 0.72);
        } catch (e) { /* original URL remains the fallback */ }
      }));
    }));
    return data;
  }

  function extractViewerImages() {
    var out = [], seen = new Set();
    Array.prototype.forEach.call(document.querySelectorAll('img'), function (im) {
      var src = im.currentSrc || im.src || '';
      if (!/scontent.*fbcdn/i.test(src)) return;
      if ((im.naturalWidth || 0) < 200) return;
      var key = src.split('?')[0];
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ url: src, alternates: [], ext: U ? U.extFromUrl(src) : 'jpg', width: im.naturalWidth, height: im.naturalHeight });
    });
    return out;
  }

  function expandPost(post) {
    if (!post.expandHref || post.expanded) return Promise.resolve(post.images);
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({ type: 'PP_EXPAND_POST', href: post.expandHref }, function (res) {
        if (res && res.ok && res.data && res.data.length) {
          post.images = res.data;
          post.expanded = true;
        }
        resolve(post.images);
      });
    });
  }

  function collect(post, indices, btn) {
    if (!indices.length) return;
    chrome.runtime.sendMessage({
      type: 'PP_COLLECT',
      payload: { posts: [Object.assign({}, post, { selectedImages: indices })] }
    }, function (res) {
      if (res && res.ok && btn) {
        btn.classList.add('ppf-done');
        btn.textContent = '✓ Saved ' + indices.length;
      }
    });
  }

  async function openPanel(widget, post, btn) {
    var old = widget.querySelector('.ppf-panel');
    if (old) { old.remove(); return; }
    var panel = document.createElement('div');
    panel.className = 'ppf-panel';
    panel.innerHTML = '<div class="ppf-head">PostPocket · loading full set…</div><div class="ppf-grid"></div>';
    widget.appendChild(panel);

    await expandPost(post);
    panel.querySelector('.ppf-head').textContent = 'PostPocket · ' + post.images.length + ' images';

    var actions = document.createElement('div');
    actions.className = 'ppf-row';
    actions.innerHTML = '<button class="primary" data-all>Download all</button><button data-single>Single image</button>';
    panel.insertBefore(actions, panel.querySelector('.ppf-grid'));
    var note = document.createElement('div');
    note.className = 'ppf-note';
    note.textContent = 'Only images already visible in your session. One post at a time, gently downloaded.';
    panel.appendChild(note);

    var grid = panel.querySelector('.ppf-grid');
    post.images.forEach(function (im, i) {
      var b = document.createElement('button');
      b.title = 'Save image ' + (i + 1);
      var img = document.createElement('img');
      img.src = im.url; // page context: Facebook CDN URL loads normally here
      img.alt = 'Image ' + (i + 1);
      b.appendChild(img);
      var num = document.createElement('em');
      num.textContent = String(i + 1);
      b.appendChild(num);
      b.addEventListener('click', function () { collect(post, [i], btn); });
      grid.appendChild(b);
    });
    actions.querySelector('[data-all]').addEventListener('click', function () {
      collect(post, post.images.map(function (_, i) { return i; }), btn);
    });
    actions.querySelector('[data-single]').addEventListener('click', function () {
      grid.scrollTop = 0;
      panel.querySelector('.ppf-head').textContent = 'Click one image to save it';
    });
    btn.querySelector('b').textContent = String(post.images.length);
  }

  function decorate() {
    if (!S || !S.findPostContainers) return;
    ensureStyle();
    var containers = S.findPostContainers(document);
    containers.forEach(function (post) {
      var data;
      try { data = S.scanElement(post, document, location.href, 0); } catch (e) { return; }
      if (!data || !data.images || !data.images.length) return;

      var plus = post.querySelector('a[aria-label*="remaining items"]');
      if (plus) {
        data.expandHref = plus.getAttribute('href');
        data.extraCount = Number(((plus.getAttribute('aria-label') || '').match(/(\d+)\s+remaining/i) || [])[1] || 0);
      }
      var total = data.images.length + (data.extraCount || 0);

      // Facebook lazy-loads images. Update an existing widget instead of
      // freezing the count from the first (partial) DOM snapshot.
      var widget = null;
      Array.prototype.some.call(post.children, function (c) {
        if (c.classList && c.classList.contains('ppf-widget')) { widget = c; return true; }
        return false;
      });
      if (widget) {
        var badge = widget.querySelector('b');
        if (badge && badge.textContent !== String(total)) badge.textContent = String(total);
        widget.__postData = data;
        return;
      }

      post.setAttribute('data-ppf-decorated', '1');
      if (getComputedStyle(post).position === 'static') post.style.position = 'relative';
      widget = document.createElement('div');
      widget.className = 'ppf-widget';
      widget.__postData = data;
      var btn = document.createElement('button');
      btn.className = 'ppf-btn';
      btn.title = 'PostPocket — save all images from this post';
      btn.innerHTML = '<span>⬇</span><b>' + total + '</b>';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        // Re-scan at click time: Facebook may have lazy-loaded more images.
        var fresh = null;
        try { fresh = S.scanElement(post, document, location.href, 0); } catch (err) {}
        if (fresh && fresh.images && fresh.images.length) {
          var link = post.querySelector('a[aria-label*="remaining items"]');
          if (link) {
            fresh.expandHref = link.getAttribute('href');
            fresh.extraCount = Number(((link.getAttribute('aria-label') || '').match(/(\d+)\s+remaining/i) || [])[1] || 0);
          }
          var old = widget.__postData;
          if (old && old.expanded && old.images.length > fresh.images.length) fresh.images = old.images;
          fresh.expanded = !!(old && old.expanded);
          widget.__postData = fresh;
        }
        openPanel(widget, widget.__postData, btn);
      });
      widget.appendChild(btn);
      post.appendChild(widget);
    });
  }

  var debounceTimer = null;
  var observer = new MutationObserver(function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(decorate, 500);
  });
  observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
  decorate();

  /* ---------- background / popup bridge ---------- */
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return;
    var vp = { w: innerWidth, h: innerHeight };

    if (msg.type === 'PP_PING') {
      sendResponse({ ok: true, host: location.hostname, url: location.href });
      return;
    }
    if (msg.type === 'PP_EXTRACT_VIEWER_IMAGES') {
      sendResponse({ ok: true, data: extractViewerImages() });
      return;
    }
    if (msg.type === 'PP_SCAN_CURRENT' || msg.type === 'PP_SCAN_ALL') {
      (async function () {
        try {
          var data = msg.type === 'PP_SCAN_ALL'
            ? S.scanAllPosts(document, location.href, vp)
            : S.scanPost(document, location.href, vp);
          await withThumbs(data);
          sendResponse({ ok: true, data: data });
        } catch (e) {
          sendResponse({ ok: false, error: String((e && e.message) || e) });
        }
      })();
      return true;
    }
  });
})();
