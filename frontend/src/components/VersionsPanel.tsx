import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronDown, Circle, FileDiff, GitBranch, ListChecks, MessageSquareText, MinusCircle, Rocket, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useBuild, type BuildVersion } from '../buildStore'
import { api } from '../lib/api'
import { tr, useT } from '../lib/i18n'
import { useArena } from '../store'

const TRIGGER = (): Record<string, string> => ({
  initial: tr('Primera construcción', 'First build'),
  council: tr('Cambios pedidos por el consejo', 'Changes requested by the council'),
  audit: tr('Mejoras de la auditoría', 'Audit improvements'),
  user: tr('Pedido del usuario', 'User request'),
  deploy: tr('Ajuste para publicar', 'Publishing fix'),
  runtime: tr('Arreglo de un error de la app publicada', 'Fix of an error in the published app'),
})

export function readinessColor(p: number | null) {
  if (p == null) return 'var(--color-ink-4)'
  return p >= 80 ? 'var(--color-ok)' : p >= 50 ? 'var(--color-gold)' : 'var(--color-danger)'
}

/** Badge used in headers: "v3 · 72% listo". */
export function ReadinessBadge({ versions }: { versions: BuildVersion[] }) {
  const T = useT()
  const v = versions[versions.length - 1]
  if (!v) return null
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-bold" title={T('Versión actual y % listo para producción según el consejo', 'Current version and % production-ready according to the council')}>
      <GitBranch size={11} className="text-ink-3" /> {v.tag}
      {v.readiness != null ? <span style={{ color: readinessColor(v.readiness) }}>· {v.readiness}% {T('listo', 'ready')}</span> : <span className="text-ink-3">· {T('sin revisar', 'not reviewed')}</span>}
    </span>
  )
}

function Section({ icon: Icon, title, children, right }: { icon: typeof GitBranch; title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ink-3"><Icon size={12} className="text-accent" /> {title}{right && <span className="ml-auto normal-case tracking-normal">{right}</span>}</div>
      <div className="mt-2">{children}</div>
    </section>
  )
}

/** Timeline of build versions: what each team round asked for, what changed, how ready it is. */
export default function VersionsPanel() {
  const T = useT()
  const b = useBuild()
  const versions = b.versions
  const [open, setOpen] = useState<number | null>(null)
  const [diff, setDiff] = useState<{ n: number; path: string; text: string } | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const trigger = TRIGGER()
  useEffect(() => {
    if (open == null && versions.length) setOpen(versions[versions.length - 1].n)
  }, [versions.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const showDiff = async (n: number, path: string) => {
    if (!b.sessionId || !b.id) return
    setLoadingDiff(true)
    const text = await api.versionDiff(b.sessionId, b.id, n, path).catch((e) => `(${tr('no se pudo cargar el diff', 'could not load the diff')}: ${(e as Error).message})`)
    setDiff({ n, path, text })
    setLoadingDiff(false)
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-ink-3">
        <GitBranch size={28} className="text-ink-4" />
        {T('Todavía no hay versiones: la primera (v1) se guarda cuando termina la construcción inicial.', 'No versions yet: the first one (v1) is saved when the initial build finishes.')}
      </div>
    )
  }
  const latest = versions[versions.length - 1]
  const stats = diff?.text ? { add: diff.text.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).length, del: diff.text.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).length } : null

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(380px,1fr)_minmax(0,1.15fr)] bg-surface">
      {/* timeline */}
      <div className="min-h-0 overflow-y-auto scroll-thin border-r border-line p-5">
        <div className="text-[10.5px] uppercase tracking-[0.3em] text-accent">{T('Historial', 'History')}</div>
        <div className="mt-1 flex items-end gap-3">
          <h3 className="text-[22px] leading-tight">{versions.length} {versions.length === 1 ? T('versión', 'version') : T('versiones', 'versions')}</h3>
          <span className="mb-1 text-[12px] text-ink-3">{T('la actual es', 'current is')} <b className="font-mono text-ink">{latest.tag}</b>{latest.readiness != null ? <> · <span style={{ color: readinessColor(latest.readiness) }}>{latest.readiness}% {T('listo', 'ready')}</span></> : null}</span>
        </div>
        <div className="relative mt-4 space-y-3 pl-5">
          <span className="absolute bottom-3 left-[9px] top-3 w-px bg-line" aria-hidden />
          {[...versions].reverse().map((v) => {
            const isOpen = open === v.n
            const req = v.requested.length
            const done = v.resolved.filter((r) => r.status === 'done').length
            const partial = v.resolved.filter((r) => r.status === 'partial').length
            const changes = v.verdict?.changes ?? 0
            const isLatest = v.n === latest.n
            return (
              <motion.div key={v.n} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`relative rounded-2xl border bg-paper shadow-[0_12px_28px_-18px_rgba(30,38,34,.4)] ${isOpen ? 'border-accent' : 'border-line'}`}>
                <span className={`absolute -left-5 top-5 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-paper ${isLatest ? 'bg-accent' : 'bg-ink-4'}`} aria-hidden />
                <button onClick={() => setOpen(isOpen ? null : v.n)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-[12.5px] font-bold ${isLatest ? 'bg-accent text-white' : 'bg-surface-2 text-ink'}`}>{v.tag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold">{trigger[v.trigger] ?? v.trigger}</span>
                      {isLatest && <span className="rounded-full border border-accent/30 bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-accent">{T('actual', 'current')}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-3">
                      <span>{new Date(v.ts * 1000).toLocaleString()}</span>
                      <span>·</span><span>{v.files} {T('archivos', 'files')}</span>
                      <span>·</span><span className="font-mono"><span className="text-ok">+{v.stats.insertions}</span> <span className="text-danger">−{v.stats.deletions}</span></span>
                      {v.commit && <><span>·</span><span className="font-mono">{v.commit}</span></>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {v.readiness != null ? (
                      <div className="font-mono text-xl font-bold leading-none" style={{ color: readinessColor(v.readiness) }}>{v.readiness}%</div>
                    ) : (
                      <div className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10.5px] text-ink-3">{T('sin revisar', 'not reviewed')}</div>
                    )}
                    {v.readiness != null && <div className="mt-0.5 text-[10px] text-ink-4">{v.verdict?.approved ? T('aprobada', 'approved') : T('listo para prod', 'production-ready')}</div>}
                  </div>
                  <ChevronDown size={15} className={`shrink-0 text-ink-3 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="overflow-hidden">
                      <div className="space-y-2.5 border-t border-line px-4 pb-4 pt-3">
                        {v.readiness != null && (
                          <Section icon={Users} title={T('Veredicto del consejo', 'Council verdict')} right={<span className="font-mono text-[11px]" style={{ color: readinessColor(v.readiness) }}>{v.readiness}%</span>}>
                            <div className="h-2 overflow-hidden rounded-full bg-surface-2"><motion.div initial={{ width: 0 }} animate={{ width: `${v.readiness}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} className="h-full rounded-full" style={{ background: readinessColor(v.readiness) }} /></div>
                            <div className="mt-1.5 text-[12px] text-ink-2">
                              {v.verdict?.approved
                                ? T('El consejo la aprobó para producción.', 'The council approved it for production.')
                                : req
                                  ? `${done} ${T('de', 'of')} ${req} ${T('pedidos resueltos', 'requests resolved')}${partial ? ` (${partial} ${T('a medias', 'partially')})` : ''}; ${changes} ${changes === 1 ? T('hallazgo nuevo', 'new finding') : T('hallazgos nuevos', 'new findings')} ${T('del consejo.', 'from the council.')}`
                                  : `${changes} ${changes === 1 ? T('hallazgo', 'finding') : T('hallazgos', 'findings')} ${T('del consejo; nada pedido antes.', 'from the council; nothing requested before.')}`}
                            </div>
                            {v.verdict?.headline && <div className="mt-1 text-[12px] italic text-ink-3">“{v.verdict.headline}”</div>}
                            {v.council_session && (
                              <button onClick={() => useArena.getState().set({ pendingLive: v.council_session! })} className="mt-2 flex items-center gap-1.5 text-[12px] text-accent hover:underline"><Users size={12} /> {T('Ver el debate del consejo sobre esta versión', 'See the council debate on this version')} →</button>
                            )}
                            {v.verdict?.approved && <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-ok"><Rocket size={13} /> {T('Esta versión puede ir a producción.', 'This version can go to production.')}</div>}
                          </Section>
                        )}
                        {v.summary && (
                          <Section icon={MessageSquareText} title={T('Qué hizo el constructor', 'What the builder did')}>
                            <p className="text-[12.5px] leading-relaxed text-ink-2">{v.summary}</p>
                          </Section>
                        )}
                        {req > 0 && (
                          <Section icon={ListChecks} title={T('Lo que pidió el equipo', 'What the team asked for')} right={<span className="text-[11px] text-ink-3">{done}/{req} {T('resueltos', 'resolved')}</span>}>
                            <ul className="space-y-1.5">
                              {v.requested.map((r) => {
                                const st = v.resolved.find((x) => x.id === r.id)?.status
                                return (
                                  <li key={r.id} className="flex items-start gap-2 text-[12px]">
                                    {st === 'done' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-ok" /> : st === 'partial' ? <MinusCircle size={14} className="mt-0.5 shrink-0 text-gold" /> : <Circle size={14} className="mt-0.5 shrink-0 text-ink-4" />}
                                    <span className={st === 'done' ? 'text-ink-3' : 'text-ink'}>
                                      <span className={`mr-1.5 rounded px-1 py-0.5 text-[9.5px] font-bold uppercase ${r.severity === 'bloqueante' ? 'bg-danger/10 text-danger' : 'bg-accent-soft text-accent'}`}>{r.severity}</span>
                                      {r.text}{r.role && <span className="text-ink-3"> · {r.role}</span>}
                                      {st && st !== 'done' && <span className="ml-1 text-[10.5px] text-gold">({st === 'partial' ? T('a medias', 'partial') : T('pendiente', 'pending')})</span>}
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          </Section>
                        )}
                        <Section icon={FileDiff} title={`${T('Archivos que cambiaron respecto de', 'Files changed since')} ${v.n > 1 ? `v${v.n - 1}` : T('cero', 'zero')}`}>
                          <div className="flex flex-wrap gap-1.5 text-[11px]">
                            <span className="rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-ok">+{v.stats.added.length} {v.stats.added.length === 1 ? T('nuevo', 'new') : T('nuevos', 'new')}</span>
                            <span className="rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-accent">{v.stats.modified.length} {v.stats.modified.length === 1 ? T('modificado', 'modified') : T('modificados', 'modified')}</span>
                            {v.stats.deleted.length > 0 && <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-danger">−{v.stats.deleted.length} {v.stats.deleted.length === 1 ? T('borrado', 'deleted') : T('borrados', 'deleted')}</span>}
                            <span className="ml-auto text-ink-4">{T('tocá uno para ver el diff', 'click one to see the diff')}</span>
                          </div>
                          <ul className="mt-2 max-h-44 space-y-0.5 overflow-y-auto scroll-thin font-mono text-[11.5px]">
                            {[...v.stats.added.map((p) => ['A', p] as const), ...v.stats.modified.map((p) => ['M', p] as const), ...v.stats.deleted.map((p) => ['D', p] as const)].map(([k, p]) => {
                              const on = diff?.n === v.n && diff.path === p
                              return (
                                <li key={k + p}>
                                  <button onClick={() => showDiff(v.n, p)} className={`flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition ${on ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2'}`}>
                                    <span className={`w-4 text-center font-bold ${k === 'A' ? 'text-ok' : k === 'D' ? 'text-danger' : 'text-accent'}`}>{k}</span><span className="truncate">{p}</span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </Section>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* diff */}
      <div className="flex min-h-0 flex-col bg-[#1E2622]">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/10 px-3 font-mono text-[11.5px] text-[#B9C4BE]">
          <FileDiff size={13} className="text-[#8FD3B0]" />
          {diff ? (
            <>
              <span className="truncate text-white">{diff.path}</span>
              <span className="rounded-full border border-white/15 px-1.5 py-0.5 text-[10px]">v{diff.n - 1 > 0 ? diff.n - 1 : '∅'} → v{diff.n}</span>
              {stats && <span className="ml-auto"><span className="text-[#8FD3B0]">+{stats.add}</span> <span className="text-[#F0A8A8]">−{stats.del}</span></span>}
            </>
          ) : (
            <span>{T('Elegí un archivo de una versión para ver qué cambió.', 'Pick a file from a version to see what changed.')}</span>
          )}
        </div>
        <pre className="min-h-0 flex-1 overflow-auto scroll-thin p-3 font-mono text-[12px] leading-[1.5]">
          {loadingDiff && <span className="text-[#7F8C86]">{T('cargando…', 'loading…')}</span>}
          {!loadingDiff && diff && !diff.text && <span className="text-[#7F8C86]">{T('(sin diferencias en este archivo)', '(no differences in this file)')}</span>}
          {!loadingDiff && diff?.text && diff.text.split('\n').map((l, i) => (
            <div key={i} className={`-mx-3 px-3 ${l.startsWith('+++') || l.startsWith('---') ? 'text-[#B9C4BE]' : l.startsWith('@@') ? 'bg-white/[0.04] text-[#8FB7D3]' : l.startsWith('+') ? 'bg-[#2E4A3A] text-[#C8F0D6]' : l.startsWith('-') ? 'bg-[#4A2E2E] text-[#F0C8C8]' : 'text-[#E6ECE8]'}`}>{l || ' '}</div>
          ))}
          {!loadingDiff && !diff && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[12.5px] text-[#7F8C86]">
              <FileDiff size={26} />
              {T('El diff de cada archivo aparece acá: verde lo agregado, rojo lo que se fue.', 'Each file’s diff shows here: green for added, red for removed.')}
            </div>
          )}
        </pre>
      </div>
    </div>
  )
}
