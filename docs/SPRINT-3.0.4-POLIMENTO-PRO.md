# Sprint 3.0.4 — Polimento Pro

**Status:** ✅ CONCLUÍDO em 23/05/2026 (sessão única)
**Commits:** `e05dd54` · `3bfe328` · `06ea25b` · `939f00d`
**Suite testes:** 1596 → **1667 (+71 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled successfully

---

## Visão geral

Quatro features que polem o produto pra uso DIÁRIO em produção (Yussef
classificando dezenas de transações por dia). Foco em **velocidade** e
**autonomia do operador**.

| # | Feature | Commit | Testes novos |
|---|---|---|---|
| C1 | Export CSV/Excel de transações filtradas | `e05dd54` | 15 |
| C2 | Atalhos de teclado completos | `3bfe328` | 17 |
| C3 | Preview ao vivo no modal de regra | `06ea25b` | 21 |
| C4 | URL persistente completa de filtros | `939f00d` | 18 |

---

## C1 — Export CSV/Excel de transações filtradas

**Objetivo:** baixar em 1 clique a lista atual (com filtros aplicados) num
CSV que abre direto no Excel BR.

**Implementação:**
- `lib/transacoes/csv.ts` — função pura `generateTransacoesCSV()` (RFC 4180
  + BOM UTF-8) + `transacoesCsvFilename()` com slug pt-BR normalizado e
  datas em UTC (sem TZ shift).
- `app/api/empresas/[id]/transacoes/export/route.ts` — endpoint GET que
  espelha os filtros do GET `/api/transacoes` (status, tipo, categoryId, q,
  valorMin/Max, inicio/fim, contaId, importId). Cap 10k linhas, RBAC via
  `transaction.view`, `Cache-Control: no-store`.
- UI: botão `<Download>` variant=outline no header de `/transacoes`, blob
  download via anchor temporário, toast de confirmação.

**11 colunas no CSV:** Data · Descrição · Valor · Tipo · Categoria ·
Fornecedor · Regra Padrão · Source IA · Confiança IA · Status · Conta · Empresa.

**Cenários cobertos (15 testes):** BOM, formatação valor por tipo,
escape RFC 4180 (vírgula/aspas/newline), traduções pt-BR de source/status,
fallback `supplier.nomeFantasia → razaoSocial`, precedência empresa
`tradeName > name`, normalização slug (acentos, especiais, cap 40 chars).

---

## C2 — Atalhos de teclado completos

**Objetivo:** operação 100% sem mouse na `/transacoes`. Yussef classifica
40+ transações em minutos.

**Atalhos:**

| Categoria | Tecla | Ação |
|---|---|---|
| Navegação | `J` / `K` | Próxima / anterior (com scroll smooth) |
| Navegação | `/` | Focar input de busca |
| Navegação | `Esc` | Fechar modal / desfocar input |
| Seleção | `Espaço` | Toggle seleção da row atual |
| Seleção | `⌘+A` (Ctrl+A) | Selecionar todas da página |
| Ação | `E` | Editar transação atual |
| Ação | `C` | Abrir dropdown de categoria |
| Ação | `X` | Marcar como Ignorada |
| Ação | `Enter` | Confirmar (Conciliada) |
| Ajuda | `?` | Modal com lista de atalhos |

**Implementação:**
- `lib/hooks/use-keyboard-shortcuts.ts` — hook document-level. Função pura
  `matchShortcut()` exportada pra testes. IGNORA quando foco em
  `INPUT/TEXTAREA/SELECT/contentEditable` EXCETO quando `safeInInputs=true`
  (Esc e ?). Aceita Cmd OU Ctrl como meta (cross-platform Mac/Win/Linux).
- `components/transacoes/keyboard-shortcuts-help.tsx` — Dialog com 4
  grupos visuais e tags `<kbd>` estilizadas.
- `/transacoes/page.tsx`:
  - `cursorIndex` state, `rowRefs` array, `scrollIntoView` smooth nearest
  - `ring-2 ring-inset ring-primary/40` na row atual
  - Click em qualquer row atualiza cursor
  - Botão Keyboard ghost no header abre modal
  - Placeholder do search hint "(atalho: /)"

**17 testes (matchShortcut: 9 · isTypingTarget: 8):** case-insensitive,
meta=true exige Cmd/Ctrl, meta=false rejeita Cmd+A com A puro, shift,
combo Cmd+Shift+A, duck-typed `isTypingTarget` testável em node sem jsdom.

---

## C3 — Preview ao vivo no modal de regra

**Objetivo:** ao criar/editar regra em `/empresas/[id]/regras`, mostrar
em tempo real "X transações pendentes seriam classificadas" + 5 amostras.

**Por quê:** evita o erro comum de criar regra que pega tx demais (over-broad)
ou de menos (over-strict). User vê na hora.

**Implementação:**
- `lib/regras/preview-match.ts` — função pura `txMatchesRegra()` cobrindo
  os 4 tipos de match (EXACT, CONTAINS, NORMALIZED, CNPJ). Reusa
  `normalizeExact`/`normalizeDescription` de `ai-categorizer/normalize.ts`
  pra garantir consistência com o pipeline real de classificação.
- `POST /api/empresas/[id]/regras/preview` — body `{ padrao, tipoMatch,
  excludeRuleId? }`, RBAC `transaction.view`, janela 5000 tx PENDING mais
  recentes (excluindo as já classificadas pela própria regra via
  `excludeRuleId`), retorna `{ count, samples, janela, truncado }`.
- `EditRegraModal` — `useEffect` debounced 300ms que dispara POST e popula
  section visual com Loader2 spinner / empty state / contador + lista.

**21 testes** cobrindo EXACT (literal, case-insensitive, acentos),
CONTAINS (substring), NORMALIZED (strip prefixo nome + data), CNPJ
(formatado, sem formatação, CPF 11 dígitos, padrão curto rejeitado),
edge cases (padrão vazio, tipoMatch inválido) e
`filterTransacoesByRegra` (ordem preservada).

---

## C4 — URL persistente completa de filtros

**Objetivo:** todos os filtros refletidos no querystring. Links shareable,
back/forward funciona, refresh preserva contexto.

**Filtros suportados:** `tipo · status · contaId · categoryId · q ·
valorMin · valorMax · inicio · fim · page · empresaId · importId ·
conferencia`.

**Implementação:**
- `lib/transacoes/url-filters.ts` — extendido com 3 campos novos no
  parser (`status`, `contaId`, `page`) + nova função pura
  `buildTransacoesURLParams()` que faz o caminho reverso (state →
  URLSearchParams).
- Validações Zod robustas:
  - `status`: enum PENDING/RECONCILED/IGNORED, catch null
  - `contaId`: cuid regex
  - `page`: número inteiro ≥1 e ≤10000 (defesa contra overflow)
- Builder omite defaults (`TODOS`, `TODAS`, `''`, `page=1`,
  `conferencia=false`) pra URL ficar limpa.
- Trim automático em `q`.
- `useEffect` no client ouve todos os state changes (valores DEBOUNCED
  pra `q`, `valorMin`, `valorMax`) e dispara `router.replace(?...)` com
  `scroll: false`.

**18 testes (parse: 10 · builder: 9 — inclui round-trip build→parse):**

- `status` enum válido vs `pending` lowercase vs `HACKED`
- `page` "0", "-1", "999999" (cap), "1.5" (só inteiro), "abc" → todos null
- Builder: input vazio → URLSearchParams vazio; valores significativos
  vão pra URL; `page=1` ignorado; `q` trimado; `conferencia=true` só
  quando true
- Round-trip: build → parse devolve os mesmos valores (sanity check)

---

## Métricas finais

```
Tempo planejado:  ~8h
Tempo real:       ~1.5h (sessão única)

Antes (baseline)  Depois     Δ
1596 testes  →    1667 testes  (+71, +4.4%)
0 TS errors       0 TS errors  ✓
                  Build ✓ Compiled successfully

Commits:          4 feat
                  e05dd54 (C1) · 3bfe328 (C2) · 06ea25b (C3) · 939f00d (C4)

Files changed:    15 (5 novos lib + 4 novos endpoints + 2 novos componentes +
                       4 testes + page.tsx + regras-client.tsx)

LOC added:        +1564 (aprox)
```

## Pós-deploy (operacional)

1. **Sem migrations** — sprint puramente código.
2. Validar em prod:
   - Botão Exportar em `/transacoes` baixa CSV com BOM (abre Excel BR)
   - `?` na `/transacoes` abre modal de atalhos
   - J/K navega + ring visual aparece
   - Modal de editar regra mostra contador "X pendentes seriam..."
   - URL muda ao mexer em qualquer filtro; refresh preserva
3. Yussef testa fluxo: importar OFX → conferência → atalhos pra classificar
   em massa → exportar pra contador.

---

**Próximo:** Sprint 3.0.5 (a planejar) ou avançar pra FASE 6 (Relatórios PDF).
