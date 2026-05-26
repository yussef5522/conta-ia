# Privacidade — Vendor Discovery (Sprint 5.0.2.n)

## O que é

Cache GLOBAL anonimizado de fornecedores brasileiros. Quando uma empresa do CAIXAOS pesquisa quem é "PADARIA PERLINI" via BrasilAPI ou Claude AI, o resultado fica disponível pra próximas empresas — sem custo adicional, instantâneo.

## O que GUARDAMOS na `GlobalVendorKnowledge`

**Dados PÚBLICOS da Receita Federal:**
- CNPJ (público, qualquer pessoa pode consultar na Receita)
- Razão social / nome fantasia (público)
- CNAE principal + descrição (público)

**Categoria contábil sugerida:**
- Ex: "Fornecedor Bebidas", "Software/Tecnologia"

**Estatísticas agregadas e anônimas:**
- Quantas vezes foi usado (`vezesUsado`)
- Quantas vezes foi confirmado por usuários (`vezesConfirmado`)
- Quantas vezes foi rejeitado (`vezesRejeitado`)
- Score atual (auto-ajustado por accept rate)

## O que NÃO GUARDAMOS

❌ `companyId` (qual empresa cadastrou primeiro) — IMPOSSÍVEL rastrear de volta
❌ Valor de transações
❌ Datas de transações
❌ Sócios/CPFs de quem consultou
❌ Qualquer dado pessoal identificável de PJ ou PF cliente

## Por que isso é seguro pela LGPD

1. **Dados públicos**: CNPJ + razão social + CNAE são abertos via Receita Federal. Não há `dado pessoal` no sentido da LGPD.
2. **Anonimização irreversível**: nenhum campo permite rastrear de volta à empresa que originou.
3. **Finalidade legítima**: melhorar categorização contábil — interesse mútuo de todos clientes.
4. **Network effect**: 1º cliente "paga" lookup, todos ganham — mesmo padrão do Google Safe Browsing / VirusTotal.

## Log `VendorDiscoveryLog`

POR EMPRESA, **NÃO** anonimizado. Guarda quem consultou o quê:
- companyId (sim)
- vendorNameQueried (descrição da tx — pode conter dados sensíveis)
- userAction (ACCEPTED/REJECTED)

Esse log é **POR EMPRESA** e segue a mesma política de privacidade das outras tabelas operacionais (transactions, audit_logs, etc).

## Direitos do titular (LGPD Art. 18)

- **Acesso**: `GET /api/empresas/[id]/vendor-discovery/historico` lista todos os discoveries da empresa.
- **Exclusão**: ao excluir empresa (`DELETE /api/empresas/[id]`), todos `VendorDiscoveryLog` da empresa são removidos via cascade (companyId FK).
- **Cache global**: NÃO contém dados pessoais — não está sujeito a exclusão por titular individual.

## Limites operacionais

- Lookup BrasilAPI: ~500ms, 0 custo.
- Lookup Claude Haiku: ~2s, ~$0.001 por chamada.
- Cache hit: ~5ms, 0 custo.

Cron diário (futuro) ajusta `scoreAtual`:
- Accept rate ≥ 90% → score sobe 0.02
- Accept rate < 50% → score cai 0.05
- Score < 0.40 → `active=false` (desativa entrada)

## Auditoria

Toda chamada gera linha em `VendorDiscoveryLog`. Yussef ou qualquer admin pode auditar via `/empresas/[id]/vendor-discovery` (tela /historico).
