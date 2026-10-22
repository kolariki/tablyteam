import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { fmtMs, fmtUsd, partialTags, STANCE } from '../lib/parse'
import Md from './Md'
import AgentAvatar from './AgentAvatar'
import { agentMap, useAgentColor, useArena } from '../store'
import type { Turn } from '../types'

export default function LiveFeed({ compact = false, all = false }: { compact?: boolean; all?: boolean }) {
  const turns = useArena((s) => s.turns)
  const live = useArena((s) => s.live)
  const errors = useArena((s) => s.errors)
  const ref = useRef<HTMLDivElement>(null)
  const liveDone = live && turns.some((t) => t.turn === live.turn)
  const shown = compact && !all ? turns.slice(-2) : turns

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' })
  }, [turns.length, live?.raw.length])

  return (
    <div ref={ref} className="h-full overflow-y-auto scroll-thin px-3 py-3 space-y-3">
      <AnimatePresence initial={false}>
        {shown.map((t) => (
          <TurnCard key={t.turn} t={t} compact={compact} />
        ))}
        {live && !liveDone && <LiveCard key={`live-${live.turn}`} />}
      </AnimatePresence>
      {errors.map((e, i) => (
        <div key={i} className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger font-mono">
          ⚠️ {e.agent_id}: {e.error}
        </div>
      ))}
    </div>
  )
}

function Header({ agentId, turn, extra }: { agentId: string; turn: number; extra?: React.ReactNode }) {
  const config = useArena((s) => s.config)
  const colorOf = useAgentColor()
  const a = agentMap(config)[agentId]
  const color = colorOf(a)
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 h-7 rounded-full flex items-center justify-center bg-surface border" style={{ borderColor: `${color}55` }}>
        <AgentAvatar agent={a} size={22} />
      </span>
      <span className="font-bold" style={{ color }}>{a?.name ?? agentId}</span>
      <span className="font-mono text-[10px] text-ink-3 truncate">{a?.model}</span>
      <span className="ml-auto font-mono text-[10px] text-ink-3">#{turn}</span>
      {extra}
    </div>
  )
}

function TurnCard({ t, compact }: { t: Turn; compact: boolean }) {
  const T = useT()
  const [open, setOpen] = useState(false)
  const config = useArena((s) => s.config)
  const colorOf = useAgentColor()
  const map = agentMap(config)
  const color = colorOf(map[t.agent_id])
  const st = STANCE[t.stance] ?? STANCE.neutral
  const nextAgent = map[t.next]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-xl border bg-surface p-3"
      style={{ borderColor: `${color}44`, borderLeft: `3px solid ${color}` }}
    >
      <Header agentId={t.agent_id} turn={t.turn} />
      <div className="mt-2 flex items-center gap-2 text-[11px]">
        {t.phase === 'closing' ? (
          <span className="rounded-full px-2 py-0.5 font-semibold bg-accent-soft text-accent">{T('📋 Cierre · decisiones finales', '📋 Closing · final decisions')}</span>
        ) : (
          <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: `${st.color}22`, color: st.color }}>
            {st.emoji} {st.label}
          </span>
        )}
        {t.responding_to && <span className="text-ink-3">{T('a', 'to')} {map[t.responding_to]?.name}</span>}
        {t.confidence != null && (
          <span className="ml-auto flex items-center gap-1.5 text-ink-3 font-mono">
            <span className="w-14 h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <span className="block h-full rounded-full" style={{ width: `${t.confidence}%`, background: color }} />
            </span>
            {t.confidence}%
          </span>
        )}
      </div>
      {/* turns come as Markdown (bold, lists, headings): render it; in the compact feed keep the clamp */}
      <Md text={t.message} className={`mt-2 text-[13.5px] leading-relaxed text-ink ${compact ? 'line-clamp-4' : ''}`} />
      {!compact && (t.thinking || t.native_reasoning) && (
        <button onClick={() => setOpen(!open)} className="mt-2 text-[11px] text-ink-3 hover:text-ink-2">
          {open ? '▾' : '▸'} {T('💭 pensamiento', '💭 thinking')}
        </button>
      )}
      {open && (
        <div className="mt-1 text-[12px] italic text-ink-3 space-y-1">
          {t.thinking && <p>{t.thinking}</p>}
          {t.native_reasoning && <pre className="not-italic font-mono text-[10px] text-reason whitespace-pre-wrap max-h-40 overflow-auto scroll-thin">🧠 {t.native_reasoning}</pre>}
        </div>
      )}
      {t.next && (
        <div className="mt-2 text-[11.5px] text-ink-3">
          <span className="font-semibold" style={{ color: nextAgent ? colorOf(nextAgent) : '#8A9299' }}>
            → {t.next === 'end' ? T('FIN', 'END') : nextAgent?.name ?? t.next}
          </span>{' '}
          {t.reason && <span className="italic">“{t.reason}”</span>}
        </div>
      )}
      {!compact && (
        <div className="mt-2 flex gap-3 font-mono text-[10px] text-ink-3">
          <span>⏱ {fmtMs(t.metrics.latency_ms)}</span>
          <span>⚡ ttft {fmtMs(t.metrics.ttft_ms)}</span>
          <span>{t.metrics.output_tokens} tok{t.metrics.estimated ? '~' : ''}</span>
          <span>{t.metrics.tokens_per_s} t/s</span>
          <span className="ml-auto">{fmtUsd(t.metrics.cost_usd)}</span>
        </div>
      )}
    </motion.div>
  )
}

function LiveCard() {
  const T = useT()
  const live = useArena((s) => s.live)!
  const colorOf = useAgentColor()
  const config = useArena((s) => s.config)
  const color = colorOf(agentMap(config)[live.agentId])
  const p = partialTags(live.raw)
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border p-3" style={{ borderColor: color, background: `${color}10`, boxShadow: `0 0 24px -8px ${color}` }}>
      <Header agentId={live.agentId} turn={live.turn} extra={<span className="text-[10px] font-bold text-danger animate-pulse">{T('● EN VIVO', '● LIVE')}</span>} />
      {live.phase === 'closing' && <div className="mt-1.5 text-[11px] font-semibold text-accent">{T('📋 Ronda de cierre · decisiones finales', '📋 Closing round · final decisions')}</div>}
      {!live.raw && !live.reasoning && <p className="mt-2 text-sm italic text-ink-3">{T('pensando', 'thinking')}<span className="caret" /></p>}
      {live.reasoning && <pre className="mt-2 font-mono text-[10px] text-reason whitespace-pre-wrap max-h-24 overflow-hidden">🧠 {live.reasoning.slice(-400)}</pre>}
      {p.thinking && <p className="mt-2 text-[12px] italic text-ink-3">💭 {p.thinking}</p>}
      {p.message && <Md text={p.message} className="mt-2 text-[13.5px] leading-relaxed caret" />}
    </motion.div>
  )
}
