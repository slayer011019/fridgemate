#!/usr/bin/env bash

set -u

FRONTEND_URL="${FRONTEND_URL:-${1:-}}"
BACKEND_URL="${BACKEND_URL:-${2:-}}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass_count=0
fail_count=0

pass() {
  printf "%bPASS%b %s\n" "${GREEN}" "${NC}" "$1"
  pass_count=$((pass_count + 1))
}

fail() {
  printf "%bFAIL%b %s\n" "${RED}" "${NC}" "$1"
  fail_count=$((fail_count + 1))
}

info() {
  printf "%bINFO%b %s\n" "${BLUE}" "${NC}" "$1"
}

warn() {
  printf "%bWARN%b %s\n" "${YELLOW}" "${NC}" "$1"
}

usage() {
  cat <<EOF
Usage:
  FRONTEND_URL=https://your-frontend.vercel.app BACKEND_URL=https://your-api.up.railway.app ./scripts/smoke-test.sh

Or:
  ./scripts/smoke-test.sh https://your-frontend.vercel.app https://your-api.up.railway.app
EOF
}

check_http_status() {
  local url="$1"
  local response
  response="$(curl -sS -L -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || true)"
  printf '%s' "$response"
}

check_backend_health() {
  local url="$1"
  local response
  response="$(curl -sS -L -w $'\n%{http_code}' "${url%/}/health" 2>/dev/null || true)"
  printf '%s' "$response"
}

if [[ -z "$FRONTEND_URL" || -z "$BACKEND_URL" ]]; then
  usage
  exit 1
fi

info "Frontend URL: $FRONTEND_URL"
frontend_status="$(check_http_status "$FRONTEND_URL")"

if [[ "$frontend_status" =~ ^[0-9]+$ ]] && (( frontend_status >= 200 && frontend_status < 400 )); then
  pass "Frontend responded with HTTP $frontend_status"
else
  fail "Frontend request failed (HTTP ${frontend_status:-N/A})"
fi

info "Backend health URL: ${BACKEND_URL%/}/health"
health_response="$(check_backend_health "$BACKEND_URL")"
backend_status="$(printf '%s' "$health_response" | tail -n 1)"
backend_body="$(printf '%s' "$health_response" | sed '$d')"

if [[ "$backend_status" =~ ^[0-9]+$ ]] && (( backend_status == 200 )); then
  pass "Backend /health responded with HTTP 200"
else
  fail "Backend /health request failed (HTTP ${backend_status:-N/A})"
fi

if printf '%s' "$backend_body" | grep -q '"db":"connected"'; then
  pass "Backend DB health is connected"
elif printf '%s' "$backend_body" | grep -q '"db":"disconnected"'; then
  fail "Backend DB health is disconnected"
else
  warn "Backend DB health could not be determined from /health response"
fi

printf '\n'
info "Health response body: ${backend_body:-<empty>}"
printf '\n'
info "Summary: ${pass_count} passed, ${fail_count} failed"

if (( fail_count > 0 )); then
  exit 1
fi
