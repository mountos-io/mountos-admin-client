.PHONY: help dev build check proxy dev-all gen clean

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
	bun run gen/browser-client.ts

clean: ## Remove build artifacts
	rm -rf .svelte-kit build node_modules
