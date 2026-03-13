import * as jose from 'jose'

const raw = process.env.VENDOR2DASHBOARD_SIGNING_KEY
if (!raw) {
  console.error('VENDOR2DASHBOARD_SIGNING_KEY env var is required')
  process.exit(1)
}

const seed = Buffer.from(raw, 'base64')
const pkcs8Der = Buffer.concat([
  Buffer.from('302e020100300506032b657004220420', 'hex'),
  seed,
])

// Import as extractable so we can derive the public key
const privateKey = await crypto.subtle.importKey(
  'pkcs8', pkcs8Der, { name: 'Ed25519' }, true, ['sign'],
)

const sub = process.argv[2] ?? 'test-user'
const name = process.argv[3] ?? 'Test User'
const email = process.argv[4] ?? 'test@localhost'
const role = process.argv[5] ?? 'superadmin'

const token = await new jose.SignJWT({ name, email, role })
  .setProtectedHeader({ alg: 'EdDSA' })
  .setSubject(sub)
  .setAudience('mountos/dashboard')
  .setIssuedAt()
  .setExpirationTime('60s')
  .sign(privateKey)

console.log(`http://localhost:5173?token=${token}`)
