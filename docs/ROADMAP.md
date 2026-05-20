# Roadmap — CAIXAOS / Conta IA

Prioridade definida pelo Yussef:
1. Relatórios e dashboards
2. Conciliação bancária automática
3. IA contadora que calcula impostos
4. Integração Open Finance

---

## FASE 1 — Setup inicial ✅
Auth, CRUD de empresas, banco de dados, testes básicos.

## FASE 2 — Contas Bancárias + Open Finance ✅
- Integração com Pluggy.ai (implementada, desativada — ver FASE 10)
- Cadastro de contas bancárias por empresa (10 bancos BR)
- Importação OFX/QFX com `dedupHash = sha256(fitid+data+valor+memo)`
- Lançamento manual de transações com categorias por setor
- Listagem paginada com filtros de período/tipo/status
- Saldo atualizado atomicamente em todas as operações
- Detecção automática de banco via FEBRABAN code

## FASE 2.1 — Correções de interface ✅
3 botões + try/catch nos handlers.

## SPRINT 0.5 — Transferências + Saldo Negativo ✅ (11/05/2026)
- `transferGroupId` em transações (pares não inflam DRE)
- `allowNegativeBalance`/`creditLimit`/`lowBalanceThreshold` por conta
- Engines `lib/balance/` + `lib/cashflow/`
- Detecção heurística de transferências OFX
- Replace OFX dedupHash reservation

## FASE 3+4 — IA Contadora ✅ (Etapas 1+2+3 — engine completa)
- ✅ 4.1 Schema `suppliers`, `ai_learning_rules`, `ai_claude_cache`, `ai_usage_log`
- ✅ 4.2 Pipeline camada 1: regras EXACT/CONTAINS/CNPJ/NORMALIZED aplicadas no import
- ✅ 4.3 Pipeline camada 2: extractor CNPJ + BrasilAPI client + CNAE mapping
- ✅ 4.4 Pipeline camada 3: Claude Haiku 4.5 via fetch (sem SDK) + cache + rate-limiter + telemetria
- ✅ 4.5 Tela `/pendentes` com sugestões Claude lazy + stats
- ✅ 4.6 Loop "confirmar manual cria regra" em `/api/transacoes/[id]/classificar-com-aprendizado`
- ✅ 3.1 Detecção automática de banco no preview OFX
- ⏳ 3.2 Badge "Atualizado há X dias" — entregue na **Onda 2 Sprint 2.4**
- ⏳ 3.3 Multi-OFX — entregue na **Onda 2 Sprint 2.4**
- ⏳ 3.4 Histórico de uploads OFX — entregue na **Onda 2 Sprint 2.3** (tabela `ofx_imports`)

## Dashboard Mundial ✅ (Sprints 1+2)
- Sprint 1: Hero Strip + Mini-DRE + Top 5 + Saúde Financeira + Recent + Pendentes
- Sprint 2: Cashflow Waterfall + AI Insights (7 detectors)

## Onda 1 — Foundation SaaS ✅ (Sprints 1.1 → 1.7, 19/05/2026)
- 1.1 Multi-tenant via subdomínios (app/admin)
- 1.2 RBAC + tela login premium
- 1.3 nginx 3 vhosts SSL
- 1.4 Audit log + Meu Time (convites)
- 1.5 Resend email + esqueci-senha
- 1.6 Painel Gerenciador `admin.caixaos.com.br`
- 1.7 CRUD Cupons + FUNDADOR100 ativo

## Onda 2 — IA Contadora Polish ✅ (Sprints 2.1 → 2.5, 20/05/2026)
- 2.1 Tela `/regras` CRUD
- 2.2 Tela `/fornecedores` CRUD
- 2.3 Histórico OFX + Revert (`ofx_imports`)
- 2.4 Multi-OFX sequencial + Badge "Atualizado há X dias"
- 2.5 Limpeza docs (D14-D16, ONDA-2-COMPLETA.md)

---

## Pendentes — próximas ondas

### Sprint 2.6 (NÃO-CÓDIGO) — Validação Real
Yussef testa com 1 mês de OFX real e mede ≥80% auto-classificação.

### FASE 5 — Beta com amigos (2-3 semanas)
- Onboarding 100 fundadores via cupom FUNDADOR100 (já ativo)
- Feedback semanal
- Critério saída: 5+ usuários ativos satisfeitos

### FASE 6 — Relatórios profissionais (1-2 semanas)
- ✅ DRE Gerencial com drill-down
- ✅ Plano de Contas árvore com drag-and-drop
- ✅ Centro de Custo
- ✅ Regime competência (competenceDate + paymentDate)
- ❌ Export PDF (com logo) + Excel
- ❌ DFC realizado vs projetado
- ❌ Conciliação bancária split view

### FASE 7 — Cobrança SaaS (Onda 3 candidata)
- Asaas (PIX/boleto BR) ou Stripe
- Planos: Starter R$149 / Business R$399 / Enterprise R$999
- Trial 14 dias sem cartão
- Billing portal + dunning + gracePeriod

### FASE 8 — Apuração de Impostos
- Simples Nacional (DAS)
- IRPJ + CSLL
- **Reforma Tributária 2026: IBS + CBS + Split Payment**
- XML NF-e 2026

### FASE 9 — Chat IA Contadora
- Interface conversacional
- RAG legislação BR
- Contexto: dados financeiros da empresa

### FASE 10 — Pluggy Produção (quando justificar)
**Disparador:** 10+ clientes pagantes = R$1.500-3.000/mês de receita.
- KYC Pluggy
- Migrar Meu Pluggy → API Produção
- UI: cliente clica "Conectar Banco" e widget abre dentro do Conta IA
- Manter OFX como fallback (planos starter mais baratos)

### FASE 11 — PWA + Mobile
### FASE 12 — Polimento + Lançamento público
