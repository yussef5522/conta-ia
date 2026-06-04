# Conciliação Bancária — Matching + Mockup nível líder

**Data:** 03/06/2026
**Tipo:** Investigação + Proposta (sem código ainda)
**Origem:** Bug crítico Cacula Mix — Nestle 03/06 R$ 105,86 aparece em AP (Excel pago) E no OFX, "Candidatos a Conciliação" vazio, DRE conta as duas.

---

## 🎯 Resumo executivo (3 linhas)

1. **TEM duplicação no DRE.** Cacula Mix mostra R$ 91.700,56 em despesas hoje; **R$ 30.565,65 confirmados como duplicação** (24 contas Excel pagas + 15 OFX pareados no mesmo valor ±5d). DRE real ≈ R$ 61.135 — **inflado ~50%**.
2. **Match está vazio porque o filtro procura `lifecycle=PAYABLE`, mas todas as contas Excel da Cacula viraram `lifecycle=EFFECTED`** no hotfix Bug-Fix Lifecycle (28/05/2026) + Excel já entrou marcando como paga. Simulando o relaxamento do filtro, a tela mostraria **7 candidatos pra Nestle (incluindo o pareamento exato)**.
3. **Proposta:** repensar conciliação como "fila de duplicatas detectadas" (nível Botkeeper) com 3 abas de confiança + bulk approve + IA de match de nome + desdup safe da Cacula Mix com backup + dry-run + commit em transação.

---

## 0. Contexto + arquitetura atual

### 0.1 Estado em prod (03/06/2026)
- Conta IA roda `lifecycle` em vez de tabela separada de Payable/Receivable. **Toda obrigação financeira é uma `Transaction` com `lifecycle ∈ {EFFECTED, PAYABLE, RECEIVABLE}`**.
- Match algorithm (`lib/conciliacao/match.ts`): score 0-100 = valor 50pts + data 30pts + supplier 15pts + descrição (Jaro-Winkler) 10pts.
- Match query (`lib/conciliacao/find-candidates.ts`): filtra `lifecycle=PAYABLE`, `status=PENDING`, `reconciledWithId=NULL`, `dueDate ±15d`, `amount ±20%`.
- DRE filter (`app/api/empresas/[id]/dre/route.ts`): `lifecycle=EFFECTED AND reconciledWithId IS NULL` (defesa anti-dupla-contagem). **Funciona apenas se o link existir.**
- Boost semântico Claude Haiku na faixa de score 50-69 (cache 24h).
- Tela atual: `/conciliacao` 2 colunas — esquerda lista OFX, direita "Candidatos" (vazio = `Nenhuma conta pendente compatível`).

### 0.2 Histórico relevante
- **27-28/05/2026 — Bug-Fix Lifecycle PAYABLE+paymentDate**: 492 contas PAYABLE com paymentDate populado viraram EFFECTED (incluindo 94 da Cacula Mix). O critério de backfill foi `reconciledWithId IS NULL → marcar EFFECTED` (decisão correta na época pra DRE não esquecer essas despesas).
- Mesma sprint corrigiu o import Excel pra distinguir `isPaid ? EFFECTED : PAYABLE`. Hoje contas Excel já chegam com lifecycle correto.
- **Consequência inesperada (agora):** depois do backfill + fix do import, contas Excel pagas viram EFFECTED imediatamente. Quando o extrato OFX chega depois, o matcher procura PAYABLE → não encontra nada → DRE conta as 2.

---

## PARTE A — Investigação (read-only, dados reais)

### A.1 Duplicação no DRE — CONFIRMADA

Query `transactions` da Cacula Mix (`cmpr68ra50003cemtku0xu36m`) por origin + lifecycle + status:

| origin | lifecycle | status | qtd | total R$ | debits | total debits R$ | **com link** |
|---|---|---|---|---|---|---|---|
| IMPORT_EXCEL | EFFECTED | RECONCILED | 67 | 40.591,11 | 67 | 40.591,11 | **1** |
| IMPORT_EXCEL | PAYABLE | RECONCILED | 20 | 6.300,52 | 20 | 6.300,52 | 0 |
| MANUAL | EFFECTED | RECONCILED | 6 | 60.400,00 | 0 | — | 0 |
| OFX | EFFECTED | PENDING | 11 | 6.652,11 | 11 | 6.652,11 | 0 |
| OFX | EFFECTED | RECONCILED | **247** | 94.102,40 | 35 | **44.876,64** | 0 |

**Achados:**
- **Apenas 1 das 67 Excel EFFECTED tem `reconciledWithId` preenchido.** Todas as outras 66 não apontam pro OFX.
- **20 Excel PAYABLE com status=RECONCILED** — estado inconsistente (status diz "conciliada", lifecycle diz "ainda a pagar", reconciledWithId é null). Algum fluxo legado setou status sem mudar lifecycle nem criar o link.
- 247 OFX RECONCILED status mas 0 com link real. Mesma anomalia em escala.

**Pareamento Excel ↔ OFX por valor exato + janela ±5d:**

```
excel_com_par_ofx  | excel_valor_duplicado | ofx_pareados
        24         |        30.565,65       |     15
```

24 contas Excel batem com 15 OFX (alguns OFX cobrem múltiplas Excel — PIX consolidado).

**DRE atual:**
```sql
SELECT SUM(amount) FROM transactions
WHERE type='DEBIT' AND lifecycle='EFFECTED'
  AND "reconciledWithId" IS NULL AND "isInternalTransfer"=false
  AND <empresa = Cacula Mix>
→ R$ 91.700,56
```

**DRE real estimado:** R$ 91.700,56 − R$ 30.565,65 = **R$ 61.134,91**.

**Inflação ≈ +50%** (DRE atual mostra 1.5× o real). Não é 2× como o Yussef temia, mas é grave o suficiente pra gerar imposto a mais e tomada de decisão errada. E os R$ 30k é o mínimo — janela ±5d/valor exato é conservadora; com tolerância maior, número sobe.

### A.2 Por que o matcher devolve "Candidatos vazios" — CONFIRMADA causa raiz

**Caso Nestle (03/06/2026, R$ 105,86, DEBIT):**

| origem | lifecycle | status | amount | date | dueDate | paymentDate | reconciledWithId |
|---|---|---|---|---|---|---|---|
| IMPORT_EXCEL | **EFFECTED** | RECONCILED | 105.86 | 03/06 | 03/06 | 03/06 | **NULL** |
| OFX | **EFFECTED** | RECONCILED | 105.86 | 03/06 | — | — | **NULL** |

**Simulação do matcher pra essa OFX:**

```sql
-- Matcher atual (find-candidates.ts):
WHERE lifecycle = 'PAYABLE' AND status = 'PENDING'
  AND "reconciledWithId" IS NULL
  AND dueDate BETWEEN <data-15> AND <data+15>
  AND amount BETWEEN <valor*0.8> AND <valor*1.2>
→ 0 candidatos

-- Mesma janela mas relaxando lifecycle:
WHERE origin IN ('IMPORT_EXCEL', 'MANUAL')
  AND "reconciledWithId" IS NULL
  AND COALESCE(dueDate, date) BETWEEN <data-15> AND <data+15>
  AND amount BETWEEN <valor*0.8> AND <valor*1.2>
→ 7 candidatos (Nestle exata + 6 vizinhas)
```

**Causa raiz:** o filtro `lifecycle=PAYABLE` é restritivo demais pra realidade hoje:
- Hotfix 28/05 marcou 94 Excel da Cacula como EFFECTED (sem link).
- Import Excel atual marca como EFFECTED quando vem com isPaid (correto contabilmente).
- O matcher nunca foi atualizado pra essa nova realidade.

**Bug paralelo:** `status=RECONCILED` quando `reconciledWithId IS NULL` é um estado impossível pelo modelo correto. Algum fluxo (provavelmente o `mark_paid` bulk ou um import legado) setou status sem fazer o link. Vale mapear e corrigir junto.

### A.3 Outros achados que justificam Sprint dedicada

1. **Pipeline OFX não tenta matchar contra AP existente no preview** (`/api/contas-bancarias/[id]/importar-ofx`). Só calcula dedupHash contra outras OFX. **Conciliação roda só pós-import.** Oportunidade: detecção preditiva no preview já mostraria "12 dessas tx batem com contas a pagar" antes do import.
2. **Match descrição usa Jaro-Winkler simples (10pts max).** "Nestle Brasil Ltda" vs "NESTLE BRASIL LTDA - Pagamento" deveria dar 1.0 após normalização (lowercase + strip "- Pagamento"). Hoje provavelmente dá ~0.7-0.8 e fica abaixo do threshold de 10pts.
3. **Claude boost só roda na faixa 50-69** — não roda quando o filtro inicial já zerou candidatos (caso atual). Filtro precisa relaxar antes do boost fazer diferença.

---

## PARTE B — Benchmark (Conta Azul + Botkeeper + QuickBooks + ReconcileIQ)

### B.1 Conta Azul (líder BR)
- Layout 2 colunas (banco esquerda × Conta Azul direita), aba "Conciliações pendentes" dentro de "Contas financeiras".
- Match: tolerância **±5 dias data + ±7% valor + favorecido**. Bem mais permissivo que QB.
- **Não tem bulk reconciliation** — 1 click por linha.
- Limita 25 tx/página com "ver mais". Pra Yussef com 13 academias = impraticável.
- Fraquezas (Reclame Aqui): PIX não concilia com boleto Receba Fácil (gateway próprio); caso de vazamento de extrato entre CNPJs; usuários sem conciliação Itaú desde 2019.

### B.2 QuickBooks (líder global)
- Auto-match com "1 record found" verde.
- Tolerância 90 dias antes / 20 depois (folga real do banco).
- **Sem bulk reconciliation** — gap que abriu mercado pra ferramentas terceirizadas.

### B.3 Botkeeper Transaction Manager (modelo de UX a copiar)
- **3 níveis visíveis por confiança:**
  - ≥98% → aba "Processadas" (auto-aprovado)
  - 90-97,9% → aba "Precisa de Revisão" (categorizado, aguarda OK)
  - <90% → "Precisa de Revisão" (humano valida)
- Ícone distintivo por nível, label do método de match ("valor+data" / "regra aprendida" / "Claude").
- **"Mark Reviewed"** em lote com banner verde de confirmação.
- Sistema aprende com confirmações/correções (alinha com nosso `ai_learning_rules`).

### B.4 ReconcileIQ (especialista bulk pra QB)
- Upload extrato → motor processa 200-500 tx em ~2min.
- **"Approve high-confidence batch"** como CTA primário (1 click = N conciliações).
- Exceções ficam na fila pro humano.

### B.5 O que dá pra "roubar"
| Ideia | De onde | Por quê |
|---|---|---|
| 3 abas por confiança | Botkeeper | Yussef bate olho, vê quanto precisa atenção |
| Bulk "Aprovar lote alta-confiança" | ReconcileIQ | Oposto da fricção Conta Azul |
| Label do método de match | Botkeeper | Transparência builda trust |
| Tolerância configurável por conta | (nova) | Cheque especial precisa range diferente |
| Many-to-one (PIX consolidado) | Conta Azul + QB | Caso real Cacula (R$ 105 OFX = 3 contas a pagar) |
| Undo de exclusão | QB | Yussef vai apagar errado |

### B.6 Diferenciais óbvios que ninguém faz
- **Conciliação preditiva pré-extrato**: como já temos pipeline F3/F4 categorizando OFX com regras aprendidas + CNPJ + Claude no momento do import, a tela de conciliação pode mostrar **"13 conciliações prontas + 2 pra revisar"** já no preview. Quando OFX termina de importar, 80% do trabalho já tá feito.
- **Normalização agressiva de nomes via IA**: pré-processar "NESTLE BRASIL LTDA - Pagamento" → "nestle brasil ltda" antes do Jaro-Winkler. Claude já tem prompt PF treinado pra isso (`lib/ai-categorizer/normalize.ts`).
- **Detecção de duplicatas SEM conciliar**: mostrar "Você tem 24 prováveis duplicatas nesse mês — quer revisar?" como alerta no Dashboard mesmo antes de abrir conciliação.

---

## PARTE C — Mockup proposta

### C.1 Princípios
1. **A conciliação não é uma tarefa do mês — é um side-effect do import.** OFX entra → motor já matcha → user só revisa exceções.
2. **Mostrar quanto está em risco em R$**, não em qtd. "R$ 30.565 em prováveis duplicatas" é uma frase que dói.
3. **Bulk approve como CTA primário.** Se IA tá com ≥90% de certeza, user clica 1 vez.
4. **Toda ação reversível.** Undo no UI + audit log no DB.

### C.2 Tela `/empresas/[id]/conciliacao` redesenhada

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Conciliação · CACULA MIX                            [Trocar empresa ▾]   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  💰 Banrisul PJ · maio/2026  [▾]   Período: 01/05 — 31/05 [▾]            │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ ⚠️  R$ 30.565,65 em duplicatas detectadas (24 contas)             │  │
│  │     ⤷ Despesas no DRE estão infladas em ~50%                       │  │
│  │     [Ver detalhes]  [Iniciar conciliação em massa →]               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──[Alta confiança (24)]──[Revisar (8)]──[Sem match (3)]──[✓ Já con.]┐  │
│  │                                                                    │  │
│  │  ☐  03/06  NESTLE BRASIL LTDA - Pagamento   R$ 105,86  [DEBIT]    │  │
│  │     ↳ Match com: Nestle Brasil Ltda (AP Excel 03/06)              │  │
│  │       Score 98 · Método: valor+data exatos, nome normalizado IA   │  │
│  │     [Conciliar]  [Trocar candidato ▾]  [Pular]                    │  │
│  │  ─────────────────────────────────────────────────────────         │  │
│  │  ☐  02/06  AMBEV - Pagamento                R$ 1.245,00  [DEBIT]  │  │
│  │     ↳ Match com: AMBEV S.A. (AP Excel 31/05)                      │  │
│  │       Score 94 · Método: valor+data exatos, supplier por CNPJ     │  │
│  │     [Conciliar]  [Trocar candidato ▾]  [Pular]                    │  │
│  │  ─────────────────────────────────────────────────────────         │  │
│  │  ☐  01/06  PIX 25.000,00 consolidado        R$ 25.000,00 [DEBIT]  │  │
│  │     ↳ Match many-to-one com 3 AP (Nestle + Ambev + Coca)          │  │
│  │       R$ 105,86 + 1.245 + 23.649,14 = R$ 25.000,00 ✓              │  │
│  │       Score 92 · Método: soma exata                                │  │
│  │     [Conciliar lote]  [Editar split ▾]  [Pular]                   │  │
│  │  ─────────────────────────────────────────────────────────         │  │
│  │  [☑] Selecionar todas as 24 alta-confiança                        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  [Aprovar 24 selecionadas] (azul/CTA primário)                     │  │
│  │  Tolerância de data: [±5 dias ▾]   Mostrar IA boost: [☑]           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### C.3 Aba "Revisar" (faixa 70-89)

Mesma estrutura, mas:
- Score visível em pill amarela
- Múltiplos candidatos listados (top 3) com radio
- "Por que esses?" expand mostra breakdown do score
- Sem checkbox de bulk approve (precisa de decisão humana caso a caso)

### C.4 Aba "Sem match" (<70)

- OFX sem candidato bom
- 2 CTAs: "Criar nova AP" (vira PAYABLE manualmente) ou "Ignorar (não é despesa)"
- Sugestões da IA: "Esse padrão parece com [categoria sugerida]"

### C.5 Aba "Já conciliado"

- Histórico paginado com check verde
- Filtro por data + busca por descrição
- Cada linha: "X reconciliada com Y · há 3 dias · [Desfazer]"
- Undo abre confirm modal: "Isso vai desconciliar e ambos voltam pra fila. Tem certeza?"

### C.6 Stats no header (cards)
- Total despesas mês: R$ X
- **Provavelmente duplicado: R$ Y (% inflação)**
- Conciliadas mês: N de M (%)
- Tempo médio pra conciliar: X min (mostra ROI da automação)

### C.7 Filtros (linha superior)
- Conta bancária (dropdown)
- Período (default: mês corrente)
- Busca por descrição
- Range de valor
- Fornecedor
- Status (Pendente / Conciliada / Ignorada)
- Toggle "Mostrar só prováveis duplicatas"

---

## PARTE D — Desduplicação Cacula Mix com segurança

**Premissa:** os dados reais do Yussef estão em risco. Toda ação precisa ser idempotente, ter dry-run, backup ANTES, e rodar dentro de `prisma.$transaction`.

### D.1 Critério "duplicação confirmada"
**SQL match exato** (não fuzzy):
- `value EXACT match` (sem ±%)
- `data ABS(diff) ≤ 5 dias`
- mesma empresa
- AP origin IN ('IMPORT_EXCEL', 'MANUAL')
- OFX origin = 'OFX', type = DEBIT
- ambos `reconciledWithId IS NULL`

### D.2 Estratégia em 4 fases

**Fase 1 — Backup + DRY RUN (read-only):**
```bash
sudo -u postgres pg_dump -Fc conta_ia_prod \
  > /var/backups/conta-ia/pre-desdup-cacula-$(date +%Y%m%d_%H%M%S).dump
```
+ script `scripts/dedupe-cacula-dry-run.ts` que lista TODOS os pares candidatos com:
- ID Excel + ID OFX
- Data Excel (paymentDate ou date)
- Data OFX
- Valor
- Descrição Excel
- Descrição OFX
- Score de confiança (mesmo algoritmo do matcher proposto)

Output: JSON pra Yussef revisar item a item. Aprovação humana ANTES de qualquer mutação.

**Fase 2 — Aprovação assistida:**
- Yussef revisa os 24 pares no Mac (ou direto na nova UI Conciliação se já estiver no ar)
- Pode excluir pares duvidosos
- Aprova lista final em CSV

**Fase 3 — Execução atomic:**
```sql
BEGIN;

-- Para cada par aprovado:
UPDATE transactions
SET "reconciledWithId" = '<OFX_ID>',
    status = 'RECONCILED'
WHERE id = '<EXCEL_ID>' AND "reconciledWithId" IS NULL;

-- Audit log
INSERT INTO audit_logs (action, entityType, entityId, metadata, ...)
VALUES ('DEDUP_BACKFILL', 'Transaction', '<EXCEL_ID>',
        '{"linkedTo": "<OFX_ID>", "amount": 105.86, ...}', ...);

COMMIT;
```

**Fase 4 — Validação pós:**
- DRE Cacula Mix antes vs depois
- Esperado: queda de ~R$ 30k em despesas EFFECTED
- Smoke do matcher na próxima conciliação (não deve mais sugerir esses pares)

### D.3 Casos limítrofes a tratar
- **OFX com 1 valor = soma de N Excel** (PIX consolidado): não é duplicação, é split. Não tocar (precisa do feature many-to-one da nova tela).
- **Excel pago mas OFX ainda não importado**: deixar como está. Vira candidato natural quando OFX chegar.
- **Valor idêntico mas fornecedor diferente** (ex: 2 NF de R$ 105 no mesmo dia, fornecedores distintos): aparece no dry-run, Yussef decide.
- **20 Excel PAYABLE com status=RECONCILED + reconciledWithId=NULL**: estado inconsistente legado. **Não tocar como parte da desdup** — limpeza separada (atualizar lifecycle → EFFECTED se paymentDate set, ou voltar status → PENDING se sem link).

---

## PARTE E — Decisões pendentes (Yussef aprova antes de implementar)

### E.1 Match algorithm
1. **Relaxar filtro de `lifecycle`**: aceitar `PAYABLE` + `EFFECTED com reconciledWithId=NULL` como universo de candidatos. **Recomendado.** Resolve causa raiz da Cacula.
2. **Normalização de descrição via IA antes do Jaro-Winkler**: pré-processar com helper já existente do PF (`lib/ai-categorizer/normalize.ts`). Custo: O(1) por candidato, cache 24h.
3. **Tolerância de data configurável**: default 5d na UI, salvo em `bank_accounts.reconcileToleranceDays`. Padrão Conta Azul mas flexível.

### E.2 UX nova tela
1. **3 abas confidence** (≥90 / 70-89 / <70 + "Já conciliado")
2. **Bulk approve no topo** ("Conciliar 24 alta-confiança")
3. **Many-to-one** (soma de N AP = 1 OFX)
4. **Detecção preditiva no preview do import**: mostrar "12 dessas tx batem com AP existente" antes mesmo de importar
5. **Banner de duplicação no Dashboard** (header global): "⚠️ R$ X em prováveis duplicatas detectadas"

### E.3 Schema (mexer ou não?)
- **Sem migration nova proposta.** O schema atual suporta tudo:
  - `reconciledWithId UNIQUE` já existe
  - `lifecycle` + `status` já cobrem os estados
  - `bank_accounts` pode receber `reconcileToleranceDays Int?` em ALTER aditivo se quisermos UI configurável
- **Backfill de status RECONCILED-órfão**: separado, criterioso, NÃO obrigatório pra essa sprint

### E.4 Ordem de execução sugerida
1. **Hotfix matcher (Sprint A, 1 dia):** relaxar filtro lifecycle + adicionar normalização de nome. **Resolve "candidatos vazios" pra Yussef já amanhã**, sem mexer em UI.
2. **Desduplicação Cacula Mix (Sprint B, 1 dia):** script dry-run + execução atomic. DRE volta ao real.
3. **Bulk + 3 abas + many-to-one (Sprint C, 3-4 dias):** UI nova, reusa engine existente.
4. **Detecção preditiva no import (Sprint D, 1-2 dias):** integrar match no preview OFX. Diferencial vs Conta Azul.

---

## PARTE F — Esforço estimado

| Sprint | Escopo | Migration? | Esforço |
|---|---|---|---|
| A — Hotfix matcher | Relaxar filtro + normalização IA + boost descrição | Não | 1 dia |
| B — Desdup Cacula Mix | Backup + dry-run + script atomic + validação | Não | 1 dia |
| C — UI Conciliação 2.0 | 3 abas + bulk + many-to-one + filtros + histórico undo | Opcional (`reconcileToleranceDays`) | 3-4 dias |
| D — Match preditivo no import | Integrar matcher no preview OFX + banner duplicação no Dashboard | Não | 1-2 dias |
| **TOTAL** | | | **6-8 dias** |

---

## Apêndice — Queries SQL usadas na investigação

(Todas read-only, executadas em prod 03/06/2026 contra `conta_ia_prod`.)

### Q1 — Universo Cacula Mix por origin/lifecycle/status
```sql
WITH company_txs AS (
  SELECT t.* FROM transactions t
  WHERE t."bankAccountId" IN (SELECT id FROM bank_accounts WHERE "companyId" = 'cmpr68ra50003cemtku0xu36m')
     OR t."supplierId" IN (SELECT id FROM suppliers WHERE "companyId" = 'cmpr68ra50003cemtku0xu36m')
     OR t."categoryId" IN (SELECT id FROM categories WHERE "companyId" = 'cmpr68ra50003cemtku0xu36m')
)
SELECT origin, lifecycle, status, COUNT(*) AS qtd,
       ROUND(SUM(amount)::numeric, 2) AS total,
       COUNT(*) FILTER (WHERE "reconciledWithId" IS NOT NULL) AS com_link
FROM company_txs GROUP BY origin, lifecycle, status ORDER BY origin, lifecycle, status;
```

### Q2 — Caso Nestle (4 linhas em 2 Caculas)
```sql
SELECT name, cnpj, lifecycle, origin, amount, date::date AS d,
       "dueDate"::date AS due, "paymentDate"::date AS pay,
       status, "reconciledWithId" IS NOT NULL AS conciliada,
       LEFT(description, 50) AS descr
FROM <company_txs CTE>
WHERE description ILIKE '%nestle%' OR description ILIKE '%nestlé%'
ORDER BY name, date;
```

### Q3 — Pareamento Excel ↔ OFX (valor exato + ±5d)
```sql
WITH cacula_excel AS (...), cacula_ofx AS (...)
SELECT COUNT(DISTINCT e.id) AS excel_com_par,
       ROUND(SUM(e.amount)::numeric, 2) AS valor_duplicado,
       COUNT(DISTINCT o.id) AS ofx_pareados
FROM cacula_excel e
JOIN cacula_ofx o ON o.amount = e.amount AND ABS(o.d - COALESCE(e.pay, e.d)) <= 5;
→ 24 pares · R$ 30.565,65
```

### Q4 — Simulação do matcher (atual vs relaxado) pra Nestle
```sql
-- Atual:
SELECT COUNT(*) FROM transactions
WHERE lifecycle='PAYABLE' AND status='PENDING' AND "reconciledWithId" IS NULL
  AND "dueDate" BETWEEN '2026-05-19' AND '2026-06-18'
  AND amount BETWEEN 84.69 AND 127.03
  AND <da empresa>;
→ 0 candidatos

-- Relaxado:
SELECT COUNT(*) FROM transactions
WHERE origin IN ('IMPORT_EXCEL','MANUAL') AND "reconciledWithId" IS NULL
  AND COALESCE("dueDate", date) BETWEEN '2026-05-19' AND '2026-06-18'
  AND amount BETWEEN 84.69 AND 127.03
  AND <da empresa>;
→ 7 candidatos (incluindo Nestle exata)
```

---

## ⚠️ Aviso de segurança

Quando essa sprint for executada (em qualquer fase):
1. **Backup `pg_dump -Fc` ANTES de qualquer ALTER ou UPDATE em massa** (regra CLAUDE.md "Migrations em tabelas com dados reais").
2. **Sprint A é matcher-only — não muda dado.** Pode subir sem ritual.
3. **Sprint B (desdup) muda dado real (24 linhas Excel ganham reconciledWithId)** — aviso obrigatório no plano + dry-run com aprovação manual.
4. **Sprint C/D mexem em UI/lógica de match, não em dados** — sem ritual extra.

**Nenhuma das fases requer apagar transação real.** A desdup mantém ambas as linhas vivas, apenas cria o link `Excel.reconciledWithId = OFX.id` (mesmo padrão do reconcile manual atual). Reversível via `UPDATE ... SET "reconciledWithId" = NULL`.

---

**Próximo passo:** Yussef revisa este doc + decide:
1. Mantém ordem proposta (A → B → C → D)?
2. Quer ajuste no mockup (mover/remover algo)?
3. Aprovar bulk approve como CTA primário (decisão de produto importante)?
4. Tolerância default no UI: ±5d (Conta Azul) ou ±15d (matcher atual)?
