import * as jose from 'jose'

const raw = process.env.PROVIDER2DASHBOARD_SIGNING_KEY
if (!raw) {
  console.error('PROVIDER2DASHBOARD_SIGNING_KEY env var is required')
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

// make generate-test-token TOKEN_SUB="user_1" TOKEN_NAME="Jadon Richard" TOKEN_EMAIL=jadon@mountos.app TOKEN_ROLE=user TOKEN_USERNAME=jadon2024 TOKEN_ACCOUNT=2

// sub can be external user id
const sub        = process.argv[2] ?? 'test-user'
const name       = process.argv[3] ?? 'Test User'
const email      = process.argv[4] ?? 'test@localhost'
const role       = process.argv[5] ?? 'superadmin'
const username   = process.argv[6]   // required for role=user
const account_id = process.argv[7]   // required for role=user

if (role === 'user' && (!username || !account_id)) {
  console.error('role=user requires TOKEN_USERNAME and TOKEN_ACCOUNT_ID')
  process.exit(1)
}

const claims: Record<string, string> = { name, email, role }
if (username)   claims.username   = username
if (account_id) claims.account_id = account_id

const token = await new jose.SignJWT(claims)
  .setProtectedHeader({ alg: 'EdDSA' })
  .setSubject(sub)
  .setAudience('mountos/dashboard')
  .setIssuedAt()
  .setExpirationTime('60s')
  .sign(privateKey)

const origin = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:5173'
console.log(`${origin}?token=${token}`)
