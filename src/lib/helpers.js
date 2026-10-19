// Days from today until a YYYY-MM-DD date (negative = past).
export function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((new Date(dateStr + 'T00:00:00').getTime() - today.getTime()) / 86400000)
}

// Badge for an expiry / service-due date: overdue, or due within 30 days.
export function dueBadge(dateStr) {
  if (!dateStr) return null
  const days = daysUntil(dateStr)
  if (days < 0) return { label: 'Overdue', kind: 'overdue' }
  if (days <= 30) return { label: 'Due soon', kind: 'soon' }
  return null
}
// Items keep their date in needs_replacement_by ("Expires / service due").
export const replacementBadge = dueBadge

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
