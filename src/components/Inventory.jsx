import React from 'react'
import { ClipboardList, ChevronRight, PackageX } from 'lucide-react'
import { isStale, lowStock, fmtDate } from '../lib/helpers'
import Floorplan from './Floorplan'

// Inventory tab: the base floorplan plus what needs restocking or re-checking.
// (Expiry / service dates live on the Dashboard.)
export default function Inventory({ ctx, activeRoomId, hitRoomIds }) {
  const { data, openRoom, openItem, openInventory, profileName } = ctx
  const roomById = Object.fromEntries(data.rooms.map((r) => [r.id, r]))
  const containerById = Object.fromEntries(data.containers.map((c) => [c.id, c]))
  const low = data.items.filter(lowStock)
  const stale = data.containers.filter(isStale)

  return (
    <div>
      <div className="pageHead">
        <h2>Inventory</h2>
        <p>Tap a room to see its shelves and units, or search for an item in the sidebar.</p>
      </div>

      <Floorplan rooms={data.rooms} activeRoomId={activeRoomId} hitRoomIds={hitRoomIds} onRoomClick={(r) => openRoom(r.id)} />

      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <h3><PackageX size={16} color="var(--accent)" /> Low stock <span className="count">{low.length}</span></h3>
          {low.length === 0 ? (
            <div className="emptyState" style={{ padding: '24px 6px' }}>Nothing below its minimum.</div>
          ) : low.map((it) => {
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
          })}
        </div>

        <div className="card">
          <h3><ClipboardList size={16} color="var(--accent)" /> Not recently checked <span className="count">{stale.length}</span></h3>
          {stale.length === 0 ? (
            <div className="emptyState" style={{ padding: '24px 6px' }}>Every shelf and unit has been checked within 30 days.</div>
          ) : stale.map((c) => {
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
          })}
        </div>
      </div>
    </div>
  )
}
