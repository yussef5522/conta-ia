#!/usr/bin/env bash
# ⭐⭐ A SÉRIE DE PERFORMANCE POR DEPLOY (15/09/2026).
#
# **O dono:** *"estou sentindo o sistema mais LENTO"* — e a resposta honesta foi que **não
# dava pra responder**: o deploy guarda 3 builds e o mais antigo era de 26/08. *"Sentir"
# precisa de régua*, e régua sem série é uma foto.
#
# ⚠️ Uma LINHA por deploy, append-only, em TSV. Sem dependência, sem serviço — o arquivo é o
# artefato, e `sort`/`awk` respondem "cresceu quanto na semana".
set -euo pipefail
APP="${APP:-/opt/conta-ia}"
SERIE="$APP/.perf-serie.tsv"
BUILD_ID="$(cat "$APP/.next/BUILD_ID" 2>/dev/null || echo '?')"
# ⚠️ o tamanho que importa é o que o BROWSER baixa: os chunks, não o `.next` inteiro
CHUNKS_KB="$(du -sk "$APP/.next/static/chunks" 2>/dev/null | cut -f1 || echo 0)"
MEM_MB="$(pm2 jlist 2>/dev/null | python3 -c 'import json,sys;print(sum(p["monit"]["memory"] for p in json.load(sys.stdin))//1048576)' 2>/dev/null || echo 0)"

# p95 da HOME servida (sem sessão: mede o servidor, não o banco de um cliente)
ms=()
for _ in 1 2 3 4 5; do
  t0=$(date +%s%3N)
  curl -s -o /dev/null "http://127.0.0.1:3001/" || true
  ms+=($(( $(date +%s%3N) - t0 )))
done
P95="$(printf '%s\n' "${ms[@]}" | sort -n | tail -1)"

[ -f "$SERIE" ] || printf 'data\tbuild\tchunks_kb\tmem_mb\thome_p95_ms\n' > "$SERIE"
printf '%s\t%s\t%s\t%s\t%s\n' "$(date +%Y-%m-%dT%H:%M)" "$BUILD_ID" "$CHUNKS_KB" "$MEM_MB" "$P95" >> "$SERIE"
echo "  ✓ série: chunks ${CHUNKS_KB} KB · pm2 ${MEM_MB} MB · home p95 ${P95} ms"
# ⭐ o delta com o deploy anterior — é o número que responde "cresceu quanto"
awk -F'\t' 'NR>1{k[NR]=$3} END{ if(NR>2 && k[NR-1]>0){ d=k[NR]-k[NR-1]; printf "  Δ chunks vs deploy anterior: %+d KB (%.1f%%)\n", d, d*100/k[NR-1] } }' "$SERIE"
