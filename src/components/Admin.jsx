import React, { useState } from 'react'
import { Plus, Trash2, Save, Download, QrCode, UserCheck } from 'lucide-react'
import * as api from '../lib/data'
import { exportInventoryCsv, printAllQrTags } from '../lib/exports'
import { fmtDate } from '../lib/helpers'
import Modal from './Modal'

const fullName = (p) => [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '(no name)'

export default function Admin({ ctx }) {
  const { data, refresh } = ctx
  const pendingCount = data.profiles.filter((p) => !p.is_approved && !p.is_admin).length
  const [tab, setTab] = useState(pendingCount > 0 ? 'pending' : 'rooms')
  const done = async (r) => { if (r && r.error) alert(r.error.message); await refresh() }

  const label = { pending: `Pending${pendingCount ? ` (${pendingCount})` : ''}`, rooms: 'Rooms', teams: 'Teams', members: 'Members' }

  return (
    <div>
      <div className="pageHead"><h2>Admin</h2><p>Structure the base: approvals, rooms, teams, and who can edit what.</p></div>
      <div className="rowActions" style={{ margin: '0 0 18px' }}>
        <button className="btn" onClick={() => exportInventoryCsv(data)}><Download size={14} /> Export inventory CSV</button>
        <button className="btn" onClick={() => printAllQrTags(data)}><QrCode size={14} /> Print all QR tags</button>
      </div>
      <div className="tabs">
        {['pending', 'rooms', 'teams', 'members'].map((t) => (
          <button key={t} className={'tab' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>{label[t]}</button>
        ))}
      </div>
      {tab === 'pending' && <Pending data={data} refresh={refresh} />}
      {tab === 'rooms' && <Rooms data={data} done={done} refresh={refresh} />}
      {tab === 'teams' && <Teams data={data} done={done} refresh={refresh} />}
      {tab === 'members' && <Members data={data} refresh={refresh} />}
    </div>
  )
}

function Pending({ data, refresh }) {
  const [draft, setDraft] = useState({}) // userId -> Set(teamId)
  const [busy, setBusy] = useState(null)
  const pending = data.profiles.filter((p) => !p.is_approved && !p.is_admin)
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))

  const teamsFor = (uid) => draft[uid] || new Set()
  const toggle = (uid, tid) => {
    const s = new Set(teamsFor(uid))
    if (s.has(tid)) s.delete(tid); else s.add(tid)
    setDraft({ ...draft, [uid]: s })
  }
  const approve = async (uid) => {
    setBusy(uid)
    const r = await api.approveMember(uid, Array.from(teamsFor(uid)))
    setBusy(null)
    if (r && r.error) alert(r.error.message)
    await refresh()
  }

  if (pending.length === 0) return <div className="hint">No members waiting for approval.</div>
  return (
    <div>
      <div className="hint" style={{ marginBottom: 14 }}>Tick the team(s) each new member should be able to edit, then Approve — that flips them to approved and assigns teams in one step.</div>
      {pending.map((p) => (
        <div key={p.id} className="card" style={{ marginBottom: 14 }}>
          <h3>{fullName(p)} <span className="count">signed up {fmtDate(p.created_at) || '—'}</span></h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12 }}>
            {data.teams.map((t) => (
              <label key={t.id} className="checkRow"><input type="checkbox" checked={teamsFor(p.id).has(t.id)} onChange={() => toggle(p.id, t.id)} /> {t.name}</label>
            ))}
          </div>
          <button className="btn accent sm" disabled={busy === p.id} onClick={() => approve(p.id)}><UserCheck size={13} /> {busy === p.id ? 'Approving…' : 'Approve & assign'}</button>
        </div>
      ))}
    </div>
  )
}

function Rooms({ data, done, refresh }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button className="btn accent" style={{ marginBottom: 16 }} onClick={() => setOpen(true)}><Plus size={15} /> Add room</button>
      {data.rooms.map((r) => (
        <div key={r.id} className="listRow" style={{ cursor: 'default' }}>
          <div className="lr-main"><div className="lr-title">{r.name}</div><div className="lr-sub">{r.kind || '—'} · x{r.floor_x} y{r.floor_y} w{r.floor_w} h{r.floor_h}</div></div>
          <button className="btn sm danger" onClick={async () => { if (confirm('Delete room and all its shelves/items?')) done(await api.deleteRoom(r.id)) }}><Trash2 size={13} /></button>
        </div>
      ))}
      {open && <RoomModal data={data} onClose={() => setOpen(false)} onSave={async (p) => { const r = await api.addRoom(p); if (!r.error) { setOpen(false); await refresh() } return r }} />}
    </div>
  )
}

function RoomModal({ data, onClose, onSave }) {
  const [f, setF] = useState({ name: '', kind: '', floor_x: 400, floor_y: 300, floor_w: 150, floor_h: 100 })
  const [err, setErr] = useState('')
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const nextSort = (data.rooms.reduce((m, r) => Math.max(m, r.sort_order || 0), 0) || 0) + 1
  return (
    <Modal title="Add room" onClose={onClose}>
      <div className="field"><label>Name</label><input value={f.name} onChange={up('name')} autoFocus /></div>
      <div className="field"><label>Kind</label><input value={f.kind} onChange={up('kind')} placeholder="e.g. Storage" /></div>
      <div className="formRow">
        <div className="field"><label>x</label><input type="number" value={f.floor_x} onChange={up('floor_x')} /></div>
        <div className="field"><label>y</label><input type="number" value={f.floor_y} onChange={up('floor_y')} /></div>
        <div className="field"><label>w</label><input type="number" value={f.floor_w} onChange={up('floor_w')} /></div>
        <div className="field"><label>h</label><input type="number" value={f.floor_h} onChange={up('floor_h')} /></div>
      </div>
      <div className="hint">Coordinates are on a 1000×650 canvas.</div>
      {err && <div className="errText">{err}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn accent" onClick={async () => {
          if (!f.name.trim()) { setErr('Name required'); return }
          const r = await onSave({ name: f.name.trim(), kind: f.kind.trim() || null, floor_x: +f.floor_x, floor_y: +f.floor_y, floor_w: +f.floor_w, floor_h: +f.floor_h, sort_order: nextSort })
          if (r && r.error) setErr(r.error.message)
        }}>Add room</button>
      </div>
    </Modal>
  )
}

function Teams({ data, done, refresh }) {
  const [name, setName] = useState('')
  return (
    <div>
      <div className="formRow" style={{ maxWidth: 420, marginBottom: 16 }}>
        <input className="searchBox" value={name} onChange={(e) => setName(e.target.value)} placeholder="New team name" />
        <button className="btn accent" style={{ flex: 'none' }} onClick={async () => { if (name.trim()) { done(await api.addTeam(name.trim())); setName('') } }}><Plus size={15} /> Add</button>
      </div>
      {data.teams.map((t) => (
        <div key={t.id} className="listRow" style={{ cursor: 'default' }}>
          <div className="lr-main"><div className="lr-title">{t.name}</div></div>
          <button className="btn sm danger" onClick={async () => { if (confirm('Delete team? Containers keep their items but lose the team link.')) done(await api.deleteTeam(t.id)) }}><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  )
}

function Members({ data, refresh }) {
  const [draft, setDraft] = useState({}) // userId -> Set(teamId)
  const teamsFor = (uid) => {
    if (draft[uid]) return draft[uid]
    return new Set(data.userTeams.filter((ut) => ut.user_id === uid).map((ut) => ut.team_id))
  }
  const toggle = (uid, tid) => {
    const s = new Set(teamsFor(uid))
    if (s.has(tid)) s.delete(tid); else s.add(tid)
    setDraft({ ...draft, [uid]: s })
  }
  const save = async (uid) => {
    const r = await api.setUserTeams(uid, Array.from(teamsFor(uid)))
    if (r && r.error) alert(r.error.message)
    await refresh()
    const d = { ...draft }; delete d[uid]; setDraft(d)
  }

  const approved = data.profiles.filter((p) => p.is_approved || p.is_admin)
  if (approved.length === 0) return <div className="hint">No approved members yet. Approve new sign-ups in the Pending tab.</div>
  return (
    <div>
      <div className="hint" style={{ marginBottom: 14 }}>Tick the teams each member can edit, then Save. Members can edit shelves owned by any of their teams.</div>
      {approved.map((p) => (
        <div key={p.id} className="card" style={{ marginBottom: 14 }}>
          <h3>{fullName(p)} {p.is_admin && <span className="pill roleLead">admin</span>}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12 }}>
            {data.teams.map((t) => (
              <label key={t.id} className="checkRow"><input type="checkbox" checked={teamsFor(p.id).has(t.id)} onChange={() => toggle(p.id, t.id)} /> {t.name}</label>
            ))}
          </div>
          <button className="btn accent sm" onClick={() => save(p.id)}><Save size={13} /> Save teams</button>
        </div>
      ))}
    </div>
  )
}
