#!/usr/bin/env bash
set -euo pipefail
if [[ "$(date -u +%Y-%m-%d)" > '2026-11-21' ]]; then
  echo 'The unused SQLx RSA advisory exception has expired.' >&2
  exit 1
fi
resolved=$(cargo tree --locked --workspace --all-features --target all --edges normal,build,dev --prefix none)
if printf '%s\n' "$resolved" | grep -Eq '^rsa v'; then
  echo 'rsa is reachable; the unused dependency exception is invalid.' >&2
  exit 1
fi
