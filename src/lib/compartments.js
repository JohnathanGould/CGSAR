// Vehicle compartments: which face of the unit a compartment opens from.
// Order here is the walk-around order used for lists and inventory passes.
export const SIDES = [
  { id: 'passenger', label: 'Passenger side', short: 'Passenger' },
  { id: 'rear', label: 'Rear', short: 'Rear' },
  { id: 'driver', label: 'Driver side', short: 'Driver' },
  { id: 'interior', label: 'Interior', short: 'Interior' },
  { id: 'roof', label: 'Roof', short: 'Roof' },
  { id: 'cab', label: 'Cab', short: 'Cab' },
]

export const sideLabel = (id) => SIDES.find((s) => s.id === id)?.label || id
const sideRank = (id) => { const i = SIDES.findIndex((s) => s.id === id); return i < 0 ? SIDES.length : i }

export function compartmentsOf(data, containerId) {
  return (data.compartments || [])
    .filter((c) => c.container_id === containerId)
    .sort((a, b) => sideRank(a.side) - sideRank(b.side) || a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

// "Passenger side · Front upper compartment"
export function compartmentLabel(comp) {
  return comp ? `${sideLabel(comp.side)} · ${comp.name}` : ''
}
