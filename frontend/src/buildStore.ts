import { create } from 'zustand'

export interface BuildFile {
  size: number
  lines: number
  content?: string
  turn?: number
}

export interface TeamMember {
  id: string
  name: string
  role: string | null
  role_label: string
  provider: string
  model: string
  color?: string | null
  skills?: string[]
}

export interface ReviewResult {
  agent_id: string
  name: string
  role: string | null
  role_label: string
  provider: string
  model: string
  verdict: 'approve' | 'changes'
  reflexion: string
  findings: string
  requests: string
  score?: number | null
  strengths?: string
}

export interface ReviewRound {
  round: number
  approved: boolean
  results: ReviewResult[]
  mode?: 'review' | 'audit'
  ts: number
}

export interface Activity {
  kind: 'read' | 'write' | 'edit' | 'search' | 'run' | 'test' | 'install' | 'build' | 'git' | 'plan' | 'think'
  label: string
  path: string
  ts: number
}

export interface Todo {
  text: string
  status: 'pending' | 'in_progress' | 'completed' | string
}

export interface BuildVersion {
  n: number
  tag: string
  commit: string | null
  ts: number
  trigger: 'initial' | 'council' | 'audit' | 'user' | string
  requested: { id: string; severity: 'bloqueante' | 'mejora' | string; role: string; text: string }[]
  from_council: string | null
  stats: { added: string[]; modified: string[]; deleted: string[]; insertions: number; deletions: number }
  files: number
  summary: string
  council_session: string | null
  verdict: { approved: boolean; headline: string; changes: number } | null
  resolved: { id: string; text: string; status: 'done' | 'partial' | 'pending' | string; note: string }[]
  readiness: number | null
}

export interface ChatItem {
  role: 'user' | 'assistant' | 'review' | 'system' | 'report'
  activity?: { written: number; edited: number; commands: number; tests: number; reads: number }
  mode?: 'review' | 'audit'
  round?: number
  approved?: boolean
  results?: ReviewResult[]
  text?: string
  say?: string
  files?: string[]
  stage?: { n: number; text: string } | null
  done?: string | null
  turn?: number
  phase?: 'build' | 'preview' | 'design'
  ts: number
}

export interface BuildStage {
  n: number
  text: string
  turn: number
  files: string[]
}

export type BuildStatus = 'intro' | 'connecting' | 'running' | 'design_review' | 'reviewing' | 'completed' | 'approved' | 'audited' | 'stopped' | 'error'

interface BuildState {
  id: string | null
  sessionId: string | null
  provider: string | null
  model: string | null
  title: string
  engineSession: string | null
  workdir: string | null
  status: BuildStatus
  files: Record<string, BuildFile>
  chat: ChatItem[]
  stages: BuildStage[]
  liveTurn: number | null
  livePhase: 'build' | 'preview' | 'report' | 'design' | null
  previewHtml: string | null
  designHtml: string | null
  designRounds: number
  team: TeamMember[]
  reviews: ReviewRound[]
  reviewPlan: { max_rounds: number } | null
  liveReviews: Record<string, string>
  reviewRound: number | null
  reviewMode: 'review' | 'audit'
  mode: 'build' | 'audit'
  auditReport: string | null
  pane: 'code' | 'preview' | 'report' | 'deploy' | 'app' | 'versions' | 'design'
  fdePrefill: string | null  // open "Pedir un developer" with this text once the builder is shown
  paneOpen: boolean  // right drawer (code/preview/…) closed by default: the agent's work is the show
  deploying: boolean
  deployLogs: string[]
  councilSession: string | null
  pendingCouncil: string | null
  versions: BuildVersion[]
  appRun: { status: string; service: string | null; label?: string; url: string | null; embedUrl?: string | null; port: number | null; error: string | null; logs: string[] }
  deploys: { target: string; ok: boolean | null; url: string | null; error: string | null; ts: number }[]
  recording: boolean
  liveRaw: string
  activity: Activity[]
  todos: Todo[]
  thinking: string
  lastEventTs: number
  liveFile: { path: string; content: string } | null
  selected: string | null
  cost: number
  fees: number  // per-use charges (deep analysis…) that are billed on top of the tokens
  feesDue: number  // of those, what is still unpaid (Stripe)
  tokens: number
  done: string
  error: string | null
  seq: number

  reset: (patch?: Partial<BuildState>) => void
  set: (patch: Partial<BuildState>) => void
  apply: (ev: Record<string, any>) => void
}

const empty = {
  id: null,
  sessionId: null,
  provider: null,
  model: null,
  engineSession: null,
  workdir: null,
  title: '',
  status: 'intro' as BuildStatus,
  files: {},
  chat: [],
  stages: [],
  liveTurn: null,
  livePhase: null,
  previewHtml: null,
  designHtml: null,
  designRounds: 0,
  team: [] as TeamMember[],
  reviews: [] as ReviewRound[],
  reviewPlan: null,
  liveReviews: {} as Record<string, string>,
  reviewRound: null,
  deploying: false,
  deployLogs: [] as string[],
  councilSession: null as string | null,
  pendingCouncil: null as string | null,
  versions: [] as BuildVersion[],
  appRun: { status: 'idle', service: null as string | null, url: null as string | null, port: null as number | null, error: null as string | null, logs: [] as string[] },
  deploys: [] as { target: string; ok: boolean | null; url: string | null; error: string | null; ts: number }[],
  reviewMode: 'review' as const,
  mode: 'build' as const,
  auditReport: null,
  pane: 'code' as const,
  paneOpen: false,
  fdePrefill: null as string | null,
  recording: false,
  liveRaw: '',
  activity: [] as Activity[],
  todos: [] as Todo[],
  thinking: '',
  lastEventTs: 0,
  liveFile: null,
  selected: null,
  cost: 0,
  fees: 0,
  feesDue: 0,
  tokens: 0,
  done: '',
  error: null,
  seq: -2,
}

/** Which file is being written right now, parsed from the live stream (last unclosed <file>). */
function liveFileFrom(raw: string): { path: string; content: string } | null {
  const open = raw.lastIndexOf('<file path="')
  if (open < 0) return null
  const close = raw.indexOf('</file>', open)
  if (close >= 0) return null
  const m = raw.slice(open).match(/^<file path="([^"\n]+)"\s*>\n?([\s\S]*)$/)
  return m ? { path: m[1], content: m[2] } : null
}

/** Set by App: reconnects the websocket when a finished build is resumed by a message. */
export let reconnectBuild: (id: string) => void = () => {}
export const setReconnectBuild = (fn: (id: string) => void) => {
  reconnectBuild = fn
}

export const useBuild = create<BuildState>((set, get) => ({
  ...empty,
  set: (patch) => set(patch),
  reset: (patch) => set({ ...empty, ...patch }),
  apply: (ev) => {
    const s = get()
    if (ev.type !== 'build.snapshot') set({ lastEventTs: Date.now() })
    if (typeof ev.seq === 'number' && ev.type !== 'token' && ev.type !== 'build.snapshot' && ev.type !== 'build.started') {
      if (ev.seq <= s.seq) return
      set({ seq: ev.seq })
    }
    switch (ev.type) {
      case 'build.snapshot':
      case 'build.started': {
        const b = ev.build
        set({
          id: b.id, sessionId: b.session_id, provider: b.provider, model: b.model, title: b.title,
          engineSession: b.engine_session ?? s.engineSession, workdir: b.workdir ?? s.workdir,
          activity: b.activity ?? s.activity, todos: b.todos ?? s.todos, versions: b.versions ?? s.versions, pendingCouncil: b.pending_council ?? null, designRounds: b.design_rounds ?? s.designRounds, designHtml: b.design_html ?? s.designHtml,
          appRun: b.app_run ? { status: b.app_run.status, service: b.app_run.service, label: b.app_run.label, url: b.app_run.url, embedUrl: b.app_run.embed_url ?? null, port: b.app_run.port, error: b.app_run.error, logs: b.app_run.logs ?? [] } : s.appRun,
          status: b.status === 'running' ? 'running' : b.status, files: { ...s.files, ...b.files }, chat: b.chat, stages: b.stages,
          cost: b.cost_usd, fees: (b as { fees_usd?: number }).fees_usd ?? 0, feesDue: (b as { fees_due_usd?: number }).fees_due_usd ?? 0, tokens: b.tokens, done: b.done, selected: s.selected ?? Object.keys(b.files)[0] ?? null,
          ...(b.live ? { liveTurn: b.live.turn, livePhase: b.live.phase, liveRaw: b.live.raw, liveFile: liveFileFrom(b.live.raw) } : {}),
          team: b.team ?? s.team, reviews: b.reviews ?? s.reviews, reviewPlan: b.review_plan ?? null,
          liveReviews: b.live_reviews ?? {}, reviewRound: b.status === 'reviewing' ? (b.reviews?.length ?? 0) + 1 : null,
          mode: b.mode ?? 'build', auditReport: b.audit_report ?? null, pane: b.audit_report && !s.auditReport ? 'report' : s.pane, deploys: b.deploys ?? s.deploys,
        })
        break
      }
      case 'turn.started':
        set({ liveTurn: ev.turn, livePhase: ev.phase ?? 'build', liveRaw: '', liveFile: null, activity: [], thinking: '', status: 'running', pane: ev.phase === 'preview' ? s.pane : 'code' })
        break
      case 'build.activity':
        set({ activity: [...s.activity.slice(-79), { kind: ev.kind, label: ev.label, path: ev.path ?? '', ts: ev.ts }], thinking: ev.kind === 'think' ? s.thinking : '' })
        break
      case 'build.thinking':
        set({ thinking: ev.text ?? '' })
        break
      case 'build.todos':
        set({ todos: ev.todos ?? [] })
        break
      case 'review.started':
        set({ status: 'reviewing', reviewRound: ev.round, reviewMode: ev.mode ?? 'review', liveReviews: {}, liveTurn: null, livePhase: null })
        break
      case 'review.token':
        set({ liveReviews: { ...s.liveReviews, [ev.agent_id]: (s.liveReviews[ev.agent_id] ?? '') + ev.delta } })
        break
      case 'review.completed': {
        const results = s.reviews.find((r) => r.round === ev.round)?.results ?? []
        const reviews = s.reviews.some((r) => r.round === ev.round) ? s.reviews.map((r) => (r.round === ev.round ? { ...r, approved: ev.approved } : r)) : [...s.reviews, { round: ev.round, approved: ev.approved, results, ts: ev.ts }]
        const audit = s.reviewMode === 'audit'
        set({ reviews, liveReviews: {}, reviewRound: null, status: ev.approved ? 'approved' : audit ? 'audited' : 'completed', chat: [...s.chat, { role: 'review', round: ev.round, approved: ev.approved, results, mode: s.reviewMode, ts: ev.ts }] })
        break
      }
      case 'review.result': {
        const existing = s.reviews.find((r) => r.round === ev.round)
        const res = { agent_id: ev.agent_id, name: ev.name, role: ev.role, role_label: ev.role_label, provider: ev.provider, model: ev.model, verdict: ev.verdict, reflexion: ev.reflexion, findings: ev.findings, requests: ev.requests, score: ev.score ?? null, strengths: ev.strengths ?? '' }
        const reviews = existing
          ? s.reviews.map((r) => (r.round === ev.round ? { ...r, results: [...r.results.filter((x) => x.agent_id !== ev.agent_id), res] } : r))
          : [...s.reviews, { round: ev.round, approved: false, results: [res], ts: ev.ts }]
        set({ reviews })
        break
      }
      case 'notice':
        set({ chat: [...s.chat, { role: 'system', text: ev.text, ts: ev.ts }] })
        break
      case 'build.version': {
        const { type: _t, seq: _s, ts, ...v } = ev
        set({ versions: [...s.versions.filter((x) => x.n !== v.n), { ...(v as BuildVersion), ts }] })
        break
      }
      case 'build.readiness':
        set({ versions: s.versions.map((v) => (v.n === ev.n ? { ...v, readiness: ev.readiness, resolved: ev.resolved ?? v.resolved, verdict: { ...(v.verdict ?? { headline: '', changes: 0 }), approved: !!ev.approved } } : v)), status: ev.approved ? 'approved' : s.status })
        break
      case 'build.team':
        set({ team: ev.team ?? s.team })
        break
      case 'build.council':
        set({ councilSession: ev.session_id, status: 'completed', liveTurn: null, livePhase: null })
        break
      case 'app.status':
        set({ appRun: { ...s.appRun, status: ev.status, service: ev.service, label: ev.label, url: ev.url ?? null, embedUrl: ev.embed_url ?? null, port: ev.port ?? null, error: ev.error ?? null, logs: ev.status === 'installing' ? [] : s.appRun.logs } })
        break
      case 'app.log':
        set({ appRun: { ...s.appRun, logs: [...s.appRun.logs.slice(-600), ev.line] } })
        break
      case 'deploy.started':
        set({ deploying: true, deployLogs: [] })
        break
      case 'deploy.log':
        set({ deployLogs: [...s.deployLogs.slice(-400), ev.line] })
        break
      case 'deploy.completed':
        set({ deploying: false, deploys: [...s.deploys, { target: ev.target, ok: ev.ok, url: ev.url, error: ev.error, ts: ev.ts }] })
        break
      case 'audit.report':
        set({ auditReport: ev.markdown, chat: [...s.chat, { role: 'report', text: ev.markdown, turn: ev.turn, ts: ev.ts }], pane: 'report', paneOpen: true, liveTurn: null, livePhase: null, liveRaw: '' })
        break
      case 'build.approved':
        set({ status: 'approved' })
        break
      case 'pass.completed':
        set({ status: ev.status, cost: ev.build.cost_usd, fees: (ev.build as { fees_usd?: number }).fees_usd ?? 0, feesDue: (ev.build as { fees_due_usd?: number }).fees_due_usd ?? 0, tokens: ev.build.tokens, done: ev.build.done, liveRaw: '', liveFile: null, liveTurn: null, livePhase: null })
        break
      case 'preview.ready':
        set({ previewHtml: ev.html, pane: 'preview' })
        break
      case 'design.ready':
        set({ designHtml: ev.html })
        break
      case 'design.review':
        // the designer finished: show the mockup and wait for the user's verdict before any code is written
        set({ designHtml: ev.html || s.designHtml, status: 'design_review', liveTurn: null, pane: 'design', paneOpen: true, lastEventTs: Date.now() })
        break
      case 'token': {
        if (s.liveTurn == null) set({ liveTurn: ev.turn, livePhase: s.livePhase ?? 'build' }) // turn.started was missed
        const raw = s.liveRaw + ev.delta
        const lf = liveFileFrom(raw)
        set({ liveRaw: raw, liveFile: lf, selected: lf ? lf.path : s.selected })
        break
      }
      case 'file.written':
        set({ files: { ...s.files, [ev.path]: { size: ev.size, lines: ev.lines, turn: ev.turn, content: s.files[ev.path]?.content } }, selected: ev.path })
        break
      case 'turn.completed':
        set({ chat: [...s.chat, { role: 'assistant', turn: ev.turn, say: ev.say, files: ev.files, stage: ev.stage, done: ev.done, phase: ev.phase, activity: ev.activity, ts: ev.ts }], liveRaw: '', liveFile: null, liveTurn: null, livePhase: null, stages: ev.stage ? [...s.stages, ev.stage] : s.stages, done: ev.done ?? s.done })
        break
      case 'user.message':
        if (!s.chat.some((c) => c.role === 'user' && c.text === ev.text && Math.abs(c.ts - ev.ts) < 2)) set({ chat: [...s.chat, { role: 'user', text: ev.text, ts: ev.ts }] })
        break
      case 'error':
        if (ev.error === 'build not found') {
          // the server lost this build (restart) and couldn't reload it: nothing is lost on disk, but the live view is over
          set({ error: 'El servidor se reinició y esta construcción no está en memoria. Lo escrito está guardado: volvé a la arena y abrila de nuevo para reanudarla.', status: s.status === 'running' || s.status === 'connecting' || s.status === 'reviewing' ? 'stopped' : s.status, liveTurn: null, livePhase: null })
          break
        }
        set({ error: ev.error })
        break
      case 'build.completed':
        set({ status: ev.status, cost: ev.build.cost_usd, fees: (ev.build as { fees_usd?: number }).fees_usd ?? 0, feesDue: (ev.build as { fees_due_usd?: number }).fees_due_usd ?? 0, tokens: ev.build.tokens, done: ev.build.done, liveRaw: '', liveFile: null, liveTurn: null, livePhase: null })
        break
    }
  },
}))
