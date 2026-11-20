#!/usr/bin/env bash
# ⛔⛔ A 5ª PROVA DO GATE — O COMMIT NO AR É O ESPERADO? (19/11/2026)
#
# O CASO: o deploy da lista em lote deu **4/4 VERDE e "DEPLOY OK"** com o COMMIT VELHO no ar —
# eu tinha dado push e esquecido o `git pull` em /opt/conta-ia; o `deploy.sh` rebuildou o
# 73d87d09. O trio + banco prova que o build servido é o que FOI buildado, nunca que é o commit
# que se QUERIA. Só a sonda de antes/depois pegou (mediu o mesmo tempo).
#
# ⭐ DUAS FASES, o mesmo esperado:
#   antes  APP_DIR [ESPERADO]  → resolve o esperado e RECUSA buildar se o HEAD for outro.
#                                Imprime o hash completo no stdout (o deploy grava no build).
#                                ESPERADO vazio = o `origin/<branch>` depois de um fetch (o que
#                                foi empurrado). Fetch que falha sem ESPERADO = vermelho:
#                                "não sei o esperado" nunca vira "está certo".
#   depois APP_DIR ESPERADO    → o build SERVIDO (`.next/COMMIT` + o nome do diretório pra onde
#                                o symlink aponta) é desse commit, e o HEAD também.
#
# ⚠️ Tudo por CÓDIGO DE SAÍDA e comparação de string — nada de pipe com grep (a lição do
# gate-migrations.sh: com `pipefail`, pipe mente).
set -euo pipefail

FASE="${1:?uso: gate-commit.sh antes|depois APP_DIR [ESPERADO]}"
APP_DIR="${2:?falta APP_DIR}"
ESPERADO_IN="${3:-}"
BRANCH="${DEPLOY_BRANCH:-main}"
cd "$APP_DIR"

vermelho() { echo "✗ $*" >&2; exit 1; }
curto() { printf '%s' "${1:0:8}"; }

HEAD_SHA=$(git rev-parse HEAD)

resolver() { # o esperado, por extenso
  if [[ -n "$ESPERADO_IN" ]]; then
    git rev-parse --verify --quiet "${ESPERADO_IN}^{commit}" \
      || vermelho "commit esperado $ESPERADO_IN não existe neste repositório — faltou pull?"
  else
    git fetch -q origin "$BRANCH" 2>/dev/null \
      || vermelho "não consegui buscar origin/$BRANCH pra saber o commit esperado — passe DEPLOY_ESPERADO=<hash>"
    git rev-parse "origin/$BRANCH"
  fi
}

case "$FASE" in
  antes)
    ESP=$(resolver)
    [[ "$HEAD_SHA" == "$ESP" ]] \
      || vermelho "commit no ar $(curto "$HEAD_SHA") ≠ esperado $(curto "$ESP") — faltou pull?"
    printf '%s\n' "$ESP"
    ;;
  depois)
    [[ -n "$ESPERADO_IN" ]] || vermelho "a fase depois precisa do commit esperado"
    ESP=$(resolver)
    [[ -f .next/COMMIT ]] || vermelho "o build servido não diz de qual commit é (.next/COMMIT ausente)"
    SERVIDO=$(tr -d '[:space:]' < .next/COMMIT)
    [[ "$SERVIDO" == "$ESP" ]] \
      || vermelho "commit no ar $(curto "$SERVIDO") ≠ esperado $(curto "$ESP") — faltou pull?"
    DIR_BUILD=$(readlink .next || true)
    [[ "$DIR_BUILD" == *"-$(git rev-parse --short "$ESP")" ]] \
      || vermelho "o build servido ($DIR_BUILD) não é do commit esperado $(curto "$ESP")"
    [[ "$HEAD_SHA" == "$ESP" ]] \
      || vermelho "o repositório saiu do commit esperado no meio do deploy (HEAD $(curto "$HEAD_SHA") ≠ $(curto "$ESP"))"
    printf '%s\n' "$ESP"
    ;;
  *) vermelho "fase '$FASE' desconhecida (antes|depois)" ;;
esac
