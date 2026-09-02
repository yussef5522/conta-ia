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
#   /opt/conta-ia-build/        → WORKSPACE de build (cópia do repo, node_modules
#                                  compartilhado por symlink). O Next builda ali no
#                                  `.next` padrão dele.
#   /opt/conta-ia/.next         → SYMLINK
#   .next-build-<stamp>-<sha>   → onde cada build mora (mantém os 3 últimos)
#
# ⚠️ POR QUE UM WORKSPACE E NÃO `distDir` CUSTOMIZADO (tentado e descartado em 26/08):
# o `tsconfig.json` inclui `.next/types/**/*.ts`. Buildando com `distDir` diferente, o
# Next escreve os tipos no diretório novo mas o TypeScript continua lendo o
# `.next/types/validator.ts` **VELHO** do build anterior — e o build morre com
# "Cannot find module '../../../app/(auth)/cadastro/page.js'". Duas tentativas
# falharam assim (aninhado e plano). **Nas duas o symlink não moveu e prod não sentiu.**
# Buildar numa cópia do repo deixa o layout que o Next espera e resolve na raiz.
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
BUILD_WS="${BUILD_WS:-/opt/conta-ia-build}"
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

# ⭐⭐ PRISMA: O SWAP DEIXA DE DEPENDER DE LEMBRAR (28/08 — REGRA 5).
#
# ⚠️ O INCIDENTE: login em 500 por 8 HORAS. Um `git reset --hard` antes do deploy
# reverteu `prisma/schema.prisma` pra `sqlite` (o swap-postgres é passo MANUAL do
# runbook) e o `prisma generate` seguinte gerou o client em SQLite. Como o
# `node_modules` é COMPARTILHADO por hard link com o workspace de build, o app subiu
# com esse client e TODA query morria: "the URL must start with the protocol file:".
#
# ⚠️⚠️ E O TRIO FICOU VERDE O TEMPO TODO — a home é estática e respondia 200.
#
# Aqui o deploy CORRIGE sozinho antes de buildar. Combinado que não se faz vira
# impossibilidade: não há mais como buildar com o client falando o banco errado.
PROV_SCHEMA=$(awk '/^datasource/,/}/' prisma/schema.prisma | grep -o 'provider *= *"[^"]*"' | head -1 | cut -d\" -f2)
if [[ "$PROV_SCHEMA" != "postgresql" ]]; then
  echo "  schema em '$PROV_SCHEMA' — rodando o swap pra postgres"
  bash scripts/swap-prisma-to-postgres.sh >/dev/null || fail "o swap-prisma-to-postgres falhou"
fi
npx prisma generate >/dev/null 2>&1 || fail "prisma generate falhou"
PROV_CLIENT=$(awk '/^datasource/,/}/' node_modules/.prisma/client/schema.prisma 2>/dev/null | grep -o 'provider *= *"[^"]*"' | head -1 | cut -d\" -f2)
[[ "$PROV_CLIENT" == "postgresql" ]] || fail "o Prisma Client gerado fala '$PROV_CLIENT', não postgresql — TODA query ao banco falharia. Prod segue no ar; nada foi trocado."
ok "prisma client em postgresql (schema e client conferem)"

# ⛔⛔ MIGRATION PENDENTE É DEPLOY QUEBRADO COM GATE VERDE (02/09/2026).
#
# O que aconteceu: subiu código que lê `stock_venda_complemento_grupo` e a migration
# NÃO estava aplicada — o deploy declarou **4/4 VERDE** e a tela que usa a tabela
# respondia 500. O trio prova que o site é SERVIDO; ele não sabe nada do schema.
# É a mesma família do incidente de 28/08 (login 500 por 8 horas com o trio verde):
# **gate que não enxerga o banco é gate de presença, não de saúde.**
#
# ⚠️ Aplicar ANTES de trocar o symlink, de propósito: a migration deste módulo é
# CREATE-only (guard de CI), então ela é compatível com o build ANTIGO — tabela nova que
# ninguém lê ainda não quebra nada. Se um dia uma migration NÃO for aditiva, ela não pode
# entrar por aqui sem plano próprio (expand/contract), e é isso que o comentário registra.
log "Migrations do banco"
if npx prisma migrate status 2>/dev/null | grep -q "have not yet been applied"; then
  echo "  há migration pendente — aplicando antes de trocar o symlink"
  npx prisma migrate deploy 2>&1 | tail -3 || fail "prisma migrate deploy falhou — prod segue no build anterior, nada foi trocado"
fi
npx prisma migrate status 2>/dev/null | grep -q "have not yet been applied" \
  && fail "ainda há migration pendente depois do deploy — NÃO troco o symlink (o app leria tabela que não existe)"
ok "schema do banco em dia"

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
log "Preparando o workspace de build"
mkdir -p "$BUILD_WS"
# espelha o código (sem node_modules nem builds); o node_modules é compartilhado
rsync -a --delete \
  --exclude 'node_modules' --exclude '.next' --exclude '.next-*' --exclude '.git' \
  "$APP_DIR/" "$BUILD_WS/"
# ⚠️ node_modules por HARD LINK, não symlink (26/08): o Turbopack recusa symlink que
# aponta pra fora da raiz do projeto — "Symlink [project]/node_modules is invalid, it
# points out of the filesystem root". `cp -al` cria um diretório DE VERDADE com os
# arquivos hard-linkados: instantâneo, sem custo de disco (mesmo inode), e o build só
# lê. Refaz só quando o package-lock muda.
if [[ ! -d "$BUILD_WS/node_modules" ]] || [[ "$APP_DIR/package-lock.json" -nt "$BUILD_WS/node_modules" ]]; then
  rm -rf "$BUILD_WS/node_modules"
  cp -al "$APP_DIR/node_modules" "$BUILD_WS/node_modules"
  ok "node_modules espelhado (hard links)"
fi
# ⚠️⚠️ O CLIENT GERADO PRECISA SER RE-LINKADO SEMPRE (29/08/2026).
#
# O `cp -al` acima só refaz quando o package-lock muda — mas o `prisma generate` que
# roda no gate SUBSTITUI os arquivos de `node_modules/.prisma` (inodes NOVOS). Os hard
# links do workspace continuam apontando pros inodes VELHOS, então o build compila
# contra um Prisma Client desatualizado.
#
# MORDEU DE VERDADE: a migration que criou `stock_parcela_combinada` passou no banco, o
# client do app ganhou o modelo, e o BUILD falhou com "Property 'stockParcelaCombinada'
# does not exist on type 'PrismaClient'" — o app tinha 380 referências ao modelo novo e o
# workspace, ZERO. Isso quebraria TODA migration com modelo novo daqui pra frente.
#
# ⭐ O DESENHO SEGUROU: build falhou → symlink não moveu → prod seguiu no ar intacto.
rm -rf "$BUILD_WS/node_modules/.prisma" "$BUILD_WS/node_modules/@prisma/client"
cp -al "$APP_DIR/node_modules/.prisma" "$BUILD_WS/node_modules/.prisma"
cp -al "$APP_DIR/node_modules/@prisma/client" "$BUILD_WS/node_modules/@prisma/client"
ok "prisma client re-linkado (o generate troca os inodes)"

rm -rf "$BUILD_WS/.next"
ok "workspace pronto (node_modules compartilhado)"

log "Build em $BUILD_WS (prod segue servindo o build atual)"
LOG="/tmp/build-${STAMP}.log"
if ! (cd "$BUILD_WS" && npm run build > "$LOG" 2>&1); then
  tail -25 "$LOG"
  fail "build FALHOU — o symlink não moveu, prod continua no build anterior. Log: $LOG"
fi

# traz o artefato pronto pro lado do app (mesmo filesystem → rename, instantâneo)
[[ -d "$BUILD_WS/.next" ]] || fail "build não produziu .next — prod intacto. Log: $LOG"
mv "$BUILD_WS/.next" "$ALVO"

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
log "Gate de saúde (depois) — o trio + o banco"

[[ "$(cat .next/BUILD_ID)" == "$NOVO_ID" ]] || fail "1/4 BUILD_ID servido ≠ o que buildei"
ok "1/4 BUILD_ID: $NOVO_ID"

U1=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).find(x=>x.name===process.argv[1]);console.log(a?a.pm2_env.pm_uptime:0)})' "$PM2_APP")
STATUS=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).find(x=>x.name===process.argv[1]);console.log(a?a.pm2_env.status:"?")})' "$PM2_APP")
[[ "$STATUS" == "online" ]] || fail "2/4 pm2 em '$STATUS'"
sleep 10
U2=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).find(x=>x.name===process.argv[1]);console.log(a?a.pm2_env.pm_uptime:0)})' "$PM2_APP")
[[ "$U1" == "$U2" ]] || fail "2/4 o processo REINICIOU no meio do gate (loop de restart)"
ok "2/4 pm2 online, mesmo processo por 10s"

# smoke: home + TODOS os CSS que o HTML pede, e o hash tem que ser do build NOVO
HTML=$(curl -sf "http://localhost:${PORT}/" ) || fail "3/4 home não respondeu"
CSS_LINKS=$(grep -o '/_next/static/[^"]*\.css' <<<"$HTML" | sort -u)
[[ -n "$CSS_LINKS" ]] || fail "3/4 o HTML não referencia CSS nenhum"
for c in $CSS_LINKS; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}${c}")
  [[ "$CODE" == "200" ]] || fail "3/4 CSS $c respondeu $CODE — página sem estilo (o incidente de 26/08)"
  [[ -f "$ALVO/static/${c#/_next/static/}" ]] || fail "3/4 CSS $c não é do build novo"
done
ok "3/4 home 200 · $(wc -w <<<"$CSS_LINKS") CSS servindo do build novo"

# ⭐⭐ 4/4 — O APP FALA COM O BANCO? (28/08)
#
# ⚠️ POR QUE ISTO EXISTE: em 28/08 o login ficou 500 por 8 horas com o trio TODO VERDE.
# BUILD_ID ok, pm2 online sem loop, CSS servindo — e o banco inalcançável. O gate
# provava que o site era SERVIDO, nunca que ele FUNCIONAVA. Home é estática.
#
# A sonda é o login com credencial proposital INVÁLIDA: exercita Prisma de ponta a
# ponta, tem que devolver 401. 500 = o banco não responde. Sem senha real, sem efeito
# colateral, sem criar nada.
LOGIN_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:${PORT}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"__probe-deploy__@invalido.local","password":"x"}')
[[ "$LOGIN_CODE" == "401" ]] || fail "4/4 o login respondeu $LOGIN_CODE (esperado 401) — o app NÃO está falando com o banco. Rollback: \`bash scripts/rollback.sh\`"
ok "4/4 banco respondendo (login devolve 401, não 500)"

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
