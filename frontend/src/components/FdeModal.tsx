import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Calendar, Check, CheckCircle2, CreditCard, Download, HardHat, Loader2, Lock, Minus, Plus, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBuild } from '../buildStore'
import { api, type FdePackage, type FdeRequest, type StripeStatus } from '../lib/api'
import { tr, useT } from '../lib/i18n'
import { downloadBlob } from '../lib/recorder'
import { toast } from './Toast'

const STATUS = (): Record<string, string> => ({
  new: tr('recibido', 'received'),
  paid: tr('pagado', 'paid'),
  scheduled: tr('agendado', 'scheduled'),
  in_progress: tr('en curso', 'in progress'),
  delivered: tr('entregado', 'delivered'),
  closed: tr('cerrado', 'closed'),
  cancelled: tr('cancelado', 'cancelled'),
})

const ICON: Record<string, string> = { service_setup: '🔑', launch: '🚀', integration: '🔌', review: '🔍', hours: '⏱️' }

/**
 * "Pedir un developer": fixed-price FDE packages. The request carries the project's real state as a ticket and, when
 * Stripe is configured, the order is paid on Stripe Checkout right away (the user comes back here with ?checkout=…).
 */
export default function FdeModal({ onClose, prefill = '', initialPackage = 'launch' }: { onClose: () => void; prefill?: string; initialPackage?: string }) {
  const T = useT()
  const b = useBuild()
  const [packages, setPackages] = useState<FdePackage[]>([])
  const [bookingUrl, setBookingUrl] = useState<string | null>(null)
  const [stripe, setStripe] = useState<StripeStatus | null>(null)
  const [selected, setSelected] = useState<string>(initialPackage)
  const [hours, setHours] = useState(4)
  const [notes, setNotes] = useState(prefill)
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [paying, setPaying] = useState<string | null>(null)
  const [done, setDone] = useState<FdeRequest | null>(null)
  const [mine, setMine] = useState<FdeRequest[]>([])
  const status = STATUS()
  useEffect(() => {
    api.fdePackages().then((d) => { setPackages(d.packages); setBookingUrl(d.booking_url); setStripe(d.stripe) }).catch((e) => toast.error(tr('No pude cargar los paquetes', 'Could not load the packages'), (e as Error).message))
    if (b.sessionId) api.fdeRequests(b.sessionId).then(setMine).catch(() => {})
  }, [b.sessionId])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const pkg = packages.find((p) => p.id === selected)
  const latest = b.versions[b.versions.length - 1]
  const canPay = !!stripe?.enabled
  const total = pkg ? pkg.price_usd * (pkg.id === 'hours' ? hours : 1) : 0

  /** Sends the user to Stripe for one request; the page comes back with ?checkout=… and App confirms it. */
  const pay = async (r: FdeRequest) => {
    if (!canPay) return
    setPaying(r.id)
    try {
      const o = await api.checkout({ kind: 'fde', ref: r.id, hours: r.package === 'hours' ? hours : undefined })
      window.location.href = o.url
    } catch (e) {
      toast.error(tr('No se pudo iniciar el pago', 'Could not start the payment'), (e as Error).message)
      setPaying(null)
    }
  }

  const submit = async () => {
    if (!b.sessionId || !b.id || !pkg) return
    setBusy(true)
    try {
      const r = await api.fdeCreate({ session_id: b.sessionId, build_id: b.id, package: pkg.id, notes: notes.trim() + (pkg.id === 'hours' ? `\n\nHoras pedidas: ${hours}` : ''), contact: contact.trim() })
      setMine((m) => [r, ...m])
      if (canPay) { await pay(r); return }
      setDone(r)
      toast.ok(tr('Pedido enviado', 'Request sent'), `${pkg.name} · ${r.id}. ${tr('Te contactamos a la brevedad.', 'We will contact you shortly.')}`)
    } catch (e) {
      toast.error(tr('No se pudo crear el pedido', 'Could not create the request'), (e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const downloadTicket = async (r: FdeRequest) => {
    const md = await api.fdeTicket(r.id).catch((e) => { toast.error(tr('No se pudo bajar el ticket', 'Could not download the ticket'), (e as Error).message); return null })
    if (md) downloadBlob(new Blob([md], { type: 'text/markdown' }), `pedido-${r.id}.md`)
  }

  const label = 'text-[10.5px] uppercase tracking-[0.25em] text-ink-3'
  const input = 'mt-1.5 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13.5px] shadow-sm outline-none transition focus:border-accent'

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[125] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(30,38,34,.6)]" style={{ maxHeight: 'calc(100vh - 32px)' }} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="relative flex items-start gap-4 border-b border-line px-7 py-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-[0_10px_24px_-10px_rgba(47,107,93,.7)]"><HardHat size={24} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.3em] text-accent">{T('Developer a pedido', 'Developer on demand')}</div>
            <h3 className="mt-0.5 text-[32px] leading-tight">{T('Un ingeniero nuestro lo sube por vos', 'One of our engineers ships it for you')}</h3>
            <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-ink-2">{T('Precio fijo, plazo fijo, alcance cerrado. Recibe tu proyecto con todo el contexto: ', 'Fixed price, fixed deadline, closed scope. They get your project with full context: ')}{latest ? `${latest.tag}${latest.readiness != null ? ` (${latest.readiness}% ${T('listo', 'ready')})` : ''}, ` : ''}{T('los bloqueantes del consejo y los servicios que faltan. Trabaja sobre tu repo y te entrega un acta.', 'the council blockers and the missing services. They work on your repo and hand you a delivery report.')}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button onClick={onClose} className="rounded-full p-1.5 text-ink-3 transition hover:bg-surface-2 hover:text-ink" aria-label={T('Cerrar', 'Close')}><X size={18} strokeWidth={2.5} /></button>
            {stripe && (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold ${canPay ? 'border-ok/30 bg-ok/10 text-ok' : 'border-line bg-paper text-ink-3'}`}>
                <Lock size={10} /> {canPay ? `${T('Pago seguro con Stripe', 'Secure payment with Stripe')}${stripe.mode === 'test' ? ' · test' : ''}` : T('Pago a coordinar por email', 'Payment arranged by email')}
              </span>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          {done ? (
            <div className="px-7 py-6">
              <div className="rounded-2xl border border-ok/40 bg-ok/5 px-6 py-5">
                <div className="flex items-center gap-2.5 text-lg font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-ok text-white"><Check size={16} strokeWidth={3} /></span> {T('Pedido', 'Request')} {done.id} {T('recibido', 'received')} · {packages.find((p) => p.id === done.package)?.name}</div>
                <p className="mt-2 text-[13.5px] text-ink-2">{T('Armamos el ticket con el estado real del proyecto. Te contactamos a tu email para coordinar el pago y el inicio.', 'We built the ticket with the real state of the project. We will email you to arrange payment and the start.')}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {bookingUrl && <a href={bookingUrl} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm shadow-sm transition hover:bg-accent-soft hover:border-accent hover:text-accent"><Calendar size={15} /> {T('Elegir horario', 'Pick a time')}</a>}
                  <button onClick={() => downloadTicket(done)} className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm shadow-sm transition hover:bg-accent-soft hover:border-accent hover:text-accent"><Download size={15} /> {T('Ver el ticket que recibe el developer', 'See the ticket the developer receives')}</button>
                </div>
              </div>
              <TicketPreview r={done} />
            </div>
          ) : (
            <>
              {/* packages */}
              <div className="grid gap-3 px-7 pt-6 sm:grid-cols-2 lg:grid-cols-4">
                {packages.map((p) => {
                  const on = selected === p.id
                  return (
                    <motion.button key={p.id} type="button" onClick={() => setSelected(p.id)} whileHover={{ y: -3 }} whileTap={{ scale: 0.985 }} className={`relative flex flex-col rounded-2xl border p-4 text-left shadow-[0_12px_28px_-18px_rgba(30,38,34,.45)] transition-colors ${on ? 'border-accent bg-accent-soft/50 shadow-[0_0_0_3px_rgba(47,107,93,.14),0_16px_36px_-18px_rgba(47,107,93,.45)]' : 'border-line bg-paper hover:border-ink-4'}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-xl leading-none">{ICON[p.id] ?? '🛠️'}</span>
                        <div className="min-w-0 text-[14.5px] font-semibold leading-tight">{p.name}</div>
                        {p.badge && <span className="ml-auto shrink-0 rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gold">{p.badge}</span>}
                      </div>
                      <div className="mt-3 flex items-baseline gap-1"><span className="text-[12px] text-ink-3">USD</span><span className="font-mono text-[30px] leading-none">{p.price_usd}</span>{p.id === 'hours' && <span className="text-[12px] text-ink-3">/h</span>}</div>
                      <span className="mt-2 inline-flex w-fit rounded-full border border-line bg-surface px-2 py-0.5 text-[10.5px] text-ink-2">{p.eta}</span>
                      <div className="mt-3 text-[12.5px] leading-snug text-ink-2">{p.tagline}</div>
                      {on && <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white shadow-sm"><Check size={13} strokeWidth={3} /></span>}
                    </motion.button>
                  )
                })}
              </div>

              {/* detail + form */}
              {pkg && (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={pkg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="grid gap-4 px-7 pt-5 md:grid-cols-[1.05fr_1fr]">
                    <div className="rounded-2xl border border-line bg-paper p-5 text-[13px] shadow-[0_12px_28px_-18px_rgba(30,38,34,.35)]">
                      <div className={label}>{T('Incluye', 'Includes')}</div>
                      <ul className="mt-2 space-y-1.5">{pkg.includes.map((x) => <li key={x} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-ok" /> <span>{x}</span></li>)}</ul>
                      {pkg.excludes.length > 0 && <><div className={`${label} mt-4`}>{T('No incluye', 'Does not include')}</div><ul className="mt-2 space-y-1 text-ink-3">{pkg.excludes.map((x) => <li key={x} className="flex gap-2"><Minus size={14} className="mt-0.5 shrink-0" /> <span>{x}</span></li>)}</ul></>}
                      <div className={`${label} mt-4`}>{T('Vas a tener que dar', 'You will need to provide')}</div>
                      <ul className="mt-2 space-y-1 text-ink-2">{pkg.needs.map((x) => <li key={x} className="flex gap-2"><ArrowRight size={14} className="mt-0.5 shrink-0 text-accent" /> <span>{x}</span></li>)}</ul>
                      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-[12px] text-ink-3"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent" /> {T('El developer nunca recibe contraseñas: lo invitás como colaborador y le quitás el acceso al terminar.', 'The developer never receives passwords: you invite them as a collaborator and revoke access when done.')}</div>
                    </div>
                    <div className="rounded-2xl border border-line bg-paper p-5 shadow-[0_12px_28px_-18px_rgba(30,38,34,.35)]">
                      {pkg.id === 'hours' && (
                        <div className="mb-4">
                          <div className={label}>{T('Horas', 'Hours')}</div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <button onClick={() => setHours((h) => Math.max(4, h - 1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface shadow-sm transition hover:border-accent hover:text-accent"><Minus size={14} /></button>
                            <span className="w-14 text-center font-mono text-xl">{hours}</span>
                            <button onClick={() => setHours((h) => Math.min(80, h + 1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface shadow-sm transition hover:border-accent hover:text-accent"><Plus size={14} /></button>
                            <span className="ml-2 text-[12px] text-ink-3">{T('mínimo 4 h', 'minimum 4 h')}</span>
                          </div>
                        </div>
                      )}
                      <label className={label}>{T('Qué necesitás (se suma al ticket automático)', 'What you need (added to the automatic ticket)')}</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} placeholder={T('Ej.: subirla a producción con mi dominio sismos.com.ar, conectar los datos reales de INPRES y dejar el batch diario corriendo.', 'E.g.: ship it to production on my domain sismos.com.ar, connect the real INPRES data and leave the daily batch running.')} className={`${input} resize-none`} />
                      <label className={`${label} mt-3 block`}>{T('Contacto (email o WhatsApp)', 'Contact (email or WhatsApp)')}</label>
                      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={T('si lo dejás vacío usamos el email de tu cuenta', 'if left empty we use your account email')} className={input} />
                      <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-2.5">
                        <span className="text-[12.5px] text-ink-2">{pkg.name}{pkg.id === 'hours' ? ` × ${hours} h` : ''}</span>
                        <span className="font-mono text-lg">USD {total}</span>
                      </div>
                      <button disabled={busy || !!paying || !b.id} onClick={submit} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(47,107,93,.7)] transition hover:brightness-110 disabled:opacity-40">
                        {busy || paying ? <Loader2 size={17} className="animate-spin" /> : canPay ? <CreditCard size={17} /> : <HardHat size={17} />}
                        {canPay ? `${T('Pedir y pagar', 'Request and pay')} · USD ${total}` : `${T('Pedir', 'Request')} «${pkg.name}» · USD ${total}`}
                      </button>
                      <div className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-4">
                        <Lock size={11} /> {canPay ? T('Te llevamos a Stripe; no guardamos tu tarjeta.', 'We take you to Stripe; we never store your card.') : T('Sin cargo hasta confirmar alcance y turno.', 'No charge until scope and slot are confirmed.')} {T('Garantía: si no queda en producción, no se cobra.', 'Guarantee: if it does not end up in production, you do not pay.')}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* previous requests */}
              {mine.length > 0 && (
                <div className="px-7 pb-2 pt-6">
                  <div className={label}>{T('Tus pedidos para este proyecto', 'Your requests for this project')}</div>
                  <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-paper">
                    {mine.map((r, i) => (
                      <div key={r.id} className={`flex items-center gap-3 px-4 py-2.5 text-[12.5px] ${i ? 'border-t border-line' : ''}`}>
                        <span className="font-mono text-ink-3">{r.id}</span>
                        <span className="font-medium">{packages.find((p) => p.id === r.package)?.name ?? r.package}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase ${r.status === 'paid' || r.status === 'delivered' || r.status === 'closed' ? 'border-ok/30 bg-ok/10 text-ok' : r.status === 'cancelled' ? 'border-line bg-surface-2 text-ink-3' : 'border-gold/40 bg-gold/10 text-gold'}`}>{(r.status === 'paid' || r.status === 'delivered' || r.status === 'closed') && <span className="h-1.5 w-1.5 rounded-full bg-ok" />}{status[r.status] ?? r.status}</span>
                        <span className="ml-auto text-ink-3">{new Date(r.created * 1000).toLocaleDateString()}</span>
                        {r.status === 'new' && canPay && <button disabled={!!paying} onClick={() => pay(r)} className="flex h-7 items-center gap-1 rounded-full bg-accent px-2.5 text-[11.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40">{paying === r.id ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />} {T('pagar', 'pay')}</button>}
                        <button onClick={() => downloadTicket(r)} className="text-accent hover:underline">{T('ticket', 'ticket')}</button>
                        {r.status === 'new' && <button onClick={async () => { await api.fdeUpdate(r.id, { status: 'cancelled' }).catch(() => {}); setMine((m) => m.map((x) => (x.id === r.id ? { ...x, status: 'cancelled' } : x))) }} className="text-ink-3 hover:text-danger">{T('cancelar', 'cancel')}</button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="h-6" />
            </>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

function TicketPreview({ r }: { r: FdeRequest }) {
  const T = useT()
  const t = r.ticket
  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper p-5 text-[12.5px]">
      <div className="text-[10.5px] uppercase tracking-[0.25em] text-ink-3">{T('Lo que recibe el developer', 'What the developer receives')}</div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div><div className="font-semibold">{T('Proyecto', 'Project')}</div><div className="text-ink-2">{t.project.title} · {t.project.version ?? T('sin versión', 'no version')} · {t.project.files} {T('archivos', 'files')}{t.project.readiness != null ? ` · ${t.project.readiness}% ${T('listo', 'ready')}` : ''}</div></div>
        <div><div className="font-semibold">Stack</div><div className="text-ink-2">{t.stack.length ? t.stack.map((s) => s.label).join(', ') : '—'}</div></div>
        <div><div className="font-semibold">{T('Bloqueantes abiertos', 'Open blockers')}</div><ul className="list-disc pl-4 text-ink-2">{t.blockers.length ? t.blockers.slice(0, 6).map((b, i) => <li key={i}>{b.text}</li>) : <li>{T('ninguno registrado', 'none recorded')}</li>}</ul></div>
        <div><div className="font-semibold">{T('Servicios', 'Services')}</div><ul className="text-ink-2">{t.services.length ? t.services.map((s) => <li key={s.service}>{s.configured ? '✅' : '⬜'} {s.service}</li>) : <li>{T('no requiere', 'none required')}</li>}</ul>{t.missing_vars.length > 0 && <div className="mt-1 text-gold">{T('faltan', 'missing')}: {t.missing_vars.join(', ')}</div>}</div>
      </div>
    </div>
  )
}
