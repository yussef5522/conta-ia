# Auditoria — Limpeza Visual Análise de Variação

**Data:** 28/05/2026 · **Branch:** `hotfix/analise-variacao-limpeza-final`
**Baseline:** main HEAD `2645d5c` (cronológica validada em prod)

---

## 1. Bloco de insights — pontos de remoção

### 1.1 UI Cliente
`app/(dashboard)/empresas/[id]/relatorios/analise-variacao/analise-variacao-client.tsx`

| Linha | Conteúdo | Ação |
|---|---|---|
| 35 | `type Insight` import | Remover do import |
| 316-319 | Render `<InsightsCard insights=... />` | Deletar bloco |
| 399-437 | `function InsightsCard(...)` + `iconForTipo` | Deletar função inteira |

### 1.2 Backend Engine
`lib/relatorios/analise-variacao.ts`

| Linha | Conteúdo | Ação |
|---|---|---|
| 87 | `insightsPrincipais: Insight[]` field do Result | Remover |
| 94-99 | `export type InsightTipo` (5 valores) | Remover |
| 101-104 | `export interface Insight` | Remover |
| 580-585 | `gerarInsightsPrincipais(...)` chamada em `analiseVariacao` | Remover |
| 598 | `insightsPrincipais` no return literal | Remover |
| 863-895 | `export function gerarInsightsPrincipais(...)` + `InsightsInput` | Deletar |

### 1.3 Plano: deletar de vez
- UI tem 1 consumer (este componente) — OK deletar
- Backend só usado internamente — OK deletar tipos e função

---

## 2. Simplificação DriverTipo

### 2.1 Estado atual
```typescript
export type DriverTipo =
  | 'aumentou' // ambos > 0, novo > antigo
  | 'reduziu' // ambos > 0, novo < antigo
  | 'novo' // antigo=0, novo>0
  | 'sumiu' // antigo>0, novo=0
  | 'estavel' // |novo - antigo| < threshold
```

### 2.2 Estado desejado
```typescript
export type DriverTipo = 'aumentou' | 'reduziu' | 'estavel'
```

### 2.3 Lógica de classificarDriver (simplificada)
```typescript
export function classificarDriver(
  valorNovo: number,
  valorAntigo: number,
  estavelThreshold = DEFAULT_ESTAVEL_THRESHOLD,
): DriverTipo {
  const diff = valorNovo - valorAntigo
  if (Math.abs(diff) < estavelThreshold) return 'estavel'
  return diff > 0 ? 'aumentou' : 'reduziu'
}
```

**Consequência:**
- IRPJ Jan=56k, Fev=0 (antigo=56k, novo=0): diff=-56k → `reduziu` (antes era `sumiu`)
- Rescisão Jan=0, Fev=5172 (antigo=0, novo=5172): diff=+5172 → `aumentou` (antes era `novo`)
- Aluguel Jan=8k, Fev=12k: diff=+4k → `aumentou` (igual)
- Salários Jan=44k, Fev=39k: diff=-5k → `reduziu` (igual)

### 2.4 UI tabela (DriverRow.tipoMeta) — remover 2 entradas
`app/(dashboard)/.../analise-variacao-client.tsx:509-542`

Remover linhas 524-535 (entries `novo` e `sumiu`). Mantém:
- aumentou (vermelho)
- reduziu (verde)
- estavel (cinza)

### 2.5 Ocorrências em arquivos
| Arquivo | Ocorrências 'novo'/'sumiu' | Tipo |
|---|---|---|
| `lib/relatorios/analise-variacao.ts` | 9 | tipo enum + comments + classificarDriver + acaoCronologica (interna a gerarInsights, vai sumir) |
| `app/(dashboard)/.../analise-variacao-client.tsx` | 4 | tipoMeta + iconForTipo (vai sumir junto com InsightsCard) |
| `__tests__/analise-variacao.test.ts` | **20** | classificarDriver tests + driver() helper calls + asserts |

---

## 3. Tests a atualizar

### 3.1 Estratégia
Os testes que esperavam `tipo: 'novo'` ou `tipo: 'sumiu'` agora esperam `aumentou`/`reduziu`. Conversão mecânica:

| Antes | Depois | Critério |
|---|---|---|
| `tipo: 'novo'` (com diferença POSITIVA) | `tipo: 'aumentou'` | apareceu → diff > 0 |
| `tipo: 'sumiu'` (com diferença NEGATIVA) | `tipo: 'reduziu'` | sumiu → diff < 0 |

### 3.2 Tests específicos a tocar

**classificarDriver:**
- Linha 114: `expect(classificarDriver(500, 0)).toBe('novo')` → `'aumentou'`
- Linha 118: `expect(classificarDriver(0, 500)).toBe('sumiu')` → `'reduziu'`

**decompor:**
- Linha 164: `expect(c.tipo).toBe('novo')` → `'aumentou'`
- Linha 173: `expect(d.tipo).toBe('sumiu')` → `'reduziu'`

**Helper `driver(id, name, diff, tipo)`** (declarado nos tests):
Linha 402, 442, 457, 470, 729, 1075, 1076, 1137, 1147 — todas usam `'novo'` ou `'sumiu'`. Conversão: se `diff > 0` → `'aumentou'`, se `diff < 0` → `'reduziu'`.

**analiseVariacao integration:**
- Linha 582, 1011, 1030, 1261, 1279 — asserts de `tipo === 'novo'/'sumiu'` precisam virar `'aumentou'/'reduziu'`.

### 3.3 Tests de insights — DELETAR inteiros

Os testes que validavam wording dos bullets ("apareceu no mês novo", "sumiu (era pago no mês antigo)", "aumentou vs antigo") deletam junto:
- `describe('gerarInsightsPrincipais', ...)` — bloco inteiro (~10 tests)
- `describe('Hotfix Waterfall SVG: defaults agressivos em analiseVariacao', ...)` — o teste "insights NÃO contém bullet outros drivers" não tem mais sentido
- `describe('Hotfix cronológica: insights cronológicos', ...)` — bloco inteiro (3 tests)
- Tests de coerência tabela↔waterfall↔insights — remover asserts de `insightsPrincipais[0].texto`

**Estimativa:** 60 testes existentes → mantém ~40 após deletar os relacionados a insights, + ajustes em ~25 deles trocando 'novo'/'sumiu'.

---

## 4. Cores e visual

| Tipo | Cor atual | Cor pós-fix |
|---|---|---|
| aumentou | red-600 (vermelho) | mantém **vermelho** |
| reduziu | emerald-600 (verde) | mantém **verde** |
| novo | purple-600 (roxo) | **REMOVIDO** |
| sumiu | slate-500 (cinza) | **REMOVIDO** |
| estavel | slate-400 (cinza claro) | mantém **cinza** |

Waterfall SVG: já usa só vermelho (`aumento`) e verde (`reducao`) — NÃO precisa tocar.

---

## 5. Riscos

| Risco | Mitigação |
|---|---|
| `gerarTituloNarrativo` usa tipo de driver? | Não — só usa `top[0].categoryName` + `diferenca`. Seguro. |
| Outros consumers do field `insightsPrincipais`? | `grep` confirmou 0 fora do componente client. Seguro deletar. |
| Tests que aceitam tipo como argumento de helper `driver()` | Conversão manual 1 a 1 — vou listar cada caso |
| Componentes externos que importem `Insight`/`InsightTipo` | `grep` em `components/`, `app/`, `lib/` confirmou só usado no engine + client locais |
| API consumer externo (mobile, scripts) | Não existe — projeto não tem app mobile ou clients externos |

---

## 6. Plano de execução (Fase 2 — após aprovação)

| Bloco | Tempo | Conteúdo |
|---|---|---|
| L.2 | 15min | Remover bloco insights UI + types + função engine |
| L.3 | 15min | Simplificar DriverTipo + classificarDriver + tipoMeta UI |
| L.4 | 30min | Atualizar 25 tests + deletar ~10 tests de insights |
| L.5 | 30min | Build + push + deploy + 4 checks |
| **Total** | **~1h30** | Dentro estimado |

---

## 7. Aprovação solicitada

Yussef, antes de Fase 2:

1. **Remoção total do bloco insights (UI + backend)** — confirmado pelo seu "tudo isso quero tirar não quero insights"
2. **DriverTipo simplificado pra `aumentou` / `reduziu` / `estavel`** — sem `novo`/`sumiu`. IRPJ vira `reduziu`, Rescisão vira `aumentou`.
3. **`estavel` mantido** pra casos onde `|diff| < threshold` (R$ 100).
4. **Cores intocadas** — vermelho (aumentou), verde (reduziu), cinza (estavel).
5. **Waterfall SVG não muda** (já só usa vermelho/verde).
6. **Tests de insights deletados, restantes ajustados** mecanicamente (novo→aumentou, sumiu→reduziu).
7. **Deploy com 4 verificações obrigatórias** após push.

OK em tudo? Sigo Fase 2.
