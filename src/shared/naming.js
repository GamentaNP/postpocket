/*
 * PostPocket — naming engine.
 * Folder and image filename templates with preset patterns.
 * Tokens: {date} {time} {year} {month} {source} {type} {author}
 *         {postid} {shortid} {title} {slug} {index} {topic} {ext}
 */
(function (global) {
  'use strict';
  var U = global.FBPUtils;

  var PRESETS = [
    { id: 'date-title', label: 'Date + title', folder: '{date}_{title}', image: '{index}_{slug}' },
    { id: 'number-title', label: 'Number + title', folder: '{index}_{title}', image: '{index}' },
    { id: 'source-postid', label: 'Source + post ID', folder: '{type}_{source}_{shortid}', image: '{index}' },
    { id: 'topic-date', label: 'Topic + date', folder: '{topic}_{date}_{title}', image: '{index}_{slug}' },
    { id: 'full', label: 'Full detail', folder: '{date}_{type}_{source}_{author}_{shortid}', image: '{index}_{slug}' }
  ];

  function tokens(meta, index, ext) {
    var date = meta.date || U.todayISO();
    var title = String(meta.title || meta.sourceName || 'post').replace(/\s+/g, ' ').trim();
    return {
      date: U.pathSegment(date, 10),
      time: U.pathSegment(meta.time || '', 8),
      year: date.slice(0, 4),
      month: U.monthKey(date).replace('-', '_'),
      source: U.pathSegment(meta.sourceName || 'Unknown', 48),
      type: U.pathSegment(meta.sourceType || 'Other', 20),
      author: U.pathSegment(meta.author || 'Unknown', 40),
      postid: U.pathSegment(meta.postId || 'na', 30),
      shortid: U.shortId(meta.postId),
      title: U.pathSegment(title.slice(0, 48), 52),
      slug: U.slug(title, 36),
      index: String(index == null ? 1 : index).padStart(2, '0'),
      topic: U.pathSegment(meta.topic || 'General', 30),
      ext: ext || 'jpg'
    };
  }

  function apply(template, t) {
    return String(template || '').replace(/\{(\w+)\}/g, function (m, key) {
      return Object.prototype.hasOwnProperty.call(t, key) ? t[key] : m;
    });
  }

  function folderName(meta, settings) {
    var s = settings || {};
    var pattern = s.folderTemplate || (PRESETS.find(function (p) { return p.id === (s.folderPreset || 'date-title'); }) || PRESETS[0]).folder;
    var t = tokens(meta, 1, '');
    var name = U.sanitizeSegment(apply(pattern, t), 120);
    if (s.prefix) name = U.sanitizeSegment(s.prefix, 24) + '_' + name;
    return name;
  }

  function imageName(meta, index, ext, settings) {
    var s = settings || {};
    var pattern = s.imageTemplate || (PRESETS.find(function (p) { return p.id === (s.imagePreset || 'date-title'); }) || PRESETS[0]).image;
    var t = tokens(meta, index, ext);
    return U.sanitizeSegment(apply(pattern, t), 100) + '.' + (ext || 'jpg');
  }

  function destination(meta, settings) {
    var s = settings || {};
    var root = U.sanitizeSegment(s.rootFolder || 'PostPocket', 60);
    var parts = [root];
    if (s.organizeBy === 'source') parts.push(U.pathSegment(meta.sourceType || 'Other', 20) + '_' + U.pathSegment(meta.sourceName || 'Unknown', 48));
    else if (s.organizeBy === 'month') parts.push(U.monthKey(meta.date) || 'undated');
    else if (s.organizeBy === 'year') parts.push(String(meta.date || '').slice(0, 4) || 'undated');
    else if (s.organizeBy === 'topic') parts.push(U.pathSegment(meta.topic || 'General', 30));
    parts.push(folderName(meta, s));
    return parts.join('/');
  }

  global.PPNaming = {
    PRESETS: PRESETS,
    tokens: tokens,
    apply: apply,
    folderName: folderName,
    imageName: imageName,
    destination: destination
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
