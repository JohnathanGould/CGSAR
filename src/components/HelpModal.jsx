import React from 'react'
import Modal from './Modal'

const SECTIONS = [
  ['Finding equipment', 'Click a room on the floorplan, tap a container/shelf/unit to see what\u2019s inside, or use the search box to jump straight to an item.'],
  ['Taking inventory', 'Open a container you have edit access to, use \u201cTake Inventory,\u201d adjust quantities, and save \u2014 this logs who did it and when. You can review past checks under \u201cView check history.\u201d'],
  ['Signing gear out', 'On any item, use \u201cCheck out\u201d to record who has it and when it\u2019s due back; use \u201cCheck in\u201d when it\u2019s returned.'],
  ['Vehicles & trailers', 'Open any unit in Vehicle Bays to see it at a glance: red/amber flags for gear overdue for replacement or low on stock, its gear by compartment, and an SOPs tab with its setup/takedown PDF documents (tap one to open it). The unit\u2019s team can upload, rename or remove documents. The Vehicle Bays list shows each unit\u2019s flags too.'],
  ['Org chart', 'See the association\u2019s executive positions (who fills each one, or vacant) and its units (lead and members). Tap any one for details.'],
  ['Logging in', 'Sign up with your name, email, and password. An admin approves new accounts before you get full access.'],
  ['If you\u2019re on a team', 'You can edit items and take inventory for your team\u2019s shelves/units. Everything else stays read-only to you.'],
]

const ADMIN_SECTION = ['Admin functions', 'As an admin you can approve pending members, manage rooms/teams/containers, reassign container ownership, and edit the org chart (add positions and assign who fills them).']

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
