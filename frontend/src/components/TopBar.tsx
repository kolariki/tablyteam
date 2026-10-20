import { Focus, ChevronDown, Download, FileText, Hammer, Rocket, Video, Pause, Plus, Users, Square, Trophy, Volume2, VolumeX, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'
import { downloadBlob, slug } from '../lib/recorder'
import { setSfx, sfxEnabled } from '../lib/sfx'
import { useArena } from '../store'

export default function TopBar({ onNew, onRerun }: { onNew: () => void; onRerun?: () => void }) {
  const T = useT()
  const s = useArena()
  const compact = s.layout === 'vertical'
  const [sound, setSound] = useState(sfxEnabled)
  const live = s.status === 'running' || s.status === 'paused' || s.status === 'voting' || s.status === 'connecting'
  // the same pill language as the home and builder headers: 36 px, rounded, lifts on hover
  const btn = 'flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm text-ink-2 shadow-sm transition hover:bg-accent-soft hover:border-accent hover:text-accent disabled:opacity-40'
  const primary = 'flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110'

  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <img src="/icon.svg" alt="" aria-hidden className="h-8 w-8 rounded-lg shadow-sm" draggable={false} />
        <span className={`serif text-[17px] ${compact ? 'hidden' : ''}`}>Tably <em className="text-accent">Team</em></span>
      </div>
      <div className="flex items-center gap-2 ml-2">
        {s.recording ? null : s.status === 'paused' ? (
          <span className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold">
            <Pause size={11} /> {T('EN PAUSA', 'PAUSED')}
          </span>
        ) : live ? (
          <span className="flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-[11px] font-bold text-danger">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse" /> {s.source === 'replay' ? 'REPLAY' : T('EN VIVO', 'LIVE')}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok/10 px-2.5 py-1 text-[11px] font-bold text-ok"><span className="h-2 w-2 rounded-full bg-ok shadow-[0_0_0_3px_rgba(23,137,106,.18)]" /> {s.status === 'completed' ? T('TERMINADO', 'FINISHED') : s.status.toUpperCase()}</span>
        )}
        {s.config && !s.recording && (
          <span className="rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-ink-2" title={T('turno actual / máximo', 'current turn / maximum')}>
            {s.status === 'voting' ? T('votación final', 'final vote') : s.closing && s.status === 'running' ? T('ronda de cierre', 'closing round') : `${T('turno', 'turn')} ${Math.min(s.turns.length + (s.status === 'running' ? 1 : 0), s.config.max_turns)} / ${s.config.max_turns}`}
          </span>
        )}
        {s.config && !compact && <span className="serif hidden max-w-[40vw] truncate text-[17px] md:block">{s.config.mode === 'review' && s.config.review_of ? `${s.config.review_of.title} · ${T('consejo ronda', 'council round')} ${s.config.review_of.round} · v${s.config.review_of.version ?? ''}` : (s.config.title || s.config.topic)}</span>}
      </div>
      <div className={`ml-auto flex min-w-0 items-center gap-2 overflow-x-auto ${s.recording ? 'invisible' : s.recMode ? 'opacity-0 hover:opacity-100 transition' : ''}`}>
        {s.source === 'replay' && (
          <select className={`${btn} appearance-none pr-3 font-mono`} value={s.speed} onChange={(e) => s.set({ speed: Number(e.target.value) })} title={T('Velocidad de reproducción', 'Playback speed')}>
            {[0.5, 1, 1.5, 2, 4, 8].map((v) => <option key={v} value={v}>{v}×</option>)}
          </select>
        )}
        {s.sessionId && !live && <ExportMenu btn={btn} />}
        {s.config?.mode === 'review' && s.config.review_of && (
          <button className={primary} onClick={() => s.set({ showVerdict: false, pendingBuild: { buildId: s.config!.review_of!.build_id, sessionId: s.config!.review_of!.session_id } })} title={T('Volver al constructor de este proyecto', "Back to this project's builder")}><Hammer size={14} /> {T('Constructor', 'Builder')} · v{s.config.review_of.version ?? ''}</button>
        )}
        {s.verdict && <button className={btn} onClick={() => s.set({ showVerdict: true })}><Trophy size={14} /> {s.config?.mode === 'review' ? T('Veredicto del consejo', 'Council verdict') : T('Veredicto', 'Verdict')}</button>}
        {s.config && s.source === 'live' && <button className={btn} onClick={() => s.set({ showTeam: true })} title={T('Cambiar el modelo de cualquier rol', 'Change the model of any role')}><Users size={14} /> {T('Equipo', 'Team')}</button>}
        <button className={`${btn} ${s.focus ? 'border-accent bg-accent-soft text-accent' : ''}`} onClick={() => s.set({ focus: !s.focus })} title={T('Foco: los agentes debatiendo ocupan la pantalla; transcripción y métricas se achican', 'Focus: the debating agents fill the screen; transcript and metrics shrink')}><Focus size={14} /> {T('Foco', 'Focus')}</button>
        <button className={`${btn} w-10 justify-center px-0 ${sound ? 'text-accent' : 'text-ink-2'}`} onClick={() => { setSfx(!sound); setSound(!sound) }} title={sound ? T('Silenciar efectos', 'Mute effects') : T('Activar efectos de sonido', 'Turn sound effects on')}>{sound ? <Volume2 size={22} strokeWidth={2} className="shrink-0" /> : <VolumeX size={22} strokeWidth={2} className="shrink-0" />}</button>
        {live && s.source === 'live' && s.sessionId && (
          <button className={`${btn} border-danger/40 text-danger hover:border-danger hover:text-danger`} onClick={() => api.stop(s.sessionId!)}><Square size={14} /> {T('Detener', 'Stop')}</button>
        )}
        {live && s.source === 'replay' && <button className={btn} onClick={onNew}><Pause size={14} /> {T('Salir', 'Exit')}</button>}
        {!live && onRerun && <button className={btn} onClick={onRerun} title={T('Volver a correr el mismo debate desde cero (misma consigna y equipo)', 'Run the same debate again from scratch (same brief and team)')}><RotateCcw size={14} /> {T('Repetir', 'Repeat')}</button>}
        {!live && <button className={primary} onClick={onNew}><Plus size={15} /> {T('Nuevo', 'New')}</button>}
      </div>
    </div>
  )
}

function ExportMenu({ btn }: { btn: string }) {
  const T = useT()
  const set = useArena((s) => s.set)
  const sessionId = useArena((s) => s.sessionId)
  const config = useArena((s) => s.config)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const transcript = async () => {
    setOpen(false)
    const md = await api.transcript(sessionId!)
    downloadBlob(new Blob([md], { type: 'text/markdown' }), `tablyteam-${slug(config?.title || config?.topic || sessionId!)}-transcripcion.md`)
  }
  const item = 'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2'
  return (
    <div ref={ref} className="relative shrink-0">
      <button className={`${btn} ${open ? 'border-accent text-accent' : ''}`} onClick={() => setOpen(!open)}>
        <Download size={14} /> {T('Exportar', 'Export')} <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="fixed right-4 top-16 z-[70] w-72 rounded-2xl border border-line bg-surface p-1.5 text-sm shadow-[0_18px_40px_-18px_rgba(30,38,34,.55)]">
          <button className={item} onClick={() => { setOpen(false); set({ showVideoExport: true }) }}>
            <Video size={17} className="mt-0.5 text-accent" />
            <span><b className="font-medium">Video</b><span className="block text-xs text-ink-3">{T('MP4 9:16 o 16:9 para redes', 'MP4 9:16 or 16:9 for social media')}</span></span>
          </button>
          <button className={item} onClick={() => { setOpen(false); set({ showBriefExport: true }) }}>
            <Hammer size={17} className="mt-0.5 text-accent" />
            <span><b className="font-medium">{T('Brief para construir', 'Build brief')}</b><span className="block text-xs text-ink-3">{T('Markdown + prompt para Claude Code, Cursor…', 'Markdown + prompt for Claude Code, Cursor…')}</span></span>
          </button>
          <button className={item} onClick={() => { setOpen(false); set({ showBriefExport: true }) }}>
            <Rocket size={17} className="mt-0.5 text-accent" />
            <span><b className="font-medium">{T('Construir en la app', 'Build in the app')}</b><span className="block text-xs text-ink-3">{T('Un modelo escribe el proyecto, archivo por archivo', 'A model writes the project, file by file')}</span></span>
          </button>
          <button className={item} onClick={transcript}>
            <FileText size={17} className="mt-0.5 text-accent" />
            <span><b className="font-medium">{T('Transcripción', 'Transcript')}</b><span className="block text-xs text-ink-3">{T('El debate completo en .md', 'The full debate as .md')}</span></span>
          </button>
        </div>
      )}
    </div>
  )
}
