#!/usr/bin/env bash
# Smoke pós-deploy — "home 200" NÃO basta: a página pode responder 200 e
# renderizar SEM CSS (hash descasado / PM2 servindo build velho após rm -rf .next).
# Verifica que o CSS referenciado no HTML retorna 200. Uso: bash scripts/smoke-deploy.sh
BASE="${1:-http://localhost:3001}"
home=$(curl -s -o /dev/null -w "%{http_code}" -L "$BASE/")
href=$(curl -sL "$BASE/" | grep -oiE "/_next/[^\"']*\.css" | head -1)
if [ -z "$href" ]; then echo "✗ nenhum <link> CSS no HTML (home $home) — build sem estilo / PM2 build velho"; exit 1; fi
css=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$href")
echo "home $home · css $href $css"
if [ "$css" != "200" ]; then echo "✗ CSS $css — hash DESCASADO. Rode: pm2 restart conta-ia (NÃO reload)"; exit 1; fi
echo "✓ home + CSS ok"
