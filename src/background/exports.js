/* PostPocket — export engine: one ZIP, per-post ZIP, folders, CSV/JSON. */
(function (global) {
  'use strict';
  var U = global.FBPUtils;
  var Naming = global.PPNaming;
  var DB = global.PPDB;
  var Zip = global.PPZip;

  async function getBytes(post, index, img) {
    var blob = await DB.getBlob((post.jobId || 'manual') + ':' + post.id + ':' + index);
    if (blob) return new Uint8Array(await blob.arrayBuffer());
    try {
      var res = await fetch(img.url, { credentials: 'include' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return new Uint8Array(await (await res.blob()).arrayBuffer());
    } catch (e) {
      if (img.alternates && img.alternates.length) {
        for (var i = 0; i < img.alternates.length; i++) {
          try {
            var r2 = await fetch(img.alternates[i], { credentials: 'include' });
            if (r2.ok) return new Uint8Array(await (await r2.blob()).arrayBuffer());
          } catch (e2) {}
        }
      }
      throw new Error('Image unavailable');
    }
  }

  async function downloadBlob(blob, filename) {
    // data: URLs are supported by chrome.downloads in MV3 service workers;
    // blob: URLs created in a service worker are not reliably downloadable.
    var url = await U.blobToDataUrl(blob);
    return new Promise(function (resolve) {
      chrome.downloads.download({ url: url, filename: filename, conflictAction: 'uniquify', saveAs: false }, function (id) {
        resolve({ ok: !chrome.runtime.lastError && !!id, id: id, filename: filename, error: chrome.runtime.lastError && chrome.runtime.lastError.message });
      });
    });
  }

  function metaFiles(post, settings, folder) {
    var out = [];
    var s = settings || {};
    if (s.metaSidecar !== false) {
      out.push({
        name: folder + '/post-info.json',
        data: JSON.stringify({
          title: post.title, postId: post.postId, sourceType: post.sourceType,
          sourceName: post.sourceName, author: post.author, date: post.date,
          postUrl: s.metaSourceLink === false ? undefined : post.postUrl,
          text: s.metaCaption === false ? undefined : post.text,
          images: post.images.map(function (im, i) { return { index: i + 1, url: im.url, savedAs: Naming.imageName(post, i + 1, im.ext, s) }; })
        }, null, 2)
      });
    }
    if (s.metaReadme) {
      out.push({
        name: folder + '/README.txt',
        data: 'PostPocket collection\n\n' + post.title + '\n\nSource: ' + post.sourceName + ' (' + post.sourceType + ')\nAuthor: ' + post.author + '\nDate: ' + post.date + '\nPost ID: ' + post.postId + '\nLink: ' + post.postUrl + '\n\n' + (post.text || '')
      });
    }
    return out;
  }

  function csvFor(posts) {
    var lines = ['Title,Source Type,Source Name,Author,Date,Post ID,Post Link,Images'];
    posts.forEach(function (p) {
      lines.push([p.title, p.sourceType, p.sourceName, p.author, p.date, p.postId, p.postUrl, (p.images || []).length]
        .map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','));
    });
    return lines.join('\r\n');
  }

  var Exports = {
    oneZip: async function (posts, settings, name) {
      var entries = [];
      for (var i = 0; i < posts.length; i++) {
        var post = posts[i];
        var folder = Naming.destination(post, settings);
        for (var j = 0; j < (post.images || []).length; j++) {
          var img = post.images[j];
          var bytes = await getBytes(post, j, img);
          entries.push({ name: folder + '/' + Naming.imageName(post, j + 1, img.ext, settings), data: bytes });
        }
        metaFiles(post, settings, folder).forEach(function (f) { entries.push(f); });
      }
      if (settings.metaCsv) entries.push({ name: (settings.rootFolder || 'PostPocket') + '/post-index.csv', data: csvFor(posts) });
      var blob = Zip.createZip(entries);
      return downloadBlob(blob, U.sanitizeSegment(name || 'PostPocket-collection', 80) + '.zip');
    },

    perPostZip: async function (posts, settings) {
      var results = [];
      for (var i = 0; i < posts.length; i++) {
        var post = posts[i];
        var folder = Naming.destination(post, settings);
        var entries = [];
        for (var j = 0; j < (post.images || []).length; j++) {
          var img = post.images[j];
          var bytes = await getBytes(post, j, img);
          entries.push({ name: Naming.imageName(post, j + 1, img.ext, settings), data: bytes });
        }
        metaFiles(post, settings, '.').forEach(function (f) { entries.push(f); });
        results.push(await downloadBlob(Zip.createZip(entries), U.sanitizeSegment(Naming.folderName(post, settings), 80) + '.zip'));
      }
      return results;
    },

    folders: async function (posts, settings) {
      var results = [];
      var saved = await DB.allJobs();
      for (var i = 0; i < posts.length; i++) {
        var post = posts[i];
        var folder = Naming.destination(post, settings);
        for (var j = 0; j < (post.images || []).length; j++) {
          var img = post.images[j];
          var blob = await DB.getBlob((post.jobId || 'manual') + ':' + post.id + ':' + j);
          if (!blob) {
            try { blob = await (await fetch(img.url, { credentials: 'include' })).blob(); } catch (e) { continue; }
          }
          var url = await U.blobToDataUrl(blob);
          results.push(await new Promise(function (resolve) {
            chrome.downloads.download({ url: url, filename: folder + '/' + Naming.imageName(post, j + 1, img.ext, settings), conflictAction: 'uniquify', saveAs: false }, function (id) {
              resolve({ ok: !chrome.runtime.lastError && !!id, id: id });
            });
          }));
        }
        for (var k = 0; k < metaFiles(post, settings, folder).length; k++) {
          var f = metaFiles(post, settings, folder)[k];
          await downloadBlob(new Blob([f.data], { type: 'text/plain' }), f.name);
        }
      }
      if (settings.metaCsv) {
        await downloadBlob(new Blob([csvFor(posts)], { type: 'text/csv' }), (settings.rootFolder || 'PostPocket') + '/post-index.csv');
      }
      return results;
    },

    backup: async function () {
      var json = await DB.exportAll();
      return downloadBlob(new Blob([json], { type: 'application/json' }), 'PostPocket-backup-' + U.todayISO() + '.json');
    }
  };

  global.PPExports = Exports;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
