#!/usr/bin/env bash
#
# swap-prisma-to-postgres.sh
#
# Troca o provider do Prisma de "sqlite" para "postgresql" em prisma/schema.prisma
# e prisma/migrations/migration_lock.toml. Idempotente: se já estiver em postgresql,
# não muda nada.
#
# Uso (no servidor de produção, antes de "npm run db:migrate:deploy"):
#   bash scripts/swap-prisma-to-postgres.sh
#
# Ver docs/DEPLOY.md — ETAPA 5.
#
# Importante: este script NÃO deve rodar em dev. Ele edita arquivos commitados
# (schema.prisma, migration_lock.toml). Em dev, mantenha "sqlite" para que
# `npm run db:push` continue funcionando contra prisma/dev.db.

set -euo pipefail

SCHEMA="prisma/schema.prisma"
LOCK="prisma/migrations/migration_lock.toml"

if [ ! -f "$SCHEMA" ]; then
  echo "ERRO: $SCHEMA não encontrado. Rode este script da raiz do projeto." >&2
  exit 1
fi

if [ ! -f "$LOCK" ]; then
  echo "ERRO: $LOCK não encontrado. Rode este script da raiz do projeto." >&2
  exit 1
fi

# Trocas idempotentes (nada acontece se já estiver postgresql).
sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA"
sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$LOCK"

# Validação: ambos os arquivos devem agora ter postgresql.
schema_provider=$(grep -E '^\s*provider\s*=' "$SCHEMA" | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
lock_provider=$(grep -E '^\s*provider\s*=' "$LOCK" | head -1 | sed -E 's/.*"([^"]+)".*/\1/')

if [ "$schema_provider" != "postgresql" ]; then
  echo "ERRO: provider em $SCHEMA é '$schema_provider', esperado 'postgresql'." >&2
  exit 1
fi

if [ "$lock_provider" != "postgresql" ]; then
  echo "ERRO: provider em $LOCK é '$lock_provider', esperado 'postgresql'." >&2
  exit 1
fi

echo "OK: provider trocado para postgresql em $SCHEMA e $LOCK."
