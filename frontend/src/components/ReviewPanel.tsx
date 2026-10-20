import DOMPurify from 'dompurify'
import { motion } from 'framer-motion'
import { CheckCircle2, ClipboardCheck, Gavel, Loader2, Users, XCircle } from 'lucide-react'
import { marked } from 'marked'
import { useState } from 'react'
import type { ReviewResult, ReviewRound, TeamMember } from '../buildStore'
import { useT } from '../lib/i18n'
import ProviderLogo from './ProviderLogo'

const md = (s: string) => DOMPurify.sanitize(marked.parse(s, { async: false }) as string)

/** Streaming parse of one reviewer's answer (tags may be unclosed). */
function partial(raw: string) {
  const verdict = raw.match(/<verdict>\s*(approve|changes)/i)?.[1]?.toLowerCase() as 'approve' | 'changes' | undefined
  const findings = raw.match(/<findings>([\s\S]*?)(?:<\/findings>|$)/)?.[1] ?? ''
  const requests = raw.match(/<requests>([\s\S]*?)(?:<\/requests>|$)/)?.[1] ?? ''
  const reflexion = raw.match(/<reflexion>([\s\S]*?)(?:<\/reflexion>|$)/)?.[1] ?? ''
  return { verdict, findings, requests, reflexion }
}

function Verdict({ v, live }: { v?: 'approve' | 'changes'; live?: boolean }) {
  const T = useT()
  if (!v) return <span className="flex items-center gap-1 text-[11px] text-ink-3">{live ? <Loader2 size={12} className="animate-spin" /> : null} {T('revisando…', 'reviewing…')}</span>
  return v === 'approve' ? (
    <span className="flex items-center gap-1 rounded-full bg-ok/10 border border-ok/30 px-2 py-0.5 text-[11px] font-semibold text-ok"><CheckCircle2 size={12} /> {T('aprueba', 'approves')}</span>
  ) : (
    <span className="flex items-center gap-1 rounded-full bg-danger/10 border border-danger/30 px-2 py-0.5 text-[11px] font-semibold text-danger"><XCircle size={12} /> {T('pide cambios', 'requests changes')}</span>
  )
}

function ReviewerCard({ m, r, raw, audit }: { m: TeamMember; r?: ReviewResult; raw?: string; audit?: boolean }) {
  const T = useT()
  const [open, setOpen] = useState(false)
  const p = r ? { verdict: r.verdict, findings: r.findings, requests: r.requests, reflexion: r.reflexion, score: r.score ?? null, strengths: r.strengths ?? '' } : { ...partial(raw ?? ''), score: Number(raw?.match(/<score>\s*([\d.,]+)/)?.[1]?.replace(',', '.')) || null, strengths: raw?.match(/<strengths>([\s\S]*?)(?:<\/strengths>|$)/)?.[1] ?? '' }
  const live = !r
  return (
    <div className="rounded-xl border border-line bg-paper p-3" style={{ borderLeft: `3px solid ${m.color ?? '#8A9299'}` }}>
      <div className="flex items-center gap-2">
        <ProviderLogo provider={m.provider} size={16} />
        <span className="font-semibold text-[13px]">{m.name}</span>
        <span className="text-[11px] text-ink-3">{m.role_label}</span>
        {audit && p.score != null && <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: p.score >= 8 ? '#3B7F5522' : p.score >= 5 ? '#9C762222' : '#B0473B22', color: p.score >= 8 ? '#3B7F55' : p.score >= 5 ? '#9C7622' : '#B0473B' }}>{p.score}/10</span>}
        <span className={audit ? '' : 'ml-auto'}>{audit ? (p.verdict === 'changes' ? <span className="text-[11px] text-ink-3">{T('propone mejoras', 'suggests improvements')}</span> : live ? <Verdict live /> : <span className="text-[11px] text-ok">{T('sin cambios', 'no changes')}</span>) : <Verdict v={p.verdict} live={live} />}</span>
      </div>
      {audit && p.strengths && <div className="mt-2 rounded-lg bg-ok/5 border border-ok/20 px-2.5 py-2 text-[12.5px] md" dangerouslySetInnerHTML={{ __html: md(T('**Bien:** ', '**Good:** ') + p.strengths) }} />}
      {p.reflexion && <div className="mt-1.5 text-[12px] italic text-ink-3">{p.reflexion}</div>}
      {p.requests && p.verdict === 'changes' && (
        <div className={`mt-2 rounded-lg px-2.5 py-2 text-[12.5px] md ${audit ? 'bg-accent-soft/60 border border-accent/20' : 'bg-danger/5 border border-danger/20'}`} dangerouslySetInnerHTML={{ __html: md((audit ? T('**Propone:** ', '**Suggests:** ') : T('**Pide:** ', '**Requests:** ')) + p.requests) }} />
      )}
      {p.findings && (
        <>
          <button onClick={() => setOpen(!open)} className="mt-2 text-[11px] text-ink-3 hover:text-ink">{open ? '▾' : '▸'} {T('hallazgos', 'findings')}</button>
          {(open || live) && <div className="mt-1 text-[12.5px] md" dangerouslySetInnerHTML={{ __html: md(p.findings) }} />}
        </>
      )}
    </div>
  )
}

/** One completed review round (chat item). */
export function ReviewRoundCard({ round, team }: { round: ReviewRound; team: TeamMember[] }) {
  const T = useT()
  const changes = round.results.filter((r) => r.verdict === 'changes').length
  if (round.mode === 'audit') {
    const scores = round.results.map((r) => r.score).filter((x): x is number => typeof x === 'number')
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border-2 border-accent/40 bg-accent-soft/30 p-4">
        <div className="flex items-center gap-2">
          <Gavel size={18} className="text-accent" />
          <div className="font-semibold">{T('Auditoría del equipo', 'Team audit')}</div>
          {avg && <span className="ml-auto rounded-full bg-accent text-white px-2.5 py-0.5 text-[11px] font-bold">{T('puntaje', 'score')} {avg}/10</span>}
        </div>
        <div className="mt-1 text-[12.5px] text-ink-2">{changes} {T('de', 'of')} {round.results.length} {T('roles proponen mejoras. El informe consolidado está en la pestaña Informe.', 'roles suggest improvements. The consolidated report is in the Report tab.')}</div>
        <div className="mt-3 grid gap-2">
          {round.results.map((r) => {
            const m = team.find((t) => t.id === r.agent_id) ?? { id: r.agent_id, name: r.name, role: r.role, role_label: r.role_label, provider: r.provider, model: r.model, color: null }
            return <ReviewerCard key={r.agent_id} m={m} r={r} audit />
          })}
        </div>
      </motion.div>
    )
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border-2 p-4 ${round.approved ? 'border-ok/40 bg-ok/5' : 'border-gold/40 bg-gold/5'}`}>
      <div className="flex items-center gap-2">
        <Gavel size={18} className={round.approved ? 'text-ok' : 'text-gold'} />
        <div className="font-semibold">{T('Consejo de revisión · ronda', 'Review council · round')} {round.round}</div>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ${round.approved ? 'bg-ok text-white' : 'bg-gold text-white'}`}>
          {round.approved ? T('✓ APROBADO', '✓ APPROVED') : `${changes} ${changes === 1 ? T('pedido de cambio', 'change request') : T('pedidos de cambio', 'change requests')}`}
        </span>
      </div>
      <div className="mt-1 text-[12.5px] text-ink-2">
        {round.approved ? T('Todos los roles aprobaron la salida a producción.', 'Every role approved the production release.') : T('Los pedidos vuelven al constructor; cuando los aplique, el consejo revisa de nuevo.', 'The requests go back to the builder; once applied, the council reviews again.')}
      </div>
      <div className="mt-3 grid gap-2">
        {round.results.map((r) => {
          const m = team.find((t) => t.id === r.agent_id) ?? { id: r.agent_id, name: r.name, role: r.role, role_label: r.role_label, provider: r.provider, model: r.model, color: null }
          return <ReviewerCard key={r.agent_id} m={m} r={r} />
        })}
      </div>
    </motion.div>
  )
}

/** The round in progress: every reviewer streaming in parallel. */
export function LiveReview({ round, team, raws, audit }: { round: number; team: TeamMember[]; raws: Record<string, string>; audit?: boolean }) {
  const T = useT()
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border-2 border-accent/40 bg-accent-soft/40 p-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={18} className="text-accent" />
        <div className="font-semibold">{audit ? T('Auditoría del equipo', 'Team audit') : `${T('Consejo de revisión · ronda', 'Review council · round')} ${round}`}</div>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-accent"><span className="w-2 h-2 rounded-full bg-accent animate-pulse" /> {T('REVISANDO', 'REVIEWING')}</span>
      </div>
      <div className="mt-1 text-[12.5px] text-ink-2">{T('Cada rol revisa el proyecto desde su área, en paralelo, como antes de una salida a producción.', 'Each role reviews the project from its own area, in parallel, like before a production release.')}</div>
      <div className="mt-3 grid gap-2">
        {team.map((m) => <ReviewerCard key={m.id} m={m} raw={raws[m.id] ?? ''} audit={audit} />)}
      </div>
    </motion.div>
  )
}

/** Launch controls shown when a build is finished and a team exists. */
export function ReviewLauncher({ team, onStart, onEdit, disabled }: { team: TeamMember[]; onStart: (rounds: number) => void; onEdit?: () => void; disabled?: boolean }) {
  const T = useT()
  return (
    <div className="rounded-2xl border-2 border-dashed border-accent/40 p-4">
      <div className="flex items-center gap-2 font-semibold"><Gavel size={18} className="text-accent" /> {T('Revisión pre-producción del equipo', 'Team pre-production review')}</div>
      <p className="mt-1 text-[12.5px] text-ink-2">
        {T('Los', 'The')} {team.length} {T('roles que diseñaron el proyecto', 'roles that designed the project')} ({team.map((t) => t.role_label).join(', ')}) {T('lo debaten en vivo en la arena, como al principio. Al final, el consejo entrega la lista de cambios y la mandás al constructor con un click.', 'debate it live in the arena, like at the start. At the end, the council delivers the change list and you send it to the builder with one click.')}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[11.5px] text-ink-4">{T('Antes de empezar te pregunta qué querés que traten primero.', 'Before starting, it asks what you want them to tackle first.')}</span>
        {onEdit && (
          <button disabled={disabled} onClick={onEdit} className="ml-auto flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium shadow-sm transition hover:bg-accent-soft hover:border-accent hover:text-accent disabled:opacity-40">
            <Users size={15} /> {T('Modificar el consejo', 'Edit the council')}
          </button>
        )}
        <button disabled={disabled} onClick={() => onStart(3)} className={`flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40 ${onEdit ? '' : 'ml-auto'}`}>
          <Gavel size={15} /> {T('Enviar al consejo', 'Send to the council')}
        </button>
      </div>
    </div>
  )
}
