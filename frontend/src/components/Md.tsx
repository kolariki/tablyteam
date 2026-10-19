import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'

/** Compact Markdown for chat-sized texts (agent turns, decisions): bold, lists, headings, inline code — sanitised. */
export default function Md({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text ?? '', { async: false, breaks: true }) as string), [text])
  return <div className={`md md-compact ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
