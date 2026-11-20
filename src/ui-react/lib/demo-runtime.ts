import { MESSAGE, APP } from './config'
import { demoJobs, demoPosts, demoScanPost, demoSettings } from './demo'

/** Installs an in-memory chrome mock so every UI page can be previewed as a plain web page. */
export function installDemoRuntime(): boolean {
  if (typeof chrome !== 'undefined' && (chrome as any).runtime?.sendMessage) return false

  const settings = demoSettings()
  const responses: Record<string, any> = {
    [MESSAGE.PING]: { ok: true, version: `${APP.version}-demo` },
    [MESSAGE.SCAN]: { ok: true, data: demoScanPost() },
    [MESSAGE.EXPAND_POST]: { ok: true, data: demoScanPost().images },
    [MESSAGE.GET_SETTINGS]: { ok: true, data: settings, settings },
    [MESSAGE.GET_POSTS]: { ok: true, data: demoPosts() },
    [MESSAGE.GET_JOBS]: { ok: true, data: demoJobs() },
    [MESSAGE.OPEN_DASHBOARD]: { ok: true },
    [MESSAGE.OPEN_SIDEPANEL]: { ok: true },
    [MESSAGE.CLEAR_LIBRARY]: { ok: true },
    [MESSAGE.IMPORT_BACKUP]: { ok: true, data: { posts: 0, jobs: 0 } },
  }

  ;(window as any).chrome = {
    runtime: {
      sendMessage: (msg: any, cb: (r: any) => void) => {
        const res = responses[msg?.type] || { ok: true }
        if (msg?.type === MESSAGE.SET_SETTINGS) {
          Object.assign(settings, msg.patch || {})
          res.data = { ...settings }
        }
        if (msg?.type === MESSAGE.COLLECT) res.job = { id: 'demo_new_job', total: 6, done: 0 }
        setTimeout(() => cb(res), 30)
      },
      onMessage: { addListener: () => {} },
      getManifest: () => ({ version: `${APP.version}-demo` }),
      getURL: (p: string) => p,
      lastError: null,
    },
    storage: { local: { get: (_k: any, cb: any) => cb({}), set: (_o: any, cb?: any) => cb?.() } },
    tabs: { query: (_o: any, cb: any) => cb([{ id: 1, url: 'https://www.facebook.com/' }]), create: () => {} },
    sidePanel: { open: () => {} },
    downloads: {},
  }
  return true
}
