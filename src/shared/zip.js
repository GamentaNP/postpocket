/*
 * PostPocket — dependency-free ZIP writer/reader.
 * Writer uses STORE (no compression) so images stay byte-identical.
 * Reader supports STORE and DEFLATE (via DecompressionStream, Chrome 103+).
 */
(function (global) {
  'use strict';

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function dosParts(date) {
    var d = date || new Date();
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  function concat(parts) {
    var size = 0;
    parts.forEach(function (p) { size += p.length || p.byteLength; });
    var out = new Uint8Array(size), off = 0;
    parts.forEach(function (p) {
      var a = p instanceof Uint8Array ? p : new Uint8Array(p);
      out.set(a, off); off += a.length;
    });
    return out;
  }

  /** entries: [{ name: 'folder/file.jpg', data: Uint8Array|ArrayBuffer|string }] */
  function createZip(entries) {
    var locals = [], central = [], offset = 0;
    var dp = dosParts(new Date());
    var enc = new TextEncoder();

    entries.forEach(function (entry) {
      var nameBytes = enc.encode(String(entry.name).replace(/\\/g, '/'));
      var data = typeof entry.data === 'string' ? enc.encode(entry.data)
        : (entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data || []));
      var crc = crc32(data);

      var lh = new Uint8Array(30 + nameBytes.length);
      var lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true); // UTF-8
      lv.setUint16(8, 0, true);      // STORE
      lv.setUint16(10, dp.time, true);
      lv.setUint16(12, dp.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      lh.set(nameBytes, 30);
      locals.push(lh, data);

      var ch = new Uint8Array(46 + nameBytes.length);
      var cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dp.time, true);
      cv.setUint16(14, dp.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint32(42, offset, true);
      ch.set(nameBytes, 46);
      central.push(ch);

      offset += lh.length + data.length;
    });

    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    return new Blob([concat(locals.concat(central, [eocd]))], { type: 'application/zip' });
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('DEFLATE unsupported in this browser');
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZip(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    var view = new DataView(arrayBuffer);
    var eocd = -1;
    for (var i = bytes.length - 22; i >= 0 && i >= bytes.length - 66000; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a valid ZIP file');
    var count = view.getUint16(eocd + 10, true);
    var off = view.getUint32(eocd + 16, true);
    var dec = new TextDecoder();
    var out = [];

    for (var n = 0; n < count; n++) {
      if (view.getUint32(off, true) !== 0x02014b50) break;
      var method = view.getUint16(off + 10, true);
      var csize = view.getUint32(off + 20, true);
      var fnLen = view.getUint16(off + 28, true);
      var exLen = view.getUint16(off + 30, true);
      var cmLen = view.getUint16(off + 32, true);
      var localOff = view.getUint32(off + 42, true);
      var name = dec.decode(bytes.subarray(off + 46, off + 46 + fnLen));
      var lNameLen = view.getUint16(localOff + 26, true);
      var lExLen = view.getUint16(localOff + 28, true);
      var dataStart = localOff + 30 + lNameLen + lExLen;
      var raw = bytes.subarray(dataStart, dataStart + csize);
      var data = method === 0 ? raw.slice() : await inflateRaw(raw);
      if (!/\/$/.test(name)) out.push({ name: name, data: data });
      off += 46 + fnLen + exLen + cmLen;
    }
    return out;
  }

  global.PPZip = { createZip: createZip, readZip: readZip, crc32: crc32 };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
