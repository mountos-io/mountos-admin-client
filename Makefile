TS_RUNTIME ?= bun
TS_EXEC_bun   := bun run
TS_EXEC_deno  := deno run -A
TS_EXEC_node  := npx tsx
TS_EXEC       := $(or $(TS_EXEC_$(TS_RUNTIME)),$(TS_RUNTIME))

.PHONY: help dev build check proxy dev-all gen generate-test-token test-auto-login clean set-local-admin-sdk reset-local-admin-sdk

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

dev: ## Run dev server
	npm run dev

build: ## Build for production
	npm run build

check: ## Type-check
	npm run check

proxy: ## Run proxy server
	npm run proxy

dev-all: ## Run dev server with proxy
	npm run dev:all

gen: ## Generate browser client from SDK
	$(TS_EXEC) gen/browser-client.ts

generate-test-token: ## Generate test vendor JWT for local dev
	$(TS_EXEC) gen/test-token.ts

OPEN_CMD_Darwin := open
OPEN_CMD_Linux  := xdg-open
OPEN_CMD        := $(or $(OPEN_CMD_$(shell uname -s)),open)

test-auto-login: ## Generate test token and open login URL in browser
	@url="$$($(TS_EXEC) gen/test-token.ts)" && echo "$$url" && read -p "Press Enter to open in browser..." && $(OPEN_CMD) "$$url"

clean: ## Remove build artifacts
	rm -rf .svelte-kit build node_modules

SDK_PATH := $(realpath $(or $(MOUNTOS_ADMIN_TS_SDK_PATH),../mountos-admin-sdk/ts))

set-local-admin-sdk: ## Point @mountos-app/admin-sdk to local file: path for dev
	@if [ ! -d "$(SDK_PATH)" ]; then echo "error: SDK path not found: $(SDK_PATH)" >&2; exit 1; fi
	@jq --arg p "file:$(SDK_PATH)" '.dependencies["@mountos-app/admin-sdk"] = $$p' package.json > package.json.tmp && mv package.json.tmp package.json
	@echo "set @mountos-app/admin-sdk → file:$(SDK_PATH)"
	@cp -f scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
	@echo "installed pre-commit hook"

reset-local-admin-sdk: ## Revert @mountos-app/admin-sdk to ^<npm latest>
	$(eval LATEST := $(shell npm view @mountos-app/admin-sdk version))
	@if [ -z "$(LATEST)" ]; then echo "error: failed to fetch latest version from npm" >&2; exit 1; fi
	@jq --arg v "^$(LATEST)" '.dependencies["@mountos-app/admin-sdk"] = $$v' package.json > package.json.tmp && mv package.json.tmp package.json
	@echo "reset @mountos-app/admin-sdk → ^$(LATEST)"
