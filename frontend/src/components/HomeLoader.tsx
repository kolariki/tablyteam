import { motion } from 'framer-motion'
import { useT } from '../lib/i18n'
import ProviderLogo from './ProviderLogo'

const RING = ['anthropic', 'openai', 'deepseek', 'gemini', 'xai', 'groq', 'kimi', 'mistral', 'openrouter', 'ollama']

/** The home is loading (providers, experiments, projects): the Tably mark with the companies orbiting around it. */
export default function HomeLoader({ caption }: { caption?: string } = {}) {
  const T = useT()
  const R = 92
  return (
    <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }} className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-paper arena-bg">
      <div className="relative" style={{ width: R * 2 + 48, height: R * 2 + 48 }}>
        {/* the orbit: the ring spins, each logo spins back so it stays upright */}
        <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 9, ease: 'linear', repeat: Infinity }}>
          {RING.map((id, i) => {
            const a = (i / RING.length) * Math.PI * 2
            return (
              <motion.span
                key={id}
                className="absolute flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface shadow-sm"
                style={{ left: `calc(50% + ${Math.cos(a) * R}px - 20px)`, top: `calc(50% + ${Math.sin(a) * R}px - 20px)` }}
                animate={{ rotate: -360 }}
                transition={{ duration: 9, ease: 'linear', repeat: Infinity }}
              >
                <ProviderLogo provider={id} size={22} />
              </motion.span>
            )
          })}
        </motion.div>
        <motion.div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}>
          <img src="/icon.svg" alt="" aria-hidden className="h-20 w-20 rounded-[22px] shadow-[0_18px_40px_-14px_rgba(47,107,93,.6)]" draggable={false} />
        </motion.div>
        <span className="pointer-events-none absolute inset-6 rounded-full border border-dashed border-line/80" aria-hidden />
      </div>
      <div className="serif mt-8 text-2xl">Tably <em className="text-accent">Team</em></div>
      <div className="mt-1.5 text-[13px] text-ink-3">{caption ?? T('Reuniendo a tu equipo…', 'Gathering your team…')}</div>
    </motion.div>
  )
}
