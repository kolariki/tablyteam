import { ChevronDown, ExternalLink, Loader2, Play, RefreshCw, Square, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { reconnectBuild, useBuild } from '../buildStore'
import { api, type RunService } from '../lib/api'
import { tr, useT } from '../lib/i18n'
import { toast } from './Toast'

const STEP = (): Record<string, string> => ({
  installing: tr('Instalando dependencias…', 'Installing dependencies…'),
  starting: tr('Arrancando el servidor…', 'Starting the server…'),
  running: tr('Corriendo', 'Running'),
  stopped: tr('Detenida', 'Stopped'),
  error: tr('No arrancó', 'Did not start'),
  idle: tr('Lista para correr', 'Ready to run'),
})

/** "App real": run the built product on this machine and show it live (instead of the static prototype). */
export default function AppRunner({ autoStart = false }: { autoStart?: boolean }) {
  const T = useT()
  const b = useBuild()
  const run = b.appRun
  const [services, setServices] = useState<RunService[] | null>(null)
  const [service, setService] = useState<string>('')
  const [logsOpen, setLogsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [frameKey, setFrameKey] = useState(0)
  const logRef = useRef<HTMLPreElement>(null)
  const step = STEP()

  const load = () => {
    if (!b.sessionId || !b.id) return
    api.appRun(b.sessionId, b.id).then((d) => {
      setServices(d.services)
      setService((s) => s || d.run?.service || d.services.find((x) => x.web)?.id || d.services[0]?.id || '')
    }).catch((e) => toast.error(tr('No pude analizar el proyecto', 'Could not analyze the project'), (e as Error).message))
  }
  useEffect(load, [b.sessionId, b.id, Object.keys(b.files).length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [run.logs.length])
  useEffect(() => {
    if (run.status === 'error') setLogsOpen(true)
  }, [run.status])
  // opened from "Correr la app": start right away if nothing is running yet
  const [autoDone, setAutoDone] = useState(false)
  useEffect(() => {
    if (!autoStart || autoDone || !services || !service || !b.sessionId || !b.id) return
    if (run.status === 'idle' || run.status === 'stopped') {
      setAutoDone(true)
      api.appStart(b.sessionId, b.id, service).then(() => reconnectBuild(b.id!)).catch((e) => toast.error(tr('No se pudo correr la app', 'Could not run the app'), (e as Error).message))
    } else setAutoDone(true)
  }, [autoStart, autoDone, services, service, run.status, b.sessionId, b.id])

  const start = async () => {
    if (!b.sessionId || !b.id || !service) return
    setBusy(true)
    try {
      await api.appStart(b.sessionId, b.id, service)
      reconnectBuild(b.id) // the build's websocket carries app.status / app.log
    } catch (e) {
      toast.error(tr('No se pudo correr la app', 'Could not run the app'), (e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const stop = async () => {
    if (!b.sessionId || !b.id) return
    await api.appStop(b.sessionId, b.id).catch(() => {})
  }
  const askFix = async () => {
    if (!b.id) return
    const tail = run.logs.slice(-40).join('\n')
    const text = `Al correr la app (${run.label ?? run.service}) falló: ${run.error ?? ''}\n\nÚltimas líneas del log:\n\`\`\`\n${tail}\n\`\`\`\nArreglalo para que arranque con \`${services?.find((s) => s.id === run.service)?.run ?? 'el comando de dev'}\` y quede navegable.`
    await api.buildMessage(b.id, text, b.sessionId).catch((e) => toast.error(tr('No se pudo enviar', 'Could not send'), (e as Error).message))
    useBuild.getState().set({ status: 'connecting', error: null, pane: 'code' })
    reconnectBuild(b.id)
  }

  const active = run.status === 'installing' || run.status === 'starting' || run.status === 'running'
  const sel = services?.find((s) => s.id === service)

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-surface">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-line">
        {services === null ? (
          <span className="text-[12.5px] text-ink-3">{T('Analizando el proyecto…', 'Analyzing the project…')}</span>
        ) : services.length === 0 ? (
          <span className="text-[12.5px] text-ink-2">{T('No encontré nada que se pueda correr (sin package.json con script ', 'Found nothing runnable (no package.json with a ')}<code className="font-mono">dev</code>{T(', ni API Python, ni docker compose).', ' script, no Python API, no docker compose).')}</span>
        ) : (
          <>
            <select disabled={active} value={service} onChange={(e) => setService(e.target.value)} className="rounded-lg bg-paper border border-line px-2.5 py-1.5 text-[12.5px] disabled:opacity-60">
              {services.map((s) => <option key={s.id} value={s.id}>{s.label}{s.web ? '' : T(' (sin UI)', ' (no UI)')}</option>)}
            </select>
            {!active ? (
              <button disabled={busy || !service} onClick={start} className="flex items-center gap-1.5 rounded-lg bg-accent text-white px-3 py-1.5 text-[12.5px] font-semibold hover:brightness-110 disabled:opacity-40">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} {T('Correr la app', 'Run the app')}
              </button>
            ) : (
              <button onClick={stop} className="flex items-center gap-1.5 rounded-lg border border-danger/40 text-danger px-3 py-1.5 text-[12.5px] font-semibold hover:bg-danger/5"><Square size={13} /> {T('Detener', 'Stop')}</button>
            )}
            <span className={`flex items-center gap-1.5 text-[12px] ${run.status === 'running' ? 'text-ok' : run.status === 'error' ? 'text-danger' : 'text-ink-3'}`}>
              {(run.status === 'installing' || run.status === 'starting') && <Loader2 size={12} className="animate-spin" />}
              {run.status === 'running' && <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />}
              {step[run.status] ?? run.status}{run.status === 'running' && run.url ? ` ${T('en', 'at')} ${run.url}` : ''}
            </span>
            {run.status === 'running' && run.url && (
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => setFrameKey((k) => k + 1)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-ink-3 hover:text-ink"><RefreshCw size={12} /> {T('recargar', 'reload')}</button>
                <a href={run.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-ink-3 hover:text-ink"><ExternalLink size={12} /> {T('abrir en pestaña', 'open in tab')}</a>
              </div>
            )}
          </>
        )}
      </div>
      {sel && !active && run.status !== 'error' && (
        <div className="px-3 py-1.5 text-[11.5px] text-ink-3 border-b border-line font-mono">{sel.dir === '.' ? '' : `${sel.dir}/ · `}{sel.needs_install ? `${sel.install} → ` : ''}{sel.run.replace('{port}', T('<puerto libre>', '<free port>'))}</div>
      )}

      {/* body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {run.status === 'running' && run.url && sel?.web !== false ? (
          <div className="flex-1 min-h-0 p-3">
            <div className="h-full rounded-xl border border-line bg-white overflow-hidden shadow-sm">
              <div className="flex items-center gap-1.5 px-3 h-7 border-b border-line bg-surface-2/70"><span className="w-2 h-2 rounded-full bg-[#E6A19A]" /><span className="w-2 h-2 rounded-full bg-[#E9C97A]" /><span className="w-2 h-2 rounded-full bg-[#9FCDA8]" /><span className="ml-2 text-[10px] font-mono text-ink-3">{run.url} · {T('la app real, corriendo en esta máquina', 'the real app, running on this machine')}</span></div>
              <iframe key={frameKey} title={T('App corriendo', 'App running')} src={run.embedUrl ?? run.url} className="w-full h-[calc(100%-28px)] bg-white" />
            </div>
          </div>
        ) : run.status === 'error' ? (
          <div className="p-4">
            <div className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3">
              <div className="font-semibold text-danger">{run.error ?? T('La app no arrancó', 'The app did not start')}</div>
              <div className="mt-1 text-[12.5px] text-ink-2">{T('Pasa seguido en una primera corrida (una dependencia que falta, una variable de entorno, un puerto). Podés pedirle al constructor que lo arregle con el log, y volver a correrla.', 'This often happens on a first run (a missing dependency, an environment variable, a port). You can ask the builder to fix it using the log, then run it again.')}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={askFix} className="flex items-center gap-1.5 rounded-lg bg-accent text-white px-3 py-1.5 text-[12.5px] font-semibold hover:brightness-110"><Wrench size={13} /> {T('Pedirle al constructor que lo arregle', 'Ask the builder to fix it')}</button>
                <button onClick={start} className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px]"><Play size={13} /> {T('Reintentar', 'Retry')}</button>
              </div>
            </div>
          </div>
        ) : run.status === 'installing' || run.status === 'starting' ? (
          <div className="p-6 text-center text-sm text-ink-2">
            <Loader2 size={22} className="mx-auto animate-spin text-accent" />
            <div className="mt-2 font-medium">{step[run.status]}</div>
            <div className="mt-1 text-[12px] text-ink-3">{run.status === 'installing' ? T('La primera vez puede tardar unos minutos.', 'The first time may take a few minutes.') : T('Esperando a que el servidor responda en el puerto asignado…', 'Waiting for the server to respond on the assigned port…')}</div>
          </div>
        ) : services && services.length > 0 ? (
          <div className="p-6 text-center text-sm text-ink-2">
            <div className="text-3xl">🖥️</div>
            <div className="mt-2 font-medium">{T('Corré la app real acá adentro', 'Run the real app right here')}</div>
            <div className="mt-1 text-[12px] text-ink-3 max-w-md mx-auto">{T('Instala lo que falte, levanta el servidor de desarrollo en un puerto libre de esta máquina y la muestra en este panel. Las variables de «Servicios y deploy» se cargan como ', 'It installs what is missing, starts the dev server on a free port on this machine and shows it in this panel. The variables from "Services & deploy" are loaded as ')}<code className="font-mono">.env</code>.</div>
          </div>
        ) : null}

        {/* logs */}
        {(run.logs.length > 0 || active) && (
          <div className={`border-t border-line ${logsOpen ? 'h-56' : ''} flex flex-col shrink-0`}>
            <button onClick={() => setLogsOpen(!logsOpen)} className="flex items-center gap-1 px-3 py-1.5 text-[11.5px] text-ink-3 hover:text-ink"><ChevronDown size={12} className={`transition ${logsOpen ? 'rotate-180' : ''}`} /> {T('logs del servidor', 'server logs')} ({run.logs.length})</button>
            {logsOpen && <pre ref={logRef} className="flex-1 min-h-0 overflow-auto scroll-thin bg-[#1E2622] text-[#E6ECE8] px-3 py-2 text-[11px] font-mono whitespace-pre-wrap">{run.logs.join('\n')}</pre>}
          </div>
        )}
      </div>
    </div>
  )
}
