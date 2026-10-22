import { Play } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '../lib/i18n'
import AgentAvatar from './AgentAvatar'

/**
 * The two doors of the home, each with its own pipeline animated behind the text ("the circuit"):
 *  direct: a prompt being typed → prompt engineering → the builder writing files
 *  team:   the prompt → the team debating (avatars taking turns) → the brief → the builder
 * Pure CSS animations (keyframes in index.css), looping; low contrast so the copy stays readable.
 */
type Lane = 'direct' | 'team'

function Node({ label, children, className = '', delay = 0 }: { label: string; children?: ReactNode; className?: string; delay?: number }) {
  return (
    <div className={`lane-node ${className}`} style={{ animationDelay: `${delay}s` }}>
      <div className="lane-node-label">{label}</div>
      {children}
    </div>
  )
}

function Wire({ delay = 0 }: { delay?: number }) {
  return (
    <div className="lane-wire">
      <span className="lane-dot" style={{ animationDelay: `${delay}s` }} />
    </div>
  )
}

const TEAM = [
  { name: 'CEO', role: 'ceo', provider: 'anthropic' },
  { name: 'CTO', role: 'cto', provider: 'openai' },
  { name: 'Diseño', role: 'product-designer', provider: 'gemini' },
  { name: 'QA', role: 'qa', provider: 'anthropic' },
]

function Scene({ lane }: { lane: Lane }) {
  const T = useT()
  const team = lane === 'team'
  // one loop: type (0-2.4s) → wire → engineering/team → wire → (brief) → wire → build files
  const t = team ? { eng: 2.6, team: 4.2, brief: 7.4, build: 8.6, loop: 12 } : { eng: 2.6, team: 0, brief: 0, build: 4.4, loop: 8 }
  return (
    <div className={`lane-scene ${team ? 'lane-scene--team' : ''}`} style={{ ['--lane-loop' as string]: `${t.loop}s` }} aria-hidden>
      <Node label={T('Tu pedido', 'Your request')} className="lane-node--prompt">
        <div className="lane-type">{T('Una app para reservar turnos en mi peluquería, con recordatorios…', 'An app to book appointments at my salon, with reminders…')}</div>
      </Node>
      <Wire delay={2.2} />
      <Node label="Prompt engineering" className="lane-node--eng" delay={t.eng}>
        <div className="lane-bars">{[70, 100, 55, 85].map((w, i) => <span key={w} style={{ width: `${w}%`, animationDelay: `${t.eng + 0.3 + i * 0.25}s` }} />)}</div>
      </Node>
      {team && (
        <>
          <Wire delay={t.team - 0.5} />
          <Node label={T('Equipo', 'Team')} className="lane-node--team" delay={t.team}>
            <div className="lane-team">
              {TEAM.map((a, i) => (
                <span key={a.name} className="lane-avatar" style={{ animationDelay: `${t.team + 0.3 + i * 0.6}s` }}>
                  <AgentAvatar agent={a} size={26} ring={false} />
                </span>
              ))}
            </div>
          </Node>
          <Wire delay={t.brief - 0.5} />
          <Node label="Brief" className="lane-node--brief" delay={t.brief}>
            <div className="lane-lines">{[85, 60, 72].map((w, i) => <span key={w} style={{ width: `${w}%`, animationDelay: `${t.brief + 0.3 + i * 0.25}s` }} />)}</div>
          </Node>
        </>
      )}
      <Wire delay={t.build - 0.5} />
      <Node label={T('Construcción', 'Build')} className="lane-node--build" delay={t.build}>
        <div className="lane-files">
          {['src/App.tsx', 'api/routes.ts', 'db/schema.sql'].map((f, i) => (
            <span key={f} style={{ animationDelay: `${t.build + 0.4 + i * 0.35}s` }}>{f}</span>
          ))}
        </div>
      </Node>
    </div>
  )
}

export default function LaneCards({ onPick }: { onPick: (lane: Lane) => void }) {
  const T = useT()
  const cards: { id: Lane; tag: string; title: string; text: string }[] = [
    { id: 'direct', tag: T('Un prompt → una app', 'One prompt → one app'), title: T('Constructor directo', 'Direct builder'), text: T('Contás qué querés, el prompt engineering lo convierte en un brief completo y el constructor arranca ya. Lo más rápido y lo más barato. El equipo queda a un clic para revisar después.', 'Say what you want, prompt engineering turns it into a full brief and the builder starts right away. Fastest and cheapest. The team is one click away to review afterwards.') },
    { id: 'team', tag: T('Debate → brief → construcción', 'Debate → brief → build'), title: T('Constructor con equipo de desarrollo', 'Builder with a development team'), text: T('CEO, CTO, Producto, Diseño y QA debaten tu idea en vivo, deciden producto, alcance y stack, y recién ahí construyen. Para cuando querés decisiones justificadas y revisión por roles.', 'CEO, CTO, Product, Design and QA debate your idea live, decide product, scope and stack, and only then build. For when you want justified decisions and role-by-role review.') },
  ]
  return (
    <div className="mt-10 grid gap-5 md:grid-cols-2">
      {cards.map((c) => (
        <button key={c.id} type="button" onClick={() => onPick(c.id)} className="group panel relative isolate flex min-h-[340px] flex-col items-start overflow-hidden rounded-3xl p-7 pb-[150px] text-left transition hover:border-accent">
          <Scene lane={c.id} />
          <div className="relative z-10 flex flex-col items-start gap-3">
            <span className="rounded-full border border-line bg-surface/90 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.2em] text-ink-3">{c.tag}</span>
            <span className="text-[26px] leading-tight">{c.title}</span>
            <span className="max-w-[560px] text-[14px] leading-relaxed text-ink-2">{c.text}</span>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition group-hover:brightness-110">{T('Elegir', 'Choose')} <Play size={13} /></span>
          </div>
        </button>
      ))}
    </div>
  )
}
