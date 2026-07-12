import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'

const certDir = '.certs'
const loadCerts = async () => {
  const mod = `node:fs`
  const fs: any = await import(/* @vite-ignore */ mod)
  if (!fs.existsSync(`${certDir}/cert.pem`)) return undefined
  return { cert: fs.readFileSync(`${certDir}/cert.pem`), key: fs.readFileSync(`${certDir}/key.pem`) }
}

export default defineConfig(async () => ({
  plugins: [tailwindcss(), sveltekit()],
  // Drop third-party @license comment blocks from the minified client JS. The
  // notices are consolidated into build/THIRD-PARTY-NOTICES.txt at build time.
  esbuild: {
    legalComments: 'none' as const,
  },
  server: {
    host: 'local.mountos.io',
    port: 5173,
    strictPort: true,
    https: await loadCerts(),
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
}))
