TS_RUNTIME ?= bun
TS_EXEC_bun   := bun run
TS_EXEC_deno  := deno run -A
TS_EXEC_node  := npx tsx
TS_EXEC       := $(or $(TS_EXEC_$(TS_RUNTIME)),$(TS_RUNTIME))

.PHONY: help dev build check proxy dev-all gen generate-test-token clean

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

clean: ## Remove build artifacts
	rm -rf .svelte-kit build node_modules
