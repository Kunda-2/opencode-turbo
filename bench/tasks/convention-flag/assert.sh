#!/usr/bin/env bash
set -u
here="$(cd "$(dirname "$0")" && pwd)"
exec node "$here/hidden/check.js" "$(pwd)"
