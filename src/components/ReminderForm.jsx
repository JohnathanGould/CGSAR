import React, { useState } from 'react'

// Add / edit a due date (MVI, registration, renewals). `units` is passed only
// where the reminder's owner can be chosen (the Dashboard); otherwise the
// caller fixes container_id.
export default function ReminderForm({ initial, units, defaultUnitId, onCancel, onSave }) {
  const [f, setF] = useState({
    title: initial?.title || '',
    due_date: initial?.due_date || '',
    repeat: initial?.repeat_months ? String(initial.repeat_months) : '',
    note: initial?.note || '',
    container_id: initial ? (initial.container_id || '') : (defaultUnitId || ''),
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit() {
    if (!f.title.trim()) { setErr('What is due? e.g. MVI'); return }
    if (!f.due_date) { setErr('Pick the due date'); return }
    setBusy(true)
    const payload = {
      title: f.title.trim(), due_date: f.due_date, note: f.note.trim() || null,
      repeat_months: f.repeat ? parseInt(f.repeat, 10) : null,
    }
    if (units) payload.container_id = f.container_id || null
    const r = await onSave(payload)
    setBusy(false)
    if (r && r.error) setErr(r.error.message)
  }

  return (
    <div>
      <div className="field">
        <label>What’s due</label>
        <input value={f.title} onChange={up('title')} list="reminderTitles" placeholder="e.g. MVI" autoFocus />
        <datalist id="reminderTitles">
          <option value="MVI" /><option value="Registration renewal" /><option value="Insurance renewal" />
          <option value="Oil change / service" /><option value="Fire extinguisher service" />
        </datalist>
      </div>
      {units && (
        <div className="field">
          <label>For</label>
          <select value={f.container_id} onChange={up('container_id')}>
            <option value="">General (association-wide)</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}
      <div className="formRow">
        <div className="field"><label>Due date</label><input type="date" value={f.due_date} onChange={up('due_date')} /></div>
        <div className="field">
          <label>Repeats</label>
          <select value={f.repeat} onChange={up('repeat')}>
            <option value="">Does not repeat</option>
            <option value="1">Every month</option>
            <option value="3">Every 3 months</option>
            <option value="6">Every 6 months</option>
            <option value="12">Every year</option>
            <option value="24">Every 2 years</option>
          </select>
        </div>
      </div>
      <div className="field"><label>Note (optional)</label><input value={f.note} onChange={up('note')} placeholder="e.g. Book at Truro Ford" /></div>
      {err && <div className="errText">{err}</div>}
      <div className="formActions">
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn accent" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}
