// Detects a newer deploy by comparing the bundle this page loaded with the one
// the live index.html references. In-app browsers (Messenger etc.) and
// home-screen apps can hold on to an old copy for a long time otherwise.

function loadedBundle() {
  const s = document.querySelector('script[type="module"][src*="assets/index-"]')
  return s ? new URL(s.src, window.location.href).pathname : null
}

// Returns the newer bundle's path, or null if this page is current (or on the
// dev server, or offline).
export async function newerBundle() {
  const mine = loadedBundle()
  if (!mine) return null
  try {
    const base = window.location.pathname.replace(/[^/]*$/, '')
    const res = await fetch(base + 'index.html?v=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    const m = (await res.text()).match(/assets\/index-[\w-]+\.js/)
    return m && !mine.endsWith(m[0]) ? m[0] : null
  } catch {
    return null
  }
}

// Reload onto the new version. The cache-busting query makes webviews fetch a
// fresh index.html; the sessionStorage guard stops a reload loop if they don't.
export function reloadToNewVersion(target, { force = false } = {}) {
  let tried = null
  try { tried = sessionStorage.getItem('gsar-update-tried') } catch { /* storage blocked */ }
  if (!force && tried === target) return false
  try { sessionStorage.setItem('gsar-update-tried', target) } catch { /* storage blocked */ }
  const params = new URLSearchParams(window.location.search)
  params.set('v', Date.now().toString(36))
  window.location.replace(window.location.pathname + '?' + params + window.location.hash)
  return true
}
