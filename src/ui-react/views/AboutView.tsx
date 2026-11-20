import React from 'react'
import { APP, PERMISSIONS } from '../lib/config'
import { ViewHead } from '../components'

export default function AboutView() {
  return (
    <>
      <ViewHead eyebrow="Trust & transparency" title="About PostPocket" description={APP.tagline} />
      <div className="card">
        <h3>Local-first by design</h3>
        <p style={{ color: 'var(--muted)' }}>All image processing, indexing and storage happen on your computer. There is no backend, no account, no analytics and no developer access to your collection.</p>
        <div className="notice ok">No Facebook password, manual cookie, session token or login code is ever requested. The <code>chrome.cookies</code> permission is not used.</div>
        <p style={{ color: 'var(--muted)' }}>PostPocket reads only the page you are viewing and saves through your normal browser session — like saving an image yourself, just organized.</p>
        <p style={{ color: 'var(--muted)' }}>Meta restricts unauthorized automated collection, so PostPocket focuses on user-directed saves, your own Facebook archive and local imports.</p>
      </div>
      <div className="card">
        <h3>Permissions explained</h3>
        <div className="list">{PERMISSIONS.map(([name, desc]) => (
          <div className="row" key={name}><div className="grow"><div className="t">{name}</div><div className="m">{desc}</div></div></div>
        ))}</div>
      </div>
      <div className="card"><h3>Version</h3><p style={{ color: 'var(--muted)' }}>{APP.fullName} · v{APP.version} · Manifest V3 · React + TypeScript UI.</p></div>
    </>
  )
}
