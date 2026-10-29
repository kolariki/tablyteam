import { createAvatar } from '@dicebear/core'
import * as avataaars from '@dicebear/avataaars'
import { create } from 'zustand'

/**
 * Illustrated faces the user designs for each employee (DiceBear «Avataaars» by Pablo Stanley, free for commercial use).
 * A config is a handful of drawing options; null means the role's default portrait.
 */
export interface AvatarConfig {
  skin: string
  top: string // a hairstyle / headwear, or 'none' (bald)
  hair: string
  beard: string // 'none' or a beard / moustache
  glasses: string // 'none' or a frame
  clothing: string
  clothes: string
  face: 'smile' | 'serious' | 'happy'
  bg: string // 'transparent' or a hex
}

export const SKINS = ['ffdbb4', 'edb98a', 'd08b5b', 'ae5d29', '8d5524', '614335', '3b2219']
export const HAIR_COLORS = ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'c93305', 'e8e1e1', 'ecdcbf', 'f59797']
export const TOPS = ['none', 'shortFlat', 'shortRound', 'shortWaved', 'shortCurly', 'theCaesar', 'theCaesarAndSidePart', 'sides', 'shavedSides', 'frizzle', 'shaggy', 'shaggyMullet',
  'fro', 'froBand', 'dreads', 'dreads01', 'dreads02', 'curly', 'curvy', 'bob', 'bun', 'straight01', 'straight02', 'straightAndStrand', 'longButNotTooLong', 'bigHair',
  'miaWallace', 'frida', 'hijab', 'turban', 'hat', 'winterHat1']
export const BEARDS = ['none', 'beardLight', 'beardMedium', 'beardMajestic', 'moustacheFancy', 'moustacheMagnum']
export const GLASSES = ['none', 'prescription01', 'prescription02', 'round', 'wayfarers', 'kurt', 'sunglasses']
export const CLOTHING = ['blazerAndShirt', 'blazerAndSweater', 'collarAndSweater', 'hoodie', 'overall', 'shirtCrewNeck', 'shirtScoopNeck', 'shirtVNeck', 'graphicShirt']
export const CLOTHES_COLORS = ['262e33', '3c4f5c', '25557c', '5199e4', '65c9ff', 'a7ffc4', 'ffafb9', 'ff5c5c', 'e6e6e6', 'ffffff']
export const BGS = ['transparent', 'e2ede8', 'dbeafe', 'fde2e4', 'fef3c7', 'ede9fe', 'e0f2f1', 'f1f5f9']

const P = (skin: string, top: string, hair: string, beard: string, glasses: string, clothing: string, clothes: string, face: AvatarConfig['face'], bg: string): AvatarConfig =>
  ({ skin, top, hair, beard, glasses, clothing, clothes, face, bg })

/** 24 ready-made people across skin tones, hair types and styles; every one can be tweaked. */
export const PRESETS: AvatarConfig[] = [
  P('ffdbb4', 'shortFlat', '724133', 'none', 'none', 'blazerAndShirt', '262e33', 'smile', 'e2ede8'),
  P('ffdbb4', 'bob', 'd6b370', 'none', 'round', 'collarAndSweater', '65c9ff', 'smile', 'dbeafe'),
  P('edb98a', 'theCaesarAndSidePart', '2c1b18', 'beardLight', 'none', 'shirtVNeck', '25557c', 'serious', 'f1f5f9'),
  P('edb98a', 'straight01', '2c1b18', 'none', 'none', 'blazerAndSweater', 'ff5c5c', 'happy', 'fde2e4'),
  P('d08b5b', 'shortCurly', '2c1b18', 'beardMedium', 'prescription02', 'hoodie', '3c4f5c', 'smile', 'e0f2f1'),
  P('d08b5b', 'longButNotTooLong', '4a312c', 'none', 'none', 'shirtScoopNeck', 'a7ffc4', 'smile', 'e2ede8'),
  P('ae5d29', 'fro', '2c1b18', 'none', 'none', 'shirtCrewNeck', '5199e4', 'happy', 'fef3c7'),
  P('ae5d29', 'dreads01', '2c1b18', 'beardLight', 'none', 'graphicShirt', '262e33', 'smile', 'ede9fe'),
  P('8d5524', 'none', '2c1b18', 'beardMajestic', 'none', 'blazerAndShirt', '3c4f5c', 'serious', 'f1f5f9'),
  P('8d5524', 'froBand', '2c1b18', 'none', 'round', 'collarAndSweater', 'ffafb9', 'smile', 'fde2e4'),
  P('614335', 'theCaesar', '2c1b18', 'beardMedium', 'none', 'shirtVNeck', 'e6e6e6', 'smile', 'dbeafe'),
  P('614335', 'curvy', '2c1b18', 'none', 'none', 'blazerAndSweater', '25557c', 'happy', 'e0f2f1'),
  P('3b2219', 'shavedSides', '2c1b18', 'none', 'wayfarers', 'hoodie', '65c9ff', 'smile', 'fef3c7'),
  P('3b2219', 'bun', '2c1b18', 'none', 'none', 'shirtScoopNeck', 'ff5c5c', 'smile', 'ede9fe'),
  P('edb98a', 'hijab', '2c1b18', 'none', 'none', 'blazerAndShirt', '262e33', 'smile', 'e2ede8'),
  P('d08b5b', 'turban', '2c1b18', 'beardMajestic', 'none', 'collarAndSweater', '3c4f5c', 'serious', 'f1f5f9'),
  P('ffdbb4', 'shaggyMullet', 'c93305', 'none', 'kurt', 'graphicShirt', 'a7ffc4', 'happy', 'fde2e4'),
  P('ffdbb4', 'none', 'e8e1e1', 'moustacheFancy', 'prescription01', 'blazerAndSweater', '25557c', 'serious', 'dbeafe'),
  P('edb98a', 'bigHair', 'b58143', 'none', 'none', 'shirtCrewNeck', 'ffafb9', 'smile', 'fef3c7'),
  P('ae5d29', 'sides', '4a312c', 'beardLight', 'prescription02', 'blazerAndShirt', '5199e4', 'smile', 'e0f2f1'),
  P('d08b5b', 'straightAndStrand', '2c1b18', 'none', 'none', 'overall', '65c9ff', 'happy', 'e2ede8'),
  P('614335', 'dreads', '2c1b18', 'none', 'sunglasses', 'hoodie', '262e33', 'smile', 'ede9fe'),
  P('8d5524', 'shortWaved', '2c1b18', 'moustacheMagnum', 'none', 'shirtVNeck', 'e6e6e6', 'smile', 'f1f5f9'),
  P('ffdbb4', 'miaWallace', '2c1b18', 'none', 'none', 'blazerAndShirt', 'ff5c5c', 'serious', 'fde2e4'),
]

const FACES: Record<AvatarConfig['face'], { eyes: string; mouth: string; eyebrows: string }> = {
  smile: { eyes: 'default', mouth: 'smile', eyebrows: 'defaultNatural' },
  serious: { eyes: 'default', mouth: 'serious', eyebrows: 'flatNatural' },
  happy: { eyes: 'happy', mouth: 'twinkle', eyebrows: 'raisedExcitedNatural' },
}

const cache = new Map<string, string>()
export function avatarSrc(c: AvatarConfig): string {
  const key = JSON.stringify(c)
  const hit = cache.get(key)
  if (hit) return hit
  const f = FACES[c.face] ?? FACES.smile
  const opts: Record<string, unknown> = {
    seed: 'tably', skinColor: [c.skin], hairColor: [c.hair], facialHairColor: [c.hair], clothing: [c.clothing], clothesColor: [c.clothes],
    eyes: [f.eyes], mouth: [f.mouth], eyebrows: [f.eyebrows], backgroundColor: [c.bg],
    top: c.top === 'none' ? undefined : [c.top], topProbability: c.top === 'none' ? 0 : 100,
    facialHair: c.beard === 'none' ? undefined : [c.beard], facialHairProbability: c.beard === 'none' ? 0 : 100,
    accessories: c.glasses === 'none' ? undefined : [c.glasses], accessoriesProbability: c.glasses === 'none' ? 0 : 100,
  }
  const uri = createAvatar(avataaars, opts as Parameters<typeof createAvatar<typeof avataaars>>[1]).toDataUri()
  cache.set(key, uri)
  return uri
}

/** The same key the backend uses for an employee: a catalog role by its id, an own role by its name. */
export function roleKey(role?: string | null, name?: string | null): string {
  if (role && role !== 'custom') return role
  return 'custom:' + ((name ?? 'custom').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'custom')
}

/** Avatars the user designed, by employee key (filled when the team loads), so every face of that role shows it. */
export const useAvatars = create<{ byKey: Record<string, AvatarConfig>; set: (byKey: Record<string, AvatarConfig>) => void }>((set) => ({ byKey: {}, set: (byKey) => set({ byKey }) }))
