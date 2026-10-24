#!/usr/bin/env bash
# One command to (re)deploy CyberShield 360 on the VM.
# Update any time with:   git pull && ./deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."   # repo root

COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod"

if [ ! -f deploy/.env.prod ]; then
  echo "ERROR: deploy/.env.prod is missing. Copy deploy/.env.prod.example to it and fill it in."
  exit 1
fi

echo "[1/4] Building the browser-extension package (zip -> frontend/public/downloads)…"
( cd extension && npm ci --silent && npm run build )

echo "[2/4] Building the frontend (dist includes the download)…"
( cd frontend && npm ci --silent && npm run build )

echo "[3/4] Building + starting containers (backend runs DB migrations on boot)…"
$COMPOSE up -d --build

echo "[4/4] Status:"
$COMPOSE ps
echo
echo "Done. Caddy will obtain/renew HTTPS automatically for your domain."
echo "If this is the first deploy, give it ~30s then open https://<your-domain>/"
