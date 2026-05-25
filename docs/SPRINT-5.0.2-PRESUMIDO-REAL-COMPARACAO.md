# Sprint 5.0.2 — Lucro Presumido + Lucro Real + Comparativo + Disclaimer Pro

**Status:** ✅ CONCLUÍDO em 24/05/2026
**Suite testes:** 1931 → **1958 (+27 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled in 3.2s

## ⚠️ AVISO LEGAL

Cálculos são ESTIMATIVAS pra orientação. Não substituem orientação contábil.
Disclaimer agora é DISCRETO (padrão TurboTax/QuickBooks): ícone Info no header
+ link Metodologia + footer sutil em cards de cálculo.

## Escopo entregue

### PARTE A — Disclaimer profissional

Substituído o banner amarelo gigante por componentes discretos:

- `components/tax/disclaimer-info.tsx` — Ícone Info + tooltip nativo (HTML title) + link Metodologia
- `components/tax/calculation-footer.tsx` — Footer sutil em cards de cálculo
- `/tributario/metodologia` — Página completa com fontes legais (LC 123/2006, Lei 9.249/95, etc), versão de tabelas, garantias, limitações

Atualizado nas 3 páginas existentes:
- `/tributario` (header com DisclaimerInfo, CalculationFooter no card DAS)
- `/tributario/perfil` (DisclaimerInfo no header, sem banner)
- `/tributario/historico` (DisclaimerInfo no header)

### PARTE B — Lucro Presumido + Real + Comparativo

#### Schema (+5 campos)
Migration `20260524030000_sprint_5_0_2_presumido_real_fields`:
- `atividade` (COMERCIO/INDUSTRIA/SERVICOS/etc — pra margem de presunção)
- `estado` (UF — pra alíquota ICMS)
- `hasICMS` Boolean (atividade gera ICMS?)
- `hasISS` Boolean (gera ISS?)
- `margemReal` Float default 15 (Lucro Real)

ALTER TABLE simples, defaults seguros. 3 users existentes preservados.

#### Tabelas 2026
- `lib/tax/lucro-presumido-tables.ts` — 8 atividades × margens IRPJ/CSLL (Lei 9.249/95). Limite R$ 78M (Lei 12.814/2013).
- `lib/tax/lucro-real-tables.ts` — Alíquotas PIS/COFINS não-cumulativos (1.65% + 7.6%). ICMS por UF (27 estados). ISS padrão 5%.

#### Engines puros
- `lib/tax/presumido-engine.ts` — BaseIRPJ via margem + IRPJ adicional + CSLL + PIS/COFINS cumulativo + ICMS opcional + ISS opcional
- `lib/tax/real-engine.ts` — LucroReal = receita × margem declarada. PIS/COFINS não-cumulativo com desconto de créditos
- `lib/tax/comparison-engine.ts` — Roda 3 engines + retorna ranking + recomendação contextual com economia anual

#### Endpoints
- `POST /api/empresas/[id]/tax-compare` — body `{ receitaBrutaMes, anexoSimples?, atividade, margemRealPercent, estado, hasICMS, hasISS }` → resposta com 3 cards + recomendação

#### UI nova
- `/tributario/comparativo` — Form (receita/atividade/margem/anexo/estado/ICMS/ISS) + 3 cards lado a lado (Simples/Presumido/Real) + card de recomendação com troféu e economia anual

#### Perfil expandido
`/tributario/perfil` agora aceita:
- 3 regimes (sem disable)
- Atividade (Select)
- Estado (Select com 27 UFs)
- Margem real % (se LUCRO_REAL)
- Checkboxes hasICMS / hasISS

#### Sidebar
+2 items na seção TRIBUTÁRIO: **Comparativo** (Scale icon) + **Metodologia** (BookOpen icon).

## Fórmulas implementadas

### Lucro Presumido
```
BaseIRPJ  = receita × margemPresunçãoIRPJ (8-32% por atividade)
BaseCSLL  = receita × margemPresunçãoCSLL (12-32%)
IRPJ      = BaseIRPJ × 15%
Adicional = max(0, BaseIRPJ - R$20k) × 10%
CSLL      = BaseCSLL × 9%
PIS       = receita × 0,65%  (cumulativo)
COFINS    = receita × 3%     (cumulativo)
ICMS      = receita × aliq_UF (opcional)
ISS       = receita × 5%      (opcional)
```

### Lucro Real
```
LucroReal = receita × margemRealDeclarada%
IRPJ      = LucroReal × 15%
Adicional = max(0, LucroReal - R$20k) × 10%
CSLL      = LucroReal × 9%
PIS       = max(0, receita × 1,65% - créditosPIS)    (não-cumulativo)
COFINS    = max(0, receita × 7,6% - créditosCOFINS)  (não-cumulativo)
ICMS/ISS  = idem Presumido
```

### Comparativo + Recomendação
1. Calcula 3 regimes (Simples só se aplicável + anexo informado)
2. Filtra aplicáveis (Simples cap R$ 4.8M, Presumido cap R$ 78M)
3. `melhor = argmin(total)`, `pior = argmax(total)`
4. Economia mensal = `pior.total - melhor.total`
5. Economia anual = economia mensal × 12
6. Justificativa em pt-BR com nomes amigáveis dos regimes

## Decisão simplificação

**IRPJ adicional aplicado mensalmente** (R$ 20k/mês) em vez de trimestralmente (R$ 60k/trim como na lei real). MVP — documentado nos comentários. Quando Sprint 5.0.5 cobrir folha + apuração trimestral, ajusta.

## Arquivos

### Novos (13)
- `prisma/migrations/20260524030000_sprint_5_0_2_presumido_real_fields/migration.sql`
- `lib/tax/lucro-presumido-tables.ts`
- `lib/tax/lucro-real-tables.ts`
- `lib/tax/presumido-engine.ts`
- `lib/tax/real-engine.ts`
- `lib/tax/comparison-engine.ts`
- `lib/validations/tax-compare.ts`
- `app/api/empresas/[id]/tax-compare/route.ts`
- `app/(dashboard)/tributario/comparativo/page.tsx`
- `app/(dashboard)/tributario/metodologia/page.tsx`
- `components/tax/disclaimer-info.tsx`
- `components/tax/calculation-footer.tsx`
- 3 testes (presumido 12, real 8, comparison 7)
- `docs/SPRINT-5.0.2-PRESUMIDO-REAL-COMPARACAO.md`

### Modificados (5)
- `prisma/schema.prisma` (+5 campos CompanyTaxProfile)
- `lib/validations/tax.ts` (atividade/estado/hasICMS/hasISS/margemReal)
- `app/api/empresas/[id]/tax-profile/route.ts` (persist novos campos)
- `app/(dashboard)/tributario/perfil/page.tsx` (form expandido)
- 3 páginas tributário (substituem DisclaimerBanner por DisclaimerInfo + CalculationFooter)
- `components/sidebar/global-sidebar.tsx` (+Comparativo +Metodologia)

### Removidos
- `components/tax/disclaimer-banner.tsx` permanece no codebase mas sem imports

## Métricas

```
Antes (Sprint 5.0.1):  1931 testes
Depois (Sprint 5.0.2): 1958 testes (+27)

Tempo planejado:  ~5h
Tempo real:       ~1.5h

TS strict: 0 erros
Build:     ✓ Compiled in 3.2s
```

## Smoke test sugerido (Cacula Mix)

1. `/tributario/perfil` (qualquer empresa, Cacula Mix p ex):
   - Regime: Lucro Real
   - Atividade: SERVICOS (restaurante é serviço com produto)
   - Estado: RS
   - hasICMS: ☐ (restaurante geralmente não)
   - hasISS: ☑
   - Margem real: 15%
   - Salvar

2. `/tributario/comparativo`:
   - Receita mensal: R$ 100.000
   - Atividade: SERVICOS
   - Margem real: 15
   - Anexo Simples: ANEXO_III
   - Estado: RS
   - hasICMS: ☐, hasISS: ☑
   - Calcular

3. Resultado esperado:
   - Simples: ~ ALÍQ. EFETIVA variável (~10-16%)
   - Presumido: ~17.530 (alíq. efet. ~17.53%)
   - Real: ~12.850 (alíq. efet. ~12.85% — sem ICMS!)
   - Recomendação: provavelmente Real (margem baixa 15% favorece Real)

## Próximo

- **Sprint 5.0.3** — IA Agent conversacional ("Posso pagar menos imposto?")
- **Sprint 5.0.4** — Reforma Tributária IBS/CBS (2027+)
- **Sprint 5.0.5** — Folha de pagamento + apuração trimestral correta
