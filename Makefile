.PHONY: dev build check proxy dev-all gen clean

dev:
	npm run dev

build:
	npm run build

check:
	npm run check

proxy:
	npm run proxy

dev-all:
	npm run dev:all

gen:
	cd ../mountos-admin-sdk && make gen-browser

clean:
	rm -rf .svelte-kit build node_modules
