# Sprint 5.0.2.c.2 — Hotfix UI: Tax Hub World-Class

**Status:** ✅ CONCLUÍDO em 25/05/2026
**Suite testes:** 2094 → **2116 (+22 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled in 3.0s

## Motivação

Após Sprint 5.0.2.c, Yussef testou e identificou 2 problemas UX:

❌ **Sidebar bagunçada:** 6 items na seção Tributário (Visão / Comparativo / Perfil / Histórico / Expertise / Metodologia) — cliente não sabe por onde começar.

❌ **Campo duplicado:** form de perfil tinha "Atividade (Lucro Presumido)" + "Atividade (CNAE Expert)" — redundância confusa.

## Padrão adotado: TurboTax / QuickBooks Tax Home

Pesquisa de mercado:
- **TurboTax** — "Tax Home" como hub central; tudo volta pro mesmo lugar
- **QuickBooks** — 1 entrada "Taxes" + sub-navegação interna
- **Xero** — sidebar minimalista + tabs por contexto

Princípio: **1 entrada na sidebar, sub-navegação por tabs internas**.

## Parte A — Sidebar (de 6 pra 1)

`components/sidebar/global-sidebar.tsx`:
- **ANTES:** 6 itens (Receipt Visão Tributária, FileText Histórico DAS, Scale Comparativo, Sparkles Expertise, Settings Perfil Fiscal, BookOpen Metodologia)
- **DEPOIS:** 1 item único — **Receipt "Tributário" → /tributario**
- `isActive` cobre todas sub-rotas via `pathname.startsWith('/tributario')`

## Parte B — Tax Hub com 4 tabs

`/tributario` é agora o HUB. Server component fetcha dados e passa pro client `TaxHub` que gerencia as tabs.

### Estrutura

```
/tributario (server, fetch profile + lastCalc + calcs)
  └── <TaxHub /> (client, gerencia tabs + URL sync)
        ├── Tab Visão        → <VisaoTab>      (server data)
        ├── Tab Análise      → <AnaliseTab>    (client) → sub-pills:
        │                       ├── Análise CNAE → <ExpertiseSection>
        │                       └── Comparativo → <ComparativoSection>
        ├── Tab Histórico    → <HistoricoTab>  (server data)
        └── Tab Configurações → <ConfigTab>    (client form)
```

### URL tracking
- `/tributario` → tab Visão (default, sem query)
- `/tributario?tab=analise` → Análise (sub-pill default: Expertise)
- `/tributario?tab=historico` → Histórico
- `/tributario?tab=config` → Configurações

`router.replace` com `scroll: false` evita histórico poluído.

### Mobile responsive
- TabsList tem `overflow-x-auto` → scroll horizontal em telas estreitas
- Sub-pills empilham naturalmente

## Parte C — Fix campo Atividade

### Helper `deriveActivityFromCNAE`

`lib/tax/derive-activity-from-cnae.ts` infere automaticamente:
- `presumidoAtividade` (COMERCIO/INDUSTRIA/SERVICOS/...)
- `hasICMS` (true/false)
- `hasISS` (true/false)

Estratégia em 3 camadas:
1. **Catálogo expertise** (19 CNAEs Sprint 5.0.2.b) → ramo conhecido = mapping exato
2. **Heurística por prefixo CNAE 2.3** → cobre CNAEs livres digitados:
   - `45-47` → Comércio (com ICMS) — *exceto 4731/4732 = Combustíveis*
   - `10-33` → Indústria (com ICMS)
   - `41-43` → Construção Civil (com ISS)
   - `49` → Transporte (4912/4921-29 = passageiros, demais = cargas)
   - `86` → Serviços Hospitalares
   - `50-99` (demais) → Serviços genéricos
3. **Fallback conservador**: SERVICOS + ISS

### ConfigTab (substituindo `/perfil`)

- ❌ Removido: Select "Atividade (pra Lucro Presumido)"
- ❌ Removido: Checkboxes "tem ICMS / tem ISS" (eram manuais)
- ✅ Mantido: CNAESearchPicker visual (Sprint 5.0.2.c)
- ✅ Adicionado: ao salvar, `deriveActivityFromCNAE(cnae)` preenche os 3 campos automaticamente
- ✅ Adicionado: card link "Metodologia →" (UX descoberta)

## Parte D — Redirects 308

Páginas antigas continuam funcionando via `permanentRedirect()`:
- `/tributario/perfil` → `/tributario?tab=config`
- `/tributario/historico` → `/tributario?tab=historico`
- `/tributario/comparativo` → `/tributario?tab=analise`
- `/tributario/expertise` → `/tributario?tab=analise`
- `/tributario/metodologia` — **MANTIDA** (linkada do ConfigTab)

## Arquivos

### Novos (8)
- `components/tributario/tax-hub.tsx` (Tabs + URL sync)
- `components/tributario/tabs/visao-tab.tsx`
- `components/tributario/tabs/historico-tab.tsx`
- `components/tributario/tabs/analise-tab.tsx`
- `components/tributario/tabs/config-tab.tsx`
- `components/tributario/expertise-section.tsx` (body Expert sem Header)
- `components/tributario/comparativo-section.tsx` (body Comparativo sem Header)
- `lib/tax/derive-activity-from-cnae.ts`
- `__tests__/tax-derive-activity.test.ts` (22 tests)

### Modificados (6)
- `components/sidebar/global-sidebar.tsx` (6 items → 1)
- `app/(dashboard)/tributario/page.tsx` (REESCRITO como hub)
- `app/(dashboard)/tributario/perfil/page.tsx` (REDIRECT)
- `app/(dashboard)/tributario/historico/page.tsx` (REDIRECT)
- `app/(dashboard)/tributario/comparativo/page.tsx` (REDIRECT)
- `app/(dashboard)/tributario/expertise/page.tsx` (REDIRECT)

## Métricas

| | Antes (5.0.2.c) | Depois (5.0.2.c.2) |
|---|---|---|
| Sidebar items Tributário | 6 | **1** |
| Campos Atividade no form | 2 (duplicado) | **0** (auto) |
| Testes | 2094 | **2116 (+22)** |
| Build | ✓ | ✓ |

## Decisões técnicas

- **Sem migration DB** — atividade já estava persistida; helper roda no client antes do POST.
- **Dados antigos preservados** — `atividade` antigo continua válido; helper sobrescreve quando user salva.
- **Server + Client tabs** — Visão/Histórico são server components (data fresca); Análise/Config são client (interatividade). TaxHub aceita server children via `visao` e `historico` props.
- **Redirects permanentes (308)** — browsers e search engines cacheiam, evita revisitar URL antiga.
- **`/tributario/metodologia` mantida como página** — só linkada do ConfigTab, não vale virar tab.

## Smoke test pra Yussef

1. **Sidebar** — ver apenas **Receipt + "Tributário"** na seção (1 item)
2. `/tributario` → abre tab **Visão** (default, sem ?tab)
3. Tab **Análise** → sub-pill "Análise CNAE" (default) + "Comparativo de Regimes"
4. Tab **Histórico** → tabela DAS
5. Tab **Configurações** → form SEM o campo "Atividade (Lucro Presumido)"
6. Selecionar CNAE (ex: Restaurante 5611-2/01) + salvar → backend grava `atividade=COMERCIO, hasICMS=true, hasISS=false` automaticamente
7. URLs antigas redirecionam:
   - `/tributario/perfil` → `/tributario?tab=config`
   - `/tributario/expertise` → `/tributario?tab=analise`
   - `/tributario/historico` → `/tributario?tab=historico`
   - `/tributario/comparativo` → `/tributario?tab=analise`
8. Mobile: tabs scrollam horizontal

## Próximo

**Sprint 5.0.2.d** — Claude Analyzing Real:
- Endpoint `/api/tax/ai-analysis` chama Claude Haiku
- System prompt = `TAX_EXPERT_SYSTEM_PROMPT` + `getKnowledgeFor(topic)` relevante
- Nova sub-pill em Análise: "Análise IA"
- Cache 24h por (empresaId, perfilHash)
