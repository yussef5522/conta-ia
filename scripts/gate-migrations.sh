#!/usr/bin/env bash
# ⛔⛔ GATE DE MIGRATIONS — aplica o que falta e RECUSA seguir se sobrar pendente.
#
# Roda ANTES de trocar o symlink do deploy. Se falhar, prod segue no build anterior.
#
# ⚠️⚠️ A 1ª VERSÃO DESTE GATE MENTIU, e a causa é de SHELL, não de Prisma:
#
#     if npx prisma migrate status 2>/dev/null | grep -q "have not yet been applied"; then
#
# Com migration pendente o `prisma migrate status` **sai com código 1**. O `deploy.sh` roda
# com `set -o pipefail`, e aí o pipeline inteiro vale 1 **mesmo com o grep casando** → o `if`
# leu FALSO e o gate anunciou "schema do banco em dia" com a tabela faltando. Prod ficou
# servindo código que lia `stock_venda_complemento_nome` sem a tabela existir.
#
# ⭐ A CURA É NÃO DEPENDER NEM DE TEXTO NEM DE PIPE: `migrate deploy` é idempotente (roda
# sempre, "No pending migrations" é sucesso) e `migrate status` **devolve 0 quando está em
# dia e 1 quando não está** — medido nos dois estados. Código de saída não muda de idioma
# entre versões do Prisma, e não passa por pipe nenhum.
set -euo pipefail

cd "${1:-/opt/conta-ia}"

# idempotente: sem nada pendente ele não faz nada
npx prisma migrate deploy >/tmp/migrate-deploy.log 2>&1 || {
  echo "✗ prisma migrate deploy FALHOU:"; tail -5 /tmp/migrate-deploy.log; exit 1;
}

# ⭐ a prova é o exit code, não a frase
if ! npx prisma migrate status >/tmp/migrate-status.log 2>&1; then
  echo "✗ ainda há migration pendente (ou o schema divergiu) depois do deploy:"
  tail -8 /tmp/migrate-status.log
  echo "  NÃO troco o symlink — o app leria tabela/coluna que não existe."
  exit 1
fi
echo "schema do banco em dia"
