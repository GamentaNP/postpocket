/* Offscreen-backed blob URLs. Keeps large byte strings out of the service worker. */
(function (global) {
  'use strict';
  var DB = global.PPDB;
  var creating = null;

  async function ensureOffscreen() {
    if (creating) return creating;
    creating = (async function () {
      // Create directly; a duplicate-document error simply means it already
      // exists. Avoids runtime.getContexts, which can fail with "No SW" during
      // a service-worker reload.
      try {
        await chrome.offscreen.createDocument({
          url: 'src/background/offscreen.html',
          reasons: ['BLOBS'],
          justification: 'Create short-lived object URLs for saving images and building ZIP archives on this device.'
        });
      } catch (e) { /* document already exists */ }
    })();
    try { await creating; } finally { creating = null; }
  }

  async function ask(msg) {
    await ensureOffscreen();
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      // Service worker can be torn down mid-request (e.g. during reload).
      return { ok: false, error: String((e && e.message) || e) };
    }
  }

  global.PPBlob = {
    urlForBlob: async function (blob, key) {
      await DB.putBlob(key, blob);
      var res = await ask({ type: 'PP_BLOB_TO_URL', key: key });
      return { ok: !!(res && res.ok), url: res && res.url, key: key, error: res && res.error };
    },
    revoke: async function (url, key) {
      try { await ask({ type: 'PP_REVOKE_URL', url: url }); } catch (e) {}
      if (key) { try { await DB.deleteBlob(key); } catch (e) {} }
    },
    buildZipUrl: async function (entries) {
      var res = await ask({ type: 'PP_BUILD_ZIP', entries: entries });
      return { ok: !!(res && res.ok), url: res && res.url, error: res && res.error };
    }
  };
})(self);
