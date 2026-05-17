# ONDA 1 — Foundation SaaS · Plano de Execução

> **Sprint 1.1 — Investigação + Plano**
> **Data:** 17/05/2026
> **Backup pre-Onda-1:** `/opt/backups/pre-onda1-sprint-1-1-20260517-021549.sql.gz` (140K)
> **Status:** Plano completo, aguardando aprovação do Yussef pra iniciar Sprint 1.2

---

## 🎯 Contexto estratégico

Transformar Conta IA de "aplicação que Yussef usa pra Cacula Mix" em SaaS multi-tenant
cobrável. Modelo: **ganhar de Conta Azul e Nibo em UX, preço e visual.**

### Decisões já tomadas (chat Claude.ai, 16/05)

1. **Dois sistemas SEPARADOS** (subdomínios + tabelas isoladas):
   - `app.contaia.com.br` — usuários clientes (todos `role=CLIENT`)
   - `admin.contaia.com.br` — painel gerenciador SECRETO (tabela `Gerenciador` separada)
2. **Pricing**: Trial 14d / Essencial R$49 / Profissional R$99 / Enterprise R$299
3. **Big Bang Launch**: cupons (FUNDADOR100 etc) → testers via WhatsApp → público depois
4. **Botões 100% funcionais** (zero placeholder): "Esqueci senha" → email + código 6 dígitos
5. **Visual sempre vs Conta Azul** primeiro, versão Conta IA mais bonita

---

## 🔍 Investigação do estado atual (banco prod)

### Volume

| Tabela | Registros |
|---|---|
| `users` | 1 (Yussef admin@contaia.com.br) |
| `companies` | 1 (Cacula Mix) |
| `user_companies` | 1 |
| `user_company_roles` | 1 |
| `roles` | 5 (system defaults) |
| `permissions` | 33 |
| `role_permissions` | 108 |
| `company_invites` | 0 (zerado) |
| `audit_log` | 344 |

### Schema existente — **GRANDE NOTÍCIA: 90% já está pronto**

| Funcionalidade Onda-1 | Existe? | Tabela/Coluna | Decisão |
|---|---|---|---|
| Auth email+senha+JWT cookie | ✅ | `users` + `lib/auth.ts` | **Reaproveitar** |
| Multi-tenant N:N user↔company | ✅ | `user_companies` | **Reaproveitar** |
| RBAC granular | ✅ | `roles`, `permissions`, `role_permissions`, `user_company_roles` | **Reaproveitar** |
| Catálogo permissions | ✅ | 33 permissions / 8 grupos | **Reaproveitar** |
| Roles default (OWNER, ADMIN, ACCOUNTANT, FINANCIAL, VIEWER) | ✅ | `roles.isSystemDefault=true` | **Reaproveitar** |
| Convite por email (token + role + expira) | ✅ | `company_invites` | **Reaproveitar (Sprint 1.4)** |
| Audit log completo | ✅ | `audit_log` | **Reaproveitar (incluir ações Onda-1)** |
| Esqueci senha + reset com código | ❌ | — | **Adicionar (Sprint 1.5)** |
| Painel admin separado (Gerenciador) | ❌ | — | **Adicionar (Sprint 1.6)** |
| Cupons | ❌ | — | **Adicionar (Sprint 1.7)** |
| Plano + subscription em companies | ❌ | — | **Adicionar (Sprint 1.6/1.7)** |

### Decisões sobre mudanças pendentes no `git diff`

**`prisma/schema.prisma`**:
```diff
- provider = "sqlite"
+ provider = "postgresql"
```
**`prisma/migrations/migration_lock.toml`**: comentário + provider trocado de sqlite → postgresql.

**Origem:** `scripts/swap-prisma-to-postgres.sh` é executado a CADA deploy via SSH (padrão dual SQLite-dev / Postgres-prod documentado em `docs/DEPLOY.md`).

**Decisão:** **NÃO commitar, NÃO reverter.** É parte intencional do workflow. As mudanças voltam toda vez que o swap roda. O repo no GitHub fica em SQLite (dev), o servidor fica em postgresql (prod) — esse é o design.

**`.env.save`** (untracked): backup do `nano` quando Yussef editou .env pra adicionar `ANTHROPIC_API_KEY`. **Inofensivo, posso deletar no próximo deploy** (não toca em Sprint 1.1).

---

## 🏗️ Arquitetura proposta

### Princípio inviolável: SEPARAÇÃO TOTAL app vs admin

```
┌──────────────────────────────────────┐  ┌──────────────────────────────────┐
│   app.contaia.com.br                 │  │  admin.contaia.com.br            │
│   (clientes)                         │  │  (Gerenciador secreto)           │
├──────────────────────────────────────┤  ├──────────────────────────────────┤
│  Tabela: users                       │  │  Tabela: gerenciadores           │
│    role = 'CLIENT' SEMPRE            │  │    (NUNCA cruza com users)       │
│  Auth: JWT cookie "ci_session"       │  │  Auth: JWT cookie "admin_session"│
│  Middleware: proxy.ts → /app/*       │  │  Middleware: proxy.ts → /admin/* │
│  Login: /login (rota pública)        │  │  Login: /admin/login (não indexa)│
└──────────────────────────────────────┘  └──────────────────────────────────┘
```

**Garantias:**
- Cliente NUNCA pode "virar admin" (tabelas diferentes, cookies diferentes)
- Compromisso de user no app NÃO compromete admin
- robots.txt bloqueia `admin.*` no Google
- Yussef CLIENTE (`yussefmusa5522@gmail.com`?) ≠ Yussef GERENCIADOR (`gerenciador@contaia.com.br`)

### `users.role` — manter mas normalizar

O default já é `CLIENT`. O único user atual está como `ADMIN` (legacy do tempo single-user).

**Decisão:**
- **Manter coluna** `users.role` com 1 único valor: `CLIENT` pra todos (legalidade futura: STAFF/BETA via cupons, não via role).
- **Migration em Sprint 1.6**: UPDATE users SET role='CLIENT' WHERE role='ADMIN'
- **NÃO** introduzir SUPERADMIN no users (Yussef rejeitou explicitamente).

---

## 📦 Schema deltas — o que adicionar

### 1. `users` — adicionar campos pra reset de senha (Sprint 1.5)

```prisma
model User {
  // ... (campos atuais)
+ emailVerifiedAt DateTime?   // pra confirmação futura
+ lastLoginAt     DateTime?   // dashboard admin

  // Relations existentes mantidas
+ passwordResets  PasswordResetToken[]
}
```

### 2. `PasswordResetToken` — NOVA TABELA (Sprint 1.5)

```prisma
model PasswordResetToken {
  id          String   @id @default(cuid())
  userId      String
  codeHash    String   // hash do código 6 dígitos (NUNCA salva em claro)
  expiresAt   DateTime // now + 15min
  usedAt      DateTime?
  attempts    Int      @default(0) // brute force protection
  ipAddress   String?
  createdAt   DateTime @default(now())

  user        User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}
```

**Justificativa:** Token JWT em cookie é overkill pra reset. Código 6 dígitos é UX padrão (Stripe, Conta Azul, Nibo). Hash com bcrypt + rate limit 5 tentativas.

### 3. `companies` — adicionar fields de plano (Sprint 1.6 ou 1.7)

```prisma
model Company {
  // ... (campos atuais)

+ // Fase SaaS — Onda 1
+ plan              String   @default("TRIAL")
+   // TRIAL | ESSENCIAL | PROFISSIONAL | ENTERPRISE
+ planStatus        String   @default("ACTIVE")
+   // ACTIVE | EXPIRED | SUSPENDED | CANCELLED
+ trialEndsAt       DateTime?  // null = não está em trial
+ planExpiresAt     DateTime?  // próxima cobrança / fim trial
+ couponCode        String?    // cupom aplicado ATIVO (1 por empresa)
+ couponAppliedAt   DateTime?
+ couponExpiresAt   DateTime?  // null = vitalício
}
```

### 4. `Coupon` — NOVA TABELA (Sprint 1.7)

```prisma
model Coupon {
  id              String   @id @default(cuid())
  code            String   @unique    // FUNDADOR100, BETA50, etc
  description     String
  discountPercent Int                 // 0-100
  durationMonths  Int?                // null = vitalício
  maxUses         Int?                // null = ilimitado
  usedCount       Int      @default(0)
  expiresAt       DateTime?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  createdById     String              // gerenciadorId

  @@map("coupons")
}

// Quem usou cada cupom — auditoria
model CouponRedemption {
  id          String   @id @default(cuid())
  couponId    String
  companyId   String
  userId      String   // quem aplicou
  redeemedAt  DateTime @default(now())
  expiresAt   DateTime? // copia coupon.durationMonths

  coupon      Coupon  @relation(fields: [couponId], references: [id], onDelete: Restrict)
  @@unique([couponId, companyId])  // mesma empresa não pode usar mesmo cupom 2x
  @@index([companyId])
  @@map("coupon_redemptions")
}
```

### 5. `Gerenciador` — NOVA TABELA, ISOLADA (Sprint 1.6)

```prisma
// Painel admin SECRETO — NUNCA cruza com User do app.
// Acesso só por admin.contaia.com.br.
// Apenas Yussef no início. Pode adicionar contadores parceiros depois.
model Gerenciador {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  password      String              // bcrypt rounds 12 (igual users)
  lastLoginAt   DateTime?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  auditLogs     GerenciadorAuditLog[]

  @@map("gerenciadores")
}

// Audit log dos admins (SEPARADO do audit_log das companies)
model GerenciadorAuditLog {
  id             String   @id @default(cuid())
  gerenciadorId  String
  action         String   // COUPON_CREATE, COMPANY_SUSPEND, etc
  entityType     String?
  entityId       String?
  metadata       String?  // JSON
  ipAddress      String?
  userAgent      String?
  timestamp      DateTime @default(now())

  gerenciador    Gerenciador @relation(fields: [gerenciadorId], references: [id], onDelete: Cascade)

  @@index([gerenciadorId, timestamp(sort: Desc)])
  @@index([action])
  @@map("gerenciador_audit_log")
}
```

**Por que NÃO usar `users` com `role=ADMIN`?**
- Yussef rejeitou explicitamente
- Bug que troca role do user CLIENT pra ADMIN viraria escalation de privilégio crítica
- LGPD: dados de admin não devem misturar com dados de cliente
- Tabela separada → impossível por construção

---

## 🚏 Migrations em ordem

| # | Sprint | Migration | Tabelas/campos |
|---|---|---|---|
| M1 | 1.5 | `add_password_reset_tokens` | `PasswordResetToken`, `User.emailVerifiedAt`, `User.lastLoginAt` |
| M2 | 1.6 | `add_gerenciador_table_and_company_plan` | `Gerenciador`, `GerenciadorAuditLog`, `Company.plan/trialEndsAt/planExpiresAt/planStatus` |
| M3 | 1.6 | `normalize_users_role_to_client` | UPDATE users SET role='CLIENT' WHERE role!='CLIENT' |
| M4 | 1.7 | `add_coupons_and_redemptions` | `Coupon`, `CouponRedemption`, `Company.couponCode/couponAppliedAt/couponExpiresAt` |

**Cada migration: backup obrigatório antes.**

---

## 📅 Roadmap detalhado dos Sprints 1.2 → 1.7

| Sprint | Escopo | Estimativa | Migrations | Dependências |
|---|---|---|---|---|
| **1.2 — Login premium** | Refazer `/login` com visual fintech (vs Conta Azul). Brand bar, animações sutis, layout split (hero + form). | 2h | — | — |
| **1.3 — Middlewares + DNS** | Refatorar `proxy.ts` em dois middlewares: `/app/*` (clientes) e `/admin/*` (gerenciadores). Suporte a host header `admin.*`. Atualizar nginx pra dois server blocks. | 2h | — | DNS config (Yussef config domínio) |
| **1.4 — Meu Time** | Página `/empresas/[id]/usuarios` (PROVAVELMENTE JÁ EXISTE — investigar e refinar). Convidar funcionário por email → cria `CompanyInvite` → email com link aceitar. | 2h | — | Pasta `app/(dashboard)/empresas/[id]/usuarios` já existe (validado via build) |
| **1.5 — Esqueci senha** | `/esqueci-senha` → email com código 6 dígitos → `/recuperar-senha?token=xxx` → nova senha. Migration M1. | 3h | M1 | Email transacional (configurar) |
| **1.6 — Gerenciador + admin** | Tabela `Gerenciador` + login em `admin.contaia.com.br/login` + dashboard básico (MRR, contagens). Migration M2 + M3. | 2h | M2, M3 | DNS + nginx do 1.3 |
| **1.7 — Cupons** | Tabela `Coupon` + CRUD no admin + lógica de aplicação no signup (`/cadastro?cupom=FUNDADOR100`). Migration M4. | 2h | M4 | Sprint 1.6 (admin pronto) |

**Total estimado: ~12-13h dev**

---

## ⚠️ Riscos identificados

### R1 — User atual com `role=ADMIN` legacy
**Impacto:** Baixo (1 registro). Migration M3 normaliza pra `CLIENT`.
**Mitigação:** Migration testada em backup local antes de prod.

### R2 — DNS subdomínios
**Impacto:** Médio. Precisa configurar A records `app.contaia.com.br` e `admin.contaia.com.br` + nginx server blocks + Let's Encrypt cert duplo.
**Mitigação:** Sprint 1.3 separa middleware ANTES do DNS estar pronto (pode rodar com host header injetado em dev). DNS é tarefa do Yussef (não código).

### R3 — Email transacional pra reset de senha
**Impacto:** Médio. Hoje não há SMTP configurado.
**Mitigação:** Sprint 1.5 prevê configurar Resend (mais simples que SendGrid). Alternativa MVP: rota mostra código na resposta JSON em dev/staging (NUNCA em prod).

### R4 — `users.role` text livre pode receber valor inválido
**Impacto:** Baixo. Hoje só CLIENT/ADMIN/OWNER são distinct.
**Mitigação:** Validação Zod nos endpoints (já temos padrão). Migration M3 enforce.

### R5 — Convites existentes e dados de auditoria não previstos
**Impacto:** Baixo. `company_invites` está vazio. `audit_log` tem 344 entradas que continuam válidas.
**Mitigação:** Nenhuma mudança destrutiva nestes dados.

### R6 — Múltiplos `companyId=null` em `roles` (system defaults)
**Impacto:** Nenhum — design intencional. Sistema funciona perfeitamente.
**Mitigação:** N/A.

### R7 — Migration sem ROLLBACK trivial
**Impacto:** Alto se erro.
**Mitigação:** Backup obrigatório antes de cada migration (regra Yussef). Migrations testadas em SQLite dev primeiro via `db push`, depois aplicadas com `migrate deploy` em prod com backup pré-aplicação.

### R8 — Cookie `admin_session` vs `ci_session` colidem
**Impacto:** Médio. Se cookies estão em mesmo domínio raiz (`.contaia.com.br`), ambos vazam pra subdomínios.
**Mitigação:** Definir `Domain` explicitamente:
- `ci_session` → `Domain=app.contaia.com.br`
- `admin_session` → `Domain=admin.contaia.com.br`
Sem prefixo `.` → cookie NÃO vaza entre subdomínios.

---

## ✅ Checklist Sprint 1.1 (este sprint)

- [x] Backup criado em `/opt/backups/pre-onda1-sprint-1-1-20260517-021549.sql.gz`
- [x] Análise das mudanças pendentes do git diff (origin: swap-prisma-to-postgres.sh)
- [x] Decisão documentada: **NÃO commitar, NÃO reverter** — padrão dual SQLite/Postgres intencional
- [x] Estrutura de tabelas inspecionada (8 tabelas auth-relacionadas)
- [x] Contagem + roles + permissions auditados
- [x] Gap mapeado: 90% já existe, 4 tabelas/campos a adicionar
- [x] Documento `docs/ONDA-1-PLANO.md` criado
- [ ] Resumo executivo entregue (próximo passo)
- [ ] Aprovação Yussef → iniciar Sprint 1.2

---

## 📝 Notas finais

1. **NÃO toquei em código** — Sprint 1.1 é só investigação + plano.
2. **NÃO criei migration** — só listei o que precisa criar nas Sprints futuras.
3. **NÃO fiz deploy** — backup só, schema atual intacto.
4. **NÃO commitei mudanças** — apenas escrevi este documento.
5. **Yussef aprova → Sprint 1.2** segue com visual premium da tela de login validado contra Conta Azul.

---

**Documento mantido em `docs/ONDA-1-PLANO.md` — atualizar a cada Sprint da Onda 1.**
