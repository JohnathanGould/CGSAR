import React from 'react'
import Modal from './Modal'

const SECTIONS = [
  ['Finding equipment', 'Click a room on the floorplan, tap a container/shelf/unit to see what\u2019s inside, or use the search box to jump straight to an item.'],
  ['Callout view', 'A fast, read-only pre-departure screen \u2014 one card per vehicle/trailer unit showing its team, item count, setup/takedown SOPs side-by-side, and red/amber flags for anything needing attention (items overdue for replacement or low on stock) before it rolls. No login needed to view it.'],
  ['Taking inventory', 'Open a container you have edit access to, use \u201cTake Inventory,\u201d adjust quantities, and save \u2014 this logs who did it and when. You can review past checks under \u201cView check history.\u201d'],
  ['Signing gear out', 'On any item, use \u201cCheck out\u201d to record who has it and when it\u2019s due back; use \u201cCheck in\u201d when it\u2019s returned.'],
  ['Vehicle SOPs', 'Vehicle/trailer units have an \u201cSOP\u201d tab for setup and takedown procedures \u2014 the same text shown on the Callout cards.'],
  ['Org chart', 'Browse the association\u2019s structure and rosters; tap any position to see who\u2019s in it.'],
  ['Logging in', 'Sign up with your name, email, and password. An admin approves new accounts before you get full access.'],
  ['If you\u2019re on a team', 'You can edit items and take inventory for your team\u2019s shelves/units. Everything else stays read-only to you.'],
]

const ADMIN_SECTION = ['Admin functions', 'As an admin you can approve pending members, manage rooms/teams/containers, reassign container ownership, and edit the org chart structure.']

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
