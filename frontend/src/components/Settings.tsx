import { motion } from 'framer-motion'
import { Check, ExternalLink, KeyRound, Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, type ProviderSetting } from '../lib/api'
import { tr, useT } from '../lib/i18n'
import ModelSelect, { invalidateModels } from './ModelSelect'
import ProviderLogo, { LogoWatermark } from './ProviderLogo'
import PageHeader from './PageHeader'
import { brandTheme } from '../lib/brand'
import SubscriptionPanel from './SubscriptionPanel'

const KEY_URL: Record<string, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  gemini: 'https://aistudio.google.com/apikey',
  xai: 'https://console.x.ai',
  groq: 'https://console.groq.com/keys',
  kimi: 'https://platform.moonshot.ai/console/api-keys',
  mistral: 'https://console.mistral.ai/api-keys',
  openrouter: 'https://openrouter.ai/keys',
  ollama: 'https://ollama.com/download',
}

export default function Settings({ onBack }: { onBack: () => void }) {
  const T = useT()
  const [items, setItems] = useState<ProviderSetting[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.settings().then((r) => {
      setItems(r.providers.filter((p) => p.kind !== 'mock'))
    }).catch((e) => setError(e.message))
  }, [])

  const replace = (p: ProviderSetting) => setItems((xs) => xs.map((x) => (x.id === p.id ? p : x)))
  const ready = items.filter((p) => p.configured).length

  return (
    <div className="h-full overflow-y-auto scroll-thin arena-bg">
      <div className="w-full px-8 py-8 2xl:px-12">
        <PageHeader
          onBack={onBack}
          kicker={T('Configuración', 'Settings')}
          title={T('Modelos y API keys', 'Models and API keys')}
          right={
            <span className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface pl-2 pr-3.5 text-sm text-ink-2 shadow-sm">
              {items.filter((p) => p.configured && p.id !== 'mock').length > 0 ? (
                <span className="flex items-center">
                  {items.filter((p) => p.configured && p.id !== 'mock').map((p, i) => (
                    <span key={p.id} title={p.label} className="flex h-7 w-7 items-center justify-center rounded-full border bg-surface shadow-sm" style={{ marginLeft: i ? -9 : 0, zIndex: 20 - i, borderColor: brandTheme(p.id).accent }}>
                      <ProviderLogo provider={p.id} size={16} />
                    </span>
                  ))}
                </span>
              ) : <span className="ml-1.5 h-2 w-2 rounded-full bg-ok" />}
              {ready} {T('de', 'of')} {items.length} {T('proveedores listos', 'providers ready')}
            </span>
          }
        />
        <div className="mt-5 inline-flex w-fit max-w-full items-start gap-2 rounded-xl border border-line bg-surface py-3 pl-4 pr-[calc(1rem+16px+0.5rem)] text-[13px] text-ink-2 shadow-sm">
          <ShieldCheck size={17} className="text-ok shrink-0 mt-0.5" />
          <span>
            {T('Tus keys se guardan', 'Your keys are stored')} <b>{T('cifradas', 'encrypted')}</b> {T('en el servidor y nunca vuelven al navegador: solo se muestran los últimos 4 caracteres. Las usan únicamente tus experimentos.', 'on the server and never return to the browser: only the last 4 characters are shown. Only your experiments use them.')}
          </span>
        </div>
        {error && <div className="mt-4 text-danger text-sm">{error}</div>}
        <SubscriptionPanel />
        <div className="mt-10">
          <div className="text-xs uppercase tracking-[0.3em] text-ink-3">API keys</div>
          <h2 className="text-3xl mt-1">{T('Modelos por API, para los debates', 'API models, for the debates')}</h2>
          <p className="mt-1 text-[13px] text-ink-2">{T('Los agentes del equipo (CEO, CTO, QA…) hablan por API y cada proveedor factura por uso. Cargá solo los que quieras usar.', 'The team agents (CEO, CTO, QA…) talk through APIs and each provider bills per use. Add only the ones you want to use.')}</p>
        </div>
        <div className="mt-4 grid gap-4 grid-cols-[repeat(auto-fill,minmax(440px,1fr))]">
          {items.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <ProviderCard p={p} onSaved={replace} />
            </motion.div>
          ))}
        </div>
        <DeploySettings />
        <LangfuseSettings />
      </div>
    </div>
  )
}

/** Tracing: whether every model call lands in Langfuse, and where. Configured in the backend .env (LANGFUSE_*). */
function LangfuseSettings() {
  const T = useT()
  const [h, setH] = useState<{ langfuse: boolean; langfuse_host: string | null } | null>(null)
  useEffect(() => { api.health().then(setH).catch(() => setH({ langfuse: false, langfuse_host: null })) }, [])
  return (
    <div className="mt-8">
      <h2 className="text-2xl">{T('Trazas · Langfuse', 'Tracing · Langfuse')}</h2>
      <p className="mt-1 text-[13px] text-ink-2">{T('Cada llamada a un modelo (debates, briefs, construcciones, revisiones) queda registrada con latencia, tokens y costo.', 'Every model call (debates, briefs, builds, reviews) is recorded with latency, tokens and cost.')}</p>
      <div className="relative mt-3 overflow-hidden rounded-2xl border p-5 shadow-[0_14px_30px_-18px_rgba(30,38,34,.45)]" style={{ background: brandTheme('langfuse').bg, borderColor: h?.langfuse ? brandTheme('langfuse').accent : brandTheme('langfuse').border }}>
        <LogoWatermark provider="langfuse" opacity={0.1} />
        <div className="relative flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-sm" style={{ border: `1.5px solid ${brandTheme('langfuse').accent}` }}>
            <ProviderLogo provider="langfuse" size={28} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">Langfuse</div>
            <div className="truncate font-mono text-[12px] text-ink-3">{h?.langfuse_host || T('sin servidor configurado', 'no server configured')}</div>
          </div>
          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${h?.langfuse ? 'bg-ok/10 text-ok border-ok/30' : 'bg-surface-2 text-ink-3 border-line'}`}>
            {h?.langfuse && <span className="h-2 w-2 rounded-full bg-ok shadow-[0_0_0_3px_rgba(23,137,106,.18)]" />}
            {h === null ? '…' : h.langfuse ? T('Conectado', 'Connected') : T('Desactivado', 'Off')}
          </span>
          {h?.langfuse && h.langfuse_host && <a href={h.langfuse_host} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-3 text-sm shadow-sm hover:bg-surface-2"><ExternalLink size={14} /> {T('Abrir', 'Open')}</a>}
        </div>
      </div>
      <p className="mt-2 text-[12px] text-ink-4">{T('Se configura en el .env del backend con LANGFUSE_HOST, LANGFUSE_PUBLIC_KEY y LANGFUSE_SECRET_KEY; también podés levantarlo local con docker-compose.langfuse.yml.', 'Configured in the backend .env with LANGFUSE_HOST, LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY; you can also run it locally with docker-compose.langfuse.yml.')}</p>
    </div>
  )
}

const input = 'w-full rounded-lg bg-surface border border-line px-3 py-2 text-sm font-mono outline-none focus:border-accent transition shadow-sm'

function DeploySettings() {
  const T = useT()
  const [st, setSt] = useState<{ vercel: { set: boolean; last4: string | null }; railway: { set: boolean; last4: string | null }; status: { id: string; label: string; installed: boolean; logged_in: boolean; token: boolean; hint: string | null; token_help: string }[] } | null>(null)
  const [tok, setTok] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const load = () => {
    api.deploySettings().then(setSt).catch(() => {})
  }
  useEffect(load, [])
  if (!st) return null
  return (
    <div className="mt-8">
      <h2 className="text-2xl">Deploy</h2>
      <p className="mt-1 text-[13px] text-ink-2">{T('Tokens para publicar los proyectos construidos con un clic. Alternativa sin token: iniciá sesión en tu terminal con', 'Tokens to publish the built projects in one click. Token-free alternative: sign in from your terminal with')} <code className="font-mono">vercel login</code> / <code className="font-mono">railway login</code>.</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {st.status.map((t) => {
          const k = st[t.id as 'vercel' | 'railway']
          return (
            <div key={t.id} className="relative overflow-hidden rounded-2xl border p-5 shadow-[0_14px_30px_-18px_rgba(30,38,34,.45)] transition hover:shadow-[0_18px_40px_-18px_rgba(30,38,34,.5)]" style={{ background: brandTheme(t.id).bg, borderColor: t.installed && (t.token || t.logged_in) ? brandTheme(t.id).accent : brandTheme(t.id).border }}>
              <LogoWatermark provider={t.id} opacity={0.1} />
              <div className="relative">
              <div className="flex items-center gap-3">
                {t.id === 'vercel' ? (
                  // Vercel's mark is a wordmark: show it whole, small, in a pill instead of a round medallion
                  <span className="flex h-12 items-center justify-center rounded-full bg-surface px-4 shadow-sm" style={{ border: `1.5px solid ${brandTheme(t.id).accent}` }}>
                    <img src="/logos/vercel.png" alt="Vercel" draggable={false} className="h-[18px] w-auto select-none" />
                  </span>
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-sm" style={{ border: `1.5px solid ${brandTheme(t.id).accent}` }}>
                    <ProviderLogo provider={t.id} size={26} />
                  </span>
                )}
                <div>
                  <div className="text-[15px] font-semibold">{t.label}</div>
                  <a href={t.token_help} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-accent">{T('crear token', 'create token')} <ExternalLink size={11} /></a>
                </div>
                <span className={`ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${t.installed && (t.token || t.logged_in) ? 'bg-ok/10 text-ok border-ok/30' : 'bg-surface-2 text-ink-3 border-line'}`}>
                  {t.installed && (t.token || t.logged_in) && <span className="h-2 w-2 rounded-full bg-ok shadow-[0_0_0_3px_rgba(23,137,106,.18)]" />}
                  {!t.installed ? T('CLI no instalado', 'CLI not installed') : k.set || t.logged_in ? T('Conectado', 'Connected') : T('Sin acceso', 'No access')}
                </span>
              </div>
              <div className="mt-4 text-[10.5px] uppercase tracking-widest text-ink-3">{k.set ? T('Reemplazar token', 'Replace token') : 'Token'}</div>
              <div className="mt-1 flex gap-2">
                <input type="password" autoComplete="off" placeholder={k.set ? `token ··${k.last4}` : `${t.label} token`} value={tok[t.id] ?? ''} onChange={(e) => setTok({ ...tok, [t.id]: e.target.value })} className={input} />
                <button disabled={!tok[t.id]?.trim()} onClick={async () => { await api.saveDeployToken(t.id, tok[t.id].trim()); setTok({ ...tok, [t.id]: '' }); setMsg(`${t.label}: ${tr('token guardado', 'token saved')}`); load() }} className="rounded-lg bg-accent px-3.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40">{T('Guardar', 'Save')}</button>
              </div>
              <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-3">
                {k.set && <span>{T('Token guardado', 'Token saved')} ··{k.last4}</span>}
                {!k.set && t.logged_in && <span>{T('Logueado desde la terminal', 'Logged in from the terminal')}</span>}
                {k.set && <button onClick={async () => { await api.saveDeployToken(t.id, null, true); setMsg(`${t.label}: ${tr('token borrado', 'token deleted')}`); load() }} className="ml-auto hover:text-danger">{T('Borrar token', 'Delete token')}</button>}
              </div>
              {!t.installed && <div className="mt-2 text-[12px] text-gold">{t.hint}</div>}
              </div>
            </div>
          )
        })}
      </div>
      {msg && <div className="mt-2 text-[12.5px] text-ok">{msg}</div>}
    </div>
  )
}

function ProviderCard({ p, onSaved }: { p: ProviderSetting; onSaved: (p: ProviderSetting) => void }) {
  const T = useT()
  const [key, setKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(p.base_url ?? '')
  const [model, setModel] = useState(p.default_model)
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'error'; msg?: string }>({ kind: 'idle' })
  const isOllama = p.id === 'ollama'
  const theme = brandTheme(p.id)

  const test = async (k?: string) => {
    setState({ kind: 'busy', msg: tr('probando…', 'testing…') })
    const r = await api.testKey(p.id, k || undefined, isOllama ? baseUrl || undefined : undefined).catch((e) => ({ ok: false, error: (e as Error).message, models: [] as string[] }))
    if (r.ok) {
      setState({ kind: 'ok', msg: `${tr('Funciona ·', 'Works ·')} ${r.models?.length ?? 0} ${tr('modelos disponibles', 'models available')}` })
    } else setState({ kind: 'error', msg: r.error })
    return r.ok
  }

  const save = async (patch: { api_key?: string; clear_key?: boolean; default_model?: string; base_url?: string }, okMsg: string) => {
    setState({ kind: 'busy', msg: tr('guardando…', 'saving…') })
    try {
      const updated = await api.saveProvider(p.id, patch)
      if (patch.api_key || patch.clear_key || patch.base_url !== undefined) invalidateModels(p.id)
      onSaved(updated)
      setState({ kind: 'ok', msg: okMsg })
    } catch (e) {
      setState({ kind: 'error', msg: (e as Error).message })
    }
  }

  const saveKey = async () => {
    if (!key.trim()) return
    if (!(await test(key.trim()))) return // don't store a key the provider rejects
    await save({ api_key: key.trim() }, tr('Key guardada y verificada', 'Key saved and verified'))
    setKey('')
  }

  const badge =
    p.source === 'user'
      ? { text: T('Conectado', 'Connected'), hint: `${T('Tu key', 'Your key')} ··${p.user_key_last4 ?? ''}`, dot: true, cls: 'bg-ok/10 text-ok border-ok/30' }
      : p.source === 'server'
        ? { text: T('Conectado', 'Connected'), hint: T('Key del servidor', 'Server key'), dot: true, cls: 'bg-ok/10 text-ok border-ok/30' }
        : { text: T('Sin key', 'No key'), hint: '', dot: false, cls: 'bg-surface-2 text-ink-3 border-line' }

  const input = 'w-full rounded-lg bg-surface border border-line px-3 py-2 text-sm outline-none focus:border-accent transition shadow-sm'

  return (
    <div className="relative h-full overflow-hidden rounded-2xl border p-5 shadow-[0_14px_30px_-18px_rgba(30,38,34,.45)] transition hover:shadow-[0_18px_40px_-18px_rgba(30,38,34,.5)]" style={{ background: theme.bg, borderColor: p.configured ? theme.accent : theme.border }}>
      <LogoWatermark provider={p.id} opacity={0.1} />
      <div className="relative">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-sm" style={{ border: `1.5px solid ${theme.accent}` }}>
          <ProviderLogo provider={p.id} size={28} />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">{p.label}</div>
          <a href={KEY_URL[p.id]} target="_blank" rel="noreferrer" className="text-[12px] text-ink-3 hover:text-accent inline-flex items-center gap-1">
            {isOllama ? T('descargar Ollama', 'download Ollama') : T('conseguir una key', 'get a key')} <ExternalLink size={11} />
          </a>
        </div>
        <span title={badge.hint} className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap ${badge.cls}`}>{badge.dot && <span className="h-2 w-2 rounded-full bg-ok shadow-[0_0_0_3px_rgba(23,137,106,.18)]" />}{badge.text}</span>
      </div>

      {isOllama ? (
        <div className="mt-4">
          <label className="text-[11px] uppercase tracking-widest text-ink-3">{T('URL del servidor', 'Server URL')}</label>
          <div className="mt-1 flex gap-2">
            <input className={`${input} font-mono`} placeholder="http://localhost:11434/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            <button className="rounded-lg bg-accent px-3.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110" onClick={async () => (await test()) && save({ base_url: baseUrl }, tr('Servidor guardado', 'Server saved'))}>{T('Guardar', 'Save')}</button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <label className="text-[11px] uppercase tracking-widest text-ink-3">{p.source === 'user' ? T('Reemplazar key', 'Replace key') : 'API key'}</label>
          <div className="mt-1 flex gap-2">
            <div className="relative flex-1">
              <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
              <input
                className={`${input} pl-8 font-mono`}
                type="password"
                autoComplete="off"
                placeholder={p.key_env ?? 'api key'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveKey()}
              />
            </div>
            <button disabled={!key.trim() || state.kind === 'busy'} onClick={saveKey} className="rounded-lg bg-accent px-3.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40">
              {T('Guardar', 'Save')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <label className="text-[11px] uppercase tracking-widest text-ink-3">{T('Modelo por defecto', 'Default model')}</label>
        <div className="mt-1">
          <ModelSelect
            key={`${p.source}-${p.user_key_last4 ?? ''}-${p.base_url ?? ''}`}
            provider={p.id}
            value={model}
            enabled={p.configured}
            onChange={(m) => {
              setModel(m)
              if (m && m !== p.default_model) save({ default_model: m }, `${tr('Modelo por defecto:', 'Default model:')} ${m}`)
            }}
          />
        </div>
        {!p.configured && <div className="mt-1 text-[11.5px] text-ink-3">{T('Cargá una key para ver todos los modelos disponibles.', 'Add a key to see all available models.')}</div>}
      </div>

      <div className="mt-4 flex items-center gap-3 text-[12.5px] min-h-6">
        {state.kind === 'busy' && <span className="flex items-center gap-1.5 text-ink-3"><Loader2 size={13} className="animate-spin" /> {state.msg}</span>}
        {state.kind === 'ok' && <span className="flex items-center gap-1.5 text-ok"><Check size={14} /> {state.msg}</span>}
        {state.kind === 'error' && <span className="text-danger">{state.msg}</span>}
        <div className="ml-auto flex gap-3">
          {p.configured && state.kind !== 'busy' && <button onClick={() => test()} className="text-ink-3 hover:text-accent">{T('Probar conexión', 'Test connection')}</button>}
          {p.source === 'user' && !isOllama && (
            <button onClick={() => save({ clear_key: true }, tr('Key borrada', 'Key deleted'))} className="flex items-center gap-1 text-ink-3 hover:text-danger"><Trash2 size={13} /> {T('Borrar mi key', 'Delete my key')}</button>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
