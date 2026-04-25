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
  server: {
    host: 'local.mountos.app',
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
