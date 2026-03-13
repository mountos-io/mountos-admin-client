# mountOS Admin Client

SvelteKit admin dashboard for mountOS.

## Setup

```sh
npm install
make dev
```

Use `make dev-all` to start both the dev server and the proxy server.

## Code Generation

The browser API client (`src/lib/core/api/client.gen.ts`) is generated from the
`api.yaml` spec bundled in `@mountos-app/admin-sdk`.

```sh
make gen                      # default: bun
make gen TS_RUNTIME=node      # uses npx tsx
make gen TS_RUNTIME=deno      # uses deno run -A
```

## Available Targets

Run `make` to list all targets.
