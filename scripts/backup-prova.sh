#!/usr/bin/env bash
# PASSO 3 — A PROVA. Backup sem teste e esperanca, nao copia.
# Restaura a foto mais recente num banco TEMPORARIO e confere as contagens-chave.
#
# ⚠️ COMPARA CONTRA O VIVO *RECORTADO NO INSTANTE DO DUMP*, nunca contra o vivo cru:
#    a cozinha opera depois do dump, e comparar cru deixaria a prova VERMELHA todo dia
#    por operacao normal — alarme falso repetido mata o alarme. Recortado, a pergunta
#    fica exata: "o dump levou TUDO que existia naquela hora?"
#
# ⚠️ Roda pelo SUPERUSUARIO LOCAL (peer auth). O usuario do app e least-privilege
#    (createdb=false) e deve continuar assim — a prova nao pede permissao nova,
#    e a senha nao aparece em lugar nenhum deste script.
set -euo pipefail
export LC_ALL=C
LOG=/var/log/conta-ia-backup-prova.log
log(){ printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }
pq(){ sudo -u postgres psql -X -q -tA "$@" 2>/dev/null; }
ESTADO=/var/lib/conta-ia/backup-prova.state
reprova(){ printf 'FALHOU %s %s\n' "$(date -Is)" "$*" > "$ESTADO"; }

source /opt/conta-ia/scripts/_db-uri.sh
_le_db_uri || { reprova "sem DATABASE_URL"; log "⛔ nao consegui ler o DATABASE_URL"; exit 1; }
VIVO_DB=${DB_URI##*/}
[ -n "$VIVO_DB" ] || { log "⛔ nao achei o nome do banco vivo"; exit 1; }

# ⛔ NUNCA `ls | head` aqui: com centenas de dumps o head fecha o pipe, o ls leva
#    SIGPIPE e o pipefail aborta o script antes do 1o log (cicatriz 24/08).
mapfile -t _DUMPS < <(ls -1t /var/backups/conta-ia/*.dump 2>/dev/null)
ARQ=${_DUMPS[0]:-}
[ -n "$ARQ" ] || { reprova "nenhum dump"; log "⛔ nenhum dump pra provar"; exit 1; }
BYTES=$(stat -c%s "$ARQ")
# dump so conta depois de conferir o TAMANHO (o mais antigo de /var/backups tem 0 bytes)
[ "$BYTES" -ge 1000000 ] || { reprova "dump de $BYTES bytes"; log "⛔ $(basename "$ARQ") tem $BYTES bytes — dump invalido"; exit 1; }

TMP="conta_ia_prova_$(date +%Y%m%d%H%M%S)"
limpa(){ sudo -u postgres psql -X -q -c "DROP DATABASE IF EXISTS $TMP;" >/dev/null 2>&1 || true; }
trap limpa EXIT

sudo -u postgres psql -X -q -c "CREATE DATABASE $TMP;" >/dev/null 2>&1 \
  || { reprova "nao criei o temporario"; log "⛔ nao criei o banco temporario $TMP"; exit 1; }
sudo -u postgres pg_restore -d "$TMP" --no-owner --no-privileges "$ARQ" >/dev/null 2>&1 || true

log "dump: $(basename "$ARQ") · $((BYTES/1024/1024)) MB · temporario $TMP · vivo $VIVO_DB"
FALHOU=0
for par in 'companies:createdAt:empresas' 'transactions:createdAt:transacoes' 'stock_movement:criadoEm:movimentos'; do
  TB=${par%%:*}; R=${par#*:}; COL=${R%%:*}; NOME=${R##*:}
  COPIA=$(pq -d "$TMP" -c "SELECT count(*) FROM \"$TB\";" || true)
  T=$(pq -d "$TMP" -c "SELECT coalesce(max(\"$COL\")::text,'') FROM \"$TB\";" || true)
  if [ -z "${COPIA:-}" ] || [ -z "${T:-}" ]; then
    log "  ⛔ $NOME: nao consegui ler a copia (tabela ausente no dump?)"; FALHOU=1; continue
  fi
  VIVO=$(pq -d "$VIVO_DB" -c "SELECT count(*) FROM \"$TB\" WHERE \"$COL\" <= '$T';" || true)
  AGORA=$(pq -d "$VIVO_DB" -c "SELECT count(*) FROM \"$TB\";" || echo '?')
  if [ -z "${VIVO:-}" ]; then log "  ⛔ $NOME: nao consegui ler o vivo"; FALHOU=1; continue; fi
  if [ "$COPIA" = "$VIVO" ]; then
    log "  ✓ $NOME: copia $COPIA == vivo no instante do dump $VIVO   (vivo agora: $AGORA)"
  elif [ "$VIVO" -gt "$COPIA" ]; then
    log "  ⛔ $NOME: o dump PERDEU linha — copia $COPIA, existiam $VIVO naquela hora"; FALHOU=1
  else
    log "  ⚠️ $NOME: copia $COPIA > vivo $VIVO — linha APAGADA depois do dump (nao e falha do backup)"
  fi
done

if [ "$FALHOU" = 0 ]; then
  printf 'OK %s %s\n' "$(date -Is)" "$(basename "$ARQ")" > "$ESTADO"
  log "✓ A PROVA PASSOU — o dump restaura e as contagens batem. Apagando $TMP."
  exit 0
fi
reprova "contagens nao batem"
log "⛔ A PROVA FALHOU — mantendo $TMP pra pericia."
trap - EXIT
exit 1
