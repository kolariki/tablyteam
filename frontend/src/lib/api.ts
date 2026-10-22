import type { AgentConfig, ArenaEvent, Preset, Provider, Role, SessionConfig, SessionSummary } from '../types'

const TOKEN_KEY = 'arena.token'
export const getToken = () => token
let token: string | null = null
try {
  token = localStorage.getItem(TOKEN_KEY)
} catch {
  /* storage blocked */
}
let onUnauthorized: () => void = () => {}

export const auth = {
  get token() {
    return token
  },
  set(t: string | null) {
    token = t
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t)
      else {
        localStorage.removeItem(TOKEN_KEY)
        for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('arena.cache.')) localStorage.removeItem(k) }
      }
    } catch {
      /* storage blocked: session lasts until reload */
    }
  },
  onUnauthorized(fn: () => void) {
    onUnauthorized = fn
  },
}

const authed = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, headers: { ...(init.headers ?? {}), ...(token ? { authorization: `Bearer ${token}` } : {}) } })

async function j<T>(res: Promise<Response>): Promise<T> {
  const r = await res
  if (r.status === 401 && token) {
    auth.set(null)
    onUnauthorized()
  }
  if (!r.ok) {
    let detail = r.statusText
    try {
      detail = (await r.json()).detail ?? detail
    } catch {
      /* not json */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return r.json()
}

export interface User {
  id: string
  email: string
  name: string
}

const post = (url: string, body: unknown) => authed(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  authConfig: () => j<{ allow_signup: boolean }>(fetch('/api/auth/config')),
  register: (email: string, password: string, name?: string) => j<{ token?: string; user: User; pending?: boolean; email?: string; dev_code?: string }>(post('/api/auth/register', { email, password, name })),
  verifyEmail: (email: string, code: string) => j<{ token: string; user: User }>(post('/api/auth/verify', { email, code })),
  resendCode: (email: string) => j<{ ok: boolean; dev_code?: string }>(post('/api/auth/resend', { email })),
  login: (email: string, password: string) => j<{ token: string; user: User }>(post('/api/auth/login', { email, password })),
  logout: () => j(post('/api/auth/logout', {})),
  me: () => j<{ user: User }>(authed('/api/auth/me')),
  health: () => j<{ ok: boolean; langfuse: boolean; langfuse_host: string | null; stripe?: StripeStatus }>(fetch('/api/health')),
  providers: () => j<Provider[]>(authed('/api/providers')),
  models: (p: string) => j<{ models: string[]; error?: string }>(authed(`/api/providers/${p}/models`)),
  roles: () => j<{ groups: string[]; roles: Role[] }>(authed('/api/roles')),
  fdePackages: () => j<{ packages: FdePackage[]; booking_url: string | null; stripe: StripeStatus }>(authed('/api/fde/packages')),
  checkout: (body: { kind: 'fde' | 'fees'; ref?: string; build_id?: string; session_id?: string; hours?: number }) => j<Order & { url: string }>(post('/api/billing/checkout', body)),
  confirmCheckout: (checkout: string) => j<Order>(post('/api/billing/confirm', { checkout })),
  orders: (buildId?: string | null) => j<Order[]>(authed(`/api/billing/orders${buildId ? `?build_id=${encodeURIComponent(buildId)}` : ''}`)),
  fdeRequests: (sessionId?: string | null) => j<FdeRequest[]>(authed(`/api/fde/requests${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''}`)),
  fdeCreate: (body: { session_id: string; build_id: string; package: string; notes: string; contact: string }) => j<FdeRequest>(post('/api/fde/requests', body)),
  fdeUpdate: (id: string, body: { status?: string; notes?: string }) => j<FdeRequest>(authed(`/api/fde/requests/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })),
  fdeTicket: async (id: string) => {
    const r = await authed(`/api/fde/requests/${id}/ticket.md`)
    if (!r.ok) throw new Error(await r.text())
    return r.text()
  },
  skills: () => j<{ skills: SkillSummary[]; templates: SkillSummary[] }>(authed('/api/skills')),
  skill: (id: string) => j<SkillSummary & { body: string }>(authed(`/api/skills/${id}`)),
  catalog: (q = '', category = '', limit = 80) => j<{ skills: CatalogSkill[]; categories: CatalogCategory[]; total: number; sync: CatalogSync }>(authed(`/api/skills/catalog?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&limit=${limit}`)),
  catalogSync: () => j<CatalogSync & { started: boolean }>(authed('/api/skills/catalog/sync', { method: 'POST' })),
  catalogSyncStatus: () => j<CatalogSync>(authed('/api/skills/catalog/sync')),
  catalogTranslate: (provider: string, model: string) => j<{ running: boolean; done: number; total: number; error: string | null; translated: number; total_skills: number }>(post('/api/skills/catalog/translate', { provider, model })),
  catalogTranslateStatus: () => j<{ running: boolean; done: number; total: number; error: string | null; translated: number; total_skills: number }>(authed('/api/skills/catalog/translate')),
  suggestSkills: (text: string, roles: { id: string; label: string; group?: string; mandate?: string }[], k = 4) => j<{ general: CatalogSkill[]; per_role: Record<string, CatalogSkill[]> }>(post('/api/skills/suggest', { text, roles, k })),
  saveSkill: (sk: { id?: string; name: string; body: string; description?: string; tags?: string }) => j<SkillSummary & { body: string }>(post('/api/skills', sk)),
  documentText: (file: File) => { const form = new FormData(); form.append('file', file, file.name); return j<{ text: string; chars: number; truncated: boolean; filename: string }>(authed('/api/documents/text', { method: 'POST', body: form })) },
  uploadSkill: (file: File, name = '') => { const form = new FormData(); form.append('file', file, file.name); form.append('name', name); return j<SkillSummary & { body: string; truncated: boolean; chars_total: number }>(authed('/api/skills/upload', { method: 'POST', body: form })) },
  deleteSkill: (id: string) => j(authed(`/api/skills/${id}`, { method: 'DELETE' })),
  setAgentSkills: (sessionId: string, agentId: string, skills: string[]) => j(authed(`/api/sessions/${sessionId}/agents/${agentId}/skills`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ skills }) })),
  setTeam: (buildId: string, sessionId: string | null, team: Partial<import('../buildStore').TeamMember>[]) => j<{ ok: boolean; team: import('../buildStore').TeamMember[] }>(authed(`/api/builds/${buildId}/team`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ team, session_id: sessionId }) })),
  setTeamSkills: (buildId: string, sessionId: string | null, agentId: string, skills: string[]) => j(authed(`/api/builds/${buildId}/team/${agentId}/skills`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ skills, session_id: sessionId }) })),
  presets: () => j<Preset[]>(authed('/api/presets?fallback=true')),
  savePreset: (cfg: SessionConfig, title: string) => j<Preset>(post('/api/presets', { ...cfg, title })),
  deletePreset: (id: string) => j(authed(`/api/presets/${id}`, { method: 'DELETE' })),
  sessions: () => j<SessionSummary[]>(authed('/api/sessions')),
  updateTeam: (sessionId: string, agents: AgentConfig[]) => j<{ agents: AgentConfig[] }>(authed(`/api/sessions/${sessionId}/team`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agents }) })),
  session: (id: string) => j<{ id: string; status: string; config?: SessionConfig; events: ArenaEvent[] }>(authed(`/api/sessions/${id}`)),
  start: (cfg: SessionConfig) => j<{ id: string }>(post('/api/sessions', cfg)),
  stop: (id: string) => j(post(`/api/sessions/${id}/stop`, {})),
  councilRedo: (id: string) => j<Record<string, unknown>>(post(`/api/sessions/${id}/council/redo`, {})),
  resumeSession: (id: string, action = 'retry') => j(post(`/api/sessions/${id}/resume`, { action })),
  updateAgent: (id: string, agentId: string, provider: string, model: string) =>
    j(authed(`/api/sessions/${id}/agents/${agentId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider, model }) })),
  estimate: (cfg: SessionConfig) => j<{ total_usd: number; per_agent: Record<string, number>; note: string }>(post('/api/sessions/estimate', cfg)),
  dashboard: () => j<DashboardData>(authed('/api/dashboard')),
  deleteSession: (id: string) => j(authed(`/api/sessions/${id}`, { method: 'DELETE' })),
  renameSession: (id: string, title: string) => j(authed(`/api/sessions/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title }) })),
  engines: () => j<EngineStatus[]>(authed('/api/engines')),
  buildDesignApprove: (id: string, session_id?: string | null) => j<{ ok: boolean }>(post(`/api/builds/${id}/design/approve`, { session_id })),
  designSummary: (sessionId: string, id: string, lang: string, refresh = false) => j<{ text: string | null; reason?: string; model?: string; ts?: number }>(authed(`/api/sessions/${sessionId}/builds/${id}/design/summary?lang=${lang}${refresh ? '&refresh=true' : ''}`)),
  designRequest: (id: string, text: string, session_id?: string | null) => j<{ ok: boolean; mode: 'redo' | 'queued' | 'resumed' }>(post(`/api/builds/${id}/design/request`, { text, session_id })),
  buildDesignRedo: (id: string, feedback: string, session_id?: string | null) => j<{ ok: boolean }>(post(`/api/builds/${id}/design/redo`, { feedback, session_id })),
  startBuild: (session_id: string, provider: string, model: string, target: string, review_rounds = 0, priorities = '', design = true, opts: { research?: boolean; references?: string[]; deep_analysis?: boolean } = {}) =>
    j<{ id: string }>(post('/api/builds', { session_id, provider, model, target, review_rounds, priorities, design, research: opts.research ?? false, references: opts.references ?? [], deep_analysis: opts.deep_analysis ?? false })),
  sceneStatus: (sessionId: string) => j<{ ready: boolean; pending: boolean; failed_recently: boolean }>(authed(`/api/sessions/${sessionId}/scene/status`)),
  sceneRegenerate: (sessionId: string) => j<{ ready: boolean; pending: boolean }>(authed(`/api/sessions/${sessionId}/scene/regenerate`, { method: 'POST' })),
  researchJobStart: (references: string[], brief: string, deep_analysis: boolean) => j<ResearchJob>(post('/api/research/jobs', { references, brief, deep_analysis })),
  researchJob: (id: string) => j<ResearchJob>(authed(`/api/research/jobs/${id}`)),
  researchStatus: () => j<{ chrome: string | null; rea: { ok: boolean; cli: string | null; registered: boolean; fee_usd: number }; deep_fee_usd: number; max_references: number }>(authed('/api/research/status')),
  buildCouncil: (id: string, session_id: string | null, max_rounds: number, priorities = '', references: string[] = [], deep_analysis = false, focus: 'production' | 'design' = 'production') => j<{ session_id: string | null; researching?: number }>(post(`/api/builds/${id}/council`, { session_id, max_rounds, priorities, references, deep_analysis, focus })),
  councilApply: (id: string, session_id: string | null, changes: { severity: string; role: string; text: string }[], max_rounds: number, council_session: string | null, priorities = '', references: string[] = [], deep_analysis = false, builder?: { provider: string; model: string }) =>
    j<{ ok: boolean; researching?: number }>(post(`/api/builds/${id}/council/apply`, { session_id, changes, max_rounds, council_session, priorities, references, deep_analysis, ...(builder ?? {}) })),
  buildReview: (id: string, session_id: string | null, max_rounds: number) => j(post(`/api/builds/${id}/review`, { session_id, max_rounds })),
  builds: (sessionId: string) => j<BuildSummary[]>(authed(`/api/sessions/${sessionId}/builds`)),
  build: (sessionId: string, id: string) => j<Record<string, any> & { file_contents?: Record<string, string> }>(authed(`/api/sessions/${sessionId}/builds/${id}`)),
  buildMessage: (id: string, text: string, session_id?: string | null) => j(post(`/api/builds/${id}/message`, { text, session_id })),
  buildStop: (id: string) => j(post(`/api/builds/${id}/stop`, {})),
  buildResume: (id: string, session_id: string | null) => j(post(`/api/builds/${id}/resume`, { session_id })),
  createAudit: (form: FormData) => j<{ id: string; session_id: string; files: number ; council?: string | null}>(authed('/api/audits', { method: 'POST', body: form })),
  buildApply: (id: string, session_id: string | null, requests: { role_label: string; name: string; text: string }[], max_rounds: number) =>
    j(post(`/api/builds/${id}/apply`, { session_id, requests, max_rounds })),
  services: (sessionId: string, id: string) => j<ServicesInfo>(authed(`/api/sessions/${sessionId}/builds/${id}/services`)),
  saveFile: (sessionId: string, id: string, path: string, content: string) =>
    j<{ ok: boolean; path: string; lines: number; size: number }>(authed(`/api/sessions/${sessionId}/builds/${id}/files`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path, content }) })),
  serviceGuide: (sessionId: string, id: string, service: string, lang: string, refresh = false) =>
    j<ServiceGuideData>(authed(`/api/sessions/${sessionId}/builds/${id}/services/guide?service=${encodeURIComponent(service)}&lang=${lang}${refresh ? '&refresh=true' : ''}`)),
  saveServices: (sessionId: string, id: string, values: Record<string, string>) =>
    j<{ ok: boolean; configured: string[] }>(authed(`/api/sessions/${sessionId}/builds/${id}/services`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ values }) })),
  envFile: async (sessionId: string, id: string) => {
    const r = await authed(`/api/sessions/${sessionId}/builds/${id}/env`)
    if (!r.ok) throw new Error(r.statusText)
    return r.text()
  },
  versions: (sessionId: string, id: string) => j<{ versions: import('../buildStore').BuildVersion[]; current: number; status: string }>(authed(`/api/sessions/${sessionId}/builds/${id}/versions`)),
  versionDiff: async (sessionId: string, id: string, n: number, path: string) => {
    const r = await authed(`/api/sessions/${sessionId}/builds/${id}/versions/${n}/diff?path=${encodeURIComponent(path)}`)
    if (!r.ok) throw new Error(await r.text())
    return r.text()
  },
  appRun: (sessionId: string, id: string) => j<{ services: RunService[]; run: AppRunState | null }>(authed(`/api/sessions/${sessionId}/builds/${id}/run`)),
  appStart: (sessionId: string, id: string, service: string) => j(post(`/api/sessions/${sessionId}/builds/${id}/run`, { service })),
  appStop: (sessionId: string, id: string) => j(authed(`/api/sessions/${sessionId}/builds/${id}/run`, { method: 'DELETE' })),
  agentSessions: (engine: 'claude' | 'codex') => j<AgentSessionList>(authed(`/api/agents/sessions?engine=${engine}`)),
  agentChat: (engine: 'claude' | 'codex', id: string, text: string) => post(`/api/agents/sessions/${engine}/${id}/message`, { text }),
  agentSession: (engine: 'claude' | 'codex', id: string) => j<AgentSessionDetail>(authed(`/api/agents/sessions/${engine}/${id}`)),
  devices: () => j<{ ios: { ok: boolean; hint: string | null; booted: string | null }; android: { ok: boolean; hint: string | null; booted: string | null } }>(authed('/api/devices')),
  runScreenUrl: (sessionId: string, id: string, target: 'ios' | 'android') => `/api/sessions/${sessionId}/builds/${id}/run/screen?target=${target}&token=${encodeURIComponent(getToken() ?? '')}&t=`,
  runTap: (sessionId: string, id: string, target: 'ios' | 'android', x: number, y: number) => j<{ ok: boolean }>(post(`/api/sessions/${sessionId}/builds/${id}/run/tap`, { target, x, y })),
  deploy: (sessionId: string, id: string, target: string) => j(post(`/api/sessions/${sessionId}/builds/${id}/deploy`, { target })),
  cloudStatus: () => j<CloudStatus & { github: { set: boolean; last4: string | null }; apps: CloudApp[] }>(authed('/api/cloud/status')),
  saveGithubToken: (token: string | null, clear = false) =>
    j<{ set: boolean; last4: string | null }>(authed('/api/settings/github', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, clear }) })),
  cloud: (sessionId: string, id: string) => j<CloudInfo>(authed(`/api/sessions/${sessionId}/builds/${id}/cloud`)),
  cloudPublish: (sessionId: string, id: string) => j(post(`/api/sessions/${sessionId}/builds/${id}/cloud/publish`, {})),
  cloudUnpublish: (sessionId: string, id: string) => j<{ ok: boolean; app: CloudApp | null }>(authed(`/api/sessions/${sessionId}/builds/${id}/cloud/publish`, { method: 'DELETE' })),
  cloudDb: (sessionId: string, id: string, provider: 'neon' | 'supabase') => j<{ ok: boolean; provider: string; host: string; vars: string[] }>(post(`/api/sessions/${sessionId}/builds/${id}/cloud/db`, { provider })),
  gitSync: (sessionId: string, id: string) => j<{ ok: boolean; head: string; committed: boolean; git: GitInfo }>(post(`/api/sessions/${sessionId}/builds/${id}/cloud/git/sync`, {})),
  gitGithub: (sessionId: string, id: string, name: string, priv: boolean) => j<{ ok: boolean; url: string }>(post(`/api/sessions/${sessionId}/builds/${id}/cloud/git/github`, { name, private: priv })),
  deploySettings: () => j<{ vercel: { set: boolean; last4: string | null }; railway: { set: boolean; last4: string | null }; status: DeployTarget[] }>(authed('/api/settings/deploy')),
  saveDeployToken: (target: string, token: string | null, clear = false) =>
    j<{ set: boolean; last4: string | null }>(authed(`/api/settings/deploy/${target}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, clear }) })),
  buildReport: async (sessionId: string, id: string) => {
    const r = await authed(`/api/sessions/${sessionId}/builds/${id}/report.md`)
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? r.statusText)
    return r.text()
  },
  buildZip: async (sessionId: string, id: string) => {
    const r = await authed(`/api/sessions/${sessionId}/builds/${id}/zip`)
    if (!r.ok) throw new Error(r.statusText)
    return r.blob()
  },
  settings: () => j<{ providers: ProviderSetting[]; share_server_keys: boolean }>(authed('/api/settings/providers')),
  saveProvider: (id: string, patch: { api_key?: string; clear_key?: boolean; default_model?: string; base_url?: string }) =>
    j<ProviderSetting>(authed(`/api/settings/providers/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })),
  testKey: (id: string, api_key?: string, base_url?: string) =>
    j<{ ok: boolean; models?: string[]; error?: string }>(post(`/api/settings/providers/${id}/test`, { api_key, base_url })),
  targets: () => j<{ id: string; label: string }[]>(fetch('/api/export/targets')),
  transcript: async (id: string) => {
    const r = await authed(`/api/sessions/${id}/transcript.md`)
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? r.statusText)
    return r.text()
  },
  /** Streams the build brief; calls onChunk with the accumulated text. */
  brief: async (id: string, req: BriefRequest, onChunk: (text: string) => void, signal?: AbortSignal) => {
    const r = await post(`/api/sessions/${id}/brief`, req)
    if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).detail ?? r.statusText)
    const reader = r.body.getReader()
    const dec = new TextDecoder()
    let text = ''
    for (;;) {
      if (signal?.aborted) {
        reader.cancel()
        break
      }
      const { done, value } = await reader.read()
      if (done) break
      text += dec.decode(value, { stream: true })
      onChunk(text)
    }
    return text
  },
}

export interface EngineStatus {
  id: string
  label: string
  logo: string
  color: string
  installed: boolean
  version: string | null
  auth: string | null
  ok: boolean
  hint: string | null
}

export interface ServiceVar {
  var: string
  service: string
  purpose: string | null
  url: string | null
  cost: string | null
  example: string
  note: string | null
  public: boolean
  required: boolean
  secret: boolean
  configured: boolean
}

export interface CloudStatus {
  static: 'local' | 'cloudflare'
  server: 'fly' | null
  database: 'neon' | null
  auth: 'supabase' | null
  missing: Record<'cloudflare' | 'fly' | 'neon' | 'supabase', string | null>
  public_url: string
}
export interface CloudDb { provider: string; ok: boolean; vars: string[]; host: string | null; ts: number }
export interface CloudApp {
  build_id: string
  slug: string
  provider: 'local' | 'cloudflare' | 'fly' | string
  kind: 'static' | 'server' | 'unknown' | string
  status: 'building' | 'live' | 'error' | 'down' | string
  url: string | null
  version: number | null
  error: string | null
  log: string[]
  db: Partial<Record<'database' | 'auth', CloudDb>>
  created: number
  updated: number
}
export interface GitInfo {
  exists: boolean
  clone_url: string
  head: string | null
  commits: { hash: string; ts: number; message: string; refs: string[] }[]
  tags: string[]
}
export interface CloudInfo {
  app: CloudApp | null
  git: GitInfo
  migration: { has_database: boolean; database_url_masked: string | null; pg_dump: string | null; pg_restore: string | null; env_vars: string[] }
  status: CloudStatus
  github: { set: boolean; last4: string | null }
  publishing: boolean
  version: number
}
export interface AgentSessionSummary {
  id: string
  engine: 'claude' | 'codex'
  title: string
  first_prompt: string | null
  cwd: string | null
  branch: string | null
  model: string | null
  created: number
  updated: number
  size: number
  live: boolean
}
export interface AgentSessionList {
  engine: 'claude' | 'codex'
  available: boolean
  count: number
  projects: { key: string; name: string; path: string | null; updated: number; sessions: AgentSessionSummary[] }[]
}
export interface AgentPart { type: 'text' | 'thinking' | 'tool'; text?: string; name?: string; summary?: string; input?: string; result?: string | null; is_error?: boolean }
export interface AgentSessionDetail extends AgentSessionSummary {
  items: { role: 'user' | 'assistant'; ts: number | null; parts: AgentPart[] }[]
  meta: { cwd: string | null; branch: string | null; model: string | null; version: string | null }
  usage: { input: number; output: number; cache_read: number; cache_write: number }
  truncated: boolean
  resume: string
  file: string
}
export interface DeployTarget {
  id: string
  label: string
  installed: boolean
  token: boolean
  logged_in: boolean
  ok: boolean
  good_for: string
  token_help: string
  hint: string | null
}

export interface ServiceGuideData {
  intro: string
  cost: string | null
  steps: { title: string; detail: string; url: string | null }[]
  generated: boolean
  model?: string
}

export interface ServicesInfo {
  items: ServiceVar[]
  groups: { service: string; url: string | null; purpose: string | null; vars: ServiceVar[] }[]
  missing: string[]
  stack: string[]
  recommended_target: string
  deploy_targets: DeployTarget[]
}

export interface DashboardSession extends SessionSummary {
  builds: BuildSummary[]
  councils?: { id: string; round: number | null; version: number | null; build_id: string | null; status: string; cost_usd: number; created: number; live: boolean }[]
  council_cost_usd?: number
  cost_usd?: number
  turns?: number
  has_brief?: boolean
  title?: string | null
}

export interface DashboardData {
  sessions: DashboardSession[]
  spend: { total_usd: number; month_usd: number; month: string }
  active_jobs: number
  max_jobs: number
  setup: { api_keys: number; engines: { id: string; label: string; auth: string | null }[]; langfuse: boolean; sessions: number }
}

export interface RunService {
  id: string
  dir: string
  label: string
  kind: string
  web: boolean
  device?: 'ios' | 'android'  // Expo: runs on the iOS Simulator / Android emulator (the panel shows the device screen)
  available?: boolean  // that device can run on this machine
  hint?: string | null  // what is missing when it cannot
  install: string
  run: string
  needs_install: boolean
}

export interface AppRunState {
  status: string
  service: string
  label?: string
  url: string | null
  embed_url?: string | null
  port: number
  error: string | null
  logs?: string[]
}

export interface ResearchJob {
  id: string
  refs: string[]
  deep: boolean
  status: 'running' | 'done' | 'error'
  visited: { name?: string; url?: string | null; ok?: boolean; error?: string | null }[]
  activity: { kind: string; label: string; path: string; ts: number }[]
  md: string
  error: string | null
  model?: string
}

export interface StripeStatus { enabled: boolean; mode: 'test' | 'live' | 'off'; webhook: boolean; app_url: string }

export interface Order {
  id: string
  user_id: string
  kind: 'fde' | 'fees'
  ref: string
  build_id: string
  session_id: string
  name: string
  amount_usd: number
  status: 'pending' | 'paid' | 'expired' | 'cancelled'
  stripe_session: string
  created: number
  paid_at: number | null
}

export interface FdePackage {
  id: string
  name: string
  price_usd: number
  eta: string
  badge: string | null
  tagline: string
  includes: string[]
  excludes: string[]
  needs: string[]
  checkout_url?: string | null
  booking_url?: string | null
}

export interface FdeRequest {
  id: string
  session_id: string
  build_id: string
  package: string
  status: string
  notes: string
  contact: string
  created: number
  updated: number
  checkout_url?: string | null
  booking_url?: string | null
  ticket: {
    project: { title: string; session_id: string; build_id: string; files: number; workdir: string | null; version: string | null; commit: string | null; readiness: number | null; status: string }
    brief_summary: string
    stack: { id: string; label: string; run: string }[]
    blockers: { severity: string; text: string; role: string }[]
    services: { service: string; purpose: string; vars: string[]; configured: boolean }[]
    missing_vars: string[]
    deploys: { target: string; ok: boolean | null; url: string | null }[]
    notes: string
    contact: string
  }
}

export interface SkillSummary {
  id: string
  name: string
  description: string
  tags: string
  chars: number
  updated?: number
  name_en?: string
  description_en?: string
}

export interface CatalogSkill {
  id: string
  name: string
  slug: string
  description: string
  category: string
  source: string
  repo: string
  path: string
  url: string
  section: string
  chars: number
  score?: number
  name_es?: string
  description_es?: string
}
export interface CatalogCategory { id: string; label: string; label_en?: string; count: number }
export interface CatalogSync { running: boolean; step: string; done: number; total: number; repos: number; skills: number; errors: string[]; finished: number | null; total_skills?: number }

export interface BuildSummary {
  id: string
  provider: string
  model: string
  status: string
  fees_usd?: number  // per-use charges (deep analysis) on top of tokens
  fees_due_usd?: number  // the part of those not paid yet
  turns: number
  cost_usd: number
  build_seconds?: number  // wall-clock of all its turns
  files: number
  stages?: number
  engine_session?: string | null
  workdir?: string | null
  version?: number
  readiness?: number | null
  pending_council?: string | null
}

export interface ProviderSetting {
  id: string
  label: string
  color: string
  kind: string
  key_env: string | null
  source: 'user' | 'server' | 'none'
  user_key_last4: string | null
  server_key: boolean
  default_model: string
  base_url: string | null
  configured: boolean
}

export interface BriefRequest {
  provider: string
  model: string
  target: string
  include_transcript: boolean
  regenerate: boolean
  user_notes?: string
}

export function connect(id: string, onEvent: (e: ArenaEvent) => void, onClose: () => void): () => void {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/ws/sessions/${id}?token=${encodeURIComponent(token ?? '')}`)
  ws.onmessage = (m) => onEvent(JSON.parse(m.data))
  ws.onclose = onClose
  return () => ws.close()
}

export interface IntakeAttachment { id: string; name: string; size: number; kind: 'text' | 'binary' | 'skipped'; chars: number; origin: string }
export interface IntakeQuestion { id: string; question: string; why: string; options: string[]; answer: string | null }
export interface IntakeState {
  id: string
  status: 'idle' | 'running' | 'waiting' | 'done' | 'error'
  step: string
  text: string
  provider: string
  model: string
  attachments: IntakeAttachment[]
  questions: IntakeQuestion[]
  understanding: string
  prompt: string
  error: string | null
  cost_usd: number
  rounds: number
  events: Record<string, any>[]
  context_chars: number
  context?: string | null
}

/** Intake: idea + attachments → prompt-engineered brief (see backend/app/intake.py). */
export const intake = {
  create: () => j<IntakeState>(authed('/api/intake', { method: 'POST' })),
  get: (id: string) => j<IntakeState>(authed(`/api/intake/${id}`)),
  upload: (id: string, files: File[], paths: string[]) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f, f.name))
    form.append('paths', JSON.stringify(paths))
    return j<IntakeState & { added: number }>(authed(`/api/intake/${id}/files`, { method: 'POST', body: form }))
  },
  pick: (id: string, kind: 'folder' | 'files') => j<IntakeState & { added: number; cancelled: boolean; errors?: string[] }>(post(`/api/intake/${id}/pick`, { kind })),
  addPath: (id: string, path: string) => j<IntakeState & { added: number }>(post(`/api/intake/${id}/path`, { path })),
  remove: (id: string, attId: string) => j<IntakeState>(authed(`/api/intake/${id}/files/${attId}`, { method: 'DELETE' })),
  run: (id: string, text: string, provider: string, model: string, extra = '') => j<IntakeState>(post(`/api/intake/${id}/run`, { text, provider, model, extra })),
  rolePrompts: (id: string, agents: { id: string; name: string; role?: string | null; label?: string; mandate?: string; persona?: string }[], provider: string, model: string) => j<{ prompts: Record<string, string>; cost_usd: number }>(post(`/api/intake/${id}/role-prompts`, { agents, provider, model })),
  answer: (id: string, answers: Record<string, string>) => j<IntakeState>(post(`/api/intake/${id}/answer`, { answers })),
  cancel: (id: string) => j<IntakeState>(authed(`/api/intake/${id}/cancel`, { method: 'POST' })),
  connect: (id: string, onEvent: (e: Record<string, any>) => void, onClose: () => void): (() => void) => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws/intake/${id}?token=${encodeURIComponent(token ?? '')}`)
    ws.onmessage = (m) => onEvent(JSON.parse(m.data))
    ws.onclose = onClose
    return () => ws.close()
  },
}

export function connectBuild(id: string, onEvent: (e: Record<string, any>) => void, onClose: () => void, sessionId?: string | null): () => void {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/ws/builds/${id}?token=${encodeURIComponent(token ?? '')}${sessionId ? `&session=${encodeURIComponent(sessionId)}` : ''}`)
  ws.onmessage = (m) => onEvent(JSON.parse(m.data))
  ws.onclose = onClose
  return () => ws.close()
}

/** Re-emits a saved event log with its original timing, scaled by `speed`. */
export function replay(events: ArenaEvent[], speed: () => number, onEvent: (e: ArenaEvent) => void, onDone: () => void): () => void {
  let i = 0
  let cancelled = false
  let timer: number | undefined
  const step = () => {
    if (cancelled) return
    if (i >= events.length) return onDone()
    const ev = events[i++]
    onEvent(ev)
    const next = events[i]
    if (!next) return onDone()
    const gap = Math.min(4000, (next.ts - ev.ts) * 1000) / speed()
    timer = window.setTimeout(step, Math.max(0, gap))
  }
  step()
  return () => {
    cancelled = true
    window.clearTimeout(timer)
  }
}
