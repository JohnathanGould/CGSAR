import React from 'react'
import { Truck, ChevronRight, AlertTriangle, PackageX } from 'lucide-react'
import { replacementBadge, lowStock } from '../lib/helpers'

export default function Callout({ ctx }) {
  const { data, teamName, openContainer } = ctx
  const roomById = Object.fromEntries(data.rooms.map((r) => [r.id, r]))
  const vehicles = data.containers.filter((c) => c.is_vehicle_unit).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  return (
    <div>
      <div className="pageHead">
        <h2>Callout — Pre-departure</h2>
        <p>Every vehicle &amp; trailer unit at a glance: setup/takedown SOPs and gear that needs attention before you roll.</p>
      </div>

      {vehicles.length === 0 ? (
        <div className="emptyState">No vehicle units configured yet.</div>
      ) : vehicles.map((c) => {
        const items = data.items.filter((i) => i.container_id === c.id)
        const lowCount = items.filter(lowStock).length
        const replCount = items.filter((i) => replacementBadge(i.needs_replacement_by)).length
        const r = roomById[c.room_id]
        return (
          <div key={c.id} className="card" style={{ marginBottom: 16 }}>
            <h3>
              <Truck size={16} color="var(--accent)" /> {c.name}
              {teamName(c.team_id) && <span className="teamBadge" style={{ marginLeft: 8 }}>{teamName(c.team_id)}</span>}
              <span className="count">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
            </h3>

            {(lowCount > 0 || replCount > 0) && (
              <div className="rowActions" style={{ marginTop: 0, marginBottom: 12 }}>
                {replCount > 0 && <span className="badge overdue"><AlertTriangle size={11} /> {replCount} to replace</span>}
                {lowCount > 0 && <span className="badge low"><PackageX size={11} /> {lowCount} low stock</span>}
              </div>
            )}

            <div className="grid2" style={{ gap: 14 }}>
              <div>
                <p className="sectionLabel">Setup procedure</p>
                <div className="sopText">{c.setup_sop || 'No setup procedure logged yet.'}</div>
              </div>
              <div>
                <p className="sectionLabel">Takedown procedure</p>
                <div className="sopText">{c.takedown_sop || 'No takedown procedure logged yet.'}</div>
              </div>
            </div>

            <button className="btn sm" style={{ marginTop: 12 }} onClick={() => openContainer(c.room_id, c.id)}>
              Open unit ({r?.name}) <ChevronRight size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
