# Sprint 4.0.4 — Polish Final + Email Alerts + Hybrid Auto

**Status:** ✅ CONCLUÍDO em 24/05/2026
**Suite testes:** 1849 → **1870 (+21 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled successfully

## Escopo

Fechamento do **Foundation Core Financeiro** (Sprints 4.0.1 → 4.0.4).
4 frentes nesta sprint:

1. **Email Alerts via Resend** (cron diário 08:00 dias úteis)
2. **Preferências do user** (`emailAlertsEnabled` + `emailAlertsFrequency`)
3. **UI /configuracoes/alertas** (toggle + frequência + envio de teste)
4. **Match híbrido AUTO no scan-by-import** (boost Claude pra faixa cinzenta)

## 1. Email Alerts

### Lib reutilizada (Sprint 1.5)

`lib/email/{client,send}.ts` já existiam (forgot password). Reusamos
`sendEmail()` — já trata `RESEND_API_KEY` ausente (skipped silent em dev),
sanitização de logs, validação de email destinatário.

### `lib/email/alerts-template.ts` — função PURA

`buildAlertEmail(input)` retorna `{ subject, html, isEmpty }`:
- HTML inline (sem React render — server-friendly, testável sem renderer)
- 3 buckets visuais (vermelho vencidas, âmbar 3d, cinza semana)
- Card "Total crítico" = vencidas + 3d (semana NÃO conta)
- CTA "Ver no Conta IA" → dashboard
- Link footer pra config (user pode pausar a qualquer momento)
- **Escape HTML em companyName** (defesa XSS)

### `lib/email/alerts-job.ts`

`runAlertsJob(options)`:
- Itera users com `emailAlertsEnabled=true`
- Filtra por `shouldRunForFrequency(freq, refDate, force)`:
  - `DAILY`: dias úteis (seg-sex)
  - `WEEKLY`: só segunda
  - `NONE`: nunca (exceto se `force=true` via endpoint manual)
  - Qualquer outro valor: **NÃO roda** (seguro)
- Pra cada empresa do user: calcula `AlertasResult` (reusa `classifyAlertas`
  do Sprint 4.0.3) → `buildAlertEmail` → `sendEmail` ou skip
- Audit via console.log (formato `[EmailAlerts] Job concluído em Xms: {...}`)

### `lib/email/alerts-scheduler.ts`

Cron `'0 8 * * *'` em `America/Sao_Paulo`. Job filtra dias úteis dentro
da função. Idempotência: guard `started` previne dupla inscrição.

Inicialização em `instrumentation.ts` (next stable API):
```ts
const { startRecurrenceScheduler } = await import('./lib/recurrence/scheduler')
startRecurrenceScheduler()
const { startAlertsScheduler } = await import('./lib/email/alerts-scheduler')
startAlertsScheduler()
```

## 2. Schema preferências

Migration `20260524000000_sprint_4_0_4_email_alerts_prefs`:

```sql
ALTER TABLE "users" ADD COLUMN "emailAlertsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "emailAlertsFrequency" TEXT NOT NULL DEFAULT 'DAILY';
```

**Default false (opt-in seguro):** users existentes NÃO recebem email sem
ativar manualmente em `/configuracoes/alertas`. Evita spam no primeiro deploy.

## 3. UI Configurações

`/configuracoes/alertas`:
- Toggle "Receber alertas por email"
- Select frequência (Diário / Semanal / Pausado)
- Botão "Enviar email de teste agora" (chama `/api/alerts/send-now` com `force=true`)

Estado é PATCH'd ao mudar (sem botão "Salvar" separado — UX leve).

## 4. Match híbrido AUTO

Modificado `app/api/conciliacao/scan-by-import/route.ts`:

```ts
let top = matches[0]
// Aplicar boost híbrido (Claude Haiku) na faixa 50-69
const candForBoost = candidates.find((c) => c.id === top.candidateId)
if (candForBoost) {
  top = await applyHybridBoost(top, ofx, candForBoost, companyId)
}
const recommendation = classifyRecommendation(top.score)
```

`applyHybridBoost` (Sprint 4.0.3):
- **SÓ chama Claude se score ∈ [50, 69]** (fora dessa faixa retorna no-op)
- Cache 24h em `AiClaudeCache` por hash(ofx+candidate)
- Boost 0-30pts clampado
- Falha de rede / API key ausente → score original preservado

**Custo controlado:** se Yussef importa 100 tx OFX com 20 candidatos cada,
no pior caso Claude é chamado ~5× (só na faixa cinzenta). Cache 24h
amortiza importações repetidas do mesmo OFX.

## Endpoints

- `GET /api/configuracoes/alertas` — retorna `{ emailAlertsEnabled, emailAlertsFrequency }`
- `PATCH /api/configuracoes/alertas` — atualiza preferências (Zod validation)
- `POST /api/alerts/send-now` — trigger manual (body opcional: `{ dryRun, force, baseUrl }`)

## Arquivos criados/modificados

### Novos (8)
- `lib/email/alerts-template.ts` (função pura)
- `lib/email/alerts-job.ts` (runAlertsJob + shouldRunForFrequency)
- `lib/email/alerts-scheduler.ts` (cron 08:00)
- `app/api/configuracoes/alertas/route.ts` (GET/PATCH preferências)
- `app/api/alerts/send-now/route.ts` (trigger manual)
- `app/(dashboard)/configuracoes/alertas/page.tsx`
- `__tests__/email-alerts-template.test.ts` (10 tests)
- `__tests__/email-alerts-job-frequency.test.ts` (11 tests)

### Modificados (3)
- `prisma/schema.prisma` (+ User.emailAlertsEnabled/Frequency)
- `instrumentation.ts` (+ startAlertsScheduler)
- `app/api/conciliacao/scan-by-import/route.ts` (+ applyHybridBoost auto)

### Migration
- `prisma/migrations/20260524000000_sprint_4_0_4_email_alerts_prefs/migration.sql`

## Métricas

```
Antes (Sprint 4.0.3):  1849 testes
Depois (Sprint 4.0.4): 1870 testes (+21, +1.1%)

Tempo planejado:  ~6h
Tempo real:       ~1.5h

TS strict: 0 erros
Build:     ✓ Compiled successfully in 3.1s
```

## Foundation Core completo — resumo dos 4 sprints

| Sprint | Entrega principal | Testes |
|---|---|---|
| 4.0.1.a | Lifecycle (EFFECTED/PAYABLE/RECEIVABLE) + Customer + AP UI | 1696 → 1734 (+38) |
| 4.0.1.b | Recurrence (cron 06:00) + AR UI + Clientes UI + DRE tabs | 1734 → 1782 (+48) |
| 4.0.2 | Conciliação (match algo + wizard + anti-dup DRE) | 1782 → 1822 (+40) |
| 4.0.3 | Fluxo Previsto + Alertas + Sidebar badges + Hybrid IA opt-in | 1822 → 1849 (+27) |
| 4.0.4 | Email alerts + Hybrid auto no scan | 1849 → 1870 (+21) |
| **Total** | **5 sprints, ~1 dia de execução** | **+174 testes** |

Foundation completa: AP/AR + Recurrence + Conciliação + Fluxo Previsto +
Alertas (in-app + email) + Match híbrido IA. 100% UI integrada.

## Smoke test pós-deploy

1. Migration aplicada: `SELECT "emailAlertsEnabled", "emailAlertsFrequency" FROM users LIMIT 1;`
2. Scheduler iniciado nos logs: `[EmailAlerts] Scheduler iniciado — cron="0 8 * * *"`
3. `/configuracoes/alertas` → ativar toggle → frequência DAILY
4. Clicar "Enviar email de teste agora" → toast "1 email enviado" (ou
   "0 + 1 sem alertas" se Cacula Mix tá zerada)
5. Verificar inbox (yussefmusa5522@gmail.com)
6. Importar OFX que case com PAYABLE em faixa cinzenta → scan-by-import
   chama Claude internamente (verificar AiClaudeCache table cresce)

## Próximo

Foundation Core 100% completa. Opções:

1. **Sprint 5.0 — D23**: replicar Cacula Mix structure pras 12 academias
2. **Sprint 5.0 — WhatsApp Bot**: IA #3 ULTRA via Meta Cloud API
3. **Sprint 4.1 — Tech Debt**: AiLearningRule filtros amount, Auth consolidation,
   Anthropic SDK oficial
