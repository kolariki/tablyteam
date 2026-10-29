import { create } from 'zustand'

/**
 * Realistic faces for employees, in the same editorial style as the role portraits (generated with gpt-image-2):
 * 24 ready-made people shipped with the app, or one created for this employee from traits the user picks.
 */
export interface AvatarConfig {
  src: string // /avatars/people/pNN.webp (preset) or /api/faces/<id>.webp (generated)
}

export const PRESET_FACES: AvatarConfig[] = Array.from({ length: 24 }, (_, i) => ({ src: `/avatars/people/p${String(i + 1).padStart(2, '0')}.webp` }))

export const avatarSrc = (c: AvatarConfig) => (c.src.startsWith('/avatars/') ? `${import.meta.env.BASE_URL}${c.src.slice(1)}` : c.src)

/** The same key the backend uses for an employee: a catalog role by its id, an own role by its name. */
export function roleKey(role?: string | null, name?: string | null): string {
  if (role && role !== 'custom') return role
  return 'custom:' + ((name ?? 'custom').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'custom')
}

/** Faces the user picked, by employee key (filled when the team loads), so every face of that role shows it. */
export const useAvatars = create<{ byKey: Record<string, AvatarConfig>; set: (byKey: Record<string, AvatarConfig>) => void }>((set) => ({ byKey: {}, set: (byKey) => set({ byKey }) }))
