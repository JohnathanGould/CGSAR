import React, { useEffect, useMemo, useState } from 'react'
import {
  Search, LayoutDashboard, Boxes, Users, Shield, LogIn, LogOut, HelpCircle, UserCircle,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import logo from './assets/logo.png'
import { loadAll } from './lib/data'
import { saveCache, loadCache } from './lib/cache'
import { newerBundle, reloadToNewVersion } from './lib/updateCheck'
import { replacementBadge } from './lib/helpers'
import { topoPaths } from './components/Floorplan'
import Inventory from './components/Inventory'
import VehicleDiagram from './components/VehicleDiagram'
import { compartmentsOf } from './lib/compartments'
import Dashboard from './components/Dashboard'
import DetailDrawer from './components/DetailDrawer'
import HelpModal from './components/HelpModal'
import OrgChart from './components/OrgChart'
import Admin from './components/Admin'
import Modal from './components/Modal'

const EMPTY = { teams: [], rooms: [], containers: [], items: [], orgPositions: [], orgMembers: [], checkouts: [], userTeams: [], profiles: [], compartments: [], unitDocs: [], reminders: [] }

export default function App() {
  const [session, setSession] = useState(null)
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [view, setView] = useState('dashboard')
  const [drawer, setDrawer] = useState({ open: false, mode: 'room', roomId: null, containerId: null, itemId: null, compartmentId: null })
  const [query, setQuery] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [updateTarget, setUpdateTarget] = useState(null) // newer deploy found while in use
  const [accountOpen, setAccountOpen] = useState(false) // phone layout: account panel folded away
  // Admin-only preview: 'self' | 'member' | 'team:<id>' | 'public'
  const [viewAs, setViewAs] = useState('self')
  const [recoveryOpen, setRecoveryOpen] = useState(false)
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
      if (cached?.data) { setData({ ...EMPTY, ...cached.data }); setOffline(true) }
      else setLoadError(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s)
      if (e === 'PASSWORD_RECOVERY') setRecoveryOpen(true)
      refresh()
    })
    refresh()
    return () => sub.subscription.unsubscribe()
  }, [])

  // Pick up new deploys: reload straight away when the app is opened or brought
  // back to the foreground (nothing is mid-edit then); while it's in use, offer
  // an Update button instead of interrupting.
  useEffect(() => {
    let busy = false
    async function check(reloadNow) {
      if (busy) return
      busy = true
      const target = await newerBundle()
      busy = false
      if (!target) return
      if (!(reloadNow && reloadToNewVersion(target))) setUpdateTarget(target)
    }
    check(true)
    const onVisible = () => { if (document.visibilityState === 'visible') check(true) }
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => check(false), 15 * 60 * 1000)
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(timer) }
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
  const realIsAdmin = !!profile?.is_admin
  const isApproved = realIsAdmin || !!profile?.is_approved
  const realTeamIds = useMemo(
    () => (session ? data.userTeams.filter((ut) => ut.user_id === session.user.id).map((ut) => ut.team_id) : []),
    [session, data.userTeams]
  )
  // "View as" preview (admins only) swaps in a member's or the public's permissions.
  // UI only: the database still treats you as an admin.
  const previewing = realIsAdmin && viewAs !== 'self'
  const viewSession = previewing && viewAs === 'public' ? null : session
  const isAdmin = realIsAdmin && !previewing
  const myTeamIds = !previewing ? realTeamIds : viewAs.startsWith('team:') ? [viewAs.slice(5)] : []
  const userId = viewSession?.user?.id || null
  const canEditContainer = (c) => !!viewSession && (isAdmin || (c && myTeamIds.includes(c.team_id)))
  const teamName = (id) => data.teams.find((t) => t.id === id)?.name || null
  const fullName = (p) => p ? [p.first_name, p.last_name].filter(Boolean).join(' ').trim() : ''
  const profileName = (id) => { const p = data.profiles.find((x) => x.id === id); return (p && fullName(p)) || 'a member' }

  // ---- navigation ----
  const openRoom = (roomId) => { setView('floorplan'); setDrawer({ open: true, mode: 'room', roomId, containerId: null, itemId: null, compartmentId: null }) }
  // tab: which vehicle tab to open on ('items' | 'sop' | 'service'); defaults to Gear.
  const openContainer = (roomId, containerId, compartmentId = null, tab = null) => { setView('floorplan'); setDrawer({ open: true, mode: 'container', roomId, containerId, itemId: null, compartmentId, tab }) }
  const openItem = (roomId, containerId, itemId) => { setView('floorplan'); setDrawer({ open: true, mode: 'item', roomId, containerId, itemId, compartmentId: null }) }
  const openInventory = (roomId, containerId) => { setView('floorplan'); setDrawer({ open: true, mode: 'inventory', roomId, containerId, itemId: null, compartmentId: null }) }
  const closeDrawer = () => setDrawer({ open: false, mode: 'room', roomId: null, containerId: null, itemId: null, compartmentId: null })
  // Pick a compartment on the vehicle diagram (null = show the whole unit).
  const selectCompartment = (compartmentId) => setDrawer((d) => ({ ...d, mode: 'container', itemId: null, compartmentId }))

  const ctx = { data, session: viewSession, userId, isAdmin, myTeamIds, canEditContainer, teamName, profileName, refresh, openRoom, openContainer, openItem, openInventory, closeDrawer, selectCompartment }

  // ---- search ----
  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (q.length < 2) return []
    const cById = Object.fromEntries(data.containers.map((c) => [c.id, c]))
    const rById = Object.fromEntries(data.rooms.map((r) => [r.id, r]))
    const compById = Object.fromEntries(data.compartments.map((x) => [x.id, x]))
    return data.items
      .filter((it) => it.name.toLowerCase().includes(q))
      .map((it) => { const c = cById[it.container_id]; const r = c && rById[c.room_id]; return { it, c, r, comp: compById[it.compartment_id] } })
      .filter((x) => x.c && x.r)
      .slice(0, 40)
  }, [q, data])
  const hitRoomIds = useMemo(() => new Set(results.map((x) => x.r.id)), [results])
  const hitCompartmentIds = useMemo(() => new Set(results.filter((x) => x.comp).map((x) => x.comp.id)), [results])
  const drawerContainer = drawer.open ? data.containers.find((c) => c.id === drawer.containerId) : null
  const showVehicle = view === 'floorplan' && drawerContainer?.is_vehicle_unit

  const crumb = () => {
    if (drawer.open) {
      const room = data.rooms.find((r) => r.id === drawer.roomId)
      const c = data.containers.find((x) => x.id === drawer.containerId)
      const it = data.items.find((x) => x.id === drawer.itemId)
      const comp = data.compartments.find((x) => x.id === (it ? it.compartment_id : drawer.compartmentId))
      return ['Inventory', room?.name, c?.name, comp?.name, it?.name].filter(Boolean).join('  ›  ')
    }
    return { dashboard: 'Dashboard', floorplan: 'Inventory', org: 'Org Chart', units: 'Org Chart', admin: 'Admin' }[view]
  }

  const viewAsLabel = viewAs === 'public' ? 'the public (not signed in)'
    : viewAs === 'member' ? 'a member with no team'
    : viewAs.startsWith('team:') ? `someone on the ${teamName(viewAs.slice(5)) || ''} team` : ''
  function changeViewAs(v) {
    setViewAs(v)
    if (v !== 'self' && view === 'admin') setView('dashboard')
  }

  const NavItem = ({ id, icon: Icon, label }) => (
    <button className={'navItem' + (view === id && !drawer.open ? ' active' : '')} onClick={(e) => { e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }); setView(id); closeDrawer() }}>
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
          <div className="brandRow">
            <h1>Home Base</h1>
            <img src={logo} className="brandLogo" alt="Colchester Ground Search &amp; Rescue Association" />
            <button className={'acctBtn' + (accountOpen ? ' active' : '')} aria-label="Account" title="Account" onClick={() => setAccountOpen(!accountOpen)}><UserCircle size={22} /></button>
          </div>
          <div className="sub">73 Ventura Dr, Debert NS</div>
        </div>

        <div id="searchWrap">
          <label htmlFor="searchBox">Find equipment</label>
          <input id="searchBox" className="searchBox" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. splint, radio, gauze…" autoComplete="off" />
          <div id="searchResults">
            {q.length >= 2 && results.length === 0 && <div id="noResults">No matches.</div>}
            {results.map(({ it, c, r, comp }) => {
              const badge = replacementBadge(it.needs_replacement_by)
              return (
                <div key={it.id} className="result" onClick={() => { openContainer(r.id, c.id, comp ? comp.id : null) }}>
                  <b>{it.name} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>×{it.qty}</span>{badge && <span className={'badge ' + badge.kind}>{badge.label}</span>}</b>
                  <span>{c.is_vehicle_unit ? c.name : r.name + ' → ' + c.name}{comp ? ' → ' + comp.name : ''}{it.loc_detail ? ' → ' + it.loc_detail : ''}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div id="nav">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="floorplan" icon={Boxes} label="Inventory" />
          <NavItem id="org" icon={Users} label="Org Chart" />
          {isAdmin && <NavItem id="admin" icon={Shield} label="Admin" />}
        </div>

        <div id="authbox" className={accountOpen ? 'open' : ''}>
          {session ? (
            <>
              <div className="who">{fullName(profile) || session.user.email}</div>
              <div className="role">{isAdmin ? 'Admin' : (isApproved ? (myTeamIds.length ? myTeamIds.map(teamName).filter(Boolean).join(', ') : 'Member — no team yet') : 'Pending approval')}</div>
              {realIsAdmin && (
                <div className="field" style={{ margin: '10px 0 0' }}>
                  <label htmlFor="viewAs">View as</label>
                  <select id="viewAs" value={viewAs} onChange={(e) => changeViewAs(e.target.value)}>
                    <option value="self">Admin (you)</option>
                    <option value="member">Member — no team</option>
                    {data.teams.map((t) => <option key={t.id} value={'team:' + t.id}>Member — {t.name}</option>)}
                    <option value="public">Public — not signed in</option>
                  </select>
                </div>
              )}
              <button className="btn sm block" style={{ marginTop: 10 }} onClick={async () => { setViewAs('self'); await supabase.auth.signOut() }}><LogOut size={13} /> Sign out</button>
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
        {updateTarget && (
          <div className="previewBar updateBar">
            A new version of the app is available.
            <button className="btn sm accent" onClick={() => reloadToNewVersion(updateTarget, { force: true })}>Update</button>
          </div>
        )}
        {previewing && (
          <div className="previewBar">
            Previewing the app as {viewAsLabel}. Anything you change still saves with your admin rights.
            <button className="btn sm" onClick={() => changeViewAs('self')}>Back to admin view</button>
          </div>
        )}
        {offline && <div className="offlineBar">Offline — showing last-known data from this device. Changes can’t be saved until you reconnect.</div>}
        <div id="topbar">
          <h2>{crumb()}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="addr">Ground floor · 73 Ventura Dr, Debert NS</div>
            <button className="helpBtn" title="Help — how this app works" aria-label="Help" onClick={() => setHelpOpen(true)}><HelpCircle size={18} /></button>
          </div>
        </div>
        <div id="content">
          {loading ? (
            <div className="emptyState">Loading base inventory…</div>
          ) : loadError ? (
            <div className="card" style={{ maxWidth: 560 }}>
              <h3>Can’t reach the database</h3>
              <p className="hint">Run <b>supabase_migrations.sql</b> in your Supabase SQL editor and confirm the URL/anon key. Error: {String(loadError.message || loadError)}</p>
            </div>
          ) : (session && !isApproved) ? (
            <div className="card" style={{ maxWidth: 520, textAlign: 'center', margin: '60px auto' }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>⏳</div>
              <h3 style={{ justifyContent: 'center' }}>Your account is pending admin approval</h3>
              <p className="hint">Thanks{fullName(profile) ? ', ' + fullName(profile) : ''}. An executive/admin member needs to approve your account and assign your team(s) before you can use the app. You’ll get in automatically once approved — just sign in again.</p>
              <button className="btn sm" style={{ marginTop: 14 }} onClick={async () => { await supabase.auth.signOut() }}><LogOut size={13} /> Sign out</button>
            </div>
          ) : view === 'dashboard' ? (
            <Dashboard ctx={ctx} />
          ) : showVehicle ? (
            <VehicleDiagram
              unitName={drawerContainer.name}
              compartments={compartmentsOf(data, drawerContainer.id)}
              items={data.items.filter((i) => i.container_id === drawerContainer.id)}
              selectedId={drawer.mode === 'item' ? data.items.find((i) => i.id === drawer.itemId)?.compartment_id : drawer.compartmentId}
              hitIds={hitCompartmentIds}
              onSelect={selectCompartment}
            />
          ) : view === 'floorplan' ? (
            <Inventory ctx={ctx} activeRoomId={drawer.roomId} hitRoomIds={hitRoomIds} />
          ) : view === 'units' ? (
            <OrgChart ctx={ctx} />
          ) : view === 'org' ? (
            <OrgChart ctx={ctx} />
          ) : view === 'admin' ? (
            <Admin ctx={ctx} />
          ) : null}
        </div>
      </div>

      {/* drawer */}
      <DetailDrawer ctx={ctx} drawer={drawer} hitCompartmentIds={hitCompartmentIds} />

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      {helpOpen && <HelpModal isAdmin={isAdmin} onClose={() => setHelpOpen(false)} />}
      {recoveryOpen && <NewPasswordModal onClose={() => setRecoveryOpen(false)} />}
    </div>
  )
}

// Shown after following a password-reset email link (Supabase PASSWORD_RECOVERY event).
function NewPasswordModal({ onClose }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (password.length < 6) { setMsg('Use at least 6 characters.'); return }
    if (password !== confirm) { setMsg('Passwords don’t match.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setMsg(error.message); else onClose()
  }

  return (
    <Modal title="Set a new password" sub="You followed a reset link. Choose a new password for your account." onClose={onClose}>
      <div className="field"><label>New password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></div>
      <div className="field"><label>Confirm password</label><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
      {msg && <div className="hint">{msg}</div>}
      <div className="formActions">
        <button className="btn accent" onClick={submit} disabled={busy}>{busy ? '…' : 'Save password'}</button>
      </div>
    </Modal>
  )
}

function AuthModal({ onClose }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setMsg('')
    if (mode === 'forgot') {
      if (!email.trim()) { setMsg('Enter your email first.'); return }
      setBusy(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + window.location.pathname,
      })
      setBusy(false)
      setMsg(error ? error.message : 'If that email has an account, a reset link is on its way. Open it on this device to set a new password.')
    } else if (mode === 'signin') {
      setBusy(true)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setBusy(false)
      if (error) setMsg(error.message); else onClose()
    } else {
      if (!firstName.trim() || !lastName.trim()) { setMsg('First and last name are required.'); return }
      setBusy(true)
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } },
      })
      setBusy(false)
      if (error) { setMsg(error.message); return }
      if (data.session) onClose()
      else setMsg('Account created. If email confirmation is on, confirm via email, then sign in. Your account then waits for admin approval.')
    }
  }

  return (
    <Modal title={{ signin: 'Sign in', signup: 'Create account', forgot: 'Reset password' }[mode]} sub={mode === 'forgot' ? 'We’ll email you a link to set a new password.' : 'Members log in to edit their team’s shelves.'} onClose={onClose}>
      {mode === 'signup' && (
        <div className="formRow">
          <div className="field"><label>First name</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus /></div>
          <div className="field"><label>Last name</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
        </div>
      )}
      <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      {mode !== 'forgot' && <div className="field"><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>}
      {mode === 'signin' && <button className="linkBtn" onClick={() => { setMode('forgot'); setMsg('') }}>Forgot password?</button>}
      {mode === 'signup' && <div className="hint">New accounts need admin approval before access is granted.</div>}
      {msg && <div className="hint">{msg}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg('') }}>{mode === 'signin' ? 'Create account' : 'Have an account? Sign in'}</button>
        <button className="btn accent" onClick={submit} disabled={busy}>{busy ? '…' : { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link' }[mode]}</button>
      </div>
    </Modal>
  )
}
