# Auditoria — Análise de Variação cronológica (antigo → novo)

**Data:** 28/05/2026 · **Branch:** `hotfix/analise-variacao-cronologica`
**Backup prod:** `/var/backups/conta-ia/pre-cronologica-20260528_202404.dump` (583K)
**Baseline:** main HEAD `f046a6e` (após hotfix headers + SVG)

---

## 1. Diagnóstico do bug atual

### 1.1 Mapeamento da semântica HOJE

Toda a pipeline trata `mesInvestigado` como "referência principal" e
`ymComparacao` como "outro período". Cálculo:
```
diferenca = valorInvestigado - valorComparacao
```

E a classificação (`lib/relatorios/analise-variacao.ts:218-229`):
```typescript
'novo'    → comp=0, invest>0   // semantica: "comp era antes, invest é agora"
'sumiu'   → invest=0, comp>0
'aumentou'→ invest > comp
'reduziu' → invest < comp
```

A engine **assume** que `invest=AGORA` e `comp=ANTES`. Comentário no
código (linha 28): `'aumentou' // existia antes, gastou mais agora`.

### 1.2 Por que falha em prod

O usuário tem **liberdade de escolha**: dropdown "Investigar" + "Comparar
com". Quando Yussef escolheu:
- **Investigar = Janeiro/2026** (cronologicamente ANTIGO)
- **Comparar = Fevereiro/2026** (cronologicamente NOVO)

A engine NÃO valida cronologia. Resultado:
- IRPJ tinha R$ 56.507 em Jan, R$ 0 em Fev
- Engine: `valorInvest=56507, valorComp=0` → classifica `'novo'` (errado — sumiu!)
- Diferenca = +56507 (errado — caiu, era -56507)
- Bar tipo='aumento' = vermelho (errado — verde)
- Título: "Janeiro custou +R$ 99k a MAIS que Fevereiro" (errado — Fev custou MENOS que Jan)

### 1.3 Onde aparece o bug

Pipeline inteira contaminada quando `mesInvestigado < ymComparacao`:

| Componente | Arquivo | Linha | Comportamento errado |
|---|---|---|---|
| Classificação | `lib/relatorios/analise-variacao.ts` | 218-229 | NOVO/SUMIU invertidos |
| Decomposição | mesmo | 239-292 | sinal de `diferenca` invertido |
| Waterfall bars | mesmo | 651-758 | "Início" = futuro, "Fim" = passado |
| Título narrativo | mesmo | 784-819 | sujeito = ANTIGO |
| Insights | mesmo | 827-895 | "só apareceu agora" no que sumiu |
| Tabela headers | `analise-variacao-client.tsx` | 458-468 | ordem da esquerda = última |
| Linhas tabela | mesmo | 558-562 | valor antigo vai pro col direito |
| ResumoCard | mesmo | 360-372 | "Diferença" com sinal invertido |

### 1.4 Casos onde NÃO há bug hoje

- Quando o usuário escolhe invest=Fev/26 e comp=Jan/26 → invest IS o novo, tudo OK.
- Modo `mes-vs-media` → invest=mês escolhido (novo), comparação=média
  dos meses ANTERIORES (antigo) → sempre correto, sem intervenção.

Conclusão: o bug é **invisível** quando o usuário ordena "intuitivamente"
(invest=mais recente), mas explode quando inverte.

---

## 2. Plano de mudança (REGRA: antigo → novo SEMPRE)

### 2.1 Estratégia escolhida — Rename + Adapter cronológico

Duas opções avaliadas:

| Opção | Esforço | Clareza no código | Decisão |
|---|---|---|---|
| **A) Adapter na API** (swap mesInvestigado/ymComparacao se necessário, engine intocada) | baixo (~30 min) | nome "investigado" continua enganando leitor | ❌ |
| **B) Rename pra `antigo`/`novo` + adapter** | médio (~3h) | intenção do código explícita | ✅ |

Yussef pediu explicitamente "Renomear variáveis pra antigo/novo (deixa
intenção clara no código)" → **opção B**.

### 2.2 Detecção cronológica — um único ponto

Em `app/api/empresas/[id]/relatorios/analise-variacao/route.ts`:

```typescript
function ordenarCronologicamente(mesA: string, mesB: string) {
  // YYYY-MM compara lexicograficamente == cronologicamente
  if (mesA <= mesB) return { antigo: mesA, novo: mesB }
  return { antigo: mesB, novo: mesA }
}

// Antes de montar analiseInput:
const { antigo, novo } = input.mode === 'mes-vs-mes'
  ? ordenarCronologicamente(input.mesInvestigado, input.ymComparacao)
  : { antigo: '__MEDIA__', novo: input.mesInvestigado }
```

Daqui pra frente, **toda a engine recebe `antigo` e `novo` já ordenados**.

### 2.3 Engine — rename consistente

| Antigo | Novo |
|---|---|
| `mesInvestigado` | `mesNovo` |
| `ymComparacao` | `mesAntigo` |
| `mesInvestigadoLabel` | `novoLabel` |
| `comparacaoLabel` | `antigoLabel` |
| `valorInvestigado` | `valorNovo` |
| `valorComparacao` | `valorAntigo` |
| `totalInvestigado` | `totalNovo` |
| `totalComparacao` | `totalAntigo` |

Função `classificarDriver(valorNovo, valorAntigo)`:
```typescript
if (valorAntigo === 0 && valorNovo > 0) return 'novo'
if (valorAntigo > 0 && valorNovo === 0) return 'sumiu'
const diff = valorNovo - valorAntigo
if (Math.abs(diff) < threshold) return 'estavel'
return diff > 0 ? 'aumentou' : 'reduziu'
```

`decompor(antigo, novo)`:
```typescript
const diferenca = valorNovo - valorAntigo   // positivo = subiu
```

### 2.4 Waterfall — barra início = antigo

`buildWaterfallBarsFromSelection`:
- `bars[0]` (tipo='inicio'): label=`antigoLabel`, value=`totalAntigo`
- `bars[N+1]` (tipo='fim'): label=`novoLabel`, value=`totalNovo`
- Cores mantêm semântica: `aumento` (vermelho) = novo>antigo; `reducao` (verde) = novo<antigo
- Drivers `novo` → bar 'aumento' (vermelho)
- Drivers `sumiu` → bar 'reducao' (verde)

### 2.5 Título narrativo cronológico

```typescript
return `${novoLabel} custou ${sinal}${valor} ${direcao} que ${antigoLabel} — ${labelTop} responderam por ${pct}% da ${tipoMov}`
```
Onde:
- `sinal/direcao`: positivo → `+ a mais`; negativo → `- a menos`
- `tipoMov`: positivo → `alta`; negativo → `queda`
- Estável: `${novoLabel} ficou estável em relação a ${antigoLabel}`

### 2.6 Insights cronológicos

```typescript
const acao = top.tipo === 'novo'    ? 'apareceu no mês novo'
           : top.tipo === 'sumiu'   ? 'sumiu (era pago no mês antigo)'
           : top.tipo === 'aumentou'? 'aumentou vs antigo'
           : top.tipo === 'reduziu' ? 'reduziu vs antigo'
           : ''
```
- Top 2 drivers (existente) + Concentração ≥50% (existente)
- Bullet "X outros drivers somam Y" **continua REMOVIDO** (já feito no hotfix anterior)

### 2.7 UI — tabela e legenda

Headers dinâmicos (já implementados, agora com novos labels):
```typescript
const headers = computeTabelaHeaders({
  modo: input.mode,
  novoLabel: data.novoLabel,
  antigoLabel: data.antigoLabel,
  nMesesContexto,
})
// modo='mes-vs-mes':   labelAntigo=Jan/26, labelNovo=Fev/26
// modo='mes-vs-media': labelAntigo='Média 6M', labelNovo=Jan/26
```

DriversTabela:
```tsx
<th>CATEGORIA</th>
<th>{labelAntigo.toUpperCase()}</th>   {/* esquerda */}
<th>{labelNovo.toUpperCase()}</th>     {/* direita */}
<th>DIFERENÇA</th>
<th>TIPO</th>

{/* DriverRow */}
<td>{d.valorAntigo > 0 ? formatBRL(d.valorAntigo) : '—'}</td>
<td>{d.valorNovo > 0 ? formatBRL(d.valorNovo) : '—'}</td>
```

**Legenda nova** abaixo do título narrativo (transparência cronológica):
```tsx
<p className="text-[11px] text-muted-foreground mt-1">
  Cronologia: <span className="font-medium">{antigoLabel}</span> (antigo) →{' '}
  <span className="font-medium">{novoLabel}</span> (novo)
</p>
```

UI dos dropdowns "Investigar" + "Comparar com" — **NÃO mexer**. Continua
liberdade de escolha + ordenação transparente.

### 2.8 ResumoCard

Estrutura atual: `mesInvestigadoLabel | comparacaoLabel | diferença`.
Pós-rename:
- Coluna 1: `antigoLabel` + `totalAntigo`
- Coluna 2: `novoLabel` + `totalNovo`
- Coluna 3: `diferenca` com sinal e cor (vermelho subiu / verde caiu)

### 2.9 Componentes que NÃO mudam

- `WaterfallChartSvg.tsx` — recebe `bars` já no formato correto, código intocado
- `WaterfallChartSvgWrapper.tsx` — wrapper dynamic, intocado
- `selecionarDriversVisuais` — função pura, independente da semântica antigo/novo
- `agregarPorCategoria` — agregador por bucket, neutral

---

## 3. Lista exaustiva de arquivos a tocar

| Arquivo | Mudança |
|---|---|
| `lib/relatorios/analise-variacao.ts` | RENAME (8 props nos types + 6 funções) + título + insights + classificarDriver |
| `app/api/empresas/[id]/relatorios/analise-variacao/route.ts` | Adicionar `ordenarCronologicamente` + adaptar build do `analiseInput` |
| `app/(dashboard)/empresas/[id]/relatorios/analise-variacao/analise-variacao-client.tsx` | Rename props (DriversTabela, DriverRow, ResumoCard) + legenda nova |
| `__tests__/analise-variacao.test.ts` | Atualizar 60 testes existentes + adicionar 20+ novos |

**Total:** 4 arquivos. Sem migration. Sem mudança em outros componentes.

---

## 4. Testes — mínimo +20

### 4.1 Ordenação cronológica (5)
- Jan vs Fev → antigo=Jan, novo=Fev
- Fev vs Jan (ordem invertida na UI) → antigo=Jan, novo=Fev (resultado IGUAL)
- Abr/26 vs Jan/26 → antigo=Jan, novo=Abr
- Jun/26 vs Dez/25 → antigo=Dez/25, novo=Jun/26 (cruza ano)
- Mesmo mês escolhido 2x → erro 400 (Zod refine)

### 4.2 Classificação cronológica (4)
- IRPJ Jan=56k, Fev=0 com Jan antigo → SUMIU
- Rescisão Jan=0, Fev=5172 → NOVO
- Salários Jan=44k, Fev=38k → REDUZIU
- vs Média: média=20k, mes=25k → AUMENTOU

### 4.3 Título narrativo (4)
- novo<antigo → "Fev custou -R$X a menos que Jan — top2 X% da queda"
- novo>antigo → "Abr custou +R$Y a mais que Jan — top2 X% da alta"
- Estável → "Fev ficou estável em relação a Jan"
- vs média → "Jan custou ... que Média 6M"

### 4.4 Insights cronológicos (3)
- top1.tipo='novo' → texto contém "apareceu no mês novo"
- top1.tipo='sumiu' → texto contém "sumiu (era pago no mês antigo)"
- top1.tipo='aumentou' → "aumentou vs antigo"

### 4.5 Aritmética preservada (2)
- soma(drivers.diferenca) ≈ totalNovo - totalAntigo (tolerância 0.01)
- Aritmética fecha mesmo com Outros agregado (10 categorias, top 6)

### 4.6 Coerência tabela ↔ waterfall ↔ insights (3)
- Driver classificado 'novo' → bar tipo='aumento' (vermelho) → insight diz "apareceu"
- Driver classificado 'sumiu' → bar tipo='reducao' (verde) → insight diz "sumiu"
- ResumoCard.diferenca == bars[fim].end - bars[inicio].end

**Total:** 21 novos + atualização dos 60 existentes → ~81 testes.

---

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Rename quebra imports externos | Apenas `analise-variacao-client.tsx` + route + tests usam. Audit confirmou 0 outros consumidores |
| Caso `mes-vs-media` quebra cronologia | Adapter trata explícito: `antigo='__MEDIA__'`, `novo=mesInvestigado`. Engine não muda comportamento |
| Cache de API com schema antigo | API retorna result novo; client é deploy do mesmo commit → sem cache stale |
| Yussef tem screenshots/links antigos com `?mesInvestigado=...` | Backend continua aceitando query params `mesInvestigado`/`ymComparacao` — só RENOMEIA INTERNAMENTE. UI segue enviando os mesmos params. URLs antigas funcionam |
| Migration de dados | NÃO há — só código de cálculo + UI |
| Build erro por tipo desalinhado | TS strict pega; rodar `tsc --noEmit` no fim de cada bloco |

---

## 6. Plano de execução (Fase 2 — após aprovação)

| Bloco | Tempo | Conteúdo |
|---|---|---|
| 6.1 | 30 min | API route: `ordenarCronologicamente` + adapter input |
| 6.2 | 90 min | Engine: rename types + funções + classificarDriver + decompor + título + insights |
| 6.3 | 30 min | UI client: rename props + legenda cronologia |
| 6.4 | 60 min | Tests: atualizar 60 existentes + adicionar 21 novos |
| 6.5 | 30 min | Build + tsc + push + deploy + smoke prod |
| **Total** | **~4h** | (dentro do estimado da spec) |

---

## 7. Aprovação solicitada

Yussef, antes de Fase 2 quero confirmar:

### 7.1 Rename completo vs adapter minimal
**Recomendo rename pra `antigo`/`novo`** — você pediu explícito ("deixa
intenção clara no código"). Atinge 60 testes mas o resultado é código que
LITERALMENTE diz a intenção.

### 7.2 Modo `mes-vs-media`
**Mantenho lógica:** média = sempre antigo (passado agregado), mês = sempre
novo. Header esquerda "MÉDIA 6M", direita "JANEIRO/2026".

### 7.3 Legenda cronologia
**Adiciono o subtítulo** "Cronologia: Janeiro/2026 (antigo) → Fevereiro/2026
(novo)" embaixo do título narrativo. Transparência sem poluir.

### 7.4 UI dropdowns
**NÃO mexo** nos labels "Investigar"/"Comparar com". Mantém familiar +
funciona com ordenação transparente.

### 7.5 URLs antigas
Backend continua aceitando `?mesInvestigado=...&ymComparacao=...`.
Reorderna internamente. Zero breaking change pra links salvos.

### 7.6 Deploy
4 verificações obrigatórias após push (REGRA NOVA do CLAUDE.md):
1. `git log --oneline -1` em prod = commit esperado
2. `BUILD_ID` timestamp > último commit
3. `pm2 info uptime` < 5min
4. `curl -sI https://app.caixaos.com.br/login` 200/302

Aguardo seu OK pra começar Fase 2.
