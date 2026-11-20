import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { formatBytes } from '../lib/format'
import { COLLECT_METHODS } from '../lib/config'
import { StatCard, ViewHead } from '../components'
import type { Post, Job } from '../lib/types'

export default function OverviewView({ onNavigate, onMethod }: { onNavigate: (v: any) => void; onMethod: (m: string) => void }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  useEffect(() => {
    api.posts().then((r) => setPosts((r.data as Post[]) || []))
    api.jobs().then((r) => setJobs((r.data as Job[]) || []))
  }, [])

  const images = posts.reduce((a, p) => a + (p.images?.length || 0), 0)
  const bytes = posts.reduce((a, p) => a + (p.images || []).reduce((x, im) => x + (im.bytes || 0), 0), 0)
  const pending = jobs.filter((j) => ['queued', 'running', 'paused'].includes(j.status)).length
  const recent = posts.filter((p) => !p.deleted).slice(-5).reverse()

  function start(method: string) { onNavigate('collect'); onMethod(method) }

  return (
    <>
      <ViewHead eyebrow="Your image collection" title="Overview" description="Everything stays on this device. Pick up where you left off."
        actions={<button className="btn primary" onClick={() => start('single')}>+ Start a collection</button>} />
      <div className="stat-grid">
        <StatCard label="Post folders" value={posts.length} sub="organized" />
        <StatCard label="Saved images" value={images} sub="indexed locally" />
        <StatCard label="Library size" value={formatBytes(bytes)} sub="on this device" />
        <StatCard label="Pending tasks" value={pending} sub={pending ? 'in progress' : 'all clear'} />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3>Start a collection</h3><span className="scan-state">Six ways in, one library</span></div>
        <div className="collect-grid">
          {COLLECT_METHODS.map((m) => (
            <button className="collect-card" key={m.id} onClick={() => start(m.id)}>
              <div className="ic">{m.icon}</div><div className="t">{m.title}</div><div className="d">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3>Recent collections</h3><button className="btn quiet sm" onClick={() => onNavigate('library')}>Open library →</button></div>
        {recent.length ? <div className="list">{recent.map((p) => (
          <div className="row" key={p.id}><div className="grow"><div className="t">{p.title}</div><div className="m">{p.sourceName} · {p.date} · {p.images?.length || 0} images</div></div></div>
        ))}</div> : <div className="empty-state"><div className="big">▦</div><h3>No collections yet</h3><p>Your saved post folders will show up here.</p></div>}
      </div>
    </>
  )
}
