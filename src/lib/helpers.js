// Compute replacement badge client-side from needs_replacement_by (never stored).
export function replacementBadge(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  const diffDays = Math.floor((d.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return { label: 'Overdue', kind: 'overdue' }
  if (diffDays <= 30) return { label: 'Replace soon', kind: 'soon' }
  return null
}

// A container is "stale" if never checked or last checked > 30 days ago.
export function isStale(container) {
  if (!container || !container.last_checked_at) return true
  const d = new Date(container.last_checked_at)
  return Date.now() - d.getTime() > 30 * 86400000
}

// Low-stock: a positive threshold that current qty has dropped to or below.
export function lowStock(item) {
  return !!item && item.min_qty > 0 && item.qty <= item.min_qty
}

export function fmtDate(d) {
  if (!d) return null
  try { return new Date(d).toLocaleDateString('en-CA') } catch { return String(d) }
}

export function fmtDateTime(d) {
  if (!d) return null
  try {
    return new Date(d).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
  } catch { return String(d) }
}
