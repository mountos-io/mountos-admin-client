import * as jose from 'jose'

const raw = process.env.VENDOR2DASHBOARD_SIGNING_KEY
if (!raw) {
  console.error('VENDOR2DASHBOARD_SIGNING_KEY env var is required')
  process.exit(1)
}

const seed = Buffer.from(raw, 'base64')
const pem = toPkcs8Pem(seed)
const privateKey = await jose.importPKCS8(pem, 'EdDSA')

const sub = process.argv[2] ?? 'test-user'
const name = process.argv[3] ?? 'Test User'
const email = process.argv[4] ?? 'test@localhost'

const token = await new jose.SignJWT({ name, email })
  .setProtectedHeader({ alg: 'EdDSA' })
  .setSubject(sub)
  .setAudience('mountos/dashboard')
  .setIssuedAt()
  .setExpirationTime('60s')
  .sign(privateKey)

// Derive public key for VENDOR2DASHBOARD_VERIFICATION_KEY
const pubJwk = await jose.exportJWK(await jose.importPKCS8(pem, 'EdDSA'))
const pubBytes = Buffer.from(pubJwk.x!, 'base64url')
console.log('VENDOR2DASHBOARD_VERIFICATION_KEY:', pubBytes.toString('base64'))
console.log()
console.log('Token:', token)
console.log()
console.log(`URL: http://localhost:5173/?token=${token}`)

function toPkcs8Pem(seed: Buffer): string {
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex')
  const der = Buffer.concat([prefix, seed])
  return `-----BEGIN PRIVATE KEY-----\n${der.toString('base64')}\n-----END PRIVATE KEY-----`
}
