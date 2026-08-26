import React from 'react'
import { AlertTriangle, ClipboardList, ChevronRight, PackageX } from 'lucide-react'
import { replacementBadge, isStale, lowStock, fmtDate } from '../lib/helpers'

export default function Dashboard({ ctx }) {
  const { data, openItem, openInventory, profileName } = ctx
  const roomById = Object.fromEntries(data.rooms.map((r) => [r.id, r]))
  const containerById = Object.fromEntries(data.containers.map((c) => [c.id, c]))

  const replacement = data.items
    .map((it) => ({ it, badge: replacementBadge(it.needs_replacement_by) }))
    .filter((x) => x.badge)
    .sort((a, b) => (a.badge.kind === 'overdue' ? -1 : 1) - (b.badge.kind === 'overdue' ? -1 : 1))

  const low = data.items.filter(lowStock)
  const stale = data.containers.filter(isStale)

  return (
    <div>
      <div className="pageHead">
        <h2>Base Dashboard</h2>
        <p>What needs attention across the whole base. Jump straight to any item or shelf.</p>
      </div>

      <div className="grid2">
        <div className="card">
          <h3><AlertTriangle size={16} color="var(--accent)" /> Needs replacement <span className="count">{replacement.length}</span></h3>
          {replacement.length === 0 ? (
            <div className="emptyState" style={{ padding: '24px 6px' }}>Nothing due for replacement.</div>
          ) : (
            replacement.map(({ it, badge }) => {
              const c = containerById[it.container_id]
              const r = c && roomById[c.room_id]
              return (
                <div key={it.id} className="listRow" onClick={() => openItem(c?.room_id, it.container_id, it.id)}>
                  <div className="lr-main">
                    <div className="lr-title">{it.name} <span className={'badge ' + badge.kind}>{badge.label}</span></div>
                    <div className="lr-sub">{r?.name} → {c?.name} · by {fmtDate(it.needs_replacement_by)}{it.needs_replacement_note ? ` · ${it.needs_replacement_note}` : ''}</div>
                  </div>
                  <ChevronRight className="lr-arrow" size={16} />
                </div>
              )
            })
          )}
        </div>

        <div className="card">
          <h3><ClipboardList size={16} color="var(--accent)" /> Not recently checked <span className="count">{stale.length}</span></h3>
          {stale.length === 0 ? (
            <div className="emptyState" style={{ padding: '24px 6px' }}>Every shelf has been checked within 30 days.</div>
          ) : (
            stale.map((c) => {
              const r = roomById[c.room_id]
              const when = c.last_checked_at
                ? `Last checked ${fmtDate(c.last_checked_at)}${c.last_checked_by ? ' by ' + profileName(c.last_checked_by) : ''}`
                : 'Never checked'
              return (
                <div key={c.id} className="listRow" onClick={() => openInventory(c.room_id, c.id)}>
                  <div className="lr-main">
                    <div className="lr-title">{c.name}</div>
                    <div className="lr-sub">{r?.name} · {when}</div>
                  </div>
                  <ChevronRight className="lr-arrow" size={16} />
                </div>
              )
            })
          )}
        </div>

        <div className="card">
          <h3><PackageX size={16} color="var(--accent)" /> Low stock <span className="count">{low.length}</span></h3>
          {low.length === 0 ? (
            <div className="emptyState" style={{ padding: '24px 6px' }}>Nothing below its minimum.</div>
          ) : (
            low.map((it) => {
              const c = containerById[it.container_id]
              const r = c && roomById[c.room_id]
              return (
                <div key={it.id} className="listRow" onClick={() => openItem(c?.room_id, it.container_id, it.id)}>
                  <div className="lr-main">
                    <div className="lr-title">{it.name} <span className="badge low">×{it.qty} / min {it.min_qty}</span></div>
                    <div className="lr-sub">{r?.name} → {c?.name}</div>
                  </div>
                  <ChevronRight className="lr-arrow" size={16} />
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
