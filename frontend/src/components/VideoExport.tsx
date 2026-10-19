import { motion } from 'framer-motion'
import { Download, Monitor, Smartphone, X } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../lib/i18n'
import { recordingSupported } from '../lib/recorder'
import type { Layout } from '../store'

export interface VideoOptions {
  layout: Layout
  speed: number
  hold: number
  sound: boolean
}

export default function VideoExport({ onClose, onRecord }: { onClose: () => void; onRecord: (o: VideoOptions) => void }) {
  const T = useT()
  const [o, setO] = useState<VideoOptions>({ layout: 'vertical', speed: 1.5, hold: 6, sound: true })
  const supported = recordingSupported()
  const opt = (active: boolean) => `flex-1 rounded-xl border px-3 py-2.5 text-left text-sm transition ${active ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`

  return (
    <div className="fixed inset-0 z-[60] bg-paper/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel rounded-3xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start">
          <div>
            <div className="text-xs uppercase tracking-widest text-ink-3">{T('Exportar', 'Export')}</div>
            <h3 className="serif text-3xl mt-1">{T('Descargar video', 'Download video')}</h3>
          </div>
          <button className="ml-auto text-ink-3 hover:text-ink" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="mt-5 text-xs uppercase tracking-widest text-ink-3">{T('Formato', 'Format')}</div>
        <div className="mt-2 flex gap-2">
          <button className={opt(o.layout === 'vertical')} onClick={() => setO({ ...o, layout: 'vertical' })}>
            <Smartphone size={16} className="mb-1 text-accent" /> <b>{T('9:16 vertical', '9:16 vertical')}</b>
            <div className="text-xs text-ink-3">Reels · TikTok · Shorts</div>
          </button>
          <button className={opt(o.layout === 'wide')} onClick={() => setO({ ...o, layout: 'wide' })}>
            <Monitor size={16} className="mb-1 text-accent" /> <b>{T('16:9 horizontal', '16:9 landscape')}</b>
            <div className="text-xs text-ink-3">YouTube · X · LinkedIn</div>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-ink-3">{T('Velocidad', 'Speed')}</span>
            <select className="mt-1 w-full rounded-lg bg-surface border border-line px-3 py-2 text-sm" value={o.speed} onChange={(e) => setO({ ...o, speed: Number(e.target.value) })}>
              {[1, 1.5, 2, 3, 4].map((v) => <option key={v} value={v}>{v}× {v === 1 ? T('(tiempo real)', '(real time)') : ''}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-ink-3">{T('Final en pantalla', 'Ending on screen')}</span>
            <select className="mt-1 w-full rounded-lg bg-surface border border-line px-3 py-2 text-sm" value={o.hold} onChange={(e) => setO({ ...o, hold: Number(e.target.value) })}>
              {[3, 6, 10, 15].map((v) => <option key={v} value={v}>{v} {T('s de veredicto', 's of verdict')}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-accent w-4 h-4" checked={o.sound} onChange={(e) => setO({ ...o, sound: e.target.checked })} />
          {T('Incluir efectos de sonido', 'Include sound effects')}
        </label>

        <div className="mt-5 rounded-xl bg-surface-2 border border-line p-3 text-[12.5px] text-ink-2 leading-relaxed">
          {T('La sesión se reproduce desde el principio y se graba sola. Chrome te va a pedir permiso:', 'The session replays from the start and records itself. Chrome will ask for permission:')}
          {' '}{T('elegí', 'choose')} <b>{T('esta pestaña', 'this tab')}</b> {T('y', 'and')} <b>{T('Compartir', 'Share')}</b>. {T('No cambies de pestaña mientras graba.', 'Do not switch tabs while recording.')}
          {' '}{T('Al terminar el veredicto se descarga el archivo. Para cortar antes, tocá', 'When the verdict ends, the file downloads. To stop early, tap')} <b>{T('Dejar de compartir', 'Stop sharing')}</b> {T('y se descarga lo grabado.', 'and what was recorded downloads.')}
        </div>
        {!supported && <div className="mt-3 text-sm text-danger">{T('Este navegador no permite grabar la pestaña. Usá Chrome o Edge de escritorio.', 'This browser cannot record the tab. Use desktop Chrome or Edge.')}</div>}

        <button disabled={!supported} onClick={() => onRecord(o)} className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl bg-accent text-white px-6 py-3 font-semibold hover:brightness-110 transition disabled:opacity-40">
          <Download size={18} /> {T('Grabar y descargar', 'Record and download')}
        </button>
      </motion.div>
    </div>
  )
}
