// Deterministic goal -> color, so the same goal always renders the same
// color across renders/sessions and across the density/detail worker-event
// charts, without a curated lookup table -- gcserv goals are an open set.
function hashStr(s: string, seed: number): number {
  let h = seed
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function hueFor(goal: string): number {
  return hashStr(goal, 0) % 360
}

export function colorFor(goal: string): string {
  return `oklch(0.62 0.15 ${hueFor(goal)})`
}
