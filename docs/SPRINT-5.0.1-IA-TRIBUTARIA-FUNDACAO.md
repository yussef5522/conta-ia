# Sprint 5.0.1 — IA Tributária Fundação (Simples Nacional)

**Status:** ✅ CONCLUÍDO em 24/05/2026
**Suite testes:** 1887 → **1931 (+44 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled successfully

## ⚠️ AVISO LEGAL OBRIGATÓRIO

Sistema produz cálculos **ESTIMADOS** baseados em LC 123/2006 + Resoluções
CGSN vigentes 2026. **NÃO SUBSTITUI orientação contábil profissional.** Sempre
confirme com seu contador antes de pagar DAS ou tomar decisões fiscais.
Valor oficial do DAS é o do sistema gov.br/receitafederal.

DisclaimerBanner é renderizado em TODAS as 3 páginas do módulo.

## Escopo entregue

### 1. Schema + migration
- `CompanyTaxProfile` (regime + anexo + folha12m + proLabore + cnae + enabled)
- `TaxCalculation` (snapshot por (profileId, paYear, paMonth) com versaoTabela)
- 2 relations em Company + 1 em User
- Migration `20260524020000_sprint_5_0_1_tax_profile` SQL manual Postgres

### 2. Tabelas Simples Nacional 2026
`lib/tax/simples-nacional-tables.ts` (constante congelada):
- 5 anexos × 6 faixas cada (30 entries totais)
- Constantes `SIMPLES_LIMITE_RBA_2026 = 4.8M`, `FATOR_R_THRESHOLD = 0.28`
- Helper `findFaixa(anexo, rba)` retorna faixa ou null se estourou teto
- Labels human-readable

### 3. Engine puro `calculateSimples`
`lib/tax/simples-engine.ts` — função PURA testável:
- Aplica Fator R (só entre Anexo III ↔ V; outros anexos inalterados)
- Calcula RBA projeção (rbaAcumulada + receitaBrutaMes)
- Identifica faixa → alíquota efetiva via fórmula oficial
- Retorna DAS arredondado 2 decimais + breakdown + warnings
- Throw em entradas negativas
- Proteção div/0 em RBA zero

### 4. Helper `calculateRBA12m`
`lib/tax/calculate-rba.ts`:
- Soma receitas (lifecycle=EFFECTED, type=CREDIT, status≠IGNORED, reconciledWithId=null)
- Janela 12 meses anteriores ao mês de competência (não inclui o próprio)
- Multi-tenant via OR de 4 relações (consistente com `resolveEmpresaAccess`)

### 5. Endpoints
- `GET /api/empresas/[id]/tax-profile` — perfil atual
- `POST /api/empresas/[id]/tax-profile` — upsert + audit log
- `POST /api/empresas/[id]/tax-calculate` — calcula DAS + persiste
- `GET /api/empresas/[id]/tax-history?limit=N` — últimos N cálculos

### 6. UI
- `/tributario` (visão geral, dados do perfil + último DAS + botão Calcular)
- `/tributario/perfil` (form regime + anexo + folha + pró-labore)
- `/tributario/historico` (tabela últimos 60 cálculos)
- `components/tax/disclaimer-banner.tsx` reutilizável
- Sidebar: nova seção **TRIBUTÁRIO** com 3 items (Visão / Histórico / Perfil)

## Fórmula oficial implementada

```
Fator R = folha12m / RBA12m

Se Anexo III + Fator R < 28% → muda pra Anexo V (alíquota maior)
Se Anexo V + Fator R ≥ 28% → muda pra Anexo III (alíquota menor, benefício)

Faixa = aquela onde RBA + receita_mes está dentro de [rbaMin, rbaMax]

Alíquota Efetiva (%) =
  ((RBA_projeção × Alíquota_Nominal_dec) - Parcela_Deduzir) / RBA_projeção × 100

DAS (R$) = receita_mes × (Alíquota_Efetiva / 100)
```

## Decisões técnicas

- **Float** em vez de `Decimal @db.Decimal(15, 2)`: consistência com
  `Transaction.amount`. Arredondamento explícito `round2` no engine resolve
  precisão fiscal pra valores até R$ ~10M (suficiente pro teto SN 4.8M).
- **Tabelas como constantes congeladas**: imutáveis em runtime. Versionamento
  via `versaoTabela: '2026'` em TaxCalculation pra auditoria histórica.
- **Engine 100% pura**: zero acesso a DB, testável trivialmente. Caller injeta
  RBA via `calculateRBA12m` no route handler.
- **Sprint 5.0.1 NÃO calcula Lucro Presumido/Real**: endpoint rejeita com
  HTTP 422 + mensagem clara. Anexos disabilitados na UI com label "(Sprint 5.0.2)".
- **Upsert por (profile, paYear, paMonth)**: recálculo atualiza, não duplica.
  Snapshot completo dos inputs preserva auditoria.

## Cenário documentado (academia BR típica)

Anexo III, Fator R = 36%, faturamento R$ 50k/mês:
- RBA 12m = R$ 600.000 (Faixa 3)
- Alíquota nominal = 13.5%, deduz R$ 17.640
- Alíquota efetiva ≈ 10.79%
- DAS ≈ R$ 5.395/mês

Validado em `tax-simples-engine.test.ts > cenário documentado pro Yussef`.

## Arquivos

### Novos (15)
- `lib/tax/simples-nacional-tables.ts`
- `lib/tax/simples-engine.ts`
- `lib/tax/calculate-rba.ts`
- `lib/validations/tax.ts`
- `app/api/empresas/[id]/tax-profile/route.ts`
- `app/api/empresas/[id]/tax-calculate/route.ts`
- `app/api/empresas/[id]/tax-history/route.ts`
- `app/(dashboard)/tributario/page.tsx`
- `app/(dashboard)/tributario/recalc-button.tsx`
- `app/(dashboard)/tributario/perfil/page.tsx`
- `app/(dashboard)/tributario/historico/page.tsx`
- `components/tax/disclaimer-banner.tsx`
- `__tests__/tax-simples-tables.test.ts` (20 tests)
- `__tests__/tax-simples-engine.test.ts` (13 tests)
- `__tests__/tax-validation.test.ts` (11 tests)
- `prisma/migrations/20260524020000_sprint_5_0_1_tax_profile/migration.sql`

### Modificados (2)
- `prisma/schema.prisma` (+CompanyTaxProfile +TaxCalculation +relations)
- `components/sidebar/global-sidebar.tsx` (+seção Tributário com 3 items)

## Métricas

```
Antes (Sprint 4.0.5.c):  1887 testes
Depois (Sprint 5.0.1):   1931 testes (+44)

Tempo planejado:  ~5-6h
Tempo real:       ~2h

TS strict: 0 erros
Build:     ✓ Compiled in 3.2s
```

## Smoke test sugerido

1. `/tributario/perfil` → criar perfil teste (qualquer empresa):
   - Regime: Simples Nacional
   - Anexo: III (Serviços)
   - Folha 12m: R$ 216.000
   - Pró-labore: R$ 5.000
   - Salvar
2. `/tributario` → mostra perfil + DisclaimerBanner amarelo
3. Click "Calcular DAS" → modal:
   - Ano 2026, Mês 5, Receita R$ 50.000
   - Calcular
4. Toast mostra DAS ≈ R$ 5.395
5. Voltar `/tributario` → card "Último DAS" com Fator R 36%
6. `/tributario/historico` → tabela com cálculo salvo

## Próximo

- **Sprint 5.0.2** — Lucro Presumido + Lucro Real
- **Sprint 5.0.3** — IA Agent conversacional ("Estou pagando muito imposto?")
- **Sprint 5.0.4** — Reforma Tributária IBS/CBS (2027+)
- **Sprint 5.0.5** — Folha de pagamento + encargos
