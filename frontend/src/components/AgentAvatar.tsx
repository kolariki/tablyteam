import { createAvatar } from '@dicebear/core'
import * as notionists from '@dicebear/notionists'
import { useMemo } from 'react'
import ProviderLogo from './ProviderLogo'

/**
 * Each role is a person: a deterministic illustrated portrait (same role + name → same face, everywhere), with the
 * provider's logo printed on the shirt. Nothing is fetched: the SVG is generated locally.
 */
const cache = new Map<string, string>()

export function avatarUri(seed: string): string {
  let uri = cache.get(seed)
  if (!uri) {
    uri = createAvatar(notionists, { seed, backgroundColor: ['transparent'], radius: 50, scale: 108, translateY: -4 }).toDataUri()
    cache.set(seed, uri)
  }
  return uri
}

export default function AgentAvatar({ agent, size = 40, className = '', ring = true, logo: logoRatio = 0.24, chip = false }: { agent?: { name?: string; role?: string | null; provider?: string | null; wanted_provider?: string | null; color?: string | null } | null; size?: number; className?: string; ring?: boolean; logo?: number; chip?: boolean }) {
  const seed = `${agent?.role ?? ''}:${agent?.name ?? '?'}`
  const uri = useMemo(() => avatarUri(seed), [seed])
  const provider = agent?.wanted_provider ?? agent?.provider ?? undefined
  const logo = Math.round(size * logoRatio)
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-[#F6F3EC] ${ring ? 'ring-1 ring-black/10' : ''} ${className}`} style={{ width: size, height: size }} aria-hidden>
      <img src={uri} alt="" width={size} height={size} draggable={false} className="block h-full w-full select-none" />
      {/* the provider's mark, printed on the shirt (chest area of the notionists body) */}
      {provider && (
        <span className={`absolute left-1/2 flex -translate-x-1/2 items-center justify-center ${chip ? 'rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] ring-1 ring-black/10' : ''}`} style={{ bottom: Math.round(size * (chip ? 0.02 : 0.035)), width: chip ? logo + 6 : logo, height: chip ? logo + 6 : logo }}>
          <ProviderLogo provider={provider} size={logo} />
        </span>
      )}
    </span>
  )
}
