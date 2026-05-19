# 🏆 Onda 1 — Foundation SaaS COMPLETA

**Período:** Sprints 1.1 → 1.7
**Conclusão:** 19/05/2026
**Branch principal:** `main` (merge fast-forward de todas as sprints)

---

## O que entregamos

A Onda 1 estabeleceu **toda a fundação SaaS** do CAIXAOS — a base sobre a qual qualquer monetização, multi-tenancy avançado, métricas e onboarding em escala vão construir.

### Sprint 1.1 — Multi-tenant via subdomínios
`app.caixaos.com.br` (cliente) + `admin.caixaos.com.br` (gerenciador), middleware host-aware decidindo rewrite/block.

### Sprint 1.2 — RBAC (Role-Based Access Control)
Roles canônicas (OWNER, ADMIN, CONTABILISTA, OPERADOR, VIEWER) + matriz de permissions + helpers `permissionMatches` / `expandPermissions`. Sidebar respeita o role.

### Sprint 1.3 — Subdomain routing endurecido
nginx 3 vhosts (`caixaos.com.br`, `app.caixaos.com.br`, `admin.caixaos.com.br`). proxy.ts em Next valida host + bloqueia `/admin*` quando acessado por host errado.

### Sprint 1.4 — Audit log de companies + diff de mutations
`audit_log` por empresa. UI `/empresas/[id]/auditoria` mostra timeline + diff JSON dos campos mudados.

### Sprint 1.5 — Email transacional Resend + esqueci-senha
Welcome email automático, código 6 dígitos pra reset, rate limit por IP. Templates React Email.

### Sprint 1.6 — Painel Admin completo
Tabela `Gerenciador` 100% separada da `User`. JWT_SECRET_ADMIN próprio. Cookie `Domain=admin.caixaos.com.br` literal. Endpoints `/api/admin/*` rejeitam quando chamados via host do app. UI dark "vibe Linear". Audit log próprio (`gerenciador_audit_log`).

### Sprint 1.7 — CRUD Cupons + onboarding com desconto (FINAL)
Cupons PERCENTAGE/FIXED_AMOUNT/FREE_MONTHS, status (ACTIVE/PAUSED/EXHAUSTED/EXPIRED/DEACTIVATED), maxUses + maxUsesPerUser, resgate atomic com snapshot. `/cadastro?cupom=FUNDADOR100` resgata automático. FUNDADOR100 seedado (100 vagas, vitalício, 100% off).

---

## Estatísticas finais da Onda

| Métrica | Antes da Onda 1 | Depois | Crescimento |
|---|---|---|---|
| Tests | ~1100 | **1489** | +389 |
| Migrations | 11 | **17** | +6 |
| Lib modules | ~30 | ~45 | +15 |
| API endpoints | ~25 | ~50 | +25 |
| Páginas (admin + app) | ~15 | ~30 | +15 |
| Decisões arquiteturais | 0 | **13** | (DECISOES.md inaugurado) |

TypeScript strict: ✅ 0 erros em toda a Onda.
Audit coverage: ✅ todas as mutations sensíveis geram audit log.
Security: ✅ anti-enumeration em todos os fluxos de auth, rate limit em endpoints críticos, JWT separados, cookies isolados por domínio.

---

## Os 13 marcos arquiteturais (D1-D13)

Decisões irreversíveis registradas em `docs/DECISOES.md`:

1. **D1** — Tabela `Gerenciador` separada do `User` (admin nunca vira cliente por bug)
2. **D2** — `JWT_SECRET_ADMIN` separado do `JWT_SECRET` do app
3. **D3** — Cookie `Domain=admin.caixaos.com.br` literal (host-exclusive)
4. **D4** — `users.role` mantém valor único `'CLIENT'` (cupons/planos vão em tabelas próprias)
5. **D5** — Anti-enumeration em fluxos de auth (mensagens genéricas)
6. **D6** — Rate limit em memória (lib/rate-limit.ts) — Redis quando escalar
7. **D7** — Resend pra email transacional
8. **D8** — Código 6 dígitos pra reset (não link com token)
9. **D9** — API routes em vez de Server Actions
10. **D10** — Branch `feat/sprint-N.M-*` + merge fast-forward em main
11. **D11** — `gerenciador_audit_log.gerenciadorId` NULL pra eventos de sistema
12. **D12** — Snapshot fields em `coupon_redemptions` (auditoria à prova de mudança)
13. **D13** — Resgate de cupom fire-and-forget no signup (não bloqueia cadastro)

---

## Próximas ondas — possíveis caminhos

A Onda 1 NÃO escolhe a próxima onda. Yussef decide com base em prioridade comercial. Caminhos disponíveis sobre a fundação:

### Onda 2 — Cobrança SaaS (recorrência)
Asaas/Stripe, planos por feature, billing portal, downgrade/upgrade, gracePeriod, dunning.

### Onda 3 — Multi-tenant avançado
Limites por plano (X empresas, Y users), data isolation hardening, tenant impersonation pra suporte.

### Onda 4 — Métricas
MRR/ARR, churn, cohort, ativação. Dashboard admin de saúde do produto.

### Onda 5 — Onboarding produto
Wizard 5 passos, video onboarding, achievement system, welcome tour.

---

## Mensagem pro Yussef compartilhar (FUNDADOR100)

> 🎉 Acabei de abrir o **CAIXAOS** — gestão financeira premium pra PME brasileira.
>
> Você está entre os **100 primeiros fundadores** convidados. Use o cupom **FUNDADOR100** no cadastro e o sistema fica **100% grátis pra sempre** pra você.
>
> 👉 https://app.caixaos.com.br/cadastro?cupom=FUNDADOR100
>
> Conta IA é o que a Conta Azul deveria ter sido. Sem reajuste-bomba. Sem suporte ruim. Sem dashboard fraco. Aqui:
>
> • Dashboard mundial que mostra TUDO em 30 segundos
> • Transferências entre contas que NÃO inflam o DRE
> • Cheque especial REAL configurado por conta (acabou a falsa "saldo zero")
> • IA que aprende a sua contabilidade (em breve)
> • Multi-empresa nativa
>
> Bora? São 100 vagas e o cupom é VITALÍCIO. Aproveite enquanto está aberto.

---

**Status oficial:** ✅ ONDA 1 — FOUNDATION SaaS COMPLETA · 19/05/2026
