import { supabase } from './supabase'

// ---- Load everything the SPA needs in one round-trip ----
export async function loadAll() {
  const [teams, rooms, containers, items, orgPositions, orgMembers, checkouts, userTeams, profiles] =
    await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('rooms').select('*').order('sort_order'),
      supabase.from('containers').select('*').order('sort_order'),
      supabase.from('items').select('*').order('name'),
      supabase.from('org_positions').select('*').order('sort_order'),
      supabase.from('org_position_members').select('*').order('sort_order'),
      supabase.from('item_checkouts').select('*').is('checked_in_at', null),
      supabase.from('user_teams').select('*'),
      supabase.from('profiles').select('id, first_name, last_name, is_admin, is_approved, created_at'),
    ])

  const firstErr = [teams, rooms, containers, items].find((r) => r.error)
  if (firstErr && firstErr.error) throw firstErr.error

  return {
    teams: teams.data || [],
    rooms: rooms.data || [],
    containers: containers.data || [],
    items: items.data || [],
    orgPositions: orgPositions.data || [],
    orgMembers: orgMembers.data || [],
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

// Save a full inventory-check pass: updates changed qtys, writes an append-only
// inventory_checks row + a line item per changed qty, and stamps the container.
// `changes` = [{ id, before, after }] for items whose qty actually changed.
export async function saveInventory(containerId, changes, userId, notes) {
  for (const c of changes) {
    const { error } = await supabase
      .from('items')
      .update({ qty: c.after, updated_by: userId || null })
      .eq('id', c.id)
    if (error) return { error }
  }

  const check = await supabase
    .from('inventory_checks')
    .insert({ container_id: containerId, checked_by: userId || null, notes: notes || null })
    .select('id')
    .single()
  if (check.error) return { error: check.error }

  if (changes.length) {
    const lines = changes.map((c) => ({
      inventory_check_id: check.data.id, item_id: c.id, qty_before: c.before, qty_after: c.after,
    }))
    const li = await supabase.from('inventory_check_line_items').insert(lines)
    if (li.error) return { error: li.error }
  }

  return supabase
    .from('containers')
    .update({ last_checked_at: new Date().toISOString(), last_checked_by: userId || null })
    .eq('id', containerId)
}

export async function getInventoryHistory(containerId) {
  return supabase
    .from('inventory_checks')
    .select('*, inventory_check_line_items(*)')
    .eq('container_id', containerId)
    .order('checked_at', { ascending: false })
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

// Approve a pending member and assign their team(s) in one step.
export async function approveMember(userId, teamIds) {
  const up = await supabase.from('profiles').update({ is_approved: true }).eq('id', userId)
  if (up.error) return up
  return setUserTeams(userId, teamIds)
}

// ---- Org chart (admin) ----
export async function addPosition(payload) { return supabase.from('org_positions').insert(payload) }
export async function updatePosition(id, patch) { return supabase.from('org_positions').update(patch).eq('id', id) }
export async function deletePosition(id) { return supabase.from('org_positions').delete().eq('id', id) }
export async function addPositionMember(payload) { return supabase.from('org_position_members').insert(payload) }
export async function deletePositionMember(id) { return supabase.from('org_position_members').delete().eq('id', id) }
export async function updatePositionMemberRole(id, role) { return supabase.from('org_position_members').update({ role }).eq('id', id) }
