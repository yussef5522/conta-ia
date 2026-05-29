# Auditoria — Drill-Down em Relatórios (Comparativo + Análise de Variação)

**Data:** 29/05/2026 · **Branch:** `feature/relatorios-drill-down`
**Baseline:** main HEAD `3bb80ec` (limpeza-final aplicada)

---

## 1. Mapeamento das fontes de dados

### 1.1 Comparativo Mensal
**Arquivo:** `app/api/empresas/[id]/relatorios/comparativo/route.ts:61-99`

Filtro multi-tenant:
```typescript
OR: [
  { bankAccount: { companyId: empresaId } },
  { supplier:    { companyId: empresaId } },
  { employee:    { companyId: empresaId } },
  { customer:    { companyId: empresaId } },
  { category:    { companyId: empresaId } },
]
```

Filtro de data (CRÍTICO — não regredir):
```typescript
OR: [
  { competenceDate: { gte: start, lte: end } },
  { competenceDate: null, date: { gte: start, lte: end } },
]
```

Filtro de status: `status IN ('RECONCILED', 'PENDING')`

Bucket: `regime='competencia'` → `competenceDate ?? date`; `regime='caixa'` → `paymentDate ?? date`.

### 1.2 Análise de Variação
**Arquivo:** `app/api/empresas/[id]/relatorios/analise-variacao/route.ts:62-119`
Padrão idêntico ao Comparativo (mesmo OR multi-tenant + mesma estratégia de data + mesmo regime).

### 1.3 Conclusão importante
🚨 **A spec sugeriu `lifecycle: 'EFFECTED'`** no drill-down, mas os relatórios fonte INCLUEM `lifecycle='PAYABLE'` (filtro = `status IN ('RECONCILED', 'PENDING')`). **Filtrar lifecycle no drill-down quebraria a conferência aritmética** (`sum(transacoes do modal) ≠ valor da célula`).

**Decisão recomendada:** drill-down replica EXATAMENTE o filtro dos relatórios fonte. Sem `lifecycle` filter, com mesmo `status IN ('RECONCILED', 'PENDING')`. Em troca, mostro coluna "Estado" no modal pra distinguir EFFECTED vs PAYABLE/RECEIVABLE.

---

## 2. Pontos clicáveis identificados

### 2.1 Comparativo (`comparativo-client.tsx:480-492` — `<Row>`)
| Cell | Drill-down? | Por quê |
|---|---|---|
| Coluna categoria (esquerda) | ❌ não | label |
| `row.values[i]` (N cells) | ✅ **SIM** | tem categoryId + período `periodos[i].{start,end}` |
| `row.mediaHistorica` | ❌ não | agregado |
| `row.desvioPct` | ❌ não | cálculo |
| `row.total` | ❌ não | agregado N períodos |
| Linha rodapé (TotalsRow) | ❌ não | sem categoryId |

### 2.2 Análise Variação Tabela (`analise-variacao-client.tsx:559-563` — `<DriverRow>`)
| Cell | Drill-down? | Período |
|---|---|---|
| categoria (esquerda) | ❌ não | label |
| `d.valorAntigo` | ✅ **SIM** se > 0 | mesAntigo (range completo) |
| `d.valorNovo` | ✅ **SIM** se > 0 | mesNovo (range completo) |
| Diferença | ❌ não | cálculo |
| Tipo (badge) | ❌ não | metadata |

### 2.3 Análise Variação Waterfall (`WaterfallChartSvg.tsx:219-281`)
| Bar tipo | Drill-down? | Período |
|---|---|---|
| `inicio` (totalAntigo) | ❌ não | agregado |
| `fim` (totalNovo) | ❌ não | agregado |
| `aumento`/`reducao` driver | ✅ **SIM** | mesAntigo OU mesNovo — VER decisão abaixo |
| `aumento`/`reducao` `isOutros` | ❌ não | mistura várias categorias |

**Decisão de produto pra bars de driver:** o waterfall mostra **diferença** entre antigo e novo. Quando user clica numa barra de driver, o que ele quer ver?
- (A) Transações do mês NOVO daquela categoria (foco no resultado)
- (B) Transações do mês ANTIGO daquela categoria
- (C) Ambas (modal com tabs ou union range antigo+novo)

**Recomendação:** **(C) Período union [antigoStart..novoEnd]**, modal mostra todas. User vê de onde a diferença veio (ambos os meses).

🚨 Bar atualmente NÃO tem `categoryId`. Precisa propagar do `DriverVariacao`:
```typescript
export interface WaterfallBar {
  ...
  /** NOVO: pra drill-down. Null pra inicio/fim/outros. */
  categoryId?: string | null
}
```
E `buildWaterfallBarsFromSelection` deve setar `categoryId: d.categoryId` ao criar bars de driver. Mudança aditiva, zero breaking change.

---

## 3. Contrato do endpoint

### POST `/api/empresas/[id]/relatorios/drill-down/transacoes`

**Path:** Aninhado em `/api/empresas/[id]/` pra reusar `getAuthContext(req, empresaId)` + permission check existente (`requirePermission('dre.view')` — mesma do comparativo).

**Request body:**
```typescript
{
  categoriaId: string         // CUID. Não-nulo (rótulo "Sem categoria" não é clicável).
  dataInicio: string          // YYYY-MM-DD UTC
  dataFim: string             // YYYY-MM-DD UTC
  regime?: 'competencia' | 'caixa'   // default 'competencia' — DEVE bater com o relatório
  tipo?: 'DESPESA' | 'RECEITA' | 'TODOS'  // default 'DESPESA'
}
```

**Response:**
```typescript
{
  total: number              // soma signedAmount das transações listadas
  qtd: number
  categoria: { id, name, dreGroup: string | null }
  truncated: boolean         // true se atingiu o limite 200
  transacoes: Array<{
    id: string
    bucketDate: string       // ISO — campo usado pra bucketizar (competenceDate||date OR paymentDate||date)
    date: string             // transactionDate ISO
    competenceDate: string | null
    paymentDate: string | null
    description: string
    type: 'CREDIT' | 'DEBIT' | 'TRANSFER'
    amount: number           // sempre positivo
    signedAmount: number     // signed por type (CREDIT=+, DEBIT=-)
    favorecido: string | null // supplier.razaoSocial || employee.name || customer.razaoSocial
    favorecidoTipo: 'supplier' | 'employee' | 'customer' | null
    lifecycle: 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE'
    status: 'RECONCILED' | 'PENDING' | 'IGNORED'
  }>
}
```

**Lógica de filtro SQL (replica relatórios fonte):**
```typescript
const dataField = regime === 'caixa' ? 'paymentDate' : 'competenceDate'
const dateFieldRange = { gte: dataInicio, lte: dataFimEndOfDay }

where: {
  AND: [
    {
      OR: [
        { bankAccount: { companyId } }, { supplier: { companyId } },
        { employee: { companyId } }, { customer: { companyId } },
        { category: { companyId } },
      ],
    },
    { categoryId: categoriaId },
    {
      OR: [
        { [dataField]: dateFieldRange },
        { [dataField]: null, date: dateFieldRange },
      ],
    },
    // Filtro tipo: TODOS pula este AND
    tipo === 'DESPESA' ? { type: 'DEBIT' } :
    tipo === 'RECEITA' ? { type: 'CREDIT' } : {},
    // EXCLUIR transferências (mesma decisão do DRE)
    { type: { not: 'TRANSFER' } },
  ],
  status: { in: ['RECONCILED', 'PENDING'] },
}
```

**Limit:** 200 transações (`take: 200`). `truncated = txs.length === 200`.

**Auth:** `getAuthContext(req, empresaId).requirePermission('dre.view')` (mesma permissão dos relatórios fonte).

---

## 4. Componente Modal

**Arquivo novo:** `components/relatorios/drill-down/TransacaoDrillDownModal.tsx`

**Stack:** shadcn `Dialog` (existe em `components/ui/dialog.tsx`).

**Props:**
```typescript
{
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  categoriaId: string
  categoriaName: string
  periodo: { dataInicio: string; dataFim: string; label: string }
  regime?: 'competencia' | 'caixa'   // default 'competencia'
  tipo?: 'DESPESA' | 'RECEITA' | 'TODOS'
}
```

**Comportamento:**
- `useEffect` faz POST quando `open` vira true. Cancela com `AbortController` se modal fecha durante request.
- Loading: spinner centralizado.
- Empty: "Nenhuma transação encontrada nesse período."
- Lista: tabela com Data | Estado (badge) | Fornecedor | Descrição | Valor | 🔗
- Filtro busca (descrição + favorecido) com debounce 200ms.
- Ordenação: `Data desc` (default) ou `Valor desc`.
- Footer: total + qtd + (se truncated) badge âmbar "Primeiras 200 — filtre pra refinar".
- Link 🔗: `<Link href="/contas-a-pagar?focusId=${t.id}&empresaId=${empresaId}" target="_blank">`.

**Closing:** ESC, click overlay, X — usa `onOpenChange={false}`.

🚨 **`?focusId=` ainda não existe** em `/contas-a-pagar`. Decisão de escopo:
- **Esta sprint:** apenas linka pra `/contas-a-pagar?empresaId=...&q=${id}` (busca por ID). Funciona como abertura genérica.
- **Sprint futura:** implementar highlight visual no `focusId` (scroll into view + ring).

Confirmar com Yussef se OK linkar genérico nesta sprint.

---

## 5. Integração nos 2 relatórios

### 5.1 Comparativo (`comparativo-client.tsx`)

Adicionar estado de drill-down na página:
```typescript
const [drillDown, setDrillDown] = useState<{
  categoriaId: string
  categoriaName: string
  periodo: { dataInicio, dataFim, label }
} | null>(null)
```

`<Row>` ganha prop `onDrillDown(cellIdx)`. A cell do valor vira:
```tsx
<td className={`px-3 py-2.5 text-right tabular-nums ${toneClass}`}>
  {v > 0 ? (
    <button
      onClick={() => onDrillDown(i)}
      className="hover:underline hover:text-violet-700 cursor-pointer"
      data-testid={`drilldown-cell-${row.categoryId}-${i}`}
    >
      {formatBRL(v)}
    </button>
  ) : '—'}
</td>
```

Renderização do modal no nível da página, recebendo o `drillDown` state.

### 5.2 Análise Variação (`analise-variacao-client.tsx`)

Estado idêntico. `<DriverRow>` ganha prop `onDrillDown(side: 'antigo' | 'novo')` + os 2 períodos. Cells viram botões idênticos.

### 5.3 Waterfall SVG (`WaterfallChartSvg.tsx`)

Adicionar prop opcional `onBarClick?: (bar: WaterfallBar) => void`. Cada `<rect>` ganha:
```tsx
<rect
  onClick={
    onBarClick && b.categoryId && !b.isOutros ? () => onBarClick(b) : undefined
  }
  style={{ cursor: onBarClick && b.categoryId && !b.isOutros ? 'pointer' : 'default' }}
  className={onBarClick && b.categoryId && !b.isOutros ? 'transition-opacity hover:opacity-80' : ''}
/>
```

Cliente passa callback que abre drill-down com período **union [mesAntigo.start .. mesNovo.end]**.

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Filtro EFFECTED quebrar aritmética | Decisão: NÃO filtrar lifecycle. Mostrar badge no modal pra transparência |
| Regime caixa vs competência divergir | Drill-down RECEBE regime no body; usa `paymentDate` ou `competenceDate` no SQL OR |
| `?focusId=` quebrado por falta de UI | Decisão: nesta sprint linka pra rota genérica `/contas-a-pagar?empresaId=...` (ver §4) |
| WaterfallBar sem categoryId | Mudança aditiva no type + setado em `buildWaterfallBarsFromSelection` |
| Outros (categoria agrupada) clicado | Bar `isOutros` NÃO clicável + cursor:default |
| Multi-tenant leak | OR já validado em 8 endpoints; replicado idêntico |
| Modal abre antes do click ser registrado | Dialog usa `open` controlado; useEffect só dispara fetch quando `open === true` |
| Performance com 50k+ transações na categoria | Hard limit 200 + filtro busca no client; truncated flag avisa |
| Sem dados → modal vazio | Empty state amigável |

---

## 7. Plano de execução (~5h)

| Bloco | Tempo | Conteúdo |
|---|---|---|
| D.2 | 60min | Endpoint + Zod + auth + filtro + tests engine (7) |
| D.3 | 60min | Modal Dialog + states + busca + ordenação |
| D.4 | 30min | Integração Comparativo (cells clicáveis) |
| D.5 | 45min | Análise Variação tabela + waterfall + WaterfallBar.categoryId |
| D.6 | 30min | UI helper tests + checagem aritmética |
| D.7 | 30min | Build + deploy + 4 verificações |
| **Total** | **~4h15** | Dentro do estimado |

---

## 8. Aprovação solicitada

Yussef, antes de Fase 2:

1. **Status filter:** drill-down replica relatórios fonte (`status IN ('RECONCILED', 'PENDING')`, SEM filtro `lifecycle`) pra garantir `Σ modal = valor da célula`. Modal mostra badge "Estado" pra distinguir EFFECTED / PAYABLE / RECEIVABLE. Confirma?

2. **Regime:** drill-down recebe `regime` no body do request (default `competencia`). Cliente passa o regime ativo do filtro do relatório. Confirma?

3. **Waterfall bars:** drill-down em barras de driver usa **período UNION antigo+novo** (`[mesAntigo.start .. mesNovo.end]`) pra mostrar de onde veio a diferença. Bars `inicio`/`fim`/`outros` NÃO clicáveis. Confirma?

4. **Análise variação tabela:** 2 cells por linha (valorAntigo/valorNovo) viram clicáveis com período SÓ daquele mês. Diferença/Tipo não clicáveis. Confirma?

5. **Link 🔗 da transação:** nesta sprint linka pra `/contas-a-pagar?empresaId=...` (rota genérica, nova aba). `?focusId=` com highlight fica pra sprint futura. Confirma?

6. **Outros (N) bar/cell:** NÃO clicável (mistura categorias). Confirma? (Yussef sugeriu modal especial — fica pra sprint futura).

7. **Limit 200 + truncated flag:** UX mostra aviso âmbar "Primeiras 200 — filtre pra refinar". Confirma?

8. **Tipo filter no endpoint:** drill-down recebe `tipo` (DESPESA/RECEITA/TODOS) pra bater com o filtro ativo do relatório. Default DESPESA (alinha com defaults dos 2 relatórios).

OK em tudo? Sigo Fase 2.
