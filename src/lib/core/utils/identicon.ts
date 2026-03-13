const GRID = 5
const HALF = Math.ceil(GRID / 2)
const COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e91e63', '#00bcd4', '#8bc34a',
  '#ff9800', '#795548', '#607d8b', '#673ab7', '#009688',
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

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#f0f0f0"/>${rects}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
