import React, { useEffect, useState } from 'react'
import { api } from './lib/api'
import { toast } from './lib/toast'
import { applyTheme } from './lib/theme'
import { APP, NAV_ITEMS } from './lib/config'
import { Masthead, Sidebar, Toaster } from './components'
import OverviewView from './views/OverviewView'
import CollectView from './views/CollectView'
import LibraryView from './views/LibraryView'
import QueueView from './views/QueueView'
import SettingsView from './views/SettingsView'
import AboutView from './views/AboutView'
import PopupView from './views/PopupView'
import type { Settings, UIMode, ViewId } from './lib/types'

export default function App({ mode }: { mode: UIMode }) {
  const [view, setView] = useState<ViewId>(mode === 'sidepanel' ? 'collect' : 'overview')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [collectMethod, setCollectMethod] = useState('single')
  const [counts, setCounts] = useState<Record<string, number>>({})

  async function refresh() {
    const s = await api.settings(); setSettings(s.data as Settings || null); applyTheme((s.data as Settings)?.theme)
    const [p, j] = await Promise.all([api.posts(), api.jobs()])
    setCounts({
      library: ((p.data as any[]) || []).length,
      queue: ((j.data as any[]) || []).filter((x: any) => ['queued', 'running', 'paused'].includes(x.status)).length,
    })
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => {
    const handler = (msg: any) => { if (msg?.type === 'PP_JOB_UPDATE') refresh() }
    ;(chrome as any)?.runtime?.onMessage?.addListener?.(handler)
    const methodHandler = (e: Event) => setCollectMethod((e as CustomEvent).detail)
    window.addEventListener('pp:method', methodHandler)
    return () => window.removeEventListener('pp:method', methodHandler)
  }, [])

  function navigate(v: ViewId) { setView(v); window.scrollTo(0, 0) }
  function openDashboard() { api.openDashboard(); if (mode !== 'dashboard') window.close() }
  async function openSidePanel() {
    const tabs = await new Promise<any[]>((resolve) => (chrome as any).tabs.query({ active: true, currentWindow: true }, resolve))
    await api.openSidePanel(tabs[0]?.id); window.close()
  }

  const shared = { settings: settings || ({} as Settings) }
  let content: React.ReactNode

  if (mode === 'popup') {
    content = <>
      <Masthead subtitle="One post. One folder." action={<button className="icon-btn plain" title="Open full workspace" onClick={openDashboard}>↗</button>} />
      <PopupView onOpenDashboard={openDashboard} onOpenSidePanel={openSidePanel} />
    </>
  } else if (mode === 'sidepanel') {
    content = <>
      <Masthead subtitle="Collection workspace" action={<button className="icon-btn plain" title="Open full workspace" onClick={openDashboard}>↗</button>} />
      <div className="tabs">{NAV_ITEMS.filter((n) => ['collect', 'library', 'queue'].includes(n.id)).map((n) => (
        <button key={n.id} className={`tab ${view === n.id ? 'active' : ''}`} onClick={() => navigate(n.id as ViewId)}>{n.label}</button>
      ))}</div>
      <ContentView view={view} shared={shared} navigate={navigate} method={collectMethod} />
    </>
  } else {
    content = (
      <div className="app-layout">
        <Sidebar active={view} counts={counts} onNavigate={navigate} onExport={() => navigate('library')} />
        <main className="main"><ContentView view={view} shared={shared} navigate={navigate} method={collectMethod} /></main>
      </div>
    )
  }

  return <div className="shell">{content}<Toaster /></div>
}

function ContentView({ view, shared, navigate, method }: {
  view: ViewId; shared: { settings: Settings }; navigate: (v: ViewId) => void; method: string
}) {
  switch (view) {
    case 'overview': return <OverviewView onNavigate={navigate} onMethod={(m) => window.dispatchEvent(new CustomEvent('pp:method', { detail: m }))} />
    case 'collect': return <CollectView key={method} settings={shared.settings} initialMethod={method} onOpenDashboard={() => api.openDashboard()} />
    case 'library': return <LibraryView />
    case 'queue': return <QueueView />
    case 'settings': return <SettingsView />
    case 'about': return <AboutView />
    default: return null
  }
}
