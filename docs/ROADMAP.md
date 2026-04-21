# Roadmap — Conta IA

Prioridade definida pelo Yussef:
1. Relatórios e dashboards
2. Conciliação bancária automática
3. IA contadora que calcula impostos
4. Integração Open Finance

---

## FASE 1 — Setup inicial ✅
Auth, CRUD de empresas, banco de dados, testes básicos.

## FASE 2 — Contas Bancárias + Open Finance ✅
- Integração com Pluggy.ai (ativa com credenciais)
- Cadastro de contas bancárias por empresa (10 bancos BR)
- Importação de extrato OFX/QFX com deduplicação por FITID
- Lançamento manual de transações com categorias por setor
- Listagem paginada com filtros de período/tipo/status
- Saldo atualizado atomicamente em todas as operações

## FASE 3 — Dashboard avançado + Relatórios 🔜
- Dashboard com gráficos de fluxo de caixa (recharts ou chart.js)
- DRE simplificada por período
- Relatório de categorias (receita vs. despesa)
- Motor de categorização automática por CNPJ
- Tabela de fornecedores
- Refresh token (JWT expira em 24h atualmente)

## FASE 4 — IA Contadora + Regras de Aprendizado
- Motor de categorização automática por CNPJ
- Tabela de fornecedores com lookup Receita Federal
- Regras de aprendizado da IA (`ai_learning_rules`)
- Notificações de transações pendentes

## FASE 5 — IA Contadora (Chat)
- Chat conversacional com Claude (Anthropic API)
- RAG com legislação tributária brasileira
- Respostas sobre impostos, DAS, IRPJ, CSLL

## FASE 6 — Impostos + Reforma Tributária 2026
- Cálculo automático de DAS (Simples Nacional)
- Suporte a IBS/CBS/Split Payment
- Leitura de XML NF-e com novos campos da reforma
- Relatórios de apuração

## FASE 7 — SaaS + Multi-cliente
- Painel admin com gestão de assinaturas
- Planos: Starter (R$149), Business (R$399), Enterprise (R$999)
- Integração Stripe ou Kiwify
- Onboarding de novos clientes
