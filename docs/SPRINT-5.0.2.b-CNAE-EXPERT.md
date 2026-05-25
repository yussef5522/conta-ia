# Sprint 5.0.2.b — Tax Expert (Restaurantes + Academias + Comércio Roupas)

**Status:** ✅ CONCLUÍDO em 25/05/2026
**Suite testes:** 1958 → **2005 (+47 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled in 3.3s

## Estratégia: Vertical Depth, não Horizontal Breadth

Em vez de cadastrar 1.300 CNAEs superficiais, o sistema cobre **19 CNAEs** em **3 ramos** com expertise PROFUNDA:

- 🍔 **Restaurantes** (8 CNAEs) — restaurantes, lanchonetes, bares, hamburgueria, pizzaria, padaria, bar com/sem refeição, self-service
- 💪 **Academias** (5 CNAEs) — condicionamento físico, gestão esportiva, ensino esportes, dança/balé, personal trainer
- 🛒 **Comércio Roupas** (6 CNAEs) — vestuário, calçados, viagem, tecidos, armarinho, esportivos

## ⚠️ AVISO LEGAL

Cálculos são ESTIMATIVAS baseadas em LC 123/2006 + tabelas vigentes 2026. NÃO substituem orientação contábil profissional. Particularidades fiscais (PERSE, ICMS-ST, DIFAL, Fator R) demandam validação caso-a-caso.

## Escopo entregue

### Schema (migration `20260525000000_sprint_5_0_2b_cnae_expert`)

- Tabela `cnae_activities`:
  - `code` (UNIQUE), `name`, `ramo`, `anexoSimples`
  - 4 colunas TEXT (JSON serializado): `expertise`, `beneficios`, `particularidades`, `errosComuns`
  - `ativo` (toggle), `versao` (default "2026")
  - Índices em `code` e `ramo`
- `CompanyTaxProfile` ganha `cnaeActivityId` (FK opcional, ON DELETE SET NULL) + índice

### Lib expertise (`lib/tax/expertise/`)

- `types.ts` — Tipos compartilhados (`Ramo`, `BeneficioFiscal`, `FatorRAnalysis`, `ExpertiseRamo`)
- `restaurantes.ts` — 8 CNAEs + expertise completa (PERSE, ICMS-ST bebidas, PIS/COFINS monofásico, Lei dos Restaurantes LC 192/2022)
- `academias.ts` — 5 CNAEs + expertise (Fator R EXTREMO, Reforma 2026 saúde = redução 30% IBS/CBS, pró-labore estratégico)
- `comercio-roupa.ts` — 6 CNAEs + expertise (ICMS-ST por estado, DIFAL, NCM por produto, sazonalidade)
- `index.ts` — `ALL_EXPERTISE`, `ALL_CNAES`, `findCNAE`, `expertiseForCNAE`, `searchCNAEs`, `RAMO_LABELS`

### Engine (`lib/tax/cnae-expert-engine.ts`)

Função pura `analyzeCNAEExpertise(input)` retorna `CNAEExpertAnalysis`:
- `beneficiosAplicaveis[]` — snapshot do ramo
- `otimizacoes[]` — economia mensal em R$ calculada (com `economiaEstimada`)
- `alertas[]` — INFO / WARNING / CRITICAL (Fator R baixo, estado sem ST, etc)
- `recomendacoes[]` — priorizadas por `impactoFinanceiro` desc
- `fatorR`, `fatorROK`, `economiaTotalEstimada`
- `expertise` (snapshot completo pra UI)

**Lógica por ramo:**
- **Restaurante:** detecta bebidas → ICMS-ST 8% × 30% receita; CNAEs 5611* → PERSE 3.65%; receita >30k + Fator R baixo → WARNING + recomendação pró-labore; delivery → segregação salão×delivery
- **Academia:** Fator R ≥ 28% → INFO "margem confortável"; Fator R < 28% → CRITICAL + impacto = receita × 9.5 p.p.; sempre adiciona Reforma 2026 redução 30%; CNAE 9313 → sugere separar personal
- **Comércio Roupa:** UF ∈ {SP, RJ, MG, RS, PR, SC} → ICMS-ST 12% economia; outros UFs → INFO confirmar com contador; sempre DIFAL recomendado; receita >20k → provisão sazonal; Lucro Real avaliação pós-2026

### Endpoints

- `GET /api/cnae/search?q=<query>&limit=20` — autocomplete público (autenticado)
- `POST /api/empresas/[id]/tax-expertise` — análise expert do CNAE do perfil

### UI

- **`/tributario/expertise`** (nova) — análise completa com:
  - Hero economia total estimada/mês + Fator R visual
  - Alertas (INFO/WARNING/CRITICAL) com cores e ícones
  - Recomendações priorizadas com impacto financeiro
  - Otimizações detectadas
  - Benefícios do ramo (accordion expansível)
  - Particularidades + Erros comuns (lado a lado)
  - Como grandes redes do ramo otimizam (benchmark Renner, SmartFit, Outback, etc)
- **`/tributario/perfil`** — busca CNAE inteligente (autocomplete com debounce 200ms, mostra ramo, link pra Expertise)
- **Sidebar** — +1 item "Expertise" (ícone Sparkles) na seção TRIBUTÁRIO

### Seed

`scripts/seed-cnae-expert.ts` — idempotente via `upsert`, popula 19 CNAEs com JSON snapshot da expertise. Versão "2026" rastreada.

## Decisões técnicas notáveis

- **JSON em colunas TEXT** (não Json nativo) pra compat SQLite-dev / Postgres-prod sem driver mismatch.
- **Snapshot no banco** permite editar expertise via PATCH futuro sem deploy (campo `versao` rastreia mudanças).
- **Engine 100% puro** — não toca DB, alimentado pelo catálogo em `lib/tax/expertise/`. Endpoint apenas materializa dados do banco.
- **Lógica por ramo isolada** em `analyzeRestaurante`, `analyzeAcademia`, `analyzeComercioRoupa` (switch no engine principal).
- **Heurísticas conservadoras** (ex: bebidas = 30% receita; eventos = 25% receita restaurante). User pode validar e ajustar via inputs futuros.

## Fontes legais

- LC 123/2006 (Simples Nacional)
- LC 155/2016 (Fator R 28%)
- LC 192/2022 (Lei dos Restaurantes — Anexo I garantido)
- Lei 14.148/2021 + Portaria ME 7.163/2021 (PERSE)
- EC 132/2023 + LC 214/2025 (Reforma Tributária)
- Convênios CONFAZ ICMS-ST (bebidas + vestuário)
- EC 87/2015 (DIFAL)

## Métricas

| | Antes (5.0.2) | Depois (5.0.2.b) | Δ |
|---|---|---|---|
| Testes | 1958 | **2005** | +47 |
| Tabelas DB | 27 | 28 | +1 |
| Endpoints | — | +2 | +2 |
| Páginas | — | +1 | +1 |
| CNAEs cadastrados | 0 | **19** | +19 |

## Smoke test sugerido (Cacula Mix Restaurante)

1. `/tributario/perfil` (Cacula Mix selecionada):
   - Buscar CNAE: digite "restaurante" → seleciona `5611-2/01`
   - Confirma que badge "Restaurantes" aparece + link "Ver análise expert"
   - Salvar
2. `/tributario/expertise`:
   - Confirma CNAE pré-populado
   - Receita: R$ 100.000 · ☑ Tem delivery · ☑ Vende bebidas
   - Analisar
3. **Esperado:**
   - Hero: economia ~R$ 6.000-7.000/mês = ~R$ 80k/ano
   - Otimizações: bebidas ICMS-ST + PERSE + (Fator R se estiver fora)
   - Recomendações priorizadas por impacto
   - Benefícios expansíveis (PERSE, ICMS-ST, PIS/COFINS monofásico, segregação delivery)
   - Particularidades + Erros comuns lado a lado
   - Grandes redes: Madero, Outback, Girafas com regimes/estratégias
4. Mudar CNAE pra `9313-1/00` (academia) → recalcular → ver mensagem CRITICAL se Fator R < 28%
5. Mudar pra `4781-4/00` (loja roupa em SP) → ver ICMS-ST destacado

## Próximo

- **Sprint 5.0.3** — IA Agent conversacional (vai usar essa expertise via tool-use Claude Haiku)
- **Sprint 5.0.4** — Reforma Tributária IBS/CBS detalhada
- **Sprint 5.0.5** — Folha de pagamento + apuração trimestral correta
- **Sprint 5.1.x** — Expandir vertical: Salões/Estética + Clínicas/Consultórios + Mercadinhos
