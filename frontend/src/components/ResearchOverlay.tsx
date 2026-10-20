import { motion } from 'framer-motion'
import { Camera, Check, Eye, FileSearch, Gavel, Globe, Loader2, Search, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBuild } from '../buildStore'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import ProviderLogo from './ProviderLogo'

const RING = ['anthropic', 'openai', 'deepseek', 'gemini', 'xai', 'groq', 'kimi', 'mistral', 'openrouter', 'ollama']

/**
 * The team is researching the references before the council: a full screen that holds the user here (every click
 * elsewhere would race the job) and shows what is happening: each reference visited, captured and analysed, the live
 * activity feed, the elapsed time. It leaves by itself when the council opens.
 */
export default function ResearchOverlay() {
  const T = useT()
  const b = useBuild()
  const r = b.researching
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  // belt and braces: if the socket misses the events, poll the build; a new council round or a finished job ends the wait
  useEffect(() => {
    const id = setInterval(async () => {
      const st = useBuild.getState()
      if (!st.sessionId || !st.id) return
      try {
        const d = await api.build(st.sessionId, st.id)
        const councils: string[] = d.council_sessions ?? []
        if (councils.length > st.councilSessionsKnown) {
          st.set({ councilSession: councils[councils.length - 1], councilSessionsKnown: councils.length, researching: null, status: d.status })
        } else if (d.status !== 'running' && st.researching && Date.now() - st.researching.started > 20000 && !d.live) {
          st.set({ researching: { ...st.researching, finished: true } })
        }
      } catch { /* next tick */ }
    }, 6000)
    return () => clearInterval(id)
  }, [])
  const started = r?.started ?? now
  const elapsed = Math.max(0, Math.round((now - started) / 1000))
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const refs = r?.refs ?? []
  const stateOf = (ref: string) => {
    const key = ref.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    const hit = (r?.visited ?? []).find((v) => (v.url ?? '').toLowerCase().includes(key) || (v.name ?? '').toLowerCase().includes(key) || key.includes((v.name ?? '—').toLowerCase()))
    if (!hit) return 'pending'
    return hit.ok ? 'done' : 'failed'
  }
  const feed = b.activity.slice(-4).reverse()
  const ICON: Record<string, typeof Search> = { search: Globe, read: FileSearch, plan: Gavel, write: Camera, think: Eye }
  const R = 88

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }} className="fixed inset-0 z-[160] flex items-center justify-center bg-paper arena-bg p-6">
      <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-[auto_1fr]">
        {/* the orbit */}
        <div className="relative mx-auto" style={{ width: R * 2 + 56, height: R * 2 + 56 }}>
          <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 10, ease: 'linear', repeat: Infinity }}>
            {RING.map((id, i) => {
              const a = (i / RING.length) * Math.PI * 2
              return (
                <motion.span key={id} className="absolute flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface shadow-sm" style={{ left: `calc(50% + ${Math.cos(a) * R}px - 20px)`, top: `calc(50% + ${Math.sin(a) * R}px - 20px)` }} animate={{ rotate: -360 }} transition={{ duration: 10, ease: 'linear', repeat: Infinity }}>
                  <ProviderLogo provider={id} size={22} />
                </motion.span>
              )
            })}
          </motion.div>
          <motion.div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-accent/30 bg-surface shadow-[0_18px_40px_-14px_rgba(47,107,93,.5)]" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}>
            <Search size={34} className="text-accent" />
          </motion.div>
          <span className="pointer-events-none absolute inset-7 rounded-full border border-dashed border-line/80" aria-hidden />
        </div>

        {/* what is going on */}
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.35em] text-accent">{T('Antes del consejo', 'Before the council')}</div>
          <h2 className="mt-1 text-[30px] leading-tight">{r?.finished ? T('Listo: abriendo el consejo…', 'Done: opening the council…') : T('El equipo está investigando las referencias', 'The team is researching the references')}</h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-2">{T('Entra a cada app, saca capturas y anota qué emular y qué evitar. Con eso en la mano, el consejo revisa tu proyecto. Quedate acá: se abre solo al terminar.', 'It visits each app, takes screenshots and notes what to emulate and avoid. With that in hand the council reviews your project. Stay here: it opens by itself when done.')}</p>

          <div className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-[0_12px_28px_-18px_rgba(30,38,34,.4)]">
            <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.25em] text-ink-3">{T('Referencias', 'References')} <span className="ml-auto font-mono text-[11px] normal-case tracking-normal text-ink-2">{mm}:{ss}</span></div>
            <ul className="mt-2 space-y-1.5">
              {refs.length === 0 && <li className="text-[13px] text-ink-3">{T('El equipo propone los referentes de la categoría…', 'The team proposes the category’s references…')}</li>}
              {refs.map((ref) => {
                const st = stateOf(ref)
                return (
                  <li key={ref} className="flex items-center gap-2.5 text-[13.5px]">
                    {st === 'done' ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ok text-white"><Check size={13} strokeWidth={3} /></span> : st === 'failed' ? <XCircle size={22} className="text-danger" /> : <Loader2 size={22} className="animate-spin text-accent" />}
                    <span className={`truncate ${st === 'done' ? 'text-ink-3 line-through decoration-ok/60' : 'text-ink'}`}>{ref}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-ink-3">{st === 'done' ? T('analizada', 'analysed') : st === 'failed' ? T('no se pudo abrir', 'could not open') : T('en curso', 'in progress')}</span>
                  </li>
                )
              })}
            </ul>
            {(r?.visited ?? []).filter((v) => !refs.some((x) => stateOf(x) !== 'pending' && ((v.url ?? '').toLowerCase().includes(x.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')) || (v.name ?? '').toLowerCase().includes(x.toLowerCase())))).map((v) => (
              <div key={v.url ?? v.name} className="mt-1.5 flex items-center gap-2.5 text-[13px] text-ink-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-ok text-white"><Check size={13} strokeWidth={3} /></span> {v.name || v.url} <span className="ml-auto text-[11px] text-ink-3">{T('propuesta por el equipo', 'proposed by the team')}</span></div>
            ))}
          </div>

          <div className="mt-3 space-y-1">
            {feed.map((a, i) => {
              const Icon = ICON[a.kind] ?? Search
              return (
                <motion.div key={`${a.ts}-${i}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: i === 0 ? 1 : 0.55, x: 0 }} className="flex items-center gap-2 text-[12.5px] text-ink-2">
                  <Icon size={13} className="shrink-0 text-accent" /> <span className="truncate">{a.label}</span>{a.path && <span className="truncate font-mono text-[11px] text-ink-4">{a.path}</span>}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}
