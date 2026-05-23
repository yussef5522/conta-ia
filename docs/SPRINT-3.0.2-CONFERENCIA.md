# Sprint 3.0.2 — Conferência de Transações

**Status:** ✅ EXECUTADO
**Data:** 23/05/2026
**Commits:** 4 (e3cf1ea, 0960259, [commit A4], ec95fea)
**Suite testes:** 1564 → **1582 (+18)**

---

## Contexto

Yussef precisava de workflow pós-import OFX: importar → IA classifica → conferir uma por uma com filtros + visibilidade do que a IA decidiu.

Investigação anterior identificou que **backend tinha tudo**, faltava apenas UI mostrar. Sprint focado em camada de apresentação + 1 ajuste de API (incluir `classifiedByRule` no GET).

---

## 5 features entregues

### A1 — Filtro por categoria em `/transacoes`
- **API:** `GET /api/transacoes?categoryId=cuid...` (já passa pro Prisma `where.categoryId`)
- **URL parser:** Zod valida cuid (rejeita XSS/SQLi)
- **UI:** dropdown shadcn com cor + nome, opção "Todas"
- **Persistência:** `?categoryId=X` na URL (bookmarkable)
- **Limpeza:** botão "Limpar" aparece quando filtro ativo

### A2 — Busca por descrição
- **API:** `GET /api/transacoes?q=texto` → `where.description: { contains, mode: 'insensitive' }`
- **URL parser:** trim + min 1 + max 200 (defesa)
- **UI:** input com ícone `<Search>` + botão `<X>` interno
- **Debounce:** 300ms via useEffect
- **Persistência:** `?q=texto`

### A3 — Modo Conferência pós-import
- **API:** `GET /api/transacoes?importId=cuid...` → filtra tx desse OFX
- **URL parser:** `?conferencia=true|1` → boolean
- **Redirect automático:** após `POST /importar-ofx`, se response tem `importId`:
  - `router.push('/transacoes?empresaId=X&importId=Y&conferencia=true')`
- **UI:** banner destacado no topo com `<Sparkles>` + contagem + botão "Concluir e voltar"
- **Ativo quando:** `conferencia=true` E `importId` presente

### A4 — Badges IA Source + Confidence
- **Componente novo:** `<AiSourceBadge source confidence ruleName compact />`
- **5 sources com cores semanticamente diferentes:**
  - 🟢 RULE — emerald (`<KeyRound>`)
  - 🟡 KEYWORD — amber (`<Bot>`)
  - 🟣 CLAUDE — purple (`<Sparkles>`)
  - 🔵 BRASILAPI — blue (`<Globe2>`)
  - ⚪ MANUAL — zinc (`<User>`)
- **Confidence:** "95%" inline (formato compact ou full)
- **Tooltip rico:** "Aplicada pela regra: ATACADAO · Confiança: 95%"
- **API:** include de `classifiedByRule { id, padrao, tipoMatch }` em `/api/transacoes` pra alimentar tooltip
- **Helpers PUROS exportados:** `formatConfidence`, `confidenceTier` (testáveis)

### B3 — Total R$ por categoria + Drill-down
- **API:** `GET /api/empresas/[id]/categorias?comTotais=true`
  - `groupBy` SQL agregado (sem N+1)
  - Só inclui tx `RECONCILED` (PENDING/IGNORED ignoradas — não distorcem)
- **buildTree:** 2 novos campos no `CategoryNode`:
  - `totalAmount` — próprio da categoria
  - `totalAmountRollup` — próprio + descendentes (rollup recursivo)
- **UI `<CategoryTree>`:** props novas `empresaId` + `showTotals`
  - Mostra R$ formatado BRL antes do contador `(qtd)`
  - Tooltip mostra "Próprio vs Com sub-categorias" quando diferentes
  - Ícone `<ExternalLink>` (hover only) → drill-down pra `/transacoes?empresaId=X&categoryId=Y`
  - **Conecta workflow:** click na categoria reusa o filtro do A1

---

## Como testar (Yussef)

### 1. Drill-down de Categoria → Transações filtradas

1. Acesse `https://app.caixaos.com.br/empresas/cmpgapyt402pg2006sr8ozzz8/categorias` (Cacula Mix)
2. Veja totais R$ ao lado de cada categoria
3. Passe o mouse numa categoria com tx → aparece `<ExternalLink>` ícone à direita
4. Click no ícone → vai pra `/transacoes` filtrado por aquela categoria
5. URL mostra `?empresaId=X&categoryId=Y` — bookmarkável

### 2. Filtro categoria em `/transacoes`

1. Acesse `https://app.caixaos.com.br/transacoes`
2. Veja dropdown novo "Categoria" no header de filtros (depois de Status)
3. Selecione qualquer categoria → lista refiltra
4. URL atualiza pra `?categoryId=X` (compartilhável)
5. Botão "Limpar" aparece — click pra resetar

### 3. Busca por descrição

1. Em `/transacoes`, digite no input "Buscar descrição"
2. 300ms depois lista refiltra
3. URL atualiza pra `?q=texto`
4. Click no `<X>` interno limpa

### 4. Badges IA

1. Veja na lista `/transacoes` o badge ao lado da categoria
2. **Verde RULE 95%** = regra IA aplicou (D17-D22)
3. **Cinza MANUAL** = humano classificou
4. **Roxo IA** = Claude sugeriu
5. Passe mouse no badge → tooltip mostra detalhes (qual regra, etc)

### 5. Conferência pós-import (fluxo end-to-end)

1. Vá em `/empresas/[id]/contas/[contaId]/importar`
2. Importe um OFX
3. Após sucesso → redirect automático pra `/transacoes?conferencia=true&importId=X`
4. Banner azul no topo: "🤖 Conferência pós-import"
5. Lista mostra **apenas** transações daquele import
6. Confira badges IA — veja o que IA classificou e o que ficou pendente
7. Edite categorias inline ou via dropdown (mesma UI normal)
8. Quando satisfeito: "Concluir e voltar" → volta pro dashboard

---

## Arquivos modificados (commits separados)

### Commit 1: A1+A2+A3 (`e3cf1ea`)
- `app/api/transacoes/route.ts` — params novos categoryId/q/importId
- `lib/transacoes/url-filters.ts` — Zod schema estendido + cuid validation
- `__tests__/transacoes-url-filters.test.ts` — 7 → 14 testes
- `app/(dashboard)/transacoes/page.tsx` — UI filtros + banner conferência

### Commit 2: A3 redirect (`0960259`)
- `app/(dashboard)/empresas/[id]/contas/[contaId]/importar/page.tsx` — redirect pós-import

### Commit 3: A4 (`[badges]`)
- `components/transacoes/ai-source-badge.tsx` — componente novo
- `__tests__/ai-source-badge.test.ts` — 6 testes (helpers)
- `app/api/transacoes/route.ts` — include classifiedByRule
- `app/(dashboard)/transacoes/page.tsx` — integração badge

### Commit 4: B3 (`ec95fea`)
- `app/api/empresas/[id]/categorias/route.ts` — comTotais flag + groupBy
- `lib/categories/buildTree.ts` — totalAmount + totalAmountRollup
- `components/categorias/CategoryTree.tsx` — total R$ + drill-down
- `app/(dashboard)/empresas/[id]/categorias/categorias-client.tsx` — passa props
- `__tests__/categories-tree-totals.test.ts` — 5 testes novos

---

## Métricas

| Item | Valor |
|---|---|
| Features | 5 |
| Commits | 4 |
| Arquivos novos | 3 (component + 2 testes) |
| Arquivos modificados | 6 |
| Linhas adicionadas | ~595 |
| Testes novos | +18 (7 url-filters + 6 badge + 5 totals) |
| Suite total | **1582 passing** (era 1564) |
| TypeScript strict | ✅ 0 erros |
| Build prod | ✅ OK |
| Zero migration banco | ✅ (sprint só UI/API) |

---

## Próximos passos (Sprint 3.0.3 quando Yussef quiser)

**B1+B2 — Edição inline + Bulk select** (~5h)
- Dropdown categoria direto na linha (sem ir pra page edit)
- Checkbox + selectAll + toolbar fixa
- Reusa endpoint `PATCH /api/transacoes/lote` (já existe!)

**B4 — Filtrar por valor min/max** (~1h)

**C1 — Export CSV/Excel** (~2h)

**C2 — Atalhos teclado** (~3h)

**C3 — Preview regra IA** (~2h)
