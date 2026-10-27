#!/usr/bin/env bash
# Backup diario do CAIXAOS: pg_dump -Fc -> cofre EXTERNO (rclone) -> retencao 30d + 12m.
#
# ⛔ SEM AS 2 CHAVES DO COFRE ELE ABORTA, DE PROPOSITO.
#    Dump que nao saiu da maquina NAO e backup nivel 3-2-1 — e copia no mesmo disco.
#    Credenciais vivem em /opt/conta-ia/.env.backup (chmod 600), NUNCA no repo.
set -euo pipefail
LOG=/var/log/conta-ia-backup.log
log(){ printf '%s %s\n' "$(date -Is)" "$*" >> "$LOG"; }
ESTADO=/var/lib/conta-ia/backup-diario.state
morre(){ log "⛔ $*"; printf 'FALHOU %s %s\n' "$(date -Is)" "$*" > "$ESTADO"; exit 1; }

source /opt/conta-ia/scripts/_db-uri.sh
DESTINO=/var/backups/conta-ia
MANTER_DIARIAS=30
MANTER_MENSAIS=12

[ -f /opt/conta-ia/.env.backup ] || morre "falta /opt/conta-ia/.env.backup — o dono ainda nao deu as 2 chaves do cofre"
set +u; . /opt/conta-ia/.env.backup; set -u
: "${RCLONE_REMOTE:?RCLONE_REMOTE ausente}" || morre "RCLONE_REMOTE ausente no .env.backup"
command -v rclone >/dev/null || morre "rclone nao instalado"
rclone lsd "$RCLONE_REMOTE" >/dev/null 2>&1 || morre "rclone nao alcanca $RCLONE_REMOTE (chave errada ou bucket inexistente)"

_le_db_uri || morre "nao consegui ler o DATABASE_URL"
STAMP=$(date +%Y%m%d-%H%M%S)
ARQ="$DESTINO/conta-ia-$STAMP.dump"

pg_dump -Fc "$DB_URI" > "$ARQ" 2>>"$LOG" || { rm -f "$ARQ"; morre "pg_dump falhou"; }

# ⚠️ dump só conta depois de conferir o TAMANHO (cicatriz 28/09: dump de 0 bytes é
#    indistinguível de dump feito — e o mais antigo de /var/backups tem 0 bytes).
BYTES=$(stat -c%s "$ARQ")
[ "$BYTES" -ge 1000000 ] || { rm -f "$ARQ"; morre "dump saiu com $BYTES bytes (minimo 1 MB) — NAO vale"; }

rclone copyto "$ARQ" "$RCLONE_REMOTE/diario/$(basename "$ARQ")" 2>>"$LOG" || morre "upload falhou"
REMOTO=$(rclone size --json "$RCLONE_REMOTE/diario/$(basename "$ARQ")" 2>>"$LOG" | grep -o '"bytes":[0-9]*' | cut -d: -f2)
[ "$REMOTO" = "$BYTES" ] || morre "o cofre recebeu $REMOTO bytes e o dump tem $BYTES — NAO confere"

# mensal: o dump do dia 1 vira a copia de longo prazo
if [ "$(date +%d)" = "01" ]; then
  rclone copyto "$ARQ" "$RCLONE_REMOTE/mensal/conta-ia-$(date +%Y%m).dump" 2>>"$LOG" || log "⚠️ copia mensal falhou"
fi

# retencao (local E remota) — some o excedente, nunca o recente
ls -1t "$DESTINO"/conta-ia-*.dump 2>/dev/null | tail -n +$((MANTER_DIARIAS+1)) | xargs -r rm -f
for p in diario:$MANTER_DIARIAS mensal:$MANTER_MENSAIS; do
  pre=${p%%:*}; keep=${p##*:}
  rclone lsf "$RCLONE_REMOTE/$pre" 2>/dev/null | sort -r | tail -n +$((keep+1)) \
    | while read -r v; do [ -n "$v" ] && rclone deletefile "$RCLONE_REMOTE/$pre/$v" 2>>"$LOG"; done
done

printf 'OK %s %s\n' "$(date -Is)" "$BYTES" > "$ESTADO"
log "✓ backup ok — $(basename "$ARQ") · $((BYTES/1024/1024)) MB · no cofre e conferido"
