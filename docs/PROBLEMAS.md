# Problemas Conhecidos — Conta IA

Registro histórico de bugs, dívidas técnicas e limitações conhecidas.

---

## Resolvidos

| # | Problema | Fase detectada | Resolvido em | Como |
|---|----------|---------------|--------------|------|
| 1 | CNPJ sem formatação na tela de detalhes (armazenado sem máscara) | FASE 1 | FASE 2 — Sub-etapa 2.1 | Criado `exibirCNPJ()` em `/lib/format/cnpj.ts`, aplicado nos displays |
| 2 | `next-env.d.ts` não estava no `.gitignore` | FASE 1 | FASE 1 (já estava resolvido) | Arquivo já constava no `.gitignore` desde a criação |
| 3 | Sidebar sem collapse no mobile | FASE 1 | FASE 2 — Sub-etapa 2.1 | Criado `DashboardShell` com hamburguer + overlay + botão fechar |
| 4 | Sem rate limiting nas APIs de autenticação | FASE 1 | FASE 2 — Sub-etapa 2.1 | Criado `/lib/rate-limit.ts` (in-memory). Login: 10 req/min. Cadastro: 5 req/hora |
| 5 | `package-lock.json` commitado | FASE 1 | — | Aceito intencionalmente — necessário para reprodutibilidade de builds |

---

## Abertos

| # | Problema | Impacto | Prioridade | Fase prevista |
|---|----------|---------|-----------|--------------|
| 1 | Rate limit em memória se perde ao reiniciar o servidor | Em produção com múltiplas instâncias, rate limit não funciona corretamente | Baixa (dev local) | FASE 7 (SaaS) — migrar para Redis |
| 2 | Sem refresh token — JWT expira em 24h | Usuário precisa fazer login todo dia | Média | FASE 3 |
| 3 | Sidebar sem suporte completo a navegação por teclado (acessibilidade) | A11y prejudicada | Baixa | Backlog |
| 4 | CNPJ do fornecedor não consultado na Receita Federal | Categorização automática depende de base local apenas | Alta | FASE 3 |

---

## Abertos — adicionados na FASE 2

| # | Problema | Impacto | Prioridade | Fase prevista |
|---|----------|---------|-----------|--------------|
| 5 | `prisma.category.createMany` sem `skipDuplicates` no SQLite | Sem impacto prático (categorias criadas só na criação de empresa) | Baixa | Migrar para PostgreSQL em produção |
| 6 | Rate limit Pluggy: sem retry exponencial em falhas de token | Em produção com alta carga poderia causar falhas intermitentes | Baixa | FASE 6 |
| 7 | Paginação OFX: arquivos muito grandes (>1000 transações) carregados inteiros na memória | Impacto em uploads de extratos anuais | Média | FASE 5 |

---

## Abertos — bugs de interface identificados na FASE 2.1

| # | Problema | Arquivo | Impacto | Prioridade | Fase prevista |
|---|----------|---------|---------|-----------|--------------|
| 8 | Botão "Nova Conta" ausente no header e no estado vazio da página global | `app/(dashboard)/contas-bancarias/page.tsx` | ALTO — usuário sem contas cadastradas não consegue criar conta a partir dessa página; botão só aparece dentro do loop quando já existem contas | Alta | FASE 2.1 |
| 9 | Botão "Nova Transação" ausente na página global de transações | `app/(dashboard)/transacoes/page.tsx` | ALTO — ícones `Plus` e `Upload` importados mas não usados; não há caminho para lançar transação manualmente a partir dessa página | Alta | FASE 2.1 |
| 10 | Handlers GET sem try/catch nas APIs de contas e transações | `app/api/contas-bancarias/route.ts:7` e `app/api/transacoes/route.ts:7` | MÉDIO — qualquer erro de banco (SQLite locked, connection drop) vira erro 500 sem mensagem útil; acesso a `t.bankAccount.company` no frontend é frágil se o include falhar | Média | FASE 2.1 |

---

## Dívida técnica

| # | Item | Descrição |
|---|------|-----------|
| 1 | `formatCNPJ` duplicado | Existe em `lib/utils.ts` e em `lib/format/cnpj.ts`. Remover de `utils.ts` quando todas as referências forem migradas |
| 2 | Testes sem cobertura de API routes | As API routes de empresa e auth não têm testes de integração. Cobrir na FASE 3 |
| 3 | Saldo em `BankAccount.balance` desnaturalizado | Saldo calculado via transações vs. campo desnaturalizado — em produção pode divergir se houver falha parcial. Decisão atual: manter desnaturalizado por performance, aceitar risco em MVP |
