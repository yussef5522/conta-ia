# Sprint 5.0.2.3 — Auditoria do Importador Excel (Contas a Pagar)

**Data:** 2026-05-26
**Status:** AGUARDANDO APROVAÇÃO DO YUSSEF antes de codar qualquer linha
**Branch:** `feature/sprint-5.0.2.3-excel-import-rock-solid`
**Backup prod:** `/var/backups/conta-ia/pre-sprint-5.0.2.3-20260526_235258.dump` (495K) ✅

---

## TL;DR — o que descobri

O upload **funciona em prod** (parser, validação, criação do batch). O erro
visível "This page couldn't load" acontece num passo POSTERIOR. Logs de prod
mostram **2 bugs reais** + **1 ruído sem relação direta**:

| # | Bug | Severidade | Evidência |
|---|---|---|---|
| 1 | **`/confirm` viola `@@unique([bankAccountId, dedupHash])`** ao criar Transactions PAYABLE | 🔴 BLOQUEIA | `prisma:error Unique constraint failed on the fields: (bankAccountId, dedupHash)` repetido N× no stderr |
| 2 | **RSC tentando `cookies().set()` fora de Server Action / Route Handler** — provavelmente é o "This page couldn't load" visual | 🔴 BLOQUEIA | `⨯ Error: Cookies can only be modified... digest: '1446651374'` |
| 3 | `globalVendorKnowledge.upsert()` falha com `42P10` (partial unique index incompatível com `ON CONFLICT`) | 🟡 RUÍDO | Spamma logs mas independe do Excel — bug conhecido (Sprint p) |

---

## Estado do deploy ANTES da investigação

| Item | Status |
|---|---|
| Branch local | `feature/sprint-5.0.2.3-excel-import-rock-solid` (commit base = main `a72a96a`) |
| HEAD em prod (198.211.103.10) | `a72a96a` (sincronizado após hotfix 5.0.2.2) |
| Cookie name fix (5.0.2.2) | ✅ Confirmado em `grep COOKIE_NAME page.tsx` |
| Backup pré-sprint | ✅ Salvo |

---

## Bug #1 — `/confirm` quebra unique constraint

### Evidência literal (stderr prod, sequência cronológica)

```
prisma:error Unique constraint failed on the fields: (`bankAccountId`,`dedupHash`)
[API ERROR] PrismaClientKnownRequestError
Invalid `prisma.transaction.create()` invocation:
Unique constraint failed on the fields: (`bankAccountId`,`dedupHash`)
```
Repetido **6× em sequência** dentro do mesmo deploy. Logo a seguir aparece um novo
`[EXCEL-UPLOAD]` (planilha 94 linhas, batch `cmpneyzv90001n7kffplk8xt9`) — sinal
de que Yussef tentou de novo após o erro.

### Constraint relevante

**Schema** (`prisma/schema.prisma:272`):
```prisma
model Transaction {
  bankAccountId String?   // nullable — Sprint 4.0.1.a (PAYABLE sem conta definida)
  dedupHash     String?   // nullable — sha256(favorecido+descricao+vencimento+valor)
  ...
  @@unique([bankAccountId, dedupHash])
}
```

**Migration** (`prisma/migrations/20260430000000_dedup_hash/migration.sql`):
```sql
CREATE UNIQUE INDEX "transactions_bankAccountId_dedupHash_key"
  ON "transactions"("bankAccountId", "dedupHash");
```
Sem `NULLS NOT DISTINCT` → PostgreSQL default = NULLS DISTINCT (NULL ≠ NULL).
Em tese, múltiplas PAYABLE com `bankAccountId=NULL` E mesmo dedupHash NÃO deveriam
colidir. **Mas estão colidindo na prática** — provável raiz:

### Causa raiz mais provável

**`/confirm/route.ts` linha 175** chama `prisma.transaction.create()` em loop
**SEM `$transaction`**. Se a tentativa #1 cria 49 transações e a 50ª quebra
(por qualquer razão), as 49 anteriores FICAM no banco (sem rollback). O batch
permanece em status `PENDING_REVIEW`. Quando Yussef tenta confirmar **DE NOVO**:

1. /confirm itera as 94 linhas de novo
2. Cria de novo as transações 1-49
3. Cada Transaction nova entra com `bankAccountId=null` + dedupHash igual ao da rodada anterior
4. **Em algum ponto bate constraint** — possivelmente porque o `dedupHash` da linha tem alguma colisão (planilha pode ter linhas com favorecido+descricao+vencimento+valor idênticos — ex: 2 boletos de aluguel)
5. As anteriores ficaram, mas a 50ª já trazia o mesmo (bankAccountId NULL OR já-criado, dedupHash X) → P2002

**Defeitos arquiteturais que tornam isso possível:**

- **Sem `prisma.$transaction()` envolvendo o loop inteiro** — não há rollback atômico
- **Sem `findFirst` antes do `create`** — não checa se já existe transação com mesmo dedupHash (apesar do `/detect` POPULAR `duplicateOf`, o `/confirm` IGNORA esse campo)
- **Sem `skipDuplicates: true` / `upsert`** — qualquer P2002 derruba o request todo
- **dedupHash usa só 4 campos** (favorecido, descricao, vencimento, valor) — colisões legítimas entre linhas DA MESMA planilha são possíveis (ex: 2 parcelas mensais idênticas)

### Onde corrigir

- `app/api/empresas/[id]/contas-pagar/import/[batchId]/confirm/route.ts:175`
- Envelopar em `prisma.$transaction([])` OU
- Trocar `create` por `upsert` com chave determinística (batchId + rowIndex?) OU
- Try/catch P2002 → skip + incrementar `skipped` + log audit OU
- Mais robusto: incluir `batchId + rowIndex` no dedupHash do StagedPayableRow pra **garantir unicidade dentro do batch**, e validar duplicata via lookup separado (que já é o caminho do `/detect`)

---

## Bug #2 — "Cookies can only be modified in a Server Action or Route Handler"

### Evidência literal (stderr prod)

```
⨯ Error: Cookies can only be modified in a Server Action or Route Handler.
Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options
    at e (.next/server/chunks/ssr/[root-of-the-server]__0aw0t.9._.js:1:1387)
    at async d (.next/server/chunks/ssr/[root-of-the-server]__0x33gei._.js:1:1574) {
  digest: '1446651374'
}
```
Aparece **3+ vezes** seguidas. Esse erro **PARA o RSC render** e dispara a tela
default do Next.js — provavelmente o que Yussef vê como "This page couldn't load".

### Diagnóstico preliminar

`grep -rn "cookies().set\|cookieStore.set\|cookies().delete" app/` → 0 hits.
Não há chamada explícita de `cookies().set()` em RSC. **Hipóteses:**

A) Algum **server-side fetch** dentro de RSC bate em um route handler que
   tenta `response.cookies.set()` — Next 16 considera isso modificação de
   cookie em RSC e bloqueia.

B) Um **middleware bug**: o proxy.ts faz `response.cookies.delete(COOKIE_NAME)`
   em erro de token. Mas middleware roda ANTES do RSC, então o erro vir do
   chunk `ssr/` é estranho.

C) Algum import indireto dispara `next/headers.cookies()` em layout/page e
   tenta setar — mas o grep não pega isso direto.

D) Bug do próprio Next 16.2.4 com Server Components Suspense fallback em
   alguma rota — precisa rastrear o `digest` `1446651374`.

### Onde investigar mais

- `app/(dashboard)/empresas/[id]/contas-pagar/import/page.tsx` — server component
- `app/(dashboard)/empresas/[id]/contas-pagar/import/import-excel-client.tsx`
- Procurar quem faz `fetch()` server-side e bate em route handler com `Set-Cookie`
- Verificar se o digest `1446651374` aparece no source-map do build de prod

**Sem informação do Yussef sobre EM QUAL TELA aparece o erro, fica difícil
chegar à raiz dele.** Pergunta crítica abaixo.

---

## Bug #3 — `globalVendorKnowledge.upsert()` (ruído conhecido)

### Evidência

```
prisma:error Invalid `prisma.globalVendorKnowledge.upsert()` invocation:
Error occurred during query execution:
PostgresError { code: "42P10", message: "there is no unique or exclusion
  constraint matching the ON CONFLICT specification" }
```

### Status

Bug conhecido desde Sprint 5.0.2.p — partial unique index `WHERE cnpj IS NOT NULL`
não casa com `ON CONFLICT (cnpj)` do upsert. **Aparece spammando logs mas NÃO
bloqueia Excel.** Resolução foi adiada pra outro momento. **Recomendo NÃO
mexer nessa Sprint** — fora de escopo.

---

## Estado atual do código — auditoria por arquivo

| Arquivo | Status | Observação |
|---|---|---|
| `app/api/empresas/[id]/contas-pagar/import/upload/route.ts` | ✅ FUNCIONA | Parser OK, validações OK, idempotência via fileHash OK, log `[EXCEL-UPLOAD]` confirmando |
| `lib/excel-import/parse-xlsx.ts` | ✅ FUNCIONA | exceljs robusto, arredondamento 2 casas, filtra totais, 94 linhas + 1 filtrada confirmado |
| `lib/excel-import/detect-columns.ts` | ⚠️ NÃO TESTADO POS-DEPLOY | Heurística retornou 0.80 confidence — não chegou a chamar IA |
| `app/api/empresas/[id]/contas-pagar/import/[batchId]/detect/route.ts` | ⚠️ NÃO TESTADO | Sem log `[EXCEL-DETECT]` em prod — não foi invocado nas últimas tentativas |
| `app/api/empresas/[id]/contas-pagar/import/[batchId]/review/route.ts` | ⚠️ NÃO TESTADO | GET puro, dependente de `/detect` ter rodado |
| `app/api/empresas/[id]/contas-pagar/import/[batchId]/confirm/route.ts` | 🔴 QUEBRADO | Unique constraint violation — Bug #1 |
| `app/(dashboard)/empresas/[id]/contas-pagar/import/page.tsx` | ✅ OK (hotfix 5.0.2.2) | Cookie name correto |
| `app/(dashboard)/empresas/[id]/contas-pagar/import/import-excel-client.tsx` | ⚠️ DEFICIENTE UX | Sem progress bar real, sem retry, sem error boundary, mensagens de erro genéricas via toast |
| `lib/api/handle-error.ts` | ✅ OK | Mas erro 500 vira `{ erro: <mensagem técnica> }` — exposto cru pro usuário |
| `prisma/schema.prisma` (Employee, ExcelImportBatch, StagedPayableRow) | ✅ OK | Models bem desenhados |
| `middleware.ts` / `proxy.ts` | ✅ OK | Auth gate normal |
| `nginx /etc/nginx/sites-enabled/*` | ✅ OK | `client_max_body_size 50M` — 5× margem sobre limit do app |
| `next.config.mjs` | ⚠️ MINIMAL | `nextConfig = {}` — sem `serverActions.bodySizeLimit`, sem nada. Default Next 16 (1MB body limit em Server Actions, MAS route handlers ilimitados) |

---

## Lacunas vs benchmark internacional 2026

Comparativo do que falta vs Ramp/Brex/Mercury/Conta Azul:

| Feature | Atual CAIXAOS | Alvo Sprint 5.0.2.3 |
|---|---|---|
| Upload .xlsx funcional | ✅ funciona | ✅ (manter) |
| **Progress bar real (XHR)** | ❌ usa `fetch()` simples — sem progress | ✅ XMLHttpRequest com `upload.onprogress` |
| **Retry automático em erro de rede** | ❌ falha definitiva | ✅ 1 retry com backoff 2s |
| **Error messages humanos em PT-BR** | ⚠️ `data.erro` cru, "HTTP 500" | ✅ mapa de códigos → mensagens humanas |
| **Magic bytes check** (validar XLSX real) | ❌ só checa extensão `.xlsx?$` | ✅ checar primeiros 4 bytes (`PK\x03\x04` pra XLSX) |
| **Limite explícito 10MB** | ✅ MAX_BYTES no server | ✅ replicar no cliente (rápido feedback) |
| **Limite 5000 linhas** | ✅ MAX_ROWS | ✅ (manter) |
| **Idempotência** | ✅ fileHash unique | ✅ (manter) |
| **Detecção duplicata 90d** | ✅ `/detect` faz | ✅ **FAZER /confirm usar `duplicateOf` pra skip** |
| **Atomic confirm** | ❌ loop sem `$transaction` | ✅ `prisma.$transaction()` ou rollback explícito |
| **Cache cross-import** | ✅ `AiClaudeCache` por headerHash | ✅ (manter) |
| **Auto-cadastro fornecedor/funcionário/categoria** | ✅ no /confirm | ✅ (manter) |
| **Error boundary global na rota /import** | ❌ não existe | ✅ `error.tsx` na rota |
| **Logger central com requestId** | ⚠️ console.log direto | ✅ helper `logger` com requestId pra rastrear |
| **Smoke test em prod com planilha real** | ❌ nunca foi feito | ✅ PROCEDIMENTO REQUERIDO ANTES DE FECHAR |
| **Playwright E2E** | ❌ não existe | ✅ 5 cenários mínimos |

---

## Mapa do fluxo end-to-end e onde cada bug ataca

```
                                          BUG #2: aqui?
                                          (cookies modify in RSC)
                                                 │
  1. /contas-a-pagar — click "Importar Excel" ───┘
       ↓
  2. /empresas/[id]/contas-pagar/import — render page.tsx ✅ (hotfix 5.0.2.2 OK)
       ↓
  3. Cliente seleciona arquivo → POST /upload (FormData) ✅ FUNCIONA EM PROD
       ↓                                  (log [EXCEL-UPLOAD] confirma)
  4. POST /[batchId]/detect ⚠️ NÃO TESTADO últimas rodadas
       ↓
  5. GET /[batchId]/review ⚠️ NÃO TESTADO
       ↓
  6. POST /[batchId]/confirm 🔴 BUG #1 — unique constraint violation
       ↓                       (partial inserts, sem rollback)
  7. Redirect /dashboard?imported=… — NUNCA CHEGA
```

---

## ❓ Perguntas críticas pro Yussef (preciso de resposta antes de codar)

1. **Em QUAL TELA exatamente aparece "This page couldn't load"?**
   - (a) Logo após clicar "Importar Excel" em `/contas-a-pagar` (antes mesmo de selecionar arquivo)?
   - (b) Ao clicar "Enviar planilha" (durante o upload)?
   - (c) Após upload OK, ao clicar "Analisar com IA"?
   - (d) Após análise OK, ao clicar "Confirmar import"?
   - (e) Algum momento aleatório enquanto navega?
   - (Se possível: screenshot do momento + URL na barra de endereço)

2. **A planilha "Contas Pagas Comp. Março 2026 - Unid São Borja.xlsx" pode ser commitada como fixture de teste?** (94 linhas, R$ 182.396,54). Ela é necessária pro E2E Playwright cobrir o cenário REAL. Se sim, eu copio dela do batch staging no banco prod OU você pode anexar.

3. **Confirmar política sobre Bug #3 (globalVendorKnowledge)** — manter fora desta sprint (recomendo) ou incluir aqui?

4. **Aceita que eu inclua hard refresh recomendado** pra browser do Yussef antes do teste final (clear cache + service worker) — Bug "Failed to find Server Action x" às vezes persiste por cache do browser.

---

## Plano de correção proposto (em ordem)

**Aprovação necessária antes de tocar código. Cada passo terá testes próprios.**

### Passo 1 — Fix `/confirm` atomicidade + skip de duplicatas (BUG #1) 🔴
- Envelopar todo o loop em `prisma.$transaction()` (interactive transaction com timeout 30s)
- Antes do `create`, fazer `findFirst({ where: { dedupHash, lifecycle: 'PAYABLE', supplierOrEmployee — escopo da empresa } })` — se existe, skip
- Alternativa simples (recomendada): `try/catch P2002 → skipped++ + log` (mais resiliente que findFirst pré-emptivo)
- Reset do batch em erro: marcar status `FAILED` com `errorMessage`
- Testes: planilha com 2 linhas idênticas legítimas (mesmo favorecido+descricao+vencimento+valor) → 1 cria, 1 skip
- Testes: planilha re-upada após falha parcial → completa o que falta sem duplicar

### Passo 2 — Resolver Bug #2 (cookies in RSC) 🔴
- Reproduzir o erro **com Yussef capturando logs em tempo real** (preciso dele clicando)
- Mapear stack trace + digest source
- Provavelmente é algum server-side fetch em RSC que bate em endpoint com Set-Cookie

### Passo 3 — Frontend robusto (UX rock solid)
- Trocar `fetch()` por `XMLHttpRequest` com `upload.onprogress` → progress bar real
- Retry 1× com backoff 2s em erros de rede (não em 4xx)
- Validação cliente: tamanho, extensão, magic bytes (lê primeiros 4 bytes)
- Mapa código → mensagem humana PT-BR:
  - `FILE_TOO_LARGE` → "Arquivo maior que 10MB. Reduza ou divida em planilhas menores."
  - `INVALID_FILE_TYPE` → "Envie um arquivo Excel (.xlsx ou .xls)."
  - `CORRUPTED_FILE` → "O arquivo parece corrompido. Tente abrir/salvar de novo no Excel."
  - `PARSE_FAILED` → "Não conseguimos ler a planilha. Verifique se não está com senha e tem cabeçalho na linha 1."
  - `EMPTY_FILE` → "A planilha está vazia."
  - `TOO_MANY_ROWS` → "{N} linhas. Limite 5000."
  - `DUPLICATE_CONSTRAINT` → "Algumas linhas já foram importadas antes. Pulamos {N}."
  - genérico 500 → "Algo deu errado no servidor. Tente novamente. Se persistir, copie esse código: {requestId}"

### Passo 4 — Error boundary global
- Criar `app/(dashboard)/empresas/[id]/contas-pagar/import/error.tsx`
- Mensagem amigável + botão "Tentar de novo" + link voltar

### Passo 5 — Backend defensivo
- `export const runtime = 'nodejs'` e `export const maxDuration = 60` em upload/detect/confirm
- Logger central com requestId
- Body magic bytes check no /upload (defesa em profundidade)

### Passo 6 — Testes
- Unit/integration tests cobrindo:
  - confirm com duplicatas legítimas → skip correto
  - confirm com retry após falha → idempotente
  - confirm com batch já confirmado → 409
- Playwright E2E (mín. 5 cenários) — **REQUER `npm install -D @playwright/test`**:
  - upload válido → confirm completo → banner aparece
  - upload >10MB → erro humano
  - upload arquivo .pdf → erro tipo
  - upload mesmo arquivo 2x → idempotência (não cria batch novo)
  - rede instável → retry funciona

### Passo 7 — Deploy + smoke manual com Yussef
- Backup adicional pré-deploy
- `git pull` + `npm run build` + `pm2 restart`
- Yussef faz fluxo real com planilha do Cacula → captura 7 screenshots
- Validar 14 métricas do critério de aceite (ver spec do Yussef)

### Passo 8 — Protocolo permanente no CLAUDE.md
- Seção "Definição de Pronto (DoD)" com critério obrigatório de teste E2E + smoke prod

---

## ⏳ Estimativa de tempo realista

| Fase | Tempo |
|---|---|
| Investigação adicional (Bug #2 reprodução) | 20-30min |
| Passo 1 — Confirm atomic + skip dup | 1h |
| Passo 2 — Bug #2 cookies in RSC | 30-60min (depende do diagnóstico) |
| Passo 3-4 — Frontend robusto + error boundary | 1h |
| Passo 5 — Backend defensivo | 30min |
| Passo 6 — Testes (unit + Playwright setup + 5 cenários) | 1.5h |
| Passo 7 — Deploy + smoke prod | 30min |
| Passo 8 — Docs protocolo | 15min |
| **Total** | **~5-6h** |

(Spec do Yussef estimou 3-4h — sou mais cauteloso por causa de Playwright setup do zero + necessidade de reproduzir Bug #2 com info dele.)

---

## 🛑 Limitações técnicas que preciso declarar honestamente

1. **Não tenho browser interativo neste ambiente**. Playwright roda **headless**
   e gera screenshots PNG automaticamente em `tests/e2e/screenshots/` — esses
   PODEM ser commitados/visualizados. Mas eu **não consigo "ver" um navegador
   abrindo na sua tela** — só posso confirmar comportamento via assertions e
   PNGs gerados.

2. **Smoke test em produção** depende de **você fazer o click final** e me
   reportar (ou eu uso curl autenticado se você compartilhar um cookie de
   sessão de teste).

3. **Fixture da planilha**: preciso que você anexe a planilha real do Cacula
   OU me autorize a extrair do batch staging no DB de prod (já está lá no
   `cmpneyzv90001n7kffplk8xt9`, mas os dados brutos foram parseados —
   reconstruir XLSX seria aproximação, não fiel).

4. **Bug #2 (cookies)** vai precisar de você reproduzir com `pm2 logs` rodando
   em tempo real, OU eu pesquiso mais nos chunks do build pra localizar o
   trecho `digest: '1446651374'`.

---

## 🚦 Próxima ação

**AGUARDO sua aprovação dos passos acima + respostas das 4 perguntas críticas.**

Especificamente:
- (a) Aprova plano de 8 passos?
- (b) Qual tela mostra "This page couldn't load"?
- (c) Pode anexar a planilha ou autorizar uso do batch staging?
- (d) Política sobre Bug #3?
- (e) Aceita hard refresh recomendado?

Não codo NADA antes da sua resposta.
