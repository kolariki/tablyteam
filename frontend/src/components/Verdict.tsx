import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Hammer, Loader2, Maximize2, MessageSquarePlus, Minimize2, Pencil, RotateCcw, X } from 'lucide-react'
import { useT } from '../lib/i18n'
import { partialTags } from '../lib/parse'
import Md from './Md'
import ProviderLogo from './ProviderLogo'
import AgentAvatar from './AgentAvatar'
import { agentMap, useAgentColor, useArena } from '../store'

import CouncilVerdict from './CouncilVerdict'
import ReferencesField from './ReferencesField'

export default function Verdict({ onRedebate, onRerun }: { onRedebate?: (note: string, decisions: string) => Promise<void>; onRerun?: () => Promise<void> } = {}) {
  const T = useT()
  const [note, setNote] = useState('')
  const [redebating, setRedebating] = useState(false)
  // the decisions as the user edits them: they feed the re-debate and the brief (hooks stay above the early returns)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [refs, setRefs] = useState<string[]>(() => useArena.getState().config?.references ?? [])
  const [deep, setDeep] = useState<boolean>(() => !!useArena.getState().config?.deep_analysis)
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
  // the decisions as the user edits them: they feed the re-debate and the brief
  const textOf = (d: { agent: { id: string } | undefined; text: string }) => edits[d.agent!.id] ?? d.text
  const decisionsText = decisions.map((d) => `- ${d.agent!.name}: ${textOf(d)}`).join('\n')
  const edited = Object.keys(edits).some((k) => { const d = decisions.find((x) => x.agent!.id === k); return d && edits[k] !== d.text })
  /** The references live on the session config: the brief, the build and the next debate all read them from there. */
  const saveRefs = () => { const cfg = useArena.getState().config; if (cfg) set({ config: { ...cfg, references: refs, deep_analysis: deep } }) }
  const goBuild = () => { saveRefs(); set({ showVerdict: false, showBriefExport: true, decisionNotes: edited ? decisionsText : '' }) }
  const redebate = async () => {
    if (!onRedebate || !note.trim()) return
    setRedebating(true)
    saveRefs()
    try {
      const refNote = refs.length ? `\n\n${T('Referencias a tener en cuenta', 'References to consider')}: ${refs.join(', ')}` : ''
      await onRedebate(note.trim() + refNote, decisionsText)
    } finally {
      setRedebating(false)
    }
  }

  const pill = 'flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm shadow-sm transition hover:bg-accent-soft hover:border-accent hover:text-accent disabled:opacity-40'
  const primary = 'flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(47,107,93,.7)] transition hover:brightness-110 disabled:opacity-40'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px] @container" onClick={() => set({ showVerdict: false })}>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(30,38,34,.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header: the winner */}
        <div className="relative flex items-center gap-5 border-b border-line px-7 py-6" style={{ background: `linear-gradient(135deg, ${wColor}14 0%, transparent 60%)` }}>
          {winner && (
            <motion.div initial={{ scale: 0.6, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 }} className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-surface shadow-[0_14px_30px_-14px_rgba(30,38,34,.5)]" style={{ border: `2px solid ${wColor}` }}>
              <AgentAvatar agent={winner} size={56} />
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[26px] leading-none drop-shadow">👑</span>
            </motion.div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.35em] text-gold">{T('Veredicto de los agentes', 'The agents’ verdict')}</div>
            {winner ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
                <div className="serif text-[44px] leading-none @3xl:text-[52px]" style={{ color: wColor }}>{winner.name}</div>
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-ink-2">{winner.model}</span>
                  <span className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={{ color: wColor, borderColor: `${wColor}66`, background: `${wColor}14` }}>{wVotes} {wVotes === 1 ? T('voto', 'vote') : T('votos', 'votes')}</span>
                  {verdict.tie && <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-bold text-gold">{T('desempate', 'tiebreak')}</span>}
                </div>
              </motion.div>
            ) : (
              <div className="serif mt-1 text-[36px] leading-none text-ink-2">{T('Sin ganador', 'No winner')}</div>
            )}
          </div>
          <button onClick={() => set({ showVerdict: false })} className="self-start rounded-full p-1.5 text-ink-3 transition hover:bg-surface-2 hover:text-ink" aria-label={T('Cerrar', 'Close')}><X size={18} strokeWidth={2.5} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-7 py-6">
          <div className="grid gap-6 @3xl:grid-cols-[1.15fr_1fr]">
            {/* why */}
            <div className="rounded-2xl border border-line bg-paper p-6 shadow-[0_12px_28px_-18px_rgba(30,38,34,.4)]" style={{ borderTop: `3px solid ${wColor}` }}>
              <div className="text-[10.5px] uppercase tracking-[0.25em] text-ink-3">{T('¿Por qué ganó?', 'Why did they win?')}</div>
              {text?.headline && <div className={`serif mt-2 text-[26px] leading-tight ${streaming && !text.why ? 'caret' : ''}`}>{text.headline}</div>}
              {text?.why && <p className={`mt-3 text-[14.5px] leading-relaxed text-ink ${streaming && !text.key_moment ? 'caret' : ''}`}>{text.why}</p>}
              {text?.key_moment && (
                <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3" style={{ borderLeft: `3px solid ${wColor}` }}>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-ink-3">{T('Momento clave', 'Key moment')}</div>
                  <p className="mt-1 text-[13.5px] italic leading-relaxed text-ink-2">{text.key_moment}</p>
                </div>
              )}
              {text?.others && (
                <p className={`mt-3 text-[13px] leading-relaxed text-ink-3 ${streaming ? 'caret' : ''}`}>
                  <span className="font-medium text-ink-2">{T('Al resto le faltó: ', 'What the others lacked: ')}</span>
                  {text.others}
                </p>
              )}
              {!text && judge && <p className="mt-2 italic text-ink-3">{T('el juez está deliberando', 'the judge is deliberating')}<span className="caret" /></p>}
              {!text && !judge && <p className="mt-2 text-sm text-ink-3">{T('Esta sesión se grabó antes de que existiera el juez, así que no tiene explicación escrita. Abajo están los datos que definieron el resultado.', 'This session was recorded before the judge existed, so it has no written explanation. Below are the facts that decided the outcome.')}</p>}

              <div className="mt-4 flex flex-wrap gap-1.5 text-[11.5px]">
                <Fact>🗳️ {wVotes} {wVotes === 1 ? T('voto', 'vote') : T('votos', 'votes')}{votedBy.length ? ` ${T('de', 'from')} ${votedBy.join(', ')}` : ''}</Fact>
                {avgConf(wId) != null && <Fact>🎯 {T('confianza prom.', 'avg. confidence')} {avgConf(wId)}%</Fact>}
                <Fact>📣 {T('lo llamaron', 'called upon')} {handoffs.filter((h) => h.to === wId).length}×</Fact>
                <Fact>💬 {turns.filter((t) => t.agent_id === wId).length} {T('turnos', 'turns')}</Fact>
              </div>
              {verdict.tie && (
                <div className="mt-3 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-[12.5px] text-ink-2">
                  <b className="text-gold">{T('Empate', 'Tie')}</b> {T('a', 'at')} {max} {max === 1 ? T('voto', 'vote') : T('votos', 'votes')} {T('entre', 'between')} {tied.map((k) => map[k]?.name).join(', ')} → {T('se desempató por', 'broken by')} <b>{T('confianza promedio', 'average confidence')}</b>:{' '}
                  {tied
                    .map((k) => ({ k, c: verdict.tiebreak?.confidence?.[k] ?? avgConf(k) }))
                    .sort((a, b) => (b.c ?? 0) - (a.c ?? 0))
                    .map(({ k, c }) => `${map[k]?.name} ${c != null ? Math.round(c) : '—'}%`)
                    .join(' · ')}
                </div>
              )}
              {judge && <div className="mt-4 flex items-center gap-1.5 border-t border-line pt-3 font-mono text-[10.5px] text-ink-4"><ProviderLogo provider={judge.id} size={12} /> {T('Juez neutral:', 'Neutral judge:')} {judge.model}</div>}
            </div>

            {/* votes */}
            <div>
              <div className="rounded-2xl border border-line bg-paper p-5 shadow-[0_12px_28px_-18px_rgba(30,38,34,.4)]">
                <div className="text-[10.5px] uppercase tracking-[0.25em] text-ink-3">{T('Votos', 'Votes')}</div>
                <div className="mt-3 space-y-2.5">
                  {ranking.map((a, i) => {
                    const n = verdict.tally[a.id] ?? 0
                    const color = colorOf(a)
                    const isW = a.id === wId
                    return (
                      <div key={a.id} className="flex items-center gap-3">
                        <AgentAvatar agent={a} size={32} ring={false} className="shadow-sm" />
                        <div className="w-24 truncate text-[13px] font-semibold" style={{ color }}>{a.name}{isW && ' 👑'}</div>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} transition={{ delay: 0.4 + i * 0.12, duration: 0.7, ease: 'easeOut' }} />
                        </div>
                        <div className="w-6 text-right font-mono text-sm text-ink">{n}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {votes.map((v, i) => (
                  <motion.div key={v.voter} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.05 }} className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[12.5px]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: colorOf(map[v.voter]) }} />
                      <span className="font-semibold" style={{ color: colorOf(map[v.voter]) }}>{map[v.voter]?.name}</span>
                      <span className="text-ink-3">{T('votó a', 'voted for')}</span>
                      <span className="font-semibold" style={{ color: colorOf(map[v.target ?? '']) }}>{v.target ? map[v.target]?.name : '—'}</span>
                    </div>
                    {v.reason && <div className="mt-1 italic leading-snug text-ink-2">“{v.reason}”</div>}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-line bg-paper p-5 shadow-[0_12px_28px_-18px_rgba(30,38,34,.4)]">
              <DecisionsHeader expanded={false} editing={editing} edited={edited} onEdit={() => setEditing((v) => !v)} onExpand={() => setExpanded(true)} onReset={() => setEdits({})} />
              {text?.headline && <div className="serif mt-2 text-lg leading-snug text-ink">{text.headline}</div>}
              <DecisionList decisions={decisions} editing={editing} edits={edits} setEdits={setEdits} colorOf={colorOf} maxH="max-h-[40vh]" />
            </div>
            <div className="rounded-2xl border border-line bg-paper p-5 shadow-[0_12px_28px_-18px_rgba(30,38,34,.4)]">
              <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.25em] text-ink-3"><MessageSquarePlus size={12} className="text-accent" /> {T('Tu punto de vista', 'Your point of view')}</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{T('Si querés cambiar algo o agregar tu mirada, el consejo vuelve a debatir con estas decisiones como punto de partida y tu pedido como prioridad.', 'If you want to change something or add your view, the council debates again with these decisions as the starting point and your request as the priority.')}</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={T('ej.: no quiero backend propio, usen Supabase; que el QA priorice tests de pagos; el nombre tiene que ser corto…', 'e.g.: no custom backend, use Supabase; QA should prioritise payment tests; the name must be short…')} className="mt-2 h-28 w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-accent" />
              <div className="mt-3"><ReferencesField value={refs} onChange={setRefs} deep={deep} onDeep={setDeep} compact /></div>
              <button type="button" onClick={redebate} disabled={!note.trim() || redebating || !onRedebate} className={`${pill} mt-3 border-accent/40 text-accent`}>{redebating ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} {T('Pedir cambios y volver a debatir', 'Request changes and debate again')}</button>
            </div>
          </div>
        </div>

        {expanded && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-10 flex items-center justify-center bg-ink/30 p-6 backdrop-blur-[2px]" onClick={() => setExpanded(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="flex h-[80%] w-[80%] flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-[0_30px_80px_-30px_rgba(30,38,34,.6)]" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-line px-6 py-4">
                <DecisionsHeader expanded editing={editing} edited={edited} onEdit={() => setEditing((v) => !v)} onExpand={() => setExpanded(false)} onReset={() => setEdits({})} />
                {text?.headline && <div className="serif mt-2 text-[22px] leading-snug text-ink">{text.headline}</div>}
                {text?.why && <p className="mt-1.5 max-w-4xl text-[13.5px] leading-relaxed text-ink-2">{text.why}</p>}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-6 py-4">
                <DecisionList decisions={decisions} editing={editing} edits={edits} setEdits={setEdits} colorOf={colorOf} big />
              </div>
              <div className="flex items-center gap-2 border-t border-line px-6 py-3">
                <span className="text-[11.5px] text-ink-4">{edited ? T('Tus cambios van al brief y al nuevo debate.', 'Your changes go into the brief and the next debate.') : T('Podés editar cualquier decisión antes de construir.', 'You can edit any decision before building.')}</span>
                <button className={`${pill} ml-auto`} onClick={() => setExpanded(false)}>{T('Listo', 'Done')}</button>
                <button type="button" onClick={goBuild} className={primary}><Hammer size={15} /> {T('Ir al constructor', 'Go to the builder')}</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* footer */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper px-7 py-4">
          <span className="text-[11.5px] text-ink-4">{T('Primero se arma el brief con estas decisiones; desde ahí se construye.', 'The brief is assembled from these decisions first; the build starts from there.')}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {onRerun && (
              <button type="button" onClick={() => { setRedebating(true); onRerun().finally(() => setRedebating(false)) }} disabled={redebating} className={pill} title={T('Misma consigna, mismo equipo, desde cero. Si lo corrés enseguida, el contexto fijo de cada rol sigue en caché del proveedor y la entrada sale más barata.', 'Same brief, same team, from scratch. Run right away and each role\'s fixed context is still in the provider cache, so input is cheaper.')}><RotateCcw size={14} /> {T('Volver a correr', 'Run again')}</button>
            )}
            <button className={pill} onClick={() => set({ showVerdict: false })}>{T('Cerrar', 'Close')}</button>
            <button type="button" onClick={goBuild} className={primary}><Hammer size={15} /> {T('Ir al constructor', 'Go to the builder')}</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

type Decision = { agent: { id: string; name: string; provider: string; wanted_provider?: string | null } | undefined; text: string }

function DecisionsHeader({ expanded, editing, edited, onEdit, onExpand, onReset }: { expanded: boolean; editing: boolean; edited: boolean; onEdit: () => void; onExpand: () => void; onReset: () => void }) {
  const T = useT()
  const b = 'flex h-7 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-[11.5px] shadow-sm transition hover:border-accent hover:bg-accent-soft hover:text-accent'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10.5px] uppercase tracking-[0.25em] text-ink-3">{T('Qué se va a construir y por qué', 'What gets built and why')}</span>
      {edited && <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold text-gold">{T('editado', 'edited')}</span>}
      <div className="ml-auto flex items-center gap-1.5">
        {edited && <button type="button" onClick={onReset} className={b} title={T('Volver a lo que dijo el equipo', 'Back to what the team said')}><RotateCcw size={11} /> {T('original', 'original')}</button>}
        <button type="button" onClick={onEdit} className={`${b} ${editing ? 'border-accent bg-accent-soft text-accent' : ''}`}><Pencil size={11} /> {editing ? T('Terminar edición', 'Finish editing') : T('Editar', 'Edit')}</button>
        <button type="button" onClick={onExpand} className={b} title={expanded ? T('Volver', 'Back') : T('Ver en grande', 'View large')}>{expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />} {expanded ? T('Cerrar', 'Close') : T('Ampliar', 'Expand')}</button>
      </div>
    </div>
  )
}

function DecisionList({ decisions, editing, edits, setEdits, colorOf, maxH = '', big = false }: { decisions: Decision[]; editing: boolean; edits: Record<string, string>; setEdits: (f: (e: Record<string, string>) => Record<string, string>) => void; colorOf: (a: any) => string; maxH?: string; big?: boolean }) {
  const T = useT()
  if (decisions.length === 0) return <p className="mt-2 text-[12.5px] text-ink-3">{T('Todavía no hay decisiones de cierre: el brief las arma a partir del debate.', 'No closing decisions yet: the brief assembles them from the debate.')}</p>
  return (
    <ul className={`mt-3 space-y-2 overflow-y-auto scroll-thin pr-1 ${maxH}`}>
      {decisions.map((d) => {
        const id = d.agent!.id
        const value = edits[id] ?? d.text
        const changed = edits[id] != null && edits[id] !== d.text
        return (
          <li key={id} className={`rounded-xl border bg-surface px-4 py-3 ${big ? 'text-[14px]' : 'text-[12.5px]'} ${changed ? 'border-gold/50' : 'border-line'}`}>
            <span className="flex items-center gap-1.5 font-semibold" style={{ color: colorOf(d.agent!) }}><AgentAvatar agent={d.agent!} size={18} /> {d.agent!.name}{changed && <span className="ml-1 rounded-full bg-gold/10 px-1.5 text-[9.5px] font-bold text-gold">{T('editado', 'edited')}</span>}</span>
            {editing ? (
              <textarea value={value} onChange={(e) => { const v = e.target.value; setEdits((x) => ({ ...x, [id]: v })) }} rows={Math.min(14, Math.max(3, value.split('\n').length + 1))} className="mt-1.5 w-full resize-y rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[12.5px] leading-relaxed outline-none transition focus:border-accent" />
            ) : (
              <Md text={value} className={`mt-1 text-ink-2 ${big ? 'leading-relaxed' : ''}`} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Fact({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-ink-2 shadow-sm">{children}</span>
}
