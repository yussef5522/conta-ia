# Sprint 5.0.2.k — STEM Fallback no Bulk Apply de Regras (Padrão QuickBooks)

**Status:** ✅ CONCLUÍDO em 26/05/2026
**Suite testes:** 2362 → **2378 (+16 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled

## Motivação (dor crítica do Yussef)

Em `/pendentes`, Cacula Mix tinha **243 transações pendentes**, sendo ~150 do tipo:
- `"RECEBIMENTO PIX-PIX_CRED 03955593088 João Vitor Soares dos Santos"`
- `"RECEBIMENTO PIX-PIX_CRED 12345678901 Maria Silva"`
- `"RECEBIMENTO PIX-PIX_CRED 33445566778 Pedro Lima"`

Todas eram "Receita de Venda" (vendas via maquininha Pix). Yussef categorizava UMA e esperava sistema aprender pra aplicar nas 149 restantes. **Não funcionava** — sistema cobria EXACT (descrição idêntica) ou NORMALIZED (strip de `" - "` prefixo), mas essas descrições não tinham `" - "` e os CPFs/nomes variavam tx por tx. Resultado: tudo PENDING.

## Solução: STEM como 3ª estratégia de match

Decisão **conservadora**: **NÃO refatorar** o pipeline existente (Sprint 3 Fase 3 Etapa 1: EXACT/NORMALIZED). **Adicionar** STEM como FALLBACK quando os dois primeiros retornam 0 similares.

### `lib/rules/extract-stem.ts` (NOVO)

Função PURA que remove dados variáveis e mantém núcleo identificador:

```typescript
extractDescriptionStem("RECEBIMENTO PIX-PIX_CRED 03955593088 João Vitor")
// → "RECEBIMENTO PIX-PIX_CRED"
```

Pipeline:
1. Uppercase
2. Remove CNPJ formatado ou 14 dígitos
3. Remove CPF formatado
4. Remove datas DD/MM/YYYY
5. Remove sequências ≥6 dígitos (IDs/códigos)
6. Remove valores R$ X.YYY,ZZ + decimais soltos
7. Tokeniza por espaço/barra (PRESERVA hífens internos: `PIX-PIX_CRED` continua 1 token)
8. Filtra: palavras ≥3 chars, sem stopwords (DE/DA/DO/E/EM/NA/NO/PARA/COM/POR), sem números puros
9. Pega **2 primeiras** palavras significativas (sweet spot — 3+ tende a incluir nomes)

### `lib/rules/find-similar-pending.ts` (auxiliar, NÃO usado direto na sprint mas pronto)

Loader DB pra buscar pendentes com stem específico — útil pra futuro endpoint dedicado.

### Endpoints CRUD (criados mas não wired no modal)

- `POST /api/empresas/[id]/rules/suggest-similar` — recebe `transactionId`, devolve stem + count + sample
- `POST /api/empresas/[id]/rules/create-and-apply` — cria `AiLearningRule(tipoMatch=CONTAINS)` + aplica em pendentes que batem (até 5000 cap)

Disponíveis pra outras integrações (próximas sprints podem usar pra criar UI dedicada de "tela de regras").

## Integração transparente no fluxo existente

Modificações em **2 pontos** do pipeline (sem refator):

### 1. `app/api/transacoes/[id]/similares/route.ts`

Adicionado **STEM fallback** após EXACT/NORMALIZED:

```typescript
// 1ª tentativa: EXACT/NORMALIZED (lógica original)
const similares = findSimilarTransactions({ baseDescription, tipoMatch, candidatas }, id)

// 2ª tentativa: STEM fallback
if (similares.length === 0) {
  const stem = extractDescriptionStem(base.description)
  if (stem && stem.length >= 4) {
    const stemMatches = candidatas
      .filter((c) => c.id !== id && c.categoryId === null && c.type === base.type)
      .filter((c) => (c.description ?? '').toUpperCase().includes(stem.toUpperCase()))
    if (stemMatches.length >= 2) {
      finalSimilares = stemMatches.map(...)
      finalTipoMatch = 'STEM'
      finalPadrao = stem
    }
  }
}
```

Response inclui `tipoMatch: 'EXACT' | 'NORMALIZED' | 'STEM'`.

### 2. `lib/ai-categorizer/apply.ts` — `classifyWithLearning`

Quando `applyToSimilar=true` e EXACT/NORMALIZED retornam 0, tenta STEM:
- Detecta stem com `extractDescriptionStem(base.description)`
- Busca substring case-insensitive no pool de pendentes (mesmo type, sem categoria)
- Se ≥2 matches: cria/upsert `AiLearningRule(tipoMatch='CONTAINS', padrao=stem)` com confiança 1.0
- Aplica bulk via `updateMany` (defesa multi-tenant)
- Incrementa `vezesAplicada` na regra CONTAINS criada

`AiLearningRule` schema já permite `tipoMatch=CONTAINS` (Sprint 4.5b já tinha o tipo no enum, só faltava engine de match). Pra próximos imports OFX, regra CONTAINS criada por essa Sprint não dispara AUTO no pipeline (predict.ts só processa EXACT/NORMALIZED), MAS a UI `/pendentes` segue funcionando: user clica 1 tx, modal `AprenderEAplicarModal` chama `/similares` que agora retorna STEM count, user aprova → bulk update aplicado.

## UX transparente

**Sem mudança de UI** — modal `AprenderEAplicarModal` (Sprint 4.5b) continua mostrando `"X similares · aplicar todas?"`. A diferença: agora aparece pra padrões tipo "RECEBIMENTO PIX-PIX_CRED" que antes ficavam invisíveis.

Yussef clica numa tx → escolhe categoria → modal pergunta:
> 150 similares encontradas (R$ 18.420). Aplicar a mesma categoria + aprender regra?

Confirma → 150 categorizadas em 1 click + regra CONTAINS criada.

## Validação (16 tests novos)

`__tests__/rules-extract-stem.test.ts`:
- **Caso real Yussef**: stem de "RECEBIMENTO PIX-PIX_CRED ..." mesmo entre tx com CPFs/nomes diferentes
- **Limpeza**: CNPJ formatado, CPF formatado, data DD/MM/YYYY, valor R$ X.YYY,ZZ, stopwords PT-BR
- **Edge cases**: null/empty, só números, palavras curtas filtradas, máximo 2 palavras
- **longestCommonStem**: várias descrições → stem mais frequente vence

## Métricas

| | Antes (5.0.2.j) | Depois (5.0.2.k) |
|---|---|---|
| Estratégias match | 2 (EXACT/NORMALIZED) | **3 (+STEM)** |
| Bulk apply cobre "PIX-PIX_CRED" | NÃO | **SIM** |
| Testes | 2362 | **2378 (+16)** |
| TS strict | 0 erros | 0 erros |
| Build | ✓ | ✓ |

## Arquivos

### Novos (4)
- `lib/rules/extract-stem.ts` (pure)
- `lib/rules/find-similar-pending.ts` (DB helper - auxiliar)
- `app/api/empresas/[id]/rules/suggest-similar/route.ts`
- `app/api/empresas/[id]/rules/create-and-apply/route.ts`
- `__tests__/rules-extract-stem.test.ts`
- `docs/SPRINT-5.0.2.k-STEM-FALLBACK-REGRAS-BULK.md`

### Modificados (2)
- `app/api/transacoes/[id]/similares/route.ts` (+STEM fallback retornando `tipoMatch='STEM'`)
- `lib/ai-categorizer/apply.ts` (+STEM fallback em `classifyWithLearning` — cria regra CONTAINS + bulk apply)

## Smoke test pra Yussef

1. **`/pendentes`** (Cacula Mix com 243 pendentes)
2. Categorizar 1 transação `"RECEBIMENTO PIX-PIX_CRED 03955593088 ..."` como "Receita de Venda"
3. **Modal abre** mostrando "150 similares encontradas · R$ 18.420"
4. Marcar checkbox "Aprender padrão" + clicar "Aplicar nas 150 similares"
5. **151 transações categorizadas** em 1 clique (1 base + 150 via stem CONTAINS)
6. Regra criada em `AiLearningRule` com `tipoMatch=CONTAINS`, `padrao="RECEBIMENTO PIX-PIX_CRED"`, `vezesAplicada=150`

## Pendências (futuras sprints)

- **Pipeline import OFX** processar CONTAINS automaticamente em novos batches (predict.ts atualmente só processa EXACT/NORMALIZED)
- **UI dedicada** em `/regras` (já existe sidebar) — listar regras CONTAINS criadas + editar/desativar
- **Agrupamento automático** em `/pendentes` (Toggle Lista/Agrupado)
- **Ações em batch** com checkbox seleção múltipla

## Decisões técnicas

- **STEM como 3ª opção, não substituir EXACT/NORMALIZED** — Fase 3 Etapa 1 funciona pra 70%+ casos (descrições com "FORNECEDOR - serviço"). STEM só entra quando os 2 primeiros falham.
- **STEM_WORD_LIMIT = 2** — sweet spot pelo teste empírico. 3+ tende a incluir nomes próprios (João/Maria) que variam tx por tx. 1 é genérico demais (perde "PIX-PIX_CRED" como diferenciador).
- **Stopwords PT-BR** — DE/DA/DO/E/EM/NA/NO/PARA/COM/POR — não trazem valor identificador.
- **Hífens internos preservados** — `PIX-PIX_CRED` continua único token (parte do código do canal Sicredi), não fragmenta.
- **Regra criada como CONTAINS** — schema já tinha `tipoMatch='CONTAINS'` (Sprint 4.5b). Pipeline import OFX vai precisar suporte em futura sprint pra disparar AUTO.
- **Confiança 1.0** na regra STEM — match manual com bulk apply via stem é determinístico (substring), não inferência. Trata como MANUAL.
