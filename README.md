# mountOS Admin Client

SvelteKit admin dashboard for mountOS.

## Setup

```sh
npm install
make dev
```

Use `make dev-all` to start both the dev server and the proxy server.

## `build.tar.gz` is committed

The production SvelteKit build is committed as a single bundled archive, `build.tar.gz`
(`make export` = `make build` + tar), not as the raw `build/` tree — content-hashed
filenames rename on every build, so a tracked directory would make every commit's diff
enormous and unreviewable. One archive file is one reviewable blob instead.

This lets a quick check or a deploy (e.g. cloud-init on a small instance) skip the build
step entirely — `tar xzf build.tar.gz -C build && npm install --omit=dev && npm run proxy`
— which matters because the build itself (vite/esbuild's SSR bundling) needs more memory
than a small instance may have.

It's kept in sync automatically: the pre-commit hook (`scripts/pre-commit.sh`, installed
via `npm install`'s `prepare` script, or `make prepare`) runs `make export` on every commit
and blocks the commit if the build itself fails.

## Authentication

3-layer Ed25519 JWT auth:

```
Provider ──[ephemeral JWT 30-60s]──► Dashboard ──[session JWT 24h]──► Browser
                                   Dashboard ──[service JWT]──► Appserv
```

### Required Environment Variables

| Variable | Description | How to obtain |
|----------|-------------|---------------|
| `PROVIDER2DASHBOARD_VERIFICATION_KEY` | Ed25519 public key (base64, 32 bytes) for verifying Provider ephemeral tokens | Provided by the Provider. The Provider generates an Ed25519 key pair and shares the public key. |
| `DASHBOARD_SIGNING_KEY` | Ed25519 private seed (base64, 32 bytes) for signing session/refresh tokens | Generate with `openssl genpkey -algorithm ed25519 -outform DER \| tail -c 32 \| base64`. Store in vault. |
| `DASHBOARD_VERIFICATION_KEY` | Ed25519 public key (base64, 32 bytes) for verifying session/refresh tokens | Derive from signing key: `openssl pkey -in <private.pem> -pubout -outform DER \| tail -c 32 \| base64`. Store in vault. |
| `MOUNTOS_APPSERV_URL` | Appserv base URL for API proxying and SDK calls | Deployment-specific (e.g., `https://appserv.example.com`) |
| `MOUNTOS_SDK_SIGNING_KEY` | Ed25519 private key (base64, 32 or 64 bytes) the admin server signs its appserv-bound service JWT with | Generate an Ed25519 key pair; register the public half with appserv. Store in vault. |
| `REDIS_URL` | Redis connection string for session/refresh token storage | Deployment-specific (e.g., `redis://localhost:6379`) |
| `DASHBOARD_USER_HMAC_KEY` | HMAC secret for signing the `X-MountOS-Dashboard-User` header sent to appserv | Must match appserv's own `DASHBOARD_USER_HMAC_KEY`. Store in vault. |

All 7 are required; the server exits on startup if any are missing (`DASHBOARD_USER_HMAC_KEY` is checked separately, at proxy module load).

Provider bootstrap (`src/provider/server/bootstrap.ts`) runs before env validation, allowing providers to load secrets from vault or other sources.

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port the admin server listens on | `3001` |
| `NODE_ENV` | When set to `development`, session/refresh cookies are issued without the `secure` flag | unset (cookies are `secure`) |
| `WEBAUTHN_RP_ID` | WebAuthn relying party ID | `local.mountos.io` if `.certs/cert.pem` exists, else `localhost` |
| `WEBAUTHN_RP_NAME` | WebAuthn relying party display name | `mountOS Dashboard` |
| `WEBAUTHN_ORIGIN` | Expected WebAuthn origin (trailing slashes stripped) | `https://<rpId>:5173` if local certs exist, else `http://localhost:5173` |
| `MOUNTOS_DIST_URL` | Base URL to check for available mountOS release builds | `https://mountos.sh/install` |
| `MOUNTOS_UPDATE_CHECK` | Set to `off` to disable the release update check | update check enabled |
| `PROVIDER2DASHBOARD_SIGNING_KEY` | Ed25519 private seed (base64) used only by `make generate-test-token` to mint a Provider ephemeral token for local testing | none; required for that script only |

### Test Token Generation

```sh
export PROVIDER2DASHBOARD_SIGNING_KEY=<base64-ed25519-private-seed>
make generate-test-token
# Prints: PROVIDER2DASHBOARD_VERIFICATION_KEY, token, and login URL
```

Pass custom user details: `bun run gen/test-token.ts <sub> <name> <email>`

## Code Generation

The browser API client (`src/lib/core/api/client.gen.ts`) is generated from the
`api.yaml` spec bundled in `@mountos-io/admin-sdk`.

```sh
make gen                      # default: bun
make gen TS_RUNTIME=node      # uses npx tsx
make gen TS_RUNTIME=deno      # uses deno run -A
```

## Available Targets

Run `make` to list all targets.
