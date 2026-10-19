import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { BRAND_COLOR } from '../lib/brand'
import { useT } from '../lib/i18n'
import ProviderLogo from './ProviderLogo'

const LABEL: Record<string, string> = {
  anthropic: 'Claude', openai: 'GPT', deepseek: 'DeepSeek', gemini: 'Gemini', kimi: 'Kimi', xai: 'Grok', groq: 'Llama', mistral: 'Mistral', openrouter: 'OpenRouter', ollama: 'Ollama', mock: 'Simulado', 'claude-code': 'Claude Code', codex: 'Codex',
}

/** Full-screen reveal of the chosen builder model, then hands over to the builder UI. */
export default function BuilderIntro({ provider, model, title, onDone }: { provider: string; model: string; title: string; onDone: () => void }) {
  const T = useT()
  const color = BRAND_COLOR[provider] ?? '#2F6B5D'
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const t = setTimeout(() => done.current(), 3200) // parent re-renders on every build event; keep one timer
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="h-full arena-bg flex items-center justify-center overflow-hidden">
      <div className="relative flex flex-col items-center">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-full border"
            style={{ borderColor: color, width: 180, height: 180, top: -20, opacity: 0 }}
            animate={{ scale: [1, 2.6], opacity: [0.45, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
          />
        ))}
        <motion.div
          initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
          animate={{ scale: [0.3, 1.15, 1], opacity: 1, rotate: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="w-[140px] h-[140px] rounded-full bg-surface flex items-center justify-center"
          style={{ border: `3px solid ${color}`, boxShadow: `0 0 0 14px ${color}14, 0 30px 60px -20px ${color}88` }}
        >
          <ProviderLogo provider={provider} size={76} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="mt-10 text-center">
          <div className="text-xs uppercase tracking-[0.5em] text-ink-3">{T('constructor', 'builder')}</div>
          <div className="serif text-5xl mt-2" style={{ color }}>{provider === 'mock' ? T('Simulado', 'Simulated') : LABEL[provider] ?? provider}</div>
          <div className="font-mono text-sm text-ink-3 mt-2">{provider === 'claude-code' ? T('tu suscripción · sin API', 'your subscription · no API') : provider === 'codex' ? T('Codex CLI · local', 'Codex CLI · local') : model}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="mt-8 text-ink-2 text-lg">
          {T('Leyendo el brief de', 'Reading the brief for')} <span className="font-medium text-ink">{title}</span>
          <span className="caret" />
        </motion.div>
        <motion.div className="mt-6 h-1 w-64 rounded-full bg-black/5 overflow-hidden">
          <motion.div className="h-full" style={{ background: color }} initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 3, ease: 'easeInOut' }} />
        </motion.div>
      </div>
    </div>
  )
}
