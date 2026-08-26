import QRCode from 'qrcode'
import { containerUrl } from '../components/QRModal'

// ---- CSV export of the whole base inventory ----
function csvCell(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function exportInventoryCsv(data) {
  const roomById = Object.fromEntries(data.rooms.map((r) => [r.id, r]))
  const containerById = Object.fromEntries(data.containers.map((c) => [c.id, c]))
  const teamById = Object.fromEntries(data.teams.map((t) => [t.id, t]))
  const header = ['Room', 'Container', 'Team', 'Item', 'Qty', 'MinQty', 'Location', 'Status', 'ReplaceBy', 'ReplaceNote', 'LastCheckedAt']
  const rows = [header]
  data.items.forEach((it) => {
    const c = containerById[it.container_id]
    const r = c && roomById[c.room_id]
    rows.push([
      r?.name, c?.name, c && teamById[c.team_id]?.name, it.name, it.qty, it.min_qty,
      it.loc_detail, it.status, it.needs_replacement_by, it.needs_replacement_note, c?.last_checked_at,
    ])
  })
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `gsar-inventory-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ---- Print a sheet of QR tags for every container ----
export async function printAllQrTags(data) {
  const roomById = Object.fromEntries(data.rooms.map((r) => [r.id, r]))
  const tags = await Promise.all(
    data.containers.map(async (c) => ({
      name: c.name,
      room: roomById[c.room_id]?.name || '',
      img: await QRCode.toDataURL(containerUrl(c.id), { width: 240, margin: 1 }),
    }))
  )
  const w = window.open('', '_blank')
  if (!w) return
  const cards = tags.map((t) => `<div class="tag"><div class="eyebrow">Colchester GSAR</div><div class="name">${t.name}</div><div class="room">${t.room}</div><img src="${t.img}"/></div>`).join('')
  w.document.write(`<!doctype html><html><head><title>GSAR QR tags</title><style>
    body{font-family:-apple-system,Arial,sans-serif;color:#0a0a0a;margin:0;padding:16px;}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
    .tag{border:1px solid #ccc;border-radius:10px;padding:12px;text-align:center;page-break-inside:avoid;}
    .eyebrow{color:#e8590c;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:9px;}
    .name{font-weight:800;font-size:14px;margin-top:2px;}.room{color:#666;font-size:11px;margin-bottom:8px;}
    img{width:150px;height:150px;}
  </style></head><body><div class="grid">${cards}</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script></body></html>`)
  w.document.close()
}
