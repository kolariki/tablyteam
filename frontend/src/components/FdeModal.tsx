import { motion } from 'framer-motion'
import { Calendar, CheckCircle2, CreditCard, Download, HardHat, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useBuild } from '../buildStore'
import { api, type FdePackage, type FdeRequest } from '../lib/api'
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

/** "Pedir un developer": fixed-price FDE packages; the request carries the project's real state as a ticket. */
export default function FdeModal({ onClose, prefill = '' }: { onClose: () => void; prefill?: string }) {
  const T = useT()
  const b = useBuild()
  const [packages, setPackages] = useState<FdePackage[]>([])
  const [bookingUrl, setBookingUrl] = useState<string | null>(null)
  const [selected, setSelected] = useState<string>('launch')
  const [notes, setNotes] = useState(prefill)
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<FdeRequest | null>(null)
  const [mine, setMine] = useState<FdeRequest[]>([])
  const status = STATUS()
  useEffect(() => {
    api.fdePackages().then((d) => { setPackages(d.packages); setBookingUrl(d.booking_url) }).catch((e) => toast.error(tr('No pude cargar los paquetes', 'Could not load the packages'), (e as Error).message))
    if (b.sessionId) api.fdeRequests(b.sessionId).then(setMine).catch(() => {})
  }, [b.sessionId])
  const pkg = packages.find((p) => p.id === selected)
  const latest = b.versions[b.versions.length - 1]

  const submit = async () => {
    if (!b.sessionId || !b.id || !pkg) return
    setBusy(true)
    try {
      const r = await api.fdeCreate({ session_id: b.sessionId, build_id: b.id, package: pkg.id, notes: notes.trim(), contact: contact.trim() })
      setDone(r)
      setMine((m) => [r, ...m])
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[125] bg-paper/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} className="panel rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto scroll-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 px-6 pt-6">
          <span className="w-11 h-11 rounded-2xl bg-accent-soft text-accent flex items-center justify-center shrink-0"><HardHat size={22} /></span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.3em] text-accent">{T('Developer a pedido', 'Developer on demand')}</div>
            <h3 className="text-3xl mt-0.5">{T('Un ingeniero nuestro lo sube por vos', 'One of our engineers ships it for you')}</h3>
            <p className="mt-1 text-[13px] text-ink-2">{T('Precio fijo, plazo fijo, alcance cerrado. Recibe tu proyecto con todo el contexto: ', 'Fixed price, fixed deadline, closed scope. They get your project with full context: ')}{latest ? `${latest.tag}${latest.readiness != null ? ` (${latest.readiness}% ${T('listo', 'ready')})` : ''}, ` : ''}{T('los bloqueantes del consejo y los servicios que faltan. Trabaja sobre tu repo y te entrega un acta.', 'the council blockers and the missing services. They work on your repo and hand you a delivery report.')}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-ink-3 hover:text-ink"><X size={18} /></button>
        </div>

        {done ? (
          <div className="px-6 py-6">
            <div className="rounded-2xl border-2 border-ok bg-ok/10 px-5 py-4">
              <div className="flex items-center gap-2 font-semibold text-lg"><CheckCircle2 className="text-ok" size={20} /> {T('Pedido', 'Request')} {done.id} {T('recibido', 'received')} · {packages.find((p) => p.id === done.package)?.name}</div>
              <p className="mt-1 text-[13.5px] text-ink-2">{T('Armamos el ticket con el estado real del proyecto.', 'We built the ticket with the real state of the project.')} {done.checkout_url ? T('Pagá para reservar el turno y te contactamos en el día.', 'Pay to reserve the slot and we will contact you the same day.') : T('Te contactamos a tu email para coordinar el pago y el inicio.', 'We will email you to arrange payment and the start.')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {done.checkout_url && <a href={done.checkout_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-accent text-white px-4 py-2 text-sm font-semibold hover:brightness-110"><CreditCard size={15} /> {T('Pagar y reservar', 'Pay and reserve')}</a>}
                {bookingUrl && <a href={bookingUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl border border-line bg-paper px-4 py-2 text-sm hover:bg-surface-2"><Calendar size={15} /> {T('Elegir horario', 'Pick a time')}</a>}
                <button onClick={() => downloadTicket(done)} className="flex items-center gap-1.5 rounded-xl border border-line bg-paper px-4 py-2 text-sm hover:bg-surface-2"><Download size={15} /> {T('Ver el ticket que recibe el developer (.md)', 'See the ticket the developer receives (.md)')}</button>
              </div>
            </div>
            <TicketPreview r={done} />
          </div>
        ) : (
          <>
            <div className="px-6 pt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {packages.map((p) => (
                <button key={p.id} onClick={() => setSelected(p.id)} className={`rounded-2xl border-2 p-3.5 text-left transition ${selected === p.id ? 'border-accent bg-accent-soft/60' : 'border-line bg-paper hover:bg-surface-2'}`}>
                  <div className="flex items-start gap-2">
                    <div className="font-semibold text-[14px] leading-tight">{p.name}</div>
                    {p.badge && <span className="ml-auto shrink-0 rounded-full bg-gold/15 text-gold px-1.5 py-0.5 text-[9px] font-bold uppercase">{p.badge}</span>}
                  </div>
                  <div className="mt-1.5 font-mono text-2xl">USD {p.price_usd}<span className="text-[11px] text-ink-3">{p.id === 'hours' ? ' /h' : ''}</span></div>
                  <div className="text-[11px] text-ink-3">{p.eta}</div>
                  <div className="mt-2 text-[12px] text-ink-2 leading-snug">{p.tagline}</div>
                </button>
              ))}
            </div>
            {pkg && (
              <div className="px-6 pt-4 grid gap-4 md:grid-cols-[1.1fr_1fr]">
                <div className="rounded-2xl border border-line bg-paper p-4 text-[12.5px]">
                  <div className="text-[10px] uppercase tracking-widest text-ink-3 mb-1.5">{T('Incluye', 'Includes')}</div>
                  <ul className="space-y-1">{pkg.includes.map((x) => <li key={x} className="flex gap-1.5"><CheckCircle2 size={13} className="text-ok shrink-0 mt-0.5" /> {x}</li>)}</ul>
                  {pkg.excludes.length > 0 && <><div className="text-[10px] uppercase tracking-widest text-ink-3 mt-3 mb-1.5">{T('No incluye', 'Does not include')}</div><ul className="space-y-1 text-ink-3">{pkg.excludes.map((x) => <li key={x}>· {x}</li>)}</ul></>}
                  <div className="text-[10px] uppercase tracking-widest text-ink-3 mt-3 mb-1.5">{T('Vas a tener que dar', 'You will need to provide')}</div>
                  <ul className="space-y-1 text-ink-2">{pkg.needs.map((x) => <li key={x}>· {x}</li>)}</ul>
                  <div className="mt-3 text-[11px] text-ink-4">{T('El developer nunca recibe contraseñas: lo invitás como colaborador y le quitás el acceso al terminar.', 'The developer never receives passwords: you invite them as a collaborator and revoke access when done.')}</div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-ink-3">{T('Qué necesitás (se suma al ticket automático)', 'What you need (added to the automatic ticket)')}</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={7} placeholder={T('Ej.: subirla a producción con mi dominio sismos.com.ar, conectar los datos reales de INPRES y dejar el batch diario corriendo.', 'E.g.: ship it to production on my domain sismos.com.ar, connect the real INPRES data and leave the daily batch running.')} className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent" />
                  <label className="mt-2 block text-[10px] uppercase tracking-widest text-ink-3">{T('Contacto (email o WhatsApp)', 'Contact (email or WhatsApp)')}</label>
                  <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={T('si lo dejás vacío usamos el email de tu cuenta', 'if left empty we use your account email')} className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent" />
                  <button disabled={busy || !b.id} onClick={submit} className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-accent text-white py-2.5 font-semibold hover:brightness-110 disabled:opacity-40">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <HardHat size={16} />} {T('Pedir', 'Request')} «{pkg.name}» · USD {pkg.price_usd}{pkg.id === 'hours' ? '/h' : ''}
                  </button>
                  <div className="mt-1.5 text-[11px] text-ink-4 text-center">{T('Sin cargo hasta confirmar alcance y turno. Garantía: si no queda en producción, no se cobra.', 'No charge until scope and slot are confirmed. Guarantee: if it does not end up in production, you do not pay.')}</div>
                </div>
              </div>
            )}
            {mine.length > 0 && (
              <div className="px-6 pt-5">
                <div className="text-[10px] uppercase tracking-widest text-ink-3 mb-1.5">{T('Tus pedidos para este proyecto', 'Your requests for this project')}</div>
                <div className="space-y-1.5">
                  {mine.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px]">
                      <span className="font-mono text-ink-3">{r.id}</span>
                      <span className="font-medium">{packages.find((p) => p.id === r.package)?.name ?? r.package}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${r.status === 'delivered' || r.status === 'closed' ? 'bg-ok/15 text-ok' : r.status === 'cancelled' ? 'bg-surface-2 text-ink-3' : 'bg-gold/15 text-gold'}`}>{status[r.status] ?? r.status}</span>
                      <span className="ml-auto text-ink-3">{new Date(r.created * 1000).toLocaleDateString()}</span>
                      <button onClick={() => downloadTicket(r)} className="text-accent hover:underline">{T('ticket', 'ticket')}</button>
                      {r.status === 'new' && <button onClick={async () => { await api.fdeUpdate(r.id, { status: 'cancelled' }).catch(() => {}); setMine((m) => m.map((x) => (x.id === r.id ? { ...x, status: 'cancelled' } : x))) }} className="text-ink-3 hover:text-danger">{T('cancelar', 'cancel')}</button>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div className="px-6 py-5 text-center"><button className="text-sm text-ink-3 hover:text-ink" onClick={onClose}>{T('cerrar', 'close')}</button></div>
      </motion.div>
    </motion.div>
  )
}

function TicketPreview({ r }: { r: FdeRequest }) {
  const T = useT()
  const t = r.ticket
  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper p-4 text-[12.5px]">
      <div className="text-[10px] uppercase tracking-widest text-ink-3 mb-2">{T('Lo que recibe el developer', 'What the developer receives')}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><div className="font-semibold">{T('Proyecto', 'Project')}</div><div className="text-ink-2">{t.project.title} · {t.project.version ?? T('sin versión', 'no version')} · {t.project.files} {T('archivos', 'files')}{t.project.readiness != null ? ` · ${t.project.readiness}% ${T('listo', 'ready')}` : ''}</div></div>
        <div><div className="font-semibold">Stack</div><div className="text-ink-2">{t.stack.length ? t.stack.map((s) => s.label).join(', ') : '—'}</div></div>
        <div><div className="font-semibold">{T('Bloqueantes abiertos', 'Open blockers')}</div><ul className="text-ink-2 list-disc pl-4">{t.blockers.length ? t.blockers.slice(0, 6).map((b, i) => <li key={i}>{b.text}</li>) : <li>{T('ninguno registrado', 'none recorded')}</li>}</ul></div>
        <div><div className="font-semibold">{T('Servicios', 'Services')}</div><ul className="text-ink-2">{t.services.length ? t.services.map((s) => <li key={s.service}>{s.configured ? '✅' : '⬜'} {s.service}</li>) : <li>{T('no requiere', 'none required')}</li>}</ul>{t.missing_vars.length > 0 && <div className="mt-1 text-gold">{T('faltan', 'missing')}: {t.missing_vars.join(', ')}</div>}</div>
      </div>
    </div>
  )
}
