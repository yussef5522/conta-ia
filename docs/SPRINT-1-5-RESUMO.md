# Sprint 1.5 — Esqueci Senha + Resend + Convite Automático

**Data:** 2026-05-18
**Branch:** `feat/sprint-1.5-email-resend` → merged em `main`
**Status:** ✅ Entregue end-to-end

---

## Objetivo

Adicionar email transacional via Resend + 3 fluxos completos:

1. **Esqueci senha** com código de 6 dígitos (3 etapas premium)
2. **Convite Meu Time** automático via email (substitui copy-link-only do Sprint 1.4)
3. **Email de boas-vindas** quando user se cadastra (fire-and-forget)

---

## Infraestrutura

### Resend
- `lib/email/client.ts` — inicialização lazy + `isResendConfigured()` + `publicAppUrl()` (usa X-Forwarded-Host fix Sprint 1.4)
- `lib/email/send.ts` — wrapper genérico com log estruturado + validação + skip graceful em dev sem API key + `maskEmail()`
- `lib/email/render.ts` — helpers `renderForgotPasswordHtml/renderTeamInviteHtml/renderWelcomeHtml`

### Templates React Email
- `emails/_layout.tsx` — base compartilhada (header com Logo Chart, footer "CAIXAOS · A IA que organiza teu caixa em segundos", paleta `#0C447C`/`#185FA5`, max-width 600px, dark-mode safe)
- `emails/forgot-password.tsx` — código grande em codeBox gradient + aviso anti-phishing
- `emails/team-invite.tsx` — convite com role + papel descrição + botão CTA + fallback link
- `emails/welcome.tsx` — boas-vindas + 4 próximos passos numerados

---

## Schema novo

```prisma
model PasswordResetCode {
  id        String    @id @default(cuid())
  userId    String
  code      String    // bcrypt hash do código 6 dígitos
  codeHint  String?   // primeiros 2 dígitos pra UX ("48****")
  expiresAt DateTime  // now + 15 min
  usedAt    DateTime?
  attempts  Int       @default(0) // brute force guard (max 5)
  ipAddress String?
  userAgent String?
  createdAt DateTime  @default(now())
  user User @relation(...)
  @@index([userId])
  @@index([expiresAt])
}
```

Migration: `prisma/migrations/20260518000000_add_password_reset_code/migration.sql`

---

## Endpoints novos

| Endpoint | Função |
|---|---|
| POST `/api/auth/forgot-password` | Solicita código → cria PasswordResetCode → envia email. Anti-enumeration (sempre 200). |
| POST `/api/auth/verify-reset-code` | Verifica código 6 dígitos. Max 5 tentativas/código. Emite JWT scope=password-reset (15min). |
| POST `/api/auth/reset-password` | Recebe JWT + nova senha → atualiza User.password atomicamente + marca códigos como usados. |

Whitelistados em `proxy.ts`.

---

## Rate limits (in-memory)

| Camada | Limite | Identificador |
|---|---|---|
| Solicitação | 3 / 15 min | email |
| Reenvio | 1 / 60s | email |
| Verificação | 10 / 15 min | email |
| Tentativas/código (DB) | 5 / código | PasswordResetCode.attempts |

**Documentado em `docs/PROBLEMAS.md`:** rate limit em memória migrar pra Redis quando escalar além de 1 instância PM2.

---

## UI Premium — 3 etapas

`app/(auth)/esqueci-senha/`
- `page.tsx` — Server Component split 40/60 (hero gradient + form)
- `esqueci-senha-client.tsx` — máquina de estados (`email → code → password → success`) com `AnimatePresence` Framer Motion
- `code-input.tsx` — 6 caixas estilo Stripe/Vercel: auto-foco, auto-avanço, paste handler, backspace inteligente

**Features:**
- Countdown 15:00 (expiração código)
- Reenvio com cooldown 60s
- Hint "Código enviado para a***n@empresa.com.br" (mascara)
- Indicador de força da senha (fraca/média/forte) com 3 barras
- Checklist visual em tempo real (8 chars, letra, número)
- Auto-redirect /login após 3.5s do sucesso

---

## Audit log estendido

`lib/audit.ts` — `AuditAction` ganhou 7 ações novas:
- `PASSWORD_RESET_REQUESTED`
- `PASSWORD_RESET_VERIFIED`
- `PASSWORD_RESET_COMPLETED`
- `PASSWORD_RESET_FAILED`
- `TEAM_INVITE_SENT`
- `WELCOME_EMAIL_SENT`
- `EMAIL_DELIVERY_FAILED`

Audit registra `ipAddress`, `userAgent`, `metadata` (attempts, emailError, etc).

---

## Convite Meu Time com email

`app/api/empresas/[id]/usuarios/route.ts` (POST) modificado:
- Após criar `CompanyInvite` → chama `sendEmail({ to: invite.email, type: 'team-invite' })`
- Template `team-invite.tsx` recebe inviterName, companyName, roleName, roleDescription, inviteUrl, expiresInDays
- Resposta inclui `emailSent: boolean` pra UI mostrar feedback
- Audit `TEAM_INVITE_SENT` ou `EMAIL_DELIVERY_FAILED` registrado

UI atualizada:
- `LinkConviteModal` mostra ✅ "Email enviado para X" no topo
- Link copy continua disponível como fallback (WhatsApp)

---

## Welcome email no cadastro

`app/api/auth/cadastro/route.ts` modificado:
- Após `User.create` + cookie setado → **fire-and-forget** `void (async () => { await sendEmail({ type: 'welcome' }) })()`
- NUNCA bloqueia cadastro (try/catch silencioso)
- Captura `X-Forwarded-Host` ANTES de retornar (request scope termina depois)

---

## Tests (+37 novos)

- `email-send.test.ts` — 9 testes (maskEmail, isResendConfigured, skip dev)
- `password-reset-helpers.test.ts` — 16 testes (gerar código, hash/verify, password strength, JWT sign/verify)
- `forgot-password-rate-limit.test.ts` — 12 testes (constantes, 3 limits independentes, case-insensitive, libera após janela)

**Total: 1338 → 1375 testes / 99 arquivos.** Zero regressão.

---

## Decisões

### Por que Resend (não SendGrid/SES)?
- Setup mais simples (verificação DNS em 5 min)
- React Email templates first-class
- Free tier 3k emails/mês (suficiente pra MVP)
- SDK TypeScript bem documentado
- Dashboard com analytics nativo

### Por que código 6 dígitos vs link com token?
- UX padrão BR (Stripe/Conta Azul/Nibo)
- Anti-phishing: code não vaza por sharing de tela/screenshot acidental
- Anti-spam: rate limit mais simples
- Mobile-friendly: digitar 6 dígitos < clicar link em SMS/Gmail mobile

### Por que rate limit em memória (não Redis)?
- 1 instância PM2 — Redis seria overkill
- Cresce em complexidade quando escalar → marcado em `docs/PROBLEMAS.md` pra migrar quando passar de 1 instância

### Por que API routes (não Server Actions)?
- Consistência total com Sprints 1.2/1.3/1.4 (também API routes)
- Zero refactor desnecessário
- Testabilidade igual (function pura → endpoint)

---

## Como testar

### Local
```bash
# 1. Setar RESEND_API_KEY no .env
echo 'RESEND_API_KEY=re_test_xxx' >> .env
echo 'RESEND_FROM_EMAIL=no-reply@caixaos.com.br' >> .env

# 2. Subir
npm run dev

# 3. Acessar
open http://localhost:3000/esqueci-senha
```

### Produção
1. `https://app.caixaos.com.br/login` → click "Esqueci minha senha"
2. Digitar `admin@contaia.com.br`
3. Receber código no email
4. Inserir código → trocar senha → consegue logar

---

## Próximos passos

**Sprint 1.6** — Tabela `Gerenciador` + login admin em `admin.caixaos.com.br` (~2h)

Detalhes em `docs/ONDA-1-PLANO.md`.
