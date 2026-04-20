#!/usr/bin/env bash

set -euo pipefail

# Preferred path on Node versions that support TypeScript stripping.
if node --experimental-strip-types -e "" >/dev/null 2>&1; then
  exec node --experimental-strip-types --test tests/auth.test.ts
fi

# Fallback for Node versions that do not support --experimental-strip-types.
# Compile only the auth test + dependent auth modules to a temp folder, then
# run Node's built-in test runner on emitted JavaScript.
TMP_DIR="$(mktemp -d .auth-test-build.XXXXXX)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

./node_modules/.bin/tsc \
  tests/auth.test.ts \
  core/auth.ts \
  core/oauth.ts \
  --outDir "$TMP_DIR" \
  --module nodenext \
  --target es2022 \
  --moduleResolution nodenext \
  --rewriteRelativeImportExtensions \
  --skipLibCheck \
  --esModuleInterop \
  --isolatedModules

exec node --test "$TMP_DIR/tests/auth.test.js"
