import React, { useEffect, useMemo, useState } from 'react'
import {
  Search, LayoutDashboard, Map, Users, Shield, LogIn, LogOut,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import { loadAll } from './lib/data'
import { saveCache, loadCache } from './lib/cache'
import { replacementBadge } from './lib/helpers'
import Floorplan, { topoPaths } from './components/Floorplan'
import Dashboard from './components/Dashboard'
import DetailDrawer from './components/DetailDrawer'
import Units from './components/Units'
import Admin from './components/Admin'
import Modal from './components/Modal'

const EMPTY = { teams: [], rooms: [], containers: [], items: [], units: [], unitMembers: [], checkouts: [], userTeams: [], profiles: [] }

export default function App() {
  const [session, setSession] = useState(null)
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [view, setView] = useState('dashboard')
  const [drawer, setDrawer] = useState({ open: false, mode: 'room', roomId: null, containerId: null, itemId: null })
  const [query, setQuery] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const deepLinkDone = React.useRef(false)

  async function refresh() {
    try {
      const d = await loadAll()
      setData(d)
      saveCache(d)
      setOffline(false)
      setLoadError(null)
    } catch (e) {
      const cached = loadCache()
      if (cached?.data) { setData(cached.data); setOffline(true) }
      else setLoadError(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); refresh() })
    refresh()
    return () => sub.subscription.unsubscribe()
  }, [])

  // QR deep link: ?container=<id> opens that container once data is ready.
  useEffect(() => {
    if (deepLinkDone.current || loading || !data.containers.length) return
    const params = new URLSearchParams(window.location.search)
    const cid = params.get('container')
    if (cid) {
      const c = data.containers.find((x) => x.id === cid)
      if (c) { deepLinkDone.current = true; openContainer(c.room_id, c.id) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data.containers])

  // ---- derived perms ----
  const profile = session ? data.profiles.find((p) => p.id === session.user.id) : null
  const isAdmin = !!profile?.is_admin
  const userId = session?.user?.id || null
  const myTeamIds = useMemo(
    () => (session ? data.userTeams.filter((ut) => ut.user_id === session.user.id).map((ut) => ut.team_id) : []),
    [session, data.userTeams]
  )
  const canEditContainer = (c) => !!session && (isAdmin || (c && myTeamIds.includes(c.team_id)))
  const teamName = (id) => data.teams.find((t) => t.id === id)?.name || null
  const profileName = (id) => data.profiles.find((p) => p.id === id)?.display_name || 'a member'

  // ---- navigation ----
  const openRoom = (roomId) => { setView('floorplan'); setDrawer({ open: true, mode: 'room', roomId, containerId: null, itemId: null }) }
  const openContainer = (roomId, containerId) => { setView('floorplan'); setDrawer({ open: true, mode: 'container', roomId, containerId, itemId: null }) }
  const openItem = (roomId, containerId, itemId) => { setView('floorplan'); setDrawer({ open: true, mode: 'item', roomId, containerId, itemId }) }
  const openInventory = (roomId, containerId) => { setView('floorplan'); setDrawer({ open: true, mode: 'inventory', roomId, containerId, itemId: null }) }
  const closeDrawer = () => setDrawer({ open: false, mode: 'room', roomId: null, containerId: null, itemId: null })

  const ctx = { data, session, userId, isAdmin, myTeamIds, canEditContainer, teamName, profileName, refresh, openRoom, openContainer, openItem, openInventory, closeDrawer }

  // ---- search ----
  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (q.length < 2) return []
    const cById = Object.fromEntries(data.containers.map((c) => [c.id, c]))
    const rById = Object.fromEntries(data.rooms.map((r) => [r.id, r]))
    return data.items
      .filter((it) => it.name.toLowerCase().includes(q))
      .map((it) => { const c = cById[it.container_id]; const r = c && rById[c.room_id]; return { it, c, r } })
      .filter((x) => x.c && x.r)
      .slice(0, 40)
  }, [q, data])
  const hitRoomIds = useMemo(() => new Set(results.map((x) => x.r.id)), [results])

  const crumb = () => {
    if (drawer.open) {
      const room = data.rooms.find((r) => r.id === drawer.roomId)
      const c = data.containers.find((x) => x.id === drawer.containerId)
      const it = data.items.find((x) => x.id === drawer.itemId)
      return ['Base', room?.name, c?.name, it?.name].filter(Boolean).join('  ›  ')
    }
    return { dashboard: 'Base Dashboard', floorplan: 'Base Overview', units: 'Units', admin: 'Admin' }[view]
  }

  const NavItem = ({ id, icon: Icon, label }) => (
    <button className={'navItem' + (view === id && !drawer.open ? ' active' : '')} onClick={() => { setView(id); closeDrawer() }}>
      <Icon size={17} /> {label}
    </button>
  )

  return (
    <div id="app">
      <svg id="topo" viewBox="0 0 1000 650" preserveAspectRatio="none">
        {topoPaths().map((d, i) => <path key={i} d={d} fill="none" stroke="#1a1a1a" strokeWidth={1.4} />)}
      </svg>

      {/* sidebar */}
      <div id="sidebar">
        <div id="brand">
          <div className="eyebrow">Colchester GSAR</div>
          <h1>Home Base</h1>
          <div className="sub">73 Ventura Dr, Debert NS</div>
        </div>

        <div id="searchWrap">
          <label htmlFor="searchBox">Find equipment</label>
          <input id="searchBox" className="searchBox" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. splint, radio, gauze…" autoComplete="off" />
          <div id="searchResults">
            {q.length >= 2 && results.length === 0 && <div id="noResults">No matches.</div>}
            {results.map(({ it, c, r }) => {
              const badge = replacementBadge(it.needs_replacement_by)
              return (
                <div key={it.id} className="result" onClick={() => { openContainer(r.id, c.id); }}>
                  <b>{it.name} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>×{it.qty}</span>{badge && <span className={'badge ' + badge.kind}>{badge.label}</span>}</b>
                  <span>{r.name} → {c.name}{it.loc_detail ? ' → ' + it.loc_detail : ''}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div id="nav">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="floorplan" icon={Map} label="Floorplan" />
          <NavItem id="units" icon={Users} label="Units" />
          {isAdmin && <NavItem id="admin" icon={Shield} label="Admin" />}
        </div>

        <div id="authbox">
          {session ? (
            <>
              <div className="who">{profile?.display_name || session.user.email}</div>
              <div className="role">{isAdmin ? 'Admin' : (myTeamIds.length ? myTeamIds.map(teamName).filter(Boolean).join(', ') : 'Member — no team yet')}</div>
              <button className="btn sm block" style={{ marginTop: 10 }} onClick={async () => { await supabase.auth.signOut() }}><LogOut size={13} /> Sign out</button>
            </>
          ) : (
            <>
              <div>Browsing read-only. Sign in to edit your team’s shelves.</div>
              <button className="btn accent sm block" style={{ marginTop: 10 }} onClick={() => setAuthOpen(true)}><LogIn size={13} /> Sign in</button>
            </>
          )}
        </div>
      </div>

      {/* main */}
      <div id="main">
        {offline && <div className="offlineBar">Offline — showing last-known data from this device. Changes can’t be saved until you reconnect.</div>}
        <div id="topbar">
          <h2>{crumb()}</h2>
          <div className="addr">Ground floor · 73 Ventura Dr, Debert NS</div>
        </div>
        <div id="content">
          {loading ? (
            <div className="emptyState">Loading base inventory…</div>
          ) : loadError ? (
            <div className="card" style={{ maxWidth: 560 }}>
              <h3>Can’t reach the database</h3>
              <p className="hint">Run <b>supabase_migrations.sql</b> in your Supabase SQL editor and confirm the URL/anon key. Error: {String(loadError.message || loadError)}</p>
            </div>
          ) : view === 'dashboard' ? (
            <Dashboard ctx={ctx} />
          ) : view === 'floorplan' ? (
            <Floorplan rooms={data.rooms} activeRoomId={drawer.roomId} hitRoomIds={hitRoomIds} onRoomClick={(r) => openRoom(r.id)} />
          ) : view === 'units' ? (
            <Units ctx={ctx} />
          ) : view === 'admin' ? (
            <Admin ctx={ctx} />
          ) : null}
        </div>
      </div>

      {/* drawer */}
      <DetailDrawer ctx={ctx} drawer={drawer} />

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}

function AuthModal({ onClose }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true); setMsg('')
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setBusy(false)
      if (error) setMsg(error.message); else onClose()
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
      setBusy(false)
      if (error) { setMsg(error.message); return }
      if (data.session) onClose()
      else setMsg('Account created. If email confirmation is on, confirm via email, then sign in. An admin then assigns your team(s).')
    }
  }

  return (
    <Modal title={mode === 'signin' ? 'Sign in' : 'Create account'} sub="Members log in to edit their team’s shelves." onClose={onClose}>
      {mode === 'signup' && <div className="field"><label>Display name</label><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" /></div>}
      <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></div>
      <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {msg && <div className="hint">{msg}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg('') }}>{mode === 'signin' ? 'Create account' : 'Have an account? Sign in'}</button>
        <button className="btn accent" onClick={submit} disabled={busy}>{busy ? '…' : (mode === 'signin' ? 'Sign in' : 'Create account')}</button>
      </div>
    </Modal>
  )
}
