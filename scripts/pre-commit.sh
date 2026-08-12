#!/usr/bin/env bash
set -euo pipefail

PKG="@mountos-io/admin-sdk"

# Guards against a local dev override (make set-local-admin-sdk) leaking into
# a commit — checks package.json AND both lockfiles, not just package.json.
# A lockfile can carry a stale local-path resolution in its deeper
# "packages"/resolved-tree section even after package.json itself looks
# correct (an incremental `npm install --package-lock-only` update over an
# already-local-linked lockfile does NOT re-derive that deeper entry) — this
# exact gap let a broken package-lock.json reach main once already.
staged="$(git diff --cached --name-only)"

if grep -qx 'package.json' <<<"$staged"; then
  sdk_val=$(git show :package.json | jq -r ".dependencies[\"$PKG\"] // empty")
  case "$sdk_val" in
    file:*)
      make reset-local-admin-sdk
      git add package.json
      ;;
  esac
fi

lockfile_dirty=0
# Captured into variables first, not `git show ... | grep -q ...`: grep -q
# exits on its first match, which can SIGPIPE a still-writing `git show` on a
# file this size — under `set -o pipefail` that makes the whole pipeline
# report failure even though grep DID match, silently defeating this exact
# check. (Caught by testing the hook directly, not just eyeballing it.)
pkg_lock_content="$(git show :package-lock.json 2>/dev/null || true)"
bun_lock_content="$(git show :bun.lock 2>/dev/null || true)"
if grep -q '"resolved": *"\.\./mountos-admin-sdk' <<<"$pkg_lock_content"; then
  lockfile_dirty=1
fi
if grep -q "$PKG@file:" <<<"$bun_lock_content"; then
  lockfile_dirty=1
fi

if [ "$lockfile_dirty" = "1" ]; then
  echo "pre-commit: staged lockfile still resolves $PKG to a local path — regenerating" >&2
  rm -rf node_modules/@mountos-io/admin-sdk
  rm -f package-lock.json
  npm install >/dev/null
  command -v bun >/dev/null 2>&1 && bun install --lockfile-only --save-text-lockfile >/dev/null 2>&1
  # Hard-fail rather than silently commit a still-broken lockfile.
  if grep -q '"resolved": *"\.\./mountos-admin-sdk' package-lock.json 2>/dev/null; then
    echo "pre-commit: package-lock.json STILL resolves $PKG to a local path after regeneration — fix manually" >&2
    exit 1
  fi
  git add package-lock.json bun.lock
fi

# build.tar.gz is committed on purpose (see .gitignore) — one bundled archive,
# not the raw build/ tree (content-hashed filenames rename on every build,
# making a tracked directory an unreviewable diff). Deployed instances
# extract it directly, skipping the build step. Only rebuild when a staged
# file actually feeds the build (source, static assets, build config, or
# deps); re-read staged files since the lockfile regeneration above may have
# added package-lock.json/bun.lock. Hard-fail the commit if the build breaks.
BUILD_INPUT_PATTERN='^(src/|static/|svelte\.config\.js$|vite\.config\.ts$|tsconfig\.json$|scripts/gen-notices\.ts$|package\.json$|package-lock\.json$|bun\.lock$)'
staged_now="$(git diff --cached --name-only)"

if grep -qE "$BUILD_INPUT_PATTERN" <<<"$staged_now"; then
  echo "pre-commit: build inputs changed, regenerating build.tar.gz" >&2
  build_log="$(mktemp)"
  if ! NODE_OPTIONS="--max-old-space-size=3072" make export >"$build_log" 2>&1; then
    echo "pre-commit: build FAILED — commit blocked. Output:" >&2
    cat "$build_log" >&2
    rm -f "$build_log"
    exit 1
  fi
  rm -f "$build_log"
  git add build.tar.gz
else
  echo "pre-commit: no build-input changes staged, skipping build.tar.gz regeneration" >&2
fi
