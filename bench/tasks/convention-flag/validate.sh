#!/usr/bin/env bash
set -u
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
cp "$here"/seed/* "$tmp"
(cd "$tmp" && bash "$here/assert.sh" >/dev/null 2>&1) && { echo "$(basename "$here"): bare seed must fail assert"; exit 1; }
cp "$here"/ref/* "$tmp"
(cd "$tmp" && bash "$here/assert.sh") || { echo "$(basename "$here"): seed+ref must pass"; exit 1; }
echo "$(basename "$here"): OK (seed fails, seed+ref passes)"
