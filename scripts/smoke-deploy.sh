#!/usr/bin/env bash
# Smoke pós-deploy — "home 200" NÃO basta. Testa via o DOMÍNIO PÚBLICO:
# (1) o <link> CSS do HTML retorna 200, (2) tamanho real (>50KB, não parcial),
# (3) Content-Type text/css (Safari recusa senão). 200 sozinho mente.
BASE="${1:-https://app.caixaos.com.br}"
home=$(curl -s -o /dev/null -w "%{http_code}" -L "$BASE/")
href=$(curl -sL "$BASE/" | grep -oiE "/_next/static/chunks/[^\"']*\.css" | tail -1)
[ -z "$href" ] && { echo "✗ nenhum <link> CSS no HTML (home $home) — build sem estilo"; exit 1; }
read -r code size ctype <<< "$(curl -s -o /dev/null -w '%{http_code} %{size_download} %{content_type}' "$BASE$href")"
echo "home $home · css $href · $code · ${size}B · $ctype"
[ "$code" = "200" ] || { echo "✗ CSS $code — hash descasado (pm2 restart, NÃO reload)"; exit 1; }
[ "${size:-0}" -gt 50000 ] || { echo "✗ CSS só ${size}B — vazio/parcial, rebuild"; exit 1; }
echo "$ctype" | grep -qi "text/css" || { echo "✗ Content-Type $ctype != text/css — Safari recusa"; exit 1; }
echo "✓ home + CSS ok"
