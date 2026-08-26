import { supabase } from './supabase'

// ---- Load everything the SPA needs in one round-trip ----
export async function loadAll() {
  const [teams, rooms, containers, items, units, unitMembers, checkouts, userTeams, profiles] =
    await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('rooms').select('*').order('sort_order'),
      supabase.from('containers').select('*').order('sort_order'),
      supabase.from('items').select('*').order('name'),
      supabase.from('units').select('*').order('sort_order'),
      supabase.from('unit_members').select('*').order('sort_order'),
      supabase.from('item_checkouts').select('*').is('checked_in_at', null),
      supabase.from('user_teams').select('*'),
      supabase.from('profiles').select('id, display_name, is_admin'),
    ])

  const firstErr = [teams, rooms, containers, items].find((r) => r.error)
  if (firstErr && firstErr.error) throw firstErr.error

  return {
    teams: teams.data || [],
    rooms: rooms.data || [],
    containers: containers.data || [],
    items: items.data || [],
    units: units.data || [],
    unitMembers: unitMembers.data || [],
    checkouts: checkouts.data || [],
    userTeams: userTeams.data || [],
    profiles: profiles.data || [],
  }
}

// ---- Items ----
export async function saveItem(payload, userId) {
  const row = { ...payload, updated_by: userId || null }
  if (row.id) {
    const { id, ...rest } = row
    return supabase.from('items').update(rest).eq('id', id)
  }
  return supabase.from('items').insert(row)
}

export async function deleteItem(id) {
  return supabase.from('items').delete().eq('id', id)
}

export async function saveInventory(containerId, updates, userId) {
  for (const u of updates) {
    const { error } = await supabase
      .from('items')
      .update({ qty: u.qty, updated_by: userId || null })
      .eq('id', u.id)
    if (error) return { error }
  }
  return supabase
    .from('containers')
    .update({ last_checked_at: new Date().toISOString(), last_checked_by: userId || null })
    .eq('id', containerId)
}

// ---- Containers ----
export async function addContainer(payload) {
  return supabase.from('containers').insert(payload)
}
export async function updateContainer(id, patch) {
  return supabase.from('containers').update(patch).eq('id', id)
}
export async function deleteContainer(id) {
  return supabase.from('containers').delete().eq('id', id)
}
export async function saveSOP(id, patch, userId) {
  return supabase
    .from('containers')
    .update({ ...patch, sop_updated_at: new Date().toISOString(), sop_updated_by: userId || null })
    .eq('id', id)
}

// ---- Checkouts ----
export async function checkoutItem(itemId, payload) {
  return supabase.from('item_checkouts').insert({ item_id: itemId, ...payload })
}
export async function checkinItem(checkoutId) {
  return supabase
    .from('item_checkouts')
    .update({ checked_in_at: new Date().toISOString() })
    .eq('id', checkoutId)
}
export async function getCheckoutHistory(itemId) {
  return supabase.from('item_checkouts').select('*').eq('item_id', itemId).order('checked_out_at', { ascending: false })
}

// ---- Item photo (Supabase Storage: bucket 'item-photos') ----
export async function uploadItemPhoto(file, itemId, userId) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${itemId}/${Date.now()}-${safe}`
  const up = await supabase.storage.from('item-photos').upload(path, file, { upsert: true, contentType: file.type })
  if (up.error) return { error: up.error }
  const { data } = supabase.storage.from('item-photos').getPublicUrl(path)
  const url = data.publicUrl
  const res = await supabase.from('items').update({ photo_url: url, updated_by: userId || null }).eq('id', itemId)
  return { error: res.error, url }
}

// ---- Rooms (admin) ----
export async function addRoom(payload) { return supabase.from('rooms').insert(payload) }
export async function updateRoom(id, patch) { return supabase.from('rooms').update(patch).eq('id', id) }
export async function deleteRoom(id) { return supabase.from('rooms').delete().eq('id', id) }

// ---- Teams (admin) ----
export async function addTeam(name) { return supabase.from('teams').insert({ name }) }
export async function updateTeam(id, name) { return supabase.from('teams').update({ name }).eq('id', id) }
export async function deleteTeam(id) { return supabase.from('teams').delete().eq('id', id) }

// ---- Memberships (admin) ----
export async function setUserTeams(userId, teamIds) {
  const del = await supabase.from('user_teams').delete().eq('user_id', userId)
  if (del.error) return del
  if (!teamIds.length) return { error: null }
  return supabase.from('user_teams').insert(teamIds.map((team_id) => ({ user_id: userId, team_id })))
}

// ---- Units + members (admin) ----
export async function addUnit(name, sortOrder) { return supabase.from('units').insert({ name, sort_order: sortOrder }) }
export async function deleteUnit(id) { return supabase.from('units').delete().eq('id', id) }
export async function addUnitMember(payload) { return supabase.from('unit_members').insert(payload) }
export async function deleteUnitMember(id) { return supabase.from('unit_members').delete().eq('id', id) }
export async function updateUnitMemberRole(id, role) { return supabase.from('unit_members').update({ role }).eq('id', id) }
