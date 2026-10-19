import React from 'react'

// Top-down schematic of a vehicle unit. Each compartment is a clickable slot;
// slots holding search hits are highlighted. Two layouts:
//  - 'wide' (desktop main area): front to the right, so the driver side is the
//    top edge and the passenger/curb side the bottom edge.
//  - 'tall' (phone drawer): front pointing up, driver side down the left,
//    passenger side down the right, rear doors at the bottom.

const GAP = 8

const WIDE_BODY = { x: 220, y: 200, w: 520, h: 200 }
const WIDE_CAB = { x: 750, y: 220, w: 150, h: 160 }
const TALL_BODY = { x: 170, y: 190, w: 260, h: 540 }
const TALL_CAB = { x: 190, y: 40, w: 220, h: 140 }

const LAYOUTS = {
  wide: {
    viewBox: '40 44 940 516',
    body: WIDE_BODY,
    // Cab rounded on its front (right) edge.
    cabPath: (c) => `M ${c.x} ${c.y} H ${c.x + c.w - 30} Q ${c.x + c.w} ${c.y} ${c.x + c.w} ${c.y + 30}
      V ${c.y + c.h - 30} Q ${c.x + c.w} ${c.y + c.h} ${c.x + c.w - 30} ${c.y + c.h} H ${c.x} Z`,
    cab: WIDE_CAB,
    // Side doors are ordered front -> back, i.e. right -> left.
    areas: {
      driver: { x: WIDE_BODY.x, y: 80, w: WIDE_BODY.w, h: 96, axis: 'x', reverse: true },
      passenger: { x: WIDE_BODY.x, y: 424, w: WIDE_BODY.w, h: 96, axis: 'x', reverse: true },
      rear: { x: 60, y: WIDE_BODY.y, w: 148, h: WIDE_BODY.h, axis: 'y' },
      interior: { x: WIDE_BODY.x + 12, y: WIDE_BODY.y + 12, w: WIDE_BODY.w - 24, h: 118, axis: 'x', reverse: true },
      roof: { x: WIDE_BODY.x + 12, y: WIDE_BODY.y + 140, w: WIDE_BODY.w - 24, h: 48, axis: 'x', reverse: true },
      cab: { x: WIDE_CAB.x + 10, y: WIDE_CAB.y + 12, w: WIDE_CAB.w - 30, h: WIDE_CAB.h - 24, axis: 'y' },
    },
    labels: [
      { x: WIDE_BODY.x, y: 66, text: 'Driver side' },
      { x: WIDE_BODY.x, y: 548, text: 'Passenger side · curb' },
      { x: 134, y: 186, text: 'Rear', anchor: 'middle' },
      { x: 950, y: 304, text: 'Front ›', anchor: 'middle' },
    ],
    wheels: [
      ...[300, 640].flatMap((x) => [WIDE_BODY.y - 14, WIDE_BODY.y + WIDE_BODY.h].map((y) => ({ x, y, w: 56, h: 14 }))),
      ...[WIDE_CAB.y - 14, WIDE_CAB.y + WIDE_CAB.h].map((y) => ({ x: 805, y, w: 52, h: 14 })),
    ],
  },
  tall: {
    viewBox: '0 0 600 880',
    body: TALL_BODY,
    // Cab rounded on its front (top) edge.
    cabPath: (c) => `M ${c.x} ${c.y + c.h} V ${c.y + 30} Q ${c.x} ${c.y} ${c.x + 30} ${c.y}
      H ${c.x + c.w - 30} Q ${c.x + c.w} ${c.y} ${c.x + c.w} ${c.y + 30} V ${c.y + c.h} Z`,
    cab: TALL_CAB,
    // Side doors are ordered front -> back, i.e. top -> bottom.
    areas: {
      driver: { x: 20, y: TALL_BODY.y, w: 140, h: TALL_BODY.h, axis: 'y' },
      passenger: { x: 440, y: TALL_BODY.y, w: 140, h: TALL_BODY.h, axis: 'y' },
      rear: { x: TALL_BODY.x, y: 744, w: TALL_BODY.w, h: 96, axis: 'x' },
      interior: { x: TALL_BODY.x + 12, y: TALL_BODY.y + 12, w: TALL_BODY.w - 24, h: 420, axis: 'y' },
      roof: { x: TALL_BODY.x + 12, y: TALL_BODY.y + 442, w: TALL_BODY.w - 24, h: 86, axis: 'y' },
      cab: { x: TALL_CAB.x + 12, y: TALL_CAB.y + 22, w: TALL_CAB.w - 24, h: TALL_CAB.h - 34, axis: 'x' },
    },
    labels: [
      { x: 90, y: 176, text: 'Driver', anchor: 'middle' },
      { x: 510, y: 176, text: 'Passenger', anchor: 'middle' },
      { x: 300, y: 26, text: 'Front ▲', anchor: 'middle' },
      { x: 300, y: 868, text: 'Rear', anchor: 'middle' },
    ],
    wheels: [
      ...[260, 620].flatMap((y) => [TALL_BODY.x - 14, TALL_BODY.x + TALL_BODY.w].map((x) => ({ x, y, w: 14, h: 56 }))),
      ...[TALL_CAB.x - 14, TALL_CAB.x + TALL_CAB.w].map((x) => ({ x, y: 96, w: 14, h: 52 })),
    ],
  },
}

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

export default function VehicleDiagram({ unitName, compartments, items, selectedId, hitIds, onSelect, layout = 'wide', className = '' }) {
  const L = LAYOUTS[layout]
  const hits = hitIds || new Set()
  const count = (id) => items.filter((i) => i.compartment_id === id).length
  const unassigned = items.filter((i) => !i.compartment_id || !compartments.some((c) => c.id === i.compartment_id)).length

  const bySide = (side) => compartments.filter((c) => c.side === side)

  function renderSide(side, emptyText) {
    const list = bySide(side)
    const area = L.areas[side]
    if (!list.length) {
      if (!emptyText) return null
      return (
        <g key={side}>
          <rect x={area.x} y={area.y} width={area.w} height={area.h} rx={6} className="compEmpty" />
          <foreignObject x={area.x} y={area.y} width={area.w} height={area.h} style={{ pointerEvents: 'none' }}>
            <div className="compLabel"><span className="compEmptyText">{emptyText}</span></div>
          </foreignObject>
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
    <div className={'vehiclewrap ' + layout + (className ? ' ' + className : '')}>
      <svg className="vehicle" viewBox={L.viewBox}>
        {L.labels.map((l) => <text key={l.text} x={l.x} y={l.y} className="zoneLabel" textAnchor={l.anchor}>{l.text}</text>)}

        {L.wheels.map((w) => <rect key={w.x + ':' + w.y} x={w.x} y={w.y} width={w.w} height={w.h} rx={3} className="wheel" />)}

        {/* body + cab outline */}
        <rect x={L.body.x} y={L.body.y} width={L.body.w} height={L.body.h} rx={6} className="vehBody" />
        <path d={L.cabPath(L.cab)} className="vehBody" />

        {renderSide('driver', layout === 'tall' ? 'No driver-side doors yet' : 'No driver-side compartments yet')}
        {renderSide('passenger', layout === 'tall' ? 'No passenger-side doors yet' : 'No passenger-side compartments yet')}
        {renderSide('rear', 'Rear')}
        {renderSide('interior', bySide('roof').length ? null : 'Interior')}
        {renderSide('roof')}
        {renderSide('cab', 'Cab')}
      </svg>
      <div className="vehicleFoot">
        {layout === 'wide' && <><b>{unitName}</b> · </>}tap a compartment to see what’s in it
        {unassigned > 0 && <> · <span style={{ color: 'var(--soon)' }}>{unassigned} item{unassigned === 1 ? '' : 's'} not yet assigned to a compartment</span></>}
      </div>
    </div>
  )
}
