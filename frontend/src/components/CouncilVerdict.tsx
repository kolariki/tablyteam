import { motion } from 'framer-motion'
import { CheckCircle2, Gavel, Hammer, Loader2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import { tr, useT } from '../lib/i18n'
import { agentMap, useAgentColor, useArena } from '../store'
import ProviderLogo from './ProviderLogo'
import { toast } from './Toast'

/** End of a review-mode session: the council's consolidated verdict + change list → "build again with these changes". */
export default function CouncilVerdict() {
  const T = useT()
  const council = useArena((s) => s.council)
  const show = useArena((s) => s.showVerdict)
  const config = useArena((s) => s.config)
  const turns = useArena((s) => s.turns)
  const judge = useArena((s) => s.judge)
  const set = useArena((s) => s.set)
  const colorOf = useAgentColor()
  const [picked, setPicked] = useState<Record<number, boolean>>({})
  const [rounds, setRounds] = useState(0) // after the builder applies the list, the user decides the next step (no automatic round)
  const [priorities, setPriorities] = useState('')
  const [busy, setBusy] = useState(false)
  const [redoing, setRedoing] = useState(false)
  if (!show || !config || config.mode !== 'review') return null
  const map = agentMap(config)
  const ro = config.review_of
  const closing = turns.filter((t) => t.phase === 'closing')
  const deliberating = !council

  const changes = council?.changes ?? []
  const chosen = changes.filter((_, i) => picked[i] ?? true)
  const blocking = changes.filter((c) => c.severity === 'bloqueante').length

  const build = async () => {
    if (!ro) return
    setBusy(true)
    try {
      await api.councilApply(ro.build_id, ro.session_id, chosen, rounds, useArena.getState().sessionId, rounds > 0 ? priorities.trim() : '')
      set({ showVerdict: false, pendingBuild: { buildId: ro.build_id, sessionId: ro.session_id } })
    } catch (e) {
      toast.error(tr('No se pudo lanzar la construcción', 'Could not start the build'), (e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const openBuild = () => ro && set({ showVerdict: false, pendingBuild: { buildId: ro.build_id, sessionId: ro.session_id } })
  // the chairman's consolidation can come back short (cut output): redo just that step over the saved debate
  const redo = async () => {
    const sid = useArena.getState().sessionId
    if (!sid) return
    setRedoing(true)
    try {
      const d = (await api.councilRedo(sid)) as unknown as { approved: boolean; headline: string; why: string; changes: typeof changes; priorities?: NonNullable<typeof council>['priorities']; judge_id: string; model: string }
      set({ council: { approved: !!d.approved, headline: d.headline ?? '', why: d.why ?? '', changes: d.changes ?? [], priorities: d.priorities ?? [], judge_id: d.judge_id, model: d.model } })
      setPicked({})
      toast.ok(tr('Veredicto reconsolidado', 'Verdict re-consolidated'), `${(d.changes ?? []).length} ${tr('cambios en la lista.', 'changes on the list.')}`)
    } catch (e) {
      toast.error(tr('No se pudo reconsolidar', 'Could not re-consolidate'), (e as Error).message)
    } finally {
      setRedoing(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-paper/80 backdrop-blur-sm flex items-center justify-center p-4 @container" onClick={() => set({ showVerdict: false })}>
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 18 }} className="panel rounded-3xl p-5 @3xl:p-8 w-full max-w-5xl max-h-full overflow-y-auto scroll-thin" onClick={(e) => e.stopPropagation()}>
        <div className="grid gap-6 @3xl:grid-cols-[1.2fr_1fr]">
          {/* ---------------- verdict + changes */}
          <div>
            <div className="text-xs uppercase tracking-[0.4em] text-gold">{T('Veredicto del consejo', 'Council verdict')}{ro?.round ? ` · ${T('ronda', 'round')} ${ro.round}` : ''}</div>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-5xl leading-none">{deliberating ? '⚖️' : council.approved ? '✅' : '🛠️'}</span>
              <div>
                <div className={`serif text-4xl @3xl:text-5xl leading-none ${deliberating ? 'text-ink-3' : council.approved ? 'text-ok' : 'text-ink'}`}>
                  {deliberating ? T('Deliberando…', 'Deliberating…') : council.approved ? T('Listo para producción', 'Ready for production') : T('Hay que cambiar cosas', 'Things need to change')}
                </div>
                <div className="font-mono text-xs text-ink-3 mt-1">{ro?.title ?? config.topic}</div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-line bg-surface-2 p-5" style={{ borderLeft: `3px solid ${council?.approved ? 'var(--color-ok)' : 'var(--color-gold)'}` }}>
              {deliberating ? (
                <p className="text-ink-3 italic flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {T('El presidente del consejo consolida los veredictos de cada rol…', 'The council chair is consolidating each role’s verdict…')}</p>
              ) : (
                <>
                  {council.headline && <div className="serif text-2xl leading-tight">{council.headline}</div>}
                  {council.why && <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{council.why}</p>}
                  {(council.priorities?.length ?? 0) > 0 && (
                    <div className="mt-4 rounded-xl border border-accent/30 bg-accent-soft/40 px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-widest text-accent mb-1">{T('Lo que vos pediste', 'What you asked for')}</div>
                      <ul className="space-y-1">
                        {council.priorities!.map((p) => (
                          <li key={p.id} className="flex items-start gap-1.5 text-[13px]">
                            {p.status === 'done' ? <CheckCircle2 size={14} className="text-ok shrink-0 mt-0.5" /> : <XCircle size={14} className={`${p.status === 'partial' ? 'text-gold' : 'text-danger'} shrink-0 mt-0.5`} />}
                            <span><span className={p.status === 'done' ? 'text-ink-3 line-through' : 'text-ink'}>{p.text}</span><span className={`ml-1.5 text-[11px] font-bold uppercase ${p.status === 'done' ? 'text-ok' : p.status === 'partial' ? 'text-gold' : 'text-danger'}`}>{p.status === 'done' ? T('cumplida', 'done') : p.status === 'partial' ? T('a medias', 'partial') : T('pendiente', 'pending')}</span>{p.note && <span className="block text-[11.5px] text-ink-3">{p.note}</span>}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-widest text-ink-3">{T('Lo que hay que cambiar', 'What needs to change')} · {changes.length} {changes.length === 1 ? T('ítem', 'item') : T('ítems', 'items')}{blocking ? ` · ${blocking} ${blocking === 1 ? T('bloqueante', 'blocking') : T('bloqueantes', 'blocking')}` : ''}</div>
                    {changes.length > 0 && <button onClick={() => setPicked(Object.fromEntries(changes.map((_, i) => [i, chosen.length !== changes.length])))} className="text-[11px] text-accent hover:underline">{chosen.length === changes.length ? T('desmarcar todo', 'uncheck all') : T('marcar todo', 'check all')}</button>}
                  </div>
                  {changes.length === 0 && <div className="mt-2 text-[13px] text-ink-2">{T('El consejo no pidió cambios.', 'The council asked for no changes.')}</div>}
                  <ul className="mt-2 space-y-1.5">
                    {changes.map((c, i) => (
                      <li key={i}>
                        <label className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[13px] cursor-pointer ${(picked[i] ?? true) ? 'border-line bg-paper' : 'border-dashed border-line/70 bg-transparent text-ink-3'}`}>
                          <input type="checkbox" className="accent-accent mt-0.5" checked={picked[i] ?? true} onChange={(e) => setPicked({ ...picked, [i]: e.target.checked })} />
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${c.severity === 'bloqueante' ? 'bg-danger/10 text-danger' : 'bg-accent-soft text-accent'}`}>{c.severity}</span>
                          <span className="min-w-0"><span className="text-ink">{c.text}</span>{c.role && <span className="ml-1.5 text-[11px] text-ink-3">· {c.role}</span>}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center gap-3">
                    {council.model && <span className="font-mono text-[10.5px] text-ink-4">{T('Presidente del consejo:', 'Council chair:')} {council.model}</span>}
                    <button disabled={redoing} onClick={redo} className={`ml-auto flex items-center gap-1 text-[11.5px] hover:underline disabled:opacity-50 ${changes.length === 0 && !council.approved ? 'text-danger font-semibold' : 'text-ink-3'}`} title={T('Vuelve a correr solo al presidente sobre el mismo debate (una llamada, barato)', 'Re-runs only the chair over the same debate (one call, cheap)')}>
                      {redoing ? <Loader2 size={12} className="animate-spin" /> : null} {changes.length === 0 && !council.approved ? T('La lista quedó vacía aunque los roles pidieron cambios: reconsolidar →', 'The list came back empty even though the roles asked for changes: re-consolidate →') : T('reconsolidar la lista', 're-consolidate the list')}
                    </button>
                  </div>
                </>
              )}
            </div>

            {!deliberating && ro && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {chosen.length > 0 ? (
                  <button disabled={busy} onClick={build} className="flex items-center gap-2 rounded-xl bg-accent text-white px-5 py-2.5 font-semibold hover:brightness-110 disabled:opacity-50">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Hammer size={16} />} {T('Construir con estos', 'Build with these')} {chosen.length} {chosen.length === 1 ? T('cambio', 'change') : T('cambios', 'changes')}
                  </button>
                ) : council.approved ? (
                  <button onClick={openBuild} className="flex items-center gap-2 rounded-xl bg-accent text-white px-5 py-2.5 font-semibold hover:brightness-110"><CheckCircle2 size={16} /> {T('Ver el proyecto aprobado', 'View the approved project')}</button>
                ) : (
                  <button onClick={openBuild} className="flex items-center gap-2 rounded-xl border-2 border-accent text-accent px-5 py-2.5 font-semibold hover:bg-accent-soft"><Hammer size={16} /> {T('Volver al constructor', 'Back to the builder')}</button>
                )}
                {chosen.length > 0 && (
                  <label className="flex items-center gap-1.5 text-[12px] text-ink-3">
                    {T('después, el consejo vuelve a revisar', 'afterwards, the council reviews again')}
                    <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[12px] text-ink">
                      <option value={0}>{T('no', 'no')}</option>
                      {[1, 2, 3].map((n) => <option key={n} value={n}>{n} {n === 1 ? T('ronda más', 'more round') : T('rondas más', 'more rounds')}</option>)}
                    </select>
                  </label>
                )}
                <button onClick={() => ro && set({ showVerdict: false, pendingBuild: { buildId: ro.build_id, sessionId: ro.session_id, fde: changes.filter((c) => c.severity === 'bloqueante').map((c) => `- ${c.text}`).join('\n') } })} className="text-[12.5px] text-gold hover:underline" title={T('Un ingeniero nuestro resuelve esto por vos, precio fijo', 'One of our engineers solves this for you, fixed price')}>{T('¿Preferís que un developer lo resuelva? →', 'Rather have a developer handle it? →')}</button>
                <button onClick={openBuild} className="ml-auto text-[12.5px] text-ink-3 hover:text-ink">{T('abrir el constructor sin cambios →', 'open the builder without changes →')}</button>
                {chosen.length > 0 && rounds > 0 && (
                  <textarea value={priorities} onChange={(e) => setPriorities(e.target.value)} rows={2} placeholder={T('Para la próxima ronda: ¿qué querés que el consejo mire primero? (opcional)', 'For the next round: what should the council look at first? (optional)')} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[12.5px] outline-none focus:border-accent" />
                )}
              </div>
            )}
          </div>

          {/* ---------------- per-role verdicts */}
          <div>
            <div className="text-[11px] uppercase tracking-widest text-ink-3 flex items-center gap-1.5"><Gavel size={12} /> {T('Veredicto de cada rol', 'Verdict by role')}</div>
            <div className="mt-3 space-y-2">
              {closing.length === 0 && <div className="text-[12.5px] text-ink-3">{T('Todavía no hubo ronda de cierre.', 'No closing round yet.')}</div>}
              {closing.map((t) => {
                const a = map[t.agent_id]
                const ok = /^\s*aprueb/i.test(t.message)
                return (
                  <motion.div key={t.turn} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-surface border border-line px-3 py-2 text-[12.5px]" style={{ borderLeft: `3px solid ${colorOf(a)}` }}>
                    <div className="flex items-center gap-1.5 font-semibold" style={{ color: colorOf(a) }}>
                      <ProviderLogo provider={a?.wanted_provider ?? a?.provider} size={14} /> {a?.name}
                      <span className={`ml-auto flex items-center gap-1 text-[10.5px] font-bold uppercase ${ok ? 'text-ok' : 'text-gold'}`}>{ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {ok ? T('aprueba', 'approves') : T('pide cambios', 'requests changes')}</span>
                    </div>
                    <div className="mt-1 text-ink-2 whitespace-pre-wrap line-clamp-6">{t.message.replace(/^\s*(APRUEBO|CAMBIOS)\s*/i, '')}</div>
                  </motion.div>
                )
              })}
            </div>
            {judge && deliberating && <div className="mt-3 font-mono text-[10.5px] text-ink-4">{T('preside:', 'chair:')} {judge.model}</div>}
          </div>
        </div>
        <div className="mt-5 text-center">
          <button className="text-sm text-ink-3 hover:text-ink" onClick={() => set({ showVerdict: false })}>{T('cerrar', 'close')}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
