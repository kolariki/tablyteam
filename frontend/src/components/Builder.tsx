import DOMPurify from 'dompurify'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, FlaskConical, Gauge, ShieldCheck, ChevronDown, ChevronLeft, Circle, Copy, CreditCard, Download, Maximize2, Minimize2, GitBranch, HardHat, MonitorPlay, Palette, PanelRightClose, ExternalLink, Eye, FileCode2, FileText, Folder, Gavel, KeyRound, Play, RefreshCw, Send, Square, TerminalSquare, Sparkles, Loader2 } from 'lucide-react'
import { marked } from 'marked'
import { useEffect, useMemo, useRef, useState } from 'react'
import { reconnectBuild, useBuild, type Activity, type ChatItem, type Todo } from '../buildStore'
import { api } from '../lib/api'
import { BRAND_COLOR } from '../lib/brand'
import { tr, useT } from '../lib/i18n'
import { downloadBlob, requestTabStream, startRecording, type Recording } from '../lib/recorder'
import { toast } from './Toast'
import ProviderLogo from './ProviderLogo'
import { LiveReview, ReviewLauncher, ReviewRoundCard } from './ReviewPanel'
import ServicesDeploy from './ServicesDeploy'
import AppRunner from './AppRunner'
import RunModal from './RunModal'
import VersionsPanel, { ReadinessBadge } from './VersionsPanel'
import CouncilLaunch from './CouncilLaunch'
import FdeModal from './FdeModal'
import { useArena } from '../store'
import CodeEditor from './CodeEditor'
import DesignPanel from './DesignPanel'
import { useEditorTheme } from '../lib/editorThemes'

/** Header buttons share the home page's language: pills that lift on hover. */
const HBTN = 'flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm text-ink-2 shadow-sm transition hover:bg-accent-soft hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-2'
const HBTN_PRIMARY = 'flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40'
const PBTN = 'flex items-center gap-1 rounded-md px-2 py-1 text-ink-3 transition hover:bg-surface-2 hover:text-ink disabled:opacity-40'

type BuildState = ReturnType<typeof useBuild.getState>
/** The panes the rail can open, in order, with when each one is still empty. */
const PANES: { id: BuildState['pane']; icon: typeof FileCode2; es: string; en: string; off: (b: BuildState) => boolean }[] = [
  { id: 'code', icon: FileCode2, es: 'Código', en: 'Code', off: () => false },
  { id: 'design', icon: Palette, es: 'Diseño', en: 'Design', off: () => false },
  { id: 'preview', icon: Eye, es: 'Vista previa', en: 'Preview', off: (b) => !b.previewHtml },
  { id: 'app', icon: MonitorPlay, es: 'App real', en: 'Real app', off: (b) => Object.keys(b.files).length === 0 },
  { id: 'versions', icon: GitBranch, es: 'Versiones', en: 'Versions', off: (b) => b.versions.length === 0 },
  { id: 'deploy', icon: KeyRound, es: 'Servicios y deploy', en: 'Services & deploy', off: () => false },
  { id: 'report', icon: FileText, es: 'Informe', en: 'Report', off: (b) => !b.auditReport },
]

const md = (s: string) => DOMPurify.sanitize(marked.parse(s, { async: false }) as string)

/** Live-parse the streaming turn: the <say> text so far and which files are closed/open. */
function liveParts(raw: string) {
  const say = raw.match(/<say>([\s\S]*?)(?:<\/say>|$)/)?.[1] ?? ''
  const files = [...raw.matchAll(/<file path="([^"\n]+)"\s*>[\s\S]*?<\/file>/g)].map((m) => m[1])
  const stage = raw.match(/<stage[^>]*>([\s\S]*?)(?:<\/stage>|$)/)?.[1] ?? ''
  const done = raw.match(/<done>([\s\S]*?)(?:<\/done>|$)/)?.[1] ?? ''
  return { say, files, stage, done }
}

export default function Builder({ onBack }: { onBack: () => void }) {
  const T = useT()
  const b = useBuild()
  const color = BRAND_COLOR[b.provider ?? ''] ?? '#2F6B5D'
  const [input, setInput] = useState('')
  const rec = useRef<Recording | null>(null)
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [applyRounds, setApplyRounds] = useState(2)
  const [runOpen, setRunOpen] = useState(false)
  const [councilOpen, setCouncilOpen] = useState<false | 'launch' | 'edit'>(false)
  const [fdeOpen, setFdeOpen] = useState<string | null>(null)
  useEffect(() => {
    if (b.fdePrefill !== null) { setFdeOpen(b.fdePrefill); useBuild.getState().set({ fdePrefill: null }) }
  }, [b.fdePrefill])
  // seconds since the current turn started (shown while the model hasn't emitted anything yet)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (b.liveTurn == null) return
    setElapsed(0)
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(id)
  }, [b.liveTurn])
  const chatRef = useRef<HTMLDivElement>(null)
  const live = useMemo(() => liveParts(b.liveRaw), [b.liveRaw])
  const running = b.status === 'running' || b.status === 'connecting' || b.status === 'reviewing'
  const reviewing = b.status === 'reviewing'

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [b.chat.length, live.say.length, live.files.length])


  // fetch a file's content lazily when selected (contents aren't streamed into the tree)
  useEffect(() => {
    const p = b.selected
    if (!p || !b.sessionId || !b.id || b.files[p]?.content !== undefined || (b.liveFile && b.liveFile.path === p)) return
    api.build(b.sessionId, b.id).then((d) => {
      const contents = d.file_contents ?? {}
      useBuild.getState().set({ files: Object.fromEntries(Object.entries(useBuild.getState().files).map(([k, v]) => [k, { ...v, content: contents[k] ?? v.content }])) })
    }).catch(() => {})
  }, [b.selected, b.liveFile?.path, b.chat.length])

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim()
    if (!text || !b.id) return
    if (!preset) setInput('')
    const r = await api.buildMessage(b.id, text, b.sessionId).catch(() => null)
    if (r && (r as { resumed?: boolean }).resumed) {
      useBuild.getState().set({ status: 'connecting', chat: [...useBuild.getState().chat, { role: 'user', text, ts: Date.now() / 1000 }], error: null })
      reconnectBuild(b.id)
    }
  }

  const toggleRecording = async () => {
    if (rec.current) {
      const blob = await rec.current.stop()
      rec.current = null
      useBuild.getState().set({ recording: false })
      downloadBlob(blob, `tablyteam-construccion-${b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyecto'}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`)
      return
    }
    try {
      const stream = await requestTabStream(false)
      rec.current = await startRecording(stream, document.querySelector<HTMLElement>('[data-capture="builder"]'))
      useBuild.getState().set({ recording: true })
      rec.current.ended.then(() => rec.current && toggleRecording())
    } catch {
      /* permission declined */
    }
  }

  const openPreviewTab = () => {
    if (!b.previewHtml) return
    const url = URL.createObjectURL(new Blob([b.previewHtml], { type: 'text/html' }))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const regeneratePreview = async () => {
    if (!b.id) return
    const text = 'Regenerá preview/index.html (vista previa autocontenida del producto terminado) incorporando los últimos cambios.'
    const r = await api.buildMessage(b.id, text, b.sessionId).catch(() => null)
    if (r && (r as { resumed?: boolean }).resumed) {
      useBuild.getState().set({ status: 'connecting', chat: [...useBuild.getState().chat, { role: 'user', text, ts: Date.now() / 1000 }] })
      reconnectBuild(b.id)
    }
  }

  const downloadZip = async () => {
    if (!b.sessionId || !b.id) return
    const blob = await api.buildZip(b.sessionId, b.id)
    downloadBlob(blob, `${b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proyecto'}.zip`)
  }

  const shownFile = b.liveFile && b.selected === b.liveFile.path ? b.liveFile.content : b.files[b.selected ?? '']?.content
  const tree = useMemo(() => buildTree(Object.keys(b.files).concat(b.liveFile ? [b.liveFile.path] : [])), [b.files, b.liveFile?.path])
  const stageCount = b.stages.length
  const isEngineBuild = b.provider === 'claude-code' || b.provider === 'codex'
  const codeTheme = useEditorTheme((s) => s.theme)
  const [payingFees, setPayingFees] = useState(false)
  const codeDark = codeTheme.dark
  // the side panel takes ~60% of the row (at least 640px), leaving the chat its minimum; measured so the spring can animate pixels
  const wrapRef = useRef<HTMLDivElement>(null)
  const [wrapW, setWrapW] = useState(0)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWrapW(el.clientWidth))
    ro.observe(el)
    setWrapW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  // expanded: the pane takes the whole row (the chat folds away) so the editor can be worked in full width
  const [paneFull, setPaneFull] = useState(false)
  useEffect(() => {
    if (!paneFull) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPaneFull(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paneFull])
  const paneW = wrapW ? (paneFull ? wrapW - 56 : Math.max(560, Math.min(wrapW - 56 - 400, Math.round((wrapW - 56) * 0.6)))) : 760

  return (
    <div className="h-full flex flex-col bg-paper">
      {/* top bar */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur">
        <button onClick={onBack} className="flex shrink-0 items-center rounded-lg transition hover:opacity-80" title={T('Tably Team · volver al inicio', 'Tably Team · back to the home')}>
          <img src="/icon.svg" alt="Tably Team" className="h-9 w-9 rounded-xl shadow-sm" draggable={false} />
        </button>
        <button onClick={onBack} className={`${HBTN} px-3`}><ArrowLeft size={14} /> {T('Volver', 'Back')}</button>
        <span className="mx-1 h-7 w-px bg-line" />
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm" style={{ border: `1.5px solid ${color}` }}><ProviderLogo provider={b.provider} size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="serif truncate text-[17px] leading-tight" title={b.title}>{b.title}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-3">
            <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} /> <span className="font-mono">{b.model}</span></span>
            {b.engineSession && b.workdir && (
              <>
                <span className="h-3 w-px bg-line" />
                <button
                  onClick={() => { navigator.clipboard?.writeText(`cd "${b.workdir}" && claude --resume ${b.engineSession}`); toast.ok(tr('Comando copiado', 'Command copied'), tr('Pegalo en tu terminal para abrir esta misma sesión en tu Claude Code.', 'Paste it in your terminal to open this same session in your Claude Code.')) }}
                  className="flex items-center gap-1 whitespace-nowrap text-[11.5px] text-ink-3 transition hover:text-accent"
                  title={`${T('Copia el comando para seguir esta misma sesión en tu terminal', 'Copies the command to continue this same session in your terminal')}: cd "${b.workdir}" && claude --resume ${b.engineSession}`}
                >
                  <TerminalSquare size={12} /> {T('Abrir en mi Claude Code', 'Open in my Claude Code')} <Copy size={10} className="opacity-60" />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-2 whitespace-nowrap">
          {reviewing ? (
            <span className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-bold text-gold"><span className="h-2 w-2 rounded-full bg-gold animate-pulse" /> {b.reviewMode === 'audit' ? T('AUDITANDO', 'AUDITING') : `${T('CONSEJO · ronda', 'COUNCIL · round')} ${b.reviewRound ?? b.reviews.length + 1}`}</span>
          ) : b.status === 'audited' ? (
            <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-white">{T('AUDITADO · informe listo', 'AUDITED · report ready')}</span>
          ) : running ? (
            <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent"><span className="h-2 w-2 rounded-full bg-accent animate-pulse" /> {b.reviews.length ? T('APLICANDO', 'APPLYING') : T('CONSTRUYENDO', 'BUILDING')}{b.liveTurn ? ` · ${T('turno', 'turn')} ${b.liveTurn}` : ''}</span>
          ) : b.status === 'approved' ? (
            <span className="flex items-center gap-1.5 rounded-full bg-ok px-2.5 py-1 text-[11px] font-bold text-white"><CheckCircle2 size={12} /> {T('APROBADO POR EL CONSEJO', 'APPROVED BY THE COUNCIL')}</span>
          ) : (
            <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${b.status === 'completed' ? 'border-ok/30 bg-ok/10 text-ok' : 'border-line bg-surface-2 text-ink-3'}`}>{b.status === 'completed' ? (b.reviews.length ? T('CAMBIOS LISTOS · pendiente de consejo', 'CHANGES READY · pending council') : <><span className="h-2 w-2 rounded-full bg-ok shadow-[0_0_0_3px_rgba(23,137,106,.18)]" /> {T('LISTO', 'DONE')}</>) : b.status.toUpperCase()}</span>
          )}
          {b.versions.length > 0 && <ReadinessBadge versions={b.versions} />}
          {b.reviews.length > 0 && !reviewing && <span className="hidden text-[11px] text-ink-3 2xl:inline">{b.reviews.length} {b.reviews.length === 1 ? T('ronda', 'round') : T('rondas', 'rounds')} {T('de revisión', 'of review')}</span>}
          {stageCount > 0 && <span className="hidden text-[11px] text-ink-3 2xl:inline">{stageCount} {stageCount === 1 ? T('etapa', 'stage') : T('etapas', 'stages')}</span>}
          {/* what it really costs: an engine build runs on the user's subscription, so only the per-use fees count there */}
          <span className="hidden rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-ink-3 xl:inline-flex" title={isEngineBuild ? T('Construido con tu suscripción: los tokens no se cobran por API', 'Built on your subscription: tokens are not billed through the API') : T('Tokens por API más cargos por uso', 'API tokens plus per-use charges')}>
            {Object.keys(b.files).length} {T('archivos', 'files')} · {isEngineBuild && !b.fees ? T('suscripción', 'subscription') : `$${((isEngineBuild ? 0 : b.cost) + b.fees).toFixed(2)}`}
          </span>
          {b.feesDue > 0 && (
            <button
              disabled={payingFees}
              onClick={async () => {
                if (!b.sessionId || !b.id) return
                setPayingFees(true)
                try { const o = await api.checkout({ kind: 'fees', build_id: b.id, session_id: b.sessionId }); window.location.href = o.url } catch (e) { toast.error(tr('No se pudo iniciar el pago', 'Could not start the payment'), (e as Error).message); setPayingFees(false) }
              }}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-bold text-gold transition hover:bg-gold/20 disabled:opacity-50"
              title={T('Cargos por uso pendientes de pago (análisis profundo). Se pagan con Stripe.', 'Unpaid per-use charges (deep analysis). Paid through Stripe.')}
            >{payingFees ? <Loader2 size={11} className="animate-spin" /> : <CreditCard size={11} />} USD {b.feesDue.toFixed(2)} {T('a pagar', 'to pay')}</button>
          )}
        </div>
        {/* actions: labels only when there is room; below 2xl the secondary ones are icon buttons with a tooltip */}
        <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap">
          <button onClick={toggleRecording} className={`${b.recording ? `${HBTN} border-danger/60 bg-danger/10 text-danger hover:border-danger hover:text-danger` : HBTN} px-3 2xl:px-3.5`} title={b.recording ? T('Guardar el video', 'Save the video') : T('Graba esta pantalla (chat + código + vista previa) y descarga el video', 'Records this screen (chat + code + preview) and downloads the video')}>
            <Circle size={13} className={b.recording ? 'fill-danger animate-pulse' : ''} /> <span className="hidden 2xl:inline">{b.recording ? T('Guardar video', 'Save video') : T('Grabar', 'Record')}</span>
          </button>
          {running && b.id && <button onClick={() => api.buildStop(b.id!)} className={`${HBTN} border-danger/40 px-3 text-danger hover:border-danger hover:text-danger 2xl:px-3.5`} title={T('Detener la construcción', 'Stop the build')}><Square size={14} /> <span className="hidden 2xl:inline">{T('Detener', 'Stop')}</span></button>}
          <button onClick={downloadZip} disabled={!Object.keys(b.files).length} className={`${HBTN} px-3 2xl:px-3.5`} title={T('Descargar el proyecto como .zip', 'Download the project as .zip')}><Download size={14} /> <span className="hidden 2xl:inline">{T('Descargar .zip', 'Download .zip')}</span></button>
          <button onClick={() => setRunOpen(true)} disabled={!Object.keys(b.files).length || running} className={HBTN_PRIMARY} title={T('Levanta la app en esta máquina y la muestra acá', 'Starts the app on this machine and shows it here')}><MonitorPlay size={14} /> {T('Correr la app', 'Run the app')}{b.appRun.status === 'running' ? <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> : null}</button>
        </div>
      </div>
      {runOpen && <RunModal onClose={() => setRunOpen(false)} onDownload={downloadZip} />}
      {fdeOpen !== null && <FdeModal onClose={() => setFdeOpen(null)} prefill={fdeOpen ? `${T('Resolver los bloqueantes del consejo:', 'Resolve the council blockers:')}\n${fdeOpen}` : ''} />}
      {councilOpen && (
        <CouncilLaunch team={b.team} startEditing={councilOpen === 'edit'} onClose={() => setCouncilOpen(false)} onLaunch={async (priorities, rounds, references, deep) => {
          if (!b.id) return
          try {
            const r = await api.buildCouncil(b.id, b.sessionId, rounds, priorities, references, deep)
            if (r.session_id) useBuild.getState().set({ councilSession: r.session_id })
            else {
              // the benchmark runs in the background: open the build socket so its events (references, done, council) arrive
              useBuild.getState().set({ researching: { refs: references, started: Date.now(), visited: [], finished: false }, councilSessionsKnown: b.councilSessionsKnown })
              reconnectBuild(b.id)
            }
            setCouncilOpen(false)
          } catch (e) {
            useBuild.getState().set({ error: (e as Error).message })
          }
        }} />
      )}

      <div ref={wrapRef} className="flex min-h-0 flex-1">
        {/* chat */}
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col border-r border-line transition-opacity duration-300 ${paneFull && b.paneOpen ? 'pointer-events-none opacity-0' : ''}`}>
          <div ref={chatRef} className="flex-1 overflow-y-auto scroll-thin px-5 py-5 space-y-4">
            <AnimatePresence initial={false}>
              {b.chat.map((c, i) => (c.role === 'review' ? <ReviewRoundCard key={i} round={{ round: c.round!, approved: !!c.approved, results: c.results ?? [], mode: c.mode, ts: c.ts }} team={b.team} /> : <Bubble key={i} c={c} color={color} provider={b.provider} onOpen={(p) => useBuild.getState().set({ selected: p })} />))}
              {reviewing && <LiveReview round={b.reviewRound ?? b.reviews.length + 1} team={b.team} raws={b.liveReviews} audit={b.reviewMode === 'audit'} />}
              {b.liveTurn != null && (
                <motion.div key="live" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-surface border flex items-center justify-center" style={{ borderColor: `${color}66` }}><ProviderLogo provider={b.provider} size={18} /></span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-surface border border-line px-4 py-3">
                    {b.livePhase === 'preview' && <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">{T('🖼 Vista previa del producto', '🖼 Product preview')}</div>}
                    {b.livePhase === 'report' && <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">{T('📄 Escribiendo el informe de auditoría', '📄 Writing the audit report')}</div>}
                    {b.livePhase === 'design' && <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">{T('🎨 El Product Designer diseña la interfaz (sistema, pantallas, mockup) antes de escribir código', '🎨 The Product Designer designs the interface (system, screens, mockup) before writing code')}</div>}
                    {b.engineSession !== undefined && (b.activity.length > 0 || b.todos.length > 0) && b.livePhase === 'build' && (
                      <LiveActivity activity={b.activity} todos={b.todos} elapsed={elapsed} files={Object.keys(b.files).length} thinking={b.thinking} lastEventTs={b.lastEventTs} previewHtml={b.previewHtml ?? b.designHtml} />
                    )}
                    {live.say ? (
                      <div className={`md text-[14px] ${b.activity.length ? 'mt-3 pt-3 border-t border-line' : ''}`} dangerouslySetInnerHTML={{ __html: md(live.say) }} />
                    ) : b.activity.length > 0 ? null : (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 text-ink">
                          <span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
                          {b.livePhase === 'preview' ? T('Armando la vista previa del producto', 'Building the product preview') : b.livePhase === 'report' ? T('Consolidando las evaluaciones del equipo', 'Consolidating the team evaluations') : b.liveTurn === 1 ? T('Leyendo el brief y planificando la etapa 1', 'Reading the brief and planning stage 1') : `${T('Preparando el turno', 'Preparing turn')} ${b.liveTurn}`}
                          <span className="font-mono text-[11px] text-ink-3">{elapsed}s</span>
                        </div>
                        <div className="mt-1.5 text-[12px] text-ink-3">{T('Un modelo grande puede tardar 30–90 s antes del primer archivo: escribe cada archivo completo. Los archivos aparecen a la derecha a medida que se cierran.', 'A large model can take 30–90 s before the first file: it writes each file in full. Files appear on the right as they are closed.')}</div>
                      </div>
                    )}
                    {(live.files.length > 0 || b.liveFile) && (
                      <div className="mt-3 space-y-1.5">
                        {live.files.map((p) => <FileChip key={p} path={p} done onOpen={() => useBuild.getState().set({ selected: p })} />)}
                        {b.liveFile && !live.files.includes(b.liveFile.path) && <FileChip path={b.liveFile.path} lines={b.liveFile.content.split('\n').length} onOpen={() => useBuild.getState().set({ selected: b.liveFile!.path })} />}
                      </div>
                    )}
                    {live.stage && <div className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-[13px] md" dangerouslySetInnerHTML={{ __html: md(T('**Etapa cerrada.** ', '**Stage closed.** ') + live.stage) }} />}
                    {live.done && <div className="mt-3 rounded-lg bg-ok/10 px-3 py-2 text-[13px] md" dangerouslySetInnerHTML={{ __html: md(T('🎉 **Producto terminado.** ', '🎉 **Product finished.** ') + live.done) }} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {b.error && <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger font-mono">⚠️ {b.error}</div>}
            {b.status === 'audited' && !b.liveTurn && b.id && (() => {
              const audit = [...b.reviews].reverse().find((r) => r.mode === 'audit')
              const props = (audit?.results ?? []).filter((r) => r.requests?.trim())
              const chosen = props.filter((r) => picked[r.agent_id] ?? true)
              return (
                <div className="rounded-2xl border-2 border-dashed border-accent/40 p-4">
                  <div className="flex items-center gap-2 font-semibold"><Gavel size={18} className="text-accent" /> {T('Aplicar mejoras con el constructor', 'Apply improvements with the builder')}</div>
                  <p className="mt-1 text-[12.5px] text-ink-2">{T('Elegí qué propuestas implementar. El constructor las aplica sobre tu proyecto y el consejo las revisa hasta aprobarlas; después descargás el zip mejorado.', 'Choose which proposals to implement. The builder applies them to your project and the council reviews them until approved; then you download the improved zip.')}</p>
                  <div className="mt-3 space-y-1.5">
                    {props.map((r) => (
                      <label key={r.agent_id} className="flex items-start gap-2 rounded-lg border border-line bg-paper px-2.5 py-2 text-[12.5px]">
                        <input type="checkbox" className="accent-accent mt-0.5" checked={picked[r.agent_id] ?? true} onChange={(e) => setPicked({ ...picked, [r.agent_id]: e.target.checked })} />
                        <span><b>{r.name}</b> <span className="text-ink-3">· {r.role_label}</span><span className="block text-ink-2 whitespace-pre-wrap">{r.requests.slice(0, 400)}{r.requests.length > 400 ? '…' : ''}</span></span>
                      </label>
                    ))}
                    {props.length === 0 && <div className="text-[12.5px] text-ink-3">{T('Ningún rol propuso cambios: el equipo considera que está bien así.', 'No role proposed changes: the team thinks it is fine as is.')}</div>}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-[12px] text-ink-3 flex items-center gap-1.5">{T('rondas de revisión', 'review rounds')}
                      <select value={applyRounds} onChange={(e) => setApplyRounds(Number(e.target.value))} className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink">{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                    </label>
                    <button disabled={!chosen.length} onClick={async () => {
                      await api.buildApply(b.id!, b.sessionId, chosen.map((r) => ({ role_label: r.role_label, name: r.name, text: r.requests })), applyRounds).catch((e) => useBuild.getState().set({ error: (e as Error).message }))
                      useBuild.getState().set({ status: 'connecting', error: null, pane: 'code' })
                      reconnectBuild(b.id!)
                    }} className="ml-auto flex items-center gap-2 rounded-xl bg-accent text-white px-4 py-2 text-sm font-semibold hover:brightness-110 disabled:opacity-40"><Play size={15} /> {T('Aplicar', 'Apply')} {chosen.length} {chosen.length === 1 ? T('propuesta', 'proposal') : T('propuestas', 'proposals')}</button>
                  </div>
                </div>
              )
            })()}
            {(b.status === 'error' || b.status === 'stopped') && b.id && (
              <div className="rounded-2xl border-2 border-dashed border-gold/50 bg-gold/5 px-4 py-3 text-sm">
                <div className="font-semibold">{b.status === 'error' ? T('La construcción se interrumpió por un error', 'The build was interrupted by an error') : T('Construcción detenida', 'Build stopped')}</div>
                <div className="mt-1 text-[12.5px] text-ink-2">{T('Todo lo escrito está guardado', 'Everything written is saved')} ({Object.keys(b.files).length} {T('archivos', 'files')}, {b.stages.length} {b.stages.length === 1 ? T('etapa cerrada', 'stage closed') : T('etapas cerradas', 'stages closed')}). {T('Al reanudar, el constructor revisa el árbol y sigue desde donde quedó, en este mismo chat.', 'On resume, the builder reviews the tree and continues where it left off, in this same chat.')}</div>
                <button
                  onClick={async () => {
                    await api.buildResume(b.id!, b.sessionId).catch((e) => useBuild.getState().set({ error: (e as Error).message }))
                    useBuild.getState().set({ status: 'connecting', error: null })
                    reconnectBuild(b.id!)
                  }}
                  className="mt-3 flex items-center gap-2 rounded-xl bg-accent text-white px-4 py-2 text-sm font-semibold hover:brightness-110"
                >
                  <Play size={15} /> {T('Reanudar construcción', 'Resume build')}
                </button>
              </div>
            )}
            {b.status === 'approved' && (
              <div className="rounded-2xl border-2 border-ok bg-ok/10 px-4 py-3 text-sm flex items-center gap-3">
                <CheckCircle2 className="text-ok shrink-0" size={22} />
                <div><b>{T('Aprobado por el consejo', 'Approved by the council')}</b> {T('en', 'in')} {b.reviews.length} {b.reviews.length === 1 ? T('ronda', 'round') : T('rondas', 'rounds')}: {T('todos los roles dieron el visto bueno para producción. Descargá el .zip final.', 'every role gave the go-ahead for production. Download the final .zip.')}</div>
              </div>
            )}
            {b.status === 'completed' && !b.liveTurn && b.team.length > 0 && (
              <ReviewLauncher team={b.team} onStart={() => setCouncilOpen('launch')} onEdit={() => setCouncilOpen('edit')} />
            )}
            {b.pendingCouncil && !b.liveTurn && (
              <button onClick={() => useArena.getState().set({ pendingLive: b.pendingCouncil! })} className="w-full rounded-2xl border-2 border-gold bg-gold/10 px-4 py-3 text-left transition hover:brightness-95">
                <div className="flex items-center gap-2 font-semibold"><Gavel size={18} className="text-gold" /> {T('El consejo ya dio su veredicto', 'The council has given its verdict')}{b.versions.length ? ` ${T('sobre', 'on')} v${b.versions.length}` : ''}</div>
                <div className="mt-0.5 text-[12.5px] text-ink-2">{T('Mirá la lista de cambios y decidí si construir con ellos o no →', 'Check the list of changes and decide whether to build with them or not →')}</div>
              </button>
            )}
            {(b.status === 'completed' || b.status === 'approved') && !b.liveTurn && (
              <div>
                <div className="mb-2 text-[10.5px] uppercase tracking-[0.3em] text-ink-3">{T('Qué hacer ahora', 'What to do now')}</div>
                <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
                  {([
                    { id: 'run', icon: MonitorPlay, title: T('Correr la app', 'Run the app'), text: T('Levantala en esta máquina y vela acá', 'Start it on this machine and see it here'), primary: true, show: true, go: () => setRunOpen(true) },
                    { id: 'preview', icon: Eye, title: T('Prototipo navegable', 'Clickable prototype'), text: T('Sin correr nada, en un clic', 'Without running anything, one click'), primary: false, show: !!b.previewHtml, go: () => useBuild.getState().set({ paneOpen: true, pane: 'preview' }) },
                    { id: 'design', icon: Palette, title: T('Diseño', 'Design'), text: T('Qué tiene y pedile cambios', 'What it has, ask for changes'), primary: false, show: true, go: () => useBuild.getState().set({ paneOpen: true, pane: 'design' }) },
                    { id: 'deploy', icon: KeyRound, title: T('Servicios y deploy', 'Services & deploy'), text: T('Keys, variables y publicar', 'Keys, variables and publishing'), primary: false, show: true, go: () => useBuild.getState().set({ paneOpen: true, pane: 'deploy' }) },
                    { id: 'fde', icon: HardHat, title: T('Pedir un developer', 'Request a developer'), text: T('Un ingeniero nuestro lo sube por vos', 'One of our engineers ships it for you'), primary: false, show: true, go: () => setFdeOpen('') },
                  ] as const).filter((a) => a.show).map((a) => {
                    const Icon = a.icon
                    return (
                      <motion.button key={a.id} type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }} onClick={a.go} className={`group flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left shadow-[0_10px_24px_-16px_rgba(30,38,34,.45)] transition-colors ${a.primary ? 'border-accent bg-accent text-white' : 'border-line bg-surface hover:border-accent'}`}>
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.primary ? 'bg-white/15 text-white' : 'bg-accent-soft text-accent'}`}><Icon size={19} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold">{a.title}</span>
                          <span className={`block truncate text-[11.5px] ${a.primary ? 'text-white/80' : 'text-ink-3'}`}>{a.text}</span>
                        </span>
                        <ArrowRight size={15} className={`shrink-0 transition group-hover:translate-x-0.5 ${a.primary ? 'text-white/80' : 'text-ink-4 group-hover:text-accent'}`} />
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}
            {b.status === 'design_review' && !b.liveTurn && <DesignReviewCard />}
            {b.status === 'completed' && !b.liveTurn && (
              <div className="rounded-2xl border border-ok/30 bg-ok/5 px-4 py-3 text-sm flex items-center gap-3">
                <CheckCircle2 className="text-ok shrink-0" size={20} />
                <div>{T('Construcción terminada:', 'Build finished:')} {Object.keys(b.files).length} {T('archivos. Descargá el .zip, seguí las instrucciones del README y, si querés cambios, escribile al constructor abajo.', 'files. Download the .zip, follow the README instructions and, if you want changes, write to the builder below.')}</div>
              </div>
            )}
          </div>
          <div className="border-t border-line bg-surface p-3">
            {/* quick actions: the full visual-polish checklist is one click (the server expands "pulido visual" into it) */}
            {b.id && !running && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[10px] uppercase tracking-[0.25em] text-ink-3">{T('Pedidos rápidos', 'Quick requests')}</span>
                {([
                  { icon: Sparkles, label: T('Pulido visual', 'Visual polish'), text: 'Pulido visual', tip: T('Pasada de diseño sobre toda la UI: tipografía real, tokens, layout, estados, responsive y accesibilidad, según design/DESIGN.md y el mockup.', 'Design pass over the whole UI: real typography, tokens, layout, states, responsive and accessibility, per design/DESIGN.md and the mockup.'), hot: true },
                  { icon: ShieldCheck, label: T('Accesibilidad', 'Accessibility'), text: tr('Auditá y corregí accesibilidad en toda la UI: contraste AA, foco visible, navegación por teclado, labels y roles ARIA, textos alternativos, tamaños táctiles ≥ 44 px. Verificá con lint/tests y resumí qué cambió.', 'Audit and fix accessibility across the UI: AA contrast, visible focus, keyboard navigation, ARIA labels and roles, alt texts, touch targets ≥ 44 px. Verify with lint/tests and summarise what changed.'), tip: T('Contraste, teclado, ARIA, tamaños táctiles.', 'Contrast, keyboard, ARIA, touch sizes.'), hot: false },
                  { icon: Gauge, label: T('Rendimiento', 'Performance'), text: tr('Optimizá el rendimiento sin cambiar funcionalidad: tamaño del bundle, carga diferida, imágenes, caché, render innecesario. Medí antes y después (Lighthouse o equivalente) y reportá los números.', 'Optimise performance without changing functionality: bundle size, lazy loading, images, caching, unnecessary renders. Measure before and after (Lighthouse or equivalent) and report the numbers.'), tip: T('Bundle, carga, caché, render.', 'Bundle, loading, cache, render.'), hot: false },
                  { icon: FlaskConical, label: T('Más tests', 'More tests'), text: tr('Subí la cobertura de tests en los flujos críticos (happy path y errores), unitarios y e2e, sin tests frágiles. Dejá todo en verde y resumí qué quedó cubierto.', 'Raise test coverage on the critical flows (happy path and errors), unit and e2e, without flaky tests. Leave everything green and summarise what is covered.'), tip: T('Cobertura en los flujos críticos.', 'Coverage on the critical flows.'), hot: false },
                ] as const).map((q) => {
                  const Icon = q.icon
                  return (
                    <button key={q.label} type="button" onClick={() => send(q.text)} title={q.tip} className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium shadow-sm transition ${q.hot ? 'border-accent/40 bg-accent-soft text-accent hover:bg-accent hover:text-white' : 'border-line bg-paper text-ink-2 hover:border-accent hover:text-accent'}`}>
                      <Icon size={13} /> {q.label}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-paper px-3 py-2 focus-within:border-accent">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                rows={2}
                placeholder={running ? T('Pedile un cambio o una aclaración; lo toma en el próximo turno…', 'Ask for a change or a clarification; it picks it up next turn…') : T('Escribile al constructor para seguir (reanuda la construcción)…', 'Write to the builder to continue (resumes the build)…')}
                className="flex-1 resize-none bg-transparent text-sm outline-none"
                disabled={!b.id}
              />
              <button onClick={() => send()} disabled={!input.trim() || !b.id} className="shrink-0 rounded-xl bg-accent text-white p-2 disabled:opacity-40"><Send size={16} /></button>
            </div>
          </div>
        </div>

        {/* the side: file tree + the open pane, sliding in and out on a spring */}
        <motion.div initial={false} animate={{ width: b.paneOpen ? paneW : 0 }} transition={{ type: 'spring', stiffness: 230, damping: 30, mass: 0.9 }} className="relative min-h-0 shrink-0 overflow-hidden">
          <div className="absolute inset-y-0 right-0 flex min-h-0" style={{ width: paneW }}>
            {/* file tree: only next to the code, sliding in and out with the same spring */}
            <motion.div initial={false} animate={{ width: b.pane === 'code' ? 232 : 0 }} transition={{ type: 'spring', stiffness: 230, damping: 30, mass: 0.9 }} className="min-h-0 shrink-0 overflow-hidden border-r border-line bg-surface">
              <div className="h-full w-[232px] overflow-y-auto scroll-thin">
                <div className="sticky top-0 border-b border-line bg-surface px-3 py-2 text-[11px] uppercase tracking-widest text-ink-3">{T('Archivos', 'Files')}</div>
                <div className="py-1 font-mono text-[13px]">
                  {tree.length === 0 && <div className="px-3 py-3 font-sans text-xs text-ink-4">{T('Todavía no hay archivos.', 'No files yet.')}</div>}
                  {tree.map((n) => <TreeNode key={n.path} node={n} depth={0} selected={b.selected} live={b.liveFile?.path ?? null} onSelect={(p) => useBuild.getState().set({ selected: p })} />)}
                </div>
              </div>
            </motion.div>

            {/* the pane */}
            <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${b.pane !== 'code' ? 'bg-paper' : ''}`} style={b.pane === 'code' ? { background: codeTheme.bg } : undefined}>
              <div className={`flex h-10 shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap border-b px-3 text-[12px] ${b.pane !== 'code' ? 'border-line bg-surface' : codeDark ? 'border-white/10 text-[#B9C4BE]' : 'border-black/10 bg-black/[0.03] text-ink-2'}`}>
                {(() => { const cur = PANES.find((x) => x.id === b.pane); const Icon = cur?.icon ?? FileCode2; return <span className={`flex items-center gap-1.5 font-semibold ${b.pane === 'code' ? (codeDark ? 'text-white' : 'text-ink') : 'text-ink'}`}><Icon size={14} className={b.pane === 'code' && codeDark ? 'text-[#8FD3B0]' : 'text-accent'} /> {cur ? T(cur.es, cur.en) : ''}</span> })()}
                {b.pane === 'code' ? (
                  <span className="ml-auto text-[11px] opacity-70">{running ? T('solo lectura mientras el constructor escribe', 'read-only while the builder writes') : T('editá y guardá con ⌘S: el constructor sigue desde tu versión', 'edit and save with ⌘S: the builder continues from your version')}</span>
                ) : b.pane === 'deploy' ? (
                  <span className="ml-auto text-[11px] text-ink-3">{T('keys, variables y hosting', 'keys, variables and hosting')}</span>
                ) : b.pane === 'app' ? (
                  <span className="ml-auto text-[11px] text-ink-3">{T('corre en esta máquina, sin deploy', 'runs on this machine, no deploy')}</span>
                ) : b.pane === 'versions' ? (
                  <span className="ml-auto text-[11px] text-ink-3">{T('qué cambió en cada iteración y qué tan lista está', 'what changed in each iteration and how ready it is')}</span>
                ) : b.pane === 'design' ? (
                  <span className="ml-auto text-[11px] text-ink-3">{T('qué tiene el diseño y pedidos al diseñador', 'what the design has and requests to the designer')}</span>
                ) : b.pane === 'report' ? (
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => b.auditReport && downloadBlob(new Blob([b.auditReport], { type: 'text/markdown' }), `informe-auditoria-${b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`)} className={PBTN}><Download size={12} /> {T('descargar .md', 'download .md')}</button>
                  </div>
                ) : (
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={regeneratePreview} disabled={running} className={PBTN} title={T('Vuelve a generar el prototipo con los últimos cambios', 'Regenerates the prototype with the latest changes')}><RefreshCw size={12} /> {T('regenerar', 'regenerate')}</button>
                    <button onClick={openPreviewTab} className={PBTN}><ExternalLink size={12} /> {T('abrir en pestaña', 'open in tab')}</button>
                  </div>
                )}
                <button onClick={() => setPaneFull((v) => !v)} title={paneFull ? T('Volver al panel normal (Esc)', 'Back to the normal panel (Esc)') : T('Expandir a toda la pantalla', 'Expand to the full screen')} className={`ml-1 shrink-0 rounded-md p-1 transition ${paneFull ? 'bg-accent text-white hover:brightness-110' : b.pane === 'code' && codeDark ? 'text-[#B9C4BE] hover:bg-white/10 hover:text-white' : 'text-ink-3 hover:bg-surface-2 hover:text-ink'}`}>{paneFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
                <button onClick={() => { setPaneFull(false); useBuild.getState().set({ paneOpen: false }) }} title={T('Cerrar el panel', 'Close the panel')} className={`shrink-0 rounded-md p-1 transition ${b.pane === 'code' && codeDark ? 'text-[#B9C4BE] hover:bg-white/10 hover:text-white' : 'text-ink-3 hover:bg-surface-2 hover:text-ink'}`}><PanelRightClose size={14} /></button>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={b.pane} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.18, ease: 'easeOut' }} className="flex min-h-0 flex-1 flex-col">
          {b.pane === 'design' ? (
                <DesignPanel />
              ) : b.pane === 'versions' ? (
                <VersionsPanel />
              ) : b.pane === 'app' ? (
                <AppRunner />
              ) : b.pane === 'deploy' ? (
                <ServicesDeploy onOpenSettings={() => { useArena.getState().set({ view: 'settings' }) }} />
              ) : b.pane === 'report' && b.auditReport ? (
                <div className="flex-1 min-h-0 overflow-y-auto scroll-thin px-8 py-6 bg-surface"><article className="md" dangerouslySetInnerHTML={{ __html: md(b.auditReport) }} /></div>
              ) : b.pane === 'preview' && b.previewHtml ? (
                <div className="flex-1 min-h-0 p-3">
                  <div className="h-full rounded-xl border border-line bg-surface overflow-hidden shadow-sm">
                    <div className="flex items-center gap-1.5 px-3 h-7 border-b border-line bg-surface-2/70"><span className="w-2 h-2 rounded-full bg-[#E6A19A]" /><span className="w-2 h-2 rounded-full bg-[#E9C97A]" /><span className="w-2 h-2 rounded-full bg-[#9FCDA8]" /><span className="ml-2 text-[10px] font-mono text-ink-3">preview/index.html · {T('prototipo navegable del producto', 'clickable prototype of the product')}</span></div>
                    <iframe title={T('Vista previa del producto', 'Product preview')} sandbox="allow-scripts allow-forms allow-modals allow-popups" srcDoc={b.previewHtml} className="w-full h-[calc(100%-28px)] bg-white" />
                  </div>
                </div>
              ) : (
                shownFile !== undefined && b.selected ? (
                  <CodeEditor
                    path={b.selected}
                    content={shownFile}
                    live={!!b.liveFile && b.selected === b.liveFile.path}
                    readOnly={running}
                    onSave={async (content) => {
                      if (!b.sessionId || !b.id || !b.selected) return
                      try {
                        const r = await api.saveFile(b.sessionId, b.id, b.selected, content)
                        useBuild.getState().set({ files: { ...useBuild.getState().files, [r.path]: { ...useBuild.getState().files[r.path], size: r.size, lines: r.lines, content } } })
                        toast.ok(tr('Archivo guardado', 'File saved'), r.path)
                      } catch (e) {
                        toast.error(tr('No se pudo guardar', 'Could not save'), (e as Error).message)
                        throw e
                      }
                    }}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center p-8 text-center text-sm" style={{ color: codeTheme.dark ? '#7F8C86' : '#6B7A72' }}>{b.selected ? T('cargando…', 'loading…') : T('Elegí un archivo del árbol o esperá a que el constructor empiece a escribir.', 'Pick a file from the tree or wait for the builder to start writing.')}</div>
                )
              )}
                    </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* the rail: one tab per pane, always visible; the active one closes the panel again */}
        <div className="flex min-h-0 w-14 shrink-0 flex-col items-center gap-1 border-l border-line bg-surface py-2">
          {PANES.filter((x) => x.id !== 'report' || b.auditReport || b.mode === 'audit').map((x) => {
            const Icon = x.icon
            const disabled = x.off(b)
            const active = b.paneOpen && b.pane === x.id
            return (
              <motion.button
                key={x.id}
                disabled={disabled}
                whileHover={disabled ? undefined : { y: -2 }}
                whileTap={disabled ? undefined : { scale: 0.94 }}
                onClick={() => useBuild.getState().set(active ? { paneOpen: false } : { paneOpen: true, pane: x.id })}
                className={`group relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors disabled:opacity-30 ${active ? 'bg-accent-soft text-accent shadow-[inset_0_0_0_1px_rgba(47,107,93,.25)]' : 'text-ink-3 hover:bg-surface-2 hover:text-ink'}`}
              >
                <Icon size={17} />
                <span className="text-[8px] leading-none">{T(x.es, x.en).split(' ')[0]}</span>
                {x.id === 'app' && b.appRun.status === 'running' && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-ok animate-pulse" />}
                {x.id === 'versions' && b.versions.length > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full border border-surface bg-accent px-1 text-[8px] font-bold leading-[13px] text-white">{b.versions.length}</span>}
                <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium normal-case text-paper opacity-0 shadow-lg transition group-hover:opacity-100">{T(x.es, x.en)}{disabled ? ` · ${T('todavía no', 'not yet')}` : ''}</span>
              </motion.button>
            )
          })}
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.94 }} onClick={() => useBuild.getState().set({ paneOpen: !b.paneOpen })} title={b.paneOpen ? T('Cerrar el panel', 'Close the panel') : T('Abrir el panel', 'Open the panel')} className="mt-auto flex h-11 w-11 items-center justify-center rounded-xl text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink">
            <motion.span animate={{ rotate: b.paneOpen ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }} className="flex"><ChevronLeft size={16} /></motion.span>
          </motion.button>
        </div>
      </div>
    </div>
  )
}

function Bubble({ c, color, provider, onOpen }: { c: ChatItem; color: string; provider: string | null; onOpen: (p: string) => void }) {
  const T = useT()
  if (c.role === 'system') {
    return <div className="text-center text-[12px] text-ink-3"><span className="rounded-full bg-surface-2 border border-line px-3 py-1">{c.text}</span></div>
  }
  if (c.role === 'report') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border-2 border-accent bg-accent-soft/40 p-4">
        <div className="flex items-center gap-2 font-semibold"><FileText size={18} className="text-accent" /> {T('Informe de auditoría listo', 'Audit report ready')}</div>
        <div className="mt-1 text-[12.5px] text-ink-2">{(c.text ?? '').split('\n').find((l) => l.startsWith('>'))?.replace(/^>\s*/, '') || T('Abrilo en la pestaña Informe (derecha) o descargalo como .md.', 'Open it in the Report tab (right) or download it as .md.')}</div>
        <button onClick={() => useBuild.getState().set({ paneOpen: true, pane: 'report' })} className="mt-2 text-sm font-semibold text-accent hover:underline">{T('Ver informe completo →', 'See full report →')}</button>
      </motion.div>
    )
  }
  if (c.role === 'user') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-accent text-white px-4 py-2.5 text-[14px] whitespace-pre-wrap">{c.text}</div>
      </motion.div>
    )
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <span className="shrink-0 w-8 h-8 rounded-full bg-surface border flex items-center justify-center" style={{ borderColor: `${color}66` }}><ProviderLogo provider={provider} size={18} /></span>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-surface border border-line px-4 py-3">
        <div className="text-[10px] font-mono text-ink-4 mb-1">{T('turno', 'turn')} {c.turn}{c.phase === 'preview' ? T(' · 🖼 vista previa del producto', ' · 🖼 product preview') : c.phase === 'design' ? T(' · 🎨 diseño de la interfaz', ' · 🎨 interface design') : ''}</div>
        {c.activity && (c.activity.written + c.activity.edited + c.activity.commands + c.activity.tests > 0) && (
          <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
            {c.activity.written > 0 && <span className="rounded-full bg-ok/10 text-ok px-2 py-0.5">✍️ {c.activity.written} {c.activity.written === 1 ? T('archivo nuevo', 'new file') : T('archivos nuevos', 'new files')}</span>}
            {c.activity.edited > 0 && <span className="rounded-full bg-accent-soft text-accent px-2 py-0.5">✏️ {c.activity.edited} {c.activity.edited === 1 ? T('edición', 'edit') : T('ediciones', 'edits')}</span>}
            {c.activity.tests > 0 && <span className="rounded-full bg-gold/15 text-gold px-2 py-0.5">🧪 tests ×{c.activity.tests}</span>}
            {c.activity.commands > 0 && <span className="rounded-full bg-surface-2 text-ink-2 px-2 py-0.5">⚙️ {c.activity.commands} {c.activity.commands === 1 ? T('comando', 'command') : T('comandos', 'commands')}</span>}
          </div>
        )}
        {c.say && <div className="md text-[14px]" dangerouslySetInnerHTML={{ __html: md(c.say) }} />}
        {!!c.files?.length && c.files.length <= 8 && <div className="mt-3 space-y-1.5">{c.files.map((p) => <FileChip key={p} path={p} done onOpen={() => onOpen(p)} />)}</div>}
        {!!c.files?.length && c.files.length > 8 && <ManyFiles files={c.files} onOpen={onOpen} />}
        {c.stage && <div className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-[13px] md" dangerouslySetInnerHTML={{ __html: md(`**${T('Etapa', 'Stage')} ${c.stage.n} ${T('cerrada.', 'closed.')}** ${c.stage.text}`) }} />}
        {c.done && <div className="mt-3 rounded-lg bg-ok/10 px-3 py-2 text-[13px] md" dangerouslySetInnerHTML={{ __html: md(T('🎉 **Producto terminado.** ', '🎉 **Product finished.** ') + c.done) }} />}
      </div>
    </motion.div>
  )
}

const ACT_ICON: Record<Activity['kind'], string> = { read: '📖', write: '✍️', edit: '✏️', search: '🔍', run: '⚙️', test: '🧪', install: '📦', build: '🛠️', git: '💾', plan: '🗂️', think: '💭' }

/** What the local agent is doing, as cards: current step, its plan, the files it touched, the last steps, and a live thumbnail. */
function LiveActivity({ activity, todos, elapsed, files, thinking, lastEventTs, previewHtml }: { activity: Activity[]; todos: Todo[]; elapsed: number; files: number; thinking: string; lastEventTs: number; previewHtml: string | null }) {
  const T = useT()
  const [open, setOpen] = useState(false)
  // heartbeat: seconds since the agent last said/did anything (so a long tool call never looks like a crash)
  const [quiet, setQuiet] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setQuiet(lastEventTs ? Math.round((Date.now() - lastEventTs) / 1000) : 0), 1000)
    return () => clearInterval(id)
  }, [lastEventTs])
  const cur = activity[activity.length - 1]
  const done = todos.filter((t) => t.status === 'completed').length
  const pct = todos.length ? Math.round((done / todos.length) * 100) : 0
  const inProgress = todos.find((t) => t.status === 'in_progress')
  const counts = activity.reduce((a, x) => ({ ...a, [x.kind]: (a[x.kind] ?? 0) + 1 }), {} as Record<string, number>)
  const touched = [...new Set(activity.filter((a) => (a.kind === 'write' || a.kind === 'edit') && a.path).map((a) => a.path))]
  const card = 'rounded-xl border border-line bg-paper px-3 py-2.5 min-w-0'
  const label = 'text-[10px] uppercase tracking-widest text-ink-3 mb-1.5'
  return (
    <div className="text-[13px]">
      {/* now */}
      <div className={`${card} border-accent/40 bg-accent-soft/40`}>
        <div className="flex items-center gap-2">
          <span className="flex gap-1 shrink-0">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
          <span className="shrink-0 text-base">{cur ? (ACT_ICON[cur.kind] ?? '⚙️') : '💭'}</span>
          <span className="font-semibold truncate">{cur ? cur.label : T('Arrancando', 'Starting')}{cur?.path ? <span className="font-mono font-normal text-ink-2"> {cur.path}</span> : ''}</span>
          <span className="ml-auto font-mono text-[11px] text-ink-3 shrink-0">{elapsed}s</span>
        </div>
        {cur?.kind === 'think' && (
          <div className="mt-1.5 rounded-lg bg-surface/80 px-3 py-2 text-[12px] italic text-ink-2 max-h-20 overflow-hidden">
            {thinking.trim() ? <span className="whitespace-pre-wrap">…{thinking.slice(-280)}</span> : T('Razonando el próximo paso…', 'Reasoning about the next step…')}
          </div>
        )}
        {quiet >= 12 && cur?.kind !== 'think' && (
          <div className="mt-1.5 text-[11.5px] text-ink-3">{T('Sigue trabajando', 'Still working')} ({cur?.kind === 'install' ? T('instalar dependencias', 'installing dependencies') : cur?.kind === 'test' ? T('correr los tests', 'running the tests') : cur?.kind === 'build' ? T('compilar', 'compiling') : T('este paso', 'this step')} {T('puede tardar', 'can take a while')}) · {T('sin novedades hace', 'no news for')} {quiet}s</div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {/* plan */}
        <div className={`${card} ${todos.length ? '' : 'opacity-70'}`}>
          <div className={label}>{T('Plan del constructor', 'Builder plan')}{todos.length ? ` · ${done}/${todos.length}` : ''}</div>
          {todos.length ? (
            <>
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${Math.max(pct, inProgress ? 4 : 0)}%` }} /></div>
              <ul className="mt-2 space-y-0.5 max-h-32 overflow-y-auto scroll-thin">
                {todos.map((t, i) => (
                  <li key={i} className={`flex items-start gap-1.5 text-[11.5px] ${t.status === 'completed' ? 'text-ink-3 line-through' : t.status === 'in_progress' ? 'text-ink font-medium' : 'text-ink-2'}`}>
                    {t.status === 'completed' ? <CheckCircle2 size={12} className="text-ok shrink-0 mt-0.5" /> : t.status === 'in_progress' ? <span className="w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0 mt-0.5" /> : <Circle size={12} className="text-ink-4 shrink-0 mt-0.5" />}
                    <span className="line-clamp-2">{t.text}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="text-[11.5px] text-ink-3">{T('Todavía no armó su lista de pasos.', 'It has not put together its step list yet.')}</div>
          )}
        </div>
        {/* files touched */}
        <div className={card}>
          <div className={label}>{T('Archivos tocados', 'Files touched')} · {touched.length}{files ? ` ${T('de', 'of')} ${files}` : ''}</div>
          {touched.length ? (
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto scroll-thin">
              {touched.slice(-14).map((p) => <span key={p} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-2 truncate max-w-full" title={p}>{p.split('/').slice(-2).join('/')}</span>)}
            </div>
          ) : (
            <div className="text-[11.5px] text-ink-3">{T('Leyendo el proyecto antes de escribir.', 'Reading the project before writing.')}</div>
          )}
          <div className="mt-2 flex flex-wrap gap-1 text-[10.5px]">
            {counts.test ? <span className="rounded-full bg-gold/15 text-gold px-1.5 py-0.5">🧪 tests ×{counts.test}</span> : null}
            {counts.install ? <span className="rounded-full bg-surface-2 text-ink-2 px-1.5 py-0.5">{T('📦 dependencias', '📦 dependencies')}</span> : null}
            {counts.build ? <span className="rounded-full bg-surface-2 text-ink-2 px-1.5 py-0.5">{T('🛠️ compila', '🛠️ builds')} ×{counts.build}</span> : null}
            <span className="rounded-full bg-surface-2 text-ink-2 px-1.5 py-0.5">{activity.length} {activity.length === 1 ? T('paso', 'step') : T('pasos', 'steps')}</span>
          </div>
        </div>
        {/* last steps */}
        <div className={card}>
          <div className={label}>{T('Últimos pasos', 'Last steps')}</div>
          <ul className="space-y-0.5 text-[11.5px] text-ink-2">
            {activity.slice(-5).reverse().map((a, i) => <li key={i} className="flex gap-1.5 truncate"><span>{ACT_ICON[a.kind] ?? '⚙️'}</span><span className="truncate">{a.label}{a.path ? <span className="font-mono text-ink-3"> {a.path}</span> : ''}</span></li>)}
          </ul>
          {activity.length > 5 && <button onClick={() => setOpen(!open)} className="mt-1.5 flex items-center gap-1 text-[10.5px] text-ink-3 hover:text-ink"><ChevronDown size={11} className={`transition ${open ? 'rotate-180' : ''}`} /> {open ? T('menos', 'less') : `${T('ver', 'see')} ${Math.min(30, activity.length)}`}</button>}
          {open && <ul className="mt-1 space-y-0.5 text-[11px] text-ink-3 font-mono max-h-40 overflow-y-auto scroll-thin">{activity.slice(-30).reverse().map((a, i) => <li key={i} className="truncate">{ACT_ICON[a.kind] ?? '⚙️'} {a.label}{a.path ? ` ${a.path}` : ''}</li>)}</ul>}
        </div>
        {/* live thumbnail of the product */}
        <div className={`${card} p-0 overflow-hidden`}>
          <div className={`${label} px-3 pt-2.5`}>{T('Cómo va quedando', 'How it is shaping up')}</div>
          {previewHtml ? (
            <button onClick={() => useBuild.getState().set({ paneOpen: true, pane: 'preview' })} className="block w-full h-28 relative bg-white" title={T('Abrir la vista previa', 'Open the preview')}>
              <iframe title={T('miniatura', 'thumbnail')} sandbox="allow-scripts" srcDoc={previewHtml} className="absolute top-0 left-0 w-[400%] h-[400%] origin-top-left scale-[0.25] pointer-events-none" />
            </button>
          ) : (
            <div className="px-3 pb-3 text-[11.5px] text-ink-3">{T('La miniatura aparece cuando el constructor genera la vista previa (al final de la etapa).', 'The thumbnail appears when the builder generates the preview (at the end of the stage).')}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function ManyFiles({ files, onOpen }: { files: string[]; onOpen: (p: string) => void }) {
  const T = useT()
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[12px] text-accent hover:underline"><ChevronDown size={12} className={`transition ${open ? 'rotate-180' : ''}`} /> {files.length} {T('archivos escritos', 'files written')}</button>
      {open && <div className="mt-1.5 space-y-1.5">{files.map((p) => <FileChip key={p} path={p} done onOpen={() => onOpen(p)} />)}</div>}
    </div>
  )
}

function FileChip({ path, done, lines, onOpen }: { path: string; done?: boolean; lines?: number; onOpen: () => void }) {
  const T = useT()
  return (
    <button onClick={onOpen} className="w-full flex items-center gap-2 rounded-lg border border-line bg-paper hover:bg-surface-2 px-2.5 py-1.5 text-left font-mono text-[12px]">
      <FileCode2 size={13} className={done ? 'text-ok' : 'text-accent animate-pulse'} />
      <span className="truncate">{path}</span>
      <span className="ml-auto text-[10px] text-ink-4">{done ? T('escrito', 'written') : `${lines ?? 0} ${T('líneas…', 'lines…')}`}</span>
    </button>
  )
}

// ------------------------------------------------------------------ tree
interface Node {
  name: string
  path: string
  children?: Node[]
}

function buildTree(paths: string[]): Node[] {
  const root: Node[] = []
  for (const p of [...new Set(paths)].sort()) {
    const parts = p.split('/')
    let level = root
    let acc = ''
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part
      let node = level.find((n) => n.name === part)
      if (!node) {
        node = i < parts.length - 1 ? { name: part, path: acc, children: [] } : { name: part, path: acc }
        level.push(node)
        level.sort((a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name))
      }
      if (node.children) level = node.children
    })
  }
  return root
}

function TreeNode({ node, depth, selected, live, onSelect }: { node: Node; depth: number; selected: string | null; live: string | null; onSelect: (p: string) => void }) {
  const [open, setOpen] = useState(true)
  if (node.children) {
    return (
      <div>
        <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-1.5 px-2 py-1 text-ink-2 hover:bg-surface-2" style={{ paddingLeft: 8 + depth * 14 }}>
          <Folder size={13} className="text-ink-3" /> {node.name}
        </button>
        {open && node.children.map((c) => <TreeNode key={c.path} node={c} depth={depth + 1} selected={selected} live={live} onSelect={onSelect} />)}
      </div>
    )
  }
  const isSel = selected === node.path
  return (
    <button onClick={() => onSelect(node.path)} className={`w-full flex items-center gap-1.5 px-2 py-1 text-left truncate ${isSel ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-surface-2'}`} style={{ paddingLeft: 8 + depth * 14 }}>
      <FileCode2 size={13} className={live === node.path ? 'text-accent animate-pulse' : 'text-ink-4'} /> <span className="truncate">{node.name}</span>
    </button>
  )
}


/** The designer's mockup is ready and the build waits: approve it, or send change requests for another design round. */
function DesignReviewCard() {
  const T = useT()
  const b = useBuild()
  const [fb, setFb] = useState('')
  const [busy, setBusy] = useState(false)
  const approve = async () => {
    setBusy(true)
    try {
      await api.buildDesignApprove(b.id!, b.sessionId)
      useBuild.getState().set({ status: 'connecting' })
      reconnectBuild(b.id!)
      toast.ok(tr('Diseño aprobado', 'Design approved'), tr('El constructor empieza a escribir el código siguiendo el mockup.', 'The builder starts writing the code following the mockup.'))
    } catch (e) {
      toast.error(tr('No se pudo aprobar', 'Could not approve'), (e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const redo = async () => {
    if (!fb.trim()) return
    setBusy(true)
    try {
      await api.buildDesignRedo(b.id!, fb.trim(), b.sessionId)
      useBuild.getState().set({ status: 'connecting' })
      reconnectBuild(b.id!)
      setFb('')
      toast.ok(tr('Rediseñando', 'Redesigning'), tr('El diseñador aplica tus cambios y te muestra la nueva versión.', 'The designer applies your changes and shows you the new version.'))
    } catch (e) {
      toast.error(tr('No se pudo pedir el rediseño', 'Could not request the redesign'), (e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rounded-2xl border-2 border-accent/40 bg-accent-soft/40 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 font-semibold text-ink"><Palette size={16} className="text-accent" /> {T('El diseño está listo. ¿Construimos así?', 'The design is ready. Build it like this?')}</div>
      <p className="mt-1 text-[12.5px] text-ink-2">{T('Mirá el mockup en la pestaña Diseño (pantallas navegables, tokens y DESIGN.md). Todavía no hay código: si algo no te gusta, pedí cambios y el diseñador hace otra ronda antes de construir.', 'Look at the mockup in the Design tab (navigable screens, tokens and DESIGN.md). There is no code yet: if something is off, ask for changes and the designer does another round before building.')}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => useBuild.getState().set({ paneOpen: true, pane: 'design' })} className="flex items-center gap-1.5 rounded-xl border border-line bg-paper px-3 py-1.5 text-[12.5px] hover:bg-surface-2"><Eye size={14} /> {T('Ver el mockup', 'View the mockup')}</button>
        <button type="button" onClick={approve} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {T('Me gusta, construir', 'I like it, build')}</button>
      </div>
      <textarea value={fb} onChange={(e) => setFb(e.target.value)} placeholder={T('ej.: paleta más oscura y moderna, el dato del clima como protagonista, menos tarjetas, tipografía más grande, parecido a Apple Weather…', 'e.g.: darker, modern palette, the weather number as the hero, fewer cards, larger type, close to Apple Weather…')} className="mt-2 h-20 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-[12.5px] outline-none focus:border-accent" />
      <button type="button" onClick={redo} disabled={busy || !fb.trim()} className="mt-1.5 flex items-center gap-1.5 rounded-xl border border-accent/50 bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-accent disabled:opacity-40"><Palette size={14} /> {T('Rediseñar con estos cambios', 'Redesign with these changes')} {b.designRounds ? `(${T('ronda', 'round')} ${b.designRounds + 1})` : ''}</button>
    </div>
  )
}
