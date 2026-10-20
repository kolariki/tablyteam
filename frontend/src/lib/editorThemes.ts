/**
 * The editor skins: the themes people know from their IDE, so the code pane can look like the editor they use.
 * Monaco ships VS Code's Dark+/Light+ and High Contrast; the rest are defined here from each theme's canonical palette.
 */
import type * as Monaco from 'monaco-editor'
import { create } from 'zustand'

export type EditorThemeId = 'vs-dark' | 'vs' | 'hc-black' | 'cursor-dark' | 'github-dark' | 'github-light' | 'dracula' | 'monokai' | 'one-dark' | 'solarized-dark' | 'solarized-light' | 'night-owl' | 'nord' | 'catppuccin-mocha'

export interface EditorTheme { id: EditorThemeId; label: string; ide: string; dark: boolean; bg: string; fg: string; accent: string }

export const EDITOR_THEMES: EditorTheme[] = [
  { id: 'vs-dark', label: 'Dark+', ide: 'VS Code', dark: true, bg: '#1E1E1E', fg: '#D4D4D4', accent: '#569CD6' },
  { id: 'vs', label: 'Light+', ide: 'VS Code', dark: false, bg: '#FFFFFF', fg: '#000000', accent: '#0000FF' },
  { id: 'cursor-dark', label: 'Cursor Dark', ide: 'Cursor', dark: true, bg: '#181818', fg: '#D6D6DD', accent: '#AAA0FA' },
  { id: 'github-dark', label: 'GitHub Dark', ide: 'GitHub', dark: true, bg: '#0D1117', fg: '#E6EDF3', accent: '#79C0FF' },
  { id: 'github-light', label: 'GitHub Light', ide: 'GitHub', dark: false, bg: '#FFFFFF', fg: '#1F2328', accent: '#0550AE' },
  { id: 'one-dark', label: 'One Dark Pro', ide: 'Atom', dark: true, bg: '#282C34', fg: '#ABB2BF', accent: '#61AFEF' },
  { id: 'dracula', label: 'Dracula', ide: 'Dracula', dark: true, bg: '#282A36', fg: '#F8F8F2', accent: '#BD93F9' },
  { id: 'monokai', label: 'Monokai', ide: 'Sublime', dark: true, bg: '#272822', fg: '#F8F8F2', accent: '#A6E22E' },
  { id: 'night-owl', label: 'Night Owl', ide: 'Night Owl', dark: true, bg: '#011627', fg: '#D6DEEB', accent: '#82AAFF' },
  { id: 'nord', label: 'Nord', ide: 'Nord', dark: true, bg: '#2E3440', fg: '#D8DEE9', accent: '#88C0D0' },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', ide: 'Catppuccin', dark: true, bg: '#1E1E2E', fg: '#CDD6F4', accent: '#89B4FA' },
  { id: 'solarized-dark', label: 'Solarized Dark', ide: 'Solarized', dark: true, bg: '#002B36', fg: '#839496', accent: '#268BD2' },
  { id: 'solarized-light', label: 'Solarized Light', ide: 'Solarized', dark: false, bg: '#FDF6E3', fg: '#657B83', accent: '#268BD2' },
  { id: 'hc-black', label: 'High Contrast', ide: 'VS Code', dark: true, bg: '#000000', fg: '#FFFFFF', accent: '#FFFFFF' },
]

const KEY = 'arena.editorTheme'
const FONT_KEY = 'arena.editorFont'
const stored = (): EditorThemeId => {
  try { const v = localStorage.getItem(KEY) as EditorThemeId | null; return v && EDITOR_THEMES.some((t) => t.id === v) ? v : 'vs-dark' } catch { return 'vs-dark' }
}
const storedFont = (): number => { try { const n = Number(localStorage.getItem(FONT_KEY)); return n >= 10 && n <= 22 ? n : 13 } catch { return 13 } }

export const useEditorTheme = create<{ id: EditorThemeId; theme: EditorTheme; font: number; set: (id: EditorThemeId) => void; setFont: (n: number) => void }>((set) => ({
  id: stored(),
  theme: EDITOR_THEMES.find((t) => t.id === stored())!,
  font: storedFont(),
  set: (id) => { try { localStorage.setItem(KEY, id) } catch { /* private mode */ } set({ id, theme: EDITOR_THEMES.find((t) => t.id === id)! }) },
  setFont: (n) => { try { localStorage.setItem(FONT_KEY, String(n)) } catch { /* private mode */ } set({ font: n }) },
}))

type Rules = Monaco.editor.ITokenThemeRule[]
const rules = (p: { comment: string; keyword: string; string: string; number: string; type: string; fn: string; variable: string; tag: string; attr: string; operator?: string }): Rules => [
  { token: 'comment', foreground: p.comment.slice(1), fontStyle: 'italic' },
  { token: 'keyword', foreground: p.keyword.slice(1) },
  { token: 'string', foreground: p.string.slice(1) },
  { token: 'number', foreground: p.number.slice(1) },
  { token: 'type', foreground: p.type.slice(1) },
  { token: 'type.identifier', foreground: p.type.slice(1) },
  { token: 'identifier', foreground: p.variable.slice(1) },
  { token: 'delimiter', foreground: (p.operator ?? p.variable).slice(1) },
  { token: 'operator', foreground: (p.operator ?? p.variable).slice(1) },
  { token: 'tag', foreground: p.tag.slice(1) },
  { token: 'attribute.name', foreground: p.attr.slice(1) },
  { token: 'attribute.value', foreground: p.string.slice(1) },
  { token: 'metatag', foreground: p.tag.slice(1) },
  { token: 'key', foreground: p.attr.slice(1) },
  { token: 'string.key.json', foreground: p.attr.slice(1) },
  { token: 'string.value.json', foreground: p.string.slice(1) },
  { token: 'regexp', foreground: p.string.slice(1) },
  { token: 'annotation', foreground: p.fn.slice(1) },
]

const DEFS: Partial<Record<EditorThemeId, { base: Monaco.editor.BuiltinTheme; colors: Record<string, string>; rules: Rules }>> = {
  'cursor-dark': { base: 'vs-dark', colors: { 'editor.background': '#181818', 'editor.foreground': '#D6D6DD', 'editorLineNumber.foreground': '#535353', 'editorLineNumber.activeForeground': '#D6D6DD', 'editor.lineHighlightBackground': '#1F1F1F', 'editor.selectionBackground': '#163761', 'editorCursor.foreground': '#AAA0FA', 'editorIndentGuide.background': '#2B2B2B' }, rules: rules({ comment: '#6D6D6D', keyword: '#83D6C5', string: '#E394DC', number: '#EBC88D', type: '#87C3FF', fn: '#EFB080', variable: '#D6D6DD', tag: '#87C3FF', attr: '#AAA0FA', operator: '#D6D6DD' }) },
  'github-dark': { base: 'vs-dark', colors: { 'editor.background': '#0D1117', 'editor.foreground': '#E6EDF3', 'editorLineNumber.foreground': '#6E7681', 'editorLineNumber.activeForeground': '#E6EDF3', 'editor.lineHighlightBackground': '#161B22', 'editor.selectionBackground': '#264F78', 'editorCursor.foreground': '#E6EDF3', 'editorIndentGuide.background': '#21262D' }, rules: rules({ comment: '#8B949E', keyword: '#FF7B72', string: '#A5D6FF', number: '#79C0FF', type: '#FFA657', fn: '#D2A8FF', variable: '#E6EDF3', tag: '#7EE787', attr: '#79C0FF' }) },
  'github-light': { base: 'vs', colors: { 'editor.background': '#FFFFFF', 'editor.foreground': '#1F2328', 'editorLineNumber.foreground': '#8C959F', 'editorLineNumber.activeForeground': '#1F2328', 'editor.lineHighlightBackground': '#F6F8FA', 'editor.selectionBackground': '#ADD6FF', 'editorCursor.foreground': '#1F2328', 'editorIndentGuide.background': '#D1D9E0' }, rules: rules({ comment: '#6E7781', keyword: '#CF222E', string: '#0A3069', number: '#0550AE', type: '#953800', fn: '#8250DF', variable: '#1F2328', tag: '#116329', attr: '#0550AE' }) },
  'one-dark': { base: 'vs-dark', colors: { 'editor.background': '#282C34', 'editor.foreground': '#ABB2BF', 'editorLineNumber.foreground': '#495162', 'editorLineNumber.activeForeground': '#ABB2BF', 'editor.lineHighlightBackground': '#2C313C', 'editor.selectionBackground': '#3E4451', 'editorCursor.foreground': '#528BFF', 'editorIndentGuide.background': '#3B4048' }, rules: rules({ comment: '#5C6370', keyword: '#C678DD', string: '#98C379', number: '#D19A66', type: '#E5C07B', fn: '#61AFEF', variable: '#E06C75', tag: '#E06C75', attr: '#D19A66', operator: '#56B6C2' }) },
  dracula: { base: 'vs-dark', colors: { 'editor.background': '#282A36', 'editor.foreground': '#F8F8F2', 'editorLineNumber.foreground': '#6272A4', 'editorLineNumber.activeForeground': '#F8F8F2', 'editor.lineHighlightBackground': '#44475A', 'editor.selectionBackground': '#44475A', 'editorCursor.foreground': '#F8F8F2', 'editorIndentGuide.background': '#3B3D4D' }, rules: rules({ comment: '#6272A4', keyword: '#FF79C6', string: '#F1FA8C', number: '#BD93F9', type: '#8BE9FD', fn: '#50FA7B', variable: '#F8F8F2', tag: '#FF79C6', attr: '#50FA7B', operator: '#FF79C6' }) },
  monokai: { base: 'vs-dark', colors: { 'editor.background': '#272822', 'editor.foreground': '#F8F8F2', 'editorLineNumber.foreground': '#90908A', 'editorLineNumber.activeForeground': '#F8F8F2', 'editor.lineHighlightBackground': '#3E3D32', 'editor.selectionBackground': '#49483E', 'editorCursor.foreground': '#F8F8F0', 'editorIndentGuide.background': '#3B3A32' }, rules: rules({ comment: '#75715E', keyword: '#F92672', string: '#E6DB74', number: '#AE81FF', type: '#66D9EF', fn: '#A6E22E', variable: '#F8F8F2', tag: '#F92672', attr: '#A6E22E', operator: '#F92672' }) },
  'night-owl': { base: 'vs-dark', colors: { 'editor.background': '#011627', 'editor.foreground': '#D6DEEB', 'editorLineNumber.foreground': '#4B6479', 'editorLineNumber.activeForeground': '#C5E4FD', 'editor.lineHighlightBackground': '#0B2942', 'editor.selectionBackground': '#1D3B53', 'editorCursor.foreground': '#80A4C2', 'editorIndentGuide.background': '#5E81CE52' }, rules: rules({ comment: '#637777', keyword: '#C792EA', string: '#ECC48D', number: '#F78C6C', type: '#FFCB8B', fn: '#82AAFF', variable: '#D6DEEB', tag: '#7FDBCA', attr: '#ADDB67', operator: '#C792EA' }) },
  nord: { base: 'vs-dark', colors: { 'editor.background': '#2E3440', 'editor.foreground': '#D8DEE9', 'editorLineNumber.foreground': '#4C566A', 'editorLineNumber.activeForeground': '#D8DEE9', 'editor.lineHighlightBackground': '#3B4252', 'editor.selectionBackground': '#434C5E', 'editorCursor.foreground': '#D8DEE9', 'editorIndentGuide.background': '#434C5E' }, rules: rules({ comment: '#616E88', keyword: '#81A1C1', string: '#A3BE8C', number: '#B48EAD', type: '#8FBCBB', fn: '#88C0D0', variable: '#D8DEE9', tag: '#81A1C1', attr: '#8FBCBB', operator: '#81A1C1' }) },
  'catppuccin-mocha': { base: 'vs-dark', colors: { 'editor.background': '#1E1E2E', 'editor.foreground': '#CDD6F4', 'editorLineNumber.foreground': '#6C7086', 'editorLineNumber.activeForeground': '#CBA6F7', 'editor.lineHighlightBackground': '#2A2B3C', 'editor.selectionBackground': '#45475A', 'editorCursor.foreground': '#F5E0DC', 'editorIndentGuide.background': '#313244' }, rules: rules({ comment: '#6C7086', keyword: '#CBA6F7', string: '#A6E3A1', number: '#FAB387', type: '#F9E2AF', fn: '#89B4FA', variable: '#CDD6F4', tag: '#89B4FA', attr: '#F9E2AF', operator: '#89DCEB' }) },
  'solarized-dark': { base: 'vs-dark', colors: { 'editor.background': '#002B36', 'editor.foreground': '#839496', 'editorLineNumber.foreground': '#586E75', 'editorLineNumber.activeForeground': '#93A1A1', 'editor.lineHighlightBackground': '#073642', 'editor.selectionBackground': '#274642', 'editorCursor.foreground': '#839496', 'editorIndentGuide.background': '#073642' }, rules: rules({ comment: '#586E75', keyword: '#859900', string: '#2AA198', number: '#D33682', type: '#B58900', fn: '#268BD2', variable: '#839496', tag: '#268BD2', attr: '#93A1A1', operator: '#859900' }) },
  'solarized-light': { base: 'vs', colors: { 'editor.background': '#FDF6E3', 'editor.foreground': '#657B83', 'editorLineNumber.foreground': '#93A1A1', 'editorLineNumber.activeForeground': '#586E75', 'editor.lineHighlightBackground': '#EEE8D5', 'editor.selectionBackground': '#EEE8D5', 'editorCursor.foreground': '#657B83', 'editorIndentGuide.background': '#EEE8D5' }, rules: rules({ comment: '#93A1A1', keyword: '#859900', string: '#2AA198', number: '#D33682', type: '#B58900', fn: '#268BD2', variable: '#657B83', tag: '#268BD2', attr: '#586E75', operator: '#859900' }) },
}

let defined = false
/** Register every custom theme once, on the Monaco instance the editor gives us. */
export function defineEditorThemes(monaco: typeof Monaco) {
  if (defined) return
  defined = true
  for (const [id, d] of Object.entries(DEFS)) monaco.editor.defineTheme(id, { base: d.base, inherit: true, colors: d.colors, rules: d.rules })
}

/** Monaco language id from the file name. */
export function languageOf(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const name = path.split('/').pop()?.toLowerCase() ?? ''
  if (name === 'dockerfile') return 'dockerfile'
  if (name.endsWith('.env') || name.startsWith('.env')) return 'ini'
  return ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', json: 'json', md: 'markdown', mdx: 'markdown', html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less', py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift', c: 'c', h: 'c', cpp: 'cpp', cs: 'csharp', php: 'php', sh: 'shell', bash: 'shell', zsh: 'shell', yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', sql: 'sql', xml: 'xml', svg: 'xml', graphql: 'graphql', gql: 'graphql', vue: 'html', svelte: 'html', prisma: 'graphql', txt: 'plaintext' } as Record<string, string>)[ext] ?? 'plaintext'
}
