# PDFs reais — NÃO commitados (privacidade)

Yussef forneceu um PDF real da fatura Nubank de maio/2026 com dados
sensíveis (nome, CPF, padrões de gasto, últimos dígitos do cartão).

**Decisão de privacidade (Sprint 3.5):**
- ⛔ **NUNCA commitar o PDF real** neste repositório
- ✅ Fixture sintético `nubank-mai-2026.json` reproduz a **estrutura**
  e os **totais** descritos pelo Yussef, sem dados pessoais
- ✅ Para teste E2E com PDF real, fazer upload manual em DEV (`pnpm dev`
  local) — o cache SHA256 vai impedir re-extração depois do 1º teste

## Como o fixture sintético foi construído

Baseado SOMENTE na descrição que o Yussef enviou no prompt:
- Total da fatura: R$ 6.771,22
- Compras: R$ 6.708,53
- IOF internacionais: R$ 17,42
- Outros lançamentos: R$ 45,28
- Pagamento recebido anterior: −R$ 6.563,50 (SKIP)
- Parcelas: Mercadolivre 4/10, Airbnb 4/6 (x3), Laghetto 3/9
- Internacionais: Tog4dev (R$ 334,03 / USD), Digitalocean (R$ 61,06 /
  USD 11,77), Anthropic (R$ 102,49 / USD 20)

Nomes/refs/datas sintéticos preservam o FORMATO mas não os dados reais.

## Como testar com PDF REAL

1. `pnpm dev` local (sandbox)
2. `PDF_IMPORT_ENABLED=true` no `.env.local`
3. ZDR não é exigido em DEV (gate só ativa em prod)
4. Login + criar perfil + cartão + upload do PDF real
5. Conferir: soma extraída ≈ R$ 6.771,22, parcelas detectadas,
   internacionais com valor em REAL, pagamento pulado
6. Após teste, deletar cache via `/perfis/<id>/imports` → DELETE
   cache do PDF (LGPD)
