import React from 'react'
import { ClipboardList, ChevronRight, PackageX, Search, X } from 'lucide-react'
import { isStale, lowStock, fmtDate, dueBadge } from '../lib/helpers'

// "RPAS Unit › Cab · top shelf" / "Medical Room › Shelf B · Bin 3"
function locationOf({ it, c, r, comp }) {
  const path = [c.is_vehicle_unit ? null : r.name, c.name, comp?.name].filter(Boolean).join(' › ')
  return it.loc_detail ? `${path} · ${it.loc_detail}` : path
}

function SearchResults({ results, query, openItem }) {
  if (query.trim().length < 2) return null
  if (!results.length) return <div className="card" style={{ marginBottom: 18 }}><div className="hint" style={{ margin: 0 }}>No items match “{query.trim()}”.</div></div>
  // Soonest next-service first; items without a date after, by name.
  const rows = [...results].sort((a, b) =>
    (a.it.needs_replacement_by || '9999').localeCompare(b.it.needs_replacement_by || '9999') || a.it.name.localeCompare(b.it.name))
  const total = rows.reduce((n, x) => n + (x.it.qty || 0), 0)
  const due = rows.filter((x) => dueBadge(x.it.needs_replacement_by)).length
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h3>{rows.length} {rows.length === 1 ? 'match' : 'matches'} <span className="count">{total} in total{due ? ` · ${due} overdue or due soon` : ''}</span></h3>
      <div className="resultTable">
        <div className="rtHead"><span>Item</span><span>Type</span><span>Qty</span><span>Location</span><span>Last service</span><span>Next service / expiry</span></div>
        {rows.map((x) => {
          const badge = dueBadge(x.it.needs_replacement_by)
          return (
            <div key={x.it.id} className={'rtRow' + (badge ? ' ' + badge.kind : '')} onClick={() => openItem(x.r.id, x.c.id, x.it.id)}>
              <span className="rtName">{x.it.name}</span>
              <span data-label="Type">{x.it.item_type || '—'}</span>
              <span data-label="Qty">×{x.it.qty}</span>
              <span data-label="Location">{locationOf(x)}</span>
              <span data-label="Last service">{x.it.last_serviced_at ? fmtDate(x.it.last_serviced_at) : '—'}</span>
              <span data-label="Next service">{x.it.needs_replacement_by ? fmtDate(x.it.needs_replacement_by) : '—'}{badge && <span className={'badge ' + badge.kind} style={{ marginLeft: 6 }}>{badge.label}</span>}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Inventory tab: search across every room, shelf and vehicle, and what needs
// restocking or re-checking. (The building map is the Base Floorplan tab;
// expiry / service alerts live on the Dashboard.)
export default function Inventory({ ctx, query, setQuery, results }) {
  const { data, openItem, openInventory, profileName } = ctx
  const roomById = Object.fromEntries(data.rooms.map((r) => [r.id, r]))
  const containerById = Object.fromEntries(data.containers.map((c) => [c.id, c]))
  const low = data.items.filter(lowStock)
  const stale = data.containers.filter(isStale)

  return (
    <div>
      <div className="pageHead">
        <h2>Inventory</h2>
        <p>Search every room, shelf and vehicle.</p>
      </div>

      <div className="invSearch">
        <Search size={18} />
        <input className="searchBox" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search inventory — e.g. fire extinguisher, splint, radio" autoComplete="off" />
        {query && <button className="invClear" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}
      </div>
      <SearchResults results={results} query={query} openItem={openItem} />

      <div className="grid2">
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
