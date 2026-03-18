#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
TOKEN="${TOKEN:-}"
SESSION_ID="${SESSION_ID:-}"
PARTNER_ID="${PARTNER_ID:-}"

if [[ -z "$TOKEN" ]]; then
  echo "TOKEN is required (set JWT in env)"
  exit 1
fi

echo "[1/7] health checks"
curl -fsS "$BASE_URL/health/live" > /dev/null
curl -fsS "$BASE_URL/health/ready" > /dev/null

echo "[2/7] entitlements auth"
curl -fsS -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/me/entitlements" > /dev/null

echo "[3/7] notification subscribe/unsubscribe"
TMP_ENDPOINT="https://example.invalid/push/$(date +%s)"
curl -fsS -X POST "$BASE_URL/api/notifications/subscribe" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"$TMP_ENDPOINT\",\"keys\":{\"p256dh\":\"p\",\"auth\":\"a\"}}" > /dev/null
curl -fsS -X POST "$BASE_URL/api/notifications/unsubscribe" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"$TMP_ENDPOINT\"}" > /dev/null

echo "[4/7] create session"
CREATE_JSON="$(curl -fsS -X POST "$BASE_URL/api/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"maxParticipants":2}')"
if [[ -z "$SESSION_ID" ]]; then
  SESSION_ID="$(printf '%s' "$CREATE_JSON" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
fi
if [[ -z "$SESSION_ID" ]]; then
  echo "Could not resolve SESSION_ID"
  exit 1
fi

echo "[5/7] invite lifecycle routes"
if [[ -n "$PARTNER_ID" ]]; then
  curl -fsS -X POST "$BASE_URL/api/sessions/invite" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"sessionId\":\"$SESSION_ID\",\"partnerId\":\"$PARTNER_ID\"}" > /dev/null
fi
curl -fsS -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/me/invites" > /dev/null

echo "[6/7] websocket strict-auth (manual)"
echo "Use a WS client and verify connection succeeds with token query:"
echo "  ws://localhost:8080/ws?sessionId=$SESSION_ID&userId=your-user-id&token=$TOKEN"
echo "  ws://localhost:8080/ws/invites?userId=your-user-id&token=$TOKEN"

echo "[7/7] redis fanout (manual)"
echo "Run two backend nodes against same REDIS_URL and verify invite:update cross-node delivery."

echo "[optional] payments checkout"
if [[ "${CHECK_PAYMENTS:-false}" == "true" ]]; then
  curl -fsS -X POST "$BASE_URL/api/payments/checkout" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"successUrl\":\"$BASE_URL/?billing=success\",\"cancelUrl\":\"$BASE_URL/?billing=cancel\"}" > /dev/null
  echo "payments checkout endpoint responded successfully"
else
  echo "skip (set CHECK_PAYMENTS=true to verify checkout endpoint)"
fi

echo "Smoke checks completed."
