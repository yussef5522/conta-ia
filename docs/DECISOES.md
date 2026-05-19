# Decisões Arquiteturais — CAIXAOS

Decisões irreversíveis ou de alto impacto registradas pra futuras consultas.
Cada decisão tem **contexto**, **opções consideradas**, **escolha**, **razão**.

---

## D1 — Dois sistemas COMPLETAMENTE separados (app + admin)

**Contexto:** Onda 1 SaaS, necessidade de painel administrativo.

**Opções:**
- (A) Coluna `role=SUPERADMIN` na tabela `User` do app
- (B) Tabela `Gerenciador` totalmente separada, em subdomínio próprio
- (C) Página admin restrita por IP / VPN

**Escolha:** **(B)** — `Gerenciador` em tabela isolada + subdomínio `admin.caixaos.com.br`.

**Razão:**
- Impossibilidade de promoção acidental: bug que mude role do User pra SUPERADMIN viraria escalation crítica
- Compromisso de user no app NÃO compromete admin (cookies/JWT separados)
- LGPD: dados de admin NÃO misturam com dados de cliente
- Audit log separado (`gerenciador_audit_log` vs `audit_log` de companies)
- Por construção: cliente NUNCA "vira admin" porque NEM EXISTE no banco do admin

**Registrado em:** ONDA-1-PLANO.md (Sprint 1.1) · Sprint 1.6 implementou.

---

## D2 — JWT_SECRET separados (app vs admin)

**Contexto:** Sprint 1.6 implementa autenticação do painel admin.

**Opções:**
- (A) Reusar `JWT_SECRET` único pra tokens de app E admin (diferenciar por `scope`)
- (B) Criar `JWT_SECRET_ADMIN` separado, isolado do app

**Escolha:** **(B)** — secrets totalmente separados.

**Razão:**
- Vazamento de `JWT_SECRET` (app) NÃO compromete admin (e vice-versa)
- Princípio de privilégio mínimo: admin precisa de blast radius reduzido
- Rotação independente: posso rotacionar secret admin sem invalidar sessões dos clientes
- Custo: 1 linha extra no `.env`, zero overhead operacional

**Implementação:** `lib/admin-auth/jwt.ts` lê `JWT_SECRET_ADMIN`. Verifica scope `admin-session`.

---

## D3 — Cookie Domain literal pra isolamento absoluto

**Contexto:** App em `app.caixaos.com.br`, admin em `admin.caixaos.com.br`. Subdomínios do mesmo apex.

**Opções:**
- (A) Cookie `Domain=.caixaos.com.br` — vale em todos os subdomínios
- (B) Cookie `Domain=admin.caixaos.com.br` (literal, sem ponto inicial) — só admin
- (C) Sem `Domain` (host-only) — só host setou

**Escolha:** **(B)** pro admin + **(C)** pro app (já é o comportamento default existente).

**Razão:**
- `Domain` sem ponto inicial = host-exclusive (browsers respeitam por spec RFC 6265)
- Garante que `admin_session` NÃO é enviado pra `app.caixaos.com.br`
- App cookie `auth_token` continua host-only (já era assim) → não vaza pro admin
- Segundo perímetro de defesa: nginx tem 3 vhosts separados (Sprint 1.3)

**Implementação:** `getAdminCookieOptions()` em `lib/admin-auth/jwt.ts`. Override via `ADMIN_COOKIE_DOMAIN=off` em dev.

---

## D4 — `users.role` permanece string mas valor único `'CLIENT'`

**Contexto:** Schema tem coluna `User.role` legacy (default `'CLIENT'`, mas 1 user `'ADMIN'`).

**Opções:**
- (A) Remover coluna `role` do `User` (drop)
- (B) Manter coluna + normalizar TODOS pra `'CLIENT'`
- (C) Manter coluna + permitir valores diversos (`STAFF`, `BETA`, etc)

**Escolha:** **(B)** — manter coluna mas TODO user é `'CLIENT'`.

**Razão:**
- Drop teria que migrar referências (potencialmente em queries existentes)
- Permitir múltiplos valores deixa porta aberta pra "escalation acidental" (problema central que D1 resolve)
- Cupons + planos futuros vão usar `Coupon`/`Subscription` separados, não `role`
- Migration M3 (Sprint 1.6) normalizou: `UPDATE users SET role='CLIENT' WHERE role != 'CLIENT'`

---

## D5 — Anti-enumeration em fluxos de auth

**Contexto:** Endpoints `/forgot-password`, `/admin/login`, `/cadastro` podem revelar se um email existe.

**Opções:**
- (A) Retornar erro específico "Email não cadastrado"
- (B) Retornar mensagem genérica que NÃO revela existência

**Escolha:** **(B)** pro forgot-password e admin/login. **Específico só pra cadastro** (UX) — email duplicado retorna 409.

**Razão:**
- Atacante usa diferença entre respostas pra enumerar usuários cadastrados
- Tempo constante: usar `bcrypt.compare` mesmo com user inexistente (delay simulado)
- Logs no servidor diferenciam (auditoria) mas resposta HTTP é genérica
- Trade-off aceito: usuário pode ficar confuso se digitou email errado, mas segurança ganha

**Implementação:**
- `/forgot-password` (Sprint 1.5): sempre 200 + `maskedEmail`
- `/admin/login` (Sprint 1.6): sempre 401 + "Credenciais inválidas"

---

## D6 — Rate limit em memória (lib/rate-limit.ts)

**Contexto:** Várias camadas (login app, login admin, forgot-password) precisam rate limit.

**Opções:**
- (A) Redis
- (B) In-memory `Map` no Node
- (C) Sem rate limit (assumir uso normal)

**Escolha:** **(B)** — `Map` in-memory.

**Razão:**
- 1 instância PM2 hoje — Redis seria overengineering
- Setup zero (sem dependência externa)
- Latência <1ms
- Custo: estado perdido em restart (aceitável: limites de janela 15 min, restart raro)
- Registrado em `PROBLEMAS.md` pra migrar Redis quando escalar > 1 instância

---

## D7 — Resend pra email transacional

**Contexto:** Sprint 1.5 — esqueci senha + convite + welcome precisam enviar email.

**Opções:**
- SendGrid · Resend · Amazon SES · Postmark · Mailgun

**Escolha:** **Resend**.

**Razão:**
- Setup mais simples (verificação DNS em 5 min)
- React Email templates first-class (compatível com nosso stack Next.js)
- Free tier 3k emails/mês (suficiente pra MVP)
- Dashboard com analytics nativo (bounces, opens)
- SDK TypeScript bem documentado

**Implementação:** `lib/email/` (Sprint 1.5). `RESEND_API_KEY` no `.env`.

---

## D8 — Código 6 dígitos vs link com token (reset de senha)

**Contexto:** Sprint 1.5 — UX do fluxo "Esqueci minha senha".

**Opções:**
- (A) Link em email com token longo (`?token=xxx`)
- (B) Código 6 dígitos numérico

**Escolha:** **(B)** — código 6 dígitos.

**Razão:**
- UX padrão BR (Stripe, Conta Azul, Nibo) — usuários conhecem
- Anti-phishing: código NÃO vaza por sharing acidental de tela/screenshot
- Mobile-friendly: digitar 6 dígitos > clicar link em SMS/Gmail mobile
- Rate limit por tentativas mais simples (5 tentativas/código)

---

## D9 — API routes em vez de Server Actions

**Contexto:** Next.js 16 oferece Server Actions como alternativa a API routes.

**Opções:**
- (A) Server Actions (`app/.../actions.ts`)
- (B) API routes (`app/api/.../route.ts`)

**Escolha:** **(B)** — API routes em TODO o projeto.

**Razão:**
- Consistência com código existente (Sprints 1.2-1.5 todas usam)
- Testabilidade: function pura → endpoint chama; mock direto via fetch
- Cacheabilidade: middleware proxy.ts intercepta `/api/*` uniformemente
- Server Actions têm RPC implicit complexity (formData binding, etc) — preferimos JSON explícito

---

## D10 — Branch `feat/sprint-N.M-descricao` + merge ff em main

**Contexto:** Workflow git pra sprints da Onda 1.

**Escolha:** Branch por sprint + merge fast-forward em main.

**Razão:**
- Histórico linear (sem merge commits poluindo log)
- Atomic: 1 sprint = 1 commit grande no main (mais 1-2 hotfixes pequenos)
- Branch fica viva no GitHub pra referência/PR review futuro
- Tag `sprint-N.M-completa` marca cada entrega

---

## D11 — `gerenciador_audit_log.gerenciadorId` NULL pra eventos de sistema

**Contexto:** Sprint 1.7 — `COUPON_REDEEMED` é disparado pelo signup do usuário, NÃO por um gerenciador logado. FK NOT NULL forçaria criar um "Gerenciador sistema" fake.

**Opções:**
- (A) Criar `Gerenciador` sentinel ("system") com email reservado
- (B) Tornar `gerenciadorId` NULL com semântica "evento de sistema"
- (C) Tabela separada `system_audit_log` (duplica infra)

**Escolha:** **(B)** — `gerenciadorId String?` nullable.

**Razão:**
- Sentinel exige row "fake" no banco, complica seeds e gera 2 semânticas pro mesmo campo
- Semântica clara: `gerenciadorId IS NULL` = ação automática do sistema
- Mantém 1 tabela única de audit (queries de auditoria não bifurcam)
- Migration faz `ALTER COLUMN DROP NOT NULL` + recria FK com `ON DELETE CASCADE` (mantém comportamento atual)

**Implementação:** `prisma/migrations/20260519000001_*` faz o ALTER. `redeemCoupon` em `lib/coupons/apply.ts` insere audit com `gerenciadorId: null`.

---

## D12 — Snapshot fields em `coupon_redemptions`

**Contexto:** Sprint 1.7 — cupom pode mudar de descrição/datas após resgates já existirem (edição admin permite mudar `description`, mas valor/type/code são imutáveis por design).

**Opções:**
- (A) Só guardar `couponId` na redemption; sempre buscar valor "atual" do cupom
- (B) Snapshot do estado do cupom no momento do resgate (code, type, value)
- (C) Bloquear toda edição do cupom após primeiro resgate

**Escolha:** **(B)** — `codeSnapshot`, `typeSnapshot`, `valueSnapshot` na redemption.

**Razão:**
- Auditoria: resgate guarda exatamente o que o cliente "pegou" mesmo que o cupom mude depois
- Relatórios fiscais futuros não dependem de estado atual da config
- Cupom EXAURIDO permanece consultável: dá pra reconstruir histórico sem JOIN
- `code` no schema é imutável (não tem PATCH pra ele); snapshot redundante mas barato e à prova de futuro

**Trade-off:** ~30 bytes extras por resgate. Aceito.

---

## D13 — Resgate de cupom é fire-and-forget no signup

**Contexto:** Sprint 1.7 — `POST /api/auth/cadastro` recebe `couponCode` opcional. Falha na aplicação do cupom deve barrar o cadastro?

**Opções:**
- (A) Cadastro 100% atomic: cupom inválido faz rollback do user
- (B) Fire-and-forget: cadastro sempre cria user; cupom é aplicado em paralelo (UI já validou antes)
- (C) Atomic + retornar erro específico de cupom (user tem que retentar)

**Escolha:** **(B)** — fire-and-forget.

**Razão:**
- UI já validou via `POST /api/coupons/validate` ANTES de submeter — caminho feliz já garantido
- Race condition rara (cupom exaure entre validate e cadastro) é tolerável: user cadastra sem desconto, contadores ficam consistentes (servidor é fonte da verdade)
- Falha de cupom NÃO deve bloquear cadastro (UX premium: "ah que pena, não pegou, mas você já está dentro")
- Atomicidade do user (criação + JWT + welcome email) já é alta — empilhar cupom em cima aumenta blast radius

**Implementação:** `app/api/auth/cadastro/route.ts` chama `void redeemCoupon(...)` SEM await; falha vira `console.warn` (logs em produção pra Yussef monitorar).

---

**Doc mantido em `docs/DECISOES.md`. Atualizar a cada decisão significativa.**
