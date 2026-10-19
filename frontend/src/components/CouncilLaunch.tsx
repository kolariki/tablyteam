import { motion } from 'framer-motion'
import { Gavel, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { useBuild, type TeamMember } from '../buildStore'
import { api } from '../lib/api'
import { tr, useT } from '../lib/i18n'
import SkillPicker from './SkillPicker'
import { toast } from './Toast'

/** Before sending the project to the council: what the user wants treated first, then the team adds its own findings. */
export default function CouncilLaunch({ team, onLaunch, onClose, defaultRounds = 3 }: { team: TeamMember[]; onLaunch: (priorities: string, rounds: number) => Promise<void>; onClose: () => void; defaultRounds?: number }) {
  const T = useT()
  const [priorities, setPriorities] = useState('')
  const [rounds, setRounds] = useState(defaultRounds)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      await onLaunch(priorities.trim(), rounds)
    } finally {
      setBusy(false)
    }
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[130] bg-paper/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} className="panel rounded-3xl p-6 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-2xl bg-accent-soft text-accent flex items-center justify-center shrink-0"><Gavel size={20} /></span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.3em] text-accent">{T('Consejo de revisión', 'Review council')}</div>
            <h3 className="text-2xl mt-0.5">{T('¿Qué querés que el equipo trate primero?', 'What should the team tackle first?')}</h3>
            <p className="mt-1 text-[13px] text-ink-2">{team.map((t) => t.role_label).join(', ')} {T('van a revisar el proyecto en la arena. Empiezan por lo que escribas acá y después suman lo que cada uno encuentre desde su área.', 'will review the project in the arena. They start with what you write here and then add whatever each one finds from their own area.')}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-ink-3 hover:text-ink"><X size={18} /></button>
        </div>
        <textarea
          autoFocus
          value={priorities}
          onChange={(e) => setPriorities(e.target.value)}
          rows={5}
          placeholder={T('Opcional. Ej.: "Revisen el flujo de pago de punta a punta", "la pantalla principal se ve pobre en mobile", "¿el modelo de datos aguanta multi-sucursal?"', 'Optional. E.g.: "Review the payment flow end to end", "the main screen looks poor on mobile", "does the data model handle multi-branch?"')}
          className="mt-4 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[13.5px] outline-none focus:border-accent"
        />
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-widest text-ink-3 mb-1.5">{T('Skills por rol para esta ronda (opcional)', 'Skills per role for this round (optional)')}</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {team.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px]">
                <span className="font-medium truncate min-w-0">{t.name}</span>
                <span className="text-ink-3 truncate min-w-0 hidden sm:inline">{t.role_label}</span>
                <div className="ml-auto shrink-0"><SkillPicker compact value={t.skills ?? []} onChange={async (ids) => {
                  const b = useBuild.getState()
                  if (!b.id) return
                  try {
                    await api.setTeamSkills(b.id, b.sessionId, t.id, ids)
                    b.set({ team: b.team.map((x) => (x.id === t.id ? { ...x, skills: ids } : x)) })
                  } catch (e) {
                    toast.error(tr('No se pudieron cargar las skills', 'Could not load the skills'), (e as Error).message)
                  }
                }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-[12px] text-ink-3 flex items-center gap-1.5">
            {T('máx. rondas', 'max. rounds')}
            <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink">
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span className="text-[11.5px] text-ink-4">{T('Si no escribís nada, el equipo decide qué revisar.', 'If you write nothing, the team decides what to review.')}</span>
          <button disabled={busy} onClick={go} className="ml-auto flex items-center gap-2 rounded-xl bg-accent text-white px-4 py-2 text-sm font-semibold hover:brightness-110 disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Gavel size={15} />} {T('Enviar al consejo', 'Send to the council')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
