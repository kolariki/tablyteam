import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import LogoMarquee from './LogoMarquee'
import TeamBackdrop from './TeamBackdrop'
import ProviderLogo from './ProviderLogo'

/* ------------------------------------------------------------------ the looping demo
 * One clock (ms since loop start) drives four scenes. Everything is derived from `t`,
 * so the animation is deterministic and loops cleanly.
 */
/* ------------------------------------------------------------------ demo data: a weather app, from the idea to the built product */
const IDEA = 'Una app del clima para Argentina que me diga si llevo paraguas, con alertas oficiales y pronóstico por horas.'
const IDEA_EN = 'A weather app for Argentina that tells me whether to take an umbrella, with official alerts and an hourly forecast.'
const QUESTIONS: [string, string][] = [
  ['¿Solo web (PWA) o también apps nativas?', 'Web only (PWA) or native apps too?'],
  ['¿Qué fuente de alertas oficiales usamos?', 'Which official alert source do we use?'],
]
const BRIEF_LINES: [string, string][] = [
  ['# App de Clima · ¿llevo paraguas?', '# Weather app · umbrella or not?'],
  ['## Objetivo: responder en 3 s si llueve hoy', '## Goal: answer in 3 s whether it rains today'],
  ['## MVP: ciudad, hoy por horas, 7 días, alertas', '## MVP: city, hourly today, 7 days, alerts'],
  ['## Fuera: radar, cuentas, widgets', '## Out: radar, accounts, widgets'],
  ['## Criterios de aceptación: 12 historias', '## Acceptance criteria: 12 stories'],
]
type Member = { id: string; name: string; name_en: string; role: string; role_en: string; provider: string; model: string; color: string; persona: string; persona_en: string }
const TEAM: Member[] = [
  { id: 'ceo', name: 'CEO', name_en: 'CEO', role: 'Dirección', role_en: 'Leadership', provider: 'anthropic', model: 'claude-opus-5-5', color: '#C0603F', persona: 'visionario pero concreto', persona_en: 'visionary but concrete' },
  { id: 'cto', name: 'CTO', name_en: 'CTO', role: 'Dirección', role_en: 'Leadership', provider: 'openai', model: 'gpt-5.6', color: '#17896A', persona: 'escéptico del hype', persona_en: 'hype sceptic' },
  { id: 'eng', name: 'Head of Eng', name_en: 'Head of Eng', role: 'Ingeniería', role_en: 'Engineering', provider: 'gemini', model: 'gemini-3.8-pro', color: '#3D5CC4', persona: 'veinte años de cicatrices', persona_en: 'twenty years of scars' },
  { id: 'product', name: 'Product', name_en: 'Product', role: 'Producto', role_en: 'Product', provider: 'deepseek', model: 'deepseek-v4', color: '#AD7D1A', persona: 'historias claras, prioriza', persona_en: 'clear stories, prioritises' },
  { id: 'design', name: 'Diseño', name_en: 'Design', role: 'Diseño', role_en: 'Design', provider: 'anthropic', model: 'claude-opus-5-5', color: '#9A57B8', persona: 'flujos simples, pantallas precisas', persona_en: 'simple flows, precise screens' },
  { id: 'qa', name: 'QA', name_en: 'QA', role: 'Calidad', role_en: 'Quality', provider: 'openai', model: 'gpt-5.6', color: '#6E8226', persona: 'busca cómo se rompe todo', persona_en: 'finds how everything breaks' },
]
const ARENA = TEAM.slice(0, 4)
const MEMBER = Object.fromEntries(TEAM.map((m) => [m.id, m])) as Record<string, Member>
const REFS = ['apple.com/weather', 'windy.com', 'accuweather.com']
const TURNS = [
  { from: 'ceo', to: 'cto', text: 'Una sola pregunta: ¿llevo paraguas? CTO, ¿qué fuente nos sirve sin cuentas?', text_en: 'One question: umbrella or not? CTO, which source works without accounts?', stance: '💡 propone', stance_en: '💡 proposes', reason: 'que elija el stack', reason_en: 'let him pick the stack' },
  { from: 'cto', to: 'eng', text: 'Open-Meteo, gratis y sin key. PWA, nada nativo en el MVP.', text_en: 'Open-Meteo, free and keyless. PWA, nothing native in the MVP.', stance: '🤝 acuerdo', stance_en: '🤝 agrees', reason: 'que baje la arquitectura', reason_en: 'let him lay out the architecture' },
  { from: 'eng', to: 'product', text: 'Vite + TypeScript, caché offline de 2 h. Product, ¿qué entra en v1?', text_en: 'Vite + TypeScript, 2 h offline cache. Product, what makes v1?', stance: '💡 propone', stance_en: '💡 proposes', reason: 'que cierre el alcance', reason_en: 'let her close the scope' },
  { from: 'product', to: 'ceo', text: 'Ciudad, hoy por horas, 7 días y alertas. Radar y widgets, etapa 2.', text_en: 'City, hourly today, 7 days and alerts. Radar and widgets, phase 2.', stance: '⚔️ discrepa', stance_en: '⚔️ disagrees', reason: 'que confirme el nombre', reason_en: 'let him confirm the name' },
]
const BUILD_STEPS: { key: string; label: string; label_en: string; detail: string; detail_en: string }[] = [
  { key: 'research', label: 'Benchmark de referentes', label_en: 'Reference benchmark', detail: '3 apps visitadas · capturas · qué emular y qué evitar', detail_en: '3 apps visited · screenshots · what to emulate and avoid' },
  { key: 'deep', label: 'Ingeniería inversa (REA)', label_en: 'Reverse engineering (REA)', detail: 'bundles, rutas y API de los referentes', detail_en: 'the references’ bundles, routes and API' },
  { key: 'design', label: 'Diseño UX/UI', label_en: 'UX/UI design', detail: 'sistema · 3 pantallas · mockup aprobado por vos', detail_en: 'system · 3 screens · mockup approved by you' },
  { key: 'build', label: 'Construcción · Claude Code', label_en: 'Build · Claude Code', detail: 'app/page.tsx · lib/weather.ts · Umbrella.tsx…', detail_en: 'app/page.tsx · lib/weather.ts · Umbrella.tsx…' },
  { key: 'polish', label: 'Pulido visual', label_en: 'Visual polish', detail: 'la UI iguala el mockup', detail_en: 'the UI matches the mockup' },
  { key: 'review', label: 'Revisión del consejo', label_en: 'Council review', detail: 'v1 · 100 % listo para producción', detail_en: 'v1 · 100 % production-ready' },
]
const SCENES = [
  { key: 'idea', label: 'Contás tu idea', label_en: 'You tell your idea', desc: 'Escribís qué querés construir con tus palabras y adjuntás documentos, una carpeta o un proyecto existente.', desc_en: 'You write what you want to build in your own words and attach documents, a folder or an existing project.', dur: 7200 },
  { key: 'prompt', label: 'Prompt engineering', label_en: 'Prompt engineering', desc: 'Una IA lee lo que adjuntaste, te hace las preguntas que faltan y convierte tu texto en un brief completo para el equipo.', desc_en: 'An AI reads what you attached, asks the missing questions and turns your text into a complete brief for the team.', dur: 8800 },
  { key: 'team', label: 'Elegís el equipo y las IAs', label_en: 'You pick the team and the AIs', desc: 'Un rol por tarjeta: CEO, CTO, ingeniería, producto, diseño y QA, cada uno con la IA, el prompt y las skills que quieras.', desc_en: 'One role per card: CEO, CTO, engineering, product, design and QA, each with the AI, prompt and skills you want.', dur: 7000 },
  { key: 'refs', label: 'Referentes e ingeniería inversa', label_en: 'References and reverse engineering', desc: 'Cargás apps parecidas para que el equipo las estudie y, si querés, activás la ingeniería inversa para entender cómo están hechas.', desc_en: 'You add similar apps for the team to study and, if you want, turn on reverse engineering to understand how they are built.', dur: 7600 },
  { key: 'arena', label: 'El equipo debate', label_en: 'The team debates', desc: 'Los roles discuten en vivo producto, stack y alcance, se pasan la palabra y cierran decisiones con un responsable por cada paso.', desc_en: 'The roles debate product, stack and scope live, hand the floor to each other and close decisions with an owner for every step.', dur: TURNS.length * 2600 + 600 },
  { key: 'build', label: 'Diseñan, construyen y revisan', label_en: 'They design, build and review', desc: 'Benchmark de referentes, diseño que aprobás, código con Claude Code, pulido visual y revisión del consejo hasta que la app está lista.', desc_en: 'Reference benchmark, a design you approve, code with Claude Code, visual polish and council review until the app is ready.', dur: 12600 },
  { key: 'audit', label: 'Auditan un proyecto que ya tenés', label_en: 'They audit a project you already have', desc: 'Subís un proyecto existente, elegís qué roles lo revisan y el equipo lo audita desde cada área: hallazgos con archivo y línea, qué está listo y qué falta para producción.', desc_en: 'You upload an existing project, pick which roles review it and the team audits it from every area: findings with file and line, what is ready and what is missing for production.', dur: 11000 },
] as const
const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0)

const SCENE_START = SCENES.map((_, i) => SCENES.slice(0, i).reduce((a, s) => a + s.dur, 0))

/** The demo clock loops through the scenes; ‹ › jump to the previous / next scene (the loop keeps playing from there). */
function useClock() {
  const [t, setT] = useState(0)
  const start = useRef(performance.now())
  useEffect(() => {
    const id = window.setInterval(() => setT((performance.now() - start.current) % TOTAL), 40)
    return () => window.clearInterval(id)
  }, [])
  let scene = 0
  for (let i = 0; i < SCENES.length; i++) if (t >= SCENE_START[i]) scene = i
  const jump = (i: number) => {
    const target = ((i % SCENES.length) + SCENES.length) % SCENES.length
    start.current = performance.now() - SCENE_START[target]
    setT(SCENE_START[target])
  }
  return { scene, local: t - SCENE_START[scene], key: SCENES[scene].key, jump }
}

const ease = (x: number) => Math.min(1, Math.max(0, x))

export default function Landing({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const T = useT()
  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden scroll-thin arena-bg">
      {/* the team building, blurred, behind everything */}
      <TeamBackdrop fixed blur={8} opacity={0.45} />
      {/* everything else sits above the backdrop (positioned, so the fixed scene never paints over cards or buttons) */}
      <div className="relative z-10">
      {/* header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-6 h-14 border-b border-line bg-paper/80 backdrop-blur">
        <img src="/icon.svg" alt="" aria-hidden className="h-7 w-7 rounded-lg shadow-sm" draggable={false} />
        <span className="serif text-lg">Agent <em className="text-accent">Arena</em></span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onLogin} className="rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:text-ink">{T('Iniciar sesión', 'Sign in')}</button>
          <button onClick={onSignup} className="rounded-lg bg-accent text-white px-3.5 py-1.5 text-sm font-medium hover:brightness-110">{T('Crear cuenta', 'Create account')}</button>
        </div>
      </header>

      {/* hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10 grid lg:grid-cols-[1fr_1.15fr] gap-12 items-center">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs uppercase tracking-[0.5em] text-accent">{T('tu equipo que diseña y construye', 'your team that designs and builds')}</div>
          <h1 className="mt-3 text-6xl md:text-7xl leading-[0.95] tracking-tight">
            {T('Escribí tu idea.', 'Write your idea.')} <em className="text-accent">{T('El equipo', 'The team')}</em> {T('la construye.', 'builds it.')}
          </h1>
          <p className="mt-5 text-lg text-ink-2 leading-relaxed max-w-lg">
            {T('Describís la app que querés y elegís qué IA ocupa cada rol: CEO, CTO, ingeniería, producto, diseño y QA. El equipo debate tu idea, estudia apps de referencia, diseña las pantallas, escribe el código y lo revisa antes de entregarte un producto listo para correr. Vos aprobás cada paso.', 'Describe the app you want and choose which AI takes each role: CEO, CTO, engineering, product, design and QA. The team debates your idea, studies reference apps, designs the screens, writes the code and reviews it before handing you a product ready to run. You approve every step.')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={onSignup} className="flex items-center gap-2 rounded-2xl bg-accent text-white px-6 py-3.5 font-semibold text-lg hover:brightness-110 transition">
              {T('Empezar gratis', 'Start for free')} <ArrowRight size={18} />
            </button>
            <a href="#demo" className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-6 py-3.5 font-medium text-lg text-ink-2 hover:text-ink transition">
              <Play size={16} /> {T('Ver cómo funciona', 'See how it works')}
            </a>
          </div>
          <div className="mt-8 flex items-center gap-2">
            {['anthropic', 'openai', 'deepseek', 'gemini', 'kimi', 'xai', 'mistral'].map((id, i) => (
              <motion.span key={id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }} className="w-10 h-10 rounded-full bg-surface border border-line flex items-center justify-center">
                <ProviderLogo provider={id} size={22} />
              </motion.span>
            ))}
            <span className="ml-1 text-sm text-ink-3">+ Groq, OpenRouter, Ollama</span>
          </div>
        </motion.div>

        <motion.div id="demo" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
          <DemoBlock />
        </motion.div>
      </section>

      {/* features */}
      <section className="max-w-6xl mx-auto px-6 pb-20 grid md:grid-cols-3 gap-5">
        {[
          { title: T('Un equipo completo', 'A full team'), text: T('CEO, CTO, Head of Engineering, Product, Diseño y QA, cada uno con una IA distinta, con su rol, su prompt y sus skills. Debaten tu idea, se contradicen, votan y cierran decisiones con un responsable por cada paso.', 'CEO, CTO, Head of Engineering, Product, Design and QA, each on a different AI, with their role, prompt and skills. They debate your idea, push back on each other, vote and close decisions with an owner for every step.') },
          { title: T('Diseñan y construyen', 'They design and build'), text: T('El equipo estudia apps de referencia, el diseñador entrega sistema, pantallas y mockup, y recién cuando lo aprobás el constructor escribe el código con Claude Code o Codex, al nivel de un producto profesional.', 'The team studies reference apps, the designer delivers system, screens and mockup, and only once you approve it does the builder write the code with Claude Code or Codex, at the level of a professional product.') },
          { title: T('Vos decidís, ellos iteran', 'You decide, they iterate'), text: T('Pedís cambios en el diseño o en el código, el consejo revisa cada versión antes de producción y vuelve a debatir si hace falta. Todo con costo, tokens y confianza por agente, y tus API keys cifradas y solo tuyas.', 'You ask for changes in the design or the code, the council reviews every version before production and debates again if needed. All with cost, tokens and confidence per agent, and your API keys encrypted and yours alone.') },
        ].map((f) => (
          <div key={f.title} className="panel rounded-2xl p-6">
            <h3 className="text-2xl">{f.title}</h3>
            <p className="mt-2 text-[14.5px] text-ink-2 leading-relaxed">{f.text}</p>
          </div>
        ))}
      </section>

      <LogoMarquee />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ demo stage */

function DemoBlock() {
  const clock = useClock()
  return <Demo clock={clock} />
}

function Demo({ clock }: { clock: ReturnType<typeof useClock> }) {
  const T = useT()
  const s = SCENES[clock.scene]
  const btn = 'flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition hover:border-accent hover:text-accent'
  return (
    <div className="panel overflow-hidden rounded-3xl shadow-xl">
      <div className="flex items-center gap-2 px-4 h-10 border-b border-line bg-surface-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#E6A19A]" /><span className="w-2.5 h-2.5 rounded-full bg-[#E9C97A]" /><span className="w-2.5 h-2.5 rounded-full bg-[#9FCDA8]" />
        <span className="ml-3 text-[11px] font-mono text-ink-3">agent-arena · {T('app del clima', 'weather app')}</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-danger"><span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" /> {T('EN VIVO', 'LIVE')}</span>
      </div>
      {/* what is happening on screen, with ‹ › to go back or skip ahead */}
      <div className="flex items-center gap-3 border-b border-line bg-accent-soft px-4 py-2.5">
        <button type="button" onClick={() => clock.jump(clock.scene - 1)} className={btn} aria-label={T('Paso anterior', 'Previous step')}><ChevronLeft size={15} /></button>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">{clock.scene + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13.5px] font-semibold text-ink">{T(s.label, s.label_en)}</span>
            <span className="font-mono text-[10.5px] text-ink-3">{clock.scene + 1}/{SCENES.length}</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={s.key} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[12.5px] leading-snug text-ink-2">{T(s.desc, s.desc_en)}</motion.div>
          </AnimatePresence>
          <div className="mt-1.5 flex gap-1">
            {SCENES.map((x, i) => (
              <button key={x.key} type="button" onClick={() => clock.jump(i)} className="h-1 flex-1 overflow-hidden rounded-full bg-black/10" aria-label={T(x.label, x.label_en)}>
                <div className="h-full bg-accent transition-[width]" style={{ width: clock.scene === i ? `${(clock.local / x.dur) * 100}%` : clock.scene > i ? '100%' : '0%' }} />
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => clock.jump(clock.scene + 1)} className={btn} aria-label={T('Paso siguiente', 'Next step')}><ChevronRight size={15} /></button>
      </div>
      <div className="relative h-[400px] bg-surface">
        <AnimatePresence mode="wait">
          {clock.key === 'idea' && <SceneIdea key="idea" t={clock.local} />}
          {clock.key === 'prompt' && <ScenePrompt key="prompt" t={clock.local} />}
          {clock.key === 'team' && <SceneTeam key="team" t={clock.local} />}
          {clock.key === 'refs' && <SceneRefs key="refs" t={clock.local} />}
          {clock.key === 'arena' && <SceneArena key="arena" t={clock.local} />}
          {clock.key === 'build' && <SceneBuild key="build" t={clock.local} />}
          {clock.key === 'audit' && <SceneAudit key="audit" t={clock.local} />}
        </AnimatePresence>
      </div>
    </div>
  )
}

const sceneProps = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24, transition: { duration: 0.25 } },
  className: 'absolute inset-0 p-6',
}

function Cursor({ x, y, click }: { x: number; y: number; click?: boolean }) {
  return (
    <motion.div className="absolute z-20 pointer-events-none" animate={{ left: x, top: y, scale: click ? 0.85 : 1 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>
      <svg width="20" height="22" viewBox="0 0 20 22"><path d="M2 1l15 9-7 1.5L13 19l-3 1-3-7.5L2 17z" fill="#1E2622" stroke="#fff" strokeWidth="1.5" /></svg>
    </motion.div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-widest text-ink-3">{children}</div>
}

function Check({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] transition-colors ${on ? 'border-accent bg-accent text-white' : 'border-line bg-surface'}`}>{on ? '✓' : ''}</span>
      <span>{children}</span>
    </div>
  )
}

/* 1 · the user types the idea and attaches a document */
function SceneIdea({ t: raw }: { t: number }) {
  const t = raw * 0.78
  const T = useT()
  const idea = T(IDEA, IDEA_EN)
  const typed = Math.floor(ease((t - 400) / 3000) * idea.length)
  const attach = t > 3900
  const clickAttach = t > 3600 && t < 3900
  return (
    <motion.div {...sceneProps}>
      <Label>{T('Nombre de la app', 'App name')}</Label>
      <div className="mt-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[14px]">{t > 200 ? T('Paraguas', 'Umbrella') : ''}</div>
      <div className="mt-4"><Label>{T('Qué querés construir', 'What you want to build')}</Label></div>
      <div className="mt-1.5 min-h-[88px] rounded-xl border border-accent bg-surface px-4 py-3 text-[15px] leading-snug">
        {idea.slice(0, typed)}{t > 400 && typed < idea.length && <span className="caret" />}
      </div>
      <div className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-3">
        <span>{T('Adjuntá lo que ayude:', 'Attach what helps:')}</span>
        {[T('documentos', 'documents'), T('carpeta', 'folder'), T('proyecto local', 'local project')].map((c, i) => (
          <span key={c} className={`rounded-lg border px-2.5 py-1 transition-colors ${i === 0 && attach ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface-2'}`}>{c}</span>
        ))}
        <AnimatePresence>{attach && <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="rounded-lg bg-accent-soft px-2.5 py-1 text-accent">📎 brief-clima.pdf ✓</motion.span>}</AnimatePresence>
      </div>
      <Cursor x={t < 3400 ? 330 : 150} y={t < 3400 ? 140 : 262} click={clickAttach} />
    </motion.div>
  )
}

/* 2 · "Generar prompt engineering": reads the files, asks two questions, replaces the text with a real brief */
function ScenePrompt({ t: raw }: { t: number }) {
  const t = raw * 0.78
  const T = useT()
  const pressed = t > 300 && t < 700
  const reading = t > 700
  const thinking = t > 1500
  const asked = t > 2300
  const a1 = t > 3100
  const a2 = t > 3700
  const generated = t > 4500
  const lines = BRIEF_LINES.filter((_, i) => t > 4700 + i * 380)
  return (
    <motion.div {...sceneProps}>
      <div className="flex items-center gap-3">
        <motion.div animate={{ scale: pressed ? 0.95 : 1 }} className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-semibold text-white shadow-md" style={{ background: '#C0603F' }}>
          <ProviderLogo provider="anthropic" size={16} /> {T('Generar prompt engineering a mi texto', 'Prompt-engineer my text')}
        </motion.div>
        <span className="text-[12px] text-ink-3">{T('con', 'with')} Claude · claude-opus-5-5</span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_1.1fr] gap-4">
        <div className="space-y-2 text-[12.5px]">
          {reading && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-ink-2"><span className="text-accent">📄</span> {T('Leyendo brief-clima.pdf', 'Reading brief-clima.pdf')} <span className="text-ink-4">· 14 {T('páginas', 'pages')}</span></motion.div>}
          {thinking && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-ink-2"><span className="text-accent">💭</span> {T('Pensando qué falta para construir…', 'Thinking what is missing to build…')}</motion.div>}
          {asked && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line bg-surface-2 p-3">
              <Label>{T('Dos preguntas antes de seguir', 'Two questions before going on')}</Label>
              <div className="mt-2 space-y-1.5">
                <Check on={a1}><b>{T(QUESTIONS[0][0], QUESTIONS[0][1])}</b> <span className="text-ink-3">{a1 ? T('→ solo PWA', '→ PWA only') : ''}</span></Check>
                <Check on={a2}><b>{T(QUESTIONS[1][0], QUESTIONS[1][1])}</b> <span className="text-ink-3">{a2 ? T('→ SMN oficial', '→ official SMN') : ''}</span></Check>
              </div>
            </motion.div>
          )}
        </div>
        <div className={`rounded-xl border p-3 font-mono text-[11.5px] leading-relaxed transition-colors ${generated ? 'border-accent bg-surface' : 'border-dashed border-line bg-surface-2/60'}`}>
          {!generated && <span className="text-ink-4">{T('el prompt generado reemplaza tu texto…', 'the generated prompt replaces your text…')}</span>}
          {lines.map(([es, en], i) => <motion.div key={es} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} className={i === 0 ? 'font-bold text-ink' : 'text-ink-2'}>{T(es, en)}</motion.div>)}
          {generated && lines.length === BRIEF_LINES.length && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-[10.5px] text-accent">✓ {T('Brief generado · 1.240 palabras · reemplazó tu texto', 'Brief generated · 1,240 words · replaced your text')}</motion.div>}
        </div>
      </div>
      <Cursor x={t < 900 ? 120 : a2 ? 70 : 60} y={t < 900 ? 40 : a2 ? 232 : 205} click={pressed || (t > 2900 && t < 3100) || (t > 3500 && t < 3700)} />
    </motion.div>
  )
}

/* 3 · the team: one role per card, each on its own company and model */
function SceneTeam({ t: raw }: { t: number }) {
  const t = raw * 0.78
  const T = useT()
  const on = TEAM.filter((_, i) => t > 500 + i * 650)
  const i = Math.min(5, Math.floor((t - 200) / 650))
  const cx = 60 + (Math.max(0, i) % 3) * 165 + 40
  const cy = 80 + Math.floor(Math.max(0, i) / 3) * 112 + 24
  return (
    <motion.div {...sceneProps}>
      <Label>{T('Agentes (6/8) · cada rol con su IA, su prompt y sus skills', 'Agents (6/8) · each role with its AI, prompt and skills')}</Label>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {TEAM.map((m) => {
          const picked = on.includes(m)
          return (
            <motion.div key={m.id} animate={{ scale: picked ? [1, 1.05, 1] : 1 }} className={`rounded-xl border px-3 py-2.5 transition-colors ${picked ? 'bg-surface' : 'border-line bg-surface-2/50'}`} style={{ borderColor: picked ? m.color : undefined }}>
              <div className="flex items-center gap-2">
                <ProviderLogo provider={m.provider} size={20} />
                <span className="text-[13.5px] font-semibold" style={{ color: picked ? m.color : undefined }}>{T(m.name, m.name_en)}</span>
                <span className={`ml-auto h-4 w-4 rounded-full border text-[10px] flex items-center justify-center ${picked ? 'border-accent bg-accent text-white' : 'border-line'}`}>{picked ? '✓' : ''}</span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-ink-3">{m.model}</div>
              <div className="mt-1 truncate text-[11.5px] text-ink-2">{picked ? T(m.persona, m.persona_en) : '—'}</div>
              <div className="mt-1.5 flex gap-1 text-[9.5px]">
                {picked && [T('skills', 'skills'), T('prompt', 'prompt')].map((s) => <span key={s} className="rounded bg-accent-soft px-1.5 py-[1px] text-accent">{s} ✓</span>)}
              </div>
            </motion.div>
          )
        })}
      </div>
      <Cursor x={cx} y={cy} click={t % 650 > 250 && t % 650 < 400 && t < 4400} />
    </motion.div>
  )
}

/* 4 · reference apps to study, the research checkbox and the paid reverse-engineering toggle, then launch */
function SceneRefs({ t: raw }: { t: number }) {
  const t = raw * 0.78
  const T = useT()
  const chips = REFS.filter((_, i) => t > 500 + i * 650)
  const research = t > 2700
  const deep = t > 3600
  const launch = t > 4900
  return (
    <motion.div {...sceneProps}>
      <Label>{T('Apps de referencia', 'Reference apps')}</Label>
      <div className="mt-1.5 flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-accent bg-surface px-3 py-2">
        {chips.map((c) => <motion.span key={c} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12.5px] text-accent">{c} ×</motion.span>)}
        {chips.length < REFS.length && <span className="text-[13px] text-ink-4">{t > 300 ? <span className="caret" /> : T('ej. apple.com/weather, windy.com', 'e.g. apple.com/weather, windy.com')}</span>}
      </div>
      <div className="mt-4 space-y-2.5">
        <Check on={research}>{T('Investigar apps de referencia', 'Research reference apps')} <span className="text-ink-3">{T('(el equipo entra, saca capturas y anota qué emular y qué evitar)', '(the team visits them, takes screenshots and notes what to emulate and avoid)')}</span></Check>
        <Check on={deep}>{T('Análisis profundo e ingeniería inversa', 'Deep analysis and reverse engineering')} <span className="rounded-full border border-gold/50 bg-gold/10 px-2 py-[1px] text-[10.5px] font-semibold text-gold">{T('pago por uso', 'pay per use')} · USD 9,00</span></Check>
        <Check on={t > 1000}>{T('Diseño UX/UI primero', 'UX/UI design first')} <span className="text-ink-3">{T('(aprobás el mockup antes de que exista código)', '(you approve the mockup before any code exists)')}</span></Check>
      </div>
      <AnimatePresence>
        {research && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex gap-2">
            {REFS.map((r, i) => (
              <div key={r} className="w-[118px] overflow-hidden rounded-lg border border-line bg-surface-2">
                <div className="h-[44px]" style={{ background: ['linear-gradient(135deg,#BFD9F2,#E8F1FA)', 'linear-gradient(135deg,#1E3A5F,#4C7FB5)', 'linear-gradient(135deg,#F4D6A3,#F9ECD6)'][i] }} />
                <div className="truncate px-2 py-1 font-mono text-[9.5px] text-ink-3">{r} {deep ? '· REA ✓' : '· 📷'}</div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div animate={{ scale: launch ? 0.96 : 1 }} className="absolute right-6 bottom-6 flex items-center gap-2 rounded-2xl px-5 py-2.5 text-[14px] font-semibold text-white shadow-md" style={{ background: 'linear-gradient(90deg,#C0603F,#17896A,#3D5CC4,#AD7D1A)' }}>
        ▶ {T('Iniciar experimento', 'Start experiment')}
      </motion.div>
      <Cursor x={launch ? 430 : deep ? 40 : research ? 40 : 200} y={launch ? 345 : deep ? 160 : research ? 128 : 60} click={launch || (t > 2500 && t < 2700) || (t > 3400 && t < 3600)} />
    </motion.div>
  )
}

/* 5 · the team debates: CEO → CTO → Head of Eng → Product */
const R = 118
const CX = 280
const CY = 190
const pos = (i: number) => ({ x: CX + Math.cos(-Math.PI / 2 + (i * Math.PI) / 2) * R * 1.55, y: CY + Math.sin(-Math.PI / 2 + (i * Math.PI) / 2) * R })
const BUBBLE = (i: number, p: { x: number; y: number }) =>
  [{ left: p.x + 46, top: p.y - 26 }, { left: p.x - 210, top: p.y + 44 }, { left: p.x - 46 - 210, top: p.y - 44 }, { left: p.x - 30, top: p.y + 44 }][i]

function SceneArena({ t }: { t: number }) {
  const T = useT()
  const idx = Math.min(TURNS.length - 1, Math.floor(t / 2600))
  const turn = TURNS[idx]
  const turnText = T(turn.text, turn.text_en)
  const local = t - idx * 2600
  const handing = local > 1900
  const chars = Math.floor(ease((local - 250) / 1400) * turnText.length)
  const P = Object.fromEntries(ARENA.map((m, i) => [m.id, pos(i)]))
  const from = P[turn.from]
  const to = P[turn.to]
  const mf = MEMBER[turn.from]
  const mt = MEMBER[turn.to]
  return (
    <motion.div {...sceneProps} className="absolute inset-0">
      <div className="absolute left-5 top-4 text-[11px] uppercase tracking-widest text-ink-3">{T('Turno', 'Turn')} {idx + 1} {T('· el equipo decide producto, stack y alcance', '· the team decides product, stack and scope')}</div>
      <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[560px] h-full">
        <div className="absolute text-center w-[170px]" style={{ left: CX - 85, top: CY - 26 }}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-accent">{T('proyecto', 'project')}</div>
          <div className="serif text-[14px] leading-snug mt-1 text-ink-2">{T('Paraguas · app del clima', 'Umbrella · weather app')}</div>
        </div>
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {ARENA.map((a, i) => ARENA.slice(i + 1).map((b) => <line key={a.id + b.id} x1={P[a.id].x} y1={P[a.id].y} x2={P[b.id].x} y2={P[b.id].y} stroke="#1E2622" strokeOpacity="0.07" strokeDasharray="2 6" />))}
          {TURNS.slice(0, idx).map((h) => (
            <line key={h.from + h.to} x1={P[h.from].x} y1={P[h.from].y} x2={P[h.to].x} y2={P[h.to].y} stroke={MEMBER[h.from].color} strokeOpacity="0.4" strokeWidth="2" />
          ))}
          {handing && (
            <>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={mf.color} strokeWidth="2.5" />
              {[0, 0.25, 0.5].map((d) => (
                <circle key={d} r="4.5" fill={mf.color} stroke="#fff" strokeWidth="2">
                  <animateMotion dur="0.9s" begin={`${d}s`} repeatCount="indefinite" path={`M${from.x},${from.y} L${to.x},${to.y}`} />
                </circle>
              ))}
            </>
          )}
        </svg>
        {ARENA.map((m) => {
          const p = P[m.id]
          const on = m.id === turn.from && !handing
          const target = m.id === turn.to && handing
          return (
            <div key={m.id} className="absolute" style={{ left: p.x, top: p.y, transform: 'translate(-50%,-50%)' }}>
              <motion.div
                animate={{ scale: on ? 1.1 : target ? 1.04 : 1, boxShadow: on ? `0 0 0 7px ${m.color}22, 0 12px 28px -12px ${m.color}99` : '0 1px 2px rgba(30,38,34,.06)' }}
                className="w-[72px] h-[72px] rounded-full bg-surface flex flex-col items-center justify-center"
                style={{ border: `${on ? 2.5 : 1.5}px solid ${on || target ? m.color : m.color + '77'}` }}
              >
                <ProviderLogo provider={m.provider} size={22} />
                <div className="serif text-[11.5px] leading-tight mt-0.5">{T(m.name, m.name_en)}</div>
                <div className="font-mono text-[7.5px] text-ink-3">{m.model.split('-').slice(0, 2).join('-')}</div>
              </motion.div>
            </div>
          )
        })}
        <AnimatePresence mode="wait">
          {!handing ? (
            <motion.div
              key={`b-${idx}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute w-[210px] rounded-xl bg-surface px-3.5 py-2.5 text-[13px] leading-snug shadow-lg border border-line"
              style={{ borderTop: `3px solid ${mf.color}`, ...BUBBLE(ARENA.findIndex((m) => m.id === turn.from), from) }}
            >
              <div className="text-[10px] uppercase tracking-widest" style={{ color: mf.color }}>{T(mf.name, mf.name_en)} · {T(turn.stance, turn.stance_en)}</div>
              <div className="mt-1 text-ink">{turnText.slice(0, chars)}{chars < turnText.length && <span className="caret" />}</div>
            </motion.div>
          ) : (
            <motion.div key={`h-${idx}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="absolute left-1/2 -translate-x-1/2 bottom-4 rounded-full bg-surface border border-line shadow-md px-4 py-1.5 text-[13px] whitespace-nowrap">
              <span className="font-semibold" style={{ color: mf.color }}>{T(mf.name, mf.name_en)}</span>
              <span className="text-ink-3"> ➜ </span>
              <span className="font-semibold" style={{ color: mt.color }}>{T(mt.name, mt.name_en)}</span>
              <span className="text-ink-3 italic"> “{T(turn.reason, turn.reason_en)}”</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* 6 · the team at work: research → reverse engineering → design (approved by you) → build → polish → council review; the product appears on the right */
function SceneBuild({ t }: { t: number }) {
  const T = useT()
  const STEP = 1850
  const done = Math.min(BUILD_STEPS.length, Math.floor(t / STEP))
  const active = Math.min(BUILD_STEPS.length - 1, Math.floor(t / STEP))
  const progress = ease((t - active * STEP) / STEP)
  const files = ['package.json', 'app/page.tsx', 'lib/weather.ts', 'components/Umbrella.tsx', 'components/Hourly.tsx', 'styles/tokens.css']
  const shown = active >= 3 ? files.filter((_, i) => t > 3 * STEP + i * 220) : active > 3 ? files : []
  const appOn = t > 3 * STEP + 600
  const finished = t > BUILD_STEPS.length * STEP
  return (
    <motion.div {...sceneProps}>
      <div className="grid h-full grid-cols-[1.25fr_1fr] gap-5">
        <div className="min-w-0">
          <Label>{T('El equipo trabaja · vos aprobás', 'The team works · you approve')}</Label>
          <ol className="mt-2.5 space-y-1.5">
            {BUILD_STEPS.map((s, i) => {
              const isDone = i < done
              const isActive = i === active && !finished
              return (
                <li key={s.key} className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors ${isActive ? 'border-accent bg-accent-soft' : isDone ? 'border-line bg-surface' : 'border-dashed border-line bg-surface-2/50'}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${isDone ? 'bg-accent text-white' : isActive ? 'bg-surface text-accent ring-2 ring-accent' : 'bg-surface-2 text-ink-3'}`}>{isDone ? '✓' : i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[12.5px] font-semibold leading-tight">
                      {T(s.label, s.label_en)}
                      {s.key === 'design' && isDone && <span className="rounded bg-accent-soft px-1.5 text-[9.5px] font-semibold text-accent">{T('aprobado por vos', 'approved by you')}</span>}
                      {s.key === 'review' && isDone && <span className="text-[13px]">👑</span>}
                    </div>
                    <div className="truncate text-[10.5px] text-ink-3">{s.key === 'build' && shown.length ? `${shown.slice(-3).join(' · ')}${shown.length > 3 ? ` · +${shown.length - 3}…` : ''}` : T(s.detail, s.detail_en)}</div>
                    {isActive && <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/5"><div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} /></div>}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="relative flex items-center justify-center">
          <motion.div animate={{ opacity: appOn ? 1 : 0.25, scale: appOn ? 1 : 0.96, filter: appOn ? 'blur(0px)' : 'blur(2px)' }} className="w-[190px] overflow-hidden rounded-[26px] border-[6px] border-ink/85 bg-[#EAF3FB] shadow-xl">
            <div className="px-4 pt-4 text-[10px] text-ink-3">{T('Buenos Aires · hoy', 'Buenos Aires · today')}</div>
            <div className="px-4 font-mono text-[40px] font-bold leading-none text-ink">17°</div>
            <div className="mx-3 mt-2 rounded-xl bg-[#2F6B5D] px-3 py-2 text-[12px] font-semibold text-white">☔ {T('Llevá paraguas', 'Take an umbrella')} <span className="font-normal opacity-80">· 70 % 15–18 h</span></div>
            <div className="mt-3 flex items-end gap-1 px-4">
              {[20, 30, 45, 70, 65, 40, 25, 15].map((h, i) => <div key={i} className="flex-1 rounded-t" style={{ height: 8 + h * 0.5, background: h > 50 ? '#3D5CC4' : '#8FB7D3' }} />)}
            </div>
            <div className="flex justify-between px-4 pb-3 pt-1 font-mono text-[8px] text-ink-3"><span>12 h</span><span>15 h</span><span>18 h</span><span>21 h</span></div>
            <div className="mx-3 mb-3 rounded-lg border border-[#E6A19A] bg-[#FDECEA] px-2 py-1 text-[9px] text-[#B0473B]">⚠ {T('Alerta amarilla · tormentas', 'Yellow alert · storms')}</div>
          </motion.div>
          <AnimatePresence>
            {finished && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3 py-1 text-[11.5px] font-semibold text-paper shadow-lg">
                v1 · 100 % {T('listo', 'ready')} · {T('Abrir la app', 'Open the app')} ↗
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

/* 7 · audit of an existing project: upload, the roles review from their areas, findings and a readiness score */
const AUDIT_FINDINGS: { role: string; sev: 'bloqueante' | 'mejora'; text: string; text_en: string; where: string }[] = [
  { role: 'qa', sev: 'bloqueante', text: 'El checkout no valida el stock antes de cobrar', text_en: 'Checkout does not validate stock before charging', where: 'api/checkout.ts:48' },
  { role: 'eng', sev: 'bloqueante', text: 'Secretos en el repo: .env commiteado', text_en: 'Secrets in the repo: .env committed', where: '.env' },
  { role: 'design', sev: 'mejora', text: 'Estados vacíos sin diseño en el carrito', text_en: 'No empty states designed for the cart', where: 'components/Cart.tsx' },
  { role: 'product', sev: 'mejora', text: 'Falta el flujo de devolución del brief', text_en: 'The refund flow from the brief is missing', where: 'README.md' },
  { role: 'cto', sev: 'mejora', text: 'Sin tests de integración en pagos', text_en: 'No integration tests on payments', where: 'tests/' },
]

function SceneAudit({ t }: { t: number }) {
  const T = useT()
  const uploaded = t > 900
  const reviewing = t > 1800
  const findings = AUDIT_FINDINGS.filter((_, i) => t > 3200 + i * 900)
  const scored = t > 8200
  const readiness = scored ? 68 : 0
  const reviewers = TEAM.filter((m) => ['cto', 'eng', 'product', 'design', 'qa'].includes(m.id))
  return (
    <motion.div {...sceneProps}>
      <div className="grid h-full grid-cols-[1.2fr_1fr] gap-5">
        <div className="min-w-0">
          <Label>{T('Auditar un proyecto', 'Audit a project')}</Label>
          <motion.div animate={{ borderColor: uploaded ? '#2F6B5D' : undefined }} className={`mt-2 flex items-center gap-3 rounded-xl border px-3 py-2.5 ${uploaded ? 'bg-accent-soft/60' : 'border-dashed border-line'}`}>
            <span className="text-[20px]">{uploaded ? '📦' : '⬆️'}</span>
            <div className="min-w-0 text-[12.5px]">
              <div className="font-semibold">{uploaded ? 'mi-tienda.zip' : T('Arrastrá tu proyecto (zip o carpeta)', 'Drop your project (zip or folder)')}</div>
              <div className="text-ink-3">{uploaded ? `142 ${T('archivos', 'files')} · Next.js · Stripe · ${T('subido', 'uploaded')} ✓` : T('código, README, lo que tengas', 'code, README, whatever you have')}</div>
            </div>
          </motion.div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {reviewers.map((m, i) => {
              const on = reviewing && t > 1800 + i * 350
              const done = findings.some((f) => f.role === m.id) || scored
              return (
                <span key={m.id} className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors ${on ? 'bg-surface' : 'border-line bg-surface-2/60 text-ink-3'}`} style={{ borderColor: on ? m.color : undefined }}>
                  <ProviderLogo provider={m.provider} size={13} /> {T(m.name, m.name_en)} {done ? <span className="text-accent">✓</span> : on ? <span className="caret" /> : null}
                </span>
              )
            })}
          </div>
          <div className="mt-3 space-y-1.5">
            <AnimatePresence>
              {findings.map((f) => {
                const m = MEMBER[f.role]
                return (
                  <motion.div key={f.text} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px]">
                    <span className={`mt-[2px] shrink-0 rounded px-1.5 text-[9.5px] font-bold uppercase ${f.sev === 'bloqueante' ? 'bg-danger/15 text-danger' : 'bg-gold/15 text-gold'}`}>{f.sev === 'bloqueante' ? T('bloqueante', 'blocker') : T('mejora', 'improvement')}</span>
                    <span className="min-w-0 flex-1 truncate">{T(f.text, f.text_en)} <span className="font-mono text-[10.5px] text-ink-3">{f.where}</span></span>
                    <span className="shrink-0 text-[10.5px] font-semibold" style={{ color: m.color }}>{T(m.name, m.name_en)}</span>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <div className="relative h-[150px] w-[150px]">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#E6EAE7" strokeWidth="12" />
              <motion.circle cx="60" cy="60" r="50" fill="none" stroke="#9C7622" strokeWidth="12" strokeLinecap="round" strokeDasharray={2 * Math.PI * 50} initial={{ strokeDashoffset: 2 * Math.PI * 50 }} animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - readiness / 100) }} transition={{ duration: 1.2, ease: 'easeOut' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-mono text-[34px] font-bold leading-none text-ink">{scored ? '68' : '—'}<span className="text-[16px]">%</span></div>
              <div className="text-[10px] uppercase tracking-widest text-ink-3">{T('listo para prod', 'production-ready')}</div>
            </div>
          </div>
          <AnimatePresence>
            {scored && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 w-full rounded-xl border border-line bg-surface p-3 text-[12px]">
                <div className="text-[10px] uppercase tracking-widest text-ink-3">{T('Informe de auditoría', 'Audit report')}</div>
                <div className="mt-1 font-semibold">2 {T('bloqueantes', 'blockers')} · 3 {T('mejoras', 'improvements')}</div>
                <div className="mt-0.5 text-ink-2">{T('Qué arreglar primero, por rol, con archivo y línea. Y un botón para que el equipo lo corrija.', 'What to fix first, per role, with file and line. And a button for the team to fix it.')}</div>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white">▶ {T('Que el equipo lo corrija', 'Have the team fix it')}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
