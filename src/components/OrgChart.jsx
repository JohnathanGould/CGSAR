import React, { useState } from 'react'
import { Plus, Trash2, Pencil, CornerDownRight, ChevronRight, UserPlus } from 'lucide-react'
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
  // The people filling a position (usually one; co-chairs or a deputy possible).
  const membersOf = (pid) => data.orgMembers.filter((m) => m.position_id === pid)
  const filledBy = (pid) => membersOf(pid).map((m) => m.name).join(', ')
  // Approved members' names, offered as suggestions when assigning someone.
  const memberNames = [...new Set(data.profiles.filter((p) => p.is_approved || p.is_admin)
    .map((p) => [p.first_name, p.last_name].filter(Boolean).join(' ').trim()).filter(Boolean))].sort()
  const done = async (r) => { if (r && r.error) alert(r.error.message); await refresh() }
  const nextSort = (arr) => (arr.reduce((m, x) => Math.max(m, x.sort_order || 0), 0) || 0) + 1

  const sel = selected ? data.orgPositions.find((p) => p.id === selected) : null

  return (
    <div>
      <div className="pageHead">
        <h2>Org Chart</h2>
        <p>The association’s positions and who fills each one. Tap a position for details.</p>
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
                <div className="lr-sub" style={filledBy(node.id) ? { color: 'var(--text)' } : undefined}>{filledBy(node.id) || 'Vacant'}</div>
              </div>
              {isAdmin ? (
                <div className="rowActions" style={{ margin: 0 }} onClick={(e) => e.stopPropagation()}>
                  {!membersOf(node.id).length && <button className="btn sm ghost" title="Assign person" onClick={() => { setSelected(node.id); setModal({ type: 'person', positionId: node.id }) }}><UserPlus size={13} /></button>}
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
          {!sel ? <div className="hint">Select a position to see who fills it.</div> : (
            <PositionPanel position={sel} people={membersOf(sel.id)} isAdmin={isAdmin}
              onAssign={() => setModal({ type: 'person', positionId: sel.id })}
              onEdit={(m) => setModal({ type: 'person', positionId: sel.id, member: m })}
              onRemove={async (m) => { if (confirm(`Remove ${m.name} from ${sel.title}?`)) await done(await api.deletePositionMember(m.id)) }} />
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
      {modal?.type === 'person' && (
        <PersonModal
          positionTitle={data.orgPositions.find((p) => p.id === modal.positionId)?.title}
          initial={modal.member?.name} suggestions={memberNames} onClose={() => setModal(null)}
          onSave={async (name) => {
            const r = modal.member
              ? await api.updatePositionMember(modal.member.id, { name })
              : await api.addPositionMember({ position_id: modal.positionId, name, role: null, sort_order: nextSort(membersOf(modal.positionId)) })
            if (!r.error) { setModal(null); await refresh() }
            return r
          }} />
      )}
    </div>
  )
}

function PositionPanel({ position, people, isAdmin, onAssign, onEdit, onRemove }) {
  return (
    <div>
      <h3>{position.title}</h3>
      <p className="sectionLabel">Filled by</p>
      {people.length === 0 ? <div className="hint" style={{ marginBottom: 12 }}>Vacant — no one assigned yet.</div> : people.map((m) => (
        <div key={m.id} className="listRow" style={{ cursor: 'default' }}>
          <div className="lr-main"><div className="lr-title">{m.name}</div></div>
          {isAdmin && (
            <div className="rowActions" style={{ margin: 0 }}>
              <button className="btn sm" title="Change who fills this position" onClick={() => onEdit(m)}><Pencil size={13} /> Change</button>
              <button className="btn sm danger" title="Remove from this position" onClick={() => onRemove(m)}><Trash2 size={13} /></button>
            </div>
          )}
        </div>
      ))}
      {isAdmin && (
        <button className={'btn sm' + (people.length ? ' ghost' : ' accent')} style={{ marginTop: 6 }} onClick={onAssign}>
          <UserPlus size={13} /> {people.length ? 'Add another person (e.g. co-chair)' : 'Assign person'}
        </button>
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

function PersonModal({ positionTitle, initial, suggestions, onClose, onSave }) {
  const [name, setName] = useState(initial || '')
  const [err, setErr] = useState('')
  return (
    <Modal title={initial ? 'Change person' : 'Assign person'} sub={positionTitle ? `Who fills the ${positionTitle} position?` : undefined} onClose={onClose}>
      <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} list="orgPeople" placeholder="Start typing a member’s name" autoFocus /></div>
      <datalist id="orgPeople">{suggestions.map((n) => <option key={n} value={n} />)}</datalist>
      {err && <div className="errText">{err}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn accent" onClick={async () => { if (!name.trim()) { setErr('Name required'); return } const r = await onSave(name.trim()); if (r && r.error) setErr(r.error.message) }}>Save</button>
      </div>
    </Modal>
  )
}
