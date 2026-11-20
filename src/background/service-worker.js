/* PostPocket background router. */
importScripts(
  '../shared/utils.js',
  '../shared/settings.js',
  '../shared/naming.js',
  '../shared/db.js',
  '../shared/zip.js',
  'blob-url.js',
  'queue.js',
  'exports.js'
);

var U = self.FBPUtils;
var DB = self.PPDB;
var Queue = self.PPQueue;
var Exports = self.PPExports;
var Settings = self.PPSettings;

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dist/src/ui-react/dashboard.html') });
  }
});

/* Open the full workspace or side panel from the popup. */
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || !msg.type) return;

  if (msg.type === 'PP_OPEN_DASHBOARD') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dist/src/ui-react/dashboard.html') });
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === 'PP_OPEN_SIDEPANEL') {
    try {
      chrome.sidePanel.open({ tabId: msg.tabId });
      sendResponse({ ok: true });
    } catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); }
    return;
  }
  if (msg.type === 'PP_SCAN') {
    (async function () {
      try {
        var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        var tab = tabs[0];
        if (!tab || !tab.url || !/(^|\.)facebook\.com$/i.test(new URL(tab.url).hostname)) {
          sendResponse({ ok: false, error: 'Open a Facebook post first.' }); return;
        }
        var msgType = msg.mode === 'all' ? 'PP_SCAN_ALL' : 'PP_SCAN_CURRENT';
        var res = await chrome.tabs.sendMessage(tab.id, { type: msgType });
        if (!res || !res.ok) throw new Error((res && res.error) || 'Could not read this page. Refresh it and retry.');
        sendResponse({ ok: true, data: res.data, tabId: tab.id, tabUrl: tab.url });
      } catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); }
    })();
    return true;
  }
  if (msg.type === 'PP_GET_SETTINGS') { Settings.get().then(function (s) { sendResponse({ ok: true, data: s }); }); return true; }
  if (msg.type === 'PP_SET_SETTINGS') { Settings.set(msg.patch).then(function (s) { sendResponse({ ok: true, data: s }); }); return true; }
  if (msg.type === 'PP_RESET_SETTINGS') { Settings.reset().then(function (s) { sendResponse({ ok: true, data: s }); }); return true; }

  if (msg.type === 'PP_GET_POSTS') { DB.allPosts().then(function (p) { sendResponse({ ok: true, data: p }); }); return true; }
  if (msg.type === 'PP_PUT_POST') { DB.putPost(msg.post).then(function () { sendResponse({ ok: true }); }); return true; }
  if (msg.type === 'PP_DELETE_POST') { DB.deletePost(msg.id).then(function () { sendResponse({ ok: true }); }); return true; }
  if (msg.type === 'PP_CLEAR_LIBRARY') {
    (async function () {
      await DB.clearPosts(); await DB.clearJobs(); await DB.clearBlobs();
      sendResponse({ ok: true });
    })().catch(function (e) { sendResponse({ ok: false, error: String(e.message || e) }); });
    return true;
  }

  if (msg.type === 'PP_GET_JOBS') { Queue.list().then(function (j) { sendResponse({ ok: true, data: j }); }); return true; }
  if (msg.type === 'PP_JOB_ACTION') {
    var fn = Queue[msg.action];
    if (typeof fn !== 'function') { sendResponse({ ok: false, error: 'Unknown action' }); return; }
    fn(msg.id).then(function () { sendResponse({ ok: true }); }).catch(function (e) { sendResponse({ ok: false, error: String(e.message || e) }); });
    return true;
  }

  if (msg.type === 'PP_COLLECT') {
    Queue.create({ kind: 'download', posts: msg.posts, settings: msg.settings || {} })
      .then(function (job) { return Queue.start(job.id).then(function () { return job; }); })
      .then(function (job) { sendResponse({ ok: true, job: job }); })
      .catch(function (e) { sendResponse({ ok: false, error: String(e.message || e) }); });
    return true;
  }

  if (msg.type === 'PP_EXPORT') {
    var posts = msg.posts || [];
    var mode = msg.mode || 'oneZip';
    var settings = msg.settings || {};
    var task = mode === 'perPostZip' ? Exports.perPostZip(posts, settings)
      : mode === 'folders' ? Exports.folders(posts, settings)
        : mode === 'backup' ? Exports.backup()
          : Exports.oneZip(posts, settings, msg.name);
    task.then(function (r) { sendResponse({ ok: true, result: r }); })
      .catch(function (e) { sendResponse({ ok: false, error: String(e.message || e) }); });
    return true;
  }

  if (msg.type === 'PP_IMPORT_BACKUP') {
    DB.importAll(msg.json).then(function (r) { sendResponse({ ok: true, data: r }); })
      .catch(function (e) { sendResponse({ ok: false, error: String(e.message || e) }); });
    return true;
  }

  /* Open a Facebook photo viewer in a background tab, harvest every image,
     then close it. Used when a post has a "+N remaining items" overlay. */
  if (msg.type === 'PP_EXPAND_POST') {
    (async function () {
      var tab = null;
      try {
        // Visible, user-initiated tab — never hidden or silently closed.
        tab = await chrome.tabs.create({ url: msg.href, active: true });
        await new Promise(function (r) { setTimeout(r, 1200); });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/shared/utils.js'] });
        var injected = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async function () {
            function collect() {
              var out = [], seen = new Set();
              document.querySelectorAll('img').forEach(function (im) {
                var src = im.currentSrc || im.src || '';
                if (!/scontent.*fbcdn/i.test(src)) return;
                if ((im.naturalWidth || 0) < 200) return;
                var key = src.split('?')[0];
                if (seen.has(key)) return;
                seen.add(key);
                out.push({
                  url: src, alternates: [],
                  ext: (window.FBPUtils && window.FBPUtils.extFromUrl(src)) || 'jpg',
                  width: im.naturalWidth, height: im.naturalHeight
                });
              });
              return out;
            }
            var deadline = Date.now() + 4500;
            while (Date.now() < deadline) {
              var found = collect();
              if (found.length >= 3) return found;
              await new Promise(function (r) { setTimeout(r, 300); });
            }
            return collect();
          }
        });
        var images = (injected && injected[0] && injected[0].result) || [];
        sendResponse(images.length ? { ok: true, data: images } : { ok: false, error: 'No images in photo viewer' });
      } catch (e) {
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      } finally {
        // The viewer stays open. The user closes it when finished.
      }
    })();
    return true;
  }

  if (msg.type === 'PP_PING') { sendResponse({ ok: true, version: chrome.runtime.getManifest().version }); return; }
});

Queue.resumePersisted().catch(function () {});
