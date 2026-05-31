# mountOS Admin Client

SvelteKit admin dashboard for mountOS.

## Setup

```sh
npm install
make dev
```

Use `make dev-all` to start both the dev server and the proxy server.

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
| `MOUNTOS_APPSERV_URL` | Appserv base URL for API proxying | Deployment-specific (e.g., `https://appserv.example.com`) |

All 4 are required; the server exits on startup if any are missing.

Provider bootstrap (`src/provider/server/bootstrap.ts`) runs before env validation, allowing providers to load secrets from vault or other sources.

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
