import React, { useState } from 'react'
import { COLLECT_METHODS, APP } from '../lib/config'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { imageSrc, uid } from '../lib/format'
import { ThumbGrid, ViewHead } from '../components'
import type { Post, Settings } from '../lib/types'

interface Props { settings: Settings; onOpenDashboard: () => void; initialMethod?: string }

export default function CollectView({ settings, onOpenDashboard, initialMethod = 'single' }: Props) {
  const [method, setMethod] = useState(initialMethod)
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPosts, setSelected] = useState<Set<string>>(new Set())
  const [imageSelection, setImageSelection] = useState<Record<string, Set<number>>>({})
  const [busy, setBusy] = useState(false)
  const [folderTemplate, setFolderTemplate] = useState(settings.folderTemplate || '')
  const [imageTemplate, setImageTemplate] = useState(settings.imageTemplate || '')

  async function scan(mode: 'current' | 'all') {
    setBusy(true)
    const res = await api.scan(mode)
    setBusy(false)
    if (!res.ok) { toast(res.error || 'Scan failed', 'error'); return }
    const data = Array.isArray(res.data) ? res.data : [res.data]
    let found = (data as Post[]).filter((p) => p && p.found && p.images?.length)
    if (settings.dateFilter && settings.dateFilter !== 'all') {
      const now = Date.now()
      found = found.filter((p) => {
        const d = new Date(p.date || '').getTime()
        if (isNaN(d)) return true
        const days = (now - d) / 86400000
        if (settings.dateFilter === 'today') return days <= 1
        if (settings.dateFilter === 'week') return days <= 7
        if (settings.dateFilter === 'month') return days <= 31
        if (settings.dateFilter === 'year') return days <= 365
        return true
      })
    }
    found = found.map((p) => {
      let images = p.images.filter((im) => !settings.formats?.length || settings.formats.includes(im.ext || 'jpg'))
      if (settings.imageOrder === 'filename') images = images.slice().sort((a, b) => String(a.name || a.url).localeCompare(String(b.name || b.url)))
      if (settings.imageOrder === 'date') images = images.slice().sort((a, b) => (b.width || 0) - (a.width || 0))
      if (settings.quantity !== 'all') images = images.slice(0, Number(settings.quantityValue) || 25)
      return { ...p, images }
    }).filter((p) => p.images.length)
    if (!found.length) { toast('No post images found. Open a post permalink and try again.', 'warn'); return }
    setPosts(found)
    setSelected(new Set(found.map((p) => p.id)))
    const next: Record<string, Set<number>> = {}
    found.forEach((p) => { next[p.id] = new Set(p.images.map((_, i) => i)) })
    setImageSelection(next)
    toast(`Captured ${found.length} post(s)`)
  }

  async function resolveUrl(post: Post) {
    if (!post.postUrl) return
    toast('Opening the photo viewer in a visible tab…')
    const r = await api.expandPost(post.postUrl)
    if (!r.ok || !r.data?.length) { toast(r.error || 'Could not resolve this link', 'error'); return }
    const next = posts.map((p) => p.id === post.id ? { ...p, images: r.data } : p)
    setPosts(next)
    setImageSelection((sel) => ({ ...sel, [post.id]: new Set(r.data.map((_: any, i: number) => i)) }))
    toast(`Resolved ${r.data.length} images — close the viewer tab when done`)
  }

  function togglePost(id: string) {
    const next = new Set(selectedPosts)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  function toggleImage(postId: string, index: number) {
    const next = { ...imageSelection }
    const set = new Set(next[postId] || [])
    if (set.has(index)) set.delete(index); else set.add(index)
    next[postId] = set
    setImageSelection(next)
  }

  const chosen = posts.filter((p) => selectedPosts.has(p.id))
  const totalSelected = chosen.reduce((sum, p) => sum + (imageSelection[p.id]?.size || 0), 0)

  async function collect() {
    const payload = chosen.map((p) => ({ ...p, selectedImages: Array.from(imageSelection[p.id] || []) }))
    const res = await api.collect(payload, { folderTemplate, imageTemplate })
    if (!res.ok) { toast(res.error || 'Could not start', 'error'); return }
    toast(`Started — ${res.job?.total ?? totalSelected} image(s) queued`)
    if (settings.previewMode === 'sidepanel') {
      const tabs = await new Promise<any[]>((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve))
      await api.openSidePanel(tabs[0]?.id)
    } else if (settings.previewMode === 'newtab') {
      await api.openDashboard()
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const DB = (window as any).PPDB
    const groups: Record<string, { name: string; blob: Blob }[]> = {}
    const push = (group: string, name: string, blob: Blob) => { (groups[group] ||= []).push({ name, blob }) }

    for (const f of Array.from(files)) {
      if (/\.zip$/i.test(f.name)) {
        try {
          const entries = await (window as any).PPZip.readZip(await f.arrayBuffer())
          entries.forEach((e: any) => {
            if (!/\.(jpe?g|png|gif|webp|bmp)$/i.test(e.name)) return
            const parts = e.name.split('/')
            push(parts.length > 1 ? parts[parts.length - 2] : 'ZIP images', e.name, new Blob([e.data]))
          })
        } catch (e) { toast(`Could not read ${f.name}`, 'error') }
      } else if (f.type.startsWith('image/')) {
        const path = (f as any).webkitRelativePath || f.name
        const group = method === 'archive' ? (path.split('/')[0] || 'Archive') : 'Imported images'
        push(group, f.name, f)
      }
    }

    const made: Post[] = []
    for (const group of Object.keys(groups)) {
      const post: Post = {
        id: uid('post'), postId: uid('imp').slice(-10), sourceType: method === 'archive' ? 'Archive' : 'Local',
        sourceName: method === 'archive' ? (group || 'Facebook archive') : 'Imported files', author: 'Imported',
        date: new Date().toISOString().slice(0, 10), title: group, text: '', postUrl: '', images: [], found: true,
      }
      for (let i = 0; i < groups[group].length; i++) {
        const item = groups[group][i]
        const key = 'import:' + post.id + ':' + i
        if (DB) await DB.putBlob(key, item.blob)
        post.images.push({
          url: '', thumb: URL.createObjectURL(item.blob), ext: item.name.split('.').pop() || 'jpg',
          local: true, importKey: key, name: item.name,
        })
      }
      made.push(post)
    }
    if (!made.length) { toast('No images found in those files', 'warn'); return }
    setPosts(made); setSelected(new Set(made.map((p) => p.id)))
    const next: Record<string, Set<number>> = {}
    made.forEach((p) => { next[p.id] = new Set(p.images.map((_, i) => i)) })
    setImageSelection(next)
    toast(`${made.length} post folder(s) imported`)
  }

  return (
    <>
      <ViewHead eyebrow="Step 01 — choose a source" title="Collect" description="Only images from the page you are viewing or files you choose. No background crawling." />
      <div className="collect-grid">
        {COLLECT_METHODS.map((m) => (
          <button key={m.id} className={`collect-card ${method === m.id ? 'selected' : ''}`} onClick={() => setMethod(m.id)}>
            <div className="ic">{m.icon}</div><div className="t">{m.title}</div><div className="d">{m.desc}</div>
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        {(method === 'single' || method === 'multi') && (
          <>
            <div className="card-head"><h3>{method === 'single' ? 'Current Facebook post' : 'All loaded posts'}</h3><span className="scan-state">Read-only · your current tab</span></div>
            <div className="btn-row">
              <button className="btn primary" disabled={busy} onClick={() => scan(method === 'multi' ? 'all' : 'current')}>{busy ? 'Scanning…' : method === 'multi' ? 'Scan all loaded posts' : 'Scan this post'}</button>
              <a className="btn ghost" href="https://www.facebook.com/" target="_blank" rel="noreferrer">Open Facebook</a>
            </div>
          </>
        )}
        {method === 'urls' && (
          <>
            <div className="card-head"><h3>Post URL queue</h3><span className="scan-state">One link per line</span></div>
            <label className="field"><span>Facebook post links</span><textarea id="urlList" placeholder="https://www.facebook.com/groups/.../posts/1234567890/" /></label>
            <button className="btn primary" onClick={() => {
              const area = document.getElementById('urlList') as HTMLTextAreaElement
              const links = area.value.split(/\s+/).filter((u) => /facebook\.com/i.test(u))
              const made: Post[] = links.map((u) => ({
                id: uid('post'), postId: (u.match(/\/posts\/(\d+)/) || [])[1] || uid('q'), sourceType: 'Queued',
                sourceName: 'Post link', author: '—', date: new Date().toISOString().slice(0, 10), title: u.slice(0, 60),
                text: '', postUrl: u, images: [], found: true,
              }))
              setPosts([...posts, ...made]); setSelected(new Set([...selectedPosts, ...made.map((p) => p.id)])); area.value = ''
              toast(`${made.length} link(s) added`)
            }}>Add to queue</button>
          </>
        )}
        {(method === 'local' || method === 'archive') && (
          <>
            <div className="card-head"><h3>{method === 'archive' ? 'Facebook archive folder' : 'Local files or ZIP'}</h3></div>
            <p style={{ color: 'var(--muted)', fontSize: 12 }}>{method === 'archive' ? 'Choose a folder from your own Facebook data export.' : 'Select images or a folder. Files stay on this device.'}</p>
            <label className="field"><span>Select {method === 'archive' ? 'folder' : 'files'}</span>
              <input type="file" multiple={method !== 'archive'} {...(method === 'archive' ? { webkitdirectory: '' } : {})} accept={method === 'archive' ? undefined : 'image/*,.zip'} onChange={(e) => handleFiles(e.target.files)} />
            </label>
          </>
        )}
      </div>

      {posts.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>Captured posts</h3><span className="scan-state">{posts.length} post(s)</span></div>
          <div className="list">
            {posts.map((p) => (
              <div className="row" key={p.id}>
                {imageSrc(p.images[0]) ? <img className="thumb-mini" src={imageSrc(p.images[0])} alt="" /> : <div className="thumb-mini" />}
                <div className="grow"><div className="t">{p.title}</div><div className="m">{p.sourceType} · {p.sourceName} · {p.images.length} image(s)</div></div>
                <label className="check-row" style={{ margin: 0 }}><input type="checkbox" checked={selectedPosts.has(p.id)} onChange={() => togglePost(p.id)} /></label>
                {!p.images.length && p.postUrl && <button className="btn ghost sm" onClick={() => resolveUrl(p)}>Resolve</button>}
                {p.postUrl && <a className="btn quiet sm" href={p.postUrl} target="_blank" rel="noreferrer">Open</a>}
              </div>
            ))}
          </div>
        </div>
      )}

      {chosen.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>Clean preview &amp; selection</h3><span className="scan-state">{chosen.length} post(s) · {totalSelected} image(s)</span></div>
          <div className="btn-row" style={{ marginBottom: 10 }}>
            <button className="btn quiet sm" onClick={() => setSelected(new Set(posts.map((p) => p.id)))}>Select all posts</button>
            <button className="btn quiet sm" onClick={() => setSelected(new Set())}>Clear</button>
            <button className="btn quiet sm" onClick={() => {
              const next: Record<string, Set<number>> = {}
              chosen.forEach((p) => { next[p.id] = new Set(p.images.map((_, i) => i)) })
              setImageSelection(next)
            }}>Select all images</button>
          </div>
          {chosen.map((p) => (
            <div key={p.id} style={{ marginBottom: 16 }}>
              <div className="row" style={{ background: 'transparent', border: 'none', padding: '4px 0' }}>
                <div className="grow"><div className="t">{p.title}</div><div className="m">{p.sourceName} · {p.images.length} images</div></div>
              </div>
              <ThumbGrid images={p.images} selected={imageSelection[p.id] || new Set()} onToggle={(i) => toggleImage(p.id, i)} size={(settings.gridSize || 'medium') as 'small' | 'medium' | 'large'} />
            </div>
          ))}
          <div className="form-grid" style={{ marginTop: 8 }}>
            <label className="field"><span>Folder naming pattern</span><input value={folderTemplate} onChange={(e) => setFolderTemplate(e.target.value)} placeholder="{date}_{title}" /></label>
            <label className="field"><span>Image naming pattern</span><input value={imageTemplate} onChange={(e) => setImageTemplate(e.target.value)} placeholder="{index}_{slug}" /></label>
          </div>
          <div className="path-preview"><span className="path-label">Destination preview</span><code>
            {`${settings.rootFolder}/${chosen[0].sourceType}_${chosen[0].sourceName}/${chosen[0].date}_${chosen[0].title} / ${folderTemplate || '{date}_{title}'}`}
          </code></div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={!totalSelected} onClick={collect}>Start collection · {totalSelected} images</button>
            <button className="btn ghost" onClick={onOpenDashboard}>Open full workspace ↗</button>
          </div>
        </div>
      )}
      <div className="foot">Scanning is manual by design — PostPocket never auto-downloads when you open the popup.</div>
    </>
  )
}
