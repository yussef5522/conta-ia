#!/usr/bin/env bash
# ⏪ ROLLBACK EM UM COMANDO (26/08/2026) — segundos, sem rebuild.
#
# Volta o symlink `.next` pro build anterior e reinicia. Como os últimos 3 builds
# ficam no disco, não há nada pra compilar: é `rename(2)` + restart.
#
# Uso:  bash scripts/rollback.sh              (volta pro build imediatamente anterior)
#       bash scripts/rollback.sh --lista      (mostra os builds disponíveis)
#       bash scripts/rollback.sh <nome>       (volta pra um build específico)

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/conta-ia}"
PM2_APP="${PM2_APP:-conta-ia}"
PORT="${PORT:-3001}"
BUILDS_DIR="$APP_DIR/.next-builds"

cd "$APP_DIR"
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗ %s\033[0m\n' "$*"; exit 1; }

ATUAL=""
[[ -L .next ]] && ATUAL=$(basename "$(readlink .next)")

if [[ "${1:-}" == "--lista" ]]; then
  printf '\nBuilds disponíveis (mais novo primeiro):\n'
  ls -1dt "$BUILDS_DIR"/* 2>/dev/null | while read -r b; do
    n=$(basename "$b")
    id=$([[ -f "$b/BUILD_ID" ]] && cat "$b/BUILD_ID" || echo '(sem BUILD_ID)')
    marca=$([[ "$n" == "$ATUAL" ]] && echo '  ← EM USO' || echo '')
    printf '  %s   %s%s\n' "$n" "$id" "$marca"
  done
  exit 0
fi

if [[ -n "${1:-}" ]]; then
  ALVO="$BUILDS_DIR/$1"
else
  # o primeiro da lista que NÃO é o atual
  ALVO=$(ls -1dt "$BUILDS_DIR"/* 2>/dev/null | grep -v "/${ATUAL}\$" | head -1 || true)
fi

[[ -n "${ALVO:-}" && -d "$ALVO" ]] || fail "não achei build anterior. Veja: bash scripts/rollback.sh --lista"
[[ -f "$ALVO/BUILD_ID" ]] || fail "$(basename "$ALVO") está sem BUILD_ID — build quebrado, não serve pra voltar"

printf '\n▸ Voltando de %s para %s\n' "${ATUAL:-(nenhum)}" "$(basename "$ALVO")"
ln -sfn "${ALVO#$APP_DIR/}" .next.novo
mv -Tf .next.novo .next
ok ".next → $(readlink .next)  (BUILD_ID $(cat .next/BUILD_ID))"

pm2 restart "$PM2_APP" --update-env > /dev/null
sleep 12

# mesmo trio do deploy — voltar sem conferir é trocar um problema por outro
[[ "$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).find(x=>x.name===process.argv[1]);console.log(a?a.pm2_env.status:"?")})' "$PM2_APP")" == "online" ]] \
  || fail "pm2 não subiu"
HTML=$(curl -sf "http://localhost:${PORT}/") || fail "home não respondeu"
for c in $(grep -o '/_next/static/[^"]*\.css' <<<"$HTML" | sort -u); do
  [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}${c}")" == "200" ]] || fail "CSS $c falhou"
done
ok "home + CSS servindo"
printf '\n\033[32m✓ ROLLBACK OK\033[0m  %s\n' "$(cat .next/BUILD_ID)"
