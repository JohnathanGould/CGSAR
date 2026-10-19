import React, { useEffect, useState } from 'react'
import {
  X, ChevronRight, Plus, Pencil, Trash2, ClipboardCheck, PackageOpen,
  LogOut, LogIn, Save, QrCode, Camera, History, Truck, AlertTriangle, PackageX, FileText, Upload, Clock, CalendarCheck,
} from 'lucide-react'
import { replacementBadge, fmtDate, fmtDateTime, lowStock } from '../lib/helpers'
import * as api from '../lib/data'
import { SIDES, compartmentsOf, compartmentLabel } from '../lib/compartments'
import QRModal from './QRModal'
import VehicleDiagram from './VehicleDiagram'
import ReminderForm from './ReminderForm'

// Red/amber flags for anything needing attention before a unit rolls: gear
// that has expired or is due for service, unit due dates (MVI etc.), low stock.
function UnitFlags({ items, reminders = [], style }) {
  const dates = [...items.map((i) => i.needs_replacement_by), ...reminders.map((r) => r.due_date)]
  const kinds = dates.map((d) => replacementBadge(d)?.kind)
  const overdue = kinds.filter((k) => k === 'overdue').length
  const soon = kinds.filter((k) => k === 'soon').length
  const low = items.filter(lowStock).length
  if (!overdue && !soon && !low) return null
  return (
    <div className="rowActions" style={{ margin: 0, ...style }}>
      {overdue > 0 && <span className="badge overdue"><AlertTriangle size={11} /> {overdue} overdue</span>}
      {soon > 0 && <span className="badge soon"><Clock size={11} /> {soon} due soon</span>}
      {low > 0 && <span className="badge low"><PackageX size={11} /> {low} low stock</span>}
    </div>
  )
}

/* ------------------------- small forms ------------------------- */
function ItemForm({ initial, compartments = [], defaultCompartmentId, onCancel, onSave }) {
  const [f, setF] = useState({
    compartment_id: initial ? (initial.compartment_id || '') : (defaultCompartmentId || ''),
    name: initial?.name || '', qty: initial?.qty ?? 1, min_qty: initial?.min_qty ?? 0,
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
      name: f.name.trim(), qty: parseInt(f.qty, 10) || 0, min_qty: parseInt(f.min_qty, 10) || 0,
      loc_detail: f.loc_detail.trim() || null, status: f.status.trim() || null,
      needs_replacement_by: f.needs_replacement_by || null,
      needs_replacement_note: f.needs_replacement_note.trim() || null,
    }
    // Only send compartment_id when the unit has compartments, so saving still
    // works on a database that hasn't run the compartments migration yet.
    if (compartments.length) payload.compartment_id = f.compartment_id || null
    const { error } = await onSave(payload)
    setBusy(false)
    if (error) setErr(error.message)
  }
  return (
    <div>
      <div className="field"><label>Item name</label><input value={f.name} onChange={up('name')} autoFocus /></div>
      <div className="formRow">
        <div className="field"><label>Quantity</label><input type="number" value={f.qty} onChange={up('qty')} /></div>
        <div className="field"><label>Low-stock min</label><input type="number" value={f.min_qty} onChange={up('min_qty')} /></div>
        <div className="field"><label>Status</label><input value={f.status} onChange={up('status')} placeholder="Available" /></div>
      </div>
      {compartments.length > 0 && (
        <div className="field">
          <label>Compartment</label>
          <select value={f.compartment_id} onChange={up('compartment_id')}>
            <option value="">— not assigned —</option>
            {compartments.map((c) => <option key={c.id} value={c.id}>{compartmentLabel(c)}</option>)}
          </select>
        </div>
      )}
      <div className="field"><label>Location detail</label><input value={f.loc_detail} onChange={up('loc_detail')} placeholder={compartments.length ? 'e.g. Top shelf, black Pelican case' : 'e.g. Bin 3, upper shelf'} /></div>
      <div className="formRow">
        <div className="field"><label>Expires / service due</label><input type="date" value={f.needs_replacement_by || ''} onChange={up('needs_replacement_by')} /></div>
        <div className="field"><label>Note</label><input value={f.needs_replacement_note} onChange={up('needs_replacement_note')} placeholder="e.g. lot 42B, annual service" /></div>
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

function DocForm({ file, initialTitle, onCancel, onSave }) {
  const [title, setTitle] = useState(initialTitle || '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    if (!title.trim()) { setErr('Give the document a title'); return }
    setBusy(true)
    const r = await onSave(title.trim())
    setBusy(false)
    if (r && r.error) setErr(r.error.message)
  }
  return (
    <div>
      {file && <div className="hint" style={{ marginTop: 0 }}><FileText size={12} style={{ verticalAlign: '-2px' }} /> {file.name} · {(file.size / 1048576).toFixed(1)} MB</div>}
      <div className="field">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} list="docTitles" placeholder="e.g. Setup SOP" autoFocus />
        <datalist id="docTitles"><option value="Setup SOP" /><option value="Takedown SOP" /></datalist>
      </div>
      {err && <div className="errText">{err}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn accent" onClick={submit} disabled={busy}>{busy ? (file ? 'Uploading…' : 'Saving…') : (file ? 'Upload' : 'Save')}</button>
      </div>
    </div>
  )
}

function CompartmentRow({ comp, onSave, onDelete }) {
  const [f, setF] = useState({ name: comp.name, side: comp.side, sort_order: comp.sort_order })
  const dirty = f.name !== comp.name || f.side !== comp.side || String(f.sort_order) !== String(comp.sort_order)
  return (
    <div className="compRow">
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <select value={f.side} onChange={(e) => setF({ ...f, side: e.target.value })}>
        {SIDES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <input className="num" type="number" title="Order (1 = front-most)" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} />
      {dirty
        ? <button className="btn sm accent" disabled={!f.name.trim()} onClick={() => onSave({ name: f.name.trim(), side: f.side, sort_order: parseInt(f.sort_order, 10) || 0 })}><Save size={13} /></button>
        : <button className="btn sm danger" title="Delete compartment" onClick={onDelete}><Trash2 size={13} /></button>}
    </div>
  )
}

function CompartmentEditor({ container, compartments, items, onChange }) {
  const [name, setName] = useState('')
  const [side, setSide] = useState('driver')
  const [err, setErr] = useState('')
  const run = async (r) => { if (r.error) setErr(r.error.message); else { setErr(''); await onChange() } }
  async function add() {
    if (!name.trim()) { setErr('Give the compartment a name'); return }
    const order = compartments.filter((c) => c.side === side).reduce((m, c) => Math.max(m, c.sort_order || 0), 0) + 1
    await run(await api.addCompartment({ container_id: container.id, name: name.trim(), side, sort_order: order }))
    setName('')
  }
  return (
    <div>
      <p className="hint" style={{ marginTop: 0 }}>Name each door or area the way the team says it on a callout. Order runs front → back (1 = closest to the cab).</p>
      {compartments.length === 0 && <div className="hint">No compartments yet.</div>}
      {compartments.map((c) => (
        <CompartmentRow key={c.id + ':' + c.name + ':' + c.side + ':' + c.sort_order} comp={c}
          onSave={async (patch) => run(await api.updateCompartment(c.id, patch))}
          onDelete={async () => {
            const n = items.filter((i) => i.compartment_id === c.id).length
            if (confirm(`Delete “${c.name}”?` + (n ? ` Its ${n} item${n === 1 ? '' : 's'} will stay on the unit as “not assigned”.` : ''))) run(await api.deleteCompartment(c.id))
          }} />
      ))}
      <p className="sectionLabel" style={{ marginTop: 16 }}>Add compartment</p>
      <div className="compRow">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rear upper" onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
        <select value={side} onChange={(e) => setSide(e.target.value)}>
          {SIDES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button className="btn sm accent" onClick={add}><Plus size={13} /> Add</button>
      </div>
      {err && <div className="errText">{err}</div>}
    </div>
  )
}

/* ------------------------- main drawer ------------------------- */
export default function DetailDrawer({ ctx, drawer, hitCompartmentIds }) {
  const {
    data, session, userId, isAdmin, myTeamIds, canEditContainer, teamName, profileName,
    refresh, openRoom, openContainer, openItem, openInventory, closeDrawer, selectCompartment,
  } = ctx

  const [tab, setTab] = useState('items')
  const [modal, setModal] = useState(null) // {type, item}
  const [invDraft, setInvDraft] = useState({})
  const [sop, setSop] = useState({ setup_sop: '', takedown_sop: '' })
  const [history, setHistory] = useState([])
  const [photoBusy, setPhotoBusy] = useState(false)
  const [invNotes, setInvNotes] = useState('')
  const [histOpen, setHistOpen] = useState(false)
  const [invHistory, setInvHistory] = useState([])

  const rooms = data.rooms
  const room = rooms.find((r) => r.id === drawer.roomId)
  const container = data.containers.find((c) => c.id === drawer.containerId)
  const item = data.items.find((i) => i.id === drawer.itemId)
  const containersOfRoom = data.containers.filter((c) => c.room_id === drawer.roomId)
  const compartments = compartmentsOf(data, drawer.containerId)
  const compById = Object.fromEntries(compartments.map((c) => [c.id, c]))
  const compRank = Object.fromEntries(compartments.map((c, i) => [c.id, i]))
  // Vehicle units list items in walk-around order (by compartment), others by name.
  const itemsOfContainer = data.items
    .filter((i) => i.container_id === drawer.containerId)
    .sort((a, b) => (compRank[a.compartment_id] ?? 1e9) - (compRank[b.compartment_id] ?? 1e9))
  const selectedComp = compById[drawer.compartmentId] || null
  const unitDocs = (data.unitDocs || []).filter((d) => d.container_id === drawer.containerId)
  const remindersOf = (cid) => (data.reminders || []).filter((r) => r.container_id === cid)
  const unitReminders = remindersOf(drawer.containerId)
  const canEdit = canEditContainer(container)

  useEffect(() => { setTab(drawer.tab || 'items') }, [drawer.containerId, drawer.tab])
  useEffect(() => {
    if (drawer.mode === 'inventory') {
      const d = {}
      itemsOfContainer.forEach((i) => { d[i.id] = i.qty })
      setInvDraft(d)
      setInvNotes('')
    }
    setHistOpen(false)
    setInvHistory([])
    if (container) setSop({ setup_sop: container.setup_sop || '', takedown_sop: container.takedown_sop || '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.mode, drawer.containerId])

  async function loadInvHistory() {
    if (!container) return
    const r = await api.getInventoryHistory(container.id)
    setInvHistory(r.data || [])
    setHistOpen(true)
  }

  // Must stay above the early return below: hooks can't be skipped between renders.
  useEffect(() => {
    if (drawer.mode === 'item' && drawer.itemId) {
      api.getCheckoutHistory(drawer.itemId).then((r) => setHistory(r.data || []))
    } else {
      setHistory([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer.mode, drawer.itemId, data.checkouts])

  if (!drawer.open) {
    return (
      <div id="drawer">
        <div id="drawerInner"><div id="drawerPlaceholder">Select a room on the floorplan, or search for an item, to see what’s inside.</div></div>
      </div>
    )
  }

  const err = (r) => { if (r && r.error) alert(r.error.message) }
  const done = async (r) => { err(r); await refresh() }

  async function handlePhoto(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setPhotoBusy(true)
    const { error } = await api.uploadItemPhoto(file, item.id, userId)
    setPhotoBusy(false)
    if (error) alert(error.message)
    else await refresh()
  }

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
              <p className="sectionLabel">{containersOfRoom.every((c) => c.is_vehicle_unit) ? 'Tap a unit for its gear and setup / takedown' : 'Tap a shelf to see what’s inside'}</p>
              {containersOfRoom.map((c) => {
                const its = data.items.filter((i) => i.container_id === c.id)
                const n = its.length
                const tn = teamName(c.team_id)
                return (
                  <div key={c.id} className="containerRow" onClick={() => openContainer(c.room_id, c.id)}>
                    <div>
                      <div className="crName">{c.name} {tn && <span className="teamBadge">{tn}</span>}</div>
                      <div className="crCount">{n === 1 ? '1 item' : n + ' items'} · {c.last_checked_at ? 'checked ' + fmtDate(c.last_checked_at) : 'never checked'}</div>
                      <UnitFlags items={its} reminders={remindersOf(c.id)} style={{ marginTop: 6 }} />
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
          <UnitFlags items={itemsOfContainer} reminders={unitReminders} style={{ marginBottom: 12 }} />

          <button className="btn sm" style={{ marginBottom: 14 }} onClick={() => setModal({ type: 'qr' })}><QrCode size={13} /> QR tag</button>

          <div style={{ marginBottom: 14 }}>
            <button className="btn sm ghost" onClick={() => (histOpen ? setHistOpen(false) : loadInvHistory())}><History size={13} /> {histOpen ? 'Hide check history' : 'View check history'}</button>
            {histOpen && (
              invHistory.length === 0 ? (
                <div className="hint" style={{ marginTop: 8 }}>No inventory checks recorded yet.</div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  {invHistory.map((h) => (
                    <div key={h.id} className="histCard">
                      <div className="histHead">{fmtDateTime(h.checked_at)} · {h.checked_by ? profileName(h.checked_by) : 'unknown'}</div>
                      {h.notes && <div className="histNotes">“{h.notes}”</div>}
                      {(h.inventory_check_line_items || []).length === 0 ? (
                        <div className="hint">No quantity changes this pass.</div>
                      ) : (h.inventory_check_line_items || []).map((li) => {
                        const it = data.items.find((x) => x.id === li.item_id)
                        return <div key={li.id} className="histRow"><span>{it?.name || 'item'}</span><span className="hstatus">{li.qty_before} → {li.qty_after}</span></div>
                      })}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {container?.is_vehicle_unit && (
            <div className="tabs">
              <button className={'tab' + (tab === 'items' ? ' active' : '')} onClick={() => setTab('items')}>Gear</button>
              <button className={'tab' + (tab === 'sop' ? ' active' : '')} onClick={() => setTab('sop')}>SOPs{unitDocs.length ? ` (${unitDocs.length})` : ''}</button>
              <button className={'tab' + (tab === 'service' ? ' active' : '')} onClick={() => setTab('service')}>Service{unitReminders.length ? ` (${unitReminders.length})` : ''}</button>
            </div>
          )}

          {container?.is_vehicle_unit && tab === 'sop' ? renderSOP() : container?.is_vehicle_unit && tab === 'service' ? renderService() : renderItemsList()}
        </div>
      </>
    )
  }

  function renderItemRow(it) {
    const badge = replacementBadge(it.needs_replacement_by)
    const co = data.checkouts.find((x) => x.item_id === it.id)
    return (
      <div key={it.id} className="item" onClick={() => openItem(drawer.roomId, drawer.containerId, it.id)}>
        <div className="itop">
          <span className="iname">{it.name}{badge && <span className={'badge ' + badge.kind} style={{ marginLeft: 8 }}>{badge.label}</span>}{lowStock(it) && <span className="badge low" style={{ marginLeft: 8 }}>Low stock</span>}</span>
          <span className="iqty">×{it.qty}</span>
        </div>
        <div className="iloc">{it.loc_detail || (compartments.length ? '' : 'No location detail')}</div>
        {it.status && <span className="istatus">{it.status}</span>}
        {co && <span className="badge soon" style={{ marginLeft: 8 }}>Out: {co.checked_out_by}</span>}
      </div>
    )
  }

  // Vehicle with compartments: chips to pick one, items grouped by compartment.
  function renderCompartmentItems() {
    const groups = [...compartments.map((c) => ({ comp: c, items: itemsOfContainer.filter((i) => i.compartment_id === c.id) })),
      { comp: null, items: itemsOfContainer.filter((i) => !compById[i.compartment_id]) }]
    const shown = selectedComp ? groups.filter((g) => g.comp?.id === selectedComp.id) : groups.filter((g) => g.comp || g.items.length)
    return (
      <>
        {/* Phones have no room for the main-area diagram, so show a portrait one here. */}
        <VehicleDiagram layout="tall" className="phoneOnly" compartments={compartments} items={itemsOfContainer}
          selectedId={drawer.compartmentId} hitIds={hitCompartmentIds} onSelect={selectCompartment} />
        <div className="chipRow">
          <button className={'chip' + (!selectedComp ? ' active' : '')} onClick={() => selectCompartment(null)}>Whole unit</button>
          {compartments.map((c) => (
            <button key={c.id} className={'chip' + (selectedComp?.id === c.id ? ' active' : '')} onClick={() => selectCompartment(c.id)}>{c.name}</button>
          ))}
        </div>
        {shown.map(({ comp, items }) => (
          <div key={comp ? comp.id : 'none'}>
            <div className="compHead"><span>{comp ? compartmentLabel(comp) : 'Not assigned to a compartment'}</span><span>{items.length}</span></div>
            {items.length === 0 ? <div className="hint" style={{ marginBottom: 8 }}>Empty.</div> : items.map(renderItemRow)}
          </div>
        ))}
      </>
    )
  }

  function renderItemsList() {
    return (
      <>
        {canEdit && itemsOfContainer.length > 0 && (
          <button className="btn accent block" style={{ marginBottom: 12 }} onClick={() => openInventory(drawer.roomId, drawer.containerId)}><ClipboardCheck size={15} /> Take Inventory</button>
        )}
        {container?.is_vehicle_unit && canEdit && (
          <button className="btn sm block" style={{ marginBottom: 12 }} onClick={() => setModal({ type: 'compartments' })}><Truck size={13} /> {compartments.length ? 'Manage compartments' : 'Set up compartments'}</button>
        )}
        {compartments.length > 0 ? renderCompartmentItems() : itemsOfContainer.length === 0 ? (
          <div className="emptyState"><div className="big">📦</div>Nothing logged yet in {container?.name}.</div>
        ) : (
          itemsOfContainer.map(renderItemRow)
        )}
        {canEdit && <button className="btn dashed block" style={{ marginTop: 6 }} onClick={() => setModal({ type: 'addItem' })}><Plus size={14} /> Add item{selectedComp ? ' to ' + selectedComp.name : ''}</button>}
      </>
    )
  }

  function pickDoc(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (file.type && file.type !== 'application/pdf') { alert('Please choose a PDF file.'); return }
    if (file.size > 25 * 1048576) { alert('That PDF is over 25 MB — please use a smaller file.'); return }
    const guess = /take\s*-?down/i.test(file.name) ? 'Takedown SOP' : /set\s*-?up/i.test(file.name) ? 'Setup SOP' : file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ')
    setModal({ type: 'doc', file, title: guess })
  }

  function renderSOP() {
    const hasNotes = !!(container?.setup_sop || container?.takedown_sop)
    return (
      <>
        <p className="sectionLabel">Documents</p>
        {unitDocs.length === 0 ? (
          <div className="hint" style={{ marginBottom: 10 }}>No SOP documents yet.{canEdit ? ' Upload the setup and takedown PDFs here.' : ''}</div>
        ) : unitDocs.map((d) => (
          <div key={d.id} className="listRow docRow">
            <a className="lr-main docLink" href={d.url} target="_blank" rel="noopener noreferrer">
              <div className="lr-title"><FileText size={15} color="var(--accent)" /> {d.title}</div>
              <div className="lr-sub">PDF · added {fmtDate(d.uploaded_at)}{d.uploaded_by ? ' by ' + profileName(d.uploaded_by) : ''}</div>
            </a>
            {canEdit && (
              <div className="rowActions" style={{ margin: 0 }}>
                <button className="btn sm ghost" title="Rename" onClick={() => setModal({ type: 'doc', doc: d, title: d.title })}><Pencil size={13} /></button>
                <button className="btn sm danger" title="Delete" onClick={async () => { if (confirm(`Delete “${d.title}”?`)) done(await api.deleteUnitDoc(d)) }}><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        ))}
        {canEdit && (
          <label className="btn dashed block" style={{ marginTop: 6, cursor: 'pointer' }}>
            <Upload size={14} /> Upload PDF
            <input type="file" accept="application/pdf,.pdf" style={{ display: 'none' }} onChange={pickDoc} />
          </label>
        )}

        {canEdit ? (
          <>
            <p className="sectionLabel" style={{ marginTop: 22 }}>Quick notes (optional)</p>
            <div className="field"><label>Setup</label>
              <textarea value={sop.setup_sop} onChange={(e) => setSop({ ...sop, setup_sop: e.target.value })} placeholder="Short reminders shown under the documents…" />
            </div>
            <div className="field"><label>Takedown</label>
              <textarea value={sop.takedown_sop} onChange={(e) => setSop({ ...sop, takedown_sop: e.target.value })} placeholder="Short reminders shown under the documents…" />
            </div>
            {container?.sop_updated_at && <div className="hint">Updated {fmtDateTime(container.sop_updated_at)}{container.sop_updated_by ? ' by ' + profileName(container.sop_updated_by) : ''}</div>}
            <button className="btn accent block" style={{ marginTop: 10 }} onClick={async () => done(await api.saveSOP(container.id, sop, userId))}><Save size={15} /> Save notes</button>
          </>
        ) : hasNotes && (
          <>
            <p className="sectionLabel" style={{ marginTop: 22 }}>Quick notes</p>
            {container?.setup_sop && <><div className="hint" style={{ margin: '0 0 4px' }}>Setup</div><div className="sopText" style={{ marginBottom: 12 }}>{container.setup_sop}</div></>}
            {container?.takedown_sop && <><div className="hint" style={{ margin: '0 0 4px' }}>Takedown</div><div className="sopText">{container.takedown_sop}</div></>}
          </>
        )}
      </>
    )
  }

  function renderService() {
    const list = [...unitReminders].sort((a, b) => a.due_date.localeCompare(b.due_date))
    return (
      <>
        <p className="hint" style={{ marginTop: 0 }}>Inspections and renewals for this unit (MVI, registration, insurance…). Anything overdue or due within 30 days shows on the Dashboard.</p>
        {list.length === 0 ? <div className="hint" style={{ marginBottom: 10 }}>No service dates yet.</div> : list.map((r) => {
          const badge = replacementBadge(r.due_date)
          return (
            <div key={r.id} className="listRow" style={{ cursor: 'default' }}>
              <div className="lr-main">
                <div className="lr-title">{r.title}{badge && <span className={'badge ' + badge.kind}>{badge.label}</span>}</div>
                <div className="lr-sub">
                  due {fmtDate(r.due_date)}{r.repeat_months ? ` · every ${r.repeat_months === 12 ? 'year' : r.repeat_months + ' months'}` : ''}
                  {r.last_done_at ? ` · last done ${fmtDate(r.last_done_at)}` : ''}{r.note ? ` · ${r.note}` : ''}
                </div>
              </div>
              {canEdit && (
                <div className="rowActions" style={{ margin: 0 }}>
                  {r.repeat_months && <button className="btn sm" title="Mark done and roll to the next due date" onClick={async () => done(await api.markReminderDone(r, userId))}><CalendarCheck size={13} /> Done</button>}
                  <button className="btn sm ghost" title="Edit" onClick={() => setModal({ type: 'reminder', reminder: r })}><Pencil size={13} /></button>
                  <button className="btn sm danger" title="Delete" onClick={async () => { if (confirm(`Delete “${r.title}”?`)) done(await api.deleteReminder(r.id)) }}><Trash2 size={13} /></button>
                </div>
              )}
            </div>
          )
        })}
        {canEdit && <button className="btn dashed block" style={{ marginTop: 6 }} onClick={() => setModal({ type: 'reminder' })}><Plus size={14} /> Add service date</button>}
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
          <div className="eyebrow">{container?.is_vehicle_unit ? container?.name : room?.name + ' → ' + container?.name}{compById[item.compartment_id] ? ' → ' + compById[item.compartment_id].name : ''}</div>
          <h3>{item.name}</h3>
        </div>
        <div id="drawerBody">
          {item.photo_url && <img className="itemPhoto" src={item.photo_url} alt={item.name} />}
          {canEdit && (
            <label className="btn sm block" style={{ marginBottom: 12, cursor: 'pointer' }}>
              <Camera size={13} /> {photoBusy ? 'Uploading…' : (item.photo_url ? 'Replace photo' : 'Add photo')}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} disabled={photoBusy} />
            </label>
          )}
          <div className="kv"><span className="k">Quantity</span><span className="v" style={{ color: lowStock(item) ? 'var(--overdue)' : 'var(--ok)' }}>×{item.qty} {lowStock(item) && <span className="badge low">Low stock</span>}</span></div>
          {item.min_qty > 0 && <div className="kv"><span className="k">Low-stock min</span><span className="v">{item.min_qty}</span></div>}
          {compById[item.compartment_id] && <div className="kv"><span className="k">Compartment</span><span className="v">{compartmentLabel(compById[item.compartment_id])}</span></div>}
          <div className="kv"><span className="k">Location</span><span className="v">{item.loc_detail || '—'}</span></div>
          <div className="kv"><span className="k">Status</span><span className="v">{item.status || '—'}</span></div>

          <p className="sectionLabel" style={{ marginTop: 20 }}>Expiry / service</p>
          {item.needs_replacement_by ? (
            <div className="kv"><span className="k">Expires / due</span><span className="v">{fmtDate(item.needs_replacement_by)} {badge && <span className={'badge ' + badge.kind}>{badge.label}</span>}</span></div>
          ) : <div className="hint">No expiry or service date set.</div>}
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

          <p className="sectionLabel" style={{ marginTop: 20 }}><History size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Sign-out history</p>
          {history.length === 0 ? (
            <div className="hint">No sign-out records yet.</div>
          ) : history.map((h) => (
            <div key={h.id} className="histRow">
              <span>{h.checked_out_by} · {fmtDate(h.checked_out_at)}</span>
              <span className="hstatus" style={{ color: h.checked_in_at ? 'var(--ok)' : 'var(--soon)' }}>{h.checked_in_at ? 'returned ' + fmtDate(h.checked_in_at) : 'still out'}</span>
            </div>
          ))}

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
              <div className="iloc">{[compById[it.compartment_id]?.name, it.loc_detail].filter(Boolean).join(' · ') || '—'}</div>
              <div className="field" style={{ margin: '8px 0 0' }}>
                <input type="number" disabled={!canEdit} value={invDraft[it.id] ?? it.qty}
                  onChange={(e) => setInvDraft({ ...invDraft, [it.id]: e.target.value })} />
              </div>
            </div>
          ))}
          {canEdit && itemsOfContainer.length > 0 && (
            <>
              <div className="field" style={{ marginTop: 14 }}>
                <label>Notes (optional)</label>
                <textarea value={invNotes} onChange={(e) => setInvNotes(e.target.value)} placeholder="e.g. found 2 short on gauze, reordered" style={{ minHeight: 70 }} />
              </div>
              <button className="btn accent block" style={{ marginTop: 6 }} onClick={async () => {
                const changes = itemsOfContainer
                  .filter((it) => String(invDraft[it.id]) !== String(it.qty))
                  .map((it) => ({ id: it.id, before: it.qty, after: parseInt(invDraft[it.id], 10) || 0 }))
                done(await api.saveInventory(container.id, changes, userId, invNotes))
                openContainer(drawer.roomId, drawer.containerId)
              }}><Save size={15} /> Save inventory check</button>
            </>
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
          <ItemForm compartments={compartments} defaultCompartmentId={drawer.compartmentId} onCancel={() => setModal(null)} onSave={async (p) => { const r = await api.saveItem({ ...p, container_id: drawer.containerId }, userId); if (!r.error) { setModal(null); await refresh() } return r }} />
        </ModalWrap>
      )}

      {modal?.type === 'editItem' && (
        <ModalWrap title="Edit item" onClose={() => setModal(null)}>
          <ItemForm initial={modal.item} compartments={compartments} onCancel={() => setModal(null)} onSave={async (p) => { const r = await api.saveItem({ ...p, id: modal.item.id }, userId); if (!r.error) { setModal(null); await refresh() } return r }} />
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
      {modal?.type === 'reminder' && container && (
        <ModalWrap title={modal.reminder ? 'Edit service date' : 'Add service date — ' + container.name} onClose={() => setModal(null)}>
          <ReminderForm initial={modal.reminder} onCancel={() => setModal(null)} onSave={async (p) => {
            const r = await api.saveReminder(modal.reminder ? { ...p, id: modal.reminder.id } : { ...p, container_id: container.id }, userId)
            if (!r.error) { setModal(null); await refresh() }
            return r
          }} />
        </ModalWrap>
      )}
      {modal?.type === 'doc' && container && (
        <ModalWrap title={modal.doc ? 'Rename document' : 'Upload SOP document'} onClose={() => setModal(null)}>
          <DocForm file={modal.file} initialTitle={modal.title} onCancel={() => setModal(null)} onSave={async (title) => {
            const r = modal.doc
              ? await api.renameUnitDoc(modal.doc.id, title)
              : await api.uploadUnitDoc(modal.file, container.id, title, unitDocs.length + 1, userId)
            if (!r.error) { setModal(null); await refresh() }
            return r
          }} />
        </ModalWrap>
      )}
      {modal?.type === 'compartments' && container && (
        <ModalWrap title={'Compartments — ' + container.name} onClose={() => setModal(null)}>
          <CompartmentEditor container={container} compartments={compartments} items={itemsOfContainer} onChange={refresh} />
        </ModalWrap>
      )}
      {modal?.type === 'qr' && container && (
        <QRModal container={container} roomName={room?.name} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
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
