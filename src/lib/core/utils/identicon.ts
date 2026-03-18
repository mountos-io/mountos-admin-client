const GRID = 5
const HALF = Math.ceil(GRID / 2)
const COLORS = [
  '#c9564b', '#c47835', '#b89a2e', '#3ba86e', '#2e9e8a',
  '#3d8abf', '#8b5fa0', '#b84e72', '#2e9eb5', '#7a9e42',
  '#c48228', '#7d6054', '#6b7e8a', '#6e52a3', '#2e8a7d',
]

function hash(n: number): number {
  let h = (n * 2654435761) >>> 0
  h = ((h >>> 16) ^ h) * 0x45d9f3b >>> 0
  h = ((h >>> 16) ^ h) >>> 0
  return h
}

export function generateIdenticon(id: number, size = 64): string {
  const h = hash(id)
  const color = COLORS[h % COLORS.length]!
  const cell = size / GRID

  let rects = ''
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < HALF; col++) {
      const bit = (h >>> ((row * HALF + col) % 30)) & 1
      if (!bit) continue
      const x1 = col * cell
      const x2 = (GRID - 1 - col) * cell
      rects += `<rect x="${x1}" y="${row * cell}" width="${cell}" height="${cell}" fill="${color}"/>`
      if (col !== GRID - 1 - col) {
        rects += `<rect x="${x2}" y="${row * cell}" width="${cell}" height="${cell}" fill="${color}"/>`
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${rects}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
