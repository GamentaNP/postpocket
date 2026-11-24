/* PostPocket — settings engine. Preferences live only in chrome.storage.local. */
(function (global) {
  'use strict';

  var DEFAULTS = {
    // download
    destination: 'downloads',       // downloads | ask | folder | zip
    rootFolder: 'PostPocket',
    formats: ['jpg', 'png', 'webp', 'gif'],
    quantity: 'all',                // all | latest | custom
    quantityValue: 25,
    dateFilter: 'all',              // all | today | week | month | year | custom
    // folder / image naming
    folderPreset: 'date-title',
    folderTemplate: '',
    imagePreset: 'date-title',
    imageTemplate: '',
    prefix: '',
    organizeBy: 'none',             // none | source | month | year | topic
    existingFiles: 'uniquify',      // uniquify | replace | rename
    imageOrder: 'original',         // original | filename | date
    // metadata
    saveMetadata: true,
    metaCaption: true,
    metaDate: true,
    metaSourceLink: true,
    metaPostId: true,
    metaSidecar: true,
    metaReadme: false,
    metaCsv: false,
    // duplicates
    duplicateMode: 'skip',          // skip | rename | review
    // preview
    previewMode: 'newtab',          // inline | sidepanel | newtab | ask
    gridSize: 'medium',             // small | medium | large
    // queue
    concurrency: 1,
    delayMs: 180,
    retryCount: 2,
    pauseOnError: false,
    // appearance
    theme: 'dark',                  // dark | light | system
    // privacy
    storeImages: true,
    notifications: true
  };

  function get() {
    if (!(global.chrome && chrome.storage)) return Promise.resolve(Object.assign({}, DEFAULTS));
    return new Promise(function (resolve) {
      chrome.storage.local.get('settings', function (r) {
        resolve(Object.assign({}, DEFAULTS, (r && r.settings) || {}));
      });
    });
  }

  function set(patch) {
    return get().then(function (current) {
      var next = Object.assign({}, current, patch || {});
      if (global.chrome && chrome.storage) {
        return new Promise(function (resolve) {
          chrome.storage.local.set({ settings: next }, function () { resolve(next); });
        });
      }
      return next;
    });
  }

  function reset() {
    if (global.chrome && chrome.storage) {
      return new Promise(function (resolve) {
        chrome.storage.local.set({ settings: Object.assign({}, DEFAULTS) }, function () { resolve(DEFAULTS); });
      });
    }
    return Promise.resolve(Object.assign({}, DEFAULTS));
  }

  global.PPSettings = { DEFAULTS: DEFAULTS, get: get, set: set, reset: reset };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
