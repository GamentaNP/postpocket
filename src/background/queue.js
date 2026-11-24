/*
 * PostPocket — persistent download queue engine.
 * State is written to IndexedDB after every step so Chrome can kill and
 * restart the service worker without losing a job.
 */
(function (global) {
  'use strict';
  var U = global.FBPUtils;
  var Naming = global.PPNaming;
  var DB = global.PPDB;
  var Settings = global.PPSettings;

  var active = new Map();       // jobId -> { cancelled, paused, resolve }
  var pendingDownloads = new Map();

  function broadcast(type, payload) {
    try {
      chrome.runtime.sendMessage(Object.assign({ type: type }, payload || {}), function () {
        void chrome.runtime.lastError; // no UI listening is normal
      });
    } catch (e) {}
  }

  function emit(job) {
    job.updatedAt = Date.now();
    DB.putJob(job).catch(function () {});
    broadcast('PP_JOB_UPDATE', { job: job });
  }

  chrome.downloads.onChanged.addListener(function (delta) {
    if (!delta.state || !delta.state.current) return;
    var info = pendingDownloads.get(delta.id);
    if (!info) return;
    if (delta.state.current === 'complete' || delta.state.current === 'interrupted') {
      clearTimeout(info.timer);
      pendingDownloads.delete(delta.id);
      info.resolve({
        ok: delta.state.current === 'complete',
        error: (delta.error && delta.error.current) || ''
      });
    }
  });

  function downloadOne(url, filename, conflictAction) {
    return new Promise(function (resolve) {
      chrome.downloads.download({ url: url, filename: filename, conflictAction: conflictAction || 'uniquify', saveAs: false }, function (id) {
        if (chrome.runtime.lastError || !id) {
          var message = (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'no id';
          console.warn('[PostPocket] download failed:', message, 'file:', filename, 'url:', String(url).slice(0, 90));
          resolve({ ok: false, error: message });
          return;
        }
        var timer = setTimeout(function () {
          pendingDownloads.delete(id);
          resolve({ ok: false, error: 'timeout' });
        }, 45000);
        pendingDownloads.set(id, { resolve: resolve, timer: timer });
      });
    });
  }

  async function fetchWithSession(url) {
    var res = await fetch(url, { credentials: 'include', signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.blob();
  }

  async function hashBlob(blob) {
    try {
      var buf = await blob.arrayBuffer();
      var digest = await crypto.subtle.digest('SHA-256', buf);
      var bytes = new Uint8Array(digest);
      return Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (e) { return ''; }
  }

  async function waitIfPaused(job, id) {
    while (active.has(id) && active.get(id).paused) await U.sleep(200);
  }

  async function hashExists(hash) {
    if (!hash) return false;
    try {
      var posts = await DB.allPosts();
      return posts.some(function (p) {
        return (p.images || []).some(function (im) { return im.hash === hash; });
      });
    } catch (e) { return false; }
  }

  async function processImage(job, post, img, index, settings) {
    var ext = img.ext || 'jpg';
    var filename = Naming.destination(post, settings) + '/' + Naming.imageName(post, index + 1, ext, settings);
    var result = { index: index + 1, ok: false, filename: filename, sourceUrl: img.url, error: '' };
    if (!img.url && !img.importKey) { result.error = 'No image source'; return result; }
    var blob = null;

    if (img.local && img.importKey) {
      try { blob = await DB.getBlob(img.importKey); } catch (e) { blob = null; }
    }
    if (!blob && img.url && settings.storeImages) {
      try { blob = await fetchWithSession(img.url); } catch (e) { blob = null; }
    }

    if (blob) result.hash = await hashBlob(blob);
    if (result.hash && settings.duplicateMode !== 'review' && await hashExists(result.hash)) {
      result.ok = true;
      result.duplicate = true;
      return result;
    }

    // Prefer bytes we already fetched, handed to the downloader as a short
    // offscreen blob URL (no base64 string, no large IPC payload).
    var r = { ok: false, error: 'no attempt' };
    var conflict = settings.existingFiles === 'replace' ? 'overwrite' : 'uniquify';
    var tmpKey = null, tmpUrl = null;
    if (blob) {
      try {
        tmpKey = 'tmp:' + U.uid('dl');
        var br = await PPBlob.urlForBlob(blob, tmpKey);
        if (br.ok) { tmpUrl = br.url; r = await downloadOne(tmpUrl, filename, conflict); }
      } catch (e) { r = { ok: false, error: String(e.message || e) }; }
    }
    if (!r.ok) r = await downloadOne(img.url, filename, conflict);
    if (tmpUrl) await PPBlob.revoke(tmpUrl, tmpKey);
    if (!r.ok && img.alternates && img.alternates.length) {
      for (var i = 0; i < img.alternates.length; i++) {
        r = await downloadOne(img.alternates[i], filename, conflict);
        if (r.ok) break;
      }
    }

    result.ok = r.ok;
    result.error = r.error || '';

    if (blob && settings.storeImages) {
      await DB.putBlob(job.id + ':' + post.id + ':' + index, blob);
      result.bytes = blob.size;
    }
    return result;
  }

  function postFromJob(job, post) {
    return {
      id: post.id || U.uid('post'),
      postId: post.postId,
      sourceType: post.sourceType || 'Other',
      sourceName: post.sourceName || 'Unknown',
      author: post.author || 'Unknown',
      date: post.date || U.todayISO(),
      topic: post.topic || 'General',
      title: post.title || 'post',
      text: post.text || '',
      postUrl: post.postUrl || '',
      images: (post.images || []).map(function (im, i) {
        var r = (job.results || []).find(function (x) { return x.postId === post.id && x.index === i + 1; });
        return Object.assign({}, im, { saved: !!(r && r.ok), hash: r && r.hash, bytes: r && r.bytes });
      }),
      favorite: false,
      tags: [],
      deleted: false,
      folder: Naming.destination(post, job.settings || {}),
      savedAt: Date.now(),
      jobId: job.id
    };
  }

  async function runJob(job) {
    var control = active.get(job.id);
    var settings = job.settings || {};
    job.status = 'running';
    job.startedAt = job.startedAt || Date.now();
    emit(job);

    var posts = job.posts || [];
    var total = 0;
    posts.forEach(function (p) { total += (p.selectedImages || p.images.map(function (_, i) { return i; })).length; });
    job.total = total;
    job.done = job.done || 0;
    job.results = job.results || [];
    emit(job);

    var limit = Math.max(1, parseInt(settings.concurrency, 10) || 1);
    var inFlight = new Set();

    // Runs one image with retries and records the result.
    async function runOne(post, idx) {
      try {
        var attempt = 0;
        var res = null;
        while (attempt <= (settings.retryCount || 0)) {
          res = await processImage(job, post, post.images[idx], idx, settings);
          if (res.ok) break;
          attempt++;
          if (attempt <= (settings.retryCount || 0)) await U.sleep(400 * attempt);
        }
        res.postId = post.id;
        job.results.push(res);
      } catch (e) {
        job.results.push({ postId: post.id, index: idx + 1, ok: false, error: String(e && e.message || e) });
      }
      job.done++;
      emit(job);
      if (settings.delayMs) await U.sleep(Math.min(1000, settings.delayMs));
    }

    for (var pi = 0; pi < posts.length; pi++) {
      if (!active.has(job.id) || control.cancelled) break;
      await waitIfPaused(job, job.id);
      var post = posts[pi];
      var indices = post.selectedImages || post.images.map(function (_, i) { return i; });
      job.currentPost = post.title || ('Post ' + (pi + 1));
      emit(job);

      for (var ii = 0; ii < indices.length; ii++) {
        if (!active.has(job.id) || control.cancelled) break;
        await waitIfPaused(job, job.id);
        var idx = indices[ii];
        var img = post.images[idx];
        if (!img) continue;

        // Resume support: never redo work already completed before a restart.
        var cursor = job.cursor;
        if (cursor && (pi < cursor.pi || (pi === cursor.pi && ii <= cursor.ii))) continue;
        var alreadyDone = (job.results || []).some(function (r) {
          return r.ok && r.postId === post.id && r.index === idx + 1;
        });
        if (alreadyDone) continue;
        job.cursor = { pi: pi, ii: ii };
        emit(job);

        // Concurrency: keep up to `limit` image downloads in flight at once.
        var p = runOne(post, idx).then(function () { inFlight.delete(p); });
        inFlight.add(p);
        if (inFlight.size >= limit) await Promise.race(Array.from(inFlight));
      }
    }
    if (!control.cancelled && inFlight.size) await Promise.all(Array.from(inFlight));

    var failed = job.results.filter(function (r) { return !r.ok; }).length;
    if (control.cancelled) job.status = 'cancelled';
    else if (failed && settings.pauseOnError) job.status = 'paused';
    else job.status = failed ? 'done_with_errors' : 'done';

    for (var pj = 0; pj < posts.length; pj++) {
      var record = postFromJob(job, posts[pj]);
      var existing = await DB.getPost(record.id);
      if (existing) record.favorite = existing.favorite, record.tags = existing.tags || [];
      await DB.putPost(record);
    }

    job.cursor = null;
    job.finishedAt = Date.now();
    emit(job);
    active.delete(job.id);
    broadcast('PP_JOB_FINISHED', { jobId: job.id, status: job.status });
  }

  var Queue = {
    create: async function (payload) {
      var settings = Object.assign({}, await Settings.get(), payload.settings || {});
      var job = {
        id: U.uid('job'),
        kind: payload.kind || 'download',
        status: 'queued',
        posts: payload.posts || [],
        settings: settings,
        results: [],
        done: 0,
        total: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await DB.putJob(job);
      emit(job);
      return job;
    },

    start: async function (id) {
      if (active.has(id)) return;
      var job = await DB.getJob(id);
      if (!job || job.status === 'done' || job.status === 'cancelled') return;
      active.set(id, { paused: false, cancelled: false });
      runJob(job).catch(function (e) {
        job.status = 'failed'; job.error = String(e && e.message || e); emit(job); active.delete(id);
      });
    },

    pause: async function (id) {
      var c = active.get(id);
      var job = await DB.getJob(id);
      if (!job) return;
      if (c) c.paused = true;
      job.status = 'paused'; emit(job);
    },

    resume: async function (id) {
      var job = await DB.getJob(id);
      if (!job) return;
      var c = active.get(id);
      if (c) { c.paused = false; job.status = 'running'; emit(job); return; }
      await Queue.start(id);
    },

    cancel: async function (id) {
      var c = active.get(id);
      if (c) { c.cancelled = true; c.paused = false; }
      var job = await DB.getJob(id);
      if (job) { job.status = 'cancelled'; emit(job); }
    },

    retryFailed: async function (id) {
      var job = await DB.getJob(id);
      if (!job) return;
      job.results = job.results.filter(function (r) { return r.ok; });
      job.done = job.results.length;
      job.status = 'queued';
      emit(job);
      await Queue.start(id);
    },

    remove: async function (id) {
      await Queue.cancel(id);
      await U.sleep(250);
      await DB.deleteJob(id);
      broadcast('PP_JOB_UPDATE', { job: { id: id, removed: true } });
    },

    resumePersisted: async function () {
      var jobs = await DB.allJobs();
      for (var i = 0; i < jobs.length; i++) {
        if (jobs[i].status === 'running' || jobs[i].status === 'queued') await Queue.start(jobs[i].id);
      }
    },

    list: function () { return DB.allJobs(); }
  };

  global.PPQueue = Queue;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
