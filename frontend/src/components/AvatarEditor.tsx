import { RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { BEARDS, BGS, CLOTHES_COLORS, CLOTHING, GLASSES, HAIR_COLORS, PRESETS, SKINS, TOPS, avatarSrc, type AvatarConfig } from '../lib/avatar'
import { useT } from '../lib/i18n'

/** Pick a face from 24 ready-made people, then tweak it: skin, hair (or none), beard, glasses, clothes, expression, background. */
export default function AvatarEditor({ value, onSave, onReset, onClose }: { value: AvatarConfig | null; onSave: (c: AvatarConfig) => void; onReset: () => void; onClose: () => void }) {
  const T = useT()
  const [c, setC] = useState<AvatarConfig>(value ?? PRESETS[0])
  const set = (p: Partial<AvatarConfig>) => setC((x) => ({ ...x, ...p }))
  const Swatches = ({ colors, cur, on, label }: { colors: string[]; cur: string; on: (v: string) => void; label: string }) => (
    <Row label={label}>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((h) => (
          <button key={h} onClick={() => on(h)} aria-label={h} aria-pressed={cur === h} className={`h-7 w-7 rounded-full border transition ${cur === h ? 'ring-2 ring-accent ring-offset-2' : 'border-line hover:scale-110'}`}
            style={{ background: h === 'transparent' ? 'repeating-conic-gradient(#e5e7eb 0 25%, #fff 0 50%) 50%/10px 10px' : `#${h}` }} />
        ))}
      </div>
    </Row>
  )
  const Options = ({ items, cur, on, label, preview }: { items: string[]; cur: string; on: (v: string) => void; label: string; preview: (v: string) => AvatarConfig }) => (
    <Row label={label}>
      <div className="flex flex-wrap gap-1.5">
        {items.map((v) => (
          <button key={v} onClick={() => on(v)} aria-pressed={cur === v} title={v === 'none' ? T('Ninguno', 'None') : v} className={`overflow-hidden rounded-xl border bg-surface transition ${cur === v ? 'border-accent ring-2 ring-accent/40' : 'border-line hover:border-accent'}`}>
            <img src={avatarSrc(preview(v))} alt="" className="h-11 w-11" />
          </button>
        ))}
      </div>
    </Row>
  )
  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-paper/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[90vh] w-full max-w-[980px] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(30,38,34,.55)]">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <div className="serif flex-1 text-[22px]">{T('Elegí su cara', 'Pick their face')}</div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2" aria-label={T('Cerrar', 'Close')}><X size={18} /></button>
        </div>
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center gap-3 md:sticky md:top-0 md:self-start">
            <img src={avatarSrc(c)} alt="" className="h-48 w-48 rounded-full border border-line bg-surface-2" />
            <button onClick={() => onSave(c)} className="h-10 w-full rounded-full bg-accent text-[13.5px] font-semibold text-white shadow-sm transition hover:brightness-110">{T('Usar esta cara', 'Use this face')}</button>
            <button onClick={onReset} className="flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-accent"><RotateCcw size={13} /> {T('Volver al retrato original', 'Back to the original portrait')}</button>
          </div>
          <div className="space-y-4">
            <Row label={T('Empezá por una persona', 'Start from a person')}>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                {PRESETS.map((p, i) => (
                  <button key={i} onClick={() => setC(p)} className={`overflow-hidden rounded-2xl border transition ${JSON.stringify(p) === JSON.stringify(c) ? 'border-accent ring-2 ring-accent/40' : 'border-line hover:border-accent'}`}>
                    <img src={avatarSrc(p)} alt="" className="aspect-square w-full" />
                  </button>
                ))}
              </div>
            </Row>
            <Swatches label={T('Color de piel', 'Skin tone')} colors={SKINS} cur={c.skin} on={(skin) => set({ skin })} />
            <Options label={T('Pelo', 'Hair')} items={TOPS} cur={c.top} on={(top) => set({ top })} preview={(top) => ({ ...c, top, bg: 'transparent' })} />
            <Swatches label={T('Color de pelo y barba', 'Hair and beard colour')} colors={HAIR_COLORS} cur={c.hair} on={(hair) => set({ hair })} />
            <Options label={T('Barba', 'Beard')} items={BEARDS} cur={c.beard} on={(beard) => set({ beard })} preview={(beard) => ({ ...c, beard, bg: 'transparent' })} />
            <Options label={T('Anteojos', 'Glasses')} items={GLASSES} cur={c.glasses} on={(glasses) => set({ glasses })} preview={(glasses) => ({ ...c, glasses, bg: 'transparent' })} />
            <Options label={T('Ropa', 'Clothes')} items={CLOTHING} cur={c.clothing} on={(clothing) => set({ clothing })} preview={(clothing) => ({ ...c, clothing, bg: 'transparent' })} />
            <Swatches label={T('Color de ropa', 'Clothes colour')} colors={CLOTHES_COLORS} cur={c.clothes} on={(clothes) => set({ clothes })} />
            <Row label={T('Expresión', 'Expression')}>
              <div className="flex gap-1.5">
                {(['smile', 'serious', 'happy'] as const).map((face) => (
                  <button key={face} onClick={() => set({ face })} aria-pressed={c.face === face} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[12.5px] transition ${c.face === face ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:border-accent'}`}>
                    <img src={avatarSrc({ ...c, face, bg: 'transparent' })} alt="" className="h-7 w-7" /> {face === 'smile' ? T('Sonríe', 'Smiling') : face === 'serious' ? T('Serio', 'Serious') : T('Contento', 'Happy')}
                  </button>
                ))}
              </div>
            </Row>
            <Swatches label={T('Fondo', 'Background')} colors={BGS} cur={c.bg} on={(bg) => set({ bg })} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] uppercase tracking-widest text-ink-3">{label}</div>
      {children}
    </div>
  )
}
