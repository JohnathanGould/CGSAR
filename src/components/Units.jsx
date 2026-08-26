import React, { useState } from 'react'
import { ChevronRight, Plus, Trash2, ArrowLeft } from 'lucide-react'
import * as api from '../lib/data'
import Modal from './Modal'

export default function Units({ ctx }) {
  const { data, isAdmin, refresh } = ctx
  const [selected, setSelected] = useState(null)
  const [addUnitOpen, setAddUnitOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)

  const membersOf = (unitId) => data.unitMembers.filter((m) => m.unit_id === unitId)
  const done = async (r) => { if (r && r.error) alert(r.error.message); await refresh() }

  if (selected) {
    const unit = data.units.find((u) => u.id === selected)
    if (!unit) { setSelected(null); return null }
    const members = membersOf(unit.id)
    const leads = members.filter((m) => m.role === 'Lead')
    const regular = members.filter((m) => m.role !== 'Lead')

    const Section = ({ title, list }) => (
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>{title} <span className="count">{list.length}</span></h3>
        {list.length === 0 ? <div className="hint">Nobody listed yet.</div> : list.map((m) => (
          <div key={m.id} className="listRow" style={{ cursor: 'default' }}>
            <div className="lr-main"><div className="lr-title">{m.name} <span className={'pill' + (m.role === 'Lead' ? ' roleLead' : '')}>{m.role}</span></div></div>
            {isAdmin && (
              <div className="rowActions" style={{ margin: 0 }}>
                <button className="btn sm" onClick={async () => done(await api.updateUnitMemberRole(m.id, m.role === 'Lead' ? 'Member' : 'Lead'))}>{m.role === 'Lead' ? 'Make member' : 'Make lead'}</button>
                <button className="btn sm danger" onClick={async () => done(await api.deleteUnitMember(m.id))}><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    )

    return (
      <div>
        <button className="btn ghost sm" style={{ marginBottom: 14 }} onClick={() => setSelected(null)}><ArrowLeft size={14} /> All units</button>
        <div className="pageHead"><h2>{unit.name}</h2><p>Unit roster — leads and members.</p></div>
        {isAdmin && <button className="btn accent" style={{ marginBottom: 16 }} onClick={() => setAddMemberOpen(true)}><Plus size={15} /> Add person</button>}
        <Section title="Lead" list={leads} />
        <Section title="Members" list={regular} />

        {addMemberOpen && (
          <AddMemberModal onClose={() => setAddMemberOpen(false)} onSave={async (payload) => {
            const sort = (membersOf(unit.id).reduce((m, x) => Math.max(m, x.sort_order || 0), 0) || 0) + 1
            const r = await api.addUnitMember({ unit_id: unit.id, ...payload, sort_order: sort })
            if (!r.error) { setAddMemberOpen(false); await refresh() }
            return r
          }} />
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="pageHead"><h2>Units</h2><p>Organizational roster — who leads and staffs each unit. Separate from inventory teams.</p></div>
      {isAdmin && <button className="btn accent" style={{ marginBottom: 16 }} onClick={() => setAddUnitOpen(true)}><Plus size={15} /> Add unit</button>}
      {data.units.length === 0 ? <div className="emptyState">No units yet.</div> : data.units.map((u) => (
        <div key={u.id} className="listRow" onClick={() => setSelected(u.id)}>
          <div className="lr-main">
            <div className="lr-title">{u.name}</div>
            <div className="lr-sub">{membersOf(u.id).length} {membersOf(u.id).length === 1 ? 'member' : 'members'}</div>
          </div>
          <div className="rowActions" style={{ margin: 0, alignItems: 'center' }}>
            {isAdmin && <button className="btn sm danger" onClick={async (e) => { e.stopPropagation(); if (confirm('Remove this unit?')) done(await api.deleteUnit(u.id)) }}><Trash2 size={13} /></button>}
            <ChevronRight className="lr-arrow" size={16} />
          </div>
        </div>
      ))}

      {addUnitOpen && (
        <AddUnitModal onClose={() => setAddUnitOpen(false)} onSave={async (name) => {
          const sort = (data.units.reduce((m, u) => Math.max(m, u.sort_order || 0), 0) || 0) + 1
          const r = await api.addUnit(name, sort)
          if (!r.error) { setAddUnitOpen(false); await refresh() }
          return r
        }} />
      )}
    </div>
  )
}

function AddUnitModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  return (
    <Modal title="Add unit" onClose={onClose}>
      <div className="field"><label>Unit name</label><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      {err && <div className="errText">{err}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn accent" onClick={async () => { if (!name.trim()) { setErr('Name required'); return } const r = await onSave(name.trim()); if (r && r.error) setErr(r.error.message) }}>Add</button>
      </div>
    </Modal>
  )
}

function AddMemberModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('Member')
  const [err, setErr] = useState('')
  return (
    <Modal title="Add person" onClose={onClose}>
      <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      <div className="field"><label>Role</label><select value={role} onChange={(e) => setRole(e.target.value)}><option>Member</option><option>Lead</option></select></div>
      {err && <div className="errText">{err}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn accent" onClick={async () => { if (!name.trim()) { setErr('Name required'); return } const r = await onSave({ name: name.trim(), role }); if (r && r.error) setErr(r.error.message) }}>Add</button>
      </div>
    </Modal>
  )
}
