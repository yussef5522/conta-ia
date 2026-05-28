# Investigação: Bugs do Comparativo (Sprint A)

**Data:** 28/05/2026 · **Branch:** `investigation/comparativo-bug-referencia`
**Trigger:** Yussef comparou 2 screenshots da mesma empresa (profit sao borja,
categoria Salários) com configurações diferentes e detectou inconsistência grave.

---

## 1. Confirmação SQL — bug PRINCIPAL (mês de referência)

### Valor REAL no banco (filtro por `competenceDate`)

```sql
SELECT TO_CHAR(COALESCE(t."competenceDate", t.date), 'YYYY-MM') as bucket,
       COUNT(*) as qtd, SUM(t.amount) as total
FROM transactions t
JOIN categories c ON c.id = t."categoryId"
WHERE c.name ILIKE '%salário%'
  AND c."companyId" = 'cmpnmgp9r0001px7oj7omv5y2'  -- profit sao borja
  AND (
    (t."competenceDate" >= '2026-01-01' AND t."competenceDate" <= '2026-03-31')
    OR (t."competenceDate" IS NULL AND t.date >= '2026-01-01' AND t.date <= '2026-03-31')
  )
  AND t.type = 'DEBIT' AND t.status IN ('RECONCILED','PENDING')
GROUP BY 1;
```

| Bucket | Qtd | Total |
|---|---|---|
| 2026-01 | 28 | **R$ 44.032,47** |
| 2026-02 | 23 | **R$ 38.977,69** |
| 2026-03 | 23 | **R$ 45.159,99** |

### Valor que o Sprint A está mostrando (filtro por `date`)

```sql
-- Mesmo range mas filtrando por t.date (como o Sprint A faz hoje)
WHERE t.date >= '2026-01-01' AND t.date <= '2026-03-31'
```

| Bucket | Qtd | Total | Diferença |
|---|---|---|---|
| 2025-12 | 25 | R$ 42.655,94 | (vazou — entra Dez) |
| 2026-01 | 28 | R$ 44.032,47 | OK |
| 2026-02 | 23 | R$ 38.977,69 | OK |
| 2026-03 | **1** | **R$ 3.993,72** | ❌ Perdeu 22 txs |

**CAUSA RAIZ CONFIRMADA via SQL.**

### Por que isso acontece

Os Salários são lançados com:
- `competenceDate` = mês X (ex: Mar/26)
- `paymentDate` = mês X+1 (pagos no mês seguinte — Abr/26)
- `date` (campo principal) = paymentDate (Abr/26)

No Sprint A:
1. **Query SQL** filtra por `t.date IN [range]` — usa o `date` (Abr/26)
2. **Bucket interno** usa `competenceDate ?? date` — aloca em Mar/26

**Resultado**: tx com `competenceDate=Mar` e `date=Abr` é FILTRADA OUT pelo SQL
quando o range termina em Mar/31. As 22 txs de Salários Mar (pagas em Abr)
nunca entram no resultset → bucket Mar mostra só 1 tx (R$ 3.993,72) em vez
de 23 (R$ 45.159,99).

**Por que afeta APENAS o último mês (referência)?**

Para o último mês do range, qualquer tx com paymentDate no mês seguinte
extrapola o range SQL. Para os meses históricos, paymentDate "vaza" pro
mês seguinte que ainda está dentro do range.

### Diferença entre as fotos do Yussef

| Config | refMonth | Range SQL | Bucket Fev mostra | Bucket Mar mostra |
|---|---|---|---|---|
| 6 meses | provavelmente **Mai/26** | Dez-Mai | R$ 38.977 ✅ | R$ 45.159 ✅ |
| 3 meses | **Mar/26** | Jan-Mar | R$ 38.977 ✅ | R$ 3.993 ❌ |

Yussef notou que Fev tinha "R$ 224" no print de 3 meses — confirmando esse
print tinha `refMonth=Feb/26` (range Dez-Fev), aí Fev é referência e perde
suas próprias txs.

---

## 2. Causa raiz dos bugs da MÉDIA

### Localização

`lib/relatorios/comparativo.ts:554-560`

```typescript
export function calcularMediaHistorica(values: number[]): number | null {
  if (values.length < 2) return null
  const anteriores = values.slice(0, -1)
  const sum = anteriores.reduce((a, b) => a + b, 0)
  const media = sum / anteriores.length   // ← BUG: divide pelo total
  return media === 0 ? null : media       // ← BUG: só null quando média = 0
}
```

### Bug MÉDIA-1: divide pelo total (inclui zeros)

**Cenário:** 6 períodos Salários com 2 meses zerados (Out/25, Nov/25 = 0).

```
anteriores = [0, 0, 42655, 44032, 38977]  (5 valores)
sum = 125_664
media atual: 125_664 / 5 = 25_132 ❌  (diluído pelos zeros)
media correta: 125_664 / 3 = 41_888 (só meses com valor)
```

A foto do Yussef mostrou R$ 36.198 (atual) vs R$ 45.247 esperado. A diferença
casa com a explicação: zeros estão diluindo.

**Fix:** dividir por `count(valor > 0)`, não pelo total.

### Bug MÉDIA-2: "some" com poucos períodos

Quando todos os anteriores são 0, `media === 0 → return null`. Com 3 períodos
de uma categoria nova (sem histórico nos 2 anteriores), a média some.

**Fix (consistente com MÉDIA-1):** retornar null SÓ quando `count(valor > 0) === 0`
nos anteriores. Se há 1+ mês com valor, calcular média daquele(s).

### Bug VS-MÉDIA: -100% quando ref está vazio

`lib/relatorios/comparativo.ts:566-569`

```typescript
export function calcularDesvio(current: number, media: number | null): number | null {
  if (media === null || media === 0) return null
  return (current - media) / media  // current=0, media=X → -100%
}
```

Quando o mês de referência ainda não tem lançamentos (Abr/26 da profit),
`current=0` e desvio = -100%. Tecnicamente correto, mas semanticamente
ruim — não é "queda de 100%", é "mês ainda sem dados".

**Fix:** se `current === 0 && media !== null && media > 0` → retornar null +
flag `referenciaVazia: true` no row pra UI mostrar "—" ou "ref. vazia".

---

## 3. Correção proposta — 4 fixes

### FIX 1 (PRINCIPAL) — Range SQL por competenceDate

`app/api/empresas/[id]/relatorios/comparativo/route.ts`

```typescript
// ANTES (linha 62):
where: {
  OR: [multi-tenant],
  status: { in: ['RECONCILED', 'PENDING'] },
  date: { gte: sqlRangeStart, lte: sqlRangeEnd },  // ❌ usa date
}

// DEPOIS:
where: {
  AND: [
    { OR: [multi-tenant] },  // multi-tenant guard
    {
      OR: [
        { competenceDate: { gte: sqlRangeStart, lte: sqlRangeEnd } },
        { competenceDate: null, date: { gte: sqlRangeStart, lte: sqlRangeEnd } },
      ],
    },
  ],
  status: { in: ['RECONCILED', 'PENDING'] },
}
```

Padrão idêntico ao `lib/ai/collect-insight-data.ts:107` (que NÃO tem esse bug
porque já filtra por competenceDate).

**Impacto:** range SQL agora cobre EXATAMENTE as txs cuja `competenceDate`
está no range, independentemente de quando foram pagas. As 22 txs de Salários
Mar/26 com paymentDate=Abr/26 entram corretamente.

### FIX 2 — Média divide só por meses com valor

`lib/relatorios/comparativo.ts:554-560`

```typescript
export function calcularMediaHistorica(values: number[]): number | null {
  if (values.length < 2) return null
  const anteriores = values.slice(0, -1)
  const comValor = anteriores.filter((v) => v > 0)
  if (comValor.length === 0) return null  // todos zerados
  const sum = comValor.reduce((a, b) => a + b, 0)
  return sum / comValor.length
}
```

### FIX 3 — Detectar "referência vazia"

`lib/relatorios/comparativo.ts:566-569`

```typescript
export function calcularDesvio(
  current: number,
  media: number | null,
): { desvioPct: number | null; referenciaVazia: boolean } {
  if (media === null || media === 0) {
    return { desvioPct: null, referenciaVazia: false }
  }
  if (current === 0) {
    // ref vazia (sem dados ainda) — não é "queda 100%"
    return { desvioPct: null, referenciaVazia: true }
  }
  return { desvioPct: (current - media) / media, referenciaVazia: false }
}
```

Adicionar campo `referenciaVazia: boolean` em `ComparativoRowMulti` pra UI
mostrar label "—" ou "ref. vazia" em vez de "✕ -100%".

### FIX 4 — Heatmap não colore células de meses futuros vazios

Quando o mês de referência tem `value=0` E `media>0`, `classifyCellTone`
hoje retorna `fav-strong` (despesa caiu 100% = bom) ou `unfav-strong`
(receita caiu 100% = ruim). Mesma confusão semântica.

`classifyCellTone()` precisa de novo input `referenciaVazia` (ou critério
"value === 0 quando media > 0") e retornar `transparent`.

---

## 4. Arquivos a mudar

| Arquivo | Mudança |
|---|---|
| `app/api/empresas/[id]/relatorios/comparativo/route.ts` | Where SQL por competenceDate (FIX 1) |
| `lib/relatorios/comparativo.ts` | calcularMediaHistorica (FIX 2) + calcularDesvio (FIX 3) + classifyCellTone (FIX 4) |
| `app/(dashboard)/empresas/[id]/relatorios/comparativo/comparativo-client.tsx` | UI mostra "—" quando `referenciaVazia=true` |
| `__tests__/comparativo-multi-periodo.test.ts` | Testes novos pros 4 fixes |

---

## 5. Por que isso não foi pego na Sprint A

A Sprint A herdou o padrão `date: { gte, lte }` do código antigo
(`computeComparativo` da 5.0.4.0a). O bug é PRÉ-EXISTENTE no comparativo
antigo também — mas mascarado porque com 3 meses fixos centrados no mês atual,
o último mês raramente tinha paymentDate "vazando". Após o bug-fix de lifecycle
(várias contas com paymentDate explicito), o padrão ficou óbvio.

Testes da Sprint A passaram porque eu **gerei fixtures sintéticas** com
`bucketDate` em mês específico e não simulei o cenário real de `competenceDate`
no mês X com `date` no mês X+1.

---

## 6. Riscos do fix

| Risco | Mitigação |
|---|---|
| OR de `competenceDate` IS NULL pode trazer txs OFX velhas | Range já está fixo, filtra mesmo assim |
| Quebrar retrocompat `computeComparativo` antigo (3 meses fixos) | Antigo não muda — só endpoint quando chamada Sprint A. Se chamada legacy ainda usa `meses=3, gran=mes` (defaults), endpoint usa `computeComparativo` antigo. Vou aplicar fix no endpoint pra os 2 caminhos |
| Total geral muda ao filtrar diferente | É o comportamento CORRETO — total antes estava incompleto |
| FIX 3 muda assinatura de `calcularDesvio` | Wrap retrocompat: deprecated função antiga retornando só number\|null, função nova retorna objeto |

---

## 7. Aprovação solicitada

Yussef, antes de aplicar os 4 fixes:

1. **FIX 1 (range SQL por competenceDate)** — OK?
2. **FIX 2 (média só conta meses com valor > 0)** — OK?
3. **FIX 3 (vs Média mostra "—" quando ref vazio em vez de -100%)** — OK?
4. **FIX 4 (heatmap não colore células zeradas quando média > 0)** — OK?

Aplicar também no endpoint para o caminho legacy (`computeComparativo` antigo
com `meses=3, gran=mes`) — OK ou só Sprint A?

Se OK em tudo, sigo aplicar os 4 fixes + testes + deploy.
