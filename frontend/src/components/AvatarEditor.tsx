import { Loader2, RotateCcw, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import { PRESET_FACES, avatarSrc, type AvatarConfig } from '../lib/avatar'
import { useT } from '../lib/i18n'

type Traits = { gender: string; age: string; skin: string; hair: string; hair_color: string; beard: string; glasses: string; clothes: string; expression: string; extra: string }
const opt = (es: string, en: string, v: string) => ({ es, en, v })
const CHOICES: Record<Exclude<keyof Traits, 'extra'>, ReturnType<typeof opt>[]> = {
  gender: [opt('Mujer', 'Woman', 'woman'), opt('Hombre', 'Man', 'man'), opt('Persona no binaria', 'Non-binary person', 'androgynous person')],
  age: [opt('20 y pico', '20s', '20s'), opt('30 y pico', '30s', '30s'), opt('40 y pico', '40s', '40s'), opt('50 y pico', '50s', '50s'), opt('60 o más', '60+', '60s')],
  skin: [opt('Muy clara', 'Very fair', 'very fair'), opt('Clara', 'Fair', 'fair'), opt('Oliva', 'Olive', 'olive'), opt('Trigueña', 'Medium tan', 'medium tan'), opt('Morena', 'Brown', 'brown'), opt('Oscura', 'Dark brown', 'dark brown'), opt('Muy oscura', 'Deep', 'deep dark')],
  hair: [opt('Sin pelo', 'Bald', 'bald'), opt('Rapado', 'Buzz cut', 'very short buzz cut'), opt('Corto', 'Short', 'short'), opt('Corto con rulos', 'Short curly', 'short curly'), opt('Ondulado', 'Wavy', 'medium-length wavy'), opt('Lacio largo', 'Long straight', 'long straight'), opt('Rulos largos', 'Long curly', 'long curly'), opt('Afro', 'Afro', 'natural afro'), opt('Rastas', 'Locs', 'locs'), opt('Trenzas', 'Braids', 'braided'), opt('Rodete', 'Bun', 'tied in a neat bun'), opt('Hiyab', 'Hijab', 'covered by a hijab, no visible'), opt('Turbante', 'Turban', 'covered by a turban, no visible')],
  hair_color: [opt('Negro', 'Black', 'black'), opt('Castaño oscuro', 'Dark brown', 'dark brown'), opt('Castaño', 'Brown', 'brown'), opt('Rubio', 'Blond', 'blond'), opt('Pelirrojo', 'Red', 'red'), opt('Canoso', 'Grey', 'grey'), opt('Blanco', 'White', 'white')],
  beard: [opt('Sin barba', 'No beard', 'none'), opt('Barba de pocos días', 'Stubble', 'light stubble'), opt('Barba corta', 'Short beard', 'short trimmed beard'), opt('Barba completa', 'Full beard', 'full beard'), opt('Bigote', 'Moustache', 'moustache')],
  glasses: [opt('Sin anteojos', 'No glasses', 'none'), opt('Redondos', 'Round', 'round wire'), opt('Rectangulares', 'Rectangular', 'thin rectangular'), opt('De carey', 'Tortoiseshell', 'tortoiseshell'), opt('De color', 'Colored frame', 'bold colored frame')],
  clothes: [opt('Saco y camisa', 'Blazer and shirt', 'a navy blazer and a white shirt'), opt('Saco y remera', 'Blazer and tee', 'a charcoal blazer over a plain tee'), opt('Suéter', 'Sweater', 'a knit sweater'), opt('Camisa', 'Shirt', 'an oxford shirt'), opt('Buzo', 'Hoodie', 'a minimal hoodie'), opt('Cuello alto', 'Turtleneck', 'a black turtleneck')],
  expression: [opt('Sonrisa suave', 'Soft smile', 'calm confident expression with a slight natural smile'), opt('Sonriente', 'Smiling', 'warm open smile'), opt('Serio', 'Serious', 'serious focused expression')],
}
const LABELS: Record<keyof Traits, [string, string]> = {
  gender: ['Persona', 'Person'], age: ['Edad', 'Age'], skin: ['Tono de piel', 'Skin tone'], hair: ['Pelo', 'Hair'], hair_color: ['Color de pelo', 'Hair colour'],
  beard: ['Barba', 'Beard'], glasses: ['Anteojos', 'Glasses'], clothes: ['Ropa', 'Clothes'], expression: ['Expresión', 'Expression'], extra: ['Algo más (opcional)', 'Anything else (optional)'],
}

/** Pick one of 24 realistic faces, or create a new one with AI from the traits you choose (same style as the role portraits). */
export default function AvatarEditor({ employeeId, value, onSave, onReset, onClose }: { employeeId: string; value: AvatarConfig | null; onSave: (c: AvatarConfig) => void; onReset: () => void; onClose: () => void }) {
  const T = useT()
  const [cur, setCur] = useState<AvatarConfig | null>(value)
  const [tab, setTab] = useState<'gallery' | 'create'>('gallery')
  const [t, setT] = useState<Traits>({ gender: 'woman', age: '30s', skin: 'medium tan', hair: 'medium-length wavy', hair_color: 'dark brown', beard: 'none', glasses: 'none', clothes: 'a navy blazer and a white shirt', expression: CHOICES.expression[0].v, extra: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const create = async () => {
    setBusy(true)
    setError(null)
    try { setCur(await api.generateFace(employeeId, t)) } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }
  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-paper/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[90vh] w-full max-w-[980px] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(30,38,34,.55)]">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <div className="serif flex-1 text-[22px]">{T('Elegí su cara', 'Pick their face')}</div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2" aria-label={T('Cerrar', 'Close')}><X size={18} /></button>
        </div>
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center gap-3 md:sticky md:top-0 md:self-start">
            <div className="h-48 w-48 overflow-hidden rounded-full border border-line bg-surface-2">
              {busy ? <div className="flex h-full items-center justify-center text-ink-3"><Loader2 size={22} className="animate-spin" /></div> : cur ? <img src={avatarSrc(cur)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-6 text-center text-[12.5px] text-ink-4">{T('Elegí una cara', 'Pick a face')}</div>}
            </div>
            <button onClick={() => cur && onSave(cur)} disabled={!cur || busy} className="h-10 w-full rounded-full bg-accent text-[13.5px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40">{T('Usar esta cara', 'Use this face')}</button>
            <button onClick={onReset} className="flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-accent"><RotateCcw size={13} /> {T('Volver al retrato original', 'Back to the original portrait')}</button>
          </div>
          <div>
            <div className="flex gap-1">
              {(['gallery', 'create'] as const).map((k) => <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${tab === k ? 'bg-accent text-white' : 'text-ink-2 hover:bg-surface-2'}`}>{k === 'create' && <Sparkles size={13} />}{k === 'gallery' ? T('24 personas', '24 people') : T('Crear con IA', 'Create with AI')}</button>)}
            </div>
            {tab === 'gallery' ? (
              <div className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-6">
                {PRESET_FACES.map((p) => (
                  <button key={p.src} onClick={() => setCur(p)} className={`overflow-hidden rounded-2xl border transition ${cur?.src === p.src ? 'border-accent ring-2 ring-accent/50' : 'border-line hover:border-accent'}`}>
                    <img src={avatarSrc(p)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-[12.5px] text-ink-3">{T('Elegí cómo es y la IA genera un retrato realista con el mismo estilo que el resto del equipo. Usa tu key de OpenAI (se cobra por imagen).', 'Choose how they look and AI generates a realistic portrait in the same style as the rest of the team. Uses your OpenAI key (billed per image).')}</p>
                {(Object.keys(CHOICES) as (keyof typeof CHOICES)[]).map((k) => (
                  <div key={k}>
                    <div className="mb-1 text-[11.5px] uppercase tracking-widest text-ink-3">{T(...LABELS[k])}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {CHOICES[k].map((o) => <button key={o.v} onClick={() => setT({ ...t, [k]: o.v })} aria-pressed={t[k] === o.v} className={`rounded-full border px-3 py-1 text-[12.5px] transition ${t[k] === o.v ? 'border-accent bg-accent-soft font-semibold text-accent' : 'border-line text-ink-2 hover:border-accent'}`}>{T(o.es, o.en)}</button>)}
                    </div>
                  </div>
                ))}
                <div>
                  <div className="mb-1 text-[11.5px] uppercase tracking-widest text-ink-3">{T(...LABELS.extra)}</div>
                  <input value={t.extra} onChange={(e) => setT({ ...t, extra: e.target.value })} placeholder={T('Ej.: pecas, aros chicos, mirada cálida', 'e.g. freckles, small earrings, warm look')} className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-accent" />
                </div>
                <button onClick={create} disabled={busy} className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-[13.5px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {busy ? T('Generando… (puede tardar un minuto)', 'Generating… (can take a minute)') : T('Generar cara', 'Generate face')}</button>
                {error && <div className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
