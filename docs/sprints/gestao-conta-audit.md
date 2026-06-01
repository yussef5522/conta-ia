# Sprint Gestão de Conta — Auditoria + Plano (Fase 1)

**Branch:** `feature/gestao-conta-admin-cliente`
**Data:** 31/05/2026
**Status:** ⏳ aguardando aprovação do Yussef

---

## 1. Infra existente (REUSAR — não criar paralelo)

### 1.1 Painel admin (`/admin`)
- ✅ Subdomain routing `admin.caixaos.*` → `/admin/*` (proxy.ts + `lib/middleware/subdomain.ts`)
- ✅ Bloqueio 404 pra `/admin/*` via host não-admin
- ✅ Login isolado: `Gerenciador` model + JWT separado (`JWT_SECRET_ADMIN`)
- ✅ Sessão: `lib/admin-auth/session.ts` (`getAdminSession`, `loadGerenciador`)
- ✅ Audit log dedicado: `GerenciadorAuditLog` (action, entityType, entityId, metadata JSON, IP, UA, createdAt)
- ✅ RBAC: `Gerenciador.role = OPERADOR | OWNER`
- ✅ Sidebar: 4 itens. **Clientes** e **Métricas** marcados `comingSoon`
- ✅ Páginas existentes: `/admin/login`, `/admin/dashboard`, `/admin/cupons` (CRUD completo)

### 1.2 Auth do app (reusar pra reset/change password)
- ✅ Bcrypt rounds **12** (consistente em todos os 6 lugares: login, cadastro, reset, admin login)
- ✅ Lib hash: `bcryptjs` (`bcrypt.hash(senha, 12)`, `bcrypt.compare(senha, hash)`)
- ✅ Validação de força: `checkPasswordStrength()` em `lib/auth/password-reset.ts`
- ✅ Cookie httpOnly via `lib/auth.ts` (COOKIE_NAME=`auth_token`, JWT_SECRET separado)
- ✅ Fluxo "esqueci senha" maduro: 3 endpoints + Resend + rate-limit triplo + model `PasswordResetCode`

### 1.3 Campo NOVO necessário
| Campo | Tipo | Default | Razão |
|---|---|---|---|
| `User.mustChangePassword` | Boolean | `false` | Setado `true` quando admin reseta senha → próximo login força tela "defina nova senha" antes do dashboard |

**Não existe hoje.** Migration aditiva sem default-fill nada (nenhum user atual estará forçando troca; admin define `true` só nos resets futuros).

---

## 2. Árvore de dependências do `User` (LGPD — crítico)

### 2.1 Mapeamento completo das FK pro User

| Tabela | Coluna | `onDelete` | Comportamento ao excluir User |
|---|---|---|---|
| `SavedView` | `userId` | **Cascade** | Apaga as views customizadas |
| `UserCompany` | `userId` | **Cascade** | Apaga vínculo. ⚠️ **Company NÃO é apagada automaticamente** — fica órfã se mais ninguém vinculado |
| `UserCompanyRole` | `userId` | **Cascade** | Apaga atribuição de role |
| `CompanyInvite` | `invitedById` | **Cascade** | Apaga convites enviados |
| `PasswordResetCode` | `userId` | **Cascade** | Apaga códigos pendentes |
| `CouponRedemption` | `userId` | **Cascade** | Apaga resgates de cupom |
| `OfxImport` | `userId` | **Cascade** | Apaga histórico de imports |
| `OfxImport` | `revertedById` | *sem onDelete = Restrict* | ⚠️ Erro se OFX foi revertido pelo user |
| `AuditLog` | `userId` | **SetNull** ✅ | Preserva histórico anonimizado (correto pra LGPD/fiscal — log de transação fica) |
| `CategoryHistory` | `userId` | **SetNull** ✅ | Histórico de mudança de categoria preserva (`userId=null`) |
| `AiUsageLog` | `userId` | **Cascade** | Apaga logs de uso de IA |
| `AiInsightsLog` | `userId` | **Cascade** | Apaga logs de insights |
| `RecurringSchedule` | `createdById` | *sem onDelete = Restrict* | ⚠️ **BLOQUEIA exclusão** se user criou agendamento recorrente |
| `CompanyTaxProfile` | `createdById` (nullable) | *sem onDelete = Restrict* | ⚠️ **BLOQUEIA** se user criou perfil tributário |

### 2.2 Riscos identificados

| Risco | Causa | Decisão proposta |
|---|---|---|
| ⚠️ **Companies órfãs** | UserCompany cascade apaga vínculo mas Company sobrevive | Excluir company se for o ÚNICO `UserCompany` apontando |
| ⚠️ **Bloqueio FK Restrict (OfxImport.revertedById)** | Sem onDelete | Antes do delete, `UPDATE OfxImport SET revertedById=null WHERE revertedById=userId` |
| ⚠️ **Bloqueio FK Restrict (RecurringSchedule.createdById)** | Sem onDelete | Deletar `RecurringSchedule` da company antes (companies serão apagadas em seguida) |
| ⚠️ **Bloqueio FK Restrict (CompanyTaxProfile.createdById nullable)** | Sem onDelete | `UPDATE CompanyTaxProfile SET createdById=null WHERE createdById=userId` |
| ✅ Companies multi-user | Yussef tem academias compartilhadas? | Por enquanto: **não apaga company se outro user também tem vínculo** |

### 2.3 Algoritmo da exclusão (atomic via `$transaction`)

```
BEGIN TX
  1. SELECT companies WHERE userId tem UserCompany única (sem outros UserCompany)
     → lista de companies a apagar em cascade
  2. UPDATE OfxImport SET revertedById=null WHERE revertedById=:userId
  3. UPDATE CompanyTaxProfile SET createdById=null WHERE createdById=:userId
  4. DELETE RecurringSchedule WHERE createdById=:userId
  5. DELETE Company WHERE id IN (lista do passo 1)
     → cascade automático: BankAccount → Transaction, Category, CostCenter,
       Supplier, Customer, Employee, AiLearningRule, Role custom da company,
       AuditLog, CompanyInvite, CompanyTaxProfile
  6. DELETE User
     → cascade automático: SavedView, UserCompany restantes (de companies de outros donos),
       UserCompanyRole, AiUsageLog, AiInsightsLog, CouponRedemption,
       PasswordResetCode, OfxImport (próprias do user) restantes
  7. AuditLog.userId nullados via SetNull (preserva histórico anonimizado)
  8. CategoryHistory.userId nullados via SetNull (preserva histórico)
COMMIT

→ Audit GerenciadorAuditLog: action=ADMIN_DELETE_USER, metadata={
    userId, userEmail, userName,
    companiesDeleted: [...ids],
    companiesKept: [...ids onde ainda tem outros donos],
    countSchedules, countOfxImports, countCoupons, ...
  }
```

**Atomicidade:** tudo num `prisma.$transaction([...])` ou `prisma.$transaction(async tx => {...})`. Falha em qualquer passo → rollback completo.

---

## 3. Plano de execução (Fase 2)

### Parte A — LADO ADMIN (`/admin/clientes`)

**A.1 Schema** (migration aditiva, BACKUP antes)
```prisma
model User {
  // ...existente
  mustChangePassword Boolean @default(false)
}
```

**A.2 Página `/admin/clientes`** (server component, visual dark Linear-like coerente com `/admin/cupons`)
- Tabela: `name | email | createdAt | mustChangePassword(badge) | nº empresas | ações`
- Busca por nome/email (query param `?q=`)
- Paginação (mesma do `/admin/cupons` — 50 por página)
- Click numa linha → `/admin/clientes/[userId]` (detalhe com 3 ações)

**A.3 Endpoints admin** (todos exigem `getAdminSession()` + re-auth com senha do gerenciador)
- `GET /api/admin/clientes` — list + search + paginate
- `GET /api/admin/clientes/[userId]` — detalhe + contagens (empresas, transações, cupons)
- `POST /api/admin/clientes/[userId]/reset-password` — re-auth → gera senha temp 16 chars (alphanumeric + símbolo) → bcrypt hash → `update User { password, mustChangePassword: true }` → audit → **retorna a senha temp no response** (mostrada UMA vez na tela, admin copia e repassa pro cliente)
- `PATCH /api/admin/clientes/[userId]/email` — re-auth → valida formato Zod + unicidade no `User.email` → update → audit `{ oldEmail, newEmail }`
- `DELETE /api/admin/clientes/[userId]` — re-auth + body `{ confirmEmail }` deve bater com `user.email` → executa cascade do §2.3 → audit `{ snapshot }`

**Audit actions novas** em `GerenciadorAuditLog`:
- `ADMIN_RESET_USER_PASSWORD`
- `ADMIN_CHANGE_USER_EMAIL`
- `ADMIN_DELETE_USER`

**A.4 Force-change no 1º login**
- `POST /api/auth/login`: após validar senha, **se `mustChangePassword=true`** → retornar `{ success: true, mustChangePassword: true }` SEM setar cookie de auth completo. UI redireciona pra `/trocar-senha` (rota nova).
- Rota nova `/trocar-senha` (em `(auth)/`): form com `nova senha + confirmar`. Reusa `checkPasswordStrength`. POST `/api/auth/me/change-password` (criado na Parte B) com flag `firstLogin: true` → após sucesso, seta `mustChangePassword=false` e cookie httpOnly normal.

### Parte B — AUTOATENDIMENTO (`/minha-conta`)

**B.1 Rota** `/minha-conta` em `(dashboard)/` (cliente logado) — 3 seções verticais (Perfil · Segurança · Zona de perigo)

**B.2 Endpoints app** (todos exigem `getAuthUser` do app, scope=user)
- `PATCH /api/auth/me/perfil` — body `{ name }` (Zod) → update + audit no AuditLog do app
- `POST /api/auth/me/change-password` — body `{ currentPassword, novaSenha }` → `bcrypt.compare` da atual → `checkPasswordStrength` na nova → bcrypt hash → update + zera `mustChangePassword` se estava true → invalida `PasswordResetCode` pendentes
- `DELETE /api/auth/me` — body `{ currentPassword, confirmText: "EXCLUIR" }` → re-auth → executa cascade do §2.3 → limpa cookie + redirect `/login`

### Parte C — RBAC / Multi-tenant
- Cliente NUNCA acessa `/admin/*` (proxy.ts já bloqueia 404)
- Cliente NUNCA acessa `/api/admin/*` (proxy.ts já bloqueia 404 + endpoints validam admin session)
- `/api/admin/clientes/*` retornam 401 se sem `admin_session` válido + 401 se senha re-auth errada (3 tentativas → lockout 15min via `lib/rate-limit.ts`)

---

## 4. Testes mínimos (+30 alvo)

```ts
describe('Admin /api/admin/clientes', () => {
  // list + search
  test('GET lista clientes paginado')
  test('GET filtra por nome/email')
  test('GET sem admin_session → 401')

  // reset password
  test('POST reset-password gera senha 16 chars + mustChangePassword=true')
  test('POST reset-password exige re-auth senha gerenciador')
  test('POST reset-password com re-auth errada 3x → lockout')
  test('POST reset-password grava audit ADMIN_RESET_USER_PASSWORD')

  // change email
  test('PATCH email valida formato Zod')
  test('PATCH email rejeita email já existente (unique)')
  test('PATCH email grava audit com oldEmail e newEmail')

  // delete user — cascade complexo
  test('DELETE exige confirmEmail batendo com user.email')
  test('DELETE apaga company só se for único UserCompany')
  test('DELETE preserva company de outro dono (multi-user)')
  test('DELETE nula OfxImport.revertedById (FK Restrict)')
  test('DELETE nula CompanyTaxProfile.createdById')
  test('DELETE apaga RecurringSchedule (FK Restrict)')
  test('DELETE atomic: falha em 1 passo → rollback completo')
  test('DELETE preserva AuditLog/CategoryHistory via SetNull')
  test('DELETE grava ADMIN_DELETE_USER com snapshot')
})

describe('Force change password', () => {
  test('login com mustChangePassword=true retorna flag + NÃO seta cookie auth')
  test('/trocar-senha aceita nova senha e zera mustChangePassword')
  test('após trocar, login normal funciona')
})

describe('/minha-conta autoatendimento', () => {
  test('PATCH perfil atualiza nome')
  test('PATCH perfil exige user logado')
  test('POST change-password valida senha atual com bcrypt.compare')
  test('POST change-password rejeita senha fraca')
  test('DELETE me exige currentPassword + confirmText=EXCLUIR')
  test('DELETE me apaga companies próprias + preserva companies de outros')
  test('DELETE me limpa cookie de auth')
})

describe('Segurança multi-tenant', () => {
  test('cliente comum não acessa /admin/* (proxy 404)')
  test('cliente não chama /api/admin/clientes/[outroId]')
  test('admin reset-password NUNCA expõe senha do cliente — só a temporária recém-gerada')
})
```

**Alvo:** +30 testes (estimativa real **~32**).

---

## 5. Riscos & decisões pendentes

| # | Pergunta | Proposta |
|---|---|---|
| 1 | Senha temporária — email automático pro cliente OU admin copia e repassa manualmente? | **Admin copia e repassa** (mostrar UMA vez na UI). Email pode vir em fase posterior — evita complexidade no MVP. |
| 2 | Mudança de email do cliente — manda email de verificação pro novo endereço? | **Não no MVP** (admin já está atuando como autoridade). Yussef confirma o email correto antes de submeter. |
| 3 | Company com 2+ donos: ao excluir 1 user, mantém a company com o outro? | **Sim** — só apaga company se for o último UserCompany. Auditado no metadata. |
| 4 | Mostrar senha temp na UI ou copiá-la pro clipboard auto? | **Copiar pra clipboard automático + mostrar na tela** com countdown 60s pra fechar. |
| 5 | RBAC: `OPERADOR` pode resetar/trocar email/excluir, ou só `OWNER`? | **MVP: ambos podem.** Refino em sprint futura (OPERADOR sem excluir). |

---

## 6. Estimativa de esforço

| Etapa | Esforço |
|---|---|
| Schema + migration `mustChangePassword` | 15min |
| `/admin/clientes` lista + busca + detalhe | 1h |
| 3 endpoints admin (reset/email/delete) com re-auth | 1h30 |
| Force-change no login + rota `/trocar-senha` | 45min |
| `/minha-conta` (3 seções) + 3 endpoints app | 1h |
| Testes ~32 | 1h30 |
| Build + deploy + smoke prod | 30min |
| **Total** | **~6h** |

---

## 7. Checklist de aprovação

Por favor confirmar antes de eu começar a Fase 2:

- [ ] **Migration aditiva** `mustChangePassword` + backup prod antes
- [ ] **Cascade User** segundo §2.3 (preservar AuditLog/CategoryHistory via SetNull; apagar companies só se único dono)
- [ ] **Senha temp**: mostrada UMA vez na UI + clipboard auto (sem email automático no MVP)
- [ ] **Force-change no 1º login** via rota `/trocar-senha`
- [ ] **Re-auth do gerenciador** em todas as 3 ações sensíveis + lockout 3 tentativas
- [ ] **Audit log** com 3 actions novas (RESET / CHANGE_EMAIL / DELETE)
- [ ] **MVP RBAC**: OPERADOR e OWNER iguais (refino depois)
- [ ] **Testes**: ~32 alvo
- [ ] **Smoke prod**: 6 cenários do brief original
