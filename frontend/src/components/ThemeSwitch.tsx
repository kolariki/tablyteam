import { Monitor, Moon, Sun } from 'lucide-react'
import { setTheme, useTheme, type Theme } from '../lib/look'
import { useT } from '../lib/i18n'

/** Light / dark / automatic (the computer's setting). Remembered on this browser. */
export default function ThemeSwitch({ className = 'h-10', auto = true }: { className?: string; auto?: boolean }) {
  const T = useT()
  const theme = useTheme((s) => s.theme)
  const all: [Theme, typeof Sun, string][] = [
    ['light', Sun, T('Claro', 'Light')],
    ['dark', Moon, T('Oscuro', 'Dark')],
    ['auto', Monitor, T('Automático: como tu compu (el constructor, oscuro)', 'Automatic: like your computer (the builder, dark)')],
  ]
  const opts = all.filter(([id]) => auto || id !== 'auto')
  return (
    <div role="radiogroup" aria-label={T('Tema', 'Theme')} className={`flex items-center rounded-full border border-line bg-surface p-1 shadow-sm ${className}`}>
      {opts.map(([id, Icon, label]) => (
        <button key={id} type="button" role="radio" aria-checked={theme === id} aria-label={label} title={label} onClick={() => setTheme(id)}
          className={`flex h-full aspect-square items-center justify-center rounded-full transition ${theme === id ? 'bg-accent text-white' : 'text-ink-3 hover:text-ink'}`}>
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}
