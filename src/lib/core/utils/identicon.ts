const GRID = 5
const HALF = Math.ceil(GRID / 2)
const COLORS = [
  'oklch(0.598 0.149 27.9)', 'oklch(0.642 0.125 58.8)', 'oklch(0.695 0.126 92.8)',
  'oklch(0.654 0.132 156.3)', 'oklch(0.632 0.103 178.2)', 'oklch(0.609 0.110 241.9)',
  'oklch(0.557 0.109 314.3)', 'oklch(0.571 0.141 1.4)', 'oklch(0.648 0.102 214.8)',
  'oklch(0.652 0.127 127.5)', 'oklch(0.660 0.129 69.5)', 'oklch(0.515 0.042 43.6)',
  'oklch(0.582 0.029 235.7)', 'oklch(0.505 0.127 297.6)', 'oklch(0.576 0.088 182.0)',
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
