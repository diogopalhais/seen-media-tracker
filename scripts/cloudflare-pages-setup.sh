#!/usr/bin/env bash
# One-time Cloudflare Pages setup for the web app, driven by Wrangler and the Cloudflare API.
#
#   Prerequisites:  pnpm --filter @seen/web exec wrangler login   (opens the browser once)
#   Environment:    VITE_API_BASE_URL   public API origin, e.g. https://api.seen.example.com   (required)
#                   WEB_DOMAIN          custom domain for the app, e.g. seen.example.com        (optional)
#                   CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID   needed only to attach WEB_DOMAIN
#                     (token permissions: Cloudflare Pages:Edit, Zone:DNS:Edit, Zone:Read)
#
#   Usage:  VITE_API_BASE_URL=https://api.seen.example.com WEB_DOMAIN=seen.example.com pnpm deploy:web:setup
set -euo pipefail

PROJECT="seen"
: "${VITE_API_BASE_URL:?Set VITE_API_BASE_URL to the public API origin}"

echo "▸ Creating Pages project '$PROJECT' (ignored if it already exists)"
pnpm --filter @seen/web exec wrangler pages project create "$PROJECT" --production-branch main 2>/dev/null || true

echo "▸ Building the web app against $VITE_API_BASE_URL"
VITE_API_BASE_URL="$VITE_API_BASE_URL" pnpm --filter @seen/web build

echo "▸ Deploying to Pages"
pnpm --filter @seen/web deploy

if [[ -n "${WEB_DOMAIN:-}" ]]; then
  : "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN to attach the custom domain}"
  : "${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID to attach the custom domain}"
  API="https://api.cloudflare.com/client/v4"
  AUTH=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json")

  ZONE_NAME="$(echo "$WEB_DOMAIN" | awk -F. '{print $(NF-1)"."$NF}')"
  ZONE_ID="$(curl -sS "${AUTH[@]}" "$API/zones?name=$ZONE_NAME" | python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; print(r[0]["id"] if r else "")')"
  [[ -n "$ZONE_ID" ]] || { echo "Zone $ZONE_NAME not found for this token"; exit 1; }

  echo "▸ Attaching custom domain $WEB_DOMAIN to the Pages project"
  curl -sS "${AUTH[@]}" -X POST "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT/domains" \
    --data "{\"name\":\"$WEB_DOMAIN\"}" | python3 -c 'import json,sys; r=json.load(sys.stdin); print("  domain:", "ok" if r.get("success") else r.get("errors"))'

  echo "▸ Pointing DNS $WEB_DOMAIN → $PROJECT.pages.dev (proxied)"
  EXISTING="$(curl -sS "${AUTH[@]}" "$API/zones/$ZONE_ID/dns_records?name=$WEB_DOMAIN" | python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; print(r[0]["id"] if r else "")')"
  BODY="{\"type\":\"CNAME\",\"name\":\"$WEB_DOMAIN\",\"content\":\"$PROJECT.pages.dev\",\"proxied\":true,\"ttl\":1}"
  if [[ -n "$EXISTING" ]]; then
    curl -sS "${AUTH[@]}" -X PUT "$API/zones/$ZONE_ID/dns_records/$EXISTING" --data "$BODY" | python3 -c 'import json,sys; r=json.load(sys.stdin); print("  dns:", "updated" if r.get("success") else r.get("errors"))'
  else
    curl -sS "${AUTH[@]}" -X POST "$API/zones/$ZONE_ID/dns_records" --data "$BODY" | python3 -c 'import json,sys; r=json.load(sys.stdin); print("  dns:", "created" if r.get("success") else r.get("errors"))'
  fi
  echo "▸ Done. Certificate for $WEB_DOMAIN is issued by Cloudflare within a few minutes."
fi
