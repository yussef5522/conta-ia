# Auditoria — Export CSV + PDF dos Relatórios

**Data:** 29/05/2026 · **Branch:** `feature/relatorios-export-csv-pdf`
**Baseline:** main HEAD `28a67d7` (sidebar limpa pós-brand)

---

## 1. Export existente no projeto

### 1.1 CSV — padrão estabelecido (3 libs, todas idênticas)
| Lib | Linhas | Convenções |
|---|---|---|
| `lib/audit-csv.ts` | 110 | BOM UTF-8 + **vírgula** separador + escape RFC 4180 + `\r\n` linha |
| `lib/contas-pagar/csv-export.ts` | exports CSV de contas | Mesmo padrão |
| `lib/transacoes/csv.ts` | exports CSV de transações | Mesmo padrão |

**Convenção do projeto:**
- BOM `﻿` no início (Excel BR reconhece UTF-8 + acentos)
- Separador de campo: **vírgula** (NÃO `;`)
- Decimais: vírgula como separador (Excel BR formato)
- Aspas duplas em campos com `,` `"` `\n` `\r` `;`
- Datas: `toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })`

🚨 **Conflito com spec:** Yussef sugeriu `;` como separador no spec. Mas o projeto já tem padrão consistente em 3 libs com **vírgula**. **Recomendo manter vírgula** pra consistência e porque Excel BR abre vírgula+BOM perfeitamente. Decisão a confirmar.

### 1.2 ExportButton existente (`components/contas-pagar/ExportButton.tsx`)
- Específico de Contas a Pagar (só CSV, sem PDF)
- Padrão `Button outline + Download icon + loading state + toast`
- Usa `fetch + blob + a.download`
- Filename do `Content-Disposition` retornado pelo backend
- Toast com count via header `X-Row-Count`

**Pode ser referência**, mas vou criar **`<ExportReportButton>` separado** em `components/relatorios/` com dropdown CSV/PDF. Não mexer no de Contas a Pagar (em prod estável).

### 1.3 react-pdf — compatibilidade confirmada
- `@react-pdf/renderer@4.5.1` disponível no npm
- `peerDeps.react: ^16/17/18/19` — bate com React 18.3.1 do projeto
- Sem código pré-existente no projeto (zero `renderToBuffer` ou `@react-pdf` import)

---

## 2. Os 9 relatórios mapeados (spec lista 8 + analise-ia)

| # | UI Rota | API GET | querySchema | Engine reuso | Gráfico |
|---|---|---|---|---|---|
| 1 | `/relatorios/comparativo` | `/relatorios/comparativo/route.ts` | refMonth, meses, granularidade, tipo, regime | `computeComparativoMulti` | **heatmap cells** |
| 2 | `/relatorios/analise-variacao` | `/relatorios/analise-variacao/route.ts` | mesInvestigado, ymComparacao, mode, tipo, regime | `analiseVariacao` | **waterfall SVG** |
| 3 | `/relatorios/dre-gerencial` | `/dre/route.ts` (não em /relatorios/) | empresaId, mês ref | `calculateDRE` | sem gráfico |
| 4 | `/relatorios/fluxo-caixa` | `/relatorios/fluxo-caixa/route.ts` | período, regime | `calculateConsolidatedCashflow` + projection | sem gráfico no PDF |
| 5 | `/relatorios/categorias` | `/relatorios/categorias/route.ts` | refMonth, top N | preview-queries | sem gráfico |
| 6 | `/relatorios/fornecedores` | `/relatorios/fornecedores/route.ts` | refMonth | top-suppliers | sem gráfico |
| 7 | `/relatorios/funcionarios` | `/relatorios/funcionarios/route.ts` | refMonth | payroll lib | sem gráfico |
| 8 | `/relatorios/variancias` | `/relatorios/variancias/route.ts` | refMonth | detect-variances | sem gráfico |
| **9** | `/relatorios/analise-ia` | `/ai/insights` | mode, períodos | Claude Sonnet API | **NÃO TABULAR** |

🚨 **#9 Analise IA** — relatório de NARRATIVA (texto IA gerado), não tabular. Yussef não listou no spec dos 8. **Recomendo PULAR** desta sprint. PDF de IA seria texto fluído + JSON salvo — outra natureza, fica pra sprint dedicada.

---

## 3. Decisão arquitetural

### 3.1 Endpoint: per-relatório vs unificado
**Spec sugere:** `/api/empresas/[id]/relatorios/export?relatorio=X&formato=Y`.

**Alternativa A — Unificado (spec)** — um endpoint, switch interno:
- ✅ Cliente único `<ExportReportButton relatorio="X" filtros={qs}>`
- ⚠️ Duplica todos os querySchemas dos 8 relatórios num query handler gigante
- ⚠️ Adicionar relatório futuro = mexer no switch central

**Alternativa B — Per-relatório** — `/api/empresas/[id]/relatorios/<x>/export?formato=Y`:
- ✅ Reusa o querySchema de cada GET existente (Zod já parseia)
- ✅ Adicionar relatório futuro = endpoint isolado
- ✅ Permissões e rate-limits per-relatório se necessário
- ⚠️ 8 arquivos de rota (mas cada um tem 30-40 linhas porque reusa engine)

**Recomendação:** **Alternativa B** + **uma lib compartilhada** `lib/export/render/` com builders CSV/PDF que cada route chama:
```typescript
// app/api/empresas/[id]/relatorios/comparativo/export/route.ts (NOVO)
const fmt = sp.get('format') // 'csv' | 'pdf'
const dados = await fetchComparativoData(empresaId, querySchema.parse(...))
if (fmt === 'csv') return new Response(renderComparativoCSV(dados), { headers })
return new Response(await renderComparativoPDF(dados), { headers })
```

### 3.2 PDF — react-pdf vs Puppeteer
- ✅ **react-pdf** (escolha do spec): leve, server-side `renderToBuffer`, gráficos via `<Svg>` nativo, Helvetica embutida
- ❌ Puppeteer: pesa ~280MB de Chromium + tempo de boot, fora de escopo

### 3.3 Fontes do PDF
**Spec sugere registrar Inter (3 weights TTF).**

| Opção | Custo | Resultado |
|---|---|---|
| **A. Helvetica default** (react-pdf embutida) | 0 | Funcional, neutro, não bate com brand |
| **B. Registrar Inter TTF** | ~600KB de fontes em `public/fonts/` | Bate com brand, mas adiciona peso |

**Recomendação:** começar **A** nesta sprint pra entregar funcional rápido. Inter fica em iteração futura quando refinar visual (fonte custom no PDF tem `Font.register` com URL local + load async — quero validar layout/dados primeiro antes de polir tipografia).

### 3.4 Logo no PDF
react-pdf tem `<Svg><Rect/><G/></Svg>` nativo. Recrio as 3 barras + wordmark "CAIXAOS" com primitivas — sem `<Image>` (que precisaria buscar SVG do filesystem em runtime server). 

### 3.5 CSV separador (decisão pendente)
| Opção | Compat Excel BR | Compat dev tools | Consistência interna |
|---|---|---|---|
| **Vírgula (atual)** | ✅ com BOM | ✅ universal | ✅ 3 libs existentes |
| `;` (spec) | ✅ default Excel BR | ⚠️ menos comum | ❌ inconsistente |

**Recomendo manter vírgula** pra alinhar com `lib/audit-csv.ts` + `lib/transacoes/csv.ts` + `lib/contas-pagar/csv-export.ts`. Quero confirmação.

---

## 4. Arquitetura proposta

```
lib/export/
├── csv/
│   ├── base.ts                    # escapeCsvField + buildCSV (BOM + vírgula + RFC 4180)
│   ├── format-brl.ts              # Reusa lib/format/money
│   └── format-date.ts             # toLocaleDateString pt-BR
├── pdf/
│   ├── PdfDocument.tsx            # <Document><Page> wrapper c/ header+footer fixos
│   ├── PdfLogo.tsx                # 3 barras violeta + wordmark CAIXAOS
│   ├── PdfTable.tsx               # tabela reusável c/ zebra + bold rows
│   ├── PdfHeatmap.tsx             # heatmap p/ Comparativo
│   ├── PdfWaterfall.tsx           # waterfall p/ Análise Variação
│   └── styles.ts                  # StyleSheet compartilhado
└── render/                         # 1 builder por relatório, retorna {csv, pdfComponent}
    ├── comparativo.tsx
    ├── analise-variacao.tsx
    ├── dre.tsx
    ├── fluxo-caixa.tsx
    ├── categorias.tsx
    ├── fornecedores.tsx
    ├── funcionarios.tsx
    └── variancias.tsx

components/relatorios/
└── ExportReportButton.tsx          # dropdown CSV/PDF + toast

app/api/empresas/[id]/relatorios/
├── comparativo/export/route.ts     # 8 endpoints novos (per-relatório)
├── analise-variacao/export/route.ts
├── dre/export/route.ts             # (path diferente, /dre não está em /relatorios/)
├── fluxo-caixa/export/route.ts
├── categorias/export/route.ts
├── fornecedores/export/route.ts
├── funcionarios/export/route.ts
└── variancias/export/route.ts
```

---

## 5. Plano de execução (Fase 2 — após aprovação)

| Bloco | Tempo | Conteúdo |
|---|---|---|
| E.2 | 30min | Install + lib/export/csv/base + render skeleton |
| E.3 | 45min | lib/export/pdf base (Document/Logo/Table/styles) |
| E.4 | 60min | **PdfHeatmap** + **PdfWaterfall** (gráficos custom) |
| E.5 | 60min | **CHECKPOINT** — Comparativo CSV+PDF completo, mostro pra Yussef revisar padrão |
| E.6 | 90min | Replicar pros outros 7 relatórios (DRE/Fluxo/Categorias/Fornecedores/Funcionários/Variâncias/Análise Variação) |
| E.7 | 45min | Component `<ExportReportButton>` + integrar nas 8 telas |
| E.8 | 45min | Tests (+30) + build verde |
| E.9 | 30min | Deploy + 4 verificações |
| **Total** | **~6h45min** | Dentro do estimado 6-8h |

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| `@react-pdf/renderer` SSR conflitar com Next 16 | Restringe import dos PDF components a server-side (route.ts). `'use server'` ou só imports dinâmicos no client se precisar preview futuro |
| Bundle size do react-pdf no client | Importar SÓ no server (route.ts). Client tem só `<ExportReportButton>` que faz fetch |
| Performance gerar 8 PDFs com gráficos | `renderToBuffer` é assíncrono. Aceitável até ~10k linhas / 3-5s. Stream se ficar lento |
| Inter custom font ausente | Helvetica default OK pra MVP. Refinement futuro |
| Limite 50k transações na engine fonte | Já existe. Drill-down não afeta. |
| Multi-tenant leak | Replicado de cada GET fonte: `getAuthContext + requirePermission` + OR 5 fontes companyId |
| Filtros divergentes entre tela e export | Cliente passa o querystring completo da tela. Backend reusa o mesmo querySchema do GET fonte |
| `dre` está fora de `/relatorios/` no API | Path diferente: `/api/empresas/[id]/dre/export` (não quebra padrão UX, só path interno) |
| Analise IA fora da sprint | Spec não inclui. Adicionar depois |

---

## 7. Aprovação solicitada — 7 pontos

Yussef, antes de Fase 2:

### 7.1 CSV separador: **vírgula** (manter padrão projeto) ou `;` (mudar)?
**Recomendo manter vírgula** — 3 libs CSV existentes já usam vírgula+BOM, Excel BR abre perfeitamente. Mudar pra `;` seria inconsistência interna pra ganho marginal.

### 7.2 Endpoint: per-relatório ou unificado?
**Recomendo per-relatório** (`/api/empresas/[id]/relatorios/<x>/export?format=Y`). Reusa o querySchema de cada GET existente, escala melhor.

### 7.3 PDF fonte: Helvetica default ou Inter custom?
**Recomendo Helvetica** nesta sprint (zero asset extra). Inter como refinement futuro quando layout estiver validado.

### 7.4 9º relatório (Análise IA): incluir ou pular?
**Recomendo pular** — é narrativa de IA, não tabular. PDF teria natureza diferente (texto fluído + JSON). Sprint dedicada.

### 7.5 DRE path: `/api/empresas/[id]/dre/export` (fora de `/relatorios/`)?
DRE engine está em `/api/empresas/[id]/dre/` (não em `/relatorios/`). Mantém lá pra não duplicar engine. Path um pouco assimétrico mas zero risco.

### 7.6 CHECKPOINT no E.5: pause + reviso antes de replicar pros 7 restantes?
Você pediu no spec. Vou parar depois do Comparativo CSV+PDF completo e mostrar o padrão antes de replicar.

### 7.7 Deploy 4 verificações + smoke prod (sem screenshot pré-deploy)?
Workflow padrão registrado (você nunca testa local). Eu valido com curl/build, você valida visual em prod.

OK em tudo? Sigo Fase 2.
