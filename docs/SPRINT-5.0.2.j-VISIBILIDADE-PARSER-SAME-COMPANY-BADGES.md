# Sprint 5.0.2.j — Visibilidade + Parser Pix Melhor + Auto-Match MESMA Empresa + Badges

**Status:** ✅ CONCLUÍDO em 25/05/2026
**Suite testes:** 2347 → **2362 (+15 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled

## Motivação (4 problemas Yussef)

❌ **Re-análise silenciosa** — toast genérico não permitia ver QUE transações mudaram nem desfazer.
❌ **Parser EMV/copia-e-cola** — chave EMV longa (00020126…) não detectada, nome com formato diferente (`Yussef Musa` cadastrado vs `YUSSEF ABU ZAHRY MUSA` na descrição) não matcheia.
❌ **Transferência entre contas da MESMA empresa** — Cacula Mix (3 contas: Sicredi/Banrisul/Stone) faz Pix interno e sistema tratava como despesa+receita, inflando DRE.
❌ **Badges ausentes** — `relatedPartyType` existia no schema mas sem componente visual.

## Parte A — Modal detalhado (sem migration histórico)

**Decisão pragmática:** sem migration `categorization_history` agora — endpoint retorna lista detalhada + impacto DRE, modal substitui toast. Audit log + revert ficam pra sprint futura.

### Endpoint `/recategorize-pix` expandido
Retorno agora inclui:
```typescript
{
  analisadas: number
  socioPF, socioPFImpact, socioPFIds[]
  grupoPJ, grupoPJImpact, grupoPJIds[]
  sameCompany, sameCompanyImpact, sameCompanyIds[]
  conciliacoes: number              // total pares formados
  impactoDRETotal: number           // soma de tudo que saiu do DRE
}
```

### Modal `ResultadoReanaliseModal`
Substitui toast genérico. Mostra:
- Total analisadas vs alteradas
- 3 cards coloridos (ciano/âmbar/azul) com count + valor R$ por tipo
- Bloco "Impacto no DRE Realizado" em verde com `impactoDRETotal`
- Mensagem amigável quando nada foi alterado (lista causas possíveis)

## Parte B — Parser Pix melhor

### `nameMatchFlexible(cadastrado, descricao)` (NOVO export)

Retorna `{ match, confidence, matchedWords[] }`:
1. **Substring exato** → confidence 1.0
2. **Tokenização** — só palavras ≥3 chars, ignora stopwords (de/da/do/das/dos/e/em/na/no)
3. **Match por palavra** — exato OU prefixo ≥4 chars (bidirecional)
4. **1 palavra cadastrada** → match único exato ou prefixo
5. **2+ palavras** → ≥2 matches; confidence = matched/total

Exemplo:
- `"Yussef Musa"` cadastrado vs `"YUSSEF ABU ZAHRY MUSA"` descrição → match com confidence 1.0

`nameMatch(...)` (boolean compat Sprint 5.0.2.h) delega pro flexível.

## Parte C — Auto-Match Contas MESMA Empresa

### `lib/conciliation/match-same-company-transfer.ts` (NOVO)

```typescript
matchSameCompanyTransfer({
  transactionId, bankAccountId, companyId,
  type, amount, date, description
}) → { matched, linkedTransactionId?, linkedBankAccountId?, reason? }
```

Detecta Pix entre contas do MESMO `companyId` (sem precisar cadastro):
1. Descrição tem PIX/TED/transferência
2. Empresa tem ≥2 contas bancárias
3. Outra conta tem tx: tipo oposto + valor exato + ±1 dia + ainda não conciliada
4. Atomic `$transaction` marca AMBAS `isInternalTransfer=true` + linka via `linkedTransactionId`

### Integração no endpoint `/recategorize-pix`

Pipeline em **3 fases ordenadas**:
- **FASE 0 — SAME-COMPANY** (prioridade máxima, sem cadastro): se bate, marca ambas com `Transferência entre Contas (grupo)` + RECONCILED + skip outras fases
- **FASE 1 — Pix relacionado**: detecta sócio/empresa cadastrada
- **FASE 2 — Conciliação externa**: se GRUPO_PJ + empresa do grupo no sistema, conciliação bilateral

### Validação bloqueio empresa do próprio
`POST /empresas-relacionadas`: rejeita 400 se `cnpjRelacionado === empresa.cnpj`. Mensagem:
> "Não pode cadastrar a EMPRESA ATUAL como relacionada. Transferências entre contas da mesma empresa são detectadas automaticamente."

## Parte D — Badges visuais

### `components/transactions/related-party-badge.tsx` (NOVO)

3 tipos com tooltips:
- **🔗 Conta Própria** (ciano) — `isInternalTransfer && !relatedPartyType` (same-company)
- **👤 Sócio** (âmbar) — `relatedPartyType === 'SOCIO_PF'`
- **🏢 Grupo** (azul, + 🔗 se conciliada) — `relatedPartyType === 'GRUPO_PJ'`

Componente puro, sem fetch — recebe `relatedPartyType + isInternalTransfer` por props. Pra usar em `PendentesClient`, `/transacoes`, `/conciliacao`, modal detalhes — basta importar e passar campos.

## Validação (15 tests novos)

- **15 nameMatchFlexible**: substring exato (case/acento/lowercase), 2+ palavras significativas (EMV string), stopwords ignoradas (de/da/do/e/em), prefixos ≥4 chars, 1 palavra única (match exato OU prefixo), edge cases (null/empty/palavras curtas), compat boolean `nameMatch`

## Métricas

| | Antes (5.0.2.i) | Depois (5.0.2.j) |
|---|---|---|
| Testes | 2347 | **2362 (+15)** |
| Tools detect Pix | 2 (same-company faltava) | **3** |
| UI feedback re-análise | Toast genérico | **Modal detalhado por tipo** |
| nameMatch | Simples (2 palavras exatas) | **Flexible (stopwords + prefixos + confidence)** |
| Bloqueio empresa do próprio | Não | **Sim** |
| Badges visuais | Sem componente | **RelatedPartyBadge 3 cores** |

## Arquivos

### Novos (3 + 1 teste)
- `lib/conciliation/match-same-company-transfer.ts`
- `components/transactions/related-party-badge.tsx`
- `__tests__/pix-name-match-flexible.test.ts`
- `docs/SPRINT-5.0.2.j-VISIBILIDADE-PARSER-SAME-COMPANY-BADGES.md`

### Modificados (4)
- `lib/pix-detection/parse-pix.ts` (+`nameMatchFlexible` export com confidence)
- `app/api/empresas/[id]/empresas-relacionadas/route.ts` (bloqueio próprio CNPJ)
- `app/api/empresas/[id]/recategorize-pix/route.ts` (Fase 0 same-company + retorno detalhado)
- `app/(dashboard)/pessoas-vinculadas/pessoas-vinculadas-client.tsx` (ResultadoReanaliseModal)

## Smoke test pra Yussef

1. **`/pessoas-vinculadas`** — tentar cadastrar CNPJ do Cacula Mix como relacionada → erro 400 "Não pode cadastrar EMPRESA ATUAL"
2. Sem cadastrar nada, clicar **"Re-analisar Pix antigos"** (Cacula tem 3 contas: Sicredi/Banrisul/Stone):
   - Modal abre com card ciano **"Conta Própria"** mostrando X transferências entre contas
   - Impacto DRE: R$ Y saíram de despesas/receitas
3. Cadastrar sócio "Yussef Musa" + chaves Pix + clicar de novo:
   - Modal mostra card âmbar **"Distribuição/Pró-labore"**
   - Funciona com descrição EMV longa (parser flexível matcheia "YUSSEF ABU ZAHRY MUSA")
4. Cadastrar CNPJ academia + clicar de novo:
   - Card azul **"Transferência Grupo"**
   - Se academia também tem OFX importado: conciliações bilaterais
5. **`/pendentes`** ou `/transacoes`: badge visual aparece em todas tx categorizadas via Pix

## Pendências (futuras sprints)

- **Histórico/audit log** + endpoint revert (Sprint 5.0.2.k) — adicionar migration `categorization_history`
- **Integração automática no import OFX** — hoje só roda via botão re-analisar
- **Aplicar `RelatedPartyBadge`** em `PendentesClient` + `/transacoes` + `/conciliacao` (componente criado, falta wiring)
- **Filtro "Mostrar transferências internas"** em `/transacoes`

## Decisões técnicas

- **Sem migration histórico** — endpoint retorna detalhamento suficiente pro modal. Audit/revert fica pra próxima sprint (escopo grande).
- **Same-company tem prioridade máxima** — `continue` no loop pula outras fases (não tenta sócio/grupo se já é mesma empresa).
- **Prefixo ≥4 chars** no nameMatch — evita match de "ab"/"abc" mas pega "yusse"/"academ".
- **Stopwords PT-BR** — ignora "de/da/do/e/em" em ambos os lados pra evitar match espúrio em "Empresa de Tecnologia" vs "Empresa de Construção".
- **RelatedPartyBadge é puro** — recebe campos por props (não faz fetch). Caller decide quando usar.
