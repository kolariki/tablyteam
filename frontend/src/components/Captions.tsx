import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useT } from '../lib/i18n'
import { partialTags } from '../lib/parse'
import AgentAvatar from './AgentAvatar'
import { agentMap, useAgentColor, useArena } from '../store'

/** Lower-third subtitles — the thing that makes a screen recording read as a video. */
export default function Captions({ big = false }: { big?: boolean }) {
  const T = useT()
  const handoffs = useArena((s) => s.handoffs)
  const live = useArena((s) => s.live)
  const status = useArena((s) => s.status)
  const config = useArena((s) => s.config)
  const colorOf = useAgentColor()
  const map = agentMap(config)
  const last = handoffs[handoffs.length - 1]
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (!last) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 1800)
    return () => clearTimeout(t)
  }, [last?.ts])

  let content: React.ReactNode = null
  let key = 'none'
  if (live?.phase === 'closing' && !live.raw) {
    key = `c-${live.turn}`
    content = <div className={`${big ? 'text-3xl' : 'text-xl'} font-bold tracking-tight`}>{T('📋 Ronda de cierre:', '📋 Closing round:')} {map[live.agentId]?.name} {T('entrega sus decisiones finales', 'delivers their final decisions')}</div>
  } else if (status === 'voting') {
    key = 'vote'
    content = <div className={`${big ? 'text-3xl' : 'text-xl'} font-bold tracking-tight`}>{T('🗳️ Votación final: ¿quién ganó el debate?', '🗳️ Final vote: who won the debate?')}</div>
  } else if (flash && last && map[last.from]) {
    const from = map[last.from]
    const to = map[last.to]
    key = `h-${last.ts}`
    content = (
      <div className="flex flex-col items-center gap-1">
        <div className={`${big ? 'text-4xl' : 'text-2xl'} font-bold tracking-tight flex items-center gap-3`}>
          <span style={{ color: colorOf(from) }}>{from.name}</span>
          <motion.span initial={{ x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="text-ink-4">➜</motion.span>
          <span style={{ color: to ? colorOf(to) : 'var(--color-ink)' }}>{to ? to.name : T('FIN', 'END')}</span>
        </div>
        {last.reason && <div className={`${big ? 'text-lg' : 'text-sm'} italic text-ink-2 max-w-3xl text-center`}>“{last.reason}”</div>}
        {last.forced_reason && <div className="text-[11px] font-mono text-gold">↻ {last.forced_reason} ({T('pidió:', 'asked for:')} {last.requested})</div>}
      </div>
    )
  } else if (live) {
    const a = map[live.agentId]
    const p = partialTags(live.raw)
    const msg = p.message ?? ''
    key = `s-${live.turn}`
    const color = colorOf(a)
    content = (
      <div className="flex items-start gap-3 max-w-4xl">
        <AgentAvatar agent={a} size={big ? 44 : 34} className="shrink-0" />
        <div>
          <div className="text-xs uppercase tracking-widest font-bold" style={{ color }}>{a?.name}</div>
          <div className={`${big ? 'text-2xl' : 'text-lg'} leading-snug font-medium`}>
            {msg ? (msg.length > 170 ? '…' + msg.slice(-170) : msg) : <span className="text-ink-3 italic">{p.thinking ? `💭 ${p.thinking.slice(-120)}` : T('pensando…', 'thinking…')}</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none flex justify-center">
      <AnimatePresence mode="wait">
        {content && (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl bg-surface/95 backdrop-blur px-6 py-3 border border-line shadow-[0_8px_30px_-12px_rgba(30,38,34,0.35)]"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
