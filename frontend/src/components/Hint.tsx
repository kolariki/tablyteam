import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** A real tooltip (hover, focus or click) for a "?" badge: works on touch and keyboard, unlike the native title. */
export default function Hint({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const open = () => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 6, left: Math.min(Math.max(8, r.left - 120), window.innerWidth - 300) })
    setShow(true)
  }
  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        role="button"
        aria-label={text}
        onMouseEnter={open}
        onMouseLeave={() => setShow(false)}
        onFocus={open}
        onBlur={() => setShow(false)}
        onClick={(e) => { e.preventDefault(); show ? setShow(false) : open() }}
        className={`inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border text-[9px] font-bold normal-case tracking-normal ${show ? 'border-accent text-accent' : 'border-ink-4 text-ink-3'}`}
      >?</span>
      {show && createPortal(
        <div role="tooltip" style={{ position: 'fixed', top: pos.top, left: pos.left }} className="z-[300] w-[290px] rounded-lg border border-line bg-ink px-3 py-2 text-[12px] font-normal normal-case leading-snug tracking-normal text-paper shadow-lg pointer-events-none">{text}</div>,
        document.body,
      )}
    </>
  )
}
