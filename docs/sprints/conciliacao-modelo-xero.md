# Conciliação Modelo Xero — Cópia fiel + Find & Match

**Data:** 04/06/2026
**Tipo:** Mockup arquitetural (SEM código ainda — espera aprovação)
**Origem:** Tela atual (Sprint A-effected Fase B) ficou inventiva. Yussef quer **copiar o Xero exatamente** — referência mundial.
**Documento irmão:** `docs/sprints/conciliacao-reformulada.md` (mockup anterior — algumas decisões aproveitadas)
**Pesquisa fonte:** Xero Central docs, Numeric.io, BankReconciler.app, Telleroo, Gentle Frog (todas linkadas no fim).

---

## 🎯 Por que copiar o Xero

1. **É a referência mundial** em conciliação. Conta Azul/QuickBooks são mais limitados.
2. **Find & Match resolve o caso real do Yussef** (CIA DA FRUTA R$ 3.786,78 — auto-match não acha → user busca manualmente e escolhe).
3. **Layout é limpo e ensina sozinho** — o objetivo "trazer Statement Balance e Balance in Xero pra zero" é óbvio em 2 segundos.
4. **Cash coding em aba separada** atende pizzaria PIX maquininha sem cliente.
5. **A gente já tem 90% do engine pronto** (matcher Sprint A, reconcile, balance-check). Falta só reorganizar a UI + adicionar Find & Match.

---

## 1. Estrutura geral da página (igual Xero)

```
┌───────────────────────────────────────────────────────────────────────┐
│ Conciliação · CACULA MIX                          [Trocar empresa ▾]  │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Statement Balance      Balance in Xero                               │
│  R$ 34.450,00          R$ 12.450,30                                   │
│  (saldo do banco)       (saldo no sistema)                            │
│                                                                       │
│  → R$ 22.000 a conciliar pra bater                                   │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│ [Reconcile (43)]  [Cash coding]  [Bank statements]  [Account txs]    │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Conta: [Banrisul PJ ▾]   Período: [60d ▾]   Tipo: [Só pagamentos ▾] │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  [LINHAS DE EXTRATO + CARDS DE AÇÃO LADO A LADO — ver abaixo]        │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

**Mudanças vs Fase B:**
- BalanceBanner colorido → **2 números empilhados sóbrios** ("Statement Balance" / "Balance in Xero"). Diferença visual, não amarela. Mais Xero-like.
- 3 abas (Conciliar/Em lote/Conciliado) → **4 abas top do Xero**: `Reconcile` (default) / `Cash coding` / `Bank statements` / `Account txs` (essa última = aba "Conciliado" reaproveitada).
- Filtros (Conta + Período + Tipo) ficam **logo abaixo das abas**, em linha.

---

## 2. Linha do extrato (esquerda do split) — "Card box" do Xero

**Decisão:** copia layout Xero. **Não é row de tabela** — é uma **card box** com colunas internas:

```
┌─────────────────────────────────────────────────────────────────┐
│ Date     Description                Reference   Spent   Received│
├─────────────────────────────────────────────────────────────────┤
│ 03/06    FRIGORIFICO SILVA            REF12345   6.129,88   ─   │
│          INDUSTRIA - Pagamento                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Pontos importantes:**
- **Spent** e **Received** em **colunas distintas** (cópia exata Xero — facilita scan visual).
- Sem checkbox nativo (Xero também não tem na aba Reconcile — bulk vai em "Cash coding").
- Description completa (não truncada — Xero não trunca por padrão).
- Click no card esquerdo dá foco no card direito.

---

## 3. Card direito — 4 abas exatas do Xero

### 3.1 Estrutura sempre presente

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─Match─┐ ┌─Create─┐ ┌─Transfer─┐ ┌─Discuss─┐                   │
│ │   ★   │ │        │ │          │ │         │                   │
│ └───────┘ └────────┘ └──────────┘ └─────────┘                   │
│                                                                 │
│ [conteúdo da aba ativa]                                         │
│                                                                 │
│ [OK ✓]                       Find & Match                       │
└─────────────────────────────────────────────────────────────────┘
```

- **4 tabs no topo do card** (Match | Create | Transfer | Discuss) — Match pré-selecionada quando há sugestão.
- **Botão "OK" verde** no rodapé esquerdo da aba ativa.
- **Link "Find & Match"** em azul no rodapé direito — disponível em qualquer aba.

### 3.2 Aba MATCH — com sugestão automática (FUNDO VERDE CLARO)

```
┌─ STATEMENT LINE (esquerda) ──┐  ┌─ MATCH CARD (direita) ──────────┐
│ 03/06 FRIGORIFICO SILVA      │  │ ┌─Match★─┐┌Create┐┌Transfer┐... │
│ REF12345  6.129,88           │  │ └────────┘└──────┘└────────┘    │
│                              │  │                                 │
│                              │  │ ✓ Encontrado: FRIGORIFICO SILVA │
│                              │  │   INDUSTRIA E COMERCIO LTDA     │
│                              │  │   Bill #INV-789                 │
│                              │  │   Due 03/06/2026                │
│                              │  │   R$ 6.129,88  (bate exato)     │
│                              │  │                                 │
│                              │  │ 1 other possible match          │
│                              │  │                                 │
│                              │  │ [OK ✓]          Find & Match   │
│                              │  │                                 │
│                              │  │ ← fundo verde claro #ECFDF5      │
│                              │  └─────────────────────────────────┘
│                              │
└──────────────────────────────┘
```

**Detalhes fiéis ao Xero:**
- Fundo verde claro (`bg-emerald-50/50`) quando há sugestão.
- Detalhe do candidato visível direto (nome + número + due + valor) — **não precisa clicar pra expandir**.
- Indicador "**X other possible match**" embaixo, em link azul — clique abre as alternativas embaixo (ou substitui pela #2).
- Botão **OK verde** → reconcile imediato.
- Find & Match disponível pra quando a sugestão tá errada.

### 3.3 Aba MATCH — sem sugestão (FUNDO BRANCO/CINZA)

```
┌─ STATEMENT LINE ─────────────┐  ┌─ MATCH CARD ────────────────────┐
│ 02/06 PIX RECEBIDO STONE     │  │ ┌─Match─┐┌Create★┐┌Transfer┐... │
│ 12345  ─       450,00        │  │ └───────┘└───────┘└────────┘    │
│                              │  │                                 │
│                              │  │ No matching transactions found  │
│                              │  │                                 │
│                              │  │ Use Find & Match to search      │
│                              │  │ existing accounts payable.      │
│                              │  │                                 │
│                              │  │ Or click Create →               │
│                              │  │                                 │
│                              │  │                Find & Match     │
│                              │  └─────────────────────────────────┘
└──────────────────────────────┘
```

Quando não há sugestão: tab **Create** vira a sugestão default (★), Match fica mostrando "No matching transactions found" + sugestão pra usar Find & Match.

### 3.4 Aba CREATE — formulário 1 linha (estilo Xero)

```
┌─ CREATE TAB ─────────────────────────────────────────────────────┐
│  Who              What                  Why          Tax    [OK] │
│  [Quem ▾____]    [Categoria ▾_______]  [_______]    [▾]    Save  │
│                                                                  │
│  + Add details                                                   │
└──────────────────────────────────────────────────────────────────┘
```

- **Who** | **What** | **Why** | **Tax Rate** em uma única linha horizontal (como Xero).
- **Who**: autocomplete de Suppliers/Customers. **"+ Add [name] as new"** inline se digitar nome novo.
- **What**: dropdown do plano de contas (categoria — INCOME pra CREDIT, EXPENSE pra DEBIT). **OBRIGATÓRIO** (decisão #6 — bloqueia OK sem categoria).
- **Why**: texto livre (memo/notas).
- **Tax Rate**: dropdown (pra MVP BR — pode ser placeholder até integrarmos com tax-profile).
- **+ Add details**: expande pra form completo (notas longa, line items, supplier address — fica pra depois).
- **OK** verde (mesmo botão usado em Match).
- **Checkbox "Criar regra"** segue existindo (do nosso MVP) — abaixo dos campos, antes do OK.

### 3.5 Aba TRANSFER

```
┌─ TRANSFER TAB ────────────────────────────────────────────────────┐
│  Transfer to/from Bank account:                                   │
│  [Sicredi PJ ▾]                                                   │
│                                                                   │
│  Reference (opcional): [_________________]                        │
│                                                                   │
│  [OK ✓]                                                           │
└───────────────────────────────────────────────────────────────────┘
```

- Dropdown de **bank accounts** da empresa (exclui a conta atual).
- Reference opcional.
- Click no OK → cria transferência pareada via `lib/transfers/from-ofx.ts` (Sprint 0.5 — já temos!).
- Reconcile automaticamente.

### 3.6 Aba DISCUSS

```
┌─ DISCUSS TAB ─────────────────────────────────────────────────────┐
│  Add a note (visible to your team):                               │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Conferir com o Pedro se essa NF foi rejeitada antes de       │  │
│  │ conciliar.                                                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [Save note]                                                      │
│                                                                   │
│  Previous notes:                                                  │
│    "Pedro confirmou que tá ok" — 03/06 por Yussef                 │
└───────────────────────────────────────────────────────────────────┘
```

- Textarea simples + botão "Save note".
- Sem @mention (Xero também não tem).
- Notas anteriores listadas embaixo (cópia do Xero — fica visível ao reabrir a linha).
- A statement line **não some** quando tem Discuss — fica visível pra revisão.

**Schema:** vai precisar de tabela nova `transaction_notes` ou campo `discussNotes JSON` em transactions. Aditivo. Fica pra Fase final desta sprint OU primeiro dia de implementação.

---

## 4. ⭐ FIND & MATCH — O painel CRÍTICO (caso CIA DA FRUTA)

### 4.1 O caso real do Yussef

> "CIA DA FRUTA R$ 3.786,78 está nas minhas contas a pagar (paguei essa nota), mas o auto-match não acha. Não tem como eu ESCOLHER manualmente qual nota da CIA DA FRUTA é essa."

**Find & Match resolve:** Yussef clica no link, busca "CIA DA FRUTA", vê todas as APs dessa fornecedora, escolhe a certa, casa.

### 4.2 Como funciona — INLINE TAKEOVER (não modal, não popup)

Quando o user clica **Find & Match** em qualquer card direito, o card direito **expande ocupando a largura inteira da statement line**, substituindo as 4 tabs por um painel de busca:

```
┌─ STATEMENT LINE (esquerda — fica intacta) ──────────────────────────────┐
│ 03/06 CIA DA FRUTA COMERCIO          REF99887   3.786,78                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FIND & MATCH                                                           │
│  Statement line: R$ 3.786,78  ·  Selected: R$ 0,00  ·  Diff: R$ 3.786,78│
│                                                                         │
│  🔍 Search: [CIA DA FRUTA________________________________]              │
│  (busca por nome, número da nota, referência, valor)                    │
│                                                                         │
│  ┌────┬──────────┬─────────────┬──────────────────────┬──────────────┐  │
│  │ ☑  │  Date    │  Reference  │  To/From             │  Amount      │  │
│  ├────┼──────────┼─────────────┼──────────────────────┼──────────────┤  │
│  │ ☐  │ 03/06    │ NF-1234     │ CIA DA FRUTA COMERC. │ R$ 3.786,78  │  │
│  │ ☐  │ 02/06    │ NF-1233     │ CIA DA FRUTA COMERC. │ R$   669,76  │  │
│  │ ☐  │ 01/06    │ NF-1232     │ CIA DA FRUTA COMERC. │ R$   530,09  │  │
│  │ ☐  │ 28/05    │ NF-1228     │ CIA DA FRUTA COMERC. │ R$ 1.103,98  │  │
│  └────┴──────────┴─────────────┴──────────────────────┴──────────────┘  │
│                                                                         │
│  [Selecionar tudo da busca]                                             │
│                                                                         │
│  [Cancelar]                                       [Reconcile ✓]         │
│   ↑ volta pras 4 tabs                              ↑ verde, só ativa    │
│                                                     quando Selected      │
│                                                     == Statement line    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Comportamento exato

- **1 campo de busca** universal (descrição, supplier name, reference/NF#, valor exato). Reage on-type (debounce 300ms).
- **Tabela com checkbox** + colunas `Date | Reference | To/From | Amount` (cópia Xero).
- **Multi-select** (N invoices = 1 statement line) — soma das selecionadas vs valor do statement line aparece no topo.
- **Indicador colorido**: `Diff R$ X` em **vermelho** quando ainda não bate, **verde** quando bate.
- **Botão Reconcile** só ativa quando `Selected total == Statement line amount` (tolerância R$ 0,01).
- **Split link** (Fase C+) pra parcial — Yussef seleciona 1 invoice maior que o statement line e divide.
- **Cancelar** volta às 4 tabs sem perder seleção do que estava nelas.

### 4.4 Caso CIA DA FRUTA resolvido em 3 passos

1. Yussef vê na lista esquerda: `CIA DA FRUTA COMERCIO R$ 3.786,78` com card direito mostrando **"No matching transactions found"** (auto-match falhou).
2. Clica **"Find & Match"** → painel expande.
3. Digita `CIA DA FRUTA` na busca → 4 APs dessa fornecedora aparecem.
4. Marca a NF-1234 R$ 3.786,78 → `Selected = R$ 3.786,78 · Diff = R$ 0,00 ✓` (verde).
5. Botão Reconcile ativa → click → **conciliado**.

**Sem Find & Match (hoje):** Yussef desistiria e marcaria como IGNORAR, ou conciliaria sugestão errada por engano.

---

## 5. Aba "Cash coding" (Xero — Sprint posterior)

Não vai nessa sprint. Quando for, vira grid 100-200 linhas estilo planilha:

```
┌─ Cash coding tab ─────────────────────────────────────────────────────┐
│  ☑ Date    Description                    Who      What        Amount │
├───────────────────────────────────────────────────────────────────────┤
│  ☑ 03/06   PIX RECEBIDO MAQUININHA STONE  ─        Rec.Vendas  450,00 │
│  ☑ 03/06   PIX RECEBIDO MAQUININHA STONE  ─        Rec.Vendas  180,00 │
│  ☑ 02/06   PIX RECEBIDO MAQUININHA STONE  ─        Rec.Vendas  450,00 │
│  ...                                                                  │
│                                                                       │
│  Apply to all selected: [Categoria ▾] [Apply rule] [Save & reconcile] │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 6. Aba "Account transactions" (= nossa Já Conciliado)

Reusa o `HistoricoTable` que já existe. Mudamos só o nome da aba pra "Account transactions" (fiel ao Xero). Mantém Desfazer.

---

## 7. Plano de execução — 3 fases pequenas

### Fase B.1 — Refatorar layout topo + linhas (2 dias)
**Mudanças:**
- BalanceBanner colorido → **2 números sóbrios** (Statement Balance / Balance in Xero) com diferença visual
- 3 abas atuais → **4 abas Xero** (Reconcile / Cash coding / Bank statements / Account transactions)
- Linha do extrato vira **card box** com colunas Date/Description/Reference/Spent/Received
- Card direito mantém 4 tabs Match/Create/Transfer/Discuss mas **fundo verde quando match**
- Botão "OK" verde + "Find & Match" link azul no rodapé do card

**O que reusa:** RowActions (já tem 4 tabs! só refatorar visual), CasarPanel/CriarPanel/TransferirPanel/IgnorarPanel, `BalanceBanner`, endpoints atuais.

**Marco:** Yussef abre `/conciliacao`, vê 2 números no topo, 4 abas Xero-style, linhas com colunas Spent/Received separadas, cards verdes quando há match.

### Fase B.2 — FIND & MATCH (3 dias) ⭐ CRÍTICO
**Mudanças:**
- Novo componente `FindAndMatchPanel.tsx` — inline takeover do card direito
- Novo endpoint `GET /api/conciliacao/find-and-match?empresaId=&busca=&excluirIds=` — retorna APs/ARs que batem (busca por descrição/supplier/reference/valor, com paginação)
- Multi-select com soma + indicador Diff R$ X vermelho/verde
- Botão Reconcile que dispara `POST /api/conciliacao/bulk-confirmar` reusando o existente (N candidates: 1 OFX)
- **Schema:** ZERO migration. Tudo reusa.

**Caso de teste:** Yussef abre `/conciliacao` na Cacula, clica numa linha sem match (ex: a CIA DA FRUTA órfã), abre Find & Match, busca "CIA DA FRUTA", marca, reconcilia → DRE atualiza.

**Marco:** Yussef consegue conciliar manualmente QUALQUER OFX com QUALQUER AP/AR existente.

### Fase B.3 — Aba DISCUSS + Transfer real + cleanup (2 dias)
**Mudanças:**
- Aba DISCUSS funcional: textarea + lista de notas anteriores
- Schema: 1 coluna `discussNotes Json?` em transactions (aditivo, nullable)
- Aba TRANSFER funcional: dropdown bank accounts + reusa `lib/transfers/from-ofx.ts`
- Remove ConfidenceList legado se ainda existe
- Renomeia aba "Conciliar" pra "Reconcile" (fiel Xero)

**Marco:** todas as 4 abas funcionam. Tela 100% Xero-like.

**Total: 7 dias.**

---

## 8. O que MANTÉM intacto (engine, lib, endpoints)

| Camada | Componente | Mantém? |
|---|---|---|
| Engine | `lib/conciliacao/find-candidates` (ramo 1 + ramo 2 ORPHAN) | ✓ |
| Engine | `lib/conciliacao/match` + `normalize-for-match` | ✓ |
| Engine | `lib/conciliacao/reconcile` (CLASSIC + ORPHAN modes) | ✓ |
| Endpoint | `POST /api/conciliacao/confirmar` (1 par) | ✓ |
| Endpoint | `POST /api/conciliacao/bulk-confirmar` (N pares) | ✓ — Find & Match usa esse pra N:1 |
| Endpoint | `POST /api/conciliacao/desfazer/[id]` (undo) | ✓ |
| Endpoint | `GET /api/conciliacao/historico` (já conciliado) | ✓ |
| Endpoint | `GET /api/conciliacao/balance-check` (saldo) | ✓ — só muda visual no client |
| Endpoint | `GET /api/conciliacao/ofx-pendentes` (lista esquerda) | ✓ |
| Endpoint | `GET /api/conciliacao/bulk-dry-run` (sugestões em lote) | ✓ — Reconcile tab usa pra preencher Match |
| Endpoint | `POST /api/conciliacao/cash-code` (CRIAR) | ✓ |
| Endpoint | `POST /api/conciliacao/ignorar/[id]` (IGNORAR — fica como ação no menu "More" do card) | ✓ |
| Componente | `BalanceBanner` | adapta visual (2 números empilhados) |
| Componente | `HistoricoTable` | ✓ — vira aba "Account transactions" |
| Componente | `RowActions` | refatora pra visual Xero (mas estrutura 4 tabs continua) |
| Schema | as 5 colunas Fase B (`ignoredAt`/`cashCoded`/etc) | ✓ |

**Schema novo necessário:** 1 coluna `discussNotes Json?` em transactions (Fase B.3, aditivo, nullable). **Pode entrar como migration única na Fase B.3** ou postergar.

---

## 9. Mockup final consolidado — linha completa do banco com card direito

### Caso 1 — Match achado (caso Frigorifico Silva)

```
┌─ STATEMENT LINE (esquerda) ──┐    ┌─ MATCH CARD (direita — verde claro) ──┐
│                              │    │ ┌─Match★─┐┌Create┐┌Transfer┐┌Discuss┐ │
│ Date     Description  Spent  │    │ └────────┘└──────┘└────────┘└───────┘ │
│ 03/06    FRIGORIFICO  6129.88│    │                                       │
│          SILVA INDUS         │    │ ✓ FRIGORIFICO SILVA INDUSTRIA E       │
│                              │    │   COMERCIO LTDA                        │
│ Reference: REF12345          │    │   Bill #INV-789 · Due 03/06            │
│                              │    │   R$ 6.129,88 (Match exato)            │
│                              │    │                                       │
│                              │    │ 1 other possible match                │
│                              │    │                                       │
│                              │    │ [OK ✓]               Find & Match     │
│                              │    └───────────────────────────────────────┘
│                              │      ↑ fundo emerald-50/50
└──────────────────────────────┘
```

### Caso 2 — Sem match (caso CIA DA FRUTA — usa Find & Match)

```
┌─ STATEMENT LINE ─────────────┐    ┌─ MATCH CARD (cinza neutro) ───────────┐
│                              │    │ ┌─Match─┐┌Create★┐┌Transfer┐┌Discuss┐ │
│ Date     Description  Spent  │    │ └───────┘└───────┘└────────┘└───────┘ │
│ 03/06    CIA DA FRUTA 3786.78│    │                                       │
│          COMERCIO            │    │ No matching transactions found        │
│                              │    │                                       │
│ Reference: REF99887          │    │ Use Find & Match to search            │
│                              │    │ existing accounts payable.            │
│                              │    │                                       │
│                              │    │ Or click Create to add a new tx →     │
│                              │    │                                       │
│                              │    │                      Find & Match     │
│                              │    └───────────────────────────────────────┘
└──────────────────────────────┘
```

### Caso 3 — Find & Match aberto (caso CIA DA FRUTA resolvido)

```
┌─ STATEMENT LINE ─────────────────────────────────────────────────────────┐
│ 03/06 CIA DA FRUTA COMERCIO   REF99887   3.786,78                       │
├──────────────────────────────────────────────────────────────────────────┤
│  FIND & MATCH                                                            │
│                                                                          │
│  Statement line: R$ 3.786,78 · Selected: R$ 3.786,78 · Diff: R$ 0,00 ✓  │
│                                                                          │
│  🔍 [CIA DA FRUTA__________________________]                             │
│                                                                          │
│  ┌────┬──────────┬─────────────┬─────────────────────┬──────────────┐    │
│  │ ☑  │ 03/06    │ NF-1234     │ CIA DA FRUTA COM... │ R$ 3.786,78  │    │
│  │ ☐  │ 02/06    │ NF-1233     │ CIA DA FRUTA COM... │ R$   669,76  │    │
│  │ ☐  │ 01/06    │ NF-1232     │ CIA DA FRUTA COM... │ R$   530,09  │    │
│  └────┴──────────┴─────────────┴─────────────────────┴──────────────┘    │
│                                                                          │
│  [Cancelar]                                       [Reconcile ✓]          │
│                                                    (ativo, verde)         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Decisões pendentes pra você aprovar antes da Fase B.1

1. **Topo:** 2 números empilhados (Statement / Balance in Xero) ou continua banner colorido?
   - Recomendado: 2 números (fiel Xero, mais sóbrio).
2. **Linhas do extrato:** card box (Xero) ou lista compacta atual?
   - Recomendado: card box (mais escaneável, igual Xero).
3. **Spent/Received separados** ou um único Amount com sinal/cor?
   - Recomendado: separados (Xero faz, ajuda scan visual).
4. **IGNORAR fica onde?** Hoje é uma tab. Xero não tem tab dedicada — opção fica em menu "More" ou similar.
   - Recomendado: mover pra menu "..." no canto do card (não polui as 4 tabs Xero).
5. **Find & Match abre INLINE substituindo o card** ou MODAL fullscreen?
   - Recomendado: INLINE (igual Xero). Modal seria menos elegante.
6. **Tabela do Find & Match:** mostra **só AP/AR pendentes** ou **inclui ações já feitas** (categorias, etc)?
   - Recomendado: AP/AR pendentes (Xero limita também). Categorias entram via aba CREATE.
7. **Aba "Cash coding" (Xero)** — implementa nessa sprint ou fica pra próxima?
   - Recomendado: próxima (Fase C). Foco agora: copiar core Reconcile + Find & Match.

---

## 11. Estimativa final

| Fase | Escopo | Duração |
|---|---|---|
| B.1 | Topo + 4 abas + card box + visual Xero | 2 dias |
| B.2 | ⭐ FIND & MATCH (componente + endpoint + reconcile N:1) | 3 dias |
| B.3 | Aba DISCUSS + TRANSFER real + cleanup | 2 dias |
| **Total** | | **7 dias** |

Cash coding fica pra Fase C separada (não copia ainda — só após Reconcile core estar fiel ao Xero).

---

## 12. Fontes (Xero docs e tutoriais validados)

- [Reconcile your bank account — Xero Central](https://central.xero.com/s/article/Reconcile-your-bank-account)
- [Find transactions to match — Xero Central](https://central.xero.com/s/article/Reconcile-a-bank-statement-line-using-Find-Match) ⭐
- [Record a part payment during reconciliation — Xero Central](https://central.xero.com/s/article/Record-a-part-payment-during-reconciliation)
- [Why are Statement Balance and Balance in Xero different — Xero Central](https://central.xero.com/s/article/Why-are-the-statement-balance-and-balance-in-Xero-different)
- [Numeric.io — How to Reconcile in Xero](https://www.numeric.io/blog/how-to-reconcile-in-xero)
- [BankReconciler.app — Xero Bank Reconciliation Guide 2026](https://bankreconciler.app/blogXeroReconciliation)
- [Find & Match search multiple invoices — Xero Product Ideas](https://productideas.xero.com/forums/967136-banking-chart-of-accounts/suggestions/45636193) (limite de busca conhecido)

---

**Próximo passo:** você revisa, aprova as 7 decisões da seção 10, e a gente começa pela Fase B.1 (visual Xero do topo + abas + linhas — 2 dias).
