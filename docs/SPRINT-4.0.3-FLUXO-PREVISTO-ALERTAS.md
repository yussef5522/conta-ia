# Sprint 4.0.3 — Fluxo Previsto + Alertas + Match Híbrido IA

**Status:** ✅ CONCLUÍDO em 24/05/2026
**Suite testes:** 1822 → **1849 (+27 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled successfully

## Escopo

Fechamento do Foundation Core Financeiro. 5 frentes:

1. **Fluxo Previsto Dashboard** (cards 30/60/90 dias)
2. **Alertas de Vencimento** (vencidas + 3 dias + 7 dias)
3. **Badges Sidebar** com polling 60s (Contas a Pagar + Conciliação)
4. **Match híbrido Claude Haiku** (boost IA pra score 50-69, cache 24h)
5. **Redirect auto pós-OFX** → `/conciliacao/wizard` quando há sugestões

## 1. Fluxo Previsto

### Função pura `lib/dashboard/fluxo-previsto.ts`

`computeFluxoPrevisto(pendentes, saldoAtual, refDate)` retorna 3 buckets
(30, 60, 90 dias) com:
- `receitasPrevistas` (count + total): RECEIVABLE cuja dueDate cai na janela
- `despesasPrevistas`: PAYABLE idem
- `resultadoPrevisto = receitas − despesas`
- `saldoProjetado = saldoAtual + resultadoPrevisto`

Tx vencidas NÃO entram (cobertas por Alertas). Bucket 60d acumula 30d.

### Query `lib/dashboard/queries-previsto.ts`

`getFluxoPrevistoSnapshot(companyId)` carrega PAYABLE/RECEIVABLE PENDING
+ `reconciledWithId IS NULL` (multi-tenant via OR de 4 relações) + saldo
total das contas ativas. Cache `unstable_cache` 5min.

### UI `FluxoPrevistoCard.tsx`

Card client com tabs 30/60/90 (Radix Tabs do Sprint 4.0.1.b). Receitas
verde, despesas vermelho, resultado destacado, saldo projetado em
sub-card primary.

## 2. Alertas de Vencimento

### Função pura `lib/dashboard/alertas.ts`

`classifyAlertas(txs, refDate)` retorna 4 buckets:
- `vencidas` (dueDate < hoje)
- `vencendoEm3Dias` (hoje até +3d)
- `vencendoSemana` (4-7d)
- `total` (todas com dueDate)

### UI `AlertasVencimentoCard.tsx`

Server component. Cor semântica por bucket (vermelho/âmbar/cinza).
Quando todos zero, exibe estado celebração (CheckCircle2 verde).

## 3. Badges Sidebar

### Endpoint `GET /api/dashboard/badges?empresaId=`

```json
{
  "contasAPagar": { "vencidas": 2, "vencendoEm3Dias": 5 },
  "conciliacao":  { "pendentes": 12 }
}
```

`conciliacao.pendentes` = tx OFX EFFECTED sem `reconciledWithId`.

### Hook `useSidebarBadges(empresaId)`

Polling 60s, best-effort (silencia erros), `empresaId=null` → sem busca.

### `SidebarItem.badgeTone`

Nova prop com 3 tones:
- `red`: vencidas existem
- `amber`: só vencendo 3d
- `neutral`: conciliação pendente

### Resolução `empresaId` no `GlobalSidebar`

1. `?empresaId=` na URL atual
2. Match de `/empresas/<id>/...`
3. Fallback: 1 empresa do user via `GET /api/empresas`

## 4. Match Híbrido — Claude Haiku 4.5

### `lib/conciliacao/claude-judge.ts`

Fetch direto (segue padrão `claude-client.ts`). Custo controlado:

- **SÓ roda quando** score determinístico ∈ [50, 69]
- ≥70: já é CONFIRM (sem necessidade)
- <50: descartado (sem benefício)
- Timeout 8s, falha silencia
- Cache `AiClaudeCache` TTL 24h por hash(ofx+candidate)
- Boost 0-30pts clampado, somado ao score determinístico

### Prompt enxuto

Sistema explica que descrições BR são abreviadas, fornecedores variam,
datas próximas são normais. Pede só JSON `{boost, reasoning}`.

### Opt-in (não automático)

`applyHybridBoost(matchScore, ofx, candidate, companyId)` é função
separada. Endpoints atuais NÃO chamam — fica disponível pra próximas
sprints (4.0.4: integrar no scan-by-import seletivamente).

## 5. Redirect auto pós-OFX

UI `/empresas/[id]/contas/[contaId]/importar/page.tsx`:

```ts
// Após /importar-ofx retornar { importId }:
const scanRes = await fetch('/api/conciliacao/scan-by-import', { ... })
const temSugestoes = scanData.suggestions.length > 0

if (temSugestoes) {
  router.push(`/conciliacao/wizard?importId=${importId}`)
} else {
  // Fluxo Sprint 3.0.2 antigo (conferência IA classificação)
  router.push(`/transacoes?...&conferencia=true`)
}
```

Comportamento: best-effort, falha silenciosa volta ao fluxo antigo. Toast
mostra "X sugestões" antes de redirecionar.

## Arquivos criados/modificados

### Novos (12)

- `lib/dashboard/fluxo-previsto.ts`
- `lib/dashboard/alertas.ts`
- `lib/dashboard/queries-previsto.ts`
- `lib/hooks/use-sidebar-badges.ts`
- `lib/conciliacao/claude-judge.ts`
- `app/api/dashboard/badges/route.ts`
- `app/(dashboard)/dashboard/_components/FluxoPrevistoCard.tsx`
- `app/(dashboard)/dashboard/_components/AlertasVencimentoCard.tsx`
- `app/(dashboard)/dashboard/_components/PrevistoSection.tsx`
- `__tests__/dashboard-fluxo-previsto.test.ts` (10 tests)
- `__tests__/dashboard-alertas.test.ts` (9 tests)
- `__tests__/conciliacao-claude-judge.test.ts` (8 tests, fetch mocked)

### Modificados (4)

- `components/sidebar/sidebar-item.tsx` (prop badgeTone + cores)
- `components/sidebar/global-sidebar.tsx` (resolve empresaId + polling)
- `app/(dashboard)/dashboard/page.tsx` (PrevistoSection antes do Cashflow)
- `app/(dashboard)/empresas/[id]/contas/[contaId]/importar/page.tsx` (redirect wizard)

## Métricas

```
Antes (Sprint 4.0.2):  1822 testes
Depois (Sprint 4.0.3): 1849 testes (+27, +1.5%)

Tempo planejado:  ~6h
Tempo real:       ~1.5h

TS strict: 0 erros
Build:     ✓ Compiled successfully in 2.7s
```

## Smoke test pós-deploy

1. `/dashboard` mostra nova section "Fluxo Previsto" + "Alertas"
2. Sidebar mostra badge "(N)" em "Contas a Pagar" (vermelho/âmbar)
3. Sidebar "Conciliação" mostra badge com tx OFX não conciliadas
4. Importar OFX casando com PAYABLE → redirect /conciliacao/wizard
5. Importar OFX sem matches → fluxo conferência antigo

## Próximo (Sprint 4.0.4 ou 5.0)

- Integrar `applyHybridBoost` opt-in no `scan-by-import`
- Email "Vence em 3 dias" via Resend
- Recompute manual de match
- D23: replicar Cacula Mix structure pras 12 academias

Foundation Core Financeiro COMPLETA. Próximo: WhatsApp Bot ou IA Agente.
