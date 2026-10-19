// Inventory search: every word typed must match the item's name or type.
// Forgiving on purpose: plurals ("extinguishers") and small typos
// ("extinuisher") still match, by stem and by a shared 5-letter prefix.

const words = (s) => (s || '').toLowerCase().split(/[^a-z0-9₂]+/).filter(Boolean)
const stem = (w) => (w.length > 4 ? w.replace(/(es|s)$/, '') : w)

function tokenMatches(token, hayText, hayWords) {
  const t = stem(token)
  if (hayText.includes(t)) return true
  return t.length >= 6 && hayWords.some((w) => w.startsWith(t.slice(0, 5)))
}

export function itemMatches(item, query) {
  const tokens = words(query)
  if (!tokens.length) return false
  const hayText = `${item.name} ${item.item_type || ''}`.toLowerCase()
  const hayWords = words(hayText)
  return tokens.every((t) => tokenMatches(t, hayText, hayWords))
}
