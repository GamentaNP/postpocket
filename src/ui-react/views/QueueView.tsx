import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { JOB_ACTIONS } from '../lib/config'
import { ViewHead } from '../components'
import type { Job } from '../lib/types'

function badge(status: string) {
  const kind = status === 'done' ? 'ok' : ['failed', 'cancelled'].includes(status) ? 'error' : 'warn'
  return <span className={`notice ${kind}`} style={{ display: 'inline-block', padding: '2px 8px', margin: 0, fontSize: 10 }}>{status.replace(/_/g, ' ')}</span>
}

export default function QueueView() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeOnly, setActiveOnly] = useState(false)

  async function load() { const r = await api.jobs(); setJobs(((r.data as Job[]) || []).sort((a, b) => b.createdAt - a.createdAt)) }
  useEffect(() => {
    load()
    const handler = (msg: any) => { if (msg?.type === 'PP_JOB_UPDATE') { if (msg.job?.removed) setJobs((all) => all.filter((j) => j.id !== msg.job.id)); else setJobs((all) => all.map((j) => j.id === msg.job.id ? msg.job : j)) } }
    chrome?.runtime?.onMessage?.addListener?.(handler)
    return () => { /* listener cleanup handled by page lifetime */ }
  }, [])

  const shown = activeOnly ? jobs.filter((j) => ['queued', 'running', 'paused'].includes(j.status)) : jobs

  async function act(action: string, id: string) {
    const r = await api.jobAction(action, id)
    if (!r.ok) toast(r.error || 'Action failed', 'error')
    setTimeout(load, 300)
  }

  return (
    <>
      <ViewHead eyebrow="Control centre" title="Download queue" description="Jobs survive a Chrome restart. Pause, resume, retry or cancel at any time."
        actions={<button className="btn quiet sm" onClick={() => setActiveOnly(!activeOnly)}>{activeOnly ? 'Show all' : 'Show active'}</button>} />
      {shown.length === 0 ? <div className="empty-state"><div className="big">⇅</div><h3>Queue is empty</h3><p>Start a collection and it will appear here with live progress.</p></div> : (
        <div className="list">
          {shown.map((j) => {
            const pct = j.total ? Math.round((j.done / j.total) * 100) : 0
            const failed = (j.results || []).filter((r) => !r.ok).length
            return (
              <div className="card" key={j.id} style={{ margin: 0 }}>
                <div className="card-head">
                  <div><h3 style={{ margin: 0 }}>Batch {j.id.slice(-8)} · {j.currentPost || `${j.posts?.length || 0} posts`}</h3>
                    <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 3 }}>{badge(j.status)} · {j.done}/{j.total} images · {failed} failed</div></div>
                  <span className="scan-state">{pct}%</span>
                </div>
                <div className="progress-track"><div className="progress-bar" style={{ width: `${pct}%` }} /></div>
                <div className="progress-meta"><span>{j.currentPost || 'Idle'}</span><span>{j.done} / {j.total}</span></div>
                <div className="btn-row" style={{ marginTop: 12 }}>
                  {j.status === 'running'
                    ? <button className="btn quiet sm" onClick={() => act(JOB_ACTIONS.pause, j.id)}>Pause</button>
                    : <button className="btn ghost sm" onClick={() => act(JOB_ACTIONS.resume, j.id)}>Resume</button>}
                  {failed > 0 && <button className="btn ghost sm" onClick={() => act(JOB_ACTIONS.retryFailed, j.id)}>Retry failed ({failed})</button>}
                  <button className="btn quiet sm" onClick={() => act(JOB_ACTIONS.cancel, j.id)}>Cancel</button>
                  <button className="btn danger sm" onClick={() => act(JOB_ACTIONS.remove, j.id)}>Remove</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
