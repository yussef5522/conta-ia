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
- Integração com Pluggy.ai (implementada, desativada — ver FASE 8)
- Cadastro de contas bancárias por empresa (10 bancos BR)
- Importação de extrato OFX/QFX com deduplicação por FITID
- Lançamento manual de transações com categorias por setor
- Listagem paginada com filtros de período/tipo/status
- Saldo atualizado atomicamente em todas as operações

## FASE 2.1 — Correções de interface ✅
- Bug #8: Botão "Nova Conta" no header e estado vazio de `/contas-bancarias`
- Bug #9: Botão "Nova Transação" na página global de transações
- Bug #10: try/catch nos handlers GET das APIs + acessos defensivos no frontend

## FASE 3 — IA Contadora para transações OFX 🔜
- Categorização automática de transações OFX via BrasilAPI (lookup de CNPJ)
- Claude API para sugerir categoria quando CNPJ não é identificado pela BrasilAPI
- Regras de aprendizado (`ai_learning_rules`): aprende uma vez, aplica em todas as próximas
- Tabela de fornecedores com CNPJ, nome e categoria padrão
- Notificações de transações pendentes de categorização
- Refresh token (JWT expira em 24h atualmente)

## FASE 4 — Dashboard avançado + Relatórios
- Dashboard com gráficos de fluxo de caixa (recharts ou chart.js)
- DRE simplificada por período
- Relatório de categorias (receita vs. despesa por setor)
- Consolidação multi-empresa

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

## FASE 8 — Open Finance (Pluggy completo) ⏸ adiado
**Motivo do adiamento:** bancos do usuário (Banrisul, Sicredi, Caixa Econômica Federal) não têm suporte estável no Pluggy. Enquanto isso, OFX cobre o caso de uso principal.
- Reativar e completar integração Pluggy.ai
- Widget de conexão bancária na interface
- Sincronização automática em tempo real
- Suporte a Banrisul, Sicredi e CEF quando disponíveis no Pluggy
