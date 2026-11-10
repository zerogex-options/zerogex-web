#!/usr/bin/env bash
# Build, test and package the ZeroGEX Bookmap add-on.
#
#   ./build.sh             compile, test, link-check, package build/zerogex-bookmap.jar
#   ./build.sh --release   ...then publish it to frontend/public/bookmap/ (commit that file)
#   ./build.sh --check     rebuild and fail if the published jar is not exactly what the
#                          sources build to (same bytes), i.e. someone edited a source
#                          and forgot --release, or the jar was swapped by hand
#
# Needs a JDK 17+ (the jar tool's --date option makes the build reproducible) and
# network access to maven.bookmap.com the first time, to fetch Bookmap's API jars
# into .cache/. Those jars are Bookmap's, are verified by SHA-256 below, and are
# never committed or shipped: the add-on compiles against them and Bookmap
# provides them at runtime.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
CACHE="$HERE/.cache"
BUILD="$HERE/build"
PUBLISHED="$ROOT/frontend/public/bookmap/zerogex-bookmap.jar"
MAVEN="https://maven.bookmap.com/maven2/releases/com/bookmap/api"
# A fixed timestamp for every jar entry: the same sources always produce the same bytes.
JAR_DATE="2026-01-01T00:00:00Z"
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-}"

# version | api-core sha256 | api-simplified sha256 | what must compile against it
#   all       every source
#   no-alerts everything but the 7.4 alert declarations
#   core      neither the 7.2 overlay nor the 7.4 alerts (they are loaded by name and
#             fail cleanly, so the add-on still runs with lines on these versions)
COMPILE_VERSION="7.9.0.14"
API_VERSIONS=(
  "7.9.0.14|d267b7241c19fd1a247505be6ffc784350b0772bfc28b343cc0564ee305ab857|e2a63fa2d0d993ba0b01b7c617b2ce79edcc0d5cc470a4a3de609070d8cf1644|all"
  "8.0.0.9|22cd6122523e90773fddf7cb52b27fb3a23c123b067d826cff18f37cf9581f94|93664e10171d924473ea21bc3c4c329e767de5d55102869b57f3349b40adb030|all"
  "7.4.0.21|9e2b910120702e0aa5ba54dde78c0835dd1424b8bd1ad4c69cd11b55550a9a9f|9acf7111edd9050a0c2b528f8b13629937105ac735cc96deb902b9d84ff7ffe0|all"
  "7.2.0.25|6f1fba62213625706c0e6d0796142215496a5fc4bf1acd44edc05cbe1fab078c|7cd250363a76a029460165784375524d788a12d9608960933f0092bbb18a3d57|no-alerts"
  "7.0.0.97|e75dbc4e0ce76fcd46363d4e48addfdfb9fc17615ef7d44d982f449d9692d3ac|8be6fbb2b4343b3fe1a258af9527ac3b88c4a781605289f6527f1f030ccaaa0c|core"
)

MODE="${1:-}"
step() { printf '\n== %s\n' "$*"; }
quiet_java() { grep -v '^Picked up JAVA_TOOL_OPTIONS' || true; }

fetch() {
  local version="$1" artifact="$2" sha="$3"
  local file="$CACHE/$artifact-$version.jar"
  if [[ ! -f "$file" ]]; then
    mkdir -p "$CACHE"
    curl -fsS --retry 3 --max-time 120 -o "$file.part" "$MAVEN/$artifact/$version/$artifact-$version.jar"
    mv "$file.part" "$file"
  fi
  local got
  got="$(sha256sum "$file" | cut -d' ' -f1)"
  if [[ "$got" != "$sha" ]]; then
    echo "SHA-256 mismatch for $artifact $version: got $got, want $sha" >&2
    rm -f "$file"
    exit 1
  fi
  echo "$file"
}

classpath_for() {
  local wanted="$1" line version core simp
  for line in "${API_VERSIONS[@]}"; do
    IFS='|' read -r version core simp _ <<<"$line"
    if [[ "$version" == "$wanted" ]]; then
      echo "$(fetch "$version" api-core "$core"):$(fetch "$version" api-simplified "$simp")"
      return
    fi
  done
  echo "unknown API version $wanted" >&2
  exit 1
}

main_sources() {
  local filter="$1"
  (cd "$HERE" && find src/main/java -name '*.java' | LC_ALL=C sort) | while read -r f; do
    case "$filter" in
      core) [[ "$f" == *overlay/ScreenOverlay.java || "$f" == *alerts/DeclaredAlerts.java ]] && continue ;;
      no-alerts) [[ "$f" == *alerts/DeclaredAlerts.java ]] && continue ;;
    esac
    echo "$HERE/$f"
  done
}

source_hash() {
  (cd "$HERE" && find src/main/java -type f | LC_ALL=C sort | while read -r f; do
    printf '%s\n' "$f"; cat "$f"; done) | sha256sum | cut -d' ' -f1
}

build() {
  local out="$1"
  rm -rf "$out"
  mkdir -p "$out/classes" "$out/test-classes" "$out/link"
  local cp
  cp="$(classpath_for "$COMPILE_VERSION")"

  step "Compile (Java 8 bytecode, against Bookmap API $COMPILE_VERSION)"
  # shellcheck disable=SC2046
  javac --release 8 -encoding UTF-8 -Xlint:all,-options,-processing,-classfile -Werror \
    -cp "$cp" -d "$out/classes" $(main_sources all) 2>&1 | quiet_java
  [[ ${PIPESTATUS[0]} -eq 0 ]] || exit 1

  step "Link check against every supported Bookmap API"
  local line version core simp filter
  for line in "${API_VERSIONS[@]}"; do
    IFS='|' read -r version core simp filter <<<"$line"
    local vcp
    vcp="$(fetch "$version" api-core "$core"):$(fetch "$version" api-simplified "$simp")"
    mkdir -p "$out/link/$version"
    # shellcheck disable=SC2046
    if ! javac --release 8 -encoding UTF-8 -nowarn -cp "$vcp" -d "$out/link/$version" \
        $(main_sources "$filter") 2>&1 | quiet_java; then
      echo "does not compile against Bookmap $version ($filter)" >&2
      exit 1
    fi
    [[ ${PIPESTATUS[0]} -eq 0 ]] || { echo "does not compile against Bookmap $version ($filter)" >&2; exit 1; }
    echo "  ok  Bookmap $version ($filter)"
  done

  step "Compile tests"
  # shellcheck disable=SC2046
  javac --release 17 -encoding UTF-8 -nowarn -cp "$out/classes:$cp" -d "$out/test-classes" \
    $(cd "$HERE" && find src/test/java -name '*.java' | LC_ALL=C sort | sed "s|^|$HERE/|") 2>&1 | quiet_java
  [[ ${PIPESTATUS[0]} -eq 0 ]] || exit 1
  cp -r "$HERE/src/test/resources/." "$out/test-classes/" 2>/dev/null || true

  step "Run tests"
  # Preferences go to a scratch directory so the tests never read or write the
  # real "one key for every chart" store on the machine running the build.
  java -Djava.awt.headless=true -Dzerogex.quiet=true -Dzerogex.preview.dir="$out/preview" \
    -Djava.util.prefs.userRoot="$out/prefs" \
    -cp "$out/classes:$out/test-classes:$cp" io.zerogex.bookmap.testkit.TestRunner 2>&1 | quiet_java
  [[ ${PIPESTATUS[0]} -eq 0 ]] || exit 1

  step "Package"
  local version_line
  version_line="$(grep -o 'VERSION = "[^"]*"' "$HERE/src/main/java/io/zerogex/bookmap/ZeroGexLevels.java" | cut -d'"' -f2)"
  cat >"$out/MANIFEST.MF" <<EOF
Manifest-Version: 1.0
Implementation-Title: ZeroGEX Gamma Levels for Bookmap
Implementation-Version: $version_line
Implementation-Vendor: ZeroGEX
ZeroGEX-Source-SHA256: $(source_hash)
ZeroGEX-Bookmap-API: $COMPILE_VERSION
EOF
  (cd "$out/classes" && find . -type f | LC_ALL=C sort | sed 's|^\./||' >"$out/files.txt")
  (cd "$out/classes" && jar --create --file "$out/zerogex-bookmap.jar" --manifest "$out/MANIFEST.MF" \
    --date="$JAR_DATE" @"$out/files.txt") 2>&1 | quiet_java

  # Every class must be Java 8 bytecode (major 52), or Bookmap 7.0-7.2 cannot load it.
  local bad
  bad="$(cd "$out/classes" && find . -name '*.class' | while read -r c; do
    major=$(od -An -j6 -N2 -tu1 "$c" | awk '{print $1*256+$2}')
    [[ "$major" == "52" ]] || echo "$c ($major)"; done)"
  if [[ -n "$bad" ]]; then
    echo "classes not compiled for Java 8: $bad" >&2
    exit 1
  fi
  echo "  $(unzip -l "$out/zerogex-bookmap.jar" | tail -1 | awk '{print $2}') entries," \
       "$(wc -c <"$out/zerogex-bookmap.jar") bytes, sha256 $(sha256sum "$out/zerogex-bookmap.jar" | cut -c1-16)"
}

case "$MODE" in
  ""|--release)
    build "$BUILD"
    if [[ "$MODE" == "--release" ]]; then
      mkdir -p "$(dirname "$PUBLISHED")"
      cp "$BUILD/zerogex-bookmap.jar" "$PUBLISHED"
      step "Published $PUBLISHED - commit it, then run make integration-assets"
    fi
    ;;
  --check)
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    build "$tmp/build" >/dev/null
    if cmp -s "$tmp/build/zerogex-bookmap.jar" "$PUBLISHED"; then
      echo "published jar matches the sources"
    else
      echo "published jar does NOT match the sources - run integrations/bookmap/build.sh --release" >&2
      exit 1
    fi
    ;;
  *)
    echo "usage: $0 [--release|--check]" >&2
    exit 2
    ;;
esac
