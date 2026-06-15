// Deterministic color assignment for subject abbreviations.
// Same subject always gets the same color across all views.

const PALETTE = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#ec4899', // pink
  '#84cc16', // lime
  '#3b82f6', // blue
  '#d946ef', // fuchsia
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff
  return h
}

export function subjectColor(subject: string): string {
  return PALETTE[hash(subject) % PALETTE.length]!
}

export function subjectBg(subject: string, alpha = 1): string {
  const hex = subjectColor(subject)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function subjectFg(alpha: number): string {
  return alpha > 0.45 ? '#ffffff' : '#374151'
}
