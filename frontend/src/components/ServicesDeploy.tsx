import { CheckCircle2, Download, ExternalLink, KeyRound, Loader2, Rocket, Save, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useBuild } from '../buildStore'
import { api, type ServicesInfo } from '../lib/api'
import { useT } from '../lib/i18n'
import { downloadBlob } from '../lib/recorder'

/** Right-pane tab: every external service / API key the built app needs, with values, plus one-click deploy. */
export default function ServicesDeploy({ onOpenSettings }: { onOpenSettings: () => void }) {
  const T = useT()
  const b = useBuild()
  const [info, setInfo] = useState<ServicesInfo | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [target, setTarget] = useState<string>('vercel')
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLPreElement>(null)

  const reload = () => {
    if (!b.sessionId || !b.id) return
    api.services(b.sessionId, b.id).then((d) => {
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
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-accent" />
          <h3 className="text-xl">{T('Servicios externos requeridos', 'Required external services')}</h3>
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ${missing.length ? 'bg-gold/15 text-gold' : 'bg-ok/15 text-ok'}`}>
            {missing.length ? `${T('faltan', 'missing')} ${missing.length}` : T('todo configurado', 'all configured')}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] text-ink-2">
          {T('Lo que la app necesita para funcionar, según su ', 'What the app needs to work, according to its ')}<code className="font-mono">.env.example</code>{T(' y el brief. Cargá los valores acá: se guardan cifrados, van al deploy como variables de entorno y podés bajarlos como ', ' and the brief. Enter the values here: they are stored encrypted, go to the deploy as environment variables and you can download them as ')}<code className="font-mono">.env</code>{T('. Nunca se escriben en el código.', '. They are never written into the code.')}
        </p>
        {info.groups.length === 0 && <div className="mt-3 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink-3">{T('El proyecto no declara variables de entorno: no requiere servicios externos.', 'The project declares no environment variables: it needs no external services.')}</div>}
        <div className="mt-3 space-y-3">
          {info.groups.map((g) => (
            <div key={g.service} className="rounded-xl border border-line bg-paper p-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{g.service}</span>
                {g.purpose && <span className="text-[12px] text-ink-3">· {g.purpose}</span>}
                {g.url && (
                  g.url.startsWith('http') ? (
                    <a href={g.url} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-[12px] text-accent hover:underline">{T('conseguir', 'get one')} <ExternalLink size={11} /></a>
                  ) : (
                    <span className="ml-auto text-[12px] text-ink-3">{g.url}</span>
                  )
                )}
              </div>
              <div className="mt-2 space-y-1.5">
                {g.vars.map((v) => (
                  <div key={v.var} className="grid grid-cols-[minmax(160px,1fr)_1.4fr_auto] gap-2 items-center">
                    <div className="min-w-0">
                      <div className="font-mono text-[12px] truncate" title={v.var}>{v.var}</div>
                      {(v.note || v.cost) && <div className="text-[11px] text-ink-3 truncate">{v.note}{v.cost ? ` · ${v.cost}` : ''}</div>}
                    </div>
                    <input
                      type={v.secret ? 'password' : 'text'}
                      autoComplete="off"
                      placeholder={v.configured ? T('•••••••• (guardada)', '•••••••• (saved)') : v.example || (v.required ? T('requerida', 'required') : T('opcional', 'optional'))}
                      value={values[v.var] ?? ''}
                      onChange={(e) => setValues({ ...values, [v.var]: e.target.value })}
                      className="rounded-lg bg-surface border border-line px-2.5 py-1.5 text-[12px] font-mono outline-none focus:border-accent"
                    />
                    <span className="w-5 flex justify-center">{v.configured || values[v.var] ? <CheckCircle2 size={15} className="text-ok" /> : v.required ? <XCircle size={15} className="text-gold" /> : <span className="text-ink-4 text-[10px]">{T('opc.', 'opt.')}</span>}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {info.groups.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <button disabled={!dirty || saving} onClick={save} className="flex items-center gap-1.5 rounded-lg bg-accent text-white px-3 py-1.5 text-sm font-medium disabled:opacity-40">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {T('Guardar valores', 'Save values')}
            </button>
            <button onClick={async () => b.sessionId && b.id && downloadBlob(new Blob([await api.envFile(b.sessionId, b.id)], { type: 'text/plain' }), '.env')} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
              <Download size={14} /> {T('Descargar .env', 'Download .env')}
            </button>
            {savedAt && !dirty && <span className="text-[12px] text-ok">{T('guardado', 'saved')}</span>}
          </div>
        )}
      </section>

      {/* ---------- deploy */}
      <section className="rounded-2xl border border-line bg-paper p-4">
        <div className="flex items-center gap-2">
          <Rocket size={16} className="text-accent" />
          <h3 className="text-xl">{T('Deploy automático', 'Automatic deploy')}</h3>
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
