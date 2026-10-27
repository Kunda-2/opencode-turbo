#!/usr/bin/env bash
set -u

here="$(cd "$(dirname "$0")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "assert: node not found" >&2
  exit 1
fi

exec node "$here/hidden/check.js" "$(pwd)" "$here/hidden"
