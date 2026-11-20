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
    // Open a VISIBLE viewer tab. Its own content script writes the collected
    // images to local storage; we simply wait for that event. No long-running
    // work here, so a service-worker restart cannot strand the request.
    var token = U.uid('v');
    var key = 'pp_viewer_' + token;
    var href = msg.href + (msg.href.indexOf('#') >= 0 ? '&' : '#') + 'pp-expand=' + token;
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      chrome.storage.onChanged.removeListener(onChange);
      sendResponse({ ok: false, error: 'Viewer did not load images — close the tab and retry' });
    }, 25000);

    function onChange(changes, area) {
      if (settled || area !== 'local' || !changes[key]) return;
      settled = true;
      clearTimeout(timer);
      chrome.storage.onChanged.removeListener(onChange);
      var images = (changes[key].newValue && changes[key].newValue.images) || [];
      chrome.storage.local.remove(key);
      sendResponse(images.length ? { ok: true, data: images } : { ok: false, error: 'No images in viewer' });
    }
    chrome.storage.onChanged.addListener(onChange);
    chrome.tabs.create({ url: href, active: true });
    return true;
  }

  if (msg.type === 'PP_PING') { sendResponse({ ok: true, version: chrome.runtime.getManifest().version }); return; }
});

Queue.resumePersisted().catch(function () {});
