import React, { useState } from 'react'
import { Plus, Trash2, Pencil, CornerDownRight, ChevronRight, Star } from 'lucide-react'
import * as api from '../lib/data'
import Modal from './Modal'

function buildRows(positions) {
  const byParent = {}
  positions.forEach((p) => { const k = p.parent_id || 'root'; (byParent[k] = byParent[k] || []).push(p) })
  Object.values(byParent).forEach((arr) => arr.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)))
  const rows = []
  const walk = (key, depth) => (byParent[key] || []).forEach((n) => { rows.push({ node: n, depth }); walk(n.id, depth + 1) })
  walk('root', 0)
  return rows
}

export default function OrgChart({ ctx }) {
  const { data, isAdmin, refresh } = ctx
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)

  const rows = buildRows(data.orgPositions)
  const membersOf = (pid) => data.orgMembers.filter((m) => m.position_id === pid)
  const done = async (r) => { if (r && r.error) alert(r.error.message); await refresh() }
  const nextSort = (arr) => (arr.reduce((m, x) => Math.max(m, x.sort_order || 0), 0) || 0) + 1

  const sel = selected ? data.orgPositions.find((p) => p.id === selected) : null

  return (
    <div>
      <div className="pageHead">
        <h2>Org Chart</h2>
        <p>The association structure &amp; rosters. Tap a position to see its people.</p>
      </div>

      {isAdmin && (
        <button className="btn accent" style={{ marginBottom: 16 }} onClick={() => setModal({ type: 'addPos', parentId: null })}>
          <Plus size={15} /> Add top-level position
        </button>
      )}

      <div className="grid2" style={{ alignItems: 'start' }}>
        {/* tree */}
        <div className="card">
          <h3>Structure</h3>
          {rows.length === 0 ? <div className="hint">No positions yet.</div> : rows.map(({ node, depth }) => (
            <div key={node.id}
              className={'listRow' + (selected === node.id ? ' selectedRow' : '')}
              style={{ marginLeft: depth * 18, borderLeft: depth ? '2px solid var(--line)' : undefined }}
              onClick={() => setSelected(node.id)}>
              <div className="lr-main">
                <div className="lr-title">
                  {depth > 0 && <CornerDownRight size={13} color="var(--muted)" />}
                  {node.title}
                </div>
                <div className="lr-sub">{membersOf(node.id).length} {membersOf(node.id).length === 1 ? 'person' : 'people'}</div>
              </div>
              {isAdmin ? (
                <div className="rowActions" style={{ margin: 0 }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn sm ghost" title="Add sub-position" onClick={() => setModal({ type: 'addPos', parentId: node.id })}><Plus size={13} /></button>
                  <button className="btn sm ghost" title="Rename" onClick={() => setModal({ type: 'rename', node })}><Pencil size={13} /></button>
                  <button className="btn sm danger" title="Delete" onClick={async () => { if (confirm(`Delete "${node.title}" and everything under it?`)) { await done(await api.deletePosition(node.id)); if (selected === node.id) setSelected(null) } }}><Trash2 size={13} /></button>
                </div>
              ) : <ChevronRight className="lr-arrow" size={16} />}
            </div>
          ))}
        </div>

        {/* roster */}
        <div className="card">
          {!sel ? <div className="hint">Select a position to view its roster.</div> : (
            <Roster position={sel} members={membersOf(sel.id)} isAdmin={isAdmin}
              onAdd={() => setModal({ type: 'addMember', positionId: sel.id })}
              onDelete={async (id) => done(await api.deletePositionMember(id))}
              onRole={async (id, role) => done(await api.updatePositionMemberRole(id, role))} />
          )}
        </div>
      </div>

      {modal?.type === 'addPos' && (
        <TitleModal title={modal.parentId ? 'Add sub-position' : 'Add top-level position'} onClose={() => setModal(null)}
          onSave={async (t) => { const r = await api.addPosition({ parent_id: modal.parentId, title: t, sort_order: nextSort(data.orgPositions.filter((p) => (p.parent_id || null) === modal.parentId)) }); if (!r.error) { setModal(null); await refresh() } return r }} />
      )}
      {modal?.type === 'rename' && (
        <TitleModal title="Rename position" initial={modal.node.title} onClose={() => setModal(null)}
          onSave={async (t) => { const r = await api.updatePosition(modal.node.id, { title: t }); if (!r.error) { setModal(null); await refresh() } return r }} />
      )}
      {modal?.type === 'addMember' && (
        <MemberModal onClose={() => setModal(null)}
          onSave={async (payload) => { const r = await api.addPositionMember({ position_id: modal.positionId, ...payload, sort_order: nextSort(membersOf(modal.positionId)) }); if (!r.error) { setModal(null); await refresh() } return r }} />
      )}
    </div>
  )
}

function Roster({ position, members, isAdmin, onAdd, onDelete, onRole }) {
  const leads = members.filter((m) => m.role === 'Lead')
  const rest = members.filter((m) => m.role !== 'Lead')

  const Row = ({ m }) => (
    <div className="listRow" style={{ cursor: 'default' }}>
      <div className="lr-main"><div className="lr-title">{m.role === 'Lead' && <Star size={12} color="var(--accent)" />}{m.name} {m.role && <span className={'pill' + (m.role === 'Lead' ? ' roleLead' : '')}>{m.role}</span>}</div></div>
      {isAdmin && (
        <div className="rowActions" style={{ margin: 0 }}>
          <button className="btn sm" onClick={() => onRole(m.id, m.role === 'Lead' ? 'Member' : 'Lead')}>{m.role === 'Lead' ? 'Make member' : 'Make lead'}</button>
          <button className="btn sm danger" onClick={() => onDelete(m.id)}><Trash2 size={13} /></button>
        </div>
      )}
    </div>
  )

  return (
    <div>
      <h3>{position.title} <span className="count">{members.length} {members.length === 1 ? 'person' : 'people'}</span></h3>
      {isAdmin && <button className="btn accent sm" style={{ marginBottom: 14 }} onClick={onAdd}><Plus size={13} /> Add person</button>}
      {members.length === 0 ? <div className="hint">No one listed here yet.</div> : (
        <>
          {leads.length > 0 && <><p className="sectionLabel">Lead</p>{leads.map((m) => <Row key={m.id} m={m} />)}</>}
          {rest.length > 0 && <><p className="sectionLabel" style={{ marginTop: leads.length ? 14 : 0 }}>{leads.length ? 'Members' : 'Roster'}</p>{rest.map((m) => <Row key={m.id} m={m} />)}</>}
        </>
      )}
    </div>
  )
}

function TitleModal({ title, initial, onClose, onSave }) {
  const [t, setT] = useState(initial || '')
  const [err, setErr] = useState('')
  return (
    <Modal title={title} onClose={onClose}>
      <div className="field"><label>Title</label><input value={t} onChange={(e) => setT(e.target.value)} autoFocus /></div>
      {err && <div className="errText">{err}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn accent" onClick={async () => { if (!t.trim()) { setErr('Title required'); return } const r = await onSave(t.trim()); if (r && r.error) setErr(r.error.message) }}>Save</button>
      </div>
    </Modal>
  )
}

function MemberModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [err, setErr] = useState('')
  return (
    <Modal title="Add person" sub="Set Lead/Member for unit-style nodes; leave role as none for plain rank lists." onClose={onClose}>
      <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      <div className="field"><label>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">(no role — plain list)</option>
          <option value="Lead">Lead</option>
          <option value="Member">Member</option>
        </select>
      </div>
      {err && <div className="errText">{err}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn accent" onClick={async () => { if (!name.trim()) { setErr('Name required'); return } const r = await onSave({ name: name.trim(), role: role || null }); if (r && r.error) setErr(r.error.message) }}>Add</button>
      </div>
    </Modal>
  )
}
