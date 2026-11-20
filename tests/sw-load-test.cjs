/* Smoke test: load the service worker and every imported module with stubbed chrome APIs. */
const path = require('path')

globalThis.self = globalThis
globalThis.chrome = {
  runtime: {
    onMessage: { addListener() {} },
    onInstalled: { addListener() {} },
    lastError: null,
    getManifest: () => ({ version: '2.2.0' }),
    getURL: (p) => 'chrome-extension://test/' + p,
    sendMessage: (_m, cb) => { if (cb) cb({ ok: true }) },
  },
  downloads: { onChanged: { addListener() {} }, download: () => {} },
  storage: { local: { get: (_k, cb) => cb({}), set: (_o, cb) => { if (cb) cb() } } },
  tabs: { create: async () => ({ id: 1 }), query: async () => [], sendMessage: async () => ({}), remove: async () => {} },
  scripting: { executeScript: async () => [] },
  offscreen: { createDocument: async () => {} },
}

const backgroundDir = path.resolve(__dirname, '..', 'src', 'background')
globalThis.importScripts = function () {
  for (const file of arguments) require(path.resolve(backgroundDir, file))
}

require(path.resolve(backgroundDir, 'service-worker.js'))
console.log('Service worker and all imported modules loaded successfully')
