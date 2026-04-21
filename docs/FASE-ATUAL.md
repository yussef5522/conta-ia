# FASE 2 — Concluída ✅

**Data:** 2026-04-20  
**Versão:** 0.2.0  
**Branch:** main

---

## O que foi construído

### Sub-etapa 2.1 — Utilitários + Fixes FASE 1
- `lib/format/money.ts` — `formatBRL`, `formatBRLCompact`, `parseBRL`
- `lib/format/cnpj.ts` — `formatCNPJ` (máscara progressiva), `exibirCNPJ` (display formatado)
- `lib/rate-limit.ts` — rate limiting in-memory (login: 10/min, cadastro: 5/hora)
- `components/layout/dashboard-shell.tsx` — sidebar mobile com hamburguer + overlay
- Fix: CNPJ exibido formatado na tela de detalhes
- Fix: sidebar colapsável em mobile

### Sub-etapa 2.2 — Schema + Categorias por Setor
- Tabelas `Transaction` e `Category` adicionadas ao schema Prisma
- `lib/categories/defaults.ts` — categorias padrão por setor (SERVICE/RETAIL/RESTAURANT/INDUSTRY/MIXED)
- Seed automático de categorias ao criar empresa (7–14 por setor + comuns)

### Sub-etapa 2.3 — CRUD de Contas Bancárias
- `lib/validations/conta-bancaria.ts` — Zod schema
- API REST `/api/contas-bancarias` (GET/POST) e `/api/contas-bancarias/[id]` (GET/PUT/DELETE)
- Isolamento multi-tenant via `verificarAcesso(userId, contaId)`
- Formulário com seletor dos 10 principais bancos BR (BB, Santander, CEF, Bradesco, Itaú, Nubank, PagBank, Mercado Pago, C6, Inter)
- Listagem com card de saldo total (corrente + poupança) e ações por conta
- 22 testes de isolamento e validação

### Sub-etapa 2.4 — Transações + Saldo em Tempo Real
- `lib/validations/transacao.ts` — Zod schema (CREDIT/DEBIT, PENDING/RECONCILED/IGNORED)
- API REST `/api/transacoes` (GET paginado + filtros por período/tipo/status) e `/api/transacoes/[id]`
- Saldo da conta atualizado atomicamente via `prisma.$transaction` em CREATE/UPDATE/DELETE
- Formulário de lançamento manual com categoria filtrada por tipo (INCOME → entrada, EXPENSE → saída)
- Listagem com cards de saldo atual, entradas e saídas do período + paginação

### Sub-etapa 2.5 — Importação OFX/QFX
- `lib/ofx/parser.ts` — parser puro sem dependências externas
  - Suporte SGML (BB/Itaú/Bradesco) e XML (Nubank/fintechs)
  - Tolerante a erros: transações inválidas são ignoradas com aviso
- API `POST /api/contas-bancarias/[id]/importar-ofx` com `?preview=true` para pré-visualização
- Deduplicação automática via FITID (`@@unique([bankAccountId, externalId])`)
- Tela de upload com drag-and-drop, preview resumido (novas vs. duplicadas), confirmação antes de inserir
- 17 testes do parser OFX

### Sub-etapa 2.6 — Pluggy.ai (Open Finance)
- `lib/pluggy/client.ts` — cliente com autenticação e cache de token
- `PLUGGY_ENABLED` flag: sistema funciona normalmente sem credenciais (retorna 503 graciosamente)
- API `POST /api/pluggy/connect-token` — gera token para widget de conexão
- API `POST /api/pluggy/sincronizar` — sincroniza transações com deduplicação e ajuste atômico de saldo
- Para ativar: adicionar `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` ao `.env`

---

## Totais da FASE 2

| Métrica | Valor |
|---------|-------|
| Arquivos criados | ~35 |
| Linhas de código | ~3.200 |
| Testes (total acumulado) | 78 passando |
| Commits | 7 (2.1 → 2.6 + docs) |

---

## Estrutura de arquivos atual

```
conta-ia/
├── app/
│   ├── (auth)/login/ + cadastro/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── empresas/
│   │   │   ├── [id]/
│   │   │   │   ├── contas/               ← listagem de contas
│   │   │   │   │   ├── nova/             ← criar conta
│   │   │   │   │   └── [contaId]/
│   │   │   │   │       ├── editar/       ← editar conta
│   │   │   │   │       ├── importar/     ← upload OFX
│   │   │   │   │       └── transacoes/   ← listagem + lançamento
│   │   │   │   └── editar/
│   │   │   └── nova/
│   └── api/
│       ├── auth/ (login, cadastro, logout)
│       ├── empresas/
│       ├── contas-bancarias/ + [id]/ + [id]/importar-ofx/
│       ├── transacoes/ + [id]/
│       └── pluggy/ (connect-token, sincronizar)
├── components/
│   ├── ui/ (+ Textarea adicionado)
│   ├── layout/ (sidebar, header, dashboard-shell)
│   ├── empresas/
│   ├── contas-bancarias/
│   └── transacoes/
├── lib/
│   ├── auth.ts, db.ts, utils.ts
│   ├── format/ (money.ts, cnpj.ts)
│   ├── validations/ (auth, empresa, conta-bancaria, transacao)
│   ├── categories/defaults.ts
│   ├── ofx/parser.ts
│   └── pluggy/client.ts
├── prisma/schema.prisma (User, Company, UserCompany, BankAccount, Transaction, Category)
└── __tests__/ (7 arquivos, 78 testes)
```

---

## Como rodar localmente

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

Acesse: http://localhost:3000  
Login: `admin@contaia.com.br` / `ContaIA@2025`

Para ativar Pluggy, adicione ao `.env`:
```
PLUGGY_CLIENT_ID=seu_client_id
PLUGGY_CLIENT_SECRET=seu_client_secret
```

---

---

## FASE 2.1 — Correções pendentes (antes da FASE 3)

**Status:** aguardando aprovação para implementação  
**Data de identificação:** 2026-04-21

### Bug #8 — Botão "Nova Conta" ausente no header e estado vazio
- **Arquivo:** `app/(dashboard)/contas-bancarias/page.tsx`
- **Problema:** o botão "Nova Conta" só aparece dentro do loop `grupos.map` (quando já existem contas cadastradas). O `<Header>` não recebe `children`, e o estado vazio direciona apenas para "Ver Empresas", sem opção de criar conta diretamente.
- **Solução planejada:** adicionar botão "Nova Conta" como `children` do `<Header>` (sempre visível) e substituir o botão do estado vazio por "Nova Conta" com link para a empresa do usuário.
- **Impacto:** Alta — bloqueia fluxo de primeiro uso.

### Bug #9 — Botão "Nova Transação" ausente na página global
- **Arquivo:** `app/(dashboard)/transacoes/page.tsx`
- **Problema:** `Plus` e `Upload` são importados mas não utilizados no JSX. Não há botão de ação no `<Header>` nem na página. A rota `app/(dashboard)/transacoes/nova/` não existe.
- **Solução planejada:** adicionar botão "Nova Transação" no header que direciona para seleção de conta, depois para `/empresas/[id]/contas/[contaId]/transacoes/nova`. Remover imports não utilizados.
- **Impacto:** Alta — usuário não consegue lançar transação manual pela página global.

### Bug #10 — Handlers GET sem try/catch nas APIs
- **Arquivos:** `app/api/contas-bancarias/route.ts:7`, `app/api/transacoes/route.ts:7`
- **Problema:** os handlers `GET` de ambas as rotas não têm try/catch. Qualquer erro de banco retorna 500 sem mensagem estruturada. No frontend, `t.bankAccount.company.tradeName` em `transacoes/page.tsx:232` é acessado sem verificação defensiva.
- **Solução planejada:** adicionar try/catch em todos os handlers GET, retornar `{ erro: 'Mensagem em pt-BR' }` estruturado, adicionar verificações defensivas nos acessos a propriedades aninhadas no frontend.
- **Impacto:** Médio — não quebra em operação normal, mas qualquer hiccup do banco vira erro sem diagnóstico.

---

## FASE 3 — Próximo

Ver `docs/ROADMAP.md` para o planejamento completo.

Foco previsto da FASE 3: **IA Contadora para transações OFX (Claude API + BrasilAPI + aprendizado)**
