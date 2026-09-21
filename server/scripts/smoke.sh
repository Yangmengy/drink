#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:8080}"
EMAIL="${EMAIL:-drink-smoke-$(date +%s)@example.com}"
PASSWORD="${PASSWORD:?PASSWORD is required}"

if ! command -v jq >/dev/null 2>&1; then
  echo 'jq is required' >&2
  exit 1
fi

payload=$(jq -n --arg email "$EMAIL" --arg password "$PASSWORD" \
  '{email: $email, password: $password}')

curl -fsS "$BASE/ready" >/dev/null

response=$(curl -fsS -H 'Content-Type: application/json' -d "$payload" "$BASE/auth/login" 2>/dev/null || true)
if [[ -z "$response" ]]; then
  response=$(curl -fsS -H 'Content-Type: application/json' -d "$payload" "$BASE/auth/register")
fi

token=$(printf '%s' "$response" | jq -e -r '.token')
if [[ -z "$token" || "$token" == "null" ]]; then
  echo 'No token in auth response' >&2
  exit 1
fi

curl -fsS -H "Authorization: Bearer $token" "$BASE/auth/me" >/dev/null
curl -fsS -H "Authorization: Bearer $token" "$BASE/ingredients" >/dev/null
curl -fsS -H "Authorization: Bearer $token" "$BASE/recipes" >/dev/null
echo "smoke ok"
