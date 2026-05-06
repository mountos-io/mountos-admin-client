#!/usr/bin/env bash
set -euo pipefail

PKG="@mountos-io/admin-sdk"

# Only act if package.json is staged
git diff --cached --name-only | grep -qx 'package.json' || exit 0

# Check if the staged version uses file: protocol
sdk_val=$(git show :package.json | jq -r ".dependencies[\"$PKG\"] // empty")
case "$sdk_val" in
  file:*) ;;
  *) exit 0 ;;
esac

make reset-local-admin-sdk
git add package.json
