import React, { useState } from 'react'
import { AlertTriangle, Clock, ChevronRight, CheckCircle2, Plus, Pencil, Trash2, CalendarCheck, Package, Truck, Megaphone } from 'lucide-react'
import { dueBadge, daysUntil, fmtDate } from '../lib/helpers'
import * as api from '../lib/data'
import Modal from './Modal'
import ReminderForm from './ReminderForm'

// "In 12 days" / "Today" / "3 days ago"
function relative(dateStr) {
  const d = daysUntil(dateStr)
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d === -1) return 'yesterday'
  return d > 0 ? `in ${d} days` : `${-d} days ago`
}

export default function Dashboard({ ctx }) {
  const { data, isAdmin, userId, refresh, openItem, openContainer, canEditContainer } = ctx
  const [modal, setModal] = useState(null)
  const roomById = Object.fromEntries(data.rooms.map((r) => [r.id, r]))
  const containerById = Object.fromEntries(data.containers.map((c) => [c.id, c]))
  const compById = Object.fromEntries((data.compartments || []).map((c) => [c.id, c]))
  const reminders = data.reminders || []
  const canEditReminder = (r) => (r.container_id ? canEditContainer(containerById[r.container_id]) : isAdmin)
  const done = async (r) => { if (r && r.error) alert(r.error.message); await refresh() }

  // Everything with a date that is overdue or due within 30 days.
  const entries = [
    ...data.items.filter((it) => dueBadge(it.needs_replacement_by)).map((it) => {
      const c = containerById[it.container_id]
      const r = c && roomById[c.room_id]
      const comp = compById[it.compartment_id]
      return {
        key: 'i' + it.id, icon: Package, title: it.name, date: it.needs_replacement_by, note: it.needs_replacement_note,
        where: [c?.is_vehicle_unit ? null : r?.name, c?.name, comp?.name].filter(Boolean).join(' › '),
        open: () => openItem(c?.room_id, it.container_id, it.id),
      }
    }),
    ...reminders.filter((rm) => dueBadge(rm.due_date)).map((rm) => {
      const c = containerById[rm.container_id]
      return {
        key: 'r' + rm.id, icon: c ? Truck : Megaphone, title: rm.title, date: rm.due_date, note: rm.note,
        where: c ? c.name : 'General',
        open: c ? () => openContainer(c.room_id, c.id, null, 'service') : (isAdmin ? () => setModal({ type: 'edit', reminder: rm }) : null),
        reminder: rm,
      }
    }),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const overdue = entries.filter((e) => daysUntil(e.date) < 0)
  const soon = entries.filter((e) => daysUntil(e.date) >= 0)
  const units = data.containers.filter((c) => c.is_vehicle_unit).sort((a, b) => a.name.localeCompare(b.name))
  const general = reminders.filter((r) => !r.container_id)

  const Row = ({ e }) => {
    const Icon = e.icon
    const badge = dueBadge(e.date)
    const rm = e.reminder
    return (
      <div className={'listRow dueRow ' + badge.kind} onClick={e.open || undefined} style={e.open ? undefined : { cursor: 'default' }}>
        <div className="lr-main">
          <div className="lr-title"><Icon size={14} color="var(--muted)" /> {e.title}</div>
          <div className="lr-sub">{e.where} · {badge.kind === 'overdue' ? 'was due' : 'due'} {fmtDate(e.date)} ({relative(e.date)}){e.note ? ` · ${e.note}` : ''}</div>
        </div>
        {rm && rm.repeat_months && canEditReminder(rm) ? (
          <button className="btn sm" title="Mark done and roll to the next due date" onClick={async (ev) => { ev.stopPropagation(); await done(await api.markReminderDone(rm, userId)) }}><CalendarCheck size={13} /> Done</button>
        ) : e.open && <ChevronRight className="lr-arrow" size={16} />}
      </div>
    )
  }

  return (
    <div>
      <div className="pageHead">
        <h2>Dashboard</h2>
        <p>Anything expired or coming due in the next 30 days — medications, equipment service, vehicle inspections and renewals.</p>
      </div>

      <div className="dueTiles">
        <div className={'dueTile' + (overdue.length ? ' overdue' : '')}><AlertTriangle size={18} /><b>{overdue.length}</b><span>Overdue / expired</span></div>
        <div className={'dueTile' + (soon.length ? ' soon' : '')}><Clock size={18} /><b>{soon.length}</b><span>Due within 30 days</span></div>
      </div>

      {entries.length === 0 ? (
        <div className="card allClear"><CheckCircle2 size={22} color="var(--ok)" /> Nothing is overdue or due in the next 30 days.</div>
      ) : (
        <div className="card">
          {overdue.length > 0 && <><p className="sectionLabel" style={{ color: 'var(--overdue)' }}>Overdue / expired</p>{overdue.map((e) => <Row key={e.key} e={e} />)}</>}
          {soon.length > 0 && <><p className="sectionLabel" style={{ color: 'var(--soon)', marginTop: overdue.length ? 16 : 0 }}>Due within 30 days</p>{soon.map((e) => <Row key={e.key} e={e} />)}</>}
        </div>
      )}

      {isAdmin && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>General reminders <span className="count">{general.length}</span></h3>
          <p className="hint" style={{ marginTop: 0 }}>Association-wide dates not tied to a vehicle (e.g. insurance renewal). Vehicle dates like MVI live on each vehicle’s Service tab.</p>
          {general.map((r) => (
            <div key={r.id} className="listRow" style={{ cursor: 'default' }}>
              <div className="lr-main">
                <div className="lr-title">{r.title}</div>
                <div className="lr-sub">due {fmtDate(r.due_date)}{r.repeat_months ? ` · repeats every ${r.repeat_months === 12 ? 'year' : r.repeat_months + ' months'}` : ''}{r.note ? ` · ${r.note}` : ''}</div>
              </div>
              <div className="rowActions" style={{ margin: 0 }}>
                <button className="btn sm ghost" title="Edit" onClick={() => setModal({ type: 'edit', reminder: r })}><Pencil size={13} /></button>
                <button className="btn sm danger" title="Delete" onClick={async () => { if (confirm(`Delete “${r.title}”?`)) await done(await api.deleteReminder(r.id)) }}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          <button className="btn dashed block" style={{ marginTop: 6 }} onClick={() => setModal({ type: 'add' })}><Plus size={14} /> Add reminder</button>
        </div>
      )}

      {modal && (
        <Modal title={modal.type === 'add' ? 'Add reminder' : 'Edit reminder'} onClose={() => setModal(null)}>
          <ReminderForm initial={modal.reminder} units={units} onCancel={() => setModal(null)} onSave={async (p) => {
            const r = await api.saveReminder(modal.reminder ? { ...p, id: modal.reminder.id } : p, userId)
            if (!r.error) { setModal(null); await refresh() }
            return r
          }} />
        </Modal>
      )}
    </div>
  )
}
