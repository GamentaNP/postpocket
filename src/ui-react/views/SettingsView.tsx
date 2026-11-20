import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { APP, PERMISSIONS, SETTINGS_GROUPS, NAMING_TOKENS } from '../lib/config'
import { ConfirmDialog, ViewHead } from '../components'
import type { Settings } from '../lib/types'

type Option = string | [string, string]

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [group, setGroup] = useState('download')
  const [confirmReset, setConfirmReset] = useState(false)

  async function load() { const r = await api.settings(); setSettings((r.data as Settings) || null) }
  useEffect(() => { load() }, [])

  async function patch(key: string, value: any) {
    setSettings((s) => s ? { ...s, [key]: value } : s)
    const r = await api.setSettings({ [key]: value })
    if (r.data) setSettings(r.data)
    if (key === 'theme') document.documentElement.setAttribute('data-theme', value)
  }

  if (!settings) return <div className="empty-state">Loading settings…</div>

  const select = (key: string, options: Option[]) => (
    <select className="input" value={String(settings[key] ?? '')} onChange={(e) => patch(key, e.target.value)}>
      {options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{l}</option> })}
    </select>
  )
  const input = (key: string, type = 'text') => (
    <input className="input" type={type} value={settings[key] ?? ''} onChange={(e) => patch(key, type === 'number' ? Number(e.target.value) : e.target.value)} />
  )
  const check = (key: string, label: string) => (
    <label className="check-row"><input type="checkbox" checked={!!settings[key]} onChange={(e) => patch(key, e.target.checked)} /><span>{label}</span></label>
  )
  const field = (label: string, control: React.ReactNode) => <label className="field"><span>{label}</span>{control}</label>

  let body: React.ReactNode = null
  const presets = (window as any).PPNaming?.PRESETS || [
    { id: 'date-title', label: 'Date + title' }, { id: 'number-title', label: 'Number + title' },
    { id: 'source-postid', label: 'Source + post ID' }, { id: 'topic-date', label: 'Topic + date' }, { id: 'full', label: 'Full detail' },
  ]

  if (group === 'download') body = <>
    <div className="form-grid">
      {field('Save images to', select('destination', [['downloads', 'Chrome Downloads / PostPocket'], ['folder', 'My selected permanent folder'], ['ask', 'Ask me every time'], ['zip', 'ZIP export only']]))}
      {field('Root folder', input('rootFolder'))}
      {field('Image quality', select('quality', [['largest', 'Largest available'], ['original', 'Original source where available'], ['smaller', 'Smaller files']]))}
      {field('Download quantity', select('quantity', [['all', 'All selected'], ['latest', 'Latest N'], ['custom', 'Custom count']]))}
      {field('Custom count', input('quantityValue', 'number'))}
      {field('Date filter', select('dateFilter', [['all', 'All dates'], ['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['year', 'This year'], ['custom', 'Custom range']]))}
      {field('Existing files', select('existingFiles', [['uniquify', 'Keep both (rename)'], ['replace', 'Replace'], ['rename', 'Rename']]))}
    </div>
    <p className="foot">The Chrome Downloads API can create subfolders inside Downloads. A permanent external folder needs the File System Access permission.</p>
  </>
  if (group === 'folder') body = <>
    <div className="form-grid">
      {field('Folder name format', select('folderPreset', presets.map((p: any) => [p.id, p.label])))}
      {field('Custom folder template', input('folderTemplate'))}
      {field('Image name format', select('imagePreset', presets.map((p: any) => [p.id, p.label])))}
      {field('Custom image template', input('imageTemplate'))}
      {field('Custom prefix', input('prefix'))}
      {field('Organize by', select('organizeBy', [['none', 'Flat library'], ['source', 'Source page / group'], ['month', 'Month'], ['year', 'Year'], ['topic', 'Topic']]))}
    </div>
    <p className="foot">Tokens: {NAMING_TOKENS.map((t) => '{' + t + '}').join(' ')}</p>
  </>
  if (group === 'preview') body = <>
    <div className="form-grid">
      {field('After Collect, open', select('previewMode', [['newtab', 'New extension tab'], ['sidepanel', 'Chrome side panel'], ['inline', 'Inline preview'], ['ask', 'Ask every time']]))}
      {field('Grid size', select('gridSize', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]))}
    </div>
    {check('notifications', 'Show completion notifications')}
  </>
  if (group === 'queue') body = <>
    <div className="form-grid">
      {field('Parallel tasks', select('concurrency', [['1', '1 (gentlest)'], ['2', '2'], ['3', '3'], ['5', '5']]))}
      {field('Delay between images (ms)', input('delayMs', 'number'))}
      {field('Retry attempts', input('retryCount', 'number'))}
    </div>
    {check('pauseOnError', 'Pause queue when an image fails')}
  </>
  if (group === 'duplicates') body = <>{field('Duplicate handling', select('duplicateMode', [['skip', 'Skip duplicates'], ['rename', 'Keep and rename'], ['review', 'Ask me']]))}<p className="foot">SHA-256 hashes are computed locally while images are saved.</p></>
  if (group === 'metadata') body = <>
    {check('metaSidecar', 'Write post-info.json')}{check('metaCaption', 'Include post caption')}{check('metaDate', 'Include post date')}
    {check('metaSourceLink', 'Include original post link')}{check('metaPostId', 'Include post identifier')}
    {check('metaReadme', 'Write README.txt per post')}{check('metaCsv', 'Include post-index.csv in exports')}
  </>
  if (group === 'storage') body = <>
    {check('storeImages', 'Keep image copies locally (offline library and ZIP export)')}
    <p className="foot">Backup and restore are available in the Library view.</p>
    <div className="btn-row">
      <button className="btn ghost sm" onClick={() => api.exportData({ mode: 'backup' }).then((r) => toast(r.ok ? 'Backup downloaded' : 'Failed', r.ok ? 'ok' : 'error'))}>Download backup</button>
      <label className="btn ghost sm" style={{ position: 'relative', overflow: 'hidden' }}>Import backup
        <input type="file" accept=".json" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return
          const r = await api.importBackup(await f.text()); toast(r.ok ? 'Backup restored' : (r.error || 'Failed'), r.ok ? 'ok' : 'error')
        }} />
      </label>
    </div>
  </>
  if (group === 'privacy') body = <>
    <div className="notice ok">Local-only: no backend, no account, no analytics, no remote JavaScript. No password, cookie or token is ever requested.</div>
    <p className="foot">Permissions: {PERMISSIONS.map(([n, d]) => `${n} — ${d}`).join(' · ')}</p>
    <button className="btn danger sm" onClick={() => setConfirmReset(true)}>Delete entire local library</button>
  </>
  if (group === 'appearance') body = <div className="form-grid">{field('Theme', select('theme', [['dark', 'Dark'], ['light', 'Light'], ['system', 'System']]))}</div>
  if (group === 'shortcuts') body = <p className="foot">Use the toolbar icon to scan the current post. Floating in-page download buttons offer single-image and full-post saving directly on Facebook.</p>
  if (group === 'about') body = <p className="foot">{APP.fullName} v{APP.version} · Manifest V3 · {APP.tagline}</p>

  return (
    <>
      <ViewHead eyebrow="Preferences" title="Settings" description="Every option is saved on this device only."
        actions={<div className="btn-row"><button className="btn ghost sm" onClick={() => {
          navigator.clipboard?.writeText(JSON.stringify(settings, null, 2)).then(() => toast('Configuration copied'))
        }}>Copy configuration</button><button className="btn danger sm" onClick={() => setConfirmReset(true)}>Reset all</button></div>} />
      <div className="settings-layout">
        <div className="card" style={{ padding: 8 }}><div className="settings-nav">
          {SETTINGS_GROUPS.map((g) => <button key={g.id} className={`nav-item ${group === g.id ? 'active' : ''}`} onClick={() => setGroup(g.id)}>{g.label}</button>)}
        </div></div>
        <div className="card"><div className="card-head"><h3>{SETTINGS_GROUPS.find((g) => g.id === group)?.label}</h3><span className="scan-state">{SETTINGS_GROUPS.find((g) => g.id === group)?.hint}</span></div>{body}</div>
      </div>
      {confirmReset && <ConfirmDialog title="Reset everything?" message="Your library images are not affected." onClose={() => setConfirmReset(false)} onYes={async () => {
        await api.resetSettings(); await load(); toast('Settings reset')
      }} />}
    </>
  )
}
