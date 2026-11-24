import React, { useEffect, useState } from 'react'
import { APP, NAV_ITEMS } from './lib/config'
import { imageSrc } from './lib/format'
import { subscribe, type ToastItem } from './lib/toast'
import type { Post, PostImage, ViewId } from './lib/types'

export function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M4 9h16" /><path d="M12 9v11" /><path d="M9 13l3 3 3-3" />
      </svg>
    </div>
  )
}

export function Masthead({ subtitle = APP.subtitle, action }: { subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="masthead">
      <div className="brand">
        <BrandMark />
        <div><div className="brand-name">{APP.name}</div><div className="brand-sub">{subtitle}</div></div>
      </div>
      {action}
    </div>
  )
}

export function Sidebar({ active, counts, onNavigate, onExport }: {
  active: ViewId; counts: Record<string, number>; onNavigate: (v: ViewId) => void; onExport: () => void
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <BrandMark />
        <div><div className="brand-name">{APP.name}</div><div className="brand-sub">Image organizer</div></div>
      </div>
      <div className="nav-label">Workspace</div>
      <nav className="nav">
        {NAV_ITEMS.filter((n) => n.id !== 'about').map((n) => (
          <button key={n.id} className={`nav-item ${active === n.id ? 'active' : ''}`} data-view={n.id} onClick={() => onNavigate(n.id as ViewId)}>
            <span className="ico">{n.icon}</span><span>{n.label}</span>
            {counts[n.id] ? <span className="count">{counts[n.id]}</span> : null}
          </button>
        ))}
      </nav>
      <div className="nav-sep" />
      <div className="nav-label">Tools</div>
      <nav className="nav">
        <button className="nav-item" onClick={() => onNavigate('about')}><span className="ico">ⓘ</span><span>About &amp; privacy</span></button>
        <button className="nav-item" onClick={onExport}><span className="ico">↧</span><span>Export</span></button>
      </nav>
      <div className="sidebar-foot"><strong>Local-first.</strong> Your images never leave this device.<br />{APP.tagline}</div>
    </aside>
  )
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => subscribe(setItems), [])
  return (
    <div className="toast-host">
      {items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
    </div>
  )
}

export function Modal({ title, children, onClose, wide = false, footer }: {
  title: string; children: React.ReactNode; onClose: () => void; wide?: boolean; footer?: React.ReactNode
}) {
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <h2>{title}</h2>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, message, onYes, onClose }: { title: string; message: string; onYes: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} footer={
      <>
        <button className="btn quiet" onClick={onClose}>Cancel</button>
        <button className="btn danger" onClick={() => { onClose(); onYes() }}>Confirm</button>
      </>
    }><p style={{ color: 'var(--muted)' }}>{message}</p></Modal>
  )
}

export function Lightbox({ src, caption, index, total, onNav, onClose }: {
  src: string; caption: string; index: number; total: number; onNav: (i: number) => void; onClose: () => void
}) {
  const [zoom, setZoom] = React.useState(1)
  const [size, setSize] = React.useState('')
  React.useEffect(() => { setZoom(1); setSize('') }, [src])
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal wide" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
        <div className="lightbox">
          <div className="lightbox-bar"><span>{index + 1} / {total}</span><span>{caption}</span>{size && <span>{size}</span>}</div>
          <img src={src} alt={caption || 'preview'} style={{ transform: `scale(${zoom})`, maxHeight: `${78 / zoom}vh`, transition: 'transform .15s ease' }}
            onLoad={(e) => setSize(`${(e.currentTarget as HTMLImageElement).naturalWidth} × ${(e.currentTarget as HTMLImageElement).naturalHeight}`)} />
          <div className="lightbox-bar">
            <button className="btn quiet sm" onClick={() => onNav(index - 1)}>← Previous</button>
            <button className="btn quiet sm" onClick={() => onNav(index + 1)}>Next →</button>
            <button className="btn quiet sm" onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}>−</button>
            <button className="btn quiet sm" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>+</button>
            <button className="btn quiet sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat">
      <div className="k">{label}</div><div className="v">{value}</div>{sub && <div className="s">{sub}</div>}
    </div>
  )
}

export function ViewHead({ eyebrow, title, description, actions }: {
  eyebrow: string; title: string; description?: string; actions?: React.ReactNode
}) {
  return (
    <div className="view-head">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {actions}
    </div>
  )
}

export function ThumbGrid({ images, selected, onToggle, size = 'medium' }: {
  images: PostImage[]; selected: Set<number>; onToggle: (index: number) => void; size?: 'small' | 'medium' | 'large'
}) {
  return (
    <div className={`grid ${size}`}>
      {images.map((im, i) => (
        <button key={`${im.url}-${i}`} className={`thumb ${selected.has(i) ? 'selected' : ''}`} onClick={() => onToggle(i)} title={`${im.video ? 'Video' : 'Image'} ${i + 1}`}>
          {imageSrc(im) ? <img src={imageSrc(im)} alt={`${im.video ? 'Video' : 'Image'} ${i + 1}`} loading="lazy" /> : <div className="thumb-placeholder">#{i + 1}</div>}
          <span className="num">{String(i + 1).padStart(2, '0')}</span>
          <span className="tick">✓</span>
        </button>
      ))}
    </div>
  )
}

export function SourceCard({ post, onOpen }: { post: Post; onOpen?: () => void }) {
  return (
    <div className="card source-card">
      <div className="source-top">
        <span className="badge">{post.sourceType}</span>
        <span className="scan-state">Post captured</span>
      </div>
      <h2>{post.sourceName}</h2>
      <p className="title-line">{post.title}</p>
      <div className="meta-grid">
        <div><span>Author</span><strong>{post.author}</strong></div>
        <div><span>Posted</span><strong>{post.date}</strong></div>
        <div><span>Post ID</span><strong>{post.postId}</strong></div>
        <div><span>Images</span><strong>{post.images.length}</strong></div>
      </div>
      {onOpen && <button className="post-link" onClick={onOpen}>Open original post ↗</button>}
    </div>
  )
}
