#!/usr/bin/env bash
# Mantem so os 3 ultimos builds. Mesma regra do deploy.sh (MANTER=3), pro caso de
# os builds acumularem sem deploy. NUNCA toca o alvo do symlink .next.
set -euo pipefail
A=/opt/conta-ia; MANTER=3
ATIVO=$(readlink -f "$A/.next" 2>/dev/null || true)
ls -1dt "$A"/.next-build-* 2>/dev/null | tail -n +$((MANTER+1)) | while read -r v; do
  [ "$(readlink -f "$v")" = "$ATIVO" ] && continue
  rm -rf "$v" && echo "$(date -Is) removido $(basename "$v")" >> /var/log/conta-ia-faxina.log
done
