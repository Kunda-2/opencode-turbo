#!/usr/bin/env bash
# Exits 0 only if: the bare seed FAILS assert.sh and seed+ref PASSES assert.sh.
set -u

here="$(cd "$(dirname "$0")" && pwd)"
name="$(basename "$here")"

work="$(mktemp -d "$here/.validate.XXXXXX")" || exit 1
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/seed" "$work/full"
cp -R "$here/seed/." "$work/seed/" || exit 1
cp -R "$here/seed/." "$work/full/" || exit 1
cp -R "$here/ref/." "$work/full/" || exit 1

if (cd "$work/seed" && bash "$here/assert.sh") >"$work/seed.log" 2>&1; then
  echo "$name: FAIL (seed passed assert.sh with no solution)"
  sed 's/^/  /' "$work/seed.log"
  exit 1
fi

if (cd "$work/full" && bash "$here/assert.sh"); then
  echo "$name: OK (seed fails, seed+ref passes)"
  exit 0
fi

echo "$name: FAIL (reference solution did not pass assert.sh)"
exit 1
