/**
 * Motion for the public pages (landing, login): GSAP 3.15 with the plugins that became free in 3.13 — SplitText for
 * the hero title, ScrollTrigger for the cards, DrawSVG for the handoff lines. Framer Motion stays for the small
 * in-app transitions; GSAP drives the "first impression" choreography because it sequences hundreds of targets
 * on one timeline with easings a CSS transition cannot do.
 */
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin)

export { gsap, useGSAP, ScrollTrigger, SplitText }

const splits = new WeakMap<HTMLElement, SplitText>()

export const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Hero choreography: the title arrives word by word, then the paragraph, the buttons, the logos; the demo frame
 * swings in from a slight 3D angle. Returns the timeline so the caller can scope-kill it. */
export function heroIntro(root: HTMLElement) {
  if (reduced()) return null
  const title = root.querySelector<HTMLElement>('[data-hero-title]')
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
  if (title) {
    // React StrictMode mounts twice in dev: undo a previous split before splitting again, or the chars nest
    splits.get(title)?.revert()
    const split = SplitText.create(title, { type: 'words,chars', charsClass: 'hero-char' })
    splits.set(title, split)
    gsap.set(title, { opacity: 1 })
    tl.from(split.chars, { yPercent: 110, opacity: 0, rotateX: -40, filter: 'blur(8px)', duration: 0.9, stagger: { each: 0.018, from: 'start' } }, 0.1)
  }
  tl.from(root.querySelectorAll('[data-hero-kicker]'), { y: 10, opacity: 0, duration: 0.6 }, 0)
    .from(root.querySelectorAll('[data-hero-copy]'), { y: 18, opacity: 0, filter: 'blur(6px)', duration: 0.8 }, 0.55)
    .from(root.querySelectorAll('[data-hero-cta]'), { y: 16, opacity: 0, scale: 0.96, duration: 0.6, stagger: 0.08 }, 0.8)
    .from(root.querySelectorAll('[data-hero-logo]'), { y: 10, opacity: 0, scale: 0.6, duration: 0.5, stagger: 0.05, ease: 'back.out(2)' }, 0.95)
    // the demo frame rises into place (no rotation, no blur: transform + opacity only, so it never stutters)
    .from(root.querySelectorAll('[data-hero-demo]'), { opacity: 0, y: 36, scale: 0.97, duration: 1.0, ease: 'power3.out', force3D: true, clearProps: 'transform' }, 0.3)
  return tl
}

/** Cards and sections below the fold reveal as they scroll into view. */
export function scrollReveal(root: HTMLElement) {
  if (reduced()) return
  gsap.utils.toArray<HTMLElement>(root.querySelectorAll('[data-scroll-reveal]')).forEach((el, i) => {
    gsap.from(el, { y: 36, opacity: 0, filter: 'blur(6px)', duration: 0.9, ease: 'power3.out', delay: (i % 3) * 0.08, scrollTrigger: { trigger: el, start: 'top 88%', once: true } })
  })
}

/** One demo scene just mounted: its marked pieces cascade in, and any marked SVG path draws itself. */
export function sceneIn(root: HTMLElement) {
  if (reduced()) return
  const items = root.querySelectorAll('[data-r]')
  if (items.length) gsap.from(items, { y: 14, opacity: 0, filter: 'blur(5px)', duration: 0.55, ease: 'power3.out', stagger: 0.06, delay: 0.15, clearProps: 'filter' })
  const paths = root.querySelectorAll('[data-draw]')
  if (paths.length) gsap.from(paths, { drawSVG: '0%', duration: 1.1, ease: 'power2.inOut', stagger: 0.1, delay: 0.3 })
}

/** A number that counts up (used for the readiness gauge and the stat tiles). */
export function countTo(el: HTMLElement, to: number, suffix = '', duration = 1.1) {
  if (reduced()) { el.textContent = `${to}${suffix}`; return }
  const o = { v: 0 }
  gsap.to(o, { v: to, duration, ease: 'power2.out', onUpdate: () => { el.textContent = `${Math.round(o.v)}${suffix}` } })
}
