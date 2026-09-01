#!/usr/bin/env bash
set -euo pipefail

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${DATABASE_URL:?Configura DATABASE_URL en .env}"
: "${GOOGLE_GEMINI_API_KEY:?Configura GOOGLE_GEMINI_API_KEY en .env}"

cleanup() {
  kill "${API_PID:-}" "${WEB_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

PORT="${API_PORT:-8080}" pnpm --filter @workspace/api-server run dev &
API_PID=$!

PORT="${WEB_PORT:-5173}" BASE_PATH="${BASE_PATH:-/}" API_ORIGIN="${API_ORIGIN:-http://127.0.0.1:${API_PORT:-8080}}" pnpm --filter @workspace/vigilancia-calderon run dev &
WEB_PID=$!

wait -n "$API_PID" "$WEB_PID"
