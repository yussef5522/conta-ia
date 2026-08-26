#!/usr/bin/env bash
# ⛔ DEPLOY QUE NUNCA DERRUBA PROD (26/08/2026)
#
# Regra do dono: com cliente pagando, "deploy quebrou o site" NÃO PODE EXISTIR como
# categoria de evento.
#
# O QUE DERRUBOU ANTES (três vezes, causas diferentes, o mesmo desenho por trás):
#   24/08  `npm run build | grep | head` → SIGPIPE matou o build no meio da escrita
#          do `.next`, que ficou sem BUILD_ID e o pm2 entrou em loop.
#   24/08  OOM killer matou o type-check (servidor sem swap) — mesmo resultado.
#   26/08  build escreveu por cima do `.next` que o pm2 SERVIA; quem acessou nos
#          segundos da troca recebeu HTML apontando pra chunks inexistentes
#          (CSS 404 às 16:35:00, 200 às 16:36:56).
#
# Em todos, a causa comum é UMA: **o build mexia no diretório vivo**. Aqui ele não
# mexe. Se o build falhar por qualquer motivo, o symlink não anda e prod continua
# servindo o build anterior INTACTO — falha de build vira não-evento pro cliente.
#
#   .next                       → SYMLINK
#   .next-build-<stamp>-<sha>   → onde cada build mora (mantém os 3 últimos)
#
# Uso:  bash scripts/deploy.sh          (build + troca + gate)
#       bash scripts/deploy.sh --dry    (só o gate de saúde e o diagnóstico)

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/conta-ia}"
PM2_APP="${PM2_APP:-conta-ia}"
PORT="${PORT:-3001}"
# ⚠️ NOME PLANO NA RAIZ, não `.next-builds/<sha>` (26/08): o Next gera os arquivos de
# tipo com caminho RELATIVO de três níveis (`../../../app/...`), assumindo que o
# `distDir` tem profundidade 1 — como o `.next`. Com um nível a mais o build morre com
# "Cannot find module '../../../app/(auth)/cadastro/page.js'". Descoberto no 2º deploy;
# **o symlink não moveu e prod não sentiu** (era exatamente pra isso que o gate existe).
PREFIXO=".next-build-"
MANTER=3
# Memória livre mínima (MB) pra sequer TENTAR: o type-check do Next chega a ~1,9 GB.
MIN_MB=2200

cd "$APP_DIR"
DRY=0
[[ "${1:-}" == "--dry" ]] && DRY=1

log()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗ %s\033[0m\n' "$*"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# GATE DE SAÚDE — ANTES
# ⚠️ Abortar CEDO é melhor que deixar o kernel matar no meio: build morto pela
# metade foi o que quebrou prod em 24/08.
# ─────────────────────────────────────────────────────────────────────────────
log "Gate de saúde (antes)"
DISPONIVEL=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
SWAP_TOTAL=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
SWAP_USADO=$(awk '/SwapTotal/ {t=$2} /SwapFree/ {f=$2} END {print int((t-f)/1024)}' /proc/meminfo)
echo "  memória disponível: ${DISPONIVEL} MB · swap ${SWAP_USADO}/${SWAP_TOTAL} MB"
(( SWAP_TOTAL >= 1024 )) || fail "swap de ${SWAP_TOTAL} MB — o build precisa de folga (mínimo 1 GB). Ver CLAUDE.md."
(( DISPONIVEL >= MIN_MB )) || fail "só ${DISPONIVEL} MB livres (mínimo ${MIN_MB}). O type-check seria morto pelo OOM. Libere memória e tente de novo — prod segue no ar."
DISCO=$(df -Pm "$APP_DIR" | awk 'NR==2 {print $4}')
(( DISCO >= 2000 )) || fail "só ${DISCO} MB de disco livre"
ok "há folga pra buildar"

if (( DRY )); then
  log "Estado atual"
  if [[ -L .next ]]; then ok "symlink → $(readlink .next)"; else echo "  ⚠️  .next ainda é diretório real (a 1ª troca converte)"; fi
  [[ -f .next/BUILD_ID ]] && ok "BUILD_ID atual: $(cat .next/BUILD_ID)" || echo "  ✗ sem BUILD_ID"
  ls -1dt "$APP_DIR/${PREFIXO}"* 2>/dev/null | head -5 | sed 's/^/  build: /' || true
  exit 0
fi

SHA=$(git rev-parse --short HEAD)
STAMP=$(date +%Y%m%d-%H%M%S)
ALVO="$APP_DIR/${PREFIXO}${STAMP}-${SHA}"

# ─────────────────────────────────────────────────────────────────────────────
# BUILD — em diretório SEPARADO, log em ARQUIVO
# ⚠️ NUNCA canalizar pra head/grep: o `head` fecha o pipe, o build leva SIGPIPE e
# morre no meio (foi assim em 24/08, e o terminal ainda dizia "Compiled successfully").
# ─────────────────────────────────────────────────────────────────────────────
log "Build em $ALVO (prod segue servindo o build atual)"
LOG="/tmp/build-${STAMP}.log"
if ! NEXT_DIST_DIR="${ALVO#$APP_DIR/}" npm run build > "$LOG" 2>&1; then
  tail -25 "$LOG"
  rm -rf "$ALVO"
  fail "build FALHOU — o symlink não moveu, prod continua no build anterior. Log: $LOG"
fi

# ─────────────────────────────────────────────────────────────────────────────
# VERIFICAÇÃO DO ARTEFATO — antes de encostar no processo vivo
# ─────────────────────────────────────────────────────────────────────────────
log "Verificando o build"
[[ -f "$ALVO/BUILD_ID" ]] || { rm -rf "$ALVO"; fail "build sem BUILD_ID (morto no meio?) — prod intacto. Log: $LOG"; }
NOVO_ID=$(cat "$ALVO/BUILD_ID")
CSS_N=$(find "$ALVO/static" -name '*.css' 2>/dev/null | wc -l)
(( CSS_N > 0 )) || { rm -rf "$ALVO"; fail "build sem nenhum CSS — artefato incompleto. Prod intacto."; }
[[ -d "$ALVO/server" ]] || { rm -rf "$ALVO"; fail "build sem server/ — artefato incompleto. Prod intacto."; }
ok "BUILD_ID $NOVO_ID · $CSS_N arquivos CSS · server/ presente"

ANTERIOR=""
[[ -L .next ]] && ANTERIOR=$(readlink .next)

# ─────────────────────────────────────────────────────────────────────────────
# TROCA ATÔMICA — `mv -T` de symlink é rename(2): não existe instante "meio trocado"
# ─────────────────────────────────────────────────────────────────────────────
log "Trocando o symlink"
if [[ -d .next && ! -L .next ]]; then
  mv .next ".next-antigo-${STAMP}"   # 1ª vez: guarda o diretório real como rede
  ok "diretório .next antigo preservado em .next-antigo-${STAMP}"
fi
ln -sfn "${ALVO#$APP_DIR/}" .next.novo
mv -Tf .next.novo .next
ok ".next → $(readlink .next)"

log "Reiniciando o pm2"
pm2 restart "$PM2_APP" --update-env > /dev/null
sleep 12

# ─────────────────────────────────────────────────────────────────────────────
# GATE DE SAÚDE — DEPOIS: o TRIO. Só declara sucesso com os três.
# ⚠️ Em 24/08 o smoke passou VERDE com o processo em loop de restart — porque o
# nginx ainda servia a resposta do processo anterior. Uptime crescendo é o que
# distingue "no ar" de "reiniciando sem parar".
# ─────────────────────────────────────────────────────────────────────────────
log "Gate de saúde (depois) — o trio"

[[ "$(cat .next/BUILD_ID)" == "$NOVO_ID" ]] || fail "1/3 BUILD_ID servido ≠ o que buildei"
ok "1/3 BUILD_ID: $NOVO_ID"

U1=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).find(x=>x.name===process.argv[1]);console.log(a?a.pm2_env.pm_uptime:0)})' "$PM2_APP")
STATUS=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).find(x=>x.name===process.argv[1]);console.log(a?a.pm2_env.status:"?")})' "$PM2_APP")
[[ "$STATUS" == "online" ]] || fail "2/3 pm2 em '$STATUS'"
sleep 10
U2=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).find(x=>x.name===process.argv[1]);console.log(a?a.pm2_env.pm_uptime:0)})' "$PM2_APP")
[[ "$U1" == "$U2" ]] || fail "2/3 o processo REINICIOU no meio do gate (loop de restart)"
ok "2/3 pm2 online, mesmo processo por 10s"

# smoke: home + TODOS os CSS que o HTML pede, e o hash tem que ser do build NOVO
HTML=$(curl -sf "http://localhost:${PORT}/" ) || fail "3/3 home não respondeu"
CSS_LINKS=$(grep -o '/_next/static/[^"]*\.css' <<<"$HTML" | sort -u)
[[ -n "$CSS_LINKS" ]] || fail "3/3 o HTML não referencia CSS nenhum"
for c in $CSS_LINKS; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}${c}")
  [[ "$CODE" == "200" ]] || fail "3/3 CSS $c respondeu $CODE — página sem estilo (o incidente de 26/08)"
  [[ -f "$ALVO/static/${c#/_next/static/}" ]] || fail "3/3 CSS $c não é do build novo"
done
ok "3/3 home 200 · $(wc -w <<<"$CSS_LINKS") CSS servindo do build novo"

# ─────────────────────────────────────────────────────────────────────────────
# LIMPEZA — mantém os últimos $MANTER (rollback precisa deles)
# ─────────────────────────────────────────────────────────────────────────────
ls -1dt "$APP_DIR/${PREFIXO}"* 2>/dev/null | tail -n +$((MANTER + 1)) | while read -r velho; do
  [[ "$velho" == "$ALVO" ]] && continue
  rm -rf "$velho" && echo "  removido build antigo: $(basename "$velho")"
done

printf '\n\033[32m✓ DEPLOY OK\033[0m  %s\n' "$NOVO_ID"
[[ -n "$ANTERIOR" ]] && printf '  rollback:  bash scripts/rollback.sh\n'
printf '  builds:    %s\n' "$(ls -1dt "$APP_DIR/${PREFIXO}"* 2>/dev/null | wc -l)"
