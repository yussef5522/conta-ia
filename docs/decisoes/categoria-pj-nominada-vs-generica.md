# Decisão pendente — Categoria PJ nominada vs genérica

> **Status:** REGISTRADO em 03/06/2026 durante planejamento da Fatia 4.
> **Quando revisitar:** sprint futura de refactor de plano de contas.
> **Não bloqueia Fatia 4** — desenho atual contorna o problema.

---

## Contexto

Plano de contas atual permite o user nomear categoria PJ com texto livre:
"Distribuição p/Yussef", "Pró-labore Cláudia", "Reembolso João".

Categoria PJ é dado **público** dentro da empresa — todos os sócios que
têm `transaction.view` veem a categoria de cada transação no
`/empresas/[id]/transacoes`, no DRE Gerencial, nos relatórios de categoria.

## Problema descoberto na Fatia 4

Mesmo com a ponte privada (decisões A-E da §0.b do `pf-fatia-4-ponte.md`),
se a categoria PJ contém o **nome do sócio**, esse dado vaza pra outros
sócios via o caminho público.

Exemplo:
- João vê em `/empresas/profit/transacoes`: tx DEBIT R$ 5.000
  categoria "Pró-labore — Yussef"
- João sabe que Yussef recebeu R$ 5.000 de pró-labore, mesmo sem conseguir
  abrir a ponte privada do Yussef

## Solução proposta (pra revisitar)

**Categorias PJ genéricas pra retiradas de sócios:**
- "Pró-labore — Sócios" (1 categoria geral)
- "Distribuição de Lucros — Sócios" (1 categoria geral)
- "Reembolso — Sócios" (1 categoria geral)

**Nome do sócio fica em:**
- `Transaction.notes` (campo opcional já existente — pode virar privado)
- `Transaction.relatedPartyId` aponta pro `SocioPF.id` (já existe — Sprint 5.0.2.h)
- Audit log da ponte (privado por design — só dono do PF vê)

**Onde aparece o nome:**
- ✅ DRE/Categoria/Relatório (público): só "Pró-labore — Sócios" agregado
- ✅ Dono do perfil PF (privado): vê o nome real do sócio
- ✅ Audit log (privado): vê quem foi
- ❌ Tx PJ pública: NÃO mostra nome

## Por que NÃO fazer agora (na Fatia 4)

1. **Escopo:** refactor afeta categorias seedadas, formulários de criação
   de categoria, lógica de sugestão de categoria via AI/regras. Mexe em
   `lib/categories/templates/` + `lib/categories/sugerir.ts` + UI de
   `/empresas/[id]/categorias`.
2. **Dados existentes:** 176 ai_learning_rules em prod podem ter regras
   apontando pra categorias nominadas. Migration teria que renomear ou
   recriar — toca em tabela com dados reais.
3. **Yussef como caso atual:** ele é o único user em prod hoje. Privacidade
   só vira problema real quando entrar o 2º sócio numa mesma empresa.
4. **Fatia 4 entrega o diferencial competitivo** sem depender desse
   refactor. Pode rolar.

## Por que NÃO esquecer

Quando o CAIXAOS tiver multi-sócio real (sprint futura provavelmente entre
Fatia 5 — multi-perfis compartilhados — e Fatia 6 — visão societária
consolidada), esse refactor precisa rolar ANTES de abrir conta pra um 2º
sócio numa empresa existente. Senão o 2º sócio entra e vê o histórico
nominado do 1º.

## Sintomas que indicam que chegou a hora

- 2º user é adicionado a uma `UserCompany` existente
- Categoria PJ contém regex de nome próprio (`/[A-Z][a-z]+/`) + dreGroup em
  `['DESPESAS_PESSOAL', 'DISTRIBUICAO_LUCROS']`
- Yussef sinaliza que vai abrir CAIXAOS pra um sócio dele

## Tarefas quando rolar

- [ ] Migration: renomear categorias existentes seguindo padrão genérico
- [ ] Backfill: extrair nome próprio das categorias antigas → notes da tx
- [ ] UI: warn ao criar categoria com nome próprio sugerindo opção genérica
- [ ] Re-treinar regras IA: apontar pras novas categorias genéricas
- [ ] Atualizar templates seed em `lib/categories/templates/`
- [ ] Testes: garantir que nome de sócio nunca aparece em endpoint
  público após o refactor
