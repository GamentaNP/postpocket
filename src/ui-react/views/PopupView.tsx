import React, { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { imageSrc } from '../lib/format'
import { ThumbGrid } from '../components'
import type { Post } from '../lib/types'

export default function PopupView({ onOpenDashboard, onOpenSidePanel }: { onOpenDashboard: () => void; onOpenSidePanel: () => void }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [active, setActive] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('Scanning this page…')
  const [failed, setFailed] = useState(false)

  async function scan() {
    setBusy(true); setFailed(false); setMessage('Scanning this page…')
    const res = await api.scan('all')
    setBusy(false)
    if (!res.ok) { setPosts([]); setFailed(true); setMessage(res.error || 'Could not scan this page.'); return }
    const raw = Array.isArray(res.data) ? res.data : [res.data]
    const found = (raw as Post[]).filter((p) => p && p.found && p.images?.length)
    if (!found.length) { setPosts([]); setFailed(true); setMessage('No post images on this page. Open a single post permalink, then scan again.'); return }
    setPosts(found); setActive(0)
    setSelected(new Set(found[0].images.map((_, i) => i)))
    setMessage('')
  }

  useEffect(() => { scan() }, [])

  const post = posts[active] || null

  function choose(index: number) {
    setActive(index)
    setSelected(new Set(posts[index].images.map((_, i) => i)))
  }

  async function expand() {
    if (!post?.expandHref) return
    toast('Loading all photos…')
    const r = await api.expandPost(post.expandHref)
    if (!r.ok || !r.data?.length) { toast(r.error || 'Could not load all photos', 'error'); return }
    const next = [...posts]
    next[active] = { ...post, images: r.data, extraCount: 0 }
    setPosts(next); setSelected(new Set(r.data.map((_, i) => i)))
    toast(`Loaded all ${r.data.length} images`)
  }

  async function save() {
    if (!post) return
    const res = await api.collect([{ ...post, selectedImages: Array.from(selected) }])
    if (!res.ok) { toast(res.error || 'Could not start', 'error'); return }
    toast(`Started — ${res.job?.total || selected.size} image(s) queued`)
  }

  return (
    <>
      {message && <div className={`notice ${failed ? 'warn' : 'ok'}`}>{message}</div>}

      {posts.length > 1 && (
        <div className="card" style={{ padding: 10 }}>
          <div className="path-label" style={{ marginBottom: 6 }}>{posts.length} posts on this page — choose one</div>
          <div className="btn-row">
            {posts.map((p, i) => (
              <button key={p.id} className={`btn ${i === active ? 'primary' : 'quiet'} sm`} onClick={() => choose(i)}>
                {p.sourceName.slice(0, 12)} · {p.images.length}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Current post</h3>
          <button className="btn quiet sm" disabled={busy} onClick={scan}>{busy ? 'Scanning…' : 'Scan again'}</button>
        </div>
        {post ? <>
          <div className="source-top"><span className="badge">{post.sourceType}</span><span className="scan-state">Post captured</span></div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 17, margin: '7px 0 3px' }}>{post.sourceName}</h2>
          <p className="title-line">{post.title}</p>
          <div className="meta-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 8 }}>
            <div><span>Author</span><strong>{post.author}</strong></div><div><span>Posted</span><strong>{post.date}</strong></div>
          </div>
        </> : <div style={{ color: 'var(--muted)', fontSize: 12 }}>{busy ? 'Scanning this page…' : 'No post captured.'}</div>}
      </div>

      {!!post?.extraCount && (
        <div className="notice warn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>{post.extraCount} more photos hidden behind “+{post.extraCount}”.</span>
          <button className="btn ghost sm" onClick={expand}>Load all</button>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>Images</h3><span className="scan-state">{post ? `${selected.size} / ${post.images.length} selected` : '—'}</span></div>
        {post ? <ThumbGrid images={post.images} selected={selected} size="small" onToggle={(i) => {
          const next = new Set(selected); next.has(i) ? next.delete(i) : next.add(i); setSelected(next)
        }} /> : <div className="grid-empty">No images yet.</div>}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn primary" style={{ flex: 1 }} disabled={!post || !selected.size} onClick={save}>Save selected</button>
          <button className="btn ghost" onClick={onOpenSidePanel}>Side panel</button>
        </div>
      </div>
      <div className="foot">Auto-scans the page when opened — never auto-downloads. Everything stays on this device.</div>
    </>
  )
}
