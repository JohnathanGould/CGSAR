import React from 'react'

export default function Modal({ title, sub, onClose, children, wide }) {
  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 620 } : undefined} onClick={(e) => e.stopPropagation()}>
        <button className="modalClose" onClick={onClose} aria-label="Close">✕</button>
        <h3>{title}</h3>
        {sub && <div className="msub">{sub}</div>}
        {children}
      </div>
    </div>
  )
}
