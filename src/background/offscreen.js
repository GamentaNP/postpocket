/*
 * PostPocket offscreen document.
 * Owns object URLs and ZIP assembly so the service worker never has to
 * materialize large base64 strings or keep a blob alive across eviction.
 */
(function () {
  'use strict';
  var DB = self.PPDB, Zip = self.PPZip;
  var urls = new Map();

  function makeUrl(blob) {
    var url = URL.createObjectURL(blob);
    urls.set(url, true);
    return url;
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return;

    if (msg.type === 'PP_BLOB_TO_URL') {
      DB.getBlob(msg.key).then(function (blob) {
        if (!blob) { sendResponse({ ok: false, error: 'blob missing' }); return; }
        sendResponse({ ok: true, url: makeUrl(blob) });
      }).catch(function (e) { sendResponse({ ok: false, error: String(e.message || e) }); });
      return true;
    }

    if (msg.type === 'PP_REVOKE_URL') {
      if (msg.url && urls.has(msg.url)) { URL.revokeObjectURL(msg.url); urls.delete(msg.url); }
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === 'PP_BUILD_ZIP') {
      (async function () {
        try {
          var entries = [];
          for (var i = 0; i < (msg.entries || []).length; i++) {
            var e = msg.entries[i];
            var blob = e.blobKey ? await DB.getBlob(e.blobKey) : new Blob([e.text || ''], { type: e.mime || 'text/plain' });
            if (!blob) continue;
            entries.push({ name: e.name, data: new Uint8Array(await blob.arrayBuffer()) });
          }
          sendResponse({ ok: true, url: makeUrl(Zip.createZip(entries)) });
        } catch (e) { sendResponse({ ok: false, error: String(e.message || e) }); }
      })();
      return true;
    }
  });
})();
