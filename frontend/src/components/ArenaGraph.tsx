import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { partialTags } from '../lib/parse'
import AgentAvatar from './AgentAvatar'
import { agentMap, useAgentColor, useArena } from '../store'

const NODE = 132
/** Org levels for the left→right layout: the CEO opens on the left, then the C-level, then heads/product, then the
 * people who build and check, then everyone else (advocates, users, custom roles). */
const LEVEL: Record<string, number> = {
  ceo: 0, founder: 0,
  cto: 1, coo: 1, cfo: 1, cpo: 1,
  'head-engineering': 2, 'tech-lead': 2, 'product-manager': 2, 'product-owner': 2, growth: 2, investor: 2,
  backend: 3, frontend: 3, mobile: 3, devops: 3, 'ai-engineer': 3, 'data-engineer': 3, 'data-scientist': 3,
  'product-designer': 3, brand: 3, 'ux-researcher': 3, qa: 3, security: 3, legal: 3, sales: 3, 'customer-support': 3,
}
const levelOf = (a: { role?: string | null; name: string }): number => {
  if (a.role && a.role in LEVEL) return LEVEL[a.role]
  const n = a.name.toLowerCase()
  if (/\bceo\b|founder|fundador/.test(n)) return 0
  if (/\bcto\b|\bcoo\b|\bcfo\b|\bcpo\b/.test(n)) return 1
  if (/head|lead|líder|product|producto|\bpm\b/.test(n)) return 2
  if (/eng|dev|dise|design|qa|test|secur|data|ai\b|ia\b|backend|frontend|mobile/.test(n)) return 3
  return 4
}

// ------------------------------------------------------------------------------------- agent node

type Side = 'top' | 'bottom' | 'left' | 'right'
type AgentData = { agentId: string; side: Side }

function AgentNode({ data }: NodeProps<Node<AgentData>>) {
  const T = useT()
  const { agentId, side } = data
  const config = useArena((s) => s.config)
  const live = useArena((s) => s.live)
  const status = useArena((s) => s.status)
  const turns = useArena((s) => s.turns)
  const verdict = useArena((s) => s.verdict)
  const votes = useArena((s) => s.votes)
  const voteStream = useArena((s) => s.voteStreams[agentId])
  const colorOf = useAgentColor()
  const agent = agentMap(config)[agentId]
  if (!agent) return null
  const color = colorOf(agent)
  const speaking = live?.agentId === agentId && (status === 'running' || status === 'connecting')
  const finishedTurn = speaking && turns.some((t) => t.turn === live!.turn)
  const waiting = speaking && !live!.raw && !live!.reasoning
  const parsed = speaking ? partialTags(live!.raw) : {}
  const isWinner = verdict?.winner === agentId
  const votesFor = votes.filter((v) => v.target === agentId).length
  const voted = votes.find((v) => v.voter === agentId)
  const isVoting = status === 'voting'

  return (
    <div style={{ width: NODE, height: NODE }} className="relative">
      <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%' }} />
      <Handle type="source" position={Position.Top} style={{ top: '50%', left: '50%' }} />

      {/* glow halo */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, ${color}33 0%, transparent 68%)` }}
        animate={{ scale: speaking ? [1.35, 1.6, 1.35] : isWinner ? 1.7 : 1, opacity: speaking || isWinner ? 1 : 0 }}
        transition={speaking ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6 }}
      />
      {/* spinning ring while waiting for first token */}
      {waiting && (
        <div
          className="absolute -inset-2 rounded-full animate-spin"
          style={{ background: `conic-gradient(from 0deg, transparent 0 70%, ${color} 100%)`, animationDuration: '0.9s', mask: 'radial-gradient(circle, transparent 62%, black 63%)', WebkitMask: 'radial-gradient(circle, transparent 62%, black 63%)' }}
        />
      )}
      <motion.div
        className="absolute inset-0 rounded-full flex flex-col items-center justify-center select-none cursor-pointer"
        style={{
          background: `radial-gradient(circle at 32% 26%, #FFFFFF 0%, ${color}14 78%)`,
          border: `${speaking ? 2.5 : 1.5}px solid ${speaking ? color : `${color}88`}`,
          boxShadow: speaking ? `0 0 0 6px ${color}1F, 0 14px 30px -12px ${color}88` : '0 1px 2px rgba(30,38,34,.06), 0 8px 20px -14px rgba(30,38,34,.35)',
        }}
        animate={{ scale: speaking ? 1.07 : 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      >
        {/* the person fills the circle; the provider's mark is on the shirt */}
        <AgentAvatar agent={agent} size={NODE - 6} ring={false} className="!bg-transparent" />
      </motion.div>
      {/* name + model under the circle, as a small label (arrows meet at the centre, so it stays clear of them) */}
      <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ top: NODE + 6, width: 160 }}>
        <span className="serif rounded-full border bg-white/95 px-3 py-[3px] text-[15px] font-medium leading-tight text-ink shadow-sm" style={{ borderColor: `${color}66` }}>{agent.name}</span>
        <span className="mt-0.5 max-w-[150px] truncate font-mono text-[9.5px] leading-tight text-ink-3" title={agent.model}>{agent.model}</span>
        {speaking && !waiting && <SoundBars color={color} />}
      </div>

      {isWinner && (
        <motion.div initial={{ y: -10, opacity: 0, scale: 0.4 }} animate={{ y: 0, opacity: 1, scale: 1 }} className="absolute -top-9 left-1/2 -translate-x-1/2 text-4xl drop-shadow-[0_4px_6px_rgba(156,118,34,0.35)]">👑</motion.div>
      )}
      {votesFor > 0 && (
        <motion.div key={votesFor} initial={{ scale: 1.8 }} animate={{ scale: 1 }} className="absolute -right-2 -top-1 rounded-full bg-gold text-white text-xs font-bold w-7 h-7 flex items-center justify-center shadow-lg">
          {votesFor}
        </motion.div>
      )}

      {/* no labels under the circle: model, turns and latency live in the role's side panel (click the circle), so the arrows stay clean */}

      {/* speech bubble */}
      <AnimatePresence>
        {(speaking || (isVoting && (voteStream || voted))) && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.25 } }}
            className="absolute w-[min(300px,78vw)] rounded-2xl px-4 py-3 text-[13.5px] leading-snug text-ink z-10"
            style={{
              ...bubblePos(side),
              background: 'var(--color-surface)',
              border: '1px solid var(--color-line)',
              borderTop: `3px solid ${color}`,
              boxShadow: '0 12px 32px -14px rgba(30,38,34,.35)',
            }}
          >
            {isVoting ? (
              <VoteBubble raw={voteStream ?? ''} target={voted?.target ?? null} />
            ) : (
              <>
                {waiting && <div className="text-ink-3 italic">{T('pensando', 'thinking')}<span className="caret" /></div>}
                {live?.reasoning && (
                  <div className="font-mono text-[10px] text-reason max-h-14 overflow-hidden mb-1.5 [mask-image:linear-gradient(transparent,black_40%)]">
                    🧠 {live.reasoning.slice(-280)}
                  </div>
                )}
                {parsed.thinking && <div className="italic text-ink-3 text-[12px] mb-1.5">💭 {parsed.thinking.slice(-160)}</div>}
                {parsed.message && (
                  <div className={finishedTurn ? '' : 'caret'}>
                    {parsed.message.length > 320 ? '…' + parsed.message.slice(-320) : parsed.message}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function bubblePos(side: Side): React.CSSProperties {
  switch (side) {
    case 'top':
      return { bottom: NODE + 18, left: NODE / 2 - 150 }
    case 'bottom':
      return { top: NODE + 58, left: NODE / 2 - 150 }
    case 'right':
      return { left: NODE + 28, top: NODE / 2, translate: '0 -50%' }
    case 'left':
      return { right: NODE + 28, top: NODE / 2, translate: '0 -50%' }
  }
}

function VoteBubble({ raw, target }: { raw: string; target: string | null }) {
  const T = useT()
  const p = partialTags(raw)
  const agents = agentMap(useArena.getState().config)
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-gold mb-1">{T('🗳️ votando', '🗳️ voting')}</div>
      {p.thinking && <div className="italic text-ink-3 text-[12px]">{p.thinking}</div>}
      {target && <div className="mt-1 font-bold">→ {agents[target]?.name ?? target}</div>}
    </div>
  )
}

function SoundBars({ color }: { color: string }) {
  return (
    <div className="absolute bottom-4 flex gap-[3px] items-end h-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full"
          style={{ background: color }}
          animate={{ height: [3, 12, 5, 10, 3] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
    </div>
  )
}

// ------------------------------------------------------------------------------------- topic node

// ------------------------------------------------------------------------------------- edges

type FlowData = { color: string; count: number; active: boolean; reason: string; forced: string | null }

function curve(sx: number, sy: number, tx: number, ty: number, bend = 34) {
  const mx = (sx + tx) / 2
  const my = (sy + ty) / 2
  const dx = tx - sx
  const dy = ty - sy
  const len = Math.hypot(dx, dy) || 1
  const cx = mx + (-dy / len) * bend
  const cy = my + (dx / len) * bend
  return { path: `M ${sx},${sy} Q ${cx},${cy} ${tx},${ty}`, lx: (mx + cx) / 2, ly: (my + cy) / 2 }
}

/** The handoff arrow runs from the rim of the speaker's circle to the rim of the listener's, with an arrowhead in the
 * speaker's colour and a "×n" badge when the same pass happened more than once, so every pass stays readable after the
 * fact (not only while it is lit up). */
function FlowEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<Edge<FlowData>>) {
  const T = useT()
  const { color, count, active, reason, forced } = data!
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const len = Math.hypot(dx, dy) || 1
  const trim = NODE / 2 + 6
  const sx = sourceX + (dx / len) * trim
  const sy = sourceY + (dy / len) * trim
  const tx = targetX - (dx / len) * (trim + 6)
  const ty = targetY - (dy / len) * (trim + 6)
  const { path, lx, ly } = curve(sx, sy, tx, ty)
  const marker = `arrow-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  return (
    <>
      <defs>
        <marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <BaseEdge id={id} path={path} markerEnd={`url(#${marker})`} style={{ stroke: color, strokeWidth: Math.min(1.75 + count * 0.75, 6), opacity: active ? 0.95 : 0.7, strokeDasharray: forced ? '6 6' : undefined }} />
      {!active && count > 1 && (
        <EdgeLabelRenderer>
          <div className="absolute pointer-events-none rounded-full px-1.5 py-[1px] font-mono text-[10px] font-semibold text-white shadow-sm" style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, background: color }}>×{count}</div>
        </EdgeLabelRenderer>
      )}
      {active && (
        <>
          {[0, 0.33, 0.66].map((delay) => (
            <circle key={delay} r={4.5} fill={color} stroke="#FFFFFF" strokeWidth={2}>
              <animateMotion dur="1.1s" begin={`${delay}s`} repeatCount="indefinite" path={path} />
            </circle>
          ))}
          <EdgeLabelRenderer>
            <div
              className="absolute pointer-events-none max-w-[220px] rounded-full px-3 py-1 text-[11px] font-medium text-white shadow-md"
              style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, background: `${color}dd` }}
            >
              {forced ? `↻ ${forced}` : reason.length > 70 ? reason.slice(0, 70) + '…' : reason || T('te toca', 'your turn')}
            </div>
          </EdgeLabelRenderer>
        </>
      )}
    </>
  )
}

function MeshEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  return <path d={`M${sourceX},${sourceY} L${targetX},${targetY}`} stroke="#1E2622" strokeOpacity={0.08} strokeDasharray="2 6" fill="none" />
}

const nodeTypes = { agent: AgentNode }
const edgeTypes = { flow: FlowEdge, mesh: MeshEdge }

// ------------------------------------------------------------------------------------- graph

function Graph() {
  const config = useArena((s) => s.config)
  const handoffs = useArena((s) => s.handoffs)
  const live = useArena((s) => s.live)
  const layout = useArena((s) => s.layout)
  const colorOf = useAgentColor()
  const agents = config?.agents ?? []

  // The stage fills whatever space it gets: the roles sit on an ellipse that stretches to the stage's own width and
  // height (minus room for the stat tiles at the top-left, the labels under each circle and the speech bubbles), and
  // the whole scene zooms with the screen, so on a big monitor the circles and names are big instead of a small
  // cluster in the middle.
  const wrap = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1200, h: 520 })
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (width > 0 && height > 0) setSize((p) => (Math.abs(p.w - width) > 1 || Math.abs(p.h - height) > 1 ? { w: width, h: height } : p))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const vertical = layout === 'vertical' || size.w < 640  // a phone gets the top → bottom tree: side by side the roles would overlap
  // screen-space margins: top keeps clear of the stat tiles, bottom leaves room for the model/turn labels
  const margin = size.w < 640 ? { top: 84, bottom: 30, side: 12 } : vertical ? { top: 60, bottom: 60, side: 24 } : { top: 96, bottom: 56, side: 70 }
  // on a phone the whole tree has to fit the short stage: as many rows as levels (two roles side by side at most)
  const phoneRows = useMemo(() => {
    const byLevel = new Map<number, number>()
    for (const a of agents) byLevel.set(levelOf(a), (byLevel.get(levelOf(a)) ?? 0) + 1)
    return [...byLevel.values()].reduce((n, c) => n + Math.ceil(c / 2), 0) || 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.map((a) => `${a.id}:${a.role ?? ''}`).join(',')])
  const phone = size.w < 640
  const zoom = phone
    ? Math.min(0.5, Math.max(0.26, Math.min(size.w / 520, (size.h - margin.top - margin.bottom) / (phoneRows * (NODE + 60)))))
    : Math.min(1.7, Math.max(0.6, vertical ? size.w / 460 : Math.min(size.h / 500, size.w / 1250)))
  const fw = size.w / zoom
  const fh = size.h / zoom
  const rx = Math.max(NODE, (fw - (2 * margin.side) / zoom - NODE) / 2)
  const ry = Math.max(NODE * 0.8, (fh - (margin.top + margin.bottom) / zoom - NODE) / 2)
  const viewport = useMemo(() => ({ x: size.w / 2, y: (margin.top + (size.h - margin.bottom)) / 2, zoom }), [size.w, size.h, zoom, margin.top, margin.bottom])

  // columns = org levels present (left → right); inside a column the roles sit in parallel, top → bottom.
  // In the 9:16 layout the same tree runs top → bottom with the parallel roles side by side.
  const columns = useMemo(() => {
    const byLevel = new Map<number, string[]>()
    for (const a of agents) {
      const l = levelOf(a)
      byLevel.set(l, [...(byLevel.get(l) ?? []), a.id])
    }
    const cols = [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([, ids]) => ids)
    // a crowded column splits so nobody overlaps: as many in parallel as fit with their name/model labels (max 3)
    const across = vertical ? rx : ry
    const slot = NODE + (vertical ? 40 : 64)
    const maxPar = Math.max(1, Math.min(vertical ? 2 : 3, Math.floor((2 * across) / slot) + 1))
    const out: string[][] = []
    for (const c of cols) for (let i = 0; i < c.length; i += maxPar) out.push(c.slice(i, i + maxPar))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.map((a) => `${a.id}:${a.role ?? ''}:${a.name}`).join(','), vertical, rx, ry])
  const levelIndex = useMemo(() => Object.fromEntries(columns.flatMap((c, i) => c.map((id) => [id, i]))) as Record<string, number>, [columns])

  const nodes = useMemo<Node[]>(() => {
    const out: Node[] = []
    const nCols = columns.length
    const along = vertical ? ry : rx       // the axis the levels advance on
    const across = vertical ? rx : ry      // the axis the parallel roles spread on
    const maxPar = Math.max(1, ...columns.map((c) => c.length))
    columns.forEach((col, ci) => {
      const t = nCols === 1 ? 0 : -along + (2 * along * ci) / (nCols - 1)
      const gap = Math.max(NODE + (vertical ? 40 : 64), Math.min(NODE + (vertical ? 40 : 150), maxPar > 1 ? (2 * across) / (maxPar - 1) : 0))
      col.forEach((id, ri) => {
        const u = col.length === 1 ? 0 : -((col.length - 1) * gap) / 2 + ri * gap
        const x = vertical ? u : t
        const y = vertical ? t : u
        // speech bubble: away from the nearest edge of the stage
        const side: Side = vertical ? (x < -10 ? 'right' : x > 10 ? 'left' : ci === 0 ? 'bottom' : 'top') : t < -rx * 0.34 ? 'right' : t > rx * 0.34 ? 'left' : y <= 0 ? 'top' : 'bottom'
        out.push({ id, type: 'agent', position: { x: x - NODE / 2, y: y - NODE / 2 }, data: { agentId: id, side }, draggable: false })
      })
    })
    return out
  }, [columns, rx, ry, vertical])

  const edges = useMemo<Edge[]>(() => {
    const out: Edge[] = []
    for (let i = 0; i < agents.length; i++)
      for (let j = i + 1; j < agents.length; j++) {
        const li = levelIndex[agents[i].id] ?? 0
        const lj = levelIndex[agents[j].id] ?? 0
        if (Math.abs(li - lj) === 1) out.push({ id: `m-${i}-${j}`, source: agents[i].id, target: agents[j].id, type: 'mesh', zIndex: 0 })
      }
    const map = agentMap(config)
    const lastHandoff = handoffs[handoffs.length - 1]
    const activeKey = lastHandoff && live && lastHandoff.to === live.agentId ? `${lastHandoff.from}->${lastHandoff.to}` : null
    const grouped = new Map<string, { count: number; last: (typeof handoffs)[number] }>()
    for (const h of handoffs) {
      if (h.to === 'END' || !map[h.to]) continue
      const k = `${h.from}->${h.to}`
      grouped.set(k, { count: (grouped.get(k)?.count ?? 0) + 1, last: h })
    }
    for (const [k, g] of grouped) {
      out.push({
        id: k,
        source: g.last.from,
        target: g.last.to,
        type: 'flow',
        zIndex: k === activeKey ? 5 : 1,
        data: { color: colorOf(map[g.last.from]), count: g.count, active: k === activeKey, reason: g.last.reason, forced: g.last.forced_reason },
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, handoffs, live?.agentId, config, levelIndex])

  const { setViewport } = useReactFlow()
  const rosterKey = `${agents.map((a) => a.id).join(',')}|${layout}`
  useEffect(() => {
    setViewport(viewport, { duration: 250 })
  }, [viewport, rosterKey, setViewport])

  return (
    <div ref={wrap} className="absolute inset-0">
    <ReactFlow
      key={rosterKey}
      defaultViewport={viewport}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesConnectable={false}
      elementsSelectable={false}
      onNodeClick={(_, n) => { if (n.type === 'agent') useArena.getState().set({ selectedAgent: n.id }) }}
      zoomOnScroll={false}
      panOnDrag={false}
      zoomOnDoubleClick={false}
      minZoom={0.2}
      maxZoom={2.5}
    />
    </div>
  )
}

export default function ArenaGraph() {
  return (
    <ReactFlowProvider>
      <Graph />
    </ReactFlowProvider>
  )
}
