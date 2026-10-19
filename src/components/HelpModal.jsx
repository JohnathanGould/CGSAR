import React from 'react'
import Modal from './Modal'

const SECTIONS = [
  ['Dashboard', 'Shows only what has expired or is coming due in the next 30 days: item expiry / service dates (medications, extinguishers, batteries\u2026) and vehicle service dates like MVI or registration. Tap an entry to jump to it.'],
  ['Inventory', 'Tap a room on the floorplan, then a shelf or unit to see what\u2019s inside \u2014 or use the search box to jump straight to an item. The Inventory tab also lists low-stock items and anything not checked in 30 days.'],
  ['Taking inventory', 'Open a container you have edit access to, use \u201cTake Inventory,\u201d adjust quantities, and save \u2014 this logs who did it and when. You can review past checks under \u201cView check history.\u201d'],
  ['Signing gear out', 'On any item, use \u201cCheck out\u201d to record who has it and when it\u2019s due back; use \u201cCheck in\u201d when it\u2019s returned.'],
  ['Vehicles & trailers', 'Open any unit in Vehicle Bays to see it at a glance: red/amber flags, its gear by compartment, an SOPs tab with its setup/takedown PDFs, and a Service tab for MVI, registration and other dates (repeating dates have a \u201cDone\u201d button that rolls them to the next due date).'],
  ['Org chart', 'See the association\u2019s executive positions (who fills each one, or vacant) and its units (lead and members). Tap any one for details.'],
  ['Logging in', 'Sign up with your name, email, and password. An admin approves new accounts before you get full access.'],
  ['If you\u2019re on a team', 'You can edit items and take inventory for your team\u2019s shelves/units. Everything else stays read-only to you.'],
]

const ADMIN_SECTION = ['Admin functions', 'As an admin you can approve pending members, manage rooms/teams/containers, reassign container ownership, edit the org chart (add positions and assign who fills them), and add general reminders on the Dashboard.']

export default function HelpModal({ isAdmin, onClose }) {
  const sections = isAdmin ? [...SECTIONS, ADMIN_SECTION] : SECTIONS
  return (
    <Modal title="How this app works" sub="A quick tour of the base inventory tool — skim it once, reference it anytime." onClose={onClose} wide>
      <div className="helpBody">
        {sections.map(([h, body]) => (
          <div className="helpSection" key={h}>
            <h4>{h}</h4>
            <p>{body}</p>
          </div>
        ))}
      </div>
      <div className="formActions">
        <button className="btn accent" onClick={onClose}>Got it</button>
      </div>
    </Modal>
  )
}
