import { useT } from '../lib/i18n'
import ProviderLogo from './ProviderLogo'

const MARQUEE = [
  { id: 'meta', name: 'Muse', company: 'Meta' },
  { id: 'anthropic', name: 'Claude', company: 'Anthropic' },
  { id: 'openai', name: 'GPT', company: 'OpenAI' },
  { id: 'deepseek', name: 'DeepSeek', company: 'DeepSeek' },
  { id: 'gemini', name: 'Gemini', company: 'Google' },
  { id: 'kimi', name: 'Kimi', company: 'Moonshot AI' },
  { id: 'xai', name: 'Grok', company: 'xAI' },
  { id: 'mistral', name: 'Mistral', company: 'Mistral AI' },
  { id: 'groq', name: 'Llama', company: 'Groq' },
  { id: 'openrouter', name: 'OpenRouter', company: '300+ modelos', company_en: '300+ models' },
  { id: 'ollama', name: 'Ollama', company: 'modelos locales', company_en: 'local models' },
]

/** Full-width, endless strip of every supported AI. Three identical copies; moving by one copy (-33.333%) loops seamlessly even on ultra-wide screens. */
export default function LogoMarquee() {
  const T = useT()
  return (
    <div className="shrink-0 w-full overflow-hidden border-t border-line bg-surface/60 backdrop-blur-sm py-6 marquee-mask" aria-label={T('Modelos compatibles', 'Supported models')}>
      <div className="marquee-track flex w-max">
        {[0, 1, 2].map((half) => (
          <div key={half} className="flex shrink-0" aria-hidden={half > 0}>
            {MARQUEE.map((m) => (
              <div key={m.id} className="flex items-center gap-3.5 px-10">
                <ProviderLogo provider={m.id} size={40} />
                <div className="leading-tight whitespace-nowrap">
                  <div className="serif text-2xl text-ink">{m.name}</div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-ink-3">{T(m.company, (m as { company_en?: string }).company_en ?? m.company)}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
