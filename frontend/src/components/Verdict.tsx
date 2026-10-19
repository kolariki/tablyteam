import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Hammer, Loader2, MessageSquarePlus, RotateCcw } from 'lucide-react'
import { useT } from '../lib/i18n'
import { partialTags } from '../lib/parse'
import Md from './Md'
import ProviderLogo from './ProviderLogo'
import { agentMap, useAgentColor, useArena } from '../store'

import CouncilVerdict from './CouncilVerdict'

export default function Verdict({ onRedebate, onRerun }: { onRedebate?: (note: string, decisions: string) => Promise<void>; onRerun?: () => Promise<void> } = {}) {
  const T = useT()
  const [note, setNote] = useState('')
  const [redebating, setRedebating] = useState(false)
  const verdict = useArena((s) => s.verdict)
  const show = useArena((s) => s.showVerdict)
  const votes = useArena((s) => s.votes)
  const turns = useArena((s) => s.turns)
  const handoffs = useArena((s) => s.handoffs)
  const config = useArena((s) => s.config)
  const judge = useArena((s) => s.judge)
  const judgeStream = useArena((s) => s.judgeStream)
  const explanation = useArena((s) => s.explanation)
  const set = useArena((s) => s.set)
  const colorOf = useAgentColor()
  const map = agentMap(config)

  useEffect(() => {
    if (!show || !verdict?.winner) return
    const color = colorOf(map[verdict.winner])
    const end = Date.now() + 1600
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: [color, '#DCE2DE', '#C9A24A'] })
      confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: [color, '#DCE2DE', '#C9A24A'] })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, verdict?.winner])

  if (config?.mode === 'review') return <CouncilVerdict />
  if (!show || !verdict || !config) return null
  const ranking = [...config.agents].sort((a, b) => (verdict.tally[b.id] ?? 0) - (verdict.tally[a.id] ?? 0) || Number(b.id === verdict.winner) - Number(a.id === verdict.winner))
  const max = Math.max(1, ...Object.values(verdict.tally))
  const winner = verdict.winner ? map[verdict.winner] : null
  const wColor = colorOf(winner ?? undefined)

  // hard facts, computed client-side so old recordings get them too
  const avgConf = (id: string) => {
    const xs = turns.filter((t) => t.agent_id === id && t.confidence != null).map((t) => t.confidence!)
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null
  }
  const wId = verdict.winner ?? ''
  const wVotes = verdict.tally[wId] ?? 0
  const votedBy = votes.filter((v) => v.target === wId).map((v) => map[v.voter]?.name)
  const tied = verdict.tie ? (verdict.tiebreak?.tied ?? Object.keys(verdict.tally).filter((k) => verdict.tally[k] === max)) : []
  const text = explanation ?? (judgeStream ? partialTags(judgeStream) : null)
  const streaming = !explanation && !!judgeStream
  // what gets built: each role's final decisions from the closing round (or its last message when there was no closing round)
  const closingTurns = turns.filter((t) => t.phase === 'closing')
  const decisions = (closingTurns.length ? closingTurns : config.agents.map((a) => [...turns].reverse().find((t) => t.agent_id === a.id)).filter(Boolean) as typeof turns)
    .map((t) => ({ agent: map[t.agent_id], text: (t.message ?? '').trim() }))
    .filter((d) => d.agent && d.text)
  const decisionsText = decisions.map((d) => `- ${d.agent!.name}: ${d.text}`).join('\n')
  const goBuild = () => set({ showVerdict: false, showBriefExport: true })
  const redebate = async () => {
    if (!onRedebate || !note.trim()) return
    setRedebating(true)
    try {
      await onRedebate(note.trim(), decisionsText)
    } finally {
      setRedebating(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-paper/80 backdrop-blur-sm flex items-center justify-center p-4 @container" onClick={() => set({ showVerdict: false })}>
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="panel rounded-3xl p-5 @3xl:p-8 w-full max-w-5xl max-h-full overflow-y-auto scroll-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid gap-6 @3xl:grid-cols-[1.15fr_1fr]">
          {/* ---------------- winner + why */}
          <div>
            <div className="text-xs uppercase tracking-[0.4em] text-gold">{T('Veredicto de los agentes', 'The agents’ verdict')}</div>
            {winner && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-3 flex items-end gap-3">
                <span className="text-5xl leading-none">👑</span>
                <div>
                  <div className="serif text-5xl @3xl:text-6xl leading-none" style={{ color: wColor }}>{winner.name}</div>
                  <div className="font-mono text-xs text-ink-3 mt-1">{winner.model}</div>
                </div>
              </motion.div>
            )}

            <div className="mt-5 rounded-2xl border border-line bg-surface-2 p-5" style={{ borderLeft: `3px solid ${wColor}` }}>
              <div className="text-[11px] uppercase tracking-widest text-ink-3">{T('¿Por qué ganó?', 'Why did they win?')}</div>
              {text?.headline && <div className={`serif text-2xl leading-tight mt-1.5 ${streaming && !text.why ? 'caret' : ''}`}>{text.headline}</div>}
              {text?.why && <p className={`mt-2 text-[14.5px] leading-relaxed text-ink ${streaming && !text.key_moment ? 'caret' : ''}`}>{text.why}</p>}
              {text?.key_moment && (
                <div className="mt-3 border-l-2 pl-3 italic text-[13.5px] text-ink-2" style={{ borderColor: wColor }}>
                  <span className="not-italic text-[10px] uppercase tracking-widest text-ink-3 block mb-0.5">{T('Momento clave', 'Key moment')}</span>
                  {text.key_moment}
                </div>
              )}
              {text?.others && (
                <p className={`mt-3 text-[13px] text-ink-3 ${streaming ? 'caret' : ''}`}>
                  <span className="text-ink-2 font-medium">{T('Al resto le faltó: ', 'What the others lacked: ')}</span>
                  {text.others}
                </p>
              )}
              {!text && judge && <p className="mt-2 text-ink-3 italic">{T('el juez está deliberando', 'the judge is deliberating')}<span className="caret" /></p>}
              {!text && !judge && <p className="mt-2 text-ink-3 text-sm">{T('Esta sesión se grabó antes de que existiera el juez, así que no tiene explicación escrita. Abajo están los datos que definieron el resultado.', 'This session was recorded before the judge existed, so it has no written explanation. Below are the facts that decided the outcome.')}</p>}

              <div className="mt-4 flex flex-wrap gap-1.5 text-[11.5px]">
                <Fact>🗳️ {wVotes} {wVotes === 1 ? T('voto', 'vote') : T('votos', 'votes')}{votedBy.length ? ` ${T('de', 'from')} ${votedBy.join(', ')}` : ''}</Fact>
                {avgConf(wId) != null && <Fact>🎯 {T('confianza prom.', 'avg. confidence')} {avgConf(wId)}%</Fact>}
                <Fact>📣 {T('lo llamaron', 'called upon')} {handoffs.filter((h) => h.to === wId).length}×</Fact>
                <Fact>💬 {turns.filter((t) => t.agent_id === wId).length} {T('turnos', 'turns')}</Fact>
              </div>
              {verdict.tie && (
                <div className="mt-3 rounded-lg bg-gold/10 border border-gold/30 px-3 py-2 text-[12.5px] text-ink-2">
                  <b className="text-gold">{T('Empate', 'Tie')}</b> {T('a', 'at')} {max} {max === 1 ? T('voto', 'vote') : T('votos', 'votes')} {T('entre', 'between')} {tied.map((k) => map[k]?.name).join(', ')} → {T('se desempató por', 'broken by')} <b>{T('confianza promedio', 'average confidence')}</b>:{' '}
                  {tied
                    .map((k) => ({ k, c: verdict.tiebreak?.confidence?.[k] ?? avgConf(k) }))
                    .sort((a, b) => (b.c ?? 0) - (a.c ?? 0))
                    .map(({ k, c }) => `${map[k]?.name} ${c != null ? Math.round(c) : '—'}%`)
                    .join(' · ')}
                </div>
              )}
              {judge && <div className="mt-3 font-mono text-[10.5px] text-ink-4">{T('Juez neutral:', 'Neutral judge:')} {judge.model}</div>}
            </div>
          </div>

          {/* ---------------- ranking + votes */}
          <div>
            <div className="text-[11px] uppercase tracking-widest text-ink-3">{T('Votos', 'Votes')}</div>
            <div className="mt-3 space-y-2.5">
              {ranking.map((a, i) => {
                const n = verdict.tally[a.id] ?? 0
                const color = colorOf(a)
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <div className="w-24 flex items-center gap-1.5 font-medium truncate text-sm" style={{ color }}>
                      <ProviderLogo provider={a.wanted_provider ?? a.provider} size={18} />
                      {a.name}
                    </div>
                    <div className="flex-1 h-5 rounded-md bg-surface-2 overflow-hidden">
                      <motion.div className="h-full rounded-md" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} transition={{ delay: 0.4 + i * 0.12, duration: 0.7, ease: 'easeOut' }} />
                    </div>
                    <div className="w-6 text-right font-mono text-sm text-ink">{n}</div>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 space-y-2">
              {votes.map((v) => (
                <motion.div key={v.voter} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="rounded-xl bg-surface border border-line px-3 py-2 text-[12.5px]">
                  <span className="font-semibold" style={{ color: colorOf(map[v.voter]) }}>{map[v.voter]?.name}</span>
                  <span className="text-ink-3">{T(' votó a ', ' voted for ')}</span>
                  <span className="font-semibold" style={{ color: colorOf(map[v.target ?? '']) }}>{v.target ? map[v.target]?.name : '—'}</span>
                  {v.reason && <div className="italic text-ink-3 mt-0.5">“{v.reason}”</div>}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
        {/* ---------------- what gets built, why, and the two ways forward */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-[11px] uppercase tracking-widest text-ink-3">{T('Qué se va a construir y por qué', 'What gets built and why')}</div>
            {text?.headline && <div className="mt-1.5 font-serif text-lg leading-snug text-ink">{text.headline}</div>}
            {text?.why && <p className="mt-1 text-[13px] text-ink-2">{text.why}</p>}
            {decisions.length > 0 ? (
              <ul className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto scroll-thin pr-1">
                {decisions.map((d) => (
                  <li key={d.agent!.id} className="rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px]">
                    <span className="flex items-center gap-1.5 font-semibold" style={{ color: colorOf(d.agent!) }}><ProviderLogo provider={d.agent!.wanted_provider ?? d.agent!.provider} size={14} /> {d.agent!.name}</span>
                    <Md text={d.text} className="mt-0.5 text-ink-2" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12.5px] text-ink-3">{T('Todavía no hay decisiones de cierre: el brief las arma a partir del debate.', 'No closing decisions yet: the brief assembles them from the debate.')}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={goBuild} className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"><Hammer size={15} /> {T('Ir al constructor', 'Go to the builder')}</button>
              <span className="text-[11.5px] text-ink-4">{T('Primero se arma el brief con estas decisiones; desde ahí se construye.', 'The brief is assembled from these decisions first; the build starts from there.')}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-ink-3"><MessageSquarePlus size={13} /> {T('Tu punto de vista', 'Your point of view')}</div>
            <p className="mt-1 text-[12.5px] text-ink-3">{T('Si querés cambiar algo o agregar tu mirada, el consejo vuelve a debatir con estas decisiones como punto de partida y tu pedido como prioridad.', 'If you want to change something or add your view, the council debates again with these decisions as the starting point and your request as the priority.')}</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={T('ej.: no quiero backend propio, usen Supabase; que el QA priorice tests de pagos; el nombre tiene que ser corto…', 'e.g.: no custom backend, use Supabase; QA should prioritise payment tests; the name must be short…')} className="mt-2 h-28 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
            <button type="button" onClick={redebate} disabled={!note.trim() || redebating || !onRedebate} className="mt-2 flex items-center gap-2 rounded-xl border border-accent/50 bg-accent-soft px-4 py-2 text-sm font-semibold text-accent disabled:opacity-40">{redebating ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} {T('Pedir cambios y volver a debatir', 'Request changes and debate again')}</button>
            {onRerun && (
              <button type="button" onClick={() => { setRedebating(true); onRerun().finally(() => setRedebating(false)) }} disabled={redebating} className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-[12.5px] text-ink-2 hover:text-ink disabled:opacity-40" title={T('Misma consigna, mismo equipo, desde cero. Si lo corrés enseguida, el contexto fijo de cada rol sigue en caché del proveedor y la entrada sale más barata.', 'Same brief, same team, from scratch. Run right away and each role\'s fixed context is still in the provider cache, so input is cheaper.')}><RotateCcw size={14} /> {T('Volver a correr tal cual (si falló algo)', 'Run again as is (if something failed)')}</button>
            )}
          </div>
        </div>
        <div className="mt-5 text-center">
          <button className="text-sm text-ink-3 hover:text-ink" onClick={() => set({ showVerdict: false })}>{T('cerrar', 'close')}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Fact({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-surface border border-line px-2.5 py-1 text-ink-2">{children}</span>
}
