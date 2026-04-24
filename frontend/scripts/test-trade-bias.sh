#!/usr/bin/env bash

set -euo pipefail

# Preferred path on Node versions that support TypeScript stripping.
if node --experimental-strip-types -e "" >/dev/null 2>&1; then
  exec node --experimental-strip-types --test tests/tradeBias.test.ts
fi

# Fallback: compile only the test + its dependencies, then run JS output.
TMP_DIR="$(mktemp -d .trade-bias-test-build.XXXXXX)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

./node_modules/.bin/tsc \
  tests/tradeBias.test.ts \
  core/tradeBias.ts \
  core/signalHelpers.ts \
  --outDir "$TMP_DIR" \
  --module nodenext \
  --target es2022 \
  --moduleResolution nodenext \
  --rewriteRelativeImportExtensions \
  --skipLibCheck \
  --esModuleInterop \
  --isolatedModules

exec node --test "$TMP_DIR/tests/tradeBias.test.js"
