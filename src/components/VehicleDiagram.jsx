import React from 'react'

// Top-down schematic of a vehicle unit, front to the right (so the driver side
// is the top edge and the passenger/curb side the bottom edge). Each
// compartment is a clickable slot; slots holding search hits are highlighted.

const BODY = { x: 220, y: 200, w: 520, h: 200 }
const CAB = { x: 750, y: 220, w: 150, h: 160 }

// Where each side's slots are laid out, and along which axis they split.
// Side doors are ordered front -> back, i.e. right -> left.
const AREAS = {
  driver: { x: BODY.x, y: 80, w: BODY.w, h: 96, axis: 'x', reverse: true },
  passenger: { x: BODY.x, y: 424, w: BODY.w, h: 96, axis: 'x', reverse: true },
  rear: { x: 60, y: BODY.y, w: 148, h: BODY.h, axis: 'y' },
  interior: { x: BODY.x + 12, y: BODY.y + 12, w: BODY.w - 24, h: 118, axis: 'x', reverse: true },
  roof: { x: BODY.x + 12, y: BODY.y + 140, w: BODY.w - 24, h: 48, axis: 'x', reverse: true },
  cab: { x: CAB.x + 10, y: CAB.y + 12, w: CAB.w - 30, h: CAB.h - 24, axis: 'y' },
}

const GAP = 8

function slots(area, n) {
  const out = []
  for (let i = 0; i < n; i++) {
    const k = area.reverse ? n - 1 - i : i
    if (area.axis === 'x') {
      const w = (area.w - GAP * (n - 1)) / n
      out.push({ x: area.x + k * (w + GAP), y: area.y, w, h: area.h })
    } else {
      const h = (area.h - GAP * (n - 1)) / n
      out.push({ x: area.x, y: area.y + k * (h + GAP), w: area.w, h })
    }
  }
  return out
}

export default function VehicleDiagram({ unitName, compartments, items, selectedId, hitIds, onSelect }) {
  const hits = hitIds || new Set()
  const count = (id) => items.filter((i) => i.compartment_id === id).length
  const unassigned = items.filter((i) => !i.compartment_id || !compartments.some((c) => c.id === i.compartment_id)).length

  const bySide = (side) => compartments.filter((c) => c.side === side)

  function renderSide(side, emptyText) {
    const list = bySide(side)
    const area = AREAS[side]
    if (!list.length) {
      if (!emptyText) return null
      return (
        <g key={side}>
          <rect x={area.x} y={area.y} width={area.w} height={area.h} rx={6} className="compEmpty" />
          <text x={area.x + area.w / 2} y={area.y + area.h / 2 + 4} className="compEmptyText">{emptyText}</text>
        </g>
      )
    }
    return slots(area, list.length).map((s, i) => {
      const c = list[i]
      const n = count(c.id)
      const cls = 'comp' + (c.id === selectedId ? ' active' : '') + (hits.has(c.id) ? ' has-hit' : '')
      return (
        <g key={c.id} className="compSlot" onClick={() => onSelect(c.id === selectedId ? null : c.id)}>
          <title>{c.name}</title>
          <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={6} className={cls} />
          <foreignObject x={s.x} y={s.y} width={s.w} height={s.h} style={{ pointerEvents: 'none' }}>
            <div className="compLabel">
              <span className="compName">{c.name}</span>
              <span className="compCount">{n === 1 ? '1 item' : n + ' items'}</span>
            </div>
          </foreignObject>
        </g>
      )
    })
  }

  return (
    <div id="vehiclewrap">
      <svg id="vehicle" viewBox="40 44 940 516">
        <text x={BODY.x} y={66} className="zoneLabel">Driver side</text>
        <text x={BODY.x} y={548} className="zoneLabel">Passenger side · curb</text>
        <text x={134} y={186} className="zoneLabel" textAnchor="middle">Rear</text>
        <text x={950} y={304} className="zoneLabel" textAnchor="middle">Front ›</text>

        {/* wheels */}
        {[300, 640].map((x) => [BODY.y - 14, BODY.y + BODY.h].map((y) => (
          <rect key={x + ':' + y} x={x} y={y} width={56} height={14} rx={3} className="wheel" />
        )))}
        {[805].map((x) => [CAB.y - 14, CAB.y + CAB.h].map((y) => (
          <rect key={x + ':' + y} x={x} y={y} width={52} height={14} rx={3} className="wheel" />
        )))}

        {/* body + cab outline */}
        <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx={6} className="vehBody" />
        <path d={`M ${CAB.x} ${CAB.y} H ${CAB.x + CAB.w - 30} Q ${CAB.x + CAB.w} ${CAB.y} ${CAB.x + CAB.w} ${CAB.y + 30}
                  V ${CAB.y + CAB.h - 30} Q ${CAB.x + CAB.w} ${CAB.y + CAB.h} ${CAB.x + CAB.w - 30} ${CAB.y + CAB.h} H ${CAB.x} Z`}
          className="vehBody" />

        {renderSide('driver', 'No driver-side compartments yet')}
        {renderSide('passenger', 'No passenger-side compartments yet')}
        {renderSide('rear', 'Rear')}
        {renderSide('interior', bySide('roof').length ? null : 'Interior')}
        {renderSide('roof')}
        {renderSide('cab', 'Cab')}
      </svg>
      <div className="vehicleFoot">
        <b>{unitName}</b> · tap a compartment to see what’s in it
        {unassigned > 0 && <> · <span style={{ color: 'var(--soon)' }}>{unassigned} item{unassigned === 1 ? '' : 's'} not yet assigned to a compartment</span></>}
      </div>
    </div>
  )
}
