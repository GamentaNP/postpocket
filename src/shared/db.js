/*
 * PostPocket — local IndexedDB library.
 * Everything stays on the user's device. No network, no analytics.
 */
(function (global) {
  'use strict';
  var U = global.FBPUtils;
  var DB_NAME = 'postpocket';
  var VERSION = 1;

  function open() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('posts')) {
          var s = db.createObjectStore('posts', { keyPath: 'id' });
          s.createIndex('date', 'date');
          s.createIndex('source', 'sourceName');
          s.createIndex('topic', 'topic');
          s.createIndex('deleted', 'deleted');
        }
        if (!db.objectStoreNames.contains('jobs')) db.createObjectStore('jobs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function tx(storeName, mode, fn) {
    var db = await open();
    return new Promise(function (resolve, reject) {
      var t = db.transaction(storeName, mode);
      var store = t.objectStore(storeName);
      var result;
      try { result = fn(store); } catch (e) { reject(e); return; }
      t.oncomplete = function () { resolve(result && result.result !== undefined ? result.result : result); };
      t.onerror = function () { reject(t.error); };
      t.onabort = function () { reject(t.error); };
    });
  }

  function reqPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  var DB = {
    open: open,

    putPost: async function (post) {
      return tx('posts', 'readwrite', function (s) { return reqPromise(s.put(post)); });
    },
    getPost: async function (id) {
      return tx('posts', 'readonly', function (s) { return reqPromise(s.get(id)); });
    },
    allPosts: async function () {
      return tx('posts', 'readonly', function (s) { return reqPromise(s.getAll()); });
    },
    deletePost: async function (id) {
      return tx('posts', 'readwrite', function (s) { return reqPromise(s.delete(id)); });
    },
    clearPosts: async function () {
      return tx('posts', 'readwrite', function (s) { return reqPromise(s.clear()); });
    },
    clearJobs: async function () {
      return tx('jobs', 'readwrite', function (s) { return reqPromise(s.clear()); });
    },
    clearBlobs: async function () {
      return tx('blobs', 'readwrite', function (s) { return reqPromise(s.clear()); });
    },

    putJob: async function (job) {
      return tx('jobs', 'readwrite', function (s) { return reqPromise(s.put(job)); });
    },
    getJob: async function (id) {
      return tx('jobs', 'readonly', function (s) { return reqPromise(s.get(id)); });
    },
    allJobs: async function () {
      return tx('jobs', 'readonly', function (s) { return reqPromise(s.getAll()); });
    },
    deleteJob: async function (id) {
      return tx('jobs', 'readwrite', function (s) { return reqPromise(s.delete(id)); });
    },

    putBlob: async function (id, blob) {
      return tx('blobs', 'readwrite', function (s) { return reqPromise(s.put({ id: id, blob: blob })); });
    },
    getBlob: async function (id) {
      var row = await tx('blobs', 'readonly', function (s) { return reqPromise(s.get(id)); });
      return row && row.blob;
    },
    deleteBlob: async function (id) {
      return tx('blobs', 'readwrite', function (s) { return reqPromise(s.delete(id)); });
    },
    deleteBlobsFor: async function (postId) {
      return tx('blobs', 'readwrite', function (s) {
        var req = s.openCursor();
        req.onsuccess = function () {
          var c = req.result;
          if (!c) return;
          if (String(c.key).indexOf(postId + ':') === 0) c.delete();
          c.continue();
        };
      });
    },

    exportAll: async function () {
      var posts = await DB.allPosts();
      var jobs = await DB.allJobs();
      var settings = {};
      try {
        if (global.chrome && chrome.storage) {
          settings = await new Promise(function (resolve) {
            chrome.storage.local.get('settings', function (r) { resolve((r && r.settings) || {}); });
          });
        }
      } catch (e) {}
      return JSON.stringify({ app: 'PostPocket', version: 2, exportedAt: new Date().toISOString(), posts: posts, jobs: jobs, settings: settings }, null, 2);
    },

    importAll: async function (json) {
      var data = typeof json === 'string' ? U.safeJsonParse(json, null) : json;
      if (!data || !Array.isArray(data.posts)) throw new Error('Invalid PostPocket backup');
      for (var i = 0; i < data.posts.length; i++) await DB.putPost(data.posts[i]);
      if (Array.isArray(data.jobs)) for (var j = 0; j < data.jobs.length; j++) await DB.putJob(data.jobs[j]);
      if (data.settings && global.chrome && chrome.storage) {
        await new Promise(function (resolve) { chrome.storage.local.set({ settings: data.settings }, function () { resolve(); }); });
      }
      return { posts: data.posts.length, jobs: data.jobs.length };
    }
  };

  global.PPDB = DB;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
