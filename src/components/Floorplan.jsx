import React from 'react'

const ZONES = [
  { x: 390, y: 445, w: 470, h: 60, label: 'Parking' },
  { x: 40, y: 570, w: 920, h: 40, label: 'Parking' },
]

function topoPaths() {
  const paths = []
  for (let i = 0; i < 9; i++) {
    const yBase = 40 + i * 70
    const amp = 14 + (i % 3) * 6
    let d = `M -20 ${yBase}`
    for (let x = 0; x <= 1020; x += 60) {
      const y = yBase + Math.sin(x / 140 + i) * amp
      d += ` L ${x} ${y.toFixed(1)}`
    }
    paths.push(d)
  }
  return paths
}

export default function Floorplan({ rooms, activeRoomId, hitRoomIds, onRoomClick }) {
  const hits = hitRoomIds || new Set()
  return (
    <div id="floorwrap">
      <svg id="plan" viewBox="0 0 1000 650">
        <rect x={40} y={60} width={920} height={500} className="outerWall" rx={4} />
        {ZONES.map((z, i) => (
          <g key={'z' + i}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="#050505" stroke="#2a2a2a" strokeWidth={1} />
            <text x={z.x + z.w / 2} y={z.y + z.h / 2 + 4} className="zoneLabel" textAnchor="middle">{z.label}</text>
          </g>
        ))}
        <text x={790} y={530} className="zoneLabel">Outdoor Classroom →</text>

        {rooms.map((r) => {
          const cls =
            'room' + (r.id === activeRoomId ? ' active' : '') + (hits.has(r.id) ? ' has-hit' : '')
          const cx = r.floor_x + r.floor_w / 2
          const cy = r.floor_y + r.floor_h / 2
          const showSub = r.floor_w >= 200 && r.kind
          return (
            <g key={r.id} style={{ cursor: 'pointer' }} onClick={() => onRoomClick(r)}>
              <rect
                x={r.floor_x}
                y={r.floor_y}
                width={r.floor_w}
                height={r.floor_h}
                rx={6}
                className={cls}
              />
              <text x={cx} y={showSub ? cy : cy + 4} className="roomLabel">{r.name}</text>
              {showSub && <text x={cx} y={cy + 18} className="roomSub">{r.kind}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export { topoPaths }
