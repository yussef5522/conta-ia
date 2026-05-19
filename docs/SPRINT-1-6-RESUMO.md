# Sprint 1.6 — Painel Gerenciador (admin.caixaos.com.br)

**Data:** 2026-05-18
**Branch:** `feat/sprint-1.6-gerenciador-panel` → merged em `main`
**Status:** ✅ Entregue end-to-end

---

## Objetivo

Criar o sistema GERENCIADOR completamente isolado do sistema cliente.
URL secreta `admin.caixaos.com.br`. Tabela separada. Cookie isolado. JWT secret próprio.

---

## Decisões registradas

Ver `docs/DECISOES.md`:
- **D1** — Dois sistemas separados (não SUPERADMIN no User)
- **D2** — `JWT_SECRET_ADMIN` separado do `JWT_SECRET`
- **D3** — Cookie `Domain=admin.caixaos.com.br` literal (host-exclusive)
- **D4** — `users.role` normalizado pra `'CLIENT'`

---

## Schema novo

```prisma
model Gerenciador {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String
  role         String    @default("OPERADOR") // OPERADOR | OWNER
  active       Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  auditLogs    GerenciadorAuditLog[]
}

model GerenciadorAuditLog {
  id            String   @id @default(cuid())
  gerenciadorId String
  action        String   // ADMIN_LOGIN, ADMIN_LOGOUT, ADMIN_LOGIN_FAILED, ...
  entityType    String?
  entityId      String?
  metadata      String?  // JSON
  ipAddress     String?
  userAgent     String?
  createdAt     DateTime @default(now())
}
```

Migration: `20260519000000_add_gerenciador_and_normalize_users_role`

**Migration M3 (normalização legacy):** 1 user `admin@contaia.com.br` (Yussef, role=`ADMIN` legacy) → `CLIENT`. 2 users já eram CLIENT. Total: 3 users CLIENT após migration.

---

## Lib admin-auth

- `lib/admin-auth/jwt.ts`:
  - `signAdminToken({ sub, email, name, role })` + `verifyAdminToken(token)`
  - Scope: `admin-session` · TTL 24h · `JWT_SECRET_ADMIN`
  - `getAdminCookieOptions()` aplica `Domain=admin.caixaos.com.br` em prod
- `lib/admin-auth/session.ts`:
  - `getAdminSession()` (server components) + `getAdminSessionFromRequest()` (middleware) + `loadGerenciador()` (DB fresh)
- `lib/admin-auth/rate-limit.ts`:
  - `checkAdminLoginRateLimit(request)` — 5 tentativas / 15 min POR IP

---

## 3 endpoints novos

| Endpoint | Função |
|---|---|
| POST `/api/admin/login` | Bcrypt compare + JWT + cookie + audit `ADMIN_LOGIN` ou `ADMIN_LOGIN_FAILED`. Rate limit 5/15min/IP. Host check defensivo (404 se chamado via app). |
| POST `/api/admin/logout` | Clear cookie + audit `ADMIN_LOGOUT` |
| GET `/api/admin/me` | Retorna gerenciador fresh do banco (checa `active`) |

Todos os 3 retornam **404** se chamados via `app.caixaos.com.br` (defesa em profundidade).

---

## Middleware host-aware (proxy.ts)

Sprint 1.6 estendeu `proxy.ts`:
- `/api/admin/*` em host não-admin → **404**
- `/admin/*` em admin host sem `admin_session` válido → **redirect `/admin/login`**
- `/admin/login` com cookie válido → **redirect `/admin/dashboard`**
- App routes intactas (`ci_session`/`auth_token` continua funcionando)

---

## UI premium DARK (vibe Linear)

- `app/admin/layout.tsx` — bg `#0a0a0a`, color `#e5e5e5`, `colorScheme: dark`
- `app/admin/login/page.tsx` + `login-form.tsx`:
  - Sem logo CAIXAOS chamativo (apenas mono uppercase tracked)
  - Inputs `#171717`, border `#262626`, focus accent `#3b82f6`
  - Botão primary `#185FA5` (brand sutil)
  - Anti-enumeration: erro genérico "Credenciais inválidas"
- `app/admin/dashboard/page.tsx`:
  - 4 KPI cards (Clientes, Empresas, MRR placeholder, Novos 7d)
  - Tabela "Últimos 10 cadastros"
  - `AdminSidebar` com nav (Dashboard ativo + Clientes/Cupons/Métricas Soon)
  - Logout no rodapé da sidebar (hover destrutivo)
- `app/admin/components/`:
  - `admin-sidebar.tsx` — nav 220px dark
  - `stat-card.tsx` — KPI card #0f0f0f border #1f1f1f

---

## Seed inicial

`scripts/seed-gerenciador.ts` (idempotente):
- Email: `gerenciador@caixaos.com.br`
- Senha temporária: `CaixaOS@Founder2026!` (Yussef troca depois)
- Name: `Yussef Musa`
- Role: `OWNER`

Rodar 1x em prod após migration:
```bash
cd /opt/conta-ia && npx tsx scripts/seed-gerenciador.ts
```

Idempotente: roda 2x → log "Já existe → skip" sem erro.

---

## JWT_SECRET_ADMIN — geração segura

Gerado direto no servidor sem expor o valor:
```bash
ssh root@198.211.103.10 'echo "JWT_SECRET_ADMIN=$(openssl rand -base64 64 | tr -d \"\\n\")" >> /opt/conta-ia/.env'
```

**Pra trocar o secret no futuro** (rotação anual ou após suspeita de vazamento):
```bash
# 1. Backup .env
cp /opt/conta-ia/.env /opt/conta-ia/.env.backup-$(date +%Y%m%d-%H%M%S)
# 2. Gerar novo
sed -i 's|^JWT_SECRET_ADMIN=.*|JWT_SECRET_ADMIN='"$(openssl rand -base64 64 | tr -d '\n')"'|' /opt/conta-ia/.env
# 3. Reload PM2
pm2 reload conta-ia --update-env
# Efeito: todas as sessões admin invalidadas, gerenciador precisa logar de novo (efeito desejado)
```

---

## Tests (+22 novos)

- `__tests__/admin-jwt.test.ts` — 10 testes (roundtrip, isolation entre secrets, scope check, expiração, cookie options dev/prod/override)
- `__tests__/admin-rate-limit.test.ts` — 5 testes (5/15min por IP, IPs distintos, libera após janela)
- `__tests__/admin-cookie-isolation.test.ts` — 7 testes (cookie names diferentes, JWT app rejeitado em verifyAdminToken, scope errado rejeitado, isAdminHost)

**Total: 1397 testes / 102 arquivos (+22 vs 1375 Sprint 1.5). Zero regressão.**

---

## Smoke prod 10/10

| # | Cenário | Resultado |
|---|---|---|
| 1 | GET `/admin/login` em admin.caixaos.com.br | ✅ HTTP 200, dark UI |
| 2 | GET `/admin/dashboard` sem cookie | ✅ 307 → `/admin/login` |
| 3 | POST `/api/admin/login` válido | ✅ Set-Cookie admin_session + 200 |
| 4 | POST `/api/admin/login` inválido | ✅ HTTP 401 "Credenciais inválidas" |
| 5 | GET `/admin/dashboard` com cookie | ✅ HTTP 200, KPIs + tabela |
| 6 | Cookie app.caixaos.com.br NÃO acessa admin | ✅ Redirect /admin/login |
| 7 | Cookie admin NÃO acessa app | ✅ App ignora admin_session (cookie names diferentes) |
| 8 | Rate limit 6ª tentativa | ✅ HTTP 429 + Retry-After |
| 9 | Audit `ADMIN_LOGIN` no banco | ✅ Registrado em `gerenciador_audit_log` |
| 10 | GET `/api/admin/login` via app host | ✅ HTTP 404 (host check) |

---

## Credenciais iniciais

```
URL:    https://admin.caixaos.com.br/login
Email:  gerenciador@caixaos.com.br
Senha:  CaixaOS@Founder2026!
```

**Troque a senha** após o primeiro login (Sprint 1.7+ adiciona `/admin/perfil`; por ora trocar via SQL):
```sql
-- Gerar bcrypt hash da nova senha primeiro (Node REPL):
-- > require('bcryptjs').hashSync('NovaSenhaForte123!', 12)
UPDATE gerenciadores SET "passwordHash" = '<hash-gerado>' WHERE email = 'gerenciador@caixaos.com.br';
```

---

## Próximo passo

**Sprint 1.7** — CRUD Cupons em `admin.caixaos.com.br/cupons`. Tabela `Coupon` + `CouponRedemption`. Aplicação no signup `/cadastro?cupom=FUNDADOR100`. ~2h.

Ver `docs/ONDA-1-PLANO.md` Sprint 1.7.
