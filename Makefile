TS_RUNTIME ?= node
TS_EXEC_bun   := bun run
TS_EXEC_deno  := deno run -A
TS_EXEC_node  := npx tsx
TS_EXEC       := $(or $(TS_EXEC_$(TS_RUNTIME)),$(TS_RUNTIME))

.PHONY: help dev build check proxy dev-all gen generate-test-token test-auto-login clean setup-certs set-local-admin-sdk reset-local-admin-sdk prepare export

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

prepare: ## Install the pre-commit hook (also runs automatically via `npm install`'s prepare lifecycle)
	@mkdir -p .git/hooks
	@cp -f scripts/pre-commit.sh .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "installed .git/hooks/pre-commit"

dev: ## Run dev server
	NODE_OPTIONS=--disable-warning=DEP0205 npm run dev

build: ## Build for production
	npm run build

export: build ## Bundle build/ into one tracked archive (build.tar.gz) — the raw tree's
	## content-hashed filenames rename on every build, making a committed directory an
	## unreviewable diff; one archive file is a single, reviewable blob instead.
	tar -czf build.tar.gz -C build .
	@echo "wrote build.tar.gz ($$(du -h build.tar.gz | cut -f1))"

check: ## Type-check
	npm run check

proxy: ## Run proxy server (TS_RUNTIME=node|bun|deno)
	$(TS_EXEC) server/server.ts

dev-all: ## Run dev server with proxy (TS_RUNTIME=node|bun|deno)
	NODE_EXTRA_CA_CERTS="$(shell mkcert -CAROOT)/rootCA.pem" NODE_OPTIONS=--disable-warning=DEP0205 npx concurrently "vite dev --host" "$(TS_EXEC) server/server.ts"

gen: ## Generate browser client from SDK
	$(TS_EXEC) gen/browser-client.ts

TOKEN_SUB      ?= test-user
TOKEN_NAME     ?= Test User
TOKEN_EMAIL    ?= test@localhost
TOKEN_ROLE     ?= superadmin
TOKEN_USERNAME ?=
TOKEN_ACCOUNT  ?=

generate-test-token: ## Generate test provider JWT for local dev  (TOKEN_SUB= TOKEN_NAME= TOKEN_EMAIL= TOKEN_ROLE= TOKEN_USERNAME= TOKEN_ACCOUNT=)
	$(TS_EXEC) gen/test-token.ts "$(TOKEN_SUB)" "$(TOKEN_NAME)" "$(TOKEN_EMAIL)" "$(TOKEN_ROLE)" "$(TOKEN_USERNAME)" "$(TOKEN_ACCOUNT)"

OPEN_CMD_Darwin := open
OPEN_CMD_Linux  := xdg-open
OPEN_CMD        := $(or $(OPEN_CMD_$(shell uname -s)),open)

test-auto-login: ## Generate test token and open login URL in browser
	@url="$$($(TS_EXEC) gen/test-token.ts)" && echo "$$url" && read -p "Press Enter to open in browser..." && $(OPEN_CMD) "$$url"

setup-certs: ## Generate mkcert TLS certs for local HTTPS dev (requires: brew install mkcert && mkcert -install)
	@mkdir -p .certs
	mkcert -cert-file .certs/cert.pem -key-file .certs/key.pem local.mountos.io localhost 127.0.0.1

clean: ## Remove build artifacts
	rm -rf .svelte-kit build node_modules

SDK_PATH := $(realpath $(or $(MOUNTOS_ADMIN_TS_SDK_PATH),../mountos-admin-sdk/ts))

set-local-admin-sdk: ## Point @mountos-io/admin-sdk to local file: path for dev
	@if [ ! -d "$(SDK_PATH)" ]; then echo "error: SDK path not found: $(SDK_PATH)" >&2; exit 1; fi
	@jq --arg p "file:$(SDK_PATH)" '.dependencies["@mountos-io/admin-sdk"] = $$p' package.json > package.json.tmp && mv package.json.tmp package.json
	@echo "set @mountos-io/admin-sdk → file:$(SDK_PATH)"
	@$(MAKE) prepare

reset-local-admin-sdk: ## Revert @mountos-io/admin-sdk to ^<npm latest>
	$(eval LATEST := $(shell npm view @mountos-io/admin-sdk version))
	@if [ -z "$(LATEST)" ]; then echo "error: failed to fetch latest version from npm" >&2; exit 1; fi
	@jq --arg v "^$(LATEST)" '.dependencies["@mountos-io/admin-sdk"] = $$v' package.json > package.json.tmp && mv package.json.tmp package.json
	@echo "reset @mountos-io/admin-sdk → ^$(LATEST)"
