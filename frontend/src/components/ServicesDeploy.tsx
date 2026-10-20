import { AnimatePresence } from 'framer-motion'
import { BookOpen, CheckCircle2, Download, ExternalLink, Loader2, Rocket, Save, XCircle } from 'lucide-react'
import ServiceGuide from './ServiceGuide'
import ProviderLogo, { logoUrl } from './ProviderLogo'
import { useEffect, useRef, useState } from 'react'
import { useBuild } from '../buildStore'
import { api, type ServicesInfo } from '../lib/api'
import { useT } from '../lib/i18n'
import { downloadBlob } from '../lib/recorder'

/** Services whose logo the app already ships (so the card can show the brand instead of an initial). */
const PROVIDER_OF: Record<string, string> = { OpenAI: 'openai', Anthropic: 'anthropic', 'Google AI Studio': 'gemini', Vercel: 'vercel', Railway: 'railway', Langfuse: 'langfuse', Mistral: 'mistral', Groq: 'groq' }

// the last analysis per build: the pane opens with it at once and refreshes quietly behind
const infoCache = new Map<string, ServicesInfo>()

/** Right-pane tab: every external service / API key the built app needs, with values, plus one-click deploy. */
export default function ServicesDeploy({ onOpenSettings }: { onOpenSettings: () => void }) {
  const T = useT()
  const b = useBuild()
  const [info, setInfo] = useState<ServicesInfo | null>(() => (b.id ? infoCache.get(b.id) ?? null : null))
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [target, setTarget] = useState<string>('vercel')
  const [error, setError] = useState<string | null>(null)
  const [guide, setGuide] = useState<ServicesInfo['groups'][number] | null>(null)
  const logRef = useRef<HTMLPreElement>(null)

  const reload = () => {
    if (!b.sessionId || !b.id) return
    const id = b.id
    api.services(b.sessionId, b.id).then((d) => {
      infoCache.set(id, d)
      setInfo(d)
      setTarget((t) => (d.deploy_targets.some((x) => x.id === t) ? t : d.recommended_target))
    }).catch((e) => setError(e.message))
  }
  useEffect(reload, [b.sessionId, b.id, b.status === 'completed' || b.status === 'approved' || b.status === 'audited', Object.keys(b.files).length])
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [b.deployLogs.length])

  if (!info) return <div className="p-6 text-sm text-ink-3">{error ?? T('Analizando el proyecto…', 'Analyzing the project…')}</div>

  const dirty = Object.keys(values).length > 0
  const save = async () => {
    if (!b.sessionId || !b.id) return
    setSaving(true)
    setError(null)
    try {
      await api.saveServices(b.sessionId, b.id, values)
      setValues({})
      setSavedAt(Date.now())
      reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const tgt = info.deploy_targets.find((t) => t.id === target)
  const missing = info.missing.filter((v) => !values[v])
  const lastDeploy = [...(b.deploys ?? [])].reverse()[0]

  return (
    <div className="h-full overflow-y-auto scroll-thin p-5 space-y-6 bg-surface">
      {/* ---------- services */}
      <section>
        <div className="text-[11px] uppercase tracking-[0.3em] text-accent">{T('Servicios externos', 'External services')}</div>
        <div className="mt-1 flex items-end gap-3">
          <h3 className="text-2xl">{T('Lo que la app necesita para funcionar', 'What the app needs to work')}</h3>
          <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${missing.length ? 'border-gold/40 bg-gold/10 text-gold' : 'border-ok/30 bg-ok/10 text-ok'}`}>
            {missing.length ? <><span className="h-2 w-2 rounded-full bg-gold" /> {T('faltan', 'missing')} {missing.length}</> : <><span className="h-2 w-2 rounded-full bg-ok shadow-[0_0_0_3px_rgba(23,137,106,.18)]" /> {T('todo configurado', 'all configured')}</>}
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-2">
          {T('Cuentas, keys y URLs que el proyecto declara en su ', 'Accounts, keys and URLs the project declares in its ')}<code className="font-mono">.env.example</code>{T(' y en el brief. Cada servicio tiene una guía paso a paso para conseguirlo; lo que cargás se guarda cifrado y va al deploy como variable de entorno, nunca al código.', ' and in the brief. Each service has a step-by-step guide to get it; what you enter is stored encrypted and goes to the deploy as an environment variable, never into the code.')}
        </p>
        {info.groups.length === 0 && <div className="mt-4 rounded-2xl border border-line bg-paper px-4 py-4 text-sm text-ink-3">{T('El proyecto no declara variables de entorno: no requiere servicios externos.', 'The project declares no environment variables: it needs no external services.')}</div>}
        <div className="mt-4 grid gap-3 grid-cols-[repeat(auto-fill,minmax(420px,1fr))]">
          {info.groups.map((g) => {
            const pending = g.vars.filter((v) => v.required && !v.configured && !values[v.var]).length
            const pid = PROVIDER_OF[g.service] ?? null
            return (
              <div key={g.service} className={`relative flex flex-col rounded-2xl border bg-paper p-4 shadow-[0_12px_28px_-18px_rgba(30,38,34,.45)] transition hover:shadow-[0_16px_36px_-18px_rgba(30,38,34,.5)] ${pending ? 'border-line' : 'border-ok/40'}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[15px] font-bold text-accent shadow-sm">
                    {pid && logoUrl(pid) ? <ProviderLogo provider={pid} size={24} /> : g.service.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[16px] font-semibold">{g.service}</span>
                      <span className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${pending ? 'border-gold/40 bg-gold/10 text-gold' : 'border-ok/30 bg-ok/10 text-ok'}`}>
                        {pending ? <>{T('faltan', 'missing')} {pending}</> : <><span className="h-1.5 w-1.5 rounded-full bg-ok" /> {T('configurado', 'configured')}</>}
                      </span>
                    </div>
                    {g.purpose && <div className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{g.purpose}</div>}
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {g.vars.map((v) => (
                    <div key={v.var} className="grid grid-cols-[minmax(150px,1fr)_1.3fr_auto] items-center gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[12px] font-semibold" title={v.var}>{v.var}</div>
                        {(v.note || v.cost) && <div className="truncate text-[11px] text-ink-3" title={v.note ?? ''}>{v.note}{v.cost ? ` · ${v.cost}` : ''}</div>}
                      </div>
                      <input
                        type={v.secret ? 'password' : 'text'}
                        autoComplete="off"
                        placeholder={v.configured ? T('•••••••• (guardada)', '•••••••• (saved)') : v.example || (v.required ? T('requerida', 'required') : T('opcional', 'optional'))}
                        value={values[v.var] ?? ''}
                        onChange={(e) => setValues({ ...values, [v.var]: e.target.value })}
                        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px] shadow-sm outline-none transition focus:border-accent"
                      />
                      <span className="flex w-5 justify-center">{v.configured || values[v.var] ? <CheckCircle2 size={15} className="text-ok" /> : v.required ? <XCircle size={15} className="text-gold" /> : <span className="text-[10px] text-ink-4">{T('opc.', 'opt.')}</span>}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                  <button onClick={() => setGuide(g)} className="flex h-8 items-center gap-1.5 rounded-full border border-accent/40 bg-surface px-3 text-[12.5px] font-medium text-accent shadow-sm transition hover:-translate-y-0.5 hover:bg-accent/5">
                    <BookOpen size={13} /> {T('Cómo conseguirlo', 'How to get it')}
                  </button>
                  {g.url && g.url.startsWith('http') && <a href={g.url} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-[12px] text-ink-3 transition hover:text-accent">{T('ir al panel', 'open the dashboard')} <ExternalLink size={11} /></a>}
                </div>
              </div>
            )
          })}
        </div>
        {info.groups.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <button disabled={!dirty || saving} onClick={save} className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-40 disabled:hover:translate-y-0">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {T('Guardar valores', 'Save values')}
            </button>
            <button onClick={async () => b.sessionId && b.id && downloadBlob(new Blob([await api.envFile(b.sessionId, b.id)], { type: 'text/plain' }), '.env')} className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:text-accent">
              <Download size={14} /> {T('Descargar .env', 'Download .env')}
            </button>
            {savedAt && !dirty && <span className="text-[12px] text-ok">{T('guardado', 'saved')}</span>}
          </div>
        )}
      </section>
      <AnimatePresence>
        {guide && b.sessionId && b.id && <ServiceGuide key={guide.service} group={guide} sessionId={b.sessionId} buildId={b.id} onClose={() => setGuide(null)} onSaved={() => { setSavedAt(Date.now()); reload() }} />}
      </AnimatePresence>

      {/* ---------- deploy */}
      <section className="rounded-2xl border border-line bg-paper p-5 shadow-[0_12px_28px_-18px_rgba(30,38,34,.45)]">
        <div className="text-[11px] uppercase tracking-[0.3em] text-accent">{T('Publicar', 'Publish')}</div>
        <div className="mt-1 flex items-center gap-2">
          <Rocket size={18} className="text-accent" />
          <h3 className="text-2xl">{T('Deploy automático', 'Automatic deploy')}</h3>
          {info.stack.length > 0 && <span className="ml-auto font-mono text-[11px] text-ink-3">{info.stack.join(' · ')}</span>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {info.deploy_targets.map((t) => (
            <button key={t.id} onClick={() => setTarget(t.id)} className={`rounded-xl border p-3 text-left transition ${target === t.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}>
              <div className="flex items-center gap-2 font-semibold">{t.label}{info.recommended_target === t.id && <span className="rounded-full bg-accent text-white px-1.5 py-0.5 text-[9px] uppercase">{T('recomendado', 'recommended')}</span>}</div>
              <div className="text-[11.5px] text-ink-3">{t.good_for}</div>
              <div className={`mt-1.5 text-[11px] font-medium ${t.ok ? 'text-ok' : 'text-gold'}`}>{t.ok ? (t.token ? T('✓ token cargado', '✓ token set') : T('✓ CLI logueado', '✓ CLI logged in')) : t.installed ? T('sin login / token', 'no login / token') : T('CLI no instalado', 'CLI not installed')}</div>
            </button>
          ))}
        </div>
        {tgt && !tgt.ok && (
          <div className="mt-2 text-[12px] text-ink-2">
            {tgt.hint} {tgt.installed && <button onClick={onOpenSettings} className="text-accent underline">{T('Abrir Configuración', 'Open Settings')}</button>}
            {tgt.token_help && <> · <a href={tgt.token_help} target="_blank" rel="noreferrer" className="text-accent underline">{T('crear token', 'create token')}</a></>}
          </div>
        )}
        {missing.length > 0 && <div className="mt-2 text-[12px] text-gold">{T('Faltan', 'Missing')} {missing.length} {missing.length === 1 ? T('variable requerida', 'required variable') : T('variables requeridas', 'required variables')}{T(': el deploy puede fallar o la app no va a funcionar completa.', ': the deploy may fail or the app will not work fully.')}</div>}
        <button
          disabled={!tgt?.ok || b.deploying}
          onClick={async () => {
            if (!b.sessionId || !b.id) return
            if (dirty) await save()
            setError(null)
            useBuild.getState().set({ deployLogs: [], deploying: true })
            try {
              await api.deploy(b.sessionId, b.id, target)
            } catch (e) {
              setError((e as Error).message)
              useBuild.getState().set({ deploying: false })
            }
          }}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-accent text-white py-2.5 font-semibold hover:brightness-110 disabled:opacity-40"
        >
          {b.deploying ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />} {b.deploying ? T('Desplegando…', 'Deploying…') : `${T('Deploy a', 'Deploy to')} ${tgt?.label ?? ''}`}
        </button>
        {(b.deployLogs.length > 0 || b.deploying) && (
          <pre ref={logRef} className="mt-3 max-h-56 overflow-auto scroll-thin rounded-xl bg-[#1E2622] text-[#E6ECE8] p-3 text-[11.5px] font-mono whitespace-pre-wrap">{b.deployLogs.join('\n') || '…'}</pre>
        )}
        {lastDeploy && !b.deploying && (
          <div className={`mt-3 rounded-xl border px-3 py-2.5 text-sm ${lastDeploy.ok ? 'border-ok/40 bg-ok/5' : 'border-danger/40 bg-danger/5'}`}>
            {lastDeploy.ok ? (
              <>{T('✓ Desplegado en', '✓ Deployed to')} {lastDeploy.target}: {lastDeploy.url ? <a href={lastDeploy.url} target="_blank" rel="noreferrer" className="font-mono text-accent underline">{lastDeploy.url}</a> : T('sin URL pública (revisá el panel del proveedor)', 'no public URL (check the provider dashboard)')}</>
            ) : (
              <>{T('✗ Falló el deploy a', '✗ Deploy failed to')} {lastDeploy.target}: <span className="text-danger">{lastDeploy.error}</span></>
            )}
          </div>
        )}
        {error && <div className="mt-2 text-sm text-danger">{error}</div>}
        <p className="mt-3 text-[11.5px] text-ink-4">{T('Se usa el CLI oficial', 'The official CLI is used')} ({tgt?.label}) {T('en esta máquina. Las variables se cargan en el proyecto del proveedor; el código nunca incluye tus secretos.', 'on this machine. The variables are loaded into the provider project; the code never includes your secrets.')}</p>
      </section>
    </div>
  )
}
