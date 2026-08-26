import React, { useEffect, useState } from 'react'
import {
  X, ChevronRight, Plus, Pencil, Trash2, ClipboardCheck, PackageOpen,
  LogOut, LogIn, Save,
} from 'lucide-react'
import { replacementBadge, fmtDate, fmtDateTime } from '../lib/helpers'
import * as api from '../lib/data'

/* ------------------------- small forms ------------------------- */
function ItemForm({ initial, onCancel, onSave }) {
  const [f, setF] = useState({
    name: initial?.name || '', qty: initial?.qty ?? 1,
    loc_detail: initial?.loc_detail || '', status: initial?.status || 'Available',
    needs_replacement_by: initial?.needs_replacement_by || '',
    needs_replacement_note: initial?.needs_replacement_note || '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function submit() {
    if (!f.name.trim()) { setErr('Name is required'); return }
    setBusy(true)
    const payload = {
      name: f.name.trim(), qty: parseInt(f.qty, 10) || 0,
      loc_detail: f.loc_detail.trim() || null, status: f.status.trim() || null,
      needs_replacement_by: f.needs_replacement_by || null,
      needs_replacement_note: f.needs_replacement_note.trim() || null,
    }
    const { error } = await onSave(payload)
    setBusy(false)
    if (error) setErr(error.message)
  }
  return (
    <div>
      <div className="field"><label>Item name</label><input value={f.name} onChange={up('name')} autoFocus /></div>
      <div className="formRow">
        <div className="field"><label>Quantity</label><input type="number" value={f.qty} onChange={up('qty')} /></div>
        <div className="field"><label>Status</label><input value={f.status} onChange={up('status')} placeholder="Available" /></div>
      </div>
      <div className="field"><label>Location detail</label><input value={f.loc_detail} onChange={up('loc_detail')} placeholder="e.g. Bin 3, upper shelf" /></div>
      <div className="formRow">
        <div className="field"><label>Needs replacement by</label><input type="date" value={f.needs_replacement_by || ''} onChange={up('needs_replacement_by')} /></div>
        <div className="field"><label>Replacement note</label><input value={f.needs_replacement_note} onChange={up('needs_replacement_note')} placeholder="e.g. chain worn" /></div>
      </div>
      {err && <div className="errText">{err}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn accent" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save item'}</button>
      </div>
    </div>
  )
}

function CheckoutForm({ onCancel, onSave }) {
  const [name, setName] = useState('')
  const [due, setDue] = useState('')
  const [err, setErr] = useState('')
  async function submit() {
    if (!name.trim()) { setErr('Enter who is taking it'); return }
    const { error } = await onSave({ checked_out_by: name.trim(), due_back_at: due ? new Date(due).toISOString() : null })
    if (error) setErr(error.message)
  }
  return (
    <div>
      <div className="field"><label>Checked out by</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Member name" autoFocus /></div>
      <div className="field"><label>Due back (optional)</label><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
      {err && <div className="errText">{err}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn accent" onClick={submit}>Check out</button>
      </div>
    </div>
  )
}

function ContainerForm({ teams, allowedTeamIds, isAdmin, onCancel, onSave }) {
  const options = isAdmin ? teams : teams.filter((t) => allowedTeamIds.includes(t.id))
  const [name, setName] = useState('')
  const [teamId, setTeamId] = useState(options[0]?.id || '')
  const [vehicle, setVehicle] = useState(false)
  const [err, setErr] = useState('')
  async function submit() {
    if (!name.trim()) { setErr('Name is required'); return }
    if (!isAdmin && !teamId) { setErr('Pick a team you belong to'); return }
    const { error } = await onSave({ name: name.trim(), team_id: teamId || null, is_vehicle_unit: vehicle })
    if (error) setErr(error.message)
  }
  return (
    <div>
      <div className="field"><label>Shelf / unit name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shelf C" autoFocus /></div>
      <div className="field">
        <label>Responsible team{isAdmin ? ' (optional)' : ''}</label>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {isAdmin && <option value="">— none —</option>}
          {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <label className="checkRow"><input type="checkbox" checked={vehicle} onChange={(e) => setVehicle(e.target.checked)} /> Vehicle / trailer unit (adds an SOP tab)</label>
      {err && <div className="errText">{err}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn accent" onClick={submit}>Add shelf</button>
      </div>
    </div>
  )
}

/* ------------------------- main drawer ------------------------- */
export default function DetailDrawer({ ctx, drawer }) {
  const {
    data, session, userId, isAdmin, myTeamIds, canEditContainer, teamName, profileName,
    refresh, openRoom, openContainer, openItem, openInventory, closeDrawer,
  } = ctx

  const [tab, setTab] = useState('items')
  const [modal, setModal] = useState(null) // {type, item}
  const [invDraft, setInvDraft] = useState({})
  const [sop, setSop] = useState({ setup_sop: '', takedown_sop: '' })

  const rooms = data.rooms
  const room = rooms.find((r) => r.id === drawer.roomId)
  const container = data.containers.find((c) => c.id === drawer.containerId)
  const item = data.items.find((i) => i.id === drawer.itemId)
  const containersOfRoom = data.containers.filter((c) => c.room_id === drawer.roomId)
  const itemsOfContainer = data.items.filter((i) => i.container_id === drawer.containerId)
  const canEdit = canEditContainer(container)

  useEffect(() => { setTab('items') }, [drawer.containerId])
  useEffect(() => {
    if (drawer.mode === 'inventory') {
      const d = {}
      itemsOfContainer.forEach((i) => { d[i.id] = i.qty })
      setInvDraft(d)
    }
    if (container) setSop({ setup_sop: container.setup_sop || '', takedown_sop: container.takedown_sop || '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.mode, drawer.containerId])

  if (!drawer.open) {
    return (
      <div id="drawer">
        <div id="drawerInner"><div id="drawerPlaceholder">Select a room on the floorplan, or search for an item, to see what’s inside.</div></div>
      </div>
    )
  }

  const err = (r) => { if (r && r.error) alert(r.error.message) }
  const done = async (r) => { err(r); await refresh() }

  /* ---- ROOM MODE: container list ---- */
  function renderRoom() {
    const canAdd = !!session && (isAdmin || myTeamIds.length > 0)
    return (
      <>
        <div id="drawerHead">
          <button className="drawerClose" onClick={closeDrawer}><X size={18} /></button>
          <div className="eyebrow">{room?.kind || 'Room'}</div>
          <h3>{room?.name}</h3>
        </div>
        <div id="drawerBody">
          {containersOfRoom.length === 0 ? (
            <div className="emptyState"><div className="big">🗄️</div>Nothing logged in this room yet.</div>
          ) : (
            <>
              <p className="sectionLabel">Tap a shelf to see what’s inside</p>
              {containersOfRoom.map((c) => {
                const n = data.items.filter((i) => i.container_id === c.id).length
                const tn = teamName(c.team_id)
                return (
                  <div key={c.id} className="containerRow" onClick={() => openContainer(c.room_id, c.id)}>
                    <div>
                      <div className="crName">{c.name} {tn && <span className="teamBadge">{tn}</span>}</div>
                      <div className="crCount">{n === 1 ? '1 item' : n + ' items'} · {c.last_checked_at ? 'checked ' + fmtDate(c.last_checked_at) : 'never checked'}</div>
                    </div>
                    <ChevronRight className="crArrow" size={18} />
                  </div>
                )
              })}
            </>
          )}
          {canAdd && <button className="btn dashed block" style={{ marginTop: 12 }} onClick={() => setModal({ type: 'addContainer' })}><Plus size={14} /> Add shelf / unit</button>}
        </div>
      </>
    )
  }

  /* ---- CONTAINER MODE: items + optional SOP tab ---- */
  function renderContainer() {
    return (
      <>
        <div id="drawerHead">
          <button className="drawerBack" onClick={() => openRoom(drawer.roomId)}>‹ {room?.name}</button>
          <button className="drawerClose" onClick={closeDrawer}><X size={18} /></button>
          <div className="eyebrow">{room?.name}{teamName(container?.team_id) ? ' · ' + teamName(container.team_id) : ''}</div>
          <h3>{container?.name}</h3>
        </div>
        <div id="drawerBody">
          <div className="crCount" style={{ marginBottom: 12 }}>
            {container?.last_checked_at
              ? `Last checked ${fmtDate(container.last_checked_at)}${container.last_checked_by ? ' by ' + profileName(container.last_checked_by) : ''}`
              : 'Never checked'}
          </div>

          {container?.is_vehicle_unit && (
            <div className="tabs">
              <button className={'tab' + (tab === 'items' ? ' active' : '')} onClick={() => setTab('items')}>Items</button>
              <button className={'tab' + (tab === 'sop' ? ' active' : '')} onClick={() => setTab('sop')}>SOP</button>
            </div>
          )}

          {tab === 'sop' && container?.is_vehicle_unit ? renderSOP() : renderItemsList()}
        </div>
      </>
    )
  }

  function renderItemsList() {
    return (
      <>
        {canEdit && itemsOfContainer.length > 0 && (
          <button className="btn accent block" style={{ marginBottom: 12 }} onClick={() => openInventory(drawer.roomId, drawer.containerId)}><ClipboardCheck size={15} /> Take Inventory</button>
        )}
        {itemsOfContainer.length === 0 ? (
          <div className="emptyState"><div className="big">📦</div>Nothing logged yet in {container?.name}.</div>
        ) : (
          itemsOfContainer.map((it) => {
            const badge = replacementBadge(it.needs_replacement_by)
            const co = data.checkouts.find((x) => x.item_id === it.id)
            return (
              <div key={it.id} className="item" onClick={() => openItem(drawer.roomId, drawer.containerId, it.id)}>
                <div className="itop">
                  <span className="iname">{it.name}{badge && <span className={'badge ' + badge.kind} style={{ marginLeft: 8 }}>{badge.label}</span>}</span>
                  <span className="iqty">×{it.qty}</span>
                </div>
                <div className="iloc">{it.loc_detail || 'No location detail'}</div>
                {it.status && <span className="istatus">{it.status}</span>}
                {co && <span className="badge soon" style={{ marginLeft: 8 }}>Out: {co.checked_out_by}</span>}
              </div>
            )
          })
        )}
        {canEdit && <button className="btn dashed block" style={{ marginTop: 6 }} onClick={() => setModal({ type: 'addItem' })}><Plus size={14} /> Add item</button>}
      </>
    )
  }

  function renderSOP() {
    return (
      <>
        <div className="field"><label>Setup procedure</label>
          <textarea disabled={!canEdit} value={sop.setup_sop} onChange={(e) => setSop({ ...sop, setup_sop: e.target.value })} placeholder={canEdit ? 'Describe how this unit is set up for deployment…' : 'No setup procedure logged yet.'} />
        </div>
        <div className="field"><label>Takedown procedure</label>
          <textarea disabled={!canEdit} value={sop.takedown_sop} onChange={(e) => setSop({ ...sop, takedown_sop: e.target.value })} placeholder={canEdit ? 'Describe how this unit is packed down after use…' : 'No takedown procedure logged yet.'} />
        </div>
        {container?.sop_updated_at && <div className="hint">Updated {fmtDateTime(container.sop_updated_at)}{container.sop_updated_by ? ' by ' + profileName(container.sop_updated_by) : ''}</div>}
        {canEdit && <button className="btn accent block" style={{ marginTop: 10 }} onClick={async () => done(await api.saveSOP(container.id, sop, userId))}><Save size={15} /> Save SOP</button>}
      </>
    )
  }

  /* ---- ITEM MODE ---- */
  function renderItem() {
    if (!item) return null
    const badge = replacementBadge(item.needs_replacement_by)
    const co = data.checkouts.find((x) => x.item_id === item.id)
    return (
      <>
        <div id="drawerHead">
          <button className="drawerBack" onClick={() => openContainer(drawer.roomId, drawer.containerId)}>‹ {container?.name}</button>
          <button className="drawerClose" onClick={closeDrawer}><X size={18} /></button>
          <div className="eyebrow">{room?.name} → {container?.name}</div>
          <h3>{item.name}</h3>
        </div>
        <div id="drawerBody">
          <div className="kv"><span className="k">Quantity</span><span className="v" style={{ color: 'var(--ok)' }}>×{item.qty}</span></div>
          <div className="kv"><span className="k">Location</span><span className="v">{item.loc_detail || '—'}</span></div>
          <div className="kv"><span className="k">Status</span><span className="v">{item.status || '—'}</span></div>

          <p className="sectionLabel" style={{ marginTop: 20 }}>Replacement</p>
          {item.needs_replacement_by ? (
            <div className="kv"><span className="k">Replace by</span><span className="v">{fmtDate(item.needs_replacement_by)} {badge && <span className={'badge ' + badge.kind}>{badge.label}</span>}</span></div>
          ) : <div className="hint">No replacement date set.</div>}
          {item.needs_replacement_note && <div className="kv"><span className="k">Note</span><span className="v">{item.needs_replacement_note}</span></div>}

          <p className="sectionLabel" style={{ marginTop: 20 }}>Sign-out</p>
          {co ? (
            <>
              <div className="kv"><span className="k">Out with</span><span className="v">{co.checked_out_by}</span></div>
              <div className="kv"><span className="k">Since</span><span className="v">{fmtDateTime(co.checked_out_at)}</span></div>
              {co.due_back_at && <div className="kv"><span className="k">Due back</span><span className="v">{fmtDate(co.due_back_at)}</span></div>}
              {canEdit && <button className="btn block" style={{ marginTop: 10 }} onClick={async () => done(await api.checkinItem(co.id))}><LogIn size={15} /> Check in</button>}
            </>
          ) : (
            <>
              <div className="hint">Not currently signed out.</div>
              {canEdit && <button className="btn block" style={{ marginTop: 10 }} onClick={() => setModal({ type: 'checkout' })}><LogOut size={15} /> Check out</button>}
            </>
          )}

          {canEdit && (
            <div className="rowActions" style={{ marginTop: 20 }}>
              <button className="btn sm" onClick={() => setModal({ type: 'editItem', item })}><Pencil size={13} /> Edit</button>
              <button className="btn sm danger" onClick={async () => { if (confirm('Delete this item?')) { done(await api.deleteItem(item.id)); openContainer(drawer.roomId, drawer.containerId) } }}><Trash2 size={13} /> Delete</button>
            </div>
          )}
        </div>
      </>
    )
  }

  /* ---- INVENTORY MODE ---- */
  function renderInventory() {
    return (
      <>
        <div id="drawerHead">
          <button className="drawerBack" onClick={() => openContainer(drawer.roomId, drawer.containerId)}>‹ {container?.name}</button>
          <button className="drawerClose" onClick={closeDrawer}><X size={18} /></button>
          <div className="eyebrow">Take Inventory</div>
          <h3>{container?.name}</h3>
        </div>
        <div id="drawerBody">
          {!canEdit && <div className="hint" style={{ marginBottom: 12 }}>You can view these counts, but only {teamName(container?.team_id) || 'the responsible team'} or an admin can save changes.</div>}
          {itemsOfContainer.length === 0 ? (
            <div className="emptyState"><div className="big">📦</div>No items to count yet.</div>
          ) : itemsOfContainer.map((it) => (
            <div key={it.id} className="item" style={{ cursor: 'default' }}>
              <div className="itop"><span className="iname">{it.name}</span></div>
              <div className="iloc">{it.loc_detail || '—'}</div>
              <div className="field" style={{ margin: '8px 0 0' }}>
                <input type="number" disabled={!canEdit} value={invDraft[it.id] ?? it.qty}
                  onChange={(e) => setInvDraft({ ...invDraft, [it.id]: e.target.value })} />
              </div>
            </div>
          ))}
          {canEdit && itemsOfContainer.length > 0 && (
            <button className="btn accent block" style={{ marginTop: 10 }} onClick={async () => {
              const updates = itemsOfContainer
                .filter((it) => String(invDraft[it.id]) !== String(it.qty))
                .map((it) => ({ id: it.id, qty: parseInt(invDraft[it.id], 10) || 0 }))
              done(await api.saveInventory(container.id, updates, userId))
              openContainer(drawer.roomId, drawer.containerId)
            }}><Save size={15} /> Save inventory check</button>
          )}
        </div>
      </>
    )
  }

  /* ---- admin container controls (footer inside container mode) ---- */
  function renderAdminContainerControls() {
    if (!container) return null
    return (
      <div style={{ borderTop: '1px solid var(--line)', padding: '12px 20px' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Owning team (admin)</label>
          <select value={container.team_id || ''} onChange={async (e) => done(await api.updateContainer(container.id, { team_id: e.target.value || null }))}>
            <option value="">— none —</option>
            {data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <button className="btn sm danger block" style={{ marginTop: 10 }} onClick={async () => {
          if (confirm('Delete this shelf and everything in it?')) { done(await api.deleteContainer(container.id)); openRoom(drawer.roomId) }
        }}><Trash2 size={13} /> Delete shelf</button>
      </div>
    )
  }

  return (
    <div id="drawer" className="open">
      <div id="drawerInner">
        {drawer.mode === 'room' && renderRoom()}
        {drawer.mode === 'container' && renderContainer()}
        {drawer.mode === 'item' && renderItem()}
        {drawer.mode === 'inventory' && renderInventory()}
        {drawer.mode === 'container' && isAdmin && renderAdminContainerControls()}
      </div>

      {modal?.type === 'addItem' && (
        <ModalWrap title="Add item" onClose={() => setModal(null)}>
          <ItemForm onCancel={() => setModal(null)} onSave={async (p) => { const r = await api.saveItem({ ...p, container_id: drawer.containerId }, userId); if (!r.error) { setModal(null); await refresh() } return r }} />
        </ModalWrap>
      )}

      {modal?.type === 'editItem' && (
        <ModalWrap title="Edit item" onClose={() => setModal(null)}>
          <ItemForm initial={modal.item} onCancel={() => setModal(null)} onSave={async (p) => { const r = await api.saveItem({ ...p, id: modal.item.id }, userId); if (!r.error) { setModal(null); await refresh() } return r }} />
        </ModalWrap>
      )}

      {modal?.type === 'checkout' && (
        <ModalWrap title="Check out item" onClose={() => setModal(null)}>
          <CheckoutForm onCancel={() => setModal(null)} onSave={async (p) => { const r = await api.checkoutItem(item.id, p); if (!r.error) { setModal(null); await refresh() } return r }} />
        </ModalWrap>
      )}

      {modal?.type === 'addContainer' && (
        <ModalWrap title="Add shelf / unit" onClose={() => setModal(null)}>
          <ContainerForm teams={data.teams} allowedTeamIds={myTeamIds} isAdmin={isAdmin} onCancel={() => setModal(null)} onSave={async (p) => {
            const sort = (containersOfRoom.reduce((m, c) => Math.max(m, c.sort_order || 0), 0) || 0) + 1
            const r = await api.addContainer({ ...p, room_id: drawer.roomId, sort_order: sort })
            if (!r.error) { setModal(null); await refresh() } return r
          }} />
        </ModalWrap>
      )}
    </div>
  )
}

// tiny inline modal wrapper to avoid extra import churn
function ModalWrap({ title, onClose, children }) {
  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modalClose" onClick={onClose}>✕</button>
        <h3>{title}</h3>
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  )
}
