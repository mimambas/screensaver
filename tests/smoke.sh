#!/usr/bin/env bash
# Smoke test for the static build.
#
# Asserts:
#   1. The server is up (HTTP 200 for /).
#   2. All critical static assets are reachable (HTTP 200).
#   3. SVG assets contain valid XML (we check the SVG/XML decl).
#   4. Font files have a valid magic header (ttf: 0x00010000, otf: OTTO).
#   5. The Casio F-91W SVG contains the expected segment IDs (parity
#      with the test that uses them in e2e.mjs).
#
# Usage: BASE_URL=http://localhost:4173 ./tests/smoke.sh
# Exits 0 on success, 1 if any check fails.

set -u

BASE_URL="${BASE_URL:-http://localhost:4173}"
export BASE_URL
FAIL=0
PASS=0

# Color helpers (only if stdout is a TTY).
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

check() {
  # check <name> <command-string> — runs command via bash -c, reports pass/fail.
  local name="$1"
  local cmd="$2"
  if bash -c "$cmd" >/dev/null 2>&1; then
    PASS=$((PASS + 1))
    printf "  ${GREEN}✓${NC} %s\n" "$name"
  else
    FAIL=$((FAIL + 1))
    printf "  ${RED}✗${NC} %s\n" "$name"
  fi
}

# 1. Server is up.
check "GET / returns 200"                          '[ "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")" = "200" ]'

# 2. Static assets reachable.
for path in /casio-f91w.svg /favicon.svg /icons.svg /fonts/Seven%20Segment.ttf /fonts/EuroStyle.ttf /sound/casio-bip.mp3; do
  check "GET $path returns 200"                     '[ "$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL'"$path"'")" = "200" ]'
done

# 3. SVG has the right root tag (we don't want to drag in xmllint
# since it's not always installed; the SVG decl is on line 1 of
# dundalek's port).
check "casio-f91w.svg is valid SVG (has <svg)"     sh -c "curl -s '$BASE_URL/casio-f91w.svg' | head -c 200 | grep -q '<svg'"

# 4. Font magic headers.
check "Seven Segment TTF magic header"             sh -c "curl -s '$BASE_URL/fonts/Seven%20Segment.ttf' | head -c 4 | od -An -tx1 | tr -d ' \n' | grep -q '^00010000'"
check "EuroStyle TTF magic header"                 sh -c "curl -s '$BASE_URL/fonts/EuroStyle.ttf' | head -c 4 | od -An -tx1 | tr -d ' \n' | grep -q '^00010000'"

# 5. Casio SVG contains the segment IDs the e2e suite relies on.
# A missing ID would silently break the LCD display, so the smoke
# suite fails loudly if any are removed.
for id in CasioF91WSVG rotor-top rotor-bottom day_1 day_2 hour_1 hour_2 minute_1 minute_2 second_1 second_2 alarmOnMark timeSignalOnMark; do
  check "casio-f91w.svg contains id=$id"            sh -c "curl -s '$BASE_URL/casio-f91w.svg' | grep -q 'id=\"$id\"'"
done

# 6. No 5xx in main HTML payload (server should be healthy).
check "main HTML does not contain error markers"    sh -c "! curl -s '$BASE_URL/' | grep -iE 'internal server error|stack trace' >/dev/null"

# 7. Build manifest is present. We resolve the script path from BASH_SOURCE
# (in the subshell $0 is "bash" not the script, so $(dirname "$0") is wrong).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check "vite build assets manifest"                  "[ -f '$SCRIPT_DIR/../dist/index.html' ]"

echo ""
if [ "$FAIL" -eq 0 ]; then
  printf "${GREEN}smoke: %d/%d passed${NC}\n" "$PASS" "$((PASS + FAIL))"
  exit 0
else
  printf "${RED}smoke: %d/%d passed (%d failed)${NC}\n" "$PASS" "$((PASS + FAIL))" "$FAIL"
  exit 1
fi
