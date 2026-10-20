import { motion } from 'framer-motion'
import { CheckCircle2, Download, Gavel, HardHat, Loader2, Rocket, X } from 'lucide-react'
import { useState } from 'react'
import { useBuild } from '../buildStore'
import { api } from '../lib/api'
import { tr, useT } from '../lib/i18n'
import AppRunner from './AppRunner'
import { toast } from './Toast'
import { ReadinessBadge } from './VersionsPanel'
import CouncilLaunch from './CouncilLaunch'
import FdeModal from './FdeModal'

/** "Correr la app": the real product running in a modal over the builder, with the next steps underneath
 *  (download, council verification, and — once approved — ship to production). */
export default function RunModal({ onClose, onDownload }: { onClose: () => void; onDownload: () => void }) {
  const T = useT()
  const b = useBuild()
  const [busy, setBusy] = useState(false)
  const [launch, setLaunch] = useState(false)
  const [fde, setFde] = useState(false)
  const approved = b.status === 'approved'
  const busyBuild = b.status === 'running' || b.status === 'reviewing' || b.status === 'connecting'
  const canCouncil = b.team.length >= 2 && !busyBuild
  const rounds = b.reviews.length

  const council = async (priorities = '', rounds = 3) => {
    if (!b.id) return
    setBusy(true)
    try {
      const r = await api.buildCouncil(b.id, b.sessionId, rounds, priorities)
      useBuild.getState().set({ councilSession: r.session_id })
      onClose()
    } catch (e) {
      toast.error(tr('No se pudo convocar al consejo', 'Could not convene the council'), (e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const ship = () => {
    useBuild.getState().set({ paneOpen: true, pane: 'deploy' })
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[120] bg-paper/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} className="panel rounded-3xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 h-14 border-b border-line shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.3em] text-accent">{T('App real', 'Real app')}</div>
            <div className="serif text-lg leading-tight truncate">{b.title}</div>
          </div>
          {b.versions.length > 0 && <ReadinessBadge versions={b.versions} />}
          {approved ? (
            <span className="flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok/10 px-2.5 py-1 text-[11px] font-bold text-ok"><span className="h-2 w-2 rounded-full bg-ok" /> {T('APROBADA POR EL CONSEJO', 'APPROVED BY THE COUNCIL')}</span>
          ) : rounds > 0 ? (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-bold text-gold">{rounds} {rounds === 1 ? T('ronda', 'round') : T('rondas', 'rounds')} {T('de revisión · sin aprobar', 'of review · not approved')}</span>
          ) : (
            <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-ink-3">{T('SIN REVISAR', 'NOT REVIEWED')}</span>
          )}
          <button onClick={onClose} className="ml-auto rounded-full p-1.5 text-ink-3 transition hover:bg-surface-2 hover:text-ink" aria-label={T('Cerrar', 'Close')}><X size={18} strokeWidth={2.5} /></button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <AppRunner autoStart />
        </div>

        {/* next steps */}
        <div className="border-t border-line bg-surface px-5 py-3 shrink-0">
          <div className="text-[10px] uppercase tracking-[0.3em] text-ink-3 mb-2">{T('¿Y ahora?', 'What next?')}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button onClick={onDownload} className="rounded-2xl border border-line bg-paper px-4 py-3 text-left hover:bg-surface-2">
              <div className="flex items-center gap-2 font-semibold text-[13.5px]"><Download size={15} className="text-accent" /> {T('Descargar el proyecto', 'Download the project')}</div>
              <div className="mt-0.5 text-[12px] text-ink-3">{T('.zip con todo el código, el BRIEF y el README.', '.zip with all the code, the BRIEF and the README.')}</div>
            </button>
            <button disabled={!canCouncil || busy || approved} onClick={() => setLaunch(true)} className="rounded-2xl border border-line bg-paper px-4 py-3 text-left hover:bg-surface-2 disabled:opacity-50">
              <div className="flex items-center gap-2 font-semibold text-[13.5px]">{busy ? <Loader2 size={15} className="animate-spin" /> : approved ? <CheckCircle2 size={15} className="text-ok" /> : <Gavel size={15} className="text-accent" />} {approved ? T('Verificada por el consejo', 'Verified by the council') : T('Verificar con el consejo', 'Verify with the council')}</div>
              <div className="mt-0.5 text-[12px] text-ink-3">{approved ? T('Todos los roles dieron el visto bueno.', 'Every role gave the go-ahead.') : b.team.length < 2 ? T('Hacen falta al menos 2 roles con API key.', 'At least 2 roles with an API key are needed.') : T('El equipo la revisa en la arena y te da la lista de cambios.', 'The team reviews it in the arena and gives you the list of changes.')}</div>
            </button>
            <button onClick={ship} className={`rounded-2xl px-4 py-3 text-left ${approved ? 'border-2 border-ok bg-ok/10 hover:brightness-95' : 'border border-line bg-paper hover:bg-surface-2'}`}>
              <div className="flex items-center gap-2 font-semibold text-[13.5px]"><Rocket size={15} className={approved ? 'text-ok' : 'text-accent'} /> {T('Mandar a producción', 'Ship to production')}</div>
              <div className="mt-0.5 text-[12px] text-ink-3">{approved ? T('Lista para salir: Vercel o Railway con un click.', 'Ready to go: Vercel or Railway in one click.') : T('Vercel o Railway. Recomendado después de que el consejo apruebe.', 'Vercel or Railway. Recommended after the council approves.')}</div>
            </button>
            <button onClick={() => setFde(true)} className="rounded-2xl border border-gold/50 bg-gold/5 px-4 py-3 text-left hover:bg-gold/10">
              <div className="flex items-center gap-2 font-semibold text-[13.5px]"><HardHat size={15} className="text-gold" /> {T('Pedir un developer', 'Request a developer')}</div>
              <div className="mt-0.5 text-[12px] text-ink-3">{T('Un ingeniero nuestro la sube a producción o conecta tus servicios. Precio fijo, 48 h.', 'One of our engineers ships it to production or wires up your services. Fixed price, 48 h.')}</div>
            </button>
          </div>
        </div>
      </motion.div>
      {launch && <CouncilLaunch team={b.team} onLaunch={(p, r) => council(p, r)} onClose={() => setLaunch(false)} />}
      {fde && <FdeModal onClose={() => setFde(false)} />}
    </motion.div>
  )
}
