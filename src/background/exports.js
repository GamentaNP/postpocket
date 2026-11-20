/* PostPocket — export engine: one ZIP, per-post ZIP, folders, CSV/JSON, backup. */
(function (global) {
  'use strict';
  var U = global.FBPUtils;
  var Naming = global.PPNaming;
  var DB = global.PPDB;

  function storedKey(post, index) { return (post.jobId || 'manual') + ':' + post.id + ':' + index; }

  async function blobForImage(post, index, img) {
    var blob = await DB.getBlob(storedKey(post, index));
    if (blob) return blob;
    var urls = [img.url].concat(img.alternates || []);
    for (var i = 0; i < urls.length; i++) {
      try {
        var res = await fetch(urls[i], { credentials: 'include', signal: AbortSignal.timeout(15000) });
        if (res.ok) return await res.blob();
      } catch (e) {}
    }
    return null;
  }

  async function downloadBlob(blob, filename) {
    var key = 'tmp:' + U.uid('exp');
    var prepared = await PPBlob.urlForBlob(blob, key);
    if (!prepared.ok) return { ok: false, error: prepared.error };
    var out = await new Promise(function (resolve) {
      chrome.downloads.download({ url: prepared.url, filename: filename, conflictAction: 'uniquify', saveAs: false }, function (id) {
        resolve({ ok: !chrome.runtime.lastError && !!id, id: id, filename: filename, error: chrome.runtime.lastError && chrome.runtime.lastError.message });
      });
    });
    await PPBlob.revoke(prepared.url, key);
    return out;
  }

  function metaFiles(post, settings, folder) {
    var out = [], s = settings || {};
    if (s.saveMetadata === false || s.metaSidecar === false) return out;
    var info = {
      title: post.title, postId: post.postId, sourceType: post.sourceType,
      sourceName: post.sourceName, author: post.author,
      text: s.metaCaption === false ? undefined : post.text,
      images: post.images.map(function (im, i) { return { index: i + 1, url: im.url, savedAs: Naming.imageName(post, i + 1, im.ext, s) }; })
    };
    if (s.metaDate !== false) info.date = post.date;
    if (s.metaPostId !== false) info.postId = post.postId;
    if (s.metaSourceLink !== false) info.postUrl = post.postUrl;
    out.push({ name: folder + '/post-info.json', text: JSON.stringify(info, null, 2), mime: 'application/json' });
    if (s.metaReadme) {
      out.push({ name: folder + '/README.txt', text: 'PostPocket collection\n\n' + post.title + '\n\nSource: ' + post.sourceName + ' (' + post.sourceType + ')\nAuthor: ' + post.author + '\nDate: ' + post.date + '\nPost ID: ' + post.postId + '\nLink: ' + post.postUrl + '\n\n' + (post.text || '') });
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

  async function buildEntries(posts, settings, flat) {
    var entries = [], tempKeys = [];
    for (var i = 0; i < posts.length; i++) {
      var post = posts[i];
      var folder = flat ? '' : Naming.destination(post, settings);
      for (var j = 0; j < (post.images || []).length; j++) {
        var img = post.images[j];
        var blob = await blobForImage(post, j, img);
        if (!blob) continue;
        var key = 'tmp:' + U.uid('zip');
        await DB.putBlob(key, blob);
        tempKeys.push(key);
        entries.push({ name: (folder ? folder + '/' : '') + Naming.imageName(post, j + 1, img.ext, settings), blobKey: key });
      }
      metaFiles(post, settings, folder || '.').forEach(function (f) { entries.push(f); });
    }
    if (settings.metaCsv) entries.push({ name: (settings.rootFolder || 'PostPocket') + '/post-index.csv', text: csvFor(posts), mime: 'text/csv' });
    return { entries: entries, tempKeys: tempKeys };
  }

  async function downloadZip(entries, tempKeys, filename) {
    var built = await PPBlob.buildZipUrl(entries);
    if (!built.ok) return { ok: false, error: built.error };
    var out = await new Promise(function (resolve) {
      chrome.downloads.download({ url: built.url, filename: filename, conflictAction: 'uniquify', saveAs: false }, function (id) {
        resolve({ ok: !chrome.runtime.lastError && !!id, id: id, filename: filename, error: chrome.runtime.lastError && chrome.runtime.lastError.message });
      });
    });
    await PPBlob.revoke(built.url);
    for (var i = 0; i < tempKeys.length; i++) { try { await DB.deleteBlob(tempKeys[i]); } catch (e) {} }
    return out;
  }

  var Exports = {
    oneZip: async function (posts, settings, name) {
      var built = await buildEntries(posts, settings, false);
      return downloadZip(built.entries, built.tempKeys, U.sanitizeSegment(name || 'PostPocket-collection', 80) + '.zip');
    },

    perPostZip: async function (posts, settings) {
      var results = [];
      for (var i = 0; i < posts.length; i++) {
        var built = await buildEntries([posts[i]], settings, true);
        results.push(await downloadZip(built.entries, built.tempKeys, U.sanitizeSegment(Naming.folderName(posts[i], settings), 80) + '.zip'));
      }
      return results;
    },

    folders: async function (posts, settings) {
      var results = [];
      for (var i = 0; i < posts.length; i++) {
        var post = posts[i];
        var folder = Naming.destination(post, settings);
        for (var j = 0; j < (post.images || []).length; j++) {
          var blob = await blobForImage(post, j, post.images[j]);
          if (!blob) continue;
          var key = 'tmp:' + U.uid('folder');
          var prepared = await PPBlob.urlForBlob(blob, key);
          if (!prepared.ok) continue;
          results.push(await new Promise(function (resolve) {
            chrome.downloads.download({ url: prepared.url, filename: folder + '/' + Naming.imageName(post, j + 1, post.images[j].ext, settings), conflictAction: 'uniquify', saveAs: false }, function (id) {
              resolve({ ok: !chrome.runtime.lastError && !!id, id: id });
            });
          }));
          await PPBlob.revoke(prepared.url, key);
        }
        var metas = metaFiles(post, settings, folder);
        for (var k = 0; k < metas.length; k++) await downloadBlob(new Blob([metas[k].text], { type: metas[k].mime || 'text/plain' }), metas[k].name);
      }
      if (settings.metaCsv) await downloadBlob(new Blob([csvFor(posts)], { type: 'text/csv' }), (settings.rootFolder || 'PostPocket') + '/post-index.csv');
      return results;
    },

    backup: async function () {
      var json = await DB.exportAll();
      return downloadBlob(new Blob([json], { type: 'application/json' }), 'PostPocket-backup-' + U.todayISO() + '.json');
    }
  };

  global.PPExports = Exports;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
