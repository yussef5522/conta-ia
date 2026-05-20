# Problemas Conhecidos — CAIXAOS / Conta IA

Registro histórico de bugs, dívidas técnicas e limitações conhecidas.

---

## Resolvidos

| # | Problema | Fase detectada | Resolvido em | Como |
|---|----------|---------------|--------------|------|
| 1 | CNPJ sem formatação na tela de detalhes | FASE 1 | FASE 2 | `exibirCNPJ()` em `lib/format/cnpj.ts` |
| 2 | `next-env.d.ts` não no `.gitignore` | FASE 1 | FASE 1 | Já estava ignorado |
| 3 | Sidebar sem collapse mobile | FASE 1 | FASE 2 | `DashboardShell` + hamburguer + overlay |
| 4 | Sem rate limiting em auth APIs | FASE 1 | FASE 2 | `lib/rate-limit.ts` in-memory |
| 5 | `package-lock.json` commitado | FASE 1 | — | Mantido intencionalmente (build reprodutível) |
| 6 | CNPJ do fornecedor não consultado na Receita Federal | FASE 2 | FASE 3 Etapa 2 | `lib/ai-categorizer/brasilapi-client.ts` + CNAE mapping |
| 7 | Bancos do form ≠ bancos do OFX | FASE 2.1 | FASE 3 | `lib/bancos.ts` fonte única (15 bancos canônicos) |
| 8 | Banrisul reusa FITIDs (constraint quebrava) | FASE 2.1 | FASE 3 | `dedupHash = sha256(fitid+data+valor+memo)` |
| 9 | Botões "Nova Conta"/"Nova Transação" ausentes | FASE 2 | FASE 2.1 | Header + estado vazio + dropdowns |
| 10 | Handlers GET sem try/catch | FASE 2 | FASE 2.1 | try/catch + optional chaining |
| 11 | Transferências internas inflavam DRE | Sprint 0.5 | Sprint 0.5 | `transferGroupId` + filtro SQL + engine puro |
| 12 | Saldo negativo sem cheque especial visual | Sprint 0.5 | Sprint 0.5 | `allowNegativeBalance` + `creditLimit` real por conta |
| 13 | `/api/coupons/validate` redirecionava /login | Sprint 1.7 (smoke prod) | hotfix `d91285d` | Adicionado em `PUBLIC_API` do proxy.ts |
| 14 | Falta UI pra gerenciar regras IA | Onda 2 audit | Onda 2 Sprint 2.1 | Tela `/empresas/[id]/regras` |
| 15 | Falta UI pra gerenciar fornecedores | Onda 2 audit | Onda 2 Sprint 2.2 | Tela `/empresas/[id]/fornecedores` + validador CNPJ |
| 16 | Sem histórico/auditoria de imports OFX | Onda 2 audit | Onda 2 Sprint 2.3 | Migration `add_ofx_imports_history` + revert |
| 17 | OFX 1 por vez (sem multi-upload) | Onda 2 audit | Onda 2 Sprint 2.4 | `<MultiOfxDropZone>` sequencial |
| 18 | Sem visibilidade de freshness por conta | Onda 2 audit | Onda 2 Sprint 2.4 | `<FreshnessBadge>` 4 tiers |
| 19 | Docs ROADMAP/CLAUDE.md desatualizados | Onda 2 audit | Onda 2 Sprint 2.5 | Sincronizado com realidade do código |

---

## Abertos

| # | Problema | Impacto | Prioridade | Fase prevista |
|---|----------|---------|-----------|--------------|
| 1 | Rate limit em memória (`lib/rate-limit.ts`) se perde ao reiniciar PM2; não compartilha estado entre instâncias | OK com 1 instância (hoje); precisa Redis ao escalar | Baixa | Quando escalar |
| 2 | Sem refresh token — JWT expira em 24h | User loga todo dia | Média | Onda 3 ou backlog |
| 3 | Sidebar sem navegação por teclado completa (a11y) | A11y prejudicada | Baixa | Backlog |
| 4 | Saldo `BankAccount.balance` desnaturalizado | Pode divergir se falha parcial | Baixa | Aceito em MVP |
| 5 | `prisma.category.createMany` sem `skipDuplicates` (SQLite legacy) | Sem impacto em prod (Postgres já suporta) | Baixa | — |
| 6 | Paginação OFX: arquivos >1000 transações carregados inteiros na memória | Pode degradar com extratos anuais | Média | Quando der problema |
| 7 | Rate limit Pluggy: sem retry exponencial em falhas de token | Em pausa (FASE 10) | — | FASE 10 |
| 8 | Validação real ≥80% acerto IA ainda não feita | Block divulgação FUNDADOR100 | Alta | Sprint 2.6 (Yussef) |

---

## Dívida técnica

| # | Item | Descrição |
|---|------|-----------|
| 1 | `formatCNPJ` duplicado | Existe em `lib/utils.ts` e em `lib/format/cnpj.ts`. Remover de `utils.ts` |
| 2 | Testes API routes ausentes | Cobertura sem testes de integração — confiamos em pure functions + manual smoke |
| 3 | `package-lock` ESLint conflict | `npm install --legacy-peer-deps` em prod (eslint 8 vs eslint-config-next 16) |
| 4 | Modelo Claude hardcoded em `lib/ai-categorizer/claude-client.ts` | `claude-haiku-4-5-20251001` — quando atualizar, perguntar antes |
