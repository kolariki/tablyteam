import { motion } from 'framer-motion'
import { CheckCircle2, ChevronDown, Circle, GitBranch, MinusCircle, Rocket } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useBuild, type BuildVersion } from '../buildStore'
import { api } from '../lib/api'
import { tr, useT } from '../lib/i18n'
import { useArena } from '../store'

const TRIGGER = (): Record<string, string> => ({
  initial: tr('primera construcción', 'first build'),
  council: tr('cambios pedidos por el consejo', 'changes requested by the council'),
  audit: tr('mejoras de la auditoría', 'audit improvements'),
  user: tr('pedido del usuario', 'user request'),
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
    <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-bold" title={T('Versión actual y % listo para producción según el consejo', 'Current version and % production-ready according to the council')}>
      <GitBranch size={11} className="text-ink-3" /> {v.tag}
      {v.readiness != null ? <span style={{ color: readinessColor(v.readiness) }}>· {v.readiness}% {T('listo', 'ready')}</span> : <span className="text-ink-3">· {T('sin revisar', 'not reviewed')}</span>}
    </span>
  )
}

/** Timeline of build versions: what each team round asked for, what changed, how ready it is. */
export default function VersionsPanel() {
  const T = useT()
  const b = useBuild()
  const versions = b.versions
  const [open, setOpen] = useState<number | null>(null)
  const [diff, setDiff] = useState<{ n: number; path: string; text: string } | null>(null)
  const trigger = TRIGGER()
  useEffect(() => {
    if (open == null && versions.length) setOpen(versions[versions.length - 1].n)
  }, [versions.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const showDiff = async (n: number, path: string) => {
    if (!b.sessionId || !b.id) return
    const text = await api.versionDiff(b.sessionId, b.id, n, path).catch((e) => `(${tr('no se pudo cargar el diff', 'could not load the diff')}: ${(e as Error).message})`)
    setDiff({ n, path, text })
  }

  if (versions.length === 0) {
    return <div className="flex-1 p-6 text-center text-sm text-ink-3">{T('Todavía no hay versiones: la primera (v1) se guarda cuando termina la construcción inicial.', 'No versions yet: the first one (v1) is saved when the initial build finishes.')}</div>
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(320px,1fr)_minmax(0,1.2fr)] bg-surface">
      {/* timeline */}
      <div className="min-h-0 overflow-y-auto scroll-thin p-4 border-r border-line">
        <div className="text-[10px] uppercase tracking-[0.3em] text-ink-3 mb-3">{T('Versiones', 'Versions')} · {versions.length}</div>
        <div className="space-y-2">
          {[...versions].reverse().map((v) => {
            const isOpen = open === v.n
            const req = v.requested.length
            const done = v.resolved.filter((r) => r.status === 'done').length
            const partial = v.resolved.filter((r) => r.status === 'partial').length
            const changes = v.verdict?.changes ?? 0
            return (
              <motion.div key={v.n} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border bg-paper ${isOpen ? 'border-accent' : 'border-line'}`}>
                <button onClick={() => setOpen(isOpen ? null : v.n)} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
                  <span className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center font-mono text-[12px] font-bold shrink-0">{v.tag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate">{trigger[v.trigger] ?? v.trigger}{req ? ` · ${req} ${req === 1 ? T('ítem', 'item') : T('ítems', 'items')}` : ''}</div>
                    <div className="text-[11px] text-ink-3 font-mono">{new Date(v.ts * 1000).toLocaleString()} · {v.files} {T('archivos', 'files')} · +{v.stats.insertions} −{v.stats.deletions}{v.commit ? ` · ${v.commit}` : ''}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {v.readiness != null ? (
                      <div className="font-mono text-lg font-bold leading-none" style={{ color: readinessColor(v.readiness) }}>{v.readiness}%</div>
                    ) : (
                      <div className="text-[11px] text-ink-3">{T('sin revisar', 'not reviewed')}</div>
                    )}
                    <div className="text-[10px] text-ink-4">{v.verdict?.approved ? T('aprobada', 'approved') : v.readiness != null ? T('para prod', 'for prod') : ''}</div>
                  </div>
                  <ChevronDown size={14} className={`text-ink-3 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-3.5 pb-3.5 space-y-3">
                    {v.readiness != null && (
                      <div>
                        <div className="h-2 rounded-full bg-surface-2 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${v.readiness}%`, background: readinessColor(v.readiness) }} /></div>
                        <div className="mt-1 text-[11px] text-ink-3">
                          {v.verdict?.approved
                            ? T('El consejo la aprobó para producción.', 'The council approved it for production.')
                            : req
                              ? `${done} ${T('de', 'of')} ${req} ${T('pedidos resueltos', 'requests resolved')}${partial ? ` (${partial} ${T('a medias', 'partially')})` : ''}; ${changes} ${changes === 1 ? T('hallazgo nuevo', 'new finding') : T('hallazgos nuevos', 'new findings')} ${T('del consejo.', 'from the council.')}`
                              : `${changes} ${changes === 1 ? T('hallazgo', 'finding') : T('hallazgos', 'findings')} ${T('del consejo; nada pedido antes.', 'from the council; nothing requested before.')}`}
                        </div>
                      </div>
                    )}
                    {v.summary && <div className="text-[12.5px] text-ink-2 line-clamp-4">{v.summary}</div>}
                    {req > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-ink-3 mb-1">{T('Lo que pidió el equipo para esta versión', 'What the team asked for in this version')}</div>
                        <ul className="space-y-1">
                          {v.requested.map((r) => {
                            const st = v.resolved.find((x) => x.id === r.id)?.status
                            return (
                              <li key={r.id} className="flex items-start gap-1.5 text-[12px]">
                                {st === 'done' ? <CheckCircle2 size={13} className="text-ok shrink-0 mt-0.5" /> : st === 'partial' ? <MinusCircle size={13} className="text-gold shrink-0 mt-0.5" /> : <Circle size={13} className="text-ink-4 shrink-0 mt-0.5" />}
                                <span className={st === 'done' ? 'text-ink-3' : 'text-ink'}>
                                  <span className={`mr-1 rounded px-1 text-[9.5px] font-bold uppercase ${r.severity === 'bloqueante' ? 'bg-danger/10 text-danger' : 'bg-accent-soft text-accent'}`}>{r.severity}</span>
                                  {r.text}{r.role && <span className="text-ink-3"> · {r.role}</span>}
                                  {st && st !== 'done' && <span className="ml-1 text-[10.5px] text-gold">({st === 'partial' ? T('a medias', 'partial') : T('pendiente', 'pending')})</span>}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-ink-3 mb-1">{T('Qué cambió respecto de', 'What changed since')} {v.n > 1 ? `v${v.n - 1}` : T('cero', 'zero')}</div>
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-full bg-ok/10 text-ok px-2 py-0.5">+{v.stats.added.length} {v.stats.added.length === 1 ? T('nuevo', 'new') : T('nuevos', 'new')}</span>
                        <span className="rounded-full bg-accent-soft text-accent px-2 py-0.5">✏️ {v.stats.modified.length} {v.stats.modified.length === 1 ? T('modificado', 'modified') : T('modificados', 'modified')}</span>
                        {v.stats.deleted.length > 0 && <span className="rounded-full bg-danger/10 text-danger px-2 py-0.5">−{v.stats.deleted.length} {v.stats.deleted.length === 1 ? T('borrado', 'deleted') : T('borrados', 'deleted')}</span>}
                      </div>
                      <ul className="mt-1.5 max-h-40 overflow-y-auto scroll-thin space-y-0.5 font-mono text-[11.5px]">
                        {[...v.stats.added.map((p) => ['A', p] as const), ...v.stats.modified.map((p) => ['M', p] as const), ...v.stats.deleted.map((p) => ['D', p] as const)].map(([k, p]) => (
                          <li key={k + p}>
                            <button onClick={() => showDiff(v.n, p)} className={`flex items-center gap-1.5 hover:underline ${diff?.n === v.n && diff.path === p ? 'text-accent' : 'text-ink-2'}`}>
                              <span className={`w-4 text-center font-bold ${k === 'A' ? 'text-ok' : k === 'D' ? 'text-danger' : 'text-accent'}`}>{k}</span><span className="truncate">{p}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {v.council_session && (
                      <button onClick={() => useArena.getState().set({ pendingLive: v.council_session! })} className="flex items-center gap-1.5 text-[12px] text-accent hover:underline"><GitBranch size={12} /> {T('Ver el debate del consejo sobre esta versión →', 'See the council debate on this version →')}</button>
                    )}
                    {v.verdict?.approved && <div className="flex items-center gap-1.5 text-[12px] text-ok font-semibold"><Rocket size={13} /> {T('Esta versión puede ir a producción.', 'This version can go to production.')}</div>}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* diff */}
      <div className="min-h-0 flex flex-col bg-[#1E2622]">
        <div className="h-9 px-3 flex items-center text-[11.5px] font-mono text-[#B9C4BE] border-b border-white/10 shrink-0">{diff ? `${diff.path} · v${diff.n - 1 > 0 ? diff.n - 1 : '∅'} → v${diff.n}` : T('Elegí un archivo de una versión para ver qué cambió.', 'Pick a file from a version to see what changed.')}</div>
        <pre className="flex-1 min-h-0 overflow-auto scroll-thin p-3 text-[12px] leading-[1.5] font-mono">
          {diff ? (diff.text || <span className="text-[#7F8C86]">{T('(sin diferencias en este archivo)', '(no differences in this file)')}</span>) : null}
          {diff && diff.text && diff.text.split('\n').map((l, i) => (
            <div key={i} className={l.startsWith('+++') || l.startsWith('---') ? 'text-[#B9C4BE]' : l.startsWith('@@') ? 'text-[#8FB7D3]' : l.startsWith('+') ? 'bg-[#2E4A3A] text-[#C8F0D6]' : l.startsWith('-') ? 'bg-[#4A2E2E] text-[#F0C8C8]' : 'text-[#E6ECE8]'}>{l || ' '}</div>
          ))}
        </pre>
      </div>
    </div>
  )
}
