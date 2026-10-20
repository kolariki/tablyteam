import { CheckCircle2, Circle, Copy, Loader2, Terminal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, type EngineStatus } from '../lib/api'
import { tr, useT } from '../lib/i18n'
import ProviderLogo, { LogoWatermark } from './ProviderLogo'
import { toast } from './Toast'

/** Per-engine onboarding copy: install → log in with the paid plan → the app verifies. */
const STEPS: Record<string, { plan: string; install: string; login: string; what: string; what_en: string }> = {
  'claude-code': {
    plan: 'Claude Pro / Max',
    install: 'npm install -g @anthropic-ai/claude-code',
    login: 'claude auth login',
    what: 'Se abre el navegador: entrá con la cuenta de claude.ai que tiene el plan. No hace falta API key ni tarjeta.',
    what_en: 'Your browser opens: sign in with the claude.ai account that has the plan. No API key or card needed.',
  },
  codex: {
    plan: 'ChatGPT Plus / Pro',
    install: 'npm install -g @openai/codex',
    login: 'codex login',
    what: 'Se abre el navegador: entrá con tu cuenta de ChatGPT. Si ya estabas logueado con API key, antes corré `codex logout`.',
    what_en: 'Your browser opens: sign in with your ChatGPT account. If you were already logged in with an API key, run `codex logout` first.',
  },
}

function Cmd({ text }: { text: string }) {
  const T = useT()
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); toast.ok(tr('Copiado', 'Copied'), text) }}
      className="group inline-flex items-center gap-2 rounded-lg bg-[#1E2622] text-[#E6ECE8] px-3 py-1.5 font-mono text-[12.5px] hover:brightness-110"
      title={T('copiar', 'copy')}
    >
      <span className="text-ink-4">$</span> {text} <Copy size={12} className="opacity-50 group-hover:opacity-100" />
    </button>
  )
}

/** "Tu suscripción": connect Claude Code / Codex CLIs so building and review use the paid plan instead of API billing. */
export default function SubscriptionPanel() {
  const T = useT()
  const [engines, setEngines] = useState<EngineStatus[] | null>(null)
  const [watching, setWatching] = useState(false)
  const prev = useRef<EngineStatus[] | null>(null)

  const check = async (silent = false) => {
    try {
      const es = await api.engines()
      // diff against the last poll outside the state updater (StrictMode runs updaters twice → duplicate toasts)
      for (const e of es) {
        const was = prev.current?.find((p) => p.id === e.id)
        if (was && !was.ok && e.ok) toast.ok(`${e.label.split(' · ')[0]} ${tr('conectado', 'connected')}`, `${tr('Listo: usa', 'Ready: using')} ${e.auth ?? tr('tu plan', 'your plan')}.`)
      }
      prev.current = es
      setEngines(es)
    } catch (e) {
      if (!silent) toast.error(tr('No pude consultar los agentes locales', 'Could not check the local agents'), (e as Error).message)
    }
  }
  useEffect(() => { check(true) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // While the user is logging in from the terminal, poll quietly until everything pending is connected (max 3 min).
  useEffect(() => {
    if (!watching) return
    const started = Date.now()
    const id = setInterval(() => {
      check(true)
      if (Date.now() - started > 180_000) setWatching(false)
    }, 4000)
    return () => clearInterval(id)
  }, [watching]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (engines && engines.every((e) => e.ok)) setWatching(false)
  }, [engines])

  if (!engines) return null

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-ink-3">{T('Tu suscripción', 'Your subscription')}</div>
          <h2 className="text-3xl mt-1">{T('Construir con tu plan pago, sin API', 'Build with your paid plan, no API')}</h2>
        </div>
      </div>
      <p className="mt-1 w-full text-[13px] text-ink-2">
        {T('Si ya pagás Claude o ChatGPT, la app puede', 'If you already pay for Claude or ChatGPT, the app can')} <b>{T('construir y revisar', 'build and review')}</b> {T('el producto usando ese plan a través de su agente oficial instalado en esta máquina. Nada sale de tu computadora hacia terceros; la app solo le pasa el brief y lee los archivos que escribe.', 'the product using that plan through its official agent installed on this machine. Nothing leaves your computer to third parties; the app only hands it the brief and reads the files it writes.')}
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {engines.map((e) => {
          const s = STEPS[e.id]
          const name = e.label.split(' · ')[0]
          return (
            <div key={e.id} className={`panel relative overflow-hidden rounded-2xl p-5 ${e.ok ? 'border-ok/40' : ''}`}>
              <LogoWatermark provider={e.logo} />
              <div className="relative flex items-center gap-3">
                <ProviderLogo provider={e.logo} size={30} />
                <div className="min-w-0">
                  <div className="font-semibold text-lg leading-tight">{name}</div>
                  <div className="text-[12px] text-ink-3">{T('usa', 'uses')} {s?.plan ?? e.label}{e.version ? ` · ${e.version}` : ''}</div>
                </div>
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ${e.ok ? 'bg-ok/15 text-ok' : e.installed ? 'bg-gold/15 text-gold' : 'bg-surface-2 text-ink-3'}`}>
                  {e.ok ? T('conectado', 'connected') : e.installed ? T('falta login', 'login needed') : T('no instalado', 'not installed')}
                </span>
              </div>

              {e.ok ? (
                <div className="relative mt-4 flex items-start gap-2 rounded-xl border border-ok/30 bg-ok/5 px-3 py-2.5 text-[13px]">
                  <CheckCircle2 size={16} className="text-ok shrink-0 mt-0.5" />
                  <div>
                    <b>{T('Listo.', 'Ready.')}</b> {T('Sesión activa', 'Active session')}{e.auth ? `: ${e.auth}` : ''}. {T('Al construir elegí «', 'When building, pick «')}{e.label}{T('» como constructor; la revisión pre-prod también puede usarlo.', '» as the builder; the pre-prod review can use it too.')}
                    {e.hint && <div className="mt-1 text-gold">{e.hint}</div>}
                  </div>
                </div>
              ) : (
                <ol className="relative mt-4 space-y-3 text-[13px]">
                  <li className="flex gap-2.5">
                    {e.installed ? <CheckCircle2 size={16} className="text-ok shrink-0 mt-0.5" /> : <Circle size={16} className="text-ink-4 shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <div className={e.installed ? 'text-ink-3 line-through' : 'font-medium'}>{T('Instalá el agente en esta máquina', 'Install the agent on this machine')}</div>
                      {!e.installed && s && <div className="mt-1.5"><Cmd text={s.install} /></div>}
                    </div>
                  </li>
                  <li className="flex gap-2.5">
                    <Circle size={16} className={`shrink-0 mt-0.5 ${e.installed ? 'text-accent' : 'text-ink-4'}`} />
                    <div className="min-w-0">
                      <div className="font-medium">{T('Iniciá sesión con tu plan desde la terminal', 'Sign in with your plan from the terminal')}</div>
                      {s && (
                        <>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2"><Terminal size={13} className="text-ink-3" /><Cmd text={s.login} /></div>
                          <div className="mt-1 text-[12px] text-ink-3">{T(s.what, s.what_en)}</div>
                        </>
                      )}
                    </div>
                  </li>
                  <li className="flex gap-2.5">
                    <Circle size={16} className="text-ink-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-medium">{T('Volvé acá: la app lo detecta sola', 'Come back here: the app detects it on its own')}</div>
                      <button
                        onClick={() => { setWatching(true); check() }}
                        className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${watching ? 'bg-accent-soft text-accent border border-accent/40' : 'bg-accent text-white'}`}
                      >
                        {watching ? <><Loader2 size={13} className="animate-spin" /> {T('Esperando tu login…', 'Waiting for your login…')}</> : T('Ya me logueé, verificar', 'I logged in, verify')}
                      </button>
                    </div>
                  </li>
                </ol>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
