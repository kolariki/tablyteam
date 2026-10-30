import { BookOpen, Check, FileText, Globe, Loader2, Pencil, Plus, Sparkles, StickyNote, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { api, type Employee, type KnowledgeDoc } from '../lib/api'
import { getLang, tr, useT } from '../lib/i18n'
import type { AgentConfig, Role } from '../types'
import { useAvatars, type AvatarConfig } from '../lib/avatar'
import AgentAvatar from './AgentAvatar'
import AvatarEditor from './AvatarEditor'
import { PanelLoader } from './HomeLoader'
import { toast } from './Toast'

/**
 * The user's team: every role used in a project is saved as an employee (in the database) with its own prompt, memory, score
 * and knowledge base. Feeding a role (notes, documents, web pages) is a small RAG: the backend picks what matters for each topic.
 */
export const useEmployees = create<{ list: Employee[] | null; set: (list: Employee[]) => void; focus: string | null }>((set) => ({ list: null, set: (list) => set({ list }), focus: null }))
/** Opens «Mi equipo» on this employee (from a seat of the team table on the home). */
export const focusEmployee = (id: string | null) => useEmployees.setState({ focus: id })
export const loadEmployees = () => api.employees().then((d) => {
  useEmployees.getState().set(d.employees)
  useAvatars.getState().set(Object.fromEntries(d.employees.filter((e) => e.avatar).map((e) => [e.key, e.avatar!])))
  return d.employees
}).catch(() => null)

const roleName = (e: Employee) => (getLang() === 'en' ? e.role_label_en : e.role_label) || e.name

/** An employee as a seat of a new session (same role key, so its memory, score and knowledge follow it). */
export function employeeToAgent(e: Employee, i: number): AgentConfig {
  const id = (e.key.replace(/^custom:/, '').replace(/[^a-z0-9_-]+/g, '-').slice(0, 28) || 'rol') + (i ? `-${i}` : '')
  return { id, name: e.name, role: e.role, persona: e.persona, provider: e.provider || 'meta', model: e.model || '', skills: e.skills }
}

const kb = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n))

export function Employees() {
  const T = useT()
  const list = useEmployees((s) => s.list)
  const [sel, setSel] = useState<string | null>(() => useEmployees.getState().focus)
  const [roles, setRoles] = useState<Role[]>([])
  const [adding, setAdding] = useState(false)
  useEffect(() => { loadEmployees(); api.roles().then((r) => setRoles(r.roles)).catch(() => {}) }, [])
  const focus = useEmployees((s) => s.focus)
  useEffect(() => { if (focus && list?.some((e) => e.id === focus)) { setSel(focus); useEmployees.setState({ focus: null }) } }, [focus, list])
  useEffect(() => { if (list?.length && !list.some((e) => e.id === sel)) setSel(list[0].id) }, [list, sel])
  const current = list?.find((e) => e.id === sel) ?? null
  const add = async (roleId: string) => {
    setAdding(false)
    const r = roles.find((x) => x.id === roleId)
    try {
      const d = await api.createEmployee(r && roleId !== 'custom' ? { role: roleId, name: getLang() === 'en' ? r.label_en || r.label : r.label, persona: '' } : { name: tr('Rol nuevo', 'New role') })
      useEmployees.getState().set(d.employees)
      setSel(d.employees.find((e) => (r && roleId !== 'custom' ? e.role === roleId : e.name === tr('Rol nuevo', 'New role')))?.id ?? null)
    } catch (e) { toast.error(tr('No se pudo sumar', 'Could not add'), (e as Error).message) }
  }
  if (!list) return <div className="min-h-[360px]"><PanelLoader caption={T('Reuniendo a tu equipo…', 'Gathering your team…')} /></div>
  return (
    <div className="grid gap-4 sm:grid-cols-[210px_1fr] lg:grid-cols-[260px_1fr] lg:gap-6">
      <div className="space-y-1.5">
        {list.map((e) => (
          <button key={e.id} onClick={() => setSel(e.id)} className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${sel === e.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}>
            <AgentAvatar agent={{ name: e.name, role: e.role, provider: e.provider }} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{e.name}</span>
              <span className="block truncate text-[11px] text-ink-4">{e.docs ? `${e.docs} ${e.docs === 1 ? T('fuente', 'source') : T('fuentes', 'sources')}` : T('sin conocimiento', 'no knowledge')}{e.lessons ? ` · ${e.lessons} ${T('lecc.', 'lessons')}` : ''}</span>
            </span>
          </button>
        ))}
        {adding ? (
          <select autoFocus className="w-full rounded-xl border border-accent bg-surface px-2.5 py-2 text-[13px] outline-none" defaultValue="" onChange={(e) => e.target.value && add(e.target.value)} onBlur={() => setAdding(false)}>
            <option value="" disabled>{T('Elegí un rol…', 'Pick a role…')}</option>
            {roles.filter((r) => !list.some((e) => e.role === r.id)).map((r) => <option key={r.id} value={r.id}>{getLang() === 'en' ? r.label_en || r.label : r.label}</option>)}
          </select>
        ) : (
          <button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-2.5 py-2 text-[13px] text-ink-3 transition hover:border-accent hover:text-accent"><Plus size={14} /> {T('Sumar rol', 'Add role')}</button>
        )}
      </div>
      {current ? <EmployeeDetail key={current.id} e={current} onDeleted={() => setSel(null)} /> : (
        <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-[13.5px] text-ink-3">{T('Todavía no tenés empleados. Cada rol que uses en un proyecto queda guardado acá, o sumalo vos.', 'You have no employees yet. Every role you use in a project is saved here, or add one yourself.')}</div>
      )}
    </div>
  )
}

function EmployeeDetail({ e, onDeleted }: { e: Employee; onDeleted: () => void }) {
  const T = useT()
  const [name, setName] = useState(e.name)
  const [persona, setPersona] = useState(e.persona)
  const [saving, setSaving] = useState(false)
  const [docs, setDocs] = useState<KnowledgeDoc[] | null>(null)
  const [mode, setMode] = useState<'note' | 'file' | 'url' | null>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [editingFace, setEditingFace] = useState(false)
  const [asking, setAsking] = useState(false)
  const [hint, setHint] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const suggest = async () => {
    setSuggesting(true)
    try { setSuggestion((await api.suggestRolePrompt(e.id, hint, getLang())).prompt) } catch (err) { toast.error(tr('No se pudo sugerir', 'Could not suggest'), (err as Error).message) }
    setSuggesting(false)
  }
  const saveFace = async (avatar: AvatarConfig | null) => {
    try { await api.updateEmployee(e.id, { avatar }); await loadEmployees(); setEditingFace(false); toast.ok(tr('Cara guardada', 'Face saved'), tr('Se ve así en el equipo, la arena y el constructor.', 'It shows like this in the team, the arena and the builder.')) } catch (err) { toast.error(tr('No se pudo guardar', 'Could not save'), (err as Error).message) }
  }
  useEffect(() => { api.employeeDocs(e.id).then((d) => setDocs(d.docs)).catch(() => setDocs([])) }, [e.id])
  const dirty = name !== e.name || persona !== e.persona
  const save = async (text = persona) => {
    setSaving(true)
    try { useEmployees.getState().set((await api.updateEmployee(e.id, { name, persona: text })).employees); setPersona(text); toast.ok(tr('Guardado', 'Saved')) } catch (err) { toast.error(tr('No se pudo guardar', 'Could not save'), (err as Error).message) }
    setSaving(false)
  }
  const fed = async (p: Promise<{ docs: KnowledgeDoc[] }>) => {
    setBusy(true)
    try {
      setDocs((await p).docs)
      setMode(null); setNoteTitle(''); setNoteText(''); setUrl('')
      loadEmployees()
      toast.ok(tr('Lo sabe', 'It knows it now'), tr('Desde ahora lo usa en cada debate y revisión.', 'From now on it uses it in every debate and review.'))
    } catch (err) { toast.error(tr('No se pudo cargar', 'Could not add'), (err as Error).message) }
    setBusy(false)
  }
  const remove = async () => {
    if (!window.confirm(tr(`¿Sacar a ${e.name} de tu equipo? Se borra su conocimiento; su memoria queda por si vuelve.`, `Remove ${e.name} from your team? Its knowledge is deleted; its memory stays in case it comes back.`))) return
    try { useEmployees.getState().set((await api.deleteEmployee(e.id)).employees); onDeleted() } catch (err) { toast.error(tr('No se pudo sacar', 'Could not remove'), (err as Error).message) }
  }
  const total = (docs ?? []).reduce((n, d) => n + d.chars, 0)
  const tab = (k: 'note' | 'file' | 'url', icon: React.ReactNode, label: string) => (
    <button onClick={() => (k === 'file' ? fileRef.current?.click() : setMode(mode === k ? null : k))} disabled={busy} className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition ${mode === k ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:border-accent hover:text-accent'}`}>{icon} {label}</button>
  )
  return (
    <div className="min-w-0 space-y-4">
      {editingFace && <AvatarEditor employeeId={e.id} value={e.avatar} onSave={(c) => saveFace(c)} onReset={() => saveFace(null)} onClose={() => setEditingFace(false)} />}
      <div className="flex items-center gap-3">
        <button onClick={() => setEditingFace(true)} className="group relative shrink-0 rounded-full" title={T('Cambiar su cara', 'Change their face')}>
          <AgentAvatar agent={{ name: e.name, role: e.role, provider: e.provider }} size={56} />
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-sm transition group-hover:text-accent"><Pencil size={11} /></span>
        </button>
        <div className="min-w-0 flex-1">
          <input value={name} onChange={(ev) => setName(ev.target.value)} className="w-full bg-transparent text-[18px] font-semibold outline-none focus:underline" />
          <div className="truncate text-[12px] text-ink-3">{roleName(e)}{e.model ? ` · ${e.model}` : ''} · {T(`${e.projects} proyecto${e.projects === 1 ? '' : 's'}`, `${e.projects} project${e.projects === 1 ? '' : 's'}`)}{e.lessons ? ` · ${e.lessons} ${T('lecciones en memoria', 'lessons in memory')}` : ''}</div>
        </div>
        <button onClick={remove} className="rounded-full p-2 text-ink-4 transition hover:bg-danger/10 hover:text-danger" title={T('Sacar del equipo', 'Remove from the team')}><Trash2 size={15} /></button>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[11.5px] uppercase tracking-widest text-ink-3">{T('Prompt del rol', 'Role prompt')}</div>
          <button onClick={() => setAsking(!asking)} className="ml-auto flex h-7 items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3 text-[12px] font-semibold text-accent transition hover:bg-accent hover:text-white"><Sparkles size={12} /> {T('Sugerir con IA', 'Suggest with AI')}</button>
        </div>
        {asking && (
          <div className="mt-2 rounded-xl border border-accent/30 bg-accent-soft/40 p-3">
            <div className="flex flex-wrap gap-2">
              <input value={hint} onChange={(ev) => setHint(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && suggest()} placeholder={T('¿Qué querés que priorice? (opcional) Ej.: que piense en pymes y sea directo', 'What should it prioritise? (optional) e.g. think about SMBs and be direct')} className="min-w-[220px] flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-accent" />
              <button onClick={suggest} disabled={suggesting} className="flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[12.5px] font-semibold text-white disabled:opacity-50">{suggesting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {suggestion ? T('Otra versión', 'Another version') : T('Sugerir', 'Suggest')}</button>
            </div>
            <div className="mt-1.5 text-[11.5px] text-ink-3">{T('Usa el rol, su prompt actual y lo que le cargaste en Conocimiento sobre tu empresa.', 'Uses the role, its current prompt and what you loaded in Knowledge about your company.')}</div>
            {suggestion && (
              <div className="mt-2 rounded-lg border border-line bg-surface p-3">
                <div className="mb-1 text-[11.5px] text-ink-3">{T('Podés editarlo antes de usarlo', 'You can edit it before using it')}</div>
                <textarea value={suggestion} onChange={(ev) => setSuggestion(ev.target.value)} rows={Math.min(14, Math.max(5, Math.ceil(suggestion.length / 110)))} className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink outline-none focus:border-accent" />
                <div className="mt-2 flex gap-2">
                  <button disabled={!suggestion.trim()} onClick={() => { void save(suggestion.trim()); setSuggestion(null); setAsking(false) }} className="flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[12.5px] font-semibold text-white"><Check size={13} /> {T('Usar y guardar', 'Use and save')}</button>
                  <button onClick={() => setSuggestion(null)} className="h-8 rounded-full px-3 text-[12.5px] text-ink-3 hover:text-ink">{T('Descartar', 'Dismiss')}</button>
                </div>
              </div>
            )}
          </div>
        )}
        <textarea value={persona} onChange={(ev) => setPersona(ev.target.value)} rows={4} placeholder={T('Cómo trabaja, qué prioriza, cómo habla (se suma al rol del catálogo)', 'How it works, what it prioritises, how it speaks (added to the catalog role)')} className="mt-1.5 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-accent" />
        {dirty && <button onClick={() => save()} disabled={saving} className="mt-1.5 flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-white disabled:opacity-50">{saving && <Loader2 size={13} className="animate-spin" />} {T('Guardar', 'Save')}</button>}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-accent" />
          <span className="text-[11.5px] uppercase tracking-widest text-ink-3">{T('Conocimiento', 'Knowledge')}</span>
          {total > 0 && <span className="text-[11.5px] text-ink-4">{kb(total)} {T('caracteres', 'characters')}</span>}
        </div>
        <p className="mt-1 text-[12.5px] text-ink-3">{T('Info de tu empresa, datos, documentos, páginas: todo lo que el rol necesita saber. En cada debate y revisión recibe lo que importa para ese proyecto; las notas cortas, siempre.', 'Your company info, data, documents, pages: everything the role needs to know. In every debate and review it gets what matters for that project; short notes, always.')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {tab('note', <StickyNote size={13} />, T('Nota', 'Note'))}
          {tab('file', busy && !mode ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />, T('Documento', 'Document'))}
          {tab('url', <Globe size={13} />, T('Página web', 'Web page'))}
          <input ref={fileRef} type="file" className="hidden" accept=".md,.txt,.pdf,.docx,.csv,.json,.html,.yaml,.yml,.ts,.tsx,.js,.py,.sql" onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) fed(api.addEmployeeFile(e.id, f)) }} />
        </div>
        {mode === 'note' && (
          <div className="mt-2 space-y-2 rounded-xl border border-line p-3">
            <input value={noteTitle} onChange={(ev) => setNoteTitle(ev.target.value)} placeholder={T('Título (p. ej. Stack de la empresa)', 'Title (e.g. Company stack)')} className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-accent" />
            <textarea value={noteText} onChange={(ev) => setNoteText(ev.target.value)} rows={5} placeholder={T('Lo que el rol tiene que saber', 'What the role needs to know')} className="w-full resize-y rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-accent" />
            <button disabled={busy || !noteText.trim()} onClick={() => fed(api.addEmployeeNote(e.id, noteTitle, noteText))} className="flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={13} className="animate-spin" />} {T('Guardar nota', 'Save note')}</button>
          </div>
        )}
        {mode === 'url' && (
          <div className="mt-2 flex gap-2 rounded-xl border border-line p-3">
            <input value={url} onChange={(ev) => setUrl(ev.target.value)} placeholder="https://tuempresa.com/about" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-accent" />
            <button disabled={busy || !/^https?:\/\/\S+/.test(url.trim())} onClick={() => fed(api.addEmployeeUrl(e.id, url.trim()))} className="flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={13} className="animate-spin" />} {T('Leer página', 'Read page')}</button>
          </div>
        )}
        <div className="mt-3 space-y-2">
          {docs === null ? <div className="flex items-center gap-2 text-[13px] text-ink-3"><Loader2 size={13} className="animate-spin" /> {T('Cargando…', 'Loading…')}</div>
            : !docs.length ? <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[12.5px] text-ink-4">{T('Todavía no le cargaste nada.', 'Nothing loaded yet.')}</div>
            : docs.map((d) => (
              <div key={d.id} className="group flex items-start gap-2.5 rounded-xl border border-line px-3 py-2.5">
                <span className="mt-0.5 text-ink-3">{d.kind === 'url' ? <Globe size={14} /> : d.kind === 'file' ? <FileText size={14} /> : <StickyNote size={14} />}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{d.title}</div>
                  <div className="line-clamp-2 text-[12px] text-ink-3">{d.preview}</div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-4">{kb(d.chars)} {T('caracteres', 'characters')}{d.source ? ` · ${d.source}` : ''}</div>
                </div>
                <button onClick={() => api.deleteEmployeeDoc(e.id, d.id).then((r) => { setDocs(r.docs); loadEmployees() }).catch((err) => toast.error(tr('No se pudo borrar', 'Could not delete'), (err as Error).message))} className="rounded-full p-1.5 text-ink-4 opacity-60 transition hover:bg-surface-2 hover:text-danger group-hover:opacity-100" title={T('Borrar', 'Delete')}><Trash2 size={13} /></button>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

/** «Usar mi equipo»: pick saved employees (all or some) as the team of the new project; or keep the experiment's new roles. */
export function EmployeePicker({ onUse }: { onUse: (picked: Employee[]) => void }) {
  const T = useT()
  const list = useEmployees((s) => s.list)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { loadEmployees() }, [])
  useEffect(() => {
    if (!open) return
    const onDown = (ev: MouseEvent) => { if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])
  if (!list?.length) return null
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 8 ? p : [...p, id]))
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(!open); setPicked(list.slice(0, 8).map((e) => e.id)) }} className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-accent/40 bg-surface px-3 py-1.5 text-[13px] font-semibold text-accent shadow-sm transition hover:bg-accent-soft" title={T('Armá el equipo con tus roles guardados: con su prompt, su conocimiento y su memoria', 'Build the team from your saved roles: with their prompt, knowledge and memory')}>
        <BookOpen size={14} /> {T('Usar mi equipo', 'Use my team')} <span className="font-normal text-ink-4">{list.length}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[320px] rounded-2xl border border-line bg-surface p-3 shadow-[0_20px_50px_-20px_rgba(30,38,34,.45)]">
          <div className="px-1 text-[12px] text-ink-3">{T('Elegí quiénes trabajan en este proyecto (2 a 8). Llegan con lo que saben y lo que aprendieron.', 'Pick who works on this project (2 to 8). They come with what they know and what they learned.')}</div>
          <div className="mt-2 max-h-[300px] space-y-1 overflow-y-auto">
            {list.map((e) => (
              <label key={e.id} className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 transition ${picked.includes(e.id) ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}>
                <input type="checkbox" checked={picked.includes(e.id)} onChange={() => toggle(e.id)} className="accent-[var(--color-accent,#2f6b4f)]" />
                <AgentAvatar agent={{ name: e.name, role: e.role, provider: e.provider }} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{e.name}</span>
                  <span className="block truncate text-[11px] text-ink-4">{e.docs ? `${e.docs} ${e.docs === 1 ? T('fuente', 'source') : T('fuentes', 'sources')}` : T('sin conocimiento', 'no knowledge')}{e.lessons ? ` · ${e.lessons} ${T('lecc.', 'lessons')}` : ''}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
            <button type="button" onClick={() => setOpen(false)} className="px-2 text-[12.5px] text-ink-3 hover:text-ink">{T('Seguir con roles nuevos', 'Keep new roles')}</button>
            <button type="button" disabled={picked.length < 2} onClick={() => { onUse(list.filter((e) => picked.includes(e.id))); setOpen(false) }} className="rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40">{T(`Usar estos (${picked.length})`, `Use these (${picked.length})`)}</button>
          </div>
        </div>
      )}
    </div>
  )
}
