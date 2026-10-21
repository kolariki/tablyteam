/** Wall-clock durations for people: "05:17" under an hour, "1h 12m" above, "2d 3h" for very long ones. */
export const fmtDur = (sec: number | null | undefined): string => {
  const s = Math.max(0, Math.round(sec ?? 0))
  if (s < 3600) return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const h = Math.floor(s / 3600)
  if (h < 48) return `${h}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}
