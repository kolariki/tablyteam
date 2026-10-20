import Editor, { loader, type OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker'
import { Check, ChevronDown, Loader2, Minus, Plus, RotateCcw, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EDITOR_THEMES, defineEditorThemes, languageOf, useEditorTheme } from '../lib/editorThemes'
import { useT } from '../lib/i18n'

// Monaco bundled with the app (no CDN): each language service runs in its own worker
;(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  },
}
loader.config({ monaco })
// the built code is not the app's own: no red squiggles for missing imports, the real checks run in the build itself
monaco.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false })
monaco.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false })

/**
 * The code pane as a real editor: Monaco (what VS Code and Cursor run on) with the user's favourite IDE skin,
 * editable, Cmd/Ctrl+S saves back into the build. While the builder is still writing the file it stays read-only
 * and follows the stream.
 */
export default function CodeEditor({ path, content, live, readOnly, onSave }: { path: string; content: string; live: boolean; readOnly?: boolean; onSave: (content: string) => Promise<void> }) {
  const T = useT()
  const { id, theme, font, set, setFont } = useEditorTheme()
  const [draft, setDraft] = useState(content)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [pick, setPick] = useState(false)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const dirty = draft !== content && !live

  // a new file, or the builder rewriting the one on screen: show what came in (the user's unsaved draft is replaced)
  useEffect(() => { setDraft(content) }, [path, content])
  // follow the stream: keep the last written line in view
  useEffect(() => {
    if (!live || !editorRef.current) return
    const m = editorRef.current.getModel()
    if (m) editorRef.current.revealLine(m.getLineCount())
  }, [live, content.length])

  const save = async () => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      await onSave(draft)
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }
  const saveRef = useRef(save)
  saveRef.current = save

  const onMount: OnMount = (editor, m) => {
    editorRef.current = editor
    defineEditorThemes(m)
    m.editor.setTheme(id)
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => { void saveRef.current() })
  }
  useEffect(() => { if (editorRef.current) monaco.editor.setTheme(id) }, [id])

  const dark = theme.dark
  const bar = dark ? 'border-white/10 bg-white/[0.03] text-[#B9C4BE]' : 'border-black/10 bg-black/[0.03] text-ink-2'
  const btn = dark ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-black/5 hover:text-ink'

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ background: theme.bg }}>
      {/* editor toolbar */}
      <div className={`flex h-9 shrink-0 items-center gap-1 border-b px-2 text-[12px] ${bar}`}>
        <div className="relative">
          <button onClick={() => setPick((v) => !v)} className={`flex h-7 items-center gap-1.5 rounded-md px-2 transition ${btn}`} title={T('Tema del editor', 'Editor theme')}>
            <span className="h-3 w-3 rounded-sm border border-white/20" style={{ background: theme.bg, boxShadow: `inset 0 0 0 1px ${theme.accent}` }} />
            <span className="font-medium">{theme.label}</span><span className="opacity-60">· {theme.ide}</span>
            <ChevronDown size={12} className={`transition ${pick ? 'rotate-180' : ''}`} />
          </button>
          {pick && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPick(false)} />
              <div className="absolute left-0 top-8 z-20 w-64 overflow-hidden rounded-xl border border-line bg-surface p-1 text-ink shadow-[0_18px_40px_-18px_rgba(30,38,34,.55)]">
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-ink-3">{T('Cómo se ve tu IDE', 'The look of your IDE')}</div>
                <div className="max-h-80 overflow-y-auto scroll-thin">
                  {EDITOR_THEMES.map((t) => (
                    <button key={t.id} onClick={() => { set(t.id); setPick(false) }} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition hover:bg-surface-2 ${t.id === id ? 'bg-accent-soft text-accent' : ''}`}>
                      <span className="flex h-6 w-9 shrink-0 items-center justify-center rounded-md border border-line font-mono text-[9px]" style={{ background: t.bg, color: t.accent }}>{'{ }'}</span>
                      <span className="min-w-0 flex-1"><span className="font-medium">{t.label}</span><span className="ml-1 text-ink-3">· {t.ide}</span></span>
                      {t.id === id && <Check size={13} />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <span className={`mx-1 h-4 w-px ${dark ? 'bg-white/10' : 'bg-black/10'}`} />
        <button onClick={() => setFont(Math.max(10, font - 1))} className={`rounded-md p-1 transition ${btn}`} title={T('Letra más chica', 'Smaller font')}><Minus size={12} /></button>
        <span className="w-6 text-center font-mono text-[11px]">{font}</span>
        <button onClick={() => setFont(Math.min(22, font + 1))} className={`rounded-md p-1 transition ${btn}`} title={T('Letra más grande', 'Larger font')}><Plus size={12} /></button>
        <span className="ml-3 truncate font-mono opacity-80">{path}</span>
        {live && <span className="ml-2 text-[10px] font-bold text-[#8FD3B0] animate-pulse">{T('● escribiendo', '● writing')}</span>}
        <div className="ml-auto flex items-center gap-1">
          {dirty && <button onClick={() => setDraft(content)} className={`flex items-center gap-1 rounded-md px-2 py-1 transition ${btn}`} title={T('Descartar cambios', 'Discard changes')}><RotateCcw size={12} /> {T('descartar', 'discard')}</button>}
          {dirty ? (
            <button onClick={save} disabled={saving || !!readOnly} className="flex h-7 items-center gap-1.5 rounded-full bg-accent px-3 text-[12px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {T('Guardar', 'Save')} <kbd className="rounded bg-white/20 px-1 font-mono text-[10px]">⌘S</kbd>
            </button>
          ) : savedAt && Date.now() - savedAt < 4000 ? (
            <span className="flex items-center gap-1 text-[11.5px] text-[#8FD3B0]"><Check size={12} /> {T('guardado', 'saved')}</span>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          path={path}
          language={languageOf(path)}
          value={draft}
          theme={id}
          onMount={onMount}
          onChange={(v) => setDraft(v ?? '')}
          loading={<div className="flex h-full items-center justify-center gap-2 text-sm opacity-60"><Loader2 size={16} className="animate-spin" /> {T('Cargando el editor…', 'Loading the editor…')}</div>}
          options={{
            readOnly: live || !!readOnly,
            fontSize: font,
            fontFamily: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
            fontLigatures: true,
            lineHeight: Math.round(font * 1.6),
            minimap: { enabled: true, renderCharacters: false, maxColumn: 80 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'all',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            padding: { top: 12, bottom: 24 },
            tabSize: 2,
            wordWrap: 'off',
            automaticLayout: true,
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            stickyScroll: { enabled: true },
          }}
        />
      </div>
    </div>
  )
}
