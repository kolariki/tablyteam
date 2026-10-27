import { zip, type Zippable } from 'fflate'

/** Same rules as the server's `_extract_zip`: the browser walks the project folder, keeps only code/text and zips that,
 *  so a 2 GB folder with node_modules becomes a few MB upload. */
export const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'dist-lhci', 'dist-preview', 'build', 'out', '.venv', 'venv', '__pycache__', '.pytest_cache', '.turbo', '.cache', '.wrangler', 'coverage', 'test-results', 'playwright-report', '.lighthouseci', '.perf', 'tmp', '.idea', '.vscode', 'target', '.expo', 'vendor', '__MACOSX', '.gradle', 'Pods', 'DerivedData', '.dart_tool', '.nuxt', '.svelte-kit', '.parcel-cache', 'storybook-static'])
const BINARY_RX = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|rar|7z|woff2?|ttf|otf|eot|mp[34]|mov|avi|webm|bin|lock|map|exe|dll|so|dylib|a|o|class|jar|war|pyc|wasm|sqlite|db|psd|ai|sketch|fig|heic|svgz|DS_Store)$/i
export const MAX_FILE = 400_000
export const MAX_TOTAL = 25_000_000
export const MAX_FILES = 2500

export interface ZipStats { files: number; skipped: number; bytes: number; zipBytes: number; root: string; truncated: boolean }
export type Progress = (scanned: number, kept: number) => void

interface Entry { rel: string; file: () => Promise<File>; size?: number }

function keep(rel: string): boolean {
  const parts = rel.split('/')
  if (parts.some((p) => SKIP_DIRS.has(p) || p.startsWith('.DS_Store') || p === '..')) return false
  return !BINARY_RX.test(rel)
}

/** Files from an `<input webkitdirectory>` (every file carries `webkitRelativePath`). */
function fromFileList(list: FileList | File[]): { root: string; entries: Entry[]; skipped: number } {
  const files = Array.from(list)
  const root = files[0]?.webkitRelativePath.split('/')[0] ?? ''
  let skipped = 0
  const entries: Entry[] = []
  for (const f of files) {
    const rel = f.webkitRelativePath.split('/').slice(1).join('/') || f.name
    if (!keep(rel) || f.size > MAX_FILE) { skipped++; continue }
    entries.push({ rel, size: f.size, file: async () => f })
  }
  return { root, entries, skipped }
}

/** A dropped folder: `DataTransferItem.webkitGetAsEntry()`; skipped directories are never descended into. */
async function fromDirectoryEntry(dir: FileSystemDirectoryEntry, onProgress?: Progress): Promise<{ root: string; entries: Entry[]; skipped: number }> {
  const entries: Entry[] = []
  let skipped = 0
  let scanned = 0
  const readAll = (reader: FileSystemDirectoryReader) =>
    new Promise<FileSystemEntry[]>((resolve, reject) => {
      const acc: FileSystemEntry[] = []
      const step = () => reader.readEntries((batch) => (batch.length ? (acc.push(...batch), step()) : resolve(acc)), reject)
      step()
    })
  const walk = async (d: FileSystemDirectoryEntry, prefix: string) => {
    for (const e of await readAll(d.createReader())) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name
      if (e.isDirectory) {
        if (SKIP_DIRS.has(e.name)) { skipped++; continue }
        await walk(e as FileSystemDirectoryEntry, rel)
      } else {
        scanned++
        if (!keep(rel)) { skipped++; continue }
        const fe = e as FileSystemFileEntry
        entries.push({ rel, file: () => new Promise<File>((res, rej) => fe.file(res, rej)) })
        if (scanned % 50 === 0) onProgress?.(scanned, entries.length)
      }
    }
  }
  await walk(dir, '')
  return { root: dir.name, entries, skipped }
}

async function build(src: { root: string; entries: Entry[]; skipped: number }, onProgress?: Progress): Promise<{ file: File; stats: ZipStats }> {
  const data: Zippable = {}
  let bytes = 0
  let files = 0
  let skipped = src.skipped
  let truncated = false
  for (const e of src.entries) {
    if (files >= MAX_FILES || bytes >= MAX_TOTAL) { truncated = true; skipped++; continue }
    const f = await e.file()
    if (f.size > MAX_FILE) { skipped++; continue }
    data[e.rel] = new Uint8Array(await f.arrayBuffer())
    bytes += f.size
    files++
    if (files % 50 === 0) onProgress?.(files + skipped, files)
  }
  if (!files) throw new Error('La carpeta no tiene archivos de código o texto legibles')
  const out = await new Promise<Uint8Array>((resolve, reject) => zip(data, { level: 6 }, (err, d) => (err ? reject(err) : resolve(d))))
  const name = `${(src.root || 'proyecto').replace(/[^\w.-]+/g, '-')}.zip`
  const file = new File([out as BlobPart], name, { type: 'application/zip' })
  return { file, stats: { files, skipped, bytes, zipBytes: out.length, root: src.root, truncated } }
}

export function zipFromFileList(list: FileList | File[], onProgress?: Progress) {
  return build(fromFileList(list), onProgress)
}

export async function zipFromDrop(dt: DataTransfer, onProgress?: Progress): Promise<{ file: File; stats: ZipStats } | { zip: File } | null> {
  const items = Array.from(dt.items ?? [])
  for (const it of items) {
    const entry = it.webkitGetAsEntry?.()
    if (entry?.isDirectory) return build(await fromDirectoryEntry(entry as FileSystemDirectoryEntry, onProgress), onProgress)
  }
  const f = dt.files[0]
  if (f && /\.zip$/i.test(f.name)) return { zip: f }
  return null
}
