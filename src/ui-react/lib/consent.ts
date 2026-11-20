export interface ConsentRecord { accepted: boolean; version: number; at: number }

const KEY = 'consent'
const VERSION = 1

export async function getConsent(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.storage) return true
  return new Promise((resolve) => {
    chrome.storage.local.get(KEY, (r: any) => {
      const c = r && r[KEY]
      resolve(!!(c && c.accepted && c.version === VERSION))
    })
  })
}

export async function acceptConsent(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) return
  const record: ConsentRecord = { accepted: true, version: VERSION, at: Date.now() }
  await new Promise<void>((resolve) => chrome.storage.local.set({ [KEY]: record }, () => resolve()))
}
