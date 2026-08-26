import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import Modal from './Modal'

export function containerUrl(id) {
  const { origin, pathname } = window.location
  return `${origin}${pathname}?container=${id}`
}

export default function QRModal({ container, roomName, onClose }) {
  const [dataUrl, setDataUrl] = useState('')
  const url = containerUrl(container.id)

  useEffect(() => {
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: '#0a0a0a', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(() => setDataUrl(''))
  }, [url])

  function print() {
    const w = window.open('', '_blank', 'width=420,height=560')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>${container.name}</title>
      <style>body{font-family:-apple-system,Arial,sans-serif;text-align:center;padding:32px;color:#0a0a0a;}
      h2{margin:0 0 2px;font-size:20px;} .sub{color:#666;font-size:13px;margin-bottom:18px;}
      img{width:300px;height:300px;} .eyebrow{color:#e8590c;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:11px;}
      </style></head><body>
      <div class="eyebrow">Colchester GSAR</div>
      <h2>${container.name}</h2>
      <div class="sub">${roomName || ''}</div>
      <img src="${dataUrl}"/>
      <div class="sub" style="margin-top:16px;word-break:break-all;">${url}</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
      </body></html>`)
    w.document.close()
  }

  return (
    <Modal title="Shelf QR tag" sub="Scan to open this shelf on a phone during a callout." onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        {dataUrl ? <img src={dataUrl} alt="QR" style={{ width: 240, height: 240, background: '#fff', borderRadius: 10, padding: 8 }} /> : <div className="hint">Generating…</div>}
        <div className="hint" style={{ wordBreak: 'break-all', marginTop: 10 }}>{url}</div>
      </div>
      <div className="formActions">
        <button className="btn ghost" onClick={onClose}>Close</button>
        <button className="btn accent" onClick={print} disabled={!dataUrl}>Print tag</button>
      </div>
    </Modal>
  )
}
