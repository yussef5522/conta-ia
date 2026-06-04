# Conciliação com Ajuste — Juros, Multas, Tarifas, Descontos

**Data:** 04/06/2026
**Tipo:** Proposta (SEM código — espera aprovação)
**Origem:** Yussef trouxe caso real comum: boleto R$ 5.000 pago atrasado → sai R$ 5.070 (juros), conta atual não concilia porque valores não batem.
**Modelo:** Xero **Adjustments** (Bank fee + Minor adjustment) literal, adaptado pro BR.
**Documento irmão:** `docs/sprints/conciliacao-modelo-xero.md` (B.1/B.2/B.3 — Find & Match já existe).

---

## 🎯 Resumo executivo

**O problema:** boleto R$ 5.000 com juros R$ 70 → banco debita R$ 5.070. Hoje:
- Match auto não pega (valor difere)
- Find & Match acha a conta mas Diff = R$ 70 → Reconcile bloqueado
- Yussef "desiste" e marca IGNORAR ou força CRIAR uma despesa errada → DRE polui

**A solução (Xero literal):** botão **Adjustments** dentro do Find & Match com 2 modos:
- **Add bank fee** — pra diferenças que são juros/multas/tarifa (categoriza como despesa financeira)
- **Add minor adjustment** — pra arredondamento de centavos (categoria de rounding)

Adicionado o ajuste, a soma vira `invoice + ajuste = banco`, bate exato, Reconcile habilita.

**Diferencial BR:** acrescenta sentido inverso — quando banco < AP (paga adiantado com desconto), o ajuste vira **receita** ("Desconto Obtido"). Xero não cobre bem; nós cobrimos.

---

## 1. O caso real do Yussef (e da maioria das PMEs BR)

### 1.1 Caso 1 — Boleto pago atrasado (mais comum)
```
Conta a pagar:    Fornecedor X — R$ 5.000,00  (vence 01/06)
Pagamento real:   Banco debita  R$ 5.070,00  (paga 05/06 com +4d atraso)
Composição:       R$ 5.000 fornecedor + R$ 70 juros e multas
```
Hoje: não concilia. Yussef pode:
- IGNORAR o OFX e o AP fica eterno PAYABLE → DRE não realiza
- Forçar Match auto e bagunça (gerou erro 422 quando o valor diferia mais de R$ 0,01)
- Categorizar via CRIAR como "Despesa avulsa R$ 5.070" → AP eterno PAYABLE

### 1.2 Caso 2 — Boleto pago adiantado com desconto
```
Conta a pagar:    Fornecedor Y — R$ 1.000,00  (vence 20/06)
Pagamento real:   Banco debita  R$    980,00  (paga 10/06 com desconto)
Composição:       R$ 1.000 fornecedor − R$ 20 desconto obtido (receita)
```

### 1.3 Caso 3 — Tarifa do banco
```
Conta a pagar:    Pagamento PIX — R$ 100,00
Pagamento real:   Banco debita  R$ 100,15  (tarifa PIX R$ 0,15)
Composição:       R$ 100,00 + R$ 0,15 tarifa bancária
```

### 1.4 Caso 4 — Arredondamento de centavos
```
Conta a pagar:    Energia      R$ 247,89
Pagamento real:   Banco debita R$ 247,90  (arredondamento)
Composição:       R$ 0,01 minor adjustment
```

---

## 2. Como o Xero faz (resumo da pesquisa)

| Recurso | Comportamento |
|---|---|
| **Onde aparece** | Dentro da aba **Find & Match** (NÃO no Match/Create/Transfer/Discuss) |
| **Visibilidade** | Botão "Adjustments" no rodapé do painel (sempre visível, fica útil quando há diff) |
| **Opções** | Exatas 2: `Add bank fee` + `Add minor adjustment` |
| **Bank fee form** | Inline (não modal): Description + Account (dropdown plano) + Amount |
| **Account default** | User escolhe (Xero NÃO pré-seleciona — sugere "Bank Fees" do plano default) |
| **Amount pre-fill** | Não documentado claramente (provavelmente NÃO é automático) |
| **Sinal** | Bank fee só pra **DESPESA** (banco > invoice). Pra banco < invoice (desconto) Xero não cobre bem — usuário força via Create separado |
| **Minor adjustment** | Posta na conta "Rounding" do sistema (acumula no balanço — comunidade reclama) |
| **Pós-ajuste** | Tabela mostra invoices + ajuste somando; soma == banco → Reconcile ativa |
| **N:1 + Adjustment** | Funciona junto (7 invoices + 1 adjustment = banco) |
| **Undo** | Não documentado claramente se o adjustment é deletado junto |
| **Limite "minor"** | Sem limite hard-coded (julgamento do user) |

**3 coisas que vamos MELHORAR vs Xero:**
1. **Cobrir banco < AP (desconto)** — vira receita financeira, simétrico ao bank fee
2. **Pre-fill automático** do amount com a diferença detectada
3. **Undo deleta o ajuste junto** (não vira tx órfã pra limpar manual)

---

## 3. Mockup detalhado — Find & Match com Adjustments

### 3.1 Estado inicial (selecionou AP, mas Diff ≠ 0)

```
┌─ STATEMENT LINE (esq) ─────────────────────────────────────────────┐
│ 05/06  FORNECEDOR X - Pagamento     R$ 5.070,00 DEBIT              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  FIND & MATCH                                                      │
│                                                                    │
│  Statement line: R$ 5.070,00  ·  Selected: R$ 5.000,00             │
│  Diff: R$ 70,00  (banco pagou R$ 70 a MAIS)                        │
│                                                                    │
│  🔍 [Fornecedor X____________________________]                     │
│                                                                    │
│  ┌────┬──────────┬─────────────┬──────────────────┬──────────────┐ │
│  │ ☑  │ 01/06    │ NF-2024     │ Fornecedor X     │ R$ 5.000,00  │ │
│  │ ☐  │ 28/05    │ NF-2018     │ Fornecedor X     │ R$ 1.200,00  │ │
│  └────┴──────────┴─────────────┴──────────────────┴──────────────┘ │
│                                                                    │
│  [Cancelar]   [+ Adjustments ▾]      [Reconcile (disabled)]        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Pontos:**
- Botão **"+ Adjustments ▾"** aparece sempre no rodapé entre Cancelar e Reconcile
- Diff em AMARELO quando ≠ 0, em VERDE quando = 0
- Reconcile fica **disabled** até a soma bater

### 3.2 Click no "+ Adjustments ▾" — dropdown

```
                  ┌─────────────────────────────────────┐
                  │ + Juros e Multas Bancárias          │
                  │   (banco pagou R$ 70 a mais → juros)│
                  ├─────────────────────────────────────┤
                  │ + Tarifa Bancária                    │
                  │   (R$ 70 de tarifa explícita)        │
                  ├─────────────────────────────────────┤
                  │ + Desconto Obtido (receita)          │
                  │   ⚠️ só quando banco < AP            │
                  ├─────────────────────────────────────┤
                  │ + Ajuste de Arredondamento           │
                  │   (R$ 70 ≫ rounding típico)          │
                  ├─────────────────────────────────────┤
                  │ + Outro ajuste (escolher categoria)  │
                  └─────────────────────────────────────┘
```

**Lógica do dropdown adaptativa:**
- Quando `Diff > 0` (banco pagou mais): habilita **Juros/Multas**, **Tarifa**, **Outro**. Esconde **Desconto Obtido**.
- Quando `Diff < 0` (banco pagou menos): habilita **Desconto Obtido**, **Outro**. Esconde Juros/Tarifa.
- **Ajuste de Arredondamento**: só visível se `|Diff| ≤ R$ 1,00` (threshold configurável).

### 3.3 Click em "Juros e Multas Bancárias" — formulário inline

```
┌─ STATEMENT LINE (esq) ─────────────────────────────────────────────┐
│ 05/06  FORNECEDOR X - Pagamento     R$ 5.070,00 DEBIT              │
├────────────────────────────────────────────────────────────────────┤
│  FIND & MATCH                                                      │
│  Statement line: R$ 5.070,00  ·  Selected: R$ 5.070,00 ✓           │
│  Diff: R$ 0,00 ✓                                                   │
│                                                                    │
│  ┌────┬──────────┬─────────────┬──────────────────┬──────────────┐ │
│  │ ☑  │ 01/06    │ NF-2024     │ Fornecedor X     │ R$ 5.000,00  │ │
│  └────┴──────────┴─────────────┴──────────────────┴──────────────┘ │
│                                                                    │
│  ── Ajustes adicionados ──                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Categoria:  [Juros e Multas Bancárias ▾]  (sugerido)       │   │
│  │  Descrição:  [Juros sobre boleto Fornecedor X (atraso 4d)]  │   │
│  │  Valor:      R$ 70,00  (pré-preenchido com Diff)            │   │
│  │  [Salvar ajuste]  [Cancelar ajuste]                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  [Cancelar]   [+ Adjustments ▾]      [Reconcile (1 + 1 ajuste)]    │
│                                                          ↑ verde   │
└────────────────────────────────────────────────────────────────────┘
```

**Detalhes:**
- **Categoria pré-selecionada:** "Juros e Multas Bancárias" se existir no plano da empresa. Se não existir, mostra modal "Vamos criar essa categoria? [Criar] [Escolher outra]".
- **Descrição auto-gerada:** "Juros sobre boleto [supplier name] (atraso X dias)" — pré-preenchida, user edita.
- **Valor:** pré-preenchido com `|Diff|`. Editável (raríssimo precisar mexer).
- Indicador `Diff: R$ 0,00 ✓` no header atualiza ao vivo conforme user digita.
- Botão **Reconcile** mostra contagem: `Reconcile (1 + 1 ajuste)` ou `Reconcile (7 + 2 ajustes)`.

### 3.4 Após salvar ajuste → estado pronto pra reconciliar

```
┌─ FIND & MATCH ─────────────────────────────────────────────────────┐
│  Statement line: R$ 5.070,00  ·  Selected: R$ 5.070,00 ✓           │
│  Diff: R$ 0,00 ✓                                                   │
│                                                                    │
│  Selecionado pra reconciliar:                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ☑ Fornecedor X NF-2024 (AP)              R$ 5.000,00        │   │
│  │ ➕ Juros e Multas Bancárias [editar] [✕]  R$    70,00        │   │
│  │ ─────────────────────────────────────────────────────────── │   │
│  │ TOTAL                                    R$ 5.070,00 ✓      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  [Cancelar]   [+ Adjustments ▾]      [Reconcile ✓]                 │
└────────────────────────────────────────────────────────────────────┘
```

Click **Reconcile** → conciliação aplicada:
- AP (R$ 5.000) ganha reconciledWithId = OFX.id + reconcileGroupId
- **Tx nova de ajuste** é criada (R$ 70, lifecycle=EFFECTED, categoryId="Juros e Multas", origin="ADJUSTMENT", reconciledWithId=OFX.id, reconcileGroupId=mesmo)

### 3.5 Caso 2 — banco PAGOU MENOS (desconto obtido)

```
Statement line: R$ 980,00  · Selected: R$ 1.000,00
Diff: R$ 20,00  (banco pagou R$ 20 a MENOS)

Clique [+ Adjustments ▾]:
                  ┌─────────────────────────────────────┐
                  │ + Desconto Obtido (receita)         │   ← habilitado
                  │   (você pagou adiantado, R$ 20 OK)  │
                  ├─────────────────────────────────────┤
                  │ + Outro ajuste                       │
                  └─────────────────────────────────────┘
                  (Juros/Tarifa escondidos — não fazem sentido aqui)

Click "Desconto Obtido":

  ┌─────────────────────────────────────────────────────────────┐
  │  Categoria:  [Descontos Obtidos ▾]  (RECEITA financeira)    │
  │  Descrição:  [Desconto Fornecedor Y (pagamento antecipado)] │
  │  Valor:      R$ 20,00  (receita — entra no DRE como +)      │
  │  [Salvar ajuste]                                             │
  └─────────────────────────────────────────────────────────────┘

Estado final:
  ☑ Fornecedor Y NF-2030 (AP)        R$ 1.000,00 DESPESA
  ➕ Descontos Obtidos                R$    20,00 RECEITA
  ─────────────────────────────────────────────────
  TOTAL (despesa − receita)           R$   980,00 ✓  ← bate banco
```

**No DRE:**
- Despesa fornecedor: R$ 1.000 (categoria de origem do AP)
- Receita financeira: R$ 20 (desconto obtido)
- Saída de caixa real: R$ 980 ✓

### 3.6 Caso many-to-one (N:1) com ajuste

Cenário: PIX consolidado de R$ 5.070 paga 3 AP somando R$ 5.000 + R$ 70 juros.

```
Statement line: R$ 5.070,00  ·  Selected: R$ 5.070,00 ✓

  ☑ NF-2024  Fornecedor X     R$ 2.500,00
  ☑ NF-2025  Fornecedor X     R$ 1.500,00
  ☑ NF-2026  Fornecedor X     R$ 1.000,00
  ➕ Juros e Multas Bancárias  R$    70,00
  ───────────────────────────────────────
  TOTAL                       R$ 5.070,00 ✓

  [Reconcile (3 + 1 ajuste)]
```

Resultado: as 3 NFs + a tx de ajuste compartilham o mesmo `reconcileGroupId`.

---

## 4. Schema — precisa mexer?

### 4.1 Aditivos opcionais

| Campo | Tabela | Tipo | Necessário? | Razão |
|---|---|---|---|---|
| `origin='ADJUSTMENT'` | `transactions` | já é String livre | **Não** | Schema atual aceita qualquer string em `origin`. Aditivo "convencional". |
| `adjustmentForGroupId` | `transactions` | String? | **Opcional** | Pra marcar "essa tx só existe como ajuste do grupo X". Útil pra DELETE no undo. Mas `reconcileGroupId` + `origin='ADJUSTMENT'` já bastam pra identificar. |

**Recomendado: ZERO migration.** Reusa `origin` (string livre) + `reconcileGroupId` (Fase B.3). Identifica ajuste por `origin='ADJUSTMENT'`.

### 4.2 Plano de contas — sugestões pra criar

Pra cada empresa, validar se essas categorias existem; se não, oferecer criação:

| Categoria | type | dreGroup | Quando usar |
|---|---|---|---|
| **Juros e Multas Bancárias** | EXPENSE | DESPESAS_FINANCEIRAS | Pagamento atrasado, multa boleto |
| **Tarifas Bancárias** | EXPENSE | DESPESAS_FINANCEIRAS | TED/PIX/IOF |
| **Descontos Obtidos** | INCOME | RECEITAS_FINANCEIRAS | Pagamento antecipado com abono |
| **Ajustes de Arredondamento** | EXPENSE | DESPESAS_OPERACIONAIS | Diferença ≤ R$ 1 (rounding) |

**Sugestão pra Cacula Mix (validar antes):** rodar SQL pra ver se essas categorias já existem. Se não, modal "Vamos criar essas 4 categorias?" no primeiro uso.

---

## 5. Backend — novos endpoints + lib

### 5.1 Endpoint principal — extensão do reconcile N:1

`POST /api/conciliacao/find-and-match/reconcile` (extensão do existente B.3):
```ts
Body: {
  ofxTransactionId: string,
  candidateIds: string[],   // existente
  adjustments?: Array<{     // NOVO
    categoryId: string,
    amount: number,         // positivo = despesa (DEBIT); negativo = receita (CREDIT)
    description: string,
  }>
}
```

**Validação na soma:**
```
SUM(|candidate.amount|) + SUM(adjustment.amount) === |OFX.amount|  (±R$ 0,02)
```
Onde adjustment.amount tem sinal: +R$ 70 se despesa (juros), −R$ 20 se receita (desconto).

### 5.2 Lib — `lib/conciliacao/create-adjustment.ts` (novo)

```ts
async function createAdjustment(
  trx: PrismaTransaction,
  params: {
    ofxId: string,
    bankAccountId: string,
    companyId: string,
    categoryId: string,
    amount: number,         // positivo: DEBIT (despesa); negativo: CREDIT (receita)
    description: string,
    reconcileGroupId: string,
    date: Date,             // mesma da OFX
    userId: string,
  }
): Promise<Transaction>
```

Cria tx com:
- `origin='ADJUSTMENT'`
- `lifecycle='EFFECTED'`
- `type=` DEBIT (se amount > 0) ou CREDIT (se amount < 0)
- `amount=` valor absoluto
- `reconciledWithId=ofxId` (aponta pra mesma OFX que o grupo)
- `reconcileGroupId=` mesmo do grupo
- `bankAccountId=` mesma da OFX (rastreabilidade)
- `paymentDate=date=` mesma da OFX
- `categoryId=` escolhida pelo user
- `description=` editada pelo user
- audit log com `entityType='Adjustment'` + metadata completa

### 5.3 Endpoint desfazer-grupo — extensão

Já existe (B.3). Vai precisar de 1 mudança:
- Loop atomic identifica tx do grupo
- **Pra tx com `origin='ADJUSTMENT'`: DELETE em vez de undoReconciliation**
  - Justificativa: ajuste só existe por causa da conciliação. Sem ela, a tx não tem razão de ser.
  - Audit log preserva histórico (entityType='Adjustment', action='DELETE_UNDO').

### 5.4 Endpoint novo — listar/criar categorias sugeridas

`GET /api/conciliacao/adjustment-categories?empresaId=...`
- Retorna as 4 categorias sugeridas (Juros, Tarifas, Descontos, Arredondamento) com:
  - `exists: true` se já tem no plano da empresa (com `id` correto)
  - `exists: false` + template pra criar

`POST /api/conciliacao/adjustment-categories/create-defaults?empresaId=...`
- Cria as faltantes em batch. Idempotente.

---

## 6. UI — extensão do FindAndMatchPanel

### 6.1 Componente novo: `AdjustmentMenu.tsx`

Dropdown com 4 opções condicionadas ao sinal do Diff. Quando user seleciona uma, abre `AdjustmentForm.tsx`.

### 6.2 Componente novo: `AdjustmentForm.tsx`

Form inline (não modal) com 3 campos:
- Categoria (dropdown — pré-selecionada conforme tipo de ajuste)
- Descrição (pré-preenchida, editável)
- Valor (pré-preenchido com Diff)

### 6.3 Extensão de `FindAndMatchPanel.tsx`

State adicional:
- `adjustments: Array<{ id?: string, categoryId: string, amount: number, description: string }>`
- Recalcula `Selected = sum(candidates) + sum(adjustments)` ao incluir/remover ajuste
- Header `Diff` considera ajustes na soma
- Lista visual mostra candidates **+ ajustes** com botão `[✕]` em cada ajuste pra remover

### 6.4 Histórico — mostra ajuste como parte do grupo

`HistoricoTable` já agrupa por `reconcileGroupId`. Vai naturalmente mostrar ajustes como linhas do grupo. Identificar visualmente:
```
┌─ Grupo N:1 · 3 notas + 1 ajuste · 04/06 ─────────────────┐
│ Extrato: FORNECEDOR X Pix    R$ 5.070,00                  │
│                                                            │
│  Fornecedor X NF-2024              R$ 2.500,00            │
│  Fornecedor X NF-2025              R$ 1.500,00            │
│  Fornecedor X NF-2026              R$ 1.000,00            │
│  ➕ Juros e Multas (ajuste)        R$    70,00            │
│  ─────────────────────────────────────────                │
│  Total                             R$ 5.070,00 ✓          │
│                                                            │
│                        [Desfazer grupo (3+1)]              │
└────────────────────────────────────────────────────────────┘
```

Desfazer grupo: as 3 AP voltam pra pendente + a tx de ajuste é **deletada**. OFX volta a estar disponível.

---

## 7. Tolerâncias e thresholds

| Tolerância | Valor | Justificativa |
|---|---|---|
| Soma final == OFX | ±R$ 0,02 | Mesmo do B.3, absorve 1¢ de arredondamento bancário |
| "Minor adjustment" como sugestão automática | `|Diff| ≤ R$ 1,00` | Acima disso, sugere Juros/Tarifa/Desconto |
| Limite de ajuste | sem hard cap | Sempre exige categoria + valor explícitos |
| Auto-detecção sugestão de categoria | `Diff > 0 → Juros` (default), `Diff < 0 → Desconto` | User pode trocar |

---

## 8. Onde entra na ordem das fases

| Fase | Status |
|---|---|
| **B.1 → B.3** | ✅ Já em prod (tela Xero, Find & Match, N:1) |
| **B.4 (NOVA — esta proposta)** | Conciliação com Ajustes |
| **C** | Cash coding (varejo, lote de recebimentos) |
| **D** | Polimento + IA categoria automática |

**Por que B.4 entra ANTES de C?**
- Resolve um caso BLOQUEANTE pra pagamentos (boleto atrasado é universal)
- C (cash coding) é otimização pra recebimentos varejo — não bloqueia ninguém
- Yussef pode limpar pagamentos hoje COM ajustes; recebimentos aguentam até C

**Estimativa B.4: 2-3 dias.**

---

## 9. Plano de implementação (3 fases pequenas)

### B.4.1 — Categorias sugeridas + endpoints (1 dia)
- Endpoint `GET adjustment-categories` (verifica/template)
- Endpoint `POST create-defaults` (criação batch idempotente)
- Endpoint `POST find-and-match/reconcile` aceita `adjustments[]`
- Lib `create-adjustment.ts` (função pura testável + integração com `reconcileTransactions`)

### B.4.2 — UI Adjustment no Find & Match (1 dia)
- `AdjustmentMenu.tsx` (dropdown adaptativo por sinal)
- `AdjustmentForm.tsx` (categoria + descrição + valor)
- Integração no `FindAndMatchPanel` — recalcula Diff incluindo ajustes

### B.4.3 — Histórico + undo + smoke (1 dia)
- `HistoricoTable` mostra ajustes como linhas filhas do grupo (identifica `origin='ADJUSTMENT'`)
- `desfazer-grupo` endpoint: DELETE pra origin=ADJUSTMENT, undoReconcile pras outras
- Smoke real: caso boleto Cacula com juros (1:1 com ajuste) + caso many-to-one com ajuste + undo

---

## 10. ⚠️ ALTERs em dados reais — destaque obrigatório

| Operação | Tabela | Tipo | Linhas afetadas | Risco | Mitigação |
|---|---|---|---|---|---|
| Criar tx `origin='ADJUSTMENT'` no reconcile-com-ajuste | `transactions` | INSERT (1 por conciliação) | 0 antes, 1+ por ação manual do user | Baixo (insert isolado, FK validada) | Audit log; reversível via DELETE no undo |
| DELETE tx adjustment no undo do grupo | `transactions` | DELETE | 1+ por undo | Baixo (só `origin='ADJUSTMENT'` é deletada) | Audit log preserva histórico (entityType + amount + categoria) |
| Criar categorias "Juros e Multas Bancárias" / "Descontos Obtidos" / etc | `categories` | INSERT (4 por empresa) | 0 antes, 4+ por opt-in | Zero (categoria nova, opt-in explícito) | User pode escolher outra categoria existente |

**Schema:** ZERO migration. `origin` é String livre.

---

## 11. Decisões pendentes pra você aprovar antes da B.4.1

1. **Aprovar 3 sub-fases B.4.1 → B.4.2 → B.4.3** (2-3 dias total)?
2. **Tolerância "minor adjustment" automática:** ≤ R$ 1,00 ou ≤ R$ 0,50?
3. **Categorias default:** OK criar as 4 (Juros + Tarifas + Descontos + Arredondamento) ou só 2 (Juros + Descontos) + user cria as outras quando precisar?
4. **Undo do grupo** com ajuste: deletar tx de ajuste OK ou prefere soft-delete (mantém visível como "ajuste revertido")?
5. **Pré-preenchimento da descrição:** "Juros sobre boleto [supplier name] (atraso X dias)" — calcular dias de atraso automaticamente OU deixar genérico "Juros [supplier]"?
6. **Limite de quantos ajustes por reconcile** (1, 2, 5)? Recomendo cap em **3** pra evitar abuso. Caso real raramente passa de 1-2 ajustes (juros + tarifa, por exemplo).
7. **Aplicar ajustes em N:1 OU só em 1:1** primeiro? Recomendo aplicar em ambos (Xero faz). Diff é a mesma matemática.

**Recomendações minhas:**
- (2) ≤ R$ 1,00 — Xero não define, R$ 1 cobre arredondamento típico BR sem permitir abuso
- (3) Criar as 4 — Cacula vai precisar de todas
- (4) DELETE (hard) — preserva audit log + evita poluição visual
- (5) Pré-preencher genérico "Juros — [supplier]" — calcular atraso real exige cálculo extra desnecessário pro MVP
- (6) Cap em 3
- (7) Ambos (N:1 + 1:1)

---

## 12. Reuso máximo (zero rebuild)

| Camada | Componente | Reusa? |
|---|---|---|
| Lib | `find-candidates.ts` | ✓ |
| Lib | `match.ts` + `normalize-for-match` | ✓ |
| Lib | `reconcile.ts` (CLASSIC + ORPHAN + N:1) | ✓ (não muda) |
| Endpoint | `POST find-and-match/reconcile` (Fase B.3) | ✓ + aceita novo param `adjustments` |
| Endpoint | `POST desfazer-grupo/[groupId]` (Fase B.3) | ✓ + branch pra DELETE de adjustment |
| Endpoint | `GET historico` (Fase 1) | ✓ |
| Endpoint | `GET balance-check` | ✓ |
| UI | `XeroRow` (Fase B.1) | ✓ |
| UI | `FindAndMatchPanel` (Fase B.2/B.3) | ✓ + state `adjustments[]` |
| UI | `HistoricoTable` (Fase 1) | ✓ + render `origin='ADJUSTMENT'` na lista do grupo |
| UI | `StatementBalanceHeader` (Fase B.1) | ✓ |

**Componentes novos (3):**
- `AdjustmentMenu.tsx`
- `AdjustmentForm.tsx`
- `create-adjustment.ts` (lib pura)

**Endpoints novos (2):**
- `GET adjustment-categories`
- `POST adjustment-categories/create-defaults`

---

## 13. Comparação Yussef vs Xero

| Feature | Xero | Conta IA (proposta B.4) |
|---|---|---|
| Botão Adjustments no Find & Match | ✓ | ✓ |
| Bank fee (banco > AP) | ✓ Despesa | ✓ Juros/Tarifa (despesa) |
| Minor adjustment | ✓ posta em "Rounding" sistema | ✓ usa categoria do user (não acumula no balanço) |
| Banco < AP (desconto) | ❌ não cobre bem | ✓ Desconto Obtido (receita) |
| Pre-fill do amount com Diff | ❌ provavelmente não | ✓ pré-fill automático |
| N:1 + Adjustment | ✓ | ✓ |
| Undo deleta o ajuste junto | ❌ não documentado claro | ✓ DELETE atomic no desfazer-grupo |
| Sugere categoria automaticamente | ❌ user escolhe sempre | ✓ pré-seleciona "Juros" se Diff > 0, "Desconto" se Diff < 0 |
| Auto-cria categoria "Juros e Multas" se não existe | ❌ | ✓ opt-in modal |

**5 melhorias vs Xero** — todas focadas na fricção real do user.

---

## 14. Risco residual + mitigações

| Risco | Mitigação |
|---|---|
| User abusa do "Ajuste pequeno" pra evitar investigar diff real (mascarando bugs) | Cap em 3 ajustes por reconcile; log de quantos ajustes existem na empresa (alerta dashboard se > N/mês) |
| Categoria de ajuste vira "lixeira" no DRE | Categoria dedicada (Juros/Tarifa/Desconto) facilita análise no Relatório por categoria |
| Tx de ajuste fica órfã se undo falhar parcial | Atomic via `$transaction`: ou todas as N+ajustes desfazem, ou nenhuma |
| User cria ajuste de valor maior que faz sentido (ex: R$ 5000 "juros" pra mascarar uma compra) | Tolerância de validação `soma = OFX ±0.02` impede ganhar valor "do nada"; cap visual: avisa se ajuste > 10% do OFX ("Você quer mesmo R$ 70 de juros sobre R$ 500?") |
| Esquecimento de criar a categoria → cai na default genérica | Modal "Vamos criar a categoria?" no 1º uso, com texto explicando o DRE |

---

## 15. Próximo passo

Você revisa, aprova as 7 decisões da seção 11, e a gente começa pela B.4.1 (categorias + endpoints — 1 dia).

Cada sub-fase termina com smoke em prod antes da próxima:
- **B.4.1:** smoke API "Cacula tem essas 4 categorias? não. Cria. Cacula tem agora? sim ✓"
- **B.4.2:** smoke UI "Boleto R$5.070 vs AP R$5.000 → abre Find & Match → escolhe AP → vê Diff R$70 amarelo → clica Adjustments → Juros e Multas → categoria pré-selecionada + valor R$70 → Salvar → Diff R$0 verde → Reconcile habilitado"
- **B.4.3:** smoke real Cacula "concilia AP + ajuste, valida grupo no histórico, desfaz grupo, ajuste deletado, AP volta pra pendente"
