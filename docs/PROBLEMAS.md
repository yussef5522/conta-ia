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

## Dívida técnica

| # | Item | Descrição |
|---|------|-----------|
| 1 | `formatCNPJ` duplicado | Existe em `lib/utils.ts` e em `lib/format/cnpj.ts`. Remover de `utils.ts` quando todas as referências forem migradas |
| 2 | Testes sem cobertura de API routes | As API routes de empresa e auth não têm testes de integração. Cobrir na FASE 3 |
