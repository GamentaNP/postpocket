import { MESSAGE } from './config'
import type { ApiResponse } from './types'

export function call<T = any>(type: string, payload: Record<string, any> = {}): Promise<ApiResponse<T>> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      resolve({ ok: false, error: 'Extension context required' })
      return
    }
    chrome.runtime.sendMessage({ type, ...payload }, (res: ApiResponse<T>) => {
      const lastError = (chrome.runtime as any).lastError
      if (lastError) resolve({ ok: false, error: lastError.message })
      else resolve(res || { ok: false })
    })
  })
}

export const api = {
  scan: (mode: 'current' | 'all') => call(MESSAGE.SCAN, { mode }),
  expandPost: (href: string) => call(MESSAGE.EXPAND_POST, { href }),
  settings: () => call(MESSAGE.GET_SETTINGS),
  setSettings: (patch: Partial<any>) => call(MESSAGE.SET_SETTINGS, { patch }),
  resetSettings: () => call(MESSAGE.RESET_SETTINGS),
  posts: () => call(MESSAGE.GET_POSTS),
  putPost: (post: any) => call(MESSAGE.PUT_POST, { post }),
  jobs: () => call(MESSAGE.GET_JOBS),
  collect: (posts: any[], settings?: any) => call(MESSAGE.COLLECT, { posts, settings }),
  jobAction: (action: string, id: string) => call(MESSAGE.JOB_ACTION, { action, id }),
  exportData: (payload: any) => call(MESSAGE.EXPORT, payload),
  importBackup: (json: string) => call(MESSAGE.IMPORT_BACKUP, { json }),
  openDashboard: () => call(MESSAGE.OPEN_DASHBOARD),
  openSidePanel: (tabId?: number) => call(MESSAGE.OPEN_SIDEPANEL, { tabId }),
  deletePost: (id: string) => call(MESSAGE.DELETE_POST, { id }),
  clearLibrary: () => call(MESSAGE.CLEAR_LIBRARY),
}
