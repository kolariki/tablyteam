import { create } from 'zustand'
import { api } from './api'

/** The user's own photo (their seat «Vos» at the team table and their chip in the header). */
export const useMyPhoto = create<{ url: string | null; loaded: boolean }>(() => ({ url: null, loaded: false }))

export function loadMyPhoto() {  // read again on every home: another account may have signed in on this tab
  api.myPhoto().then((d) => useMyPhoto.setState({ url: d.image, loaded: true })).catch(() => useMyPhoto.setState({ url: null, loaded: true }))
}

/** Crops the picture square around its centre and makes it 320 px before it goes up (a phone photo weighs megabytes). */
export async function saveMyPhoto(file: File) {
  const img = await new Promise<HTMLImageElement>((ok, bad) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = () => bad(new Error('No pude leer esa imagen'))
    i.src = URL.createObjectURL(file)
  })
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  const c = document.createElement('canvas')
  c.width = c.height = 320
  c.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 320, 320)
  URL.revokeObjectURL(img.src)
  const d = await api.setMyPhoto(c.toDataURL('image/jpeg', 0.86))
  useMyPhoto.setState({ url: d.image })
}

export async function removeMyPhoto() {
  await api.deleteMyPhoto()
  useMyPhoto.setState({ url: null })
}
