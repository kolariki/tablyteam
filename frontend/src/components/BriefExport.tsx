import DOMPurify from 'dompurify'
import { motion } from 'framer-motion'
import { BadgeCheck, Check, Copy, Download, FileText, Hammer, Loader2, RefreshCw, Rocket, X } from 'lucide-react'
import { marked } from 'marked'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type BuildSummary, type EngineStatus } from '../lib/api'
import { GLYPH } from '../lib/brand'
import { downloadBlob, slug } from '../lib/recorder'
import { useArena } from '../store'
import type { Provider } from '../types'
import ModelSelect from './ModelSelect'
import ProviderLogo from './ProviderLogo'
import { toast } from './Toast'
import { tr, useT } from '../lib/i18n'

const TARGET_HINT: Record<string, [string, string]> = {
  'claude-code': ['Pide BRIEF.md + CLAUDE.md y construir por etapas verificando cada una.', 'Asks for BRIEF.md + CLAUDE.md and to build in stages, verifying each one.'],
  cursor: ['Pide BRIEF.md + reglas en .cursor/rules y commits chicos.', 'Asks for BRIEF.md + rules in .cursor/rules and small commits.'],
  chat: ['Para pegar en ChatGPT / Claude.ai / Gemini: plan primero, luego archivo por archivo.', 'To paste into ChatGPT / Claude.ai / Gemini: plan first, then file by file.'],
  generic: ['Agnóstico: cualquier agente de código puede seguirlo.', 'Agnostic: any coding agent can follow it.'],
}

/** The ```text block under section 10 — the part you paste into the builder agent. */
function extractPrompt(md: string): string | null {
  const body = md.split('<details>')[0]
  const i = body.search(/\n##\s*\d+\.?\s*Prompt para el agente/i)
  const sec = i >= 0 ? body.slice(i) : body
  const m = sec.match(/```(?:text|txt|markdown|md)?\n([\s\S]*?)```/)
  return m ? m[1].trim() : null
}

const isEngineProvider = (id: string) => id === 'claude-code' || id === 'codex'

export default function BriefExport({ onClose, onBuild, onOpenBuild }: { onClose: () => void; onBuild: (provider: string, model: string, target: string, record: boolean, reviewRounds: number, priorities?: string, design?: boolean, research?: { research?: boolean; references?: string[]; deep_analysis?: boolean }) => Promise<void>; onOpenBuild: (id: string) => void }) {
  const T = useT()
  const sessionId = useArena((s) => s.sessionId)!
  const config = useArena((s) => s.config)
  const [providers, setProviders] = useState<Provider[]>([])
  const [targets, setTargets] = useState<{ id: string; label: string }[]>([])
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [target, setTarget] = useState('claude-code')
  const [includeTranscript, setIncludeTranscript] = useState(true)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [bProvider, setBProvider] = useState('')
  const [bModel, setBModel] = useState('')
  const [building, setBuilding] = useState(false)
  const [recordBuild, setRecordBuild] = useState(false)
  const [reviewRounds, setReviewRounds] = useState(3)
  const [autoReview, setAutoReview] = useState(true)
  const [priorities, setPriorities] = useState('')
  const [designFirst, setDesignFirst] = useState(true)
  // level 1: the team studies reference apps before designing; level 2: REA reverse-engineering, paid per use
  const [research, setResearch] = useState(true)
  const [refs, setRefs] = useState<string[]>(() => (useArena.getState().config?.references ?? []).filter(Boolean))
  const [refInput, setRefInput] = useState('')
  const [deep, setDeep] = useState(false)
  const [rstatus, setRstatus] = useState<{ chrome: string | null; rea: { ok: boolean; fee_usd: number }; deep_fee_usd: number; max_references: number } | null>(null)
  useEffect(() => { api.researchStatus().then((st) => { setRstatus(st); if (st.rea.ok && useArena.getState().config?.deep_analysis) setDeep(true) }).catch(() => {}) }, [])
  const addRef = () => {
    const parts = refInput.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)
    if (!parts.length) return
    setRefs((r) => [...new Set([...r, ...parts])].slice(0, rstatus?.max_references ?? 6))
    setRefInput('')
  }
  const [builds, setBuilds] = useState<BuildSummary[]>([])
  const [engines, setEngines] = useState<EngineStatus[]>([])
  const [waitingLogin, setWaitingLogin] = useState(false)
  const [startFresh, setStartFresh] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const preview = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.targets().then(setTargets).catch(() => {})
    api.providers().catch(() => {
      setError(tr('No se puede conectar con el backend (localhost:8000). Levantalo con `make dev` (o `make backend`) y volvé a abrir este panel.', 'Cannot reach the backend (localhost:8000). Start it with `make dev` (or `make backend`) and reopen this panel.'))
      return [] as Provider[]
    }).then((ps) => {
      setProviders(ps)
      const p = ps.find((x) => x.configured && x.id !== 'mock') ?? ps.find((x) => x.id === 'mock')
      if (p) {
        setProvider(p.id)
        setModel(p.default_model)
        setBProvider(p.id)
        setBModel(p.default_model)
      }
    })
    api.builds(sessionId).then(setBuilds).catch(() => {})
    api.engines().then((es) => {
      setEngines(es)
      const ok = es.find((e) => e.ok)
      if (ok) {
        setBProvider(ok.id)
        setBModel('default')
      }
    }).catch(() => {})
    return () => abort.current?.abort()
  }, [])

  // "Ya me logueé": poll the local agents until one is connected (max 3 min) and switch the builder to it.
  useEffect(() => {
    if (!waitingLogin) return
    const started = Date.now()
    const tick = async () => {
      const es = await api.engines().catch(() => null)
      if (!es) return
      setEngines(es)
      const ok = es.find((e) => e.ok)
      if (ok) {
        setWaitingLogin(false)
        setBProvider(ok.id)
        setBModel('default')
        toast.ok(`${ok.label.split(' · ')[0]} ${tr('conectado', 'connected')}`, tr('El constructor ahora usa tu plan, sin gastar API.', 'The builder now uses your plan, without spending API credits.'))
      } else if (Date.now() - started > 180_000) setWaitingLogin(false)
    }
    tick()
    const id = setInterval(tick, 4000)
    return () => clearInterval(id)
  }, [waitingLogin])

  useEffect(() => {
    if (busy && preview.current) preview.current.scrollTop = preview.current.scrollHeight
  }, [text, busy])

  const configured = providers.filter((p) => p.configured && (p.id !== 'mock' || providers.filter((x) => x.configured).length === 1))
  // the file starts with an HTML comment header that renders as nothing: hide it in the preview
  const visible = useMemo(() => text.replace(/^\s*<!--[\s\S]*?-->\s*/, ''), [text])
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(visible, { async: false }) as string), [visible])
  const TOTAL_SECTIONS = 17
  const sectionsDone = useMemo(() => (visible.match(/\n##\s+\d+\./g) ?? []).length, [visible])
  const progress = busy ? Math.min(96, Math.round((sectionsDone / TOTAL_SECTIONS) * 100)) : text ? 100 : 0
  const turnsCount = useArena((s) => s.turns.length)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!busy) return
    setElapsed(0)
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(id)
  }, [busy])
  const steps = [T('Leyendo la transcripción', 'Reading the transcript'), T('Rescatando las decisiones del equipo', 'Recovering the team decisions'), T('Resolviendo desacuerdos', 'Resolving disagreements'), T('Escribiendo la especificación', 'Writing the specification')]
  const stepIdx = Math.min(steps.length - 1, Math.floor(elapsed / 6))
  const prompt = useMemo(() => extractPrompt(text), [text])
  const base = `tablyteam-${slug(config?.title || config?.topic || sessionId)}`

  const generate = async (regenerate: boolean) => {
    setError(null)
    setBusy(true)
    setText('')
    abort.current = new AbortController()
    try {
      await api.brief(sessionId, { provider, model, target, include_transcript: includeTranscript, regenerate, user_notes: useArena.getState().decisionNotes || undefined }, setText, abort.current.signal)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const copy = async (what: 'all' | 'prompt') => {
    try {
      await navigator.clipboard.writeText(what === 'all' ? text : (prompt ?? ''))
      setCopied(what)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setError(tr('No se pudo copiar al portapapeles', 'Could not copy to the clipboard'))
    }
  }

  const downloadTranscript = async () => {
    try {
      const md = await api.transcript(sessionId)
      downloadBlob(new Blob([md], { type: 'text/markdown' }), `${base}-transcripcion.md`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const btn = 'flex items-center gap-1.5 rounded-lg border border-line bg-surface hover:bg-surface-2 px-3 py-2 text-sm transition disabled:opacity-40'

  return (
    <div className="fixed inset-0 z-[60] bg-paper/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="panel rounded-3xl w-full max-w-6xl h-[88vh] flex flex-col md:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* -------- options */}
        <div className="md:w-[340px] shrink-0 border-b md:border-b-0 md:border-r border-line p-6 overflow-y-auto scroll-thin">
          <div className="flex items-start">
            <div>
              <div className="text-xs uppercase tracking-widest text-ink-3">{T('Exportar', 'Export')}</div>
              <h3 className="serif text-3xl mt-1 leading-tight">{T('Brief para construir', 'Brief to build')}</h3>
            </div>
            <button className="ml-auto text-ink-3 hover:text-ink md:hidden" onClick={onClose}><X size={18} /></button>
          </div>
          <p className="mt-2 text-[13px] text-ink-2 leading-relaxed">{T('Un modelo convierte el debate en una especificación y un prompt listo para pegar en el agente que va a construir el proyecto.', 'A model turns the debate into a specification and a prompt ready to paste into the agent that will build the project.')}</p>

          <div className="mt-5 text-xs uppercase tracking-widest text-ink-3">{T('Lo escribe', 'Written by')}</div>
          <select
            className="mt-1.5 w-full rounded-lg bg-surface border border-line px-3 py-2 text-sm"
            value={provider}
            onChange={(e) => {
              const p = providers.find((x) => x.id === e.target.value)!
              setProvider(p.id)
              setModel(p.default_model)
            }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.configured}>
                {GLYPH[p.id]} {p.label}{p.configured ? '' : T(' (sin key)', ' (no key)')}
              </option>
            ))}
          </select>
          <div className="mt-2"><ModelSelect provider={provider} value={model} onChange={setModel} /></div>

          <div className="mt-5 text-xs uppercase tracking-widest text-ink-3">{T('Para construir con', 'To build with')}</div>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {targets.map((t) => (
              <button key={t.id} onClick={() => setTarget(t.id)} className={`rounded-xl border px-3 py-2 text-left text-sm transition ${target === t.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-ink-3">{TARGET_HINT[target] ? T(...TARGET_HINT[target]) : null}</p>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-accent w-4 h-4" checked={includeTranscript} onChange={(e) => setIncludeTranscript(e.target.checked)} />
            {T('Anexar la transcripción del debate', 'Attach the debate transcript')}
          </label>

          <button disabled={busy || !model} onClick={() => generate(false)} className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-accent text-white py-3 font-semibold hover:brightness-110 transition disabled:opacity-50">
            <Hammer size={17} /> {busy ? T('Escribiendo…', 'Writing…') : T('Generar brief', 'Generate brief')}
          </button>
          {text && !busy && (
            <button onClick={() => generate(true)} className="mt-2 w-full flex items-center justify-center gap-2 text-sm text-ink-3 hover:text-ink">
              <RefreshCw size={13} /> {T('regenerar con este modelo', 'regenerate with this model')}
            </button>
          )}
          <p className="mt-2 text-[11.5px] text-ink-4">{T('Si ya existe un brief para este destino, se reutiliza sin gastar tokens.', 'If a brief already exists for this target, it is reused without spending tokens.')}</p>

          <div className="mt-6 pt-5 border-t border-line">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-3"><Rocket size={13} className="text-accent" /> {T('Construir en la app', 'Build in the app')}</div>
            <p className="mt-1.5 text-[12.5px] text-ink-2 leading-snug">{T('El modelo constructor lee el brief y escribe el proyecto archivo por archivo, acá adentro. Al final lo descargás como .zip.', 'The builder model reads the brief and writes the project file by file, right here. At the end you download it as a .zip.')}</p>
            <select
              className="mt-2 w-full rounded-lg bg-surface border border-line px-3 py-2 text-sm"
              value={bProvider}
              onChange={(e) => {
                const id = e.target.value
                const eng = engines.find((x) => x.id === id)
                if (eng) {
                  setBProvider(id)
                  setBModel('default')
                  return
                }
                const p = providers.find((x) => x.id === id)!
                setBProvider(p.id)
                setBModel(p.default_model)
              }}
            >
              {engines.length > 0 && (
                <optgroup label={T('Sin API · agentes locales con tu suscripción', 'No API · local agents with your subscription')}>
                  {engines.map((e) => <option key={e.id} value={e.id} disabled={!e.ok}>{e.label}{e.ok ? '' : ` (${e.installed ? T('sin login', 'not logged in') : T('no instalado', 'not installed')})`}</option>)}
                </optgroup>
              )}
              <optgroup label={T('Por API (factura por tokens)', 'Via API (billed per token)')}>
                {configured.map((p) => <option key={p.id} value={p.id}>{GLYPH[p.id]} {p.label}</option>)}
              </optgroup>
            </select>
            {engines.find((e) => e.id === bProvider) ? (
              <div className="mt-2 rounded-lg bg-accent-soft/60 border border-accent/20 px-3 py-2 text-[12px] text-ink-2">
                {(() => {
                  const e = engines.find((x) => x.id === bProvider)!
                  return <>{T('Corre', 'Runs')} <b>{e.label.split(' · ')[0]}</b> {e.version ? `(${e.version})` : ''} {T('en esta máquina, con su propio login', 'on this machine, with its own login')}{e.auth ? ` — ${e.auth}` : ''}. {T('Escribe el proyecto en una carpeta real y puede correr comandos; el consejo de revisión también usa este motor.', 'It writes the project to a real folder and can run commands; the review council also uses this engine.')} {e.hint && <span className="text-gold">{e.hint}</span>}</>
                })()}
              </div>
            ) : (
              <div className="mt-2"><ModelSelect provider={bProvider} value={bModel} onChange={setBModel} /></div>
            )}
            {!engines.find((e) => e.id === bProvider) && (() => {
              const ready = engines.filter((e) => e.ok)
              const primary = engines.find((e) => e.id === 'claude-code') ?? engines[0]
              if (ready.length > 0) {
                // the plan is connected but an API model is selected → one click to switch
                return (
                  <div className="mt-2 rounded-xl border border-ok/40 bg-ok/5 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-[12.5px]"><BadgeCheck size={15} className="text-ok shrink-0" /> <span>{T('Tenés', 'You have')} <b>{ready.map((e) => e.label.split(' · ')[0]).join(T(' y ', ' and '))}</b> {T('conectado: podés construir con tu plan pago, sin gastar API.', 'connected: you can build with your paid plan, without spending API credits.')}</span></div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ready.map((e) => (
                        <button key={e.id} onClick={() => { setBProvider(e.id); setBModel('default') }} className="flex items-center gap-1.5 rounded-lg bg-accent text-white px-3 py-1.5 text-[12.5px] font-semibold hover:brightness-110">
                          <ProviderLogo provider={e.logo} size={14} /> {T('Usar mi plan', 'Use my plan')} · {e.label.split(' · ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              }
              if (!primary) return null
              return (
                <div className="mt-2 rounded-xl border border-accent/30 bg-accent-soft/50 px-3 py-2.5">
                  <div className="text-[12.5px]"><b>{T('¿Pagás Claude Pro/Max o ChatGPT?', 'Paying for Claude Pro/Max or ChatGPT?')}</b> {T('Podés construir con ese plan en vez de API: la app usa el agente oficial instalado en tu máquina.', 'You can build with that plan instead of the API: the app uses the official agent installed on your machine.')}</div>
                  <ol className="mt-2 space-y-1.5 text-[12px] text-ink-2">
                    {!primary.installed && <li>1. {T('Instalá:', 'Install:')} <code className="font-mono bg-surface rounded px-1">npm install -g @anthropic-ai/claude-code</code></li>}
                    <li>{primary.installed ? '1' : '2'}. {T('En tu terminal:', 'In your terminal:')} <button onClick={() => { navigator.clipboard?.writeText('claude auth login'); toast.ok(tr('Copiado', 'Copied'), 'claude auth login') }} className="font-mono bg-[#1E2622] text-[#E6ECE8] rounded px-1.5 py-0.5 hover:brightness-110" title={T('copiar', 'copy')}>$ claude auth login <Copy size={10} className="inline opacity-60" /></button> {T('y entrá con tu cuenta de claude.ai.', 'and sign in with your claude.ai account.')}</li>
                    <li>{primary.installed ? '2' : '3'}. {T('Volvé acá: lo detectamos solos.', 'Come back here: we detect it on our own.')}</li>
                  </ol>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button onClick={() => setWaitingLogin(true)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${waitingLogin ? 'bg-surface border border-accent/40 text-accent' : 'bg-accent text-white hover:brightness-110'}`}>
                      {waitingLogin ? <><Loader2 size={13} className="animate-spin" /> {T('Esperando tu login…', 'Waiting for your login…')}</> : T('Ya me logueé, usar mi plan', 'I logged in, use my plan')}
                    </button>
                    <button onClick={() => useArena.getState().set({ showBriefExport: false, view: 'settings' })} className="text-[12px] text-accent hover:underline">{T('Ver todas las opciones (Codex, estado) →', 'See all options (Codex, status) →')}</button>
                  </div>
                </div>
              )
            })()}
            {/* level 1: benchmark of reference apps (headless Chrome + vision model) → research/REFERENCES.md for the designer and the builder */}
            <label className="mt-2 flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" className="accent-accent w-4 h-4" checked={research} onChange={(e) => setResearch(e.target.checked)} />
              {T('Investigar apps de referencia', 'Research reference apps')} <span className="text-ink-4">{T('(el equipo entra a apps similares, saca capturas y anota qué emular y qué evitar antes de diseñar)', '(the team visits similar apps, takes screenshots and notes what to emulate and avoid before designing)')}</span>
            </label>
            {research && (
              <div className="ml-6 mt-1.5 rounded-lg border border-line bg-surface p-2">
                <div className="flex flex-wrap gap-1.5">
                  {refs.map((r) => (
                    <span key={r} className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] text-accent">
                      {r}
                      <button type="button" onClick={() => setRefs((x) => x.filter((y) => y !== r))} className="text-accent/70 hover:text-danger" title={T('Quitar', 'Remove')}><X size={11} /></button>
                    </span>
                  ))}
                  <input
                    value={refInput}
                    onChange={(e) => setRefInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addRef() } }}
                    onBlur={addRef}
                    placeholder={refs.length ? T('otra app o URL…', 'another app or URL…') : T('apps o URLs de referencia (Enter para agregar); vacío: el equipo las propone', 'reference apps or URLs (Enter to add); empty: the team proposes them')}
                    className="min-w-[220px] flex-1 bg-transparent text-[12px] outline-none placeholder:text-ink-4"
                  />
                </div>
                <div className="mt-1 text-[11px] text-ink-4">
                  {rstatus && !rstatus.chrome ? T('Sin Chrome para sacar capturas: se analiza solo el texto de cada sitio.', 'No Chrome for screenshots: only each site\'s text is analysed.') : T('Se observan productos públicos, nada se copia. Resultado: research/REFERENCES.md.', 'Public products are observed, nothing is copied. Output: research/REFERENCES.md.')}
                </div>
              </div>
            )}
            {/* level 2: paid per use; needs REA installed and a local engine as builder */}
            <label className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] ${!rstatus?.rea.ok || !isEngineProvider(bProvider) ? 'opacity-60' : ''}`}>
              <input type="checkbox" className="accent-accent w-4 h-4" checked={deep} disabled={!rstatus?.rea.ok || !isEngineProvider(bProvider)} onChange={(e) => { setDeep(e.target.checked); if (e.target.checked) setResearch(true) }} />
              {T('Análisis profundo e ingeniería inversa', 'Deep analysis and reverse engineering')}
              <span className="rounded-full border border-gold/50 bg-gold/10 px-2 py-[1px] text-[10.5px] font-semibold text-gold">{T('pago por uso', 'pay per use')} · USD {(rstatus?.deep_fee_usd ?? 9).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className="text-ink-4">{rstatus && !rstatus.rea.ok ? T('(instalá REA: npx rea-agents setup)', '(install REA: npx rea-agents setup)') : !isEngineProvider(bProvider) ? T('(con Claude Code o Codex como constructor)', '(with Claude Code or Codex as builder)') : T('(REA analiza bundles, rutas y APIs de los referentes para entender cómo están hechos)', '(REA analyses the references\' bundles, routes and APIs to understand how they are built)')}</span>
            </label>
            <label className="mt-2 flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" className="accent-accent w-4 h-4" checked={designFirst} onChange={(e) => setDesignFirst(e.target.checked)} />
              {T('Diseño UX/UI primero', 'UX/UI design first')} <span className="text-ink-4">{T('(el Product Designer entrega sistema, pantallas y mockup; la UI debe seguirlo)', '(the Product Designer delivers system, screens and mockup; the UI must follow it)')}</span>
            </label>
            <label className="mt-1.5 flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" className="accent-accent w-4 h-4" checked={recordBuild} onChange={(e) => setRecordBuild(e.target.checked)} />
              {T('Grabar la construcción en video', 'Record the build on video')} <span className="text-ink-4">{T('(Chrome pide compartir esta pestaña)', '(Chrome asks to share this tab)')}</span>
            </label>
            <label className="mt-1.5 flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" className="accent-accent w-4 h-4" checked={autoReview} onChange={(e) => setAutoReview(e.target.checked)} />
              {T('Revisión pre-prod del equipo al terminar', 'Pre-prod team review when done')}
              <select disabled={!autoReview} value={reviewRounds} onChange={(e) => setReviewRounds(Number(e.target.value))} className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[12px] disabled:opacity-40">
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{T('hasta', 'up to')} {n} {T('ronda', 'round')}{n === 1 ? '' : 's'}</option>)}
              </select>
            </label>
            {autoReview && (
              <textarea value={priorities} onChange={(e) => setPriorities(e.target.value)} rows={2} placeholder={T('¿Qué querés que el consejo trate primero? (opcional: lo demás lo deciden ellos)', 'What should the council address first? (optional: they decide the rest)')} className="mt-1.5 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] outline-none focus:border-accent" />
            )}
            {(() => {
              // an unfinished build for this brief → resume it (same chat, same files) instead of starting from zero
              const pending = builds.find((x) => ['running', 'reviewing', 'connecting', 'stopped', 'error'].includes(x.status))
              if (pending && !startFresh) {
                const live = pending.status === 'running' || pending.status === 'reviewing'
                return (
                  <div className="mt-3 rounded-xl border-2 border-accent bg-accent-soft/50 p-3">
                    <div className="flex items-center gap-2 text-[13px] font-semibold"><ProviderLogo provider={pending.provider} size={16} /> {live ? T('Hay una construcción en curso', 'There is a build in progress') : T('Hay una construcción a medio hacer', 'There is a half-finished build')}</div>
                    <div className="mt-0.5 text-[12px] text-ink-2">{pending.files} {pending.files === 1 ? T('archivo escrito', 'file written') : T('archivos escritos', 'files written')}{pending.stages ? ` · ${pending.stages} ${pending.stages === 1 ? T('etapa cerrada', 'stage closed') : T('etapas cerradas', 'stages closed')}` : ''} · {pending.model}. {live ? T('Sigue corriendo en el servidor aunque cierres esta pantalla.', 'It keeps running on the server even if you close this screen.') : T('Al retomar, el constructor revisa lo hecho y sigue desde ahí, sin repetir nada.', 'On resume, the builder reviews what was done and continues from there, without repeating anything.')}</div>
                    <button
                      disabled={building}
                      onClick={async () => {
                        setBuilding(true)
                        setError(null)
                        try {
                          if (!live) await api.buildResume(pending.id, sessionId)
                          await onOpenBuild(pending.id)
                        } catch (e) {
                          setError((e as Error).message)
                          setBuilding(false)
                        }
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-accent text-white py-2.5 font-semibold hover:brightness-110 disabled:opacity-40"
                    >
                      <Rocket size={16} /> {building ? T('Abriendo…', 'Opening…') : live ? T('Volver a la construcción', 'Back to the build') : T('Retomar la construcción', 'Resume the build')}
                    </button>
                    <button onClick={() => setStartFresh(true)} className="mt-1.5 w-full text-[11.5px] text-ink-3 hover:text-ink">{T('empezar una construcción nueva desde cero', 'start a new build from scratch')}</button>
                  </div>
                )
              }
              return (
                <button
                  disabled={!text || busy || building || !bModel}
                  onClick={async () => {
                    setBuilding(true)
                    setError(null)
                    try {
                      await onBuild(bProvider, bModel, target, recordBuild, autoReview ? reviewRounds : 0, autoReview ? priorities.trim() : '', designFirst, { research, references: refs, deep_analysis: deep })
                    } catch (e) {
                      setError((e as Error).message)
                      setBuilding(false)
                    }
                  }}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-accent text-accent py-2.5 font-semibold hover:bg-accent-soft transition disabled:opacity-40"
                  title={!text ? T('Primero generá el brief', 'Generate the brief first') : undefined}
                >
                  <Rocket size={16} /> {building ? T('Lanzando…', 'Launching…') : T('Construir el producto', 'Build the product')}
                </button>
              )
            })()}
            {!text && <p className="mt-1.5 text-[11.5px] text-ink-4">{T('Generá el brief primero: es lo que el constructor va a seguir.', 'Generate the brief first: it is what the builder will follow.')}</p>}
            {builds.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-[11px] text-ink-3">{T('Construcciones anteriores', 'Previous builds')}</div>
                {builds.slice(0, 5).map((b) => (
                  <button key={b.id} onClick={() => onOpenBuild(b.id)} className="w-full flex items-center gap-2 rounded-lg border border-line bg-surface hover:bg-surface-2 px-2.5 py-1.5 text-left text-[12px]">
                    <ProviderLogo provider={b.provider} size={14} />
                    <span className="font-mono truncate">{b.model}</span>
                    <span className="ml-auto text-ink-3">{b.files} {T('arch.', 'files')} · {b.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-line">
            <div className="text-xs uppercase tracking-widest text-ink-3">{T('Sin modelo', 'No model')}</div>
            <button onClick={downloadTranscript} className={`${btn} mt-2 w-full justify-center`}><FileText size={15} /> {T('Transcripción .md', 'Transcript .md')}</button>
          </div>
          {error && <div className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
        </div>

        {/* -------- preview */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="relative flex items-center gap-2 px-5 py-3 border-b border-line">
            {busy && (
              <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-accent-soft overflow-hidden">
                {sectionsDone > 0 ? (
                  <div className="h-full bg-accent transition-all duration-700" style={{ width: `${progress}%` }} />
                ) : (
                  <div className="h-full w-1/3 bg-accent/70 animate-[shimmer_1.4s_ease-in-out_infinite]" />
                )}
              </div>
            )}
            <span className="text-xs uppercase tracking-widest text-ink-3">{T('Vista previa', 'Preview')}</span>
            {busy && (
              <span className="text-xs text-accent">
                ● {sectionsDone > 0 ? `${T('sección', 'section')} ${sectionsDone} ${T('de', 'of')} ${TOTAL_SECTIONS} · ${progress}%` : steps[stepIdx] + '…'} <span className="font-mono text-ink-3">{elapsed}s</span>
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <button disabled={!prompt || busy} onClick={() => copy('prompt')} className={btn} title={T('Copia sólo el prompt final para el agente constructor', 'Copies only the final prompt for the builder agent')}>
                {copied === 'prompt' ? <Check size={15} /> : <Copy size={15} />} {T('Copiar prompt', 'Copy prompt')}
              </button>
              <button disabled={!text || busy} onClick={() => copy('all')} className={btn}>
                {copied === 'all' ? <Check size={15} /> : <Copy size={15} />} {T('Copiar todo', 'Copy all')}
              </button>
              <button disabled={!text || busy} onClick={() => downloadBlob(new Blob([text], { type: 'text/markdown' }), `${base}-brief-${target}.md`)} className={`${btn} !bg-accent !text-white !border-accent`}>
                <Download size={15} /> {T('Descargar .md', 'Download .md')}
              </button>
              <button className="text-ink-3 hover:text-ink hidden md:block ml-1" onClick={onClose}><X size={18} /></button>
            </div>
          </div>
          <div ref={preview} className="flex-1 overflow-y-auto scroll-thin px-8 py-6 bg-surface">
            {busy && !visible.trim() ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="relative">
                  {[0, 1].map((i) => <span key={i} className="absolute inset-0 rounded-full border border-accent/40 animate-ping" style={{ animationDelay: `${i * 0.6}s`, animationDuration: '2s' }} />)}
                  <span className="relative w-16 h-16 rounded-full bg-surface border border-line flex items-center justify-center shadow-sm"><ProviderLogo provider={provider} size={34} /></span>
                </div>
                <div className="mt-6 serif text-2xl">{model}</div>
                <div className="mt-1 text-sm text-ink-3">{T('está escribiendo el brief a partir de', 'is writing the brief from')} {turnsCount} {T('turnos', 'turns')}</div>
                <ul className="mt-6 space-y-2 text-left text-sm">
                  {steps.map((st, i) => (
                    <li key={st} className={`flex items-center gap-2.5 ${i < stepIdx ? 'text-ok' : i === stepIdx ? 'text-ink' : 'text-ink-4'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${i < stepIdx ? 'bg-ok/15' : i === stepIdx ? 'bg-accent-soft text-accent' : 'bg-surface-2'}`}>{i < stepIdx ? '✓' : i === stepIdx ? <span className="w-2 h-2 rounded-full bg-accent animate-pulse" /> : ''}</span>
                      {st}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 text-[12px] text-ink-4 max-w-xs">{T('Un modelo grande puede tardar 20–60 s antes de la primera línea; el documento completo son varios miles de palabras.', 'A large model can take 20–60 s before the first line; the full document is several thousand words.')} {elapsed}s {T('transcurridos.', 'elapsed.')}</div>
              </div>
            ) : text ? (
              <article className={`md ${busy ? 'caret' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-ink-3">
                <Hammer size={34} className="text-ink-4" />
                <p className="mt-3 max-w-sm text-sm">{T('Elegí el modelo y el destino, y generá el brief. Vas a ver cómo se escribe acá.', 'Pick the model and the target, then generate the brief. You will watch it being written here.')}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
