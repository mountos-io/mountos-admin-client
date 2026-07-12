// Consolidates the license notices of the third-party packages bundled into the
// client into static/THIRD-PARTY-NOTICES.txt (served at /THIRD-PARTY-NOTICES.txt).
// Runs before the build so the file is a static asset that both the prerenderer
// and the adapter pick up, while the JS still ships comment-free
// (vite.config legalComments: 'none').
//
// Bundled packages are discovered from the bare imports under src/ plus the
// framework runtime, so the set stays in step with the code with no hand list.
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const NM = join(ROOT, 'node_modules')
const OUT = join(ROOT, 'static', 'THIRD-PARTY-NOTICES.txt')

// Framework runtime that is always in the client bundle but reached through
// aliases ($app, $lib) rather than bare imports, so it is added explicitly.
const FRAMEWORK = ['svelte', '@sveltejs/kit']

function pkgRoot(spec: string): string {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

// Third-party package roots imported anywhere under src/ (skips relative paths,
// $-aliases, and node: builtins).
function collectImports(dir: string, found: Set<string>) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectImports(p, found)
    } else if (/\.(svelte|ts|js)$/.test(entry.name)) {
      // Drop type-only import/export statements: their code is erased at build
      // time, so the package is never in the shipped bundle.
      const code = readFileSync(p, 'utf8').replace(
        /\b(?:import|export)\s+type\s+[^;'"]*?from\s*['"][^'"]+['"]/g,
        '',
      )
      for (const m of code.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
        const spec = m[1]
        if (/^[.$/]/.test(spec) || spec.startsWith('node:')) continue
        found.add(pkgRoot(spec))
      }
    }
  }
}

function readPkg(name: string): { version?: string; license?: string; homepage?: string } | null {
  const pj = join(NM, name, 'package.json')
  if (!existsSync(pj)) return null
  try {
    return JSON.parse(readFileSync(pj, 'utf8'))
  } catch {
    return null
  }
}

function licenseText(name: string): string | null {
  const dir = join(NM, name)
  if (!existsSync(dir)) return null
  for (const f of readdirSync(dir)) {
    if (/^licen[cs]e/i.test(f) && statSync(join(dir, f)).isFile()) {
      return readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n').trim()
    }
  }
  return null
}

const imported = new Set<string>()
collectImports(SRC, imported)
for (const f of FRAMEWORK) imported.add(f)

const names = [...imported]
  .filter((n) => !n.startsWith('@mountos-io/')) // first-party, not a third-party notice
  .filter((n) => existsSync(join(NM, n)))
  .sort()

const blocks: string[] = []
const missing: string[] = []
for (const name of names) {
  const meta = readPkg(name)
  const text = licenseText(name)
  const version = meta?.version ? `@${meta.version}` : ''
  const spdx = meta?.license ? ` (${meta.license})` : ''
  const home = meta?.homepage ? `\n${meta.homepage}` : ''
  if (text) {
    blocks.push(
      `${'='.repeat(80)}\n${name}${version}${spdx}${home}\n${'-'.repeat(80)}\n${text}\n`,
    )
  } else {
    missing.push(name)
    blocks.push(`${'='.repeat(80)}\n${name}${version}${spdx}${home}\n(license text not found in package)\n`)
  }
}

const selfName = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).name
const header =
  `${selfName} — Third-Party Software Notices\n\n` +
  'This build bundles the open-source packages listed below. Their license\n' +
  'notices are reproduced in full. Generated from node_modules at build time.\n\n'

writeFileSync(OUT, header + blocks.join('\n') + '\n')
console.log(`[gen-notices] wrote ${names.length} package notices to static/THIRD-PARTY-NOTICES.txt`)
if (missing.length) console.log(`[gen-notices] note: no license file found for ${missing.join(', ')}`)
