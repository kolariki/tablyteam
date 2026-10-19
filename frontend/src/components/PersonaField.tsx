import { FileUp, Loader2, Maximize2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../lib/api'
import { tr, useT } from '../lib/i18n'
import { toast } from './Toast'

/**
 * The role's personality / prompt: a textarea with two buttons beside it — attach a document (md, txt, pdf, docx,
 * code…) whose text REPLACES the prompt, and expand it to an 80% editor to read and edit comfortably.
 */
export default function PersonaField({ value, onChange, placeholder, className = '', roleLabel, inputStyle }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; roleLabel?: string; inputStyle?: React.CSSProperties }) {
  const T = useT()
  const [uploading, setUploading] = useState(false)
  const [full, setFull] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])
  const upload = async (list: FileList | null) => {
    const f = list?.[0]
    if (!f) return
    setUploading(true)
    try {
      const r = await api.documentText(f)
      onChange(r.text)
      toast.ok(tr('Prompt reemplazado por el documento', 'Prompt replaced by the document'), tr(`${f.name}: ${r.chars.toLocaleString()} caracteres${r.truncated ? ' (recortado al tope)' : ''}.`, `${f.name}: ${r.chars.toLocaleString()} characters${r.truncated ? ' (cut at the cap)' : ''}.`))
    } catch (e) {
      toast.error(tr('No se pudo leer el documento', 'Could not read the document'), (e as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  const base = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-accent'
  return (
    <div className={`flex items-start gap-1.5 ${className}`}>
      <textarea className={`${base} h-14 resize-none text-[13px]`} style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? T('personalidad / prompt del rol', 'personality / role prompt')} />
      <div className="flex shrink-0 flex-col gap-1">
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-surface text-ink-3 hover:border-accent hover:text-accent disabled:opacity-50" title={T('Adjuntar un documento: su texto reemplaza este prompt (md, txt, pdf, docx, código)', 'Attach a document: its text replaces this prompt (md, txt, pdf, docx, code)')}>
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />}
        </button>
        <button type="button" onClick={() => setFull(true)} className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-surface text-ink-3 hover:border-accent hover:text-accent" title={T('Abrir grande para leer y editar', 'Open large to read and edit')}>
          <Maximize2 size={12} />
        </button>
        <input ref={fileRef} type="file" className="hidden" accept=".md,.markdown,.txt,.pdf,.docx,.json,.csv,.yaml,.yml,.html,.js,.ts,.tsx,.py,.rb,.go,.java,.kt,.swift,.sql" onChange={(e) => upload(e.target.files)} />
      </div>
      {full && createPortal(
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-paper/70 p-4 backdrop-blur-sm" onClick={() => setFull(false)}>
          <div className="panel flex h-[80vh] w-[80vw] flex-col rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="font-semibold text-ink">{T('Prompt del rol', 'Role prompt')}{roleLabel ? ` · ${roleLabel}` : ''}</div>
              <div className="text-[12px] text-ink-3">{value.length.toLocaleString()} {T('caracteres', 'characters')}</div>
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="ml-auto flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50">{uploading ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />} {T('Adjuntar documento', 'Attach document')}</button>
              <button type="button" onClick={() => setFull(false)} className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white"><X size={14} /> {T('Listo', 'Done')}</button>
            </div>
            <textarea autoFocus className={`${base} mt-3 flex-1 resize-none font-mono text-[13px] leading-relaxed`} style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
