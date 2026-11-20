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
    const found = (data as Post[]).filter((p) => p && p.found && p.images?.length)
    if (!found.length) { toast('No post images found. Open a post permalink and try again.', 'warn'); return }
    setPosts(found)
    setSelected(new Set(found.map((p) => p.id)))
    const next: Record<string, Set<number>> = {}
    found.forEach((p) => { next[p.id] = new Set(p.images.map((_, i) => i)) })
    setImageSelection(next)
    toast(`Captured ${found.length} post(s)`)
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
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const post: Post = {
      id: uid('post'), postId: uid('import').slice(-10), sourceType: method === 'archive' ? 'Archive' : 'Local',
      sourceName: method === 'archive' ? 'Facebook archive' : 'Imported files', author: 'Imported',
      date: new Date().toISOString().slice(0, 10), title: files[0].name, text: '', postUrl: '', images: [], found: true,
    }
    Array.from(files).filter((f) => f.type.startsWith('image/')).forEach((f, i) => {
      post.images.push({ url: '', thumb: URL.createObjectURL(f), ext: f.name.split('.').pop() || 'jpg', local: true, name: f.name })
    })
    if (!post.images.length) { toast('Select image files', 'warn'); return }
    setPosts([post]); setSelected(new Set([post.id])); setImageSelection({ [post.id]: new Set(post.images.map((_, i) => i)) })
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
              <ThumbGrid images={p.images} selected={imageSelection[p.id] || new Set()} onToggle={(i) => toggleImage(p.id, i)} size="medium" />
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
