/**
 * Records the current browser tab (cropped to one element when the browser supports Region
 * Capture) and returns the result as a downloadable file. Chrome/Edge: MP4 when supported, WebM
 * otherwise. Needs a user click: the browser asks which tab to share — pick "this tab".
 */

export interface Recording {
  /** resolves when the user stops sharing from the browser bar */
  ended: Promise<void>
  stop: () => Promise<Blob>
  mime: string
}

const TYPES = [
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export const recordingSupported = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia

export async function requestTabStream(withAudio: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30, width: { ideal: 3840 }, height: { ideal: 2160 } },
    audio: withAudio,
    // Chrome-only hints: offer the current tab first and keep its audio
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    surfaceSwitching: 'exclude',
  } as DisplayMediaStreamOptions)
}

export async function startRecording(stream: MediaStream, cropTo?: HTMLElement | null): Promise<Recording> {
  const track = stream.getVideoTracks()[0]
  // Region Capture: crop the shared tab to the arena element (Chrome 104+)
  const CropTarget = (window as unknown as { CropTarget?: { fromElement: (el: Element) => Promise<unknown> } }).CropTarget
  if (cropTo && CropTarget && 'cropTo' in track) {
    try {
      const target = await CropTarget.fromElement(cropTo)
      await (track as unknown as { cropTo: (t: unknown) => Promise<void> }).cropTo(target)
    } catch {
      /* not the current tab or unsupported: record the whole tab */
    }
  }
  const mime = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 12_000_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  rec.start(1000)
  const ended = new Promise<void>((res) => track.addEventListener('ended', () => res(), { once: true }))
  const stop = () =>
    new Promise<Blob>((res) => {
      const finish = () => {
        stream.getTracks().forEach((t) => t.stop())
        res(new Blob(chunks, { type: (mime || 'video/webm').split(';')[0] }))
      }
      if (rec.state === 'inactive') return finish()
      rec.onstop = finish
      rec.stop()
    })
  return { ended, stop, mime: mime || 'video/webm' }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'sesion'
