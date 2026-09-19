#!/bin/sh
# Roda um script exploratório na imagem oficial do Playwright (mesma do E2E), sem instalar nada no host.
# uso: ./run.sh charter-a.cjs
# O frontend é montado só-leitura para achar o playwright-core; esta pasta vira /work no container.
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$DIR/../../../.." && pwd)"
docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$REPO/frontend":/app:ro -v "$DIR":/work -w /work -e HOME=/tmp -e NODE_PATH=/app/node_modules \
  mcr.microsoft.com/playwright:v1.63.0-noble node "/work/$1"
