# Sprint 1.7 — CRUD CUPONS · Resumo

**Data:** 19/05/2026
**Branch:** `feat/sprint-1.7-cupons`
**Status:** FINALIZADA — última sprint da Onda 1 Foundation SaaS

---

## Escopo entregue

### Schema (Prisma + migration manual Postgres)
- `Coupon`: code (UNIQUE), description, type (PERCENTAGE | FIXED_AMOUNT | FREE_MONTHS), value (Decimal), freeMonths, validFrom/validUntil, maxUses, maxUsesPerUser, currentUses, status (ACTIVE/PAUSED/EXPIRED/EXHAUSTED/DEACTIVATED), createdById, deactivatedById/At
- `CouponRedemption`: couponId, userId (com `@@unique[couponId, userId]` enforced), snapshot fields (code/type/value), ipAddress/userAgent, redeemedAt
- `GerenciadorAuditLog.gerenciadorId` virou nullable (D11) — eventos de sistema
- Migration: `20260519000001_add_coupons_and_nullable_admin_audit/migration.sql`

### Backend (8 endpoints HTTP)
- `GET /api/admin/coupons` — lista paginada com filtros (q/status/type)
- `POST /api/admin/coupons` — criar (Zod completo, 409 em code duplicado)
- `GET /api/admin/coupons/[id]` — detalhe com últimos 100 resgates + user
- `PATCH /api/admin/coupons/[id]` — atualiza description/validUntil/maxUses/maxUsesPerUser (code/type/value são imutáveis)
- `POST /api/admin/coupons/[id]/pause` — só ACTIVE → PAUSED
- `POST /api/admin/coupons/[id]/resume` — só PAUSED → ACTIVE/EXPIRED/EXHAUSTED (decide conforme estado real)
- `DELETE /api/admin/coupons/[id]` — soft-delete (status=DEACTIVATED, deactivatedAt/By)
- `POST /api/coupons/validate` — PÚBLICO, rate-limit 10/min/IP, mensagem genérica anti-enumeration

Extensões em endpoints existentes:
- `POST /api/auth/cadastro` aceita `couponCode` opcional. Fire-and-forget (D13).

### Libs novas em `lib/coupons/`
- `types.ts` — `COUPON_CODE_REGEX`, `normalizeCouponCode`, `isValidCouponCode`
- `validate.ts` — `decideCouponValidity` (PURO) + `validateCoupon` (com Prisma) + `reasonToUserMessage`
- `apply.ts` — `redeemCoupon` atomic via `prisma.$transaction` (insert redemption + increment currentUses + auto EXHAUSTED se atingiu maxUses) + audit fire-and-forget
- `format.ts` — `formatCouponValue` (100% / R$ 49,90 / 3 meses grátis), labels pt-BR, cores dark mode por status/tipo, `formatUsage`
- `admin-schemas.ts` — Zod create/update/list + cross-validation (FREE_MONTHS exige freeMonths; PERCENTAGE cap 100%)
- `admin-helpers.ts` — `adminGuard` (host check + auth + active) + `logAdminAudit`

### UI Admin (3 páginas + 4 components)
- `/admin/cupons` — tabela com filtros (Código / Status / Tipo), badge de status, badge de tipo, contador, empty state
- `/admin/cupons/novo` — form completo com preview live, validação client-side, redirect pra detalhe após criar
- `/admin/cupons/[id]` — header com badge, grid 4x2 de propriedades, ações (Pausar/Reativar/Desativar), tabela de últimos 50 resgates
- Sidebar admin: removido `comingSoon` de Cupons, navega normal + highlight de subrota
- Vibe Linear-dark consistente com Sprint 1.6

### UI Cadastro Público
- Campo "Cupom (opcional)" no form `/cadastro`
- Auto-aplica `?cupom=XXX` da query string (link compartilhável)
- Badge verde quando aplicado, com remover
- Mensagens genéricas pra inválido / específica pra ALREADY_USED
- Suspense boundary pra `useSearchParams` (Next 16 requirement)

### Seed
- `scripts/seed-coupon-fundador.ts` — idempotente, cria FUNDADOR100 (100% off vitalício, maxUses=100). Atribui `createdById` ao primeiro Gerenciador OWNER ativo. Imprime link compartilhável.

---

## Testes

- **Antes:** 1427 tests
- **Depois:** **1489 tests (+62)**
- Distribuição:
  - `coupons-types.test.ts` — 9 (regex + normalize)
  - `coupons-format.test.ts` — 23 (formatCouponValue, labels, cores, formatUsage, type guards)
  - `coupons-validate-pure.test.ts` — 15 (decisão pura + reasonToUserMessage anti-enumeration)
  - `coupons-admin-schemas.test.ts` — 22 (create/update/list/validate Zod)
  - `coupons-public-rate-limit.test.ts` — 3 (10/min/IP, isolamento entre IPs, recovery)
  - `cadastro-coupon-validation.test.ts` — 6 (cadastroSchema com couponCode)
  - `schema-coupons.test.ts` — 17 (DMMF + migration SQL)

- TypeScript strict: ✅ 0 erros
- Build Next.js: ✅ todas as 8 rotas compiladas

---

## Decisões registradas (DECISOES.md)

- **D11** — `gerenciador_audit_log.gerenciadorId` nullable pra eventos de sistema
- **D12** — Snapshot fields em `coupon_redemptions` (auditoria à prova de mudança futura)
- **D13** — Resgate de cupom fire-and-forget no signup (não bloqueia cadastro)

---

## Segurança

- Anti-enumeration: `/api/coupons/validate` retorna 200 + mensagem genérica pra TODAS as falhas técnicas (NOT_FOUND/EXPIRED/EXHAUSTED/PAUSED/DEACTIVATED/NOT_YET_VALID). Apenas `ALREADY_USED` tem mensagem própria (UX explícita).
- Rate limit 10/min/IP em validação pública.
- Defesa em profundidade: `redeemCoupon` re-valida no servidor mesmo após validate-pré (race conditions).
- `@@unique([couponId, userId])` no banco enforça 1 resgate por usuário. P2002 do Prisma capturado → reason ALREADY_USED.
- Code imutável após criar (não tem PATCH pra ele) — preserva semântica de audit.

---

## Próximo passo: DEPLOY ONDA-1-COMPLETA

Procedimento documentado em `docs/DEPLOY.md` ETAPAS 5-8. Resumo:
1. Backup feito: `/opt/backups/pre-sprint-1-7-20260519-161614.sql.gz`
2. Pull no servidor
3. `bash scripts/swap-prisma-to-postgres.sh`
4. `npm run db:migrate:deploy`
5. `npx tsx scripts/seed-coupon-fundador.ts`
6. Build + restart PM2
7. Smoke 14 testes
8. Tag `sprint-1-7-completa` + tag histórica `onda-1-completa`

---

**Marco:** ONDA 1 Foundation SaaS — FINALIZADA. 7 sprints (1.1 → 1.7) entregaram fundação completa pra cobrança SaaS futura: subdomínios isolados, painel admin dark, audit, RBAC, email transacional, password reset, cupons com resgate atomic.

Próxima onda começa quando Yussef definir foco (Onda 2 Cobrança / Onda 3 Multi-tenant avançado / Onda 4 Métricas-MRR).
