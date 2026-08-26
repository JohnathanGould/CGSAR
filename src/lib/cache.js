const KEY = 'gsar_cache_v1'

export function saveCache(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data }))
  } catch (e) { /* ignore quota errors */ }
}

export function loadCache() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}
