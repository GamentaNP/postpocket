import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { debounce, formatBytes, imageSrc } from '../lib/format'
import { ConfirmDialog, Lightbox, Modal, StatCard, ViewHead } from '../components'
import { EXPORT_MODES } from '../lib/config'
import type { Post } from '../lib/types'

export default function LibraryView() {
  const [posts, setPosts] = useState<Post[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showDeleted, setShowDeleted] = useState(false)
  const [preview, setPreview] = useState<{ post: Post; index: number } | null>(null)
  const [editing, setEditing] = useState<{ post: Post; kind: 'tag' | 'rename' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Post | null>(null)

  async function load() { const r = await api.posts(); setPosts((r.data as Post[]) || []) }
  useEffect(() => { load() }, [])

  const visible = useMemo(() => {
    const q = query.toLowerCase()
    return posts
      .filter((p) => showDeleted ? !!p.deleted : !p.deleted)
      .filter((p) => filter === 'all' || (filter === 'fav' ? p.favorite : p.sourceType === filter))
      .filter((p) => !q || [p.title, p.text, p.sourceName, p.author, p.postId, (p.tags || []).join(' ')].join(' ').toLowerCase().includes(q))
      .sort((a, b) => sort === 'oldest' ? (a.date || '').localeCompare(b.date || '')
        : sort === 'name' ? (a.title || '').localeCompare(b.title || '')
        : sort === 'images' ? (b.images?.length || 0) - (a.images?.length || 0)
        : (b.savedAt || 0) - (a.savedAt || 0))
  }, [posts, query, filter, sort, showDeleted])

  const imageCount = posts.reduce((a, p) => a + (p.images?.length || 0), 0)
  const bytes = posts.reduce((a, p) => a + (p.images || []).reduce((x, im) => x + (im.bytes || 0), 0), 0)
  const hashes = new Set<string>(); let dupes = 0
  posts.forEach((p) => (p.images || []).forEach((im) => { if (im.hash) { if (hashes.has(im.hash)) dupes++; hashes.add(im.hash) } }))

  async function savePost(p: Post) {
    setPosts((all) => all.map((x) => x.id === p.id ? p : x))
    await api.putPost(p)
  }

  function exportSelected() {
    const chosen = posts.filter((p) => selected.has(p.id))
    if (!chosen.length) { toast('Select at least one post', 'error'); return }
    setEditing(null)
    const m = window.prompt('Export mode: oneZip / perPostZip / folders', 'oneZip')
    if (!m) return
    api.exportData({ mode: m, posts: chosen, settings: {}, name: 'PostPocket-collection' })
      .then((r) => toast(r.ok ? 'Export started' : (r.error || 'Export failed'), r.ok ? 'ok' : 'error'))
  }

  return (
    <>
      <ViewHead eyebrow="Your private collection" title="Library" description={`${posts.length} post folders · ${imageCount} images · ${formatBytes(bytes)} on this device`}
        actions={<div className="btn-row"><button className="btn ghost sm" onClick={() => api.exportData({ mode: 'backup' }).then((r) => toast(r.ok ? 'Backup downloaded' : 'Backup failed', r.ok ? 'ok' : 'error'))}>Backup library</button><button className="btn ghost sm" onClick={exportSelected}>Export selected</button></div>} />
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard label="Post folders" value={posts.length} sub="organized" />
        <StatCard label="Saved images" value={imageCount} sub="local files" />
        <StatCard label="Duplicates" value={dupes} sub="by SHA-256" />
        <StatCard label="Storage used" value={formatBytes(bytes)} sub="on device" />
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="search"><span className="mag">⌕</span><input placeholder="Search posts, captions, tags…" value={query} onChange={debounce((e: any) => setQuery(e.target.value), 180)} /></div>
          <select className="mini" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All sources</option><option value="fav">Favorites</option><option value="Group">Groups</option>
            <option value="Page">Pages</option><option value="Profile">Profiles</option><option value="Local">Local</option><option value="Archive">Archive</option>
          </select>
          <select className="mini" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Alphabetical</option><option value="images">Most images</option>
          </select>
          <button className="btn quiet sm" onClick={() => setShowDeleted(!showDeleted)}>{showDeleted ? 'Back to library' : 'Recycle bin'}</button>
        </div>
        {visible.length === 0 ? <div className="empty-state"><div className="big">▦</div><h3>Nothing here yet</h3><p>Collect a post first, or change your filters.</p></div> : (
          <div className="list">
            {visible.map((p) => (
              <div className="row" key={p.id}>
                <label className="check-row" style={{ margin: 0 }}><input type="checkbox" checked={selected.has(p.id)} onChange={() => {
                  const next = new Set(selected); next.has(p.id) ? next.delete(p.id) : next.add(p.id); setSelected(next)
                }} /></label>
                {imageSrc(p.images?.[0]) ? <img className="thumb-mini" src={imageSrc(p.images[0])} alt="" /> : <div className="thumb-mini" />}
                <div className="grow"><div className="t">{p.title}{p.favorite ? ' ★' : ''}</div><div className="m">{p.sourceType} · {p.sourceName} · {p.date} · {p.images?.length || 0} images{(p.tags || []).length ? ' · ' + p.tags.join(', ') : ''}</div></div>
                <div className="actions">
                  <button className="btn quiet sm" onClick={() => setPreview({ post: p, index: 0 })}>Preview</button>
                  <button className="btn quiet sm" onClick={() => savePost({ ...p, favorite: !p.favorite })}>{p.favorite ? '☆' : '★'}</button>
                  <button className="btn quiet sm" onClick={() => setEditing({ post: p, kind: 'tag' })}>Tag</button>
                  <button className="btn quiet sm" onClick={() => setEditing({ post: p, kind: 'rename' })}>Rename</button>
                  {showDeleted
                    ? <button className="btn quiet sm" onClick={() => savePost({ ...p, deleted: false })}>Restore</button>
                    : <button className="btn danger sm" onClick={() => setConfirmDelete(p)}>Delete</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {preview && preview.post.images[preview.index] && (
        <Lightbox src={imageSrc(preview.post.images[preview.index])} caption={preview.post.title} index={preview.index}
          total={preview.post.images.length}
          onNav={(i) => { if (i >= 0 && i < preview.post.images.length) setPreview({ ...preview, index: i }) }}
          onClose={() => setPreview(null)} />
      )}
      {editing && (
        <Modal title={editing.kind === 'tag' ? 'Tag this post' : 'Rename post folder'} onClose={() => setEditing(null)} footer={
          <><button className="btn quiet" onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" onClick={() => {
            const input = document.getElementById('editValue') as HTMLInputElement
            if (editing.kind === 'tag') savePost({ ...editing.post, tags: input.value.split(',').map((s) => s.trim()).filter(Boolean) })
            else savePost({ ...editing.post, title: input.value.trim() || editing.post.title })
            setEditing(null)
          }}>Save</button></>
        }>
          <label className="field"><span>{editing.kind === 'tag' ? 'Comma-separated tags' : 'Folder / title'}</span>
            <input id="editValue" defaultValue={editing.kind === 'tag' ? (editing.post.tags || []).join(', ') : editing.post.title} /></label>
        </Modal>
      )}
      {confirmDelete && <ConfirmDialog title="Move to recycle bin?" message="You can restore it later." onClose={() => setConfirmDelete(null)} onYes={() => savePost({ ...confirmDelete, deleted: true })} />}
    </>
  )
}
