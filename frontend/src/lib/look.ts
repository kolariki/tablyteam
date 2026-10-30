/**
 * The new identity («Equipo», with the dark «Taller» builder), being tried in development only: tablyteam.com keeps the
 * current look until it is decided. In dev a switch (bottom left) compares both; VITE_NEW_LOOK=1 turns it on in a build.
 */
const KEY = 'tably.look'
export const NEW_LOOK_AVAILABLE = import.meta.env.DEV || import.meta.env.VITE_NEW_LOOK === '1'

export function newLookOn(): boolean {
  if (!NEW_LOOK_AVAILABLE) return false
  try { return localStorage.getItem(KEY) !== 'old' } catch { return true }
}

export function setNewLook(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'new' : 'old') } catch { /* private mode */ }
  applyLook()
}

let fontsLoaded = false
/** Puts the identity's class on <html> (the builder's dark one is added by the builder view) and loads its typefaces once. */
export function applyLook() {
  const on = newLookOn()
  document.documentElement.classList.toggle('look-equipo', on)
  if (on && !fontsLoaded) {
    fontsLoaded = true
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..900&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap'
    document.head.appendChild(l)
  }
}

/** The builder screen in the new identity is the dark «Taller» (also for its modals, which mount on <body>). */
export function setBuilderLook(inBuilder: boolean) {
  document.documentElement.classList.toggle('look-taller', inBuilder && newLookOn())
}
