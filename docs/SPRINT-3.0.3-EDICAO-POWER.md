# Sprint 3.0.3 — Edição Power

**Status:** ✅ EXECUTADO
**Data:** 23/05/2026
**Commits:** 3 (f39baa1 B1, [B2], cedb6c3 B4)
**Suite testes:** 1582 → **1596 (+14)**

---

## Contexto

Sprint 3.0.2 entregou **visibilidade** (filtros + badges IA + conferência pós-import). Yussef confirmou funcionando. Faltava **poder de edição massa**: trocar categoria sem 4 cliques, marcar 50 tx como ignoradas de uma vez, filtrar por faixa de valor (R$ 100-1000).

Sprint 3.0.3 entrega 3 features que destravam workflow diário em volume.

---

## 3 features entregues

### B1 — Edição inline de categoria

**Antes:** click na tx → page `/transacoes/[id]/editar` → mudar categoria → salvar → voltar (4 cliques + redirect)
**Agora:** click no badge da categoria → dropdown abre na linha → seleciona → salva (1 click)

**Componente novo:** `components/transacoes/inline-category-select.tsx`
- shadcn Select estilizado pra parecer badge clicável
- `credentials: 'include'` no PUT (defesa Safari ITP da Sprint 3.0.1)
- `PUT /api/transacoes/[id] { categoryId }` (endpoint existente)
- Toast "Categoria atualizada" + atualiza state local (sem reload)
- Loading spinner durante save
- Esc/click-fora fecha (default Select)
- Erro: toast destrutivo + mantém categoria anterior

**Integração:** Em `/transacoes`, substitui o `<span>` estático da categoria pelo componente **só quando** `categorias.length > 0` (carregadas via empresaId). Fallback span se modo global sem empresaId.

### B2 — Bulk select + bulk update

**Backend novo:**
- Schema `transacaoLoteStatusSchema` (Zod): `transactionIds[1..500]` + `status: PENDING|RECONCILED|IGNORED`
- `PATCH /api/transacoes/lote/status` — updateMany de status (preserva `classificationSource` e `aiConfidence`, diferente de `/lote` que força MANUAL pra mudança de categoria)
- Multi-tenancy via `bankAccount.company.users` (mesma estratégia `/lote` existente)

**UI:**
- Checkbox shadcn por linha à esquerda
- selectAll header da página (marca/desmarca toda a página atual)
- Highlight `bg-primary/5` em linhas selecionadas
- **Toolbar sticky** quando há seleção (`z-20 backdrop-blur`):
  - Contador "X selecionada(s)"
  - Dropdown "Mudar categoria..." (com cores) → ConfirmDialog → `PATCH /lote`
  - Botão "Confirmar" → status=RECONCILED → `PATCH /lote/status`
  - Botão "Ignorar" (destrutivo amber) → status=IGNORED → `PATCH /lote/status`
  - X pra limpar seleção
- **ConfirmDialog rico:**
  - Mudar categoria: "Mudar categoria de 15 transações? Nova categoria: **Salários**"
  - Status: "Marcar como conciliadas (15 transações)?"
- Pós-sucesso: toast com `naoEncontradas` quando aplicável + clearSelection + refetch

**Endpoint reusa:** `/api/transacoes/lote` (já existia desde Fase 3) — só faltava UI.

### B4 — Filtro por valor (R$ De / Até)

**API:**
- `GET /api/transacoes?valorMin=100&valorMax=1000`
- Parse defensivo: `Number.isFinite` + `>= 0` ou ignora
- `where.amount: { gte, lte }` combinado com outros filtros

**URL filters Zod:**
- `numberOrNull` validator custom: aceita string ou number, rejeita NaN/Infinity/negativo
- `valorMin` + `valorMax` no `TransacoesURLFilters`

**UI:**
- 2 inputs `type="number"` no header de filtros: "R$ De" / "R$ Até"
- `step=0.01` + `inputMode=decimal` (mobile keyboard)
- Debounce 400ms (mais longo que busca pra evitar fetches enquanto digita valor)
- URL persistente — bookmarkable
- `limparFiltrosNovos` reseta valor + categoria + busca

---

## Como testar (Yussef)

### B1 — Edição inline

1. Acesse `/transacoes?empresaId=cmpgapyt402pg2006sr8ozzz8` (Cacula Mix)
2. Cada categoria virou um **botão sutil com setinha**
3. Click numa categoria → dropdown abre
4. Escolha outra → salva e some o dropdown
5. Toast verde "Categoria atualizada"
6. Lista local atualiza **sem reload**

### B2 — Bulk

1. Em `/transacoes` veja **checkbox** na esquerda de cada linha
2. Click no checkbox do header → marca todos da página
3. Toolbar azul aparece no topo: "X selecionadas"
4. Use dropdown "Mudar categoria..." → confirma → todas viram aquela categoria
5. Ou click "Ignorar" → todas viram IGNORED
6. Ou click "Confirmar" → todas viram RECONCILED
7. Toast mostra quantas mudou
8. Seleção limpa automaticamente

**Exemplo real:** selecione todas as "DEP DINHEIRO ATM" pendentes → "Ignorar" → 1 click vs 50 cliques individuais.

### B4 — Filtro valor

1. No header de filtros aparecem **2 novos inputs**: "R$ De" e "R$ Até"
2. Digite "100" em "De" → 400ms depois lista refiltra
3. Digite "1000" em "Até" → filtra entre R$ 100 e R$ 1.000
4. URL: `?valorMin=100&valorMax=1000` (compartilhável)
5. Botão "Limpar" no header resseta tudo

**Casos:**
- Achar PIX grandes: De=`5000` → mostra só ≥ R$ 5k
- Achar tarifas: De=`0` Até=`50` → micro-débitos
- Conferir margem de erro: De=`99.99` Até=`100.01` → tx exatas de R$ 100

---

## Arquivos modificados

### Commit 1 (B1) — `f39baa1`
- `components/transacoes/inline-category-select.tsx` (NOVO, 137 linhas)
- `app/(dashboard)/transacoes/page.tsx` — integração inline

### Commit 2 (B2) — `[hash]`
- `lib/validations/transacao-lote.ts` — schema novo
- `app/api/transacoes/lote/status/route.ts` (NOVO)
- `__tests__/transacao-lote-status-schema.test.ts` (NOVO, 6 testes)
- `app/(dashboard)/transacoes/page.tsx` — checkbox + toolbar + ConfirmDialog

### Commit 3 (B4) — `cedb6c3`
- `lib/transacoes/url-filters.ts` — numberOrNull validator + 2 campos
- `app/api/transacoes/route.ts` — valorMin/Max parse + where.amount
- `app/(dashboard)/transacoes/page.tsx` — inputs valor + debounce
- `__tests__/transacoes-url-filters.test.ts` — 14 → 22 testes (+8)

---

## Métricas

| Item | Valor |
|---|---|
| Features | 3/3 |
| Commits separados | 3 |
| Arquivos novos | 3 (1 component + 1 route + 2 testes) |
| Arquivos modificados | 4 |
| Linhas adicionadas | ~720 |
| Testes novos | +14 (6 lote-status + 8 url-filters valor) |
| Suite total | **1596 passing** (era 1582) |
| TypeScript strict | ✅ 0 erros |
| Build prod | ✅ OK |
| Zero migration | ✅ (sprint só UI/API) |
| Endpoints novos | 1 (`PATCH /api/transacoes/lote/status`) |
| Endpoints reusados | 2 (`PUT /api/transacoes/[id]`, `PATCH /api/transacoes/lote`) |

---

## Decisões técnicas

### Por que dois endpoints distintos (`/lote` e `/lote/status`)?

`/lote` já existia e força `classificationSource='MANUAL'` + reset de `aiConfidence`/`ruleId`. Faz sentido pra **mudança de categoria** (humano decidiu).

`/lote/status` é só pra mudar `status` (RECONCILED/IGNORED/PENDING) **sem mexer** em metadados de IA — preserva o trabalho que a IA fez. Misturar num só endpoint exigiria flags condicionais que viram bug.

### Debounce 400ms no valor vs 300ms na busca

Valor exige digitar 3-5 dígitos sequencial ("1500.50"). 300ms dispara fetch a cada dígito. 400ms dá tempo de terminar de digitar. Pequena diferença, grande UX.

### `numberOrNull` custom Zod

`z.coerce.number()` aceita string mas converte "abc" → NaN sem erro (Number("abc") = NaN, isFinite=false). Custom transform garante:
- string vazia → null (típico clear)
- NaN/Infinity → null
- negativo → null
- número válido ≥ 0 → number

Defesa contra URL manipulada (`?valorMin=-Infinity` não quebra).

### B1: edição inline vs page de edição

Mantemos a page de edição (`/empresas/[id]/contas/[id]/transacoes/[id]/editar`) **intacta** porque permite editar TUDO (descrição, valor, data, notas, type). Inline cobre só categoria — o caso mais frequente.

---

## Próximos passos (Sprint 3.0.4)

**C1 — Export CSV/Excel** (~2h)
- Botão "Exportar" no header
- `/api/empresas/[id]/transacoes/export` retorna CSV
- Precedente: audit log já tem export

**C2 — Atalhos teclado** (~3h)
- J/K navegar entre tx
- C abrir dropdown categoria
- X ignorar
- E editar
- Esc cancela

**C3 — Preview regra IA** (~2h)
- Em `/regras` modal, "Esta regra captura X tx pendentes agora"

---

## Pra Yussef

URL pronta com tudo da Sprint 3.0.3 ativo:

```
https://app.caixaos.com.br/transacoes?empresaId=cmpgapyt402pg2006sr8ozzz8
```

Workflow concreto pra testar agora:

1. **Click numa categoria** → muda inline (B1)
2. **Marca 5 tx via checkbox** → "Ignorar" → 5 viram IGNORED de uma vez (B2)
3. **Digita "1000" em R$ De** → filtra ≥ R$ 1k (B4)
