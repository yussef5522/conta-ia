# Conciliação Reformulada — Modelo Xero + Cash Coding pra varejo

**Data:** 03/06/2026
**Tipo:** Proposta arquitetural + mockup (SEM código ainda — espera aprovação)
**Origem:** Yussef usando a Fase 2 com dados reais da Cacula Mix (PIZZARIA) descobriu que o modelo atual "OFX × Contas a Pagar/Receber" **não fecha** pra negócio de alto volume de recebimentos avulsos.
**Documento irmão:** `docs/sprints/conciliacao-tela-lider.md` (modelo anterior — vai ser parcialmente reusado).

---

## 🎯 Resumo executivo

**O insight de hoje (03/06/2026):** Cacula Mix é PIZZARIA. Vende pra milhares de clientes via PIX/maquininha. **NÃO faz sentido cadastrar cliente pra cada venda**. Logo, "conciliar recebimento com Conta a Receber" é uma operação impossível pro volume real do negócio. A tela atual sugere candidatos pra CREDIT OFX, mas nunca acha — porque conta a receber não existe.

**O modelo correto** é o Xero. Cada linha do extrato banco recebe **4 ações** (em vez de só "Conciliar"):
1. **CASAR** — quando existe conta no sistema (típico de fornecedor PJ a pagar)
2. **CRIAR** — categorizar direto, SEM precisar cadastrar cliente/fornecedor (o "cash coding" do Xero — feito pra varejo)
3. **TRANSFERIR** — quando é entre contas próprias (reusa Sprint 0.5)
4. **IGNORAR** — taxa, estorno, não-conciliável

Plus: **modo "Conciliar em lote"** (grid tipo planilha) — pizzaria com 80 PIX/dia ordena por descrição, seleciona 80, categoria = "Receita Vendas", **3 cliques resolve tudo**.

**Diferencial pro Yussef:** desbloqueia a pizzaria + a maioria das PMEs de serviço/varejo. Conta Azul não faz isso (não tem cash coding) → ganha por features.

---

## 0. Os 3 problemas confirmados (Yussef usando)

### 0.1 — Conciliar recebimento não fecha pro varejo
- Cacula vende ~80 PIX/dia, sem cliente cadastrado
- Aba "Sem match" enche de OFX CREDIT sem candidato (porque conta a receber nem existe pra criar candidato)
- Modelo atual força criação manual via `/api/transacoes` cadastrando customer — operacionalmente impossível
- **Solução:** seletor "Só Pagamentos" (default pra varejo) + ação **CRIAR** inline (categoriza direto, sem cliente)

### 0.2 — Aba "Revisar" confusa
- 2 colunas hoje, mas "Conta a pagar / receber (sistema)" aparece SÓ ao clicar no OFX → user não vê valor do lado sistema antes de decidir
- ConfidenceList compacta mostra os 2 lados mas com tipografia hierarquizada que confunde qual é qual
- **Solução:** card 2 colunas explícitas, valor em destaque nos DOIS lados, label clara ("Extrato banco" × "Conta sistema")

### 0.3 — Só tem botão "Conciliar"
- Hoje na ConfidenceList: 1 botão "Conciliar" por linha
- Sem opção pra ignorar par errado (volta a aparecer toda vez)
- Sem opção pra editar (escolher candidato diferente, ajustar valor)
- Sem opção pra "deixar pra depois" — fica encalhado
- **Solução:** 4 tabs de ação por linha + "Trocar candidato" dentro de CASAR

---

## 1. Pesquisa Xero + Conta Azul (resumida)

| Recurso | Xero | Conta Azul | Conta IA hoje | **Conta IA novo** |
|---|---|---|---|---|
| Ações por linha do extrato | 5 (Match/OK/Create/Transfer/Discuss) como tabs do card direito | 4-5 (Buscar/Revisar/Desvincular/Desfazer/Novo) em menu Ações | **1** (Conciliar) | **4** (Casar/Criar/Transferir/Ignorar) |
| Criar tx direto sem cliente cadastrado | ✅ aba Create (Who/What/Why) | Parcial (Novo limitado a ajustes) | ❌ obriga cadastro | ✅ CRIAR inline |
| Cash coding / bulk grid | ✅ aba dedicada, 200 linhas/página, multi-select + Account + Save & reconcile | ❌ não tem | ❌ não tem | ✅ "Conciliar em lote" |
| Layout 2 lados claro | ✅ esq=banco, dir=sistema, valores nos 2 | ✅ idem | ❌ direita só ao clicar | ✅ explícito |
| Apply rule no bulk | ✅ "Apply rule" reusa rules salvas | ❌ não tem | ✅ `ai_learning_rules` já existe | ✅ integrar bulk + rules |
| Filtro debit/credit | Implícito (header) | Implícito (header) | Não tem | ✅ seletor "Só Pagamentos" |
| Find & Match (multi-AP soma 1 OFX) | ✅ checkbox multi | ✅ N:1 painel diff | ❌ não tem | Fase 4 (already mapeado em conciliacao-tela-lider) |

**O que dá pra ROUBAR do Xero pro varejo:**
1. **Cash Coding grid** — sem isso pizzaria não escala
2. **Aba Create inline** sem exigir cliente cadastrado
3. **"Apply rule" no bulk** — quando IA aprendeu padrão "PIX MAQUININHA" → "Receita Vendas", aplica em lote
4. **Tabs no card direito** (não botões soltos) — economiza espaço vertical

**O que NÃO copiar do Conta Azul:**
- Fluxo individual "Buscar + Revisar valores 1 por um" — lento demais pra varejo
- Mas vale roubar o "Revisar valores" como modal pra casos de juros/multa em boleto atrasado (caso especial)

---

## 2. Mockup completo da tela nova

### 2.1 Header global

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Conciliação · CACULA MIX                            [Trocar empresa ▾]   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  💰 Banrisul PJ · maio/2026  [▾]                                         │
│                                                                          │
│  ⚠️  Saldo com diferença de R$ 22.000,00                                 │
│      Saldo sistema: R$ 12.450  ·  Saldo banco: R$ 34.450                 │
│      18 prováveis duplicatas + algumas tx sem categoria. Concilie pra    │
│      bater. [Detalhes →]                                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Linha de filtros + seletor de modo

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Tipo: [ Só Pagamentos ▾ ]  Período: [60d ▾]  Conta: [Banrisul ▾]        │
│                                                                          │
│  Busca: [_______________]   [Limpar]                                     │
│  ☐ Mostrar só prováveis duplicatas                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

**Seletor "Tipo":**
- `Só Pagamentos` (default pra varejo — esconde OFX CREDIT) — pizzaria default
- `Só Recebimentos` — útil pra modo "cash coding em massa" de vendas
- `Pagamentos + Recebimentos` — visão completa

### 2.3 Abas principais

```
┌──[Conciliar (143)]──[Conciliar em lote]──[✓ Já Conciliado (12)]──┐
```

3 abas (em vez de 4 do mockup anterior). A separação alta/revisar/sem-match some — TUDO vai pra "Conciliar" e cada linha mostra seu próprio estado via cor do botão CASAR.

### 2.4 Aba "Conciliar" — linha do extrato com 4 ações por tab

**Caso A — Pagamento a fornecedor com match (CASAR sugerido, score 85):**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  03/06/2026   FRIGORIFICO SILVA INDUSTRIA - Pagamento   − R$ 6.129,88   │
│                                                                          │
│  ┌─[CASAR ★]──[CRIAR]──[TRANSFERIR]──[IGNORAR]──────────────────────┐    │
│  │                                                                  │    │
│  │  Match alta confiança · Score 85/100                             │    │
│  │  ┌──────────────────────────┬──────────────────────────┐         │    │
│  │  │ EXTRATO (banco)          │ CONTA A PAGAR (sistema)  │         │    │
│  │  │ 03/06/2026               │ vence 03/06/2026         │         │    │
│  │  │ R$ 6.129,88              │ R$ 6.129,88 ✓ bate exato │         │    │
│  │  │ "FRIGORIFICO SILVA       │ "FRIGORIFICO SILVA       │         │    │
│  │  │  INDUSTRIA - Pagamento"  │  INDUSTRIA E COMERCIO L" │         │    │
│  │  └──────────────────────────┴──────────────────────────┘         │    │
│  │  Sinais: valor exato / D±1 / nome normalizado IA                 │    │
│  │                                                                  │    │
│  │  [Casar este par]  [Trocar candidato ▾]                          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Caso B — Recebimento PIX maquininha (CRIAR sugerido, sem candidato):**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  02/06/2026   PIX RECEBIDO MAQUININHA STONE 12345    + R$ 450,00         │
│                                                                          │
│  ┌─[CASAR]──[CRIAR ★]──[TRANSFERIR]──[IGNORAR]──────────────────────┐    │
│  │                                                                  │    │
│  │  Sem conta a receber compatível (esperado pra venda avulsa).     │    │
│  │  Categorize direto:                                              │    │
│  │  ┌────────────────────────────────────────────────────────────┐  │    │
│  │  │ Categoria: [ Receita de Vendas Pizza ▾ ]                   │  │    │
│  │  │ Quem (opcional): [______________________]                   │  │    │
│  │  │ Notas (opcional): [______________________]                  │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  │                                                                  │    │
│  │  💡 IA sugere "Receita de Vendas" baseado na descrição PIX       │    │
│  │  ☑ Criar regra "PIX RECEBIDO MAQUININHA" → Receita Vendas        │    │
│  │                                                                  │    │
│  │  [Criar e categorizar]                                           │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Caso C — Transferência entre contas próprias (TRANSFERIR):**

```
│  ┌─[CASAR]──[CRIAR]──[TRANSFERIR ★]──[IGNORAR]──────────────────────┐    │
│  │                                                                  │    │
│  │  Reusa modal "Nova Transferência" da Sprint 0.5.                 │    │
│  │  Conta destino: [Sicredi PJ ▾]                                   │    │
│  │  [Marcar como transferência interna]                             │    │
│  └──────────────────────────────────────────────────────────────────┘    │
```

**Caso D — Ignorar (taxa banco, estorno, lançamento não-conciliável):**

```
│  ┌─[CASAR]──[CRIAR]──[TRANSFERIR]──[IGNORAR ★]──────────────────────┐    │
│  │                                                                  │    │
│  │  Por que ignorar?                                                │    │
│  │  ( ) Taxa do banco                                               │    │
│  │  ( ) Estorno / devolução                                         │    │
│  │  ( ) Lançamento errado do banco                                  │    │
│  │  ( ) Outro: [_____________]                                      │    │
│  │                                                                  │    │
│  │  ☑ Não me incomodar mais com este tipo de tx                     │    │
│  │  [Ignorar]                                                       │    │
│  └──────────────────────────────────────────────────────────────────┘    │
```

### 2.5 Aba "Conciliar em lote" (cash coding — DIFERENCIAL pizzaria)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Conciliar em lote                                                       │
│  Categorize várias tx parecidas de uma vez (estilo Xero cash coding)     │
│                                                                          │
│  Filtro: [Só recebimentos ▾]  Período: [60d ▾]                           │
│  Ordenar por: [Descrição A-Z ▾]                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ ☑ Data    Descrição                          Categoria        Valor      │
├──────────────────────────────────────────────────────────────────────────┤
│ ☑ 03/06   PIX RECEBIDO MAQUININHA STONE      (selecione) ▾    R$ 250,00  │
│ ☑ 03/06   PIX RECEBIDO MAQUININHA STONE      (selecione) ▾    R$ 180,00  │
│ ☑ 03/06   PIX RECEBIDO MAQUININHA STONE      (selecione) ▾    R$ 320,00  │
│ ☑ 02/06   PIX RECEBIDO MAQUININHA STONE      (selecione) ▾    R$ 450,00  │
│ ☑ 02/06   PIX RECEBIDO MAQUININHA STONE      (selecione) ▾    R$ 200,00  │
│ ☑ 01/06   PIX RECEBIDO MAQUININHA CIELO      (selecione) ▾    R$ 380,00  │
│ ☑ 01/06   PIX RECEBIDO MAQUININHA CIELO      (selecione) ▾    R$ 215,00  │
│ ...                                                                      │
│ (mostra 100 linhas; total 80 selecionadas)                               │
├──────────────────────────────────────────────────────────────────────────┤
│  ☐ Selecionar visíveis (100)   ☐ Selecionar todas (243)                  │
│                                                                          │
│  📌 80 selecionadas · Total R$ 12.300,00                                 │
│  Aplicar em todas:                                                       │
│    Categoria: [Receita de Vendas Pizza ▾]                                │
│    Quem (opcional): [______________________________]                     │
│    ☑ Criar regra "PIX RECEBIDO MAQUININHA" → Receita Vendas              │
│                                                                          │
│  [Categorizar 80 linhas em lote]                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

**Fluxo pizzaria (80 PIX/dia):**
1. Abre "Conciliar em lote"
2. Filtra "Só recebimentos"
3. Ordena por descrição → todos PIX MAQUININHA juntos
4. Seleciona todas (1 click)
5. Categoria = "Receita de Vendas Pizza"
6. ☑ Criar regra (próximo dia, 80 PIX já vêm categorizados automaticamente no import)
7. Clica "Categorizar 80 linhas" — 3 cliques resolve.

### 2.6 Aba "Já Conciliado"

Mesma da Fase 1, sem mudança. Continua com Desfazer + busca.

### 2.7 Banner topo refresKey

Mesmo da Fase 2-fix — atualiza ao vivo conforme casa/cria/ignora.

---

## 3. Como resolve os 3 problemas

| Problema | Como a tela nova resolve |
|---|---|
| **1. Recebimento não fecha pro varejo** | Seletor "Só Pagamentos" default + ação CRIAR inline (sem cliente) + Conciliar em lote (cash coding) |
| **2. Aba Revisar confusa** | Card 2 colunas EXPLÍCITAS ("EXTRATO (banco)" / "CONTA A PAGAR (sistema)") com **valores em destaque nos 2 lados** + ✓ "bate exato" / ⚠️ "diff 5%" inline |
| **3. Só botão Conciliar** | 4 tabs por linha: CASAR / CRIAR / TRANSFERIR / IGNORAR + "Trocar candidato" dentro de CASAR + "Deixar pra depois" = simplesmente não clicar |

---

## 4. Como funciona o fluxo da pizzaria

### Manhã (8h-10h): Yussef abre conciliação

1. **Banner topo:** "Saldo com diferença de R$ 18.500,00 · 24 OFX sem categoria + 8 prováveis duplicatas"
2. Vai pra **Conciliar em lote** (porque hoje chegaram 80 vendas PIX)
3. Filtra "Só recebimentos" + ordena por descrição
4. Seleciona todos os 80 PIX MAQUININHA → Categoria "Receita Vendas" + ☑ criar regra
5. Clica "Categorizar 80" → 3 cliques, 80 OFX viram receita categorizada
6. **Banner atualiza ao vivo:** saldo diferença caiu pra R$ 6.000

### Tarde (14h-15h): pagamentos a fornecedores

7. Volta pra aba **Conciliar**
8. Seletor agora em "Só Pagamentos" (esconde recebimentos já tratados)
9. Vê 12 OFX DEBIT pendentes — 8 com sugestão CASAR (score 85+ porque AP Excel existe), 4 sem candidato
10. Clica "Casar este par" nos 8 — DRE cai a duplicação dos fornecedores
11. Nos 4 sem candidato (taxa banco, transferência, recebimento devolução), usa CRIAR / TRANSFERIR / IGNORAR
12. **Banner zerado:** "Saldo bate ✓"

**Tempo total:** ~10 minutos pra fechar o dia. Hoje seria 1-2 horas + erros.

---

## 5. Componentes — reuso máximo, criação mínima

### 5.1 Mantém intactos (já em prod)
- `BalanceBanner` (Fase 1 + refreshKey da Fase 2-fix)
- `HistoricoTable` + endpoint `/api/conciliacao/historico` (Fase 1)
- `lib/conciliacao/find-candidates` (Sprint A — ramo 1 + ramo 2)
- `lib/conciliacao/match` + `normalize-for-match` (Sprint A)
- `lib/conciliacao/reconcile` (Sprint A-effected — CLASSIC + ORPHAN modes)
- `POST /api/conciliacao/confirmar` (CASAR usa esse)
- `POST /api/conciliacao/bulk-confirmar` (Conciliar em lote pra CASAR multi)
- `POST /api/conciliacao/desfazer/[id]` (undo da aba Já Conciliado)
- `GET /api/conciliacao/balance-check` (banner)
- `GET /api/conciliacao/historico` (aba Já Conciliado)
- `lib/ai-categorizer/*` (sugestão de categoria no CRIAR)
- `ai_learning_rules` (regra aprendida)
- `lib/transfers/*` (Sprint 0.5 — TRANSFERIR reusa)

### 5.2 Refatorar (mudança parcial)
- `app/(dashboard)/conciliacao/page.tsx` — reorganiza Tabs (3 abas em vez de 4)
- `components/conciliacao/confidence-list.tsx` — VIRA `row-actions.tsx` com 4 tabs por linha
- `GET /api/conciliacao/ofx-pendentes` (Fase 2-fix) — aceita param `tipo=apenas-pagamentos|apenas-recebimentos|todos`
- `GET /api/conciliacao/bulk-dry-run` — aceita param `tipo=` igual

### 5.3 Novos endpoints
- `POST /api/conciliacao/cash-code` — body `{ ofxTransactionId, categoryId, supplierId?, customerId?, notas?, criarRegra? }` — categoriza OFX direto + opcional cria ai_learning_rule. **Sem precisar de candidato AP**.
- `POST /api/conciliacao/cash-code-bulk` — body `{ ofxIds: string[], categoryId, supplierId?, criarRegra? }` — N OFX com mesma categoria. Atomic em loop (cada uma é independente como bulk-confirmar).
- `POST /api/conciliacao/ignorar/[id]` — body `{ motivo, naoIncomodarMais? }` — status='IGNORED' + ignoredReason + opcional ai_learning_rule de IGNORE pra padrão semelhante.
- `POST /api/conciliacao/marcar-transferencia/[id]` — chama lib/transfers/from-ofx existente (já temos!)

### 5.4 Componentes novos
- `RowActions.tsx` — 4 tabs (CASAR / CRIAR / TRANSFERIR / IGNORAR) com card 2 colunas dentro de CASAR
- `CashCodingGrid.tsx` — grid bulk com checkbox + dropdown categoria + apply-rule
- `IgnoreReasonModal.tsx` — pequeno modal pra motivo de ignorar
- `TipoSelector.tsx` — header dropdown "Só Pagamentos / Só Recebimentos / Todos"

---

## 6. Schema — precisa mexer?

### ⚠️ ALTERs em dados reais — proposta MÍNIMA

| Tabela | Operação | Linhas afetadas | Risco | Mitigação |
|---|---|---|---|---|
| `transactions` | `+ignoredAt DateTime?` | 0 imediato (preenche on-demand quando user clica IGNORAR) | **Zero** — nullable c/ default null | Backup antes |
| `transactions` | `+ignoredReason String?` | 0 imediato | Zero | Backup antes |
| `transactions` | `+ignoredByUserId String?` | 0 imediato | Zero | Backup antes |
| `transactions` | `+cashCoded Boolean @default(false)` | 0 imediato (set true quando user usa CRIAR) | Zero — default false | Backup antes |
| `transactions` | `+cashCodedAt DateTime?` | 0 imediato | Zero | Backup antes |

**5 colunas aditivas. Todas nullable ou com default. Zero linha existente alterada na migration.** Pure additive — passa na regra "Migrations em tabelas com dados reais".

**Vale criar `match_rejections`** (Fase 4 já tinha mapeado)? Atrasamos pra depois. Por enquanto IGNORAR usa as colunas de cima.

### Por que essas colunas?
- `ignoredAt/ignoredReason/ignoredByUserId` — aba Já Conciliado pode ter sub-section "Ignorados" + auditoria
- `cashCoded/cashCodedAt` — distingue "EFFECTED conciliada via match" de "EFFECTED categorizada via CRIAR" pra relatórios. Não obriga — pode juntar tudo via `status='RECONCILED'`, mas separar dá clareza.

---

## 7. Plano de execução em 4 fases

### Fase A — Seletor de tipo + filtro recebimento (1 dia)
- Param `tipo=` nos endpoints `ofx-pendentes` e `bulk-dry-run`
- Componente TipoSelector no header
- Default "Só Pagamentos" pra empresas tipo varejo (heurística: `companyType=restaurant|retail`)
- **Marco:** Yussef abre Cacula → vê só DEBIT na lista → para de ser incomodado por CREDIT sem candidato

### Fase B — 4 ações por linha (CASAR/CRIAR/TRANSFERIR/IGNORAR) (3-4 dias)
- Migration aditiva (5 colunas em transactions)
- `RowActions.tsx` — substitui ConfidenceList
- Endpoint `cash-code` (CRIAR) + `ignorar` (IGNORAR)
- TRANSFERIR reusa fluxo Sprint 0.5
- "Trocar candidato" dentro de CASAR
- **Marco:** Yussef tem 4 opções por linha. Caso B (CRIAR direto sem cliente) funciona.

### Fase C — Conciliar em lote (cash coding) (3 dias)
- `CashCodingGrid.tsx` — grid 100 linhas/página
- Endpoint `cash-code-bulk`
- Multi-select + apply-rule
- Sort por descrição
- **Marco:** Pizzaria fecha 80 PIX em 3 cliques. KILLER feature.

### Fase D — Polimento + IA de sugestão (1-2 dias)
- Quando user abre CRIAR, IA sugere categoria via `ai_learning_rules` ou Claude Haiku
- Bug fixes diversos
- Validação com Yussef em fluxo real (pizzaria + outras empresas)

**Total estimado: 8-10 dias.**

---

## 8. Decisões pendentes (Yussef aprova antes da Fase A)

1. **Aprovar 4 fases A→B→C→D nessa ordem** ou mudar?
2. **Default "Só Pagamentos" pra que tipos de empresa?**
   - `restaurant` (Cacula) — sim
   - `retail` — sim
   - `service` (academia) — talvez (já planejamento "Receita Mensalidade" pode ser AR cadastrada)
   - `industry` — não
3. **Bulk de cash coding aplica até 200 linhas por vez** OK ou prefere 100 mais conservador?
4. **Aba "Conciliar em lote"** fica como aba paralela ou dentro de "Conciliar" via toggle?
   - Recomendado: aba paralela (Xero faz assim, fica visualmente claro modo bulk vs individual)
5. **Quando user clica IGNORAR + "não incomodar mais"** — cria regra em `ai_learning_rules` tipo `pattern → IGNORE`? Ou só marca a tx individual?
   - Recomendado: opção do user (checkbox). Se marcar, futuras OFX com mesmo prefixo ignoram automático.
6. **CRIAR sem categoria** — bloquear ou permitir?
   - Recomendado: bloquear (forçar categoria preenchida). Senão DRE não classifica e Yussef perde controle.
7. **Mantém as 3 abas confidence (Alta/Revisar/Sem match) ou consolida em 1 "Conciliar"?**
   - Recomendado: consolida em 1 — cor do botão CASAR já indica confiança. Menos cliques pra trocar de aba.

---

## 9. O que sai vs entra (comparado à Fase 2 atual)

### Mantém (estável em prod)
- BalanceBanner topo (com refreshKey)
- HistoricoTable + Desfazer
- Filtros de período
- Engine matcher Sprint A
- `reconcileTransactions` modos CLASSIC + ORPHAN
- Endpoint bulk-dry-run, bulk-confirmar, confirmar, desfazer, ofx-pendentes, historico, balance-check

### Substitui
- 4 abas (Alta/Revisar/Sem match/Conciliado) → **3 abas** (Conciliar / Em lote / Conciliado)
- ConfidenceList → **RowActions** (4 tabs por linha)
- Sem filtro de tipo → **TipoSelector** (Só Pag / Só Receb / Todos)

### Adiciona
- 5 colunas aditivas em `transactions`
- 4 endpoints novos (`cash-code`, `cash-code-bulk`, `ignorar`, `marcar-transferencia`)
- 4 componentes novos (RowActions, CashCodingGrid, IgnoreReasonModal, TipoSelector)
- ✨ Cash coding em lote = killer feature pro varejo

---

## 10. Riscos + mitigações

| Risco | Mitigação |
|---|---|
| Cash coding aplicado em massa categoriza errado N tx | Modal de preview "80 tx, total R$ 12.300, categoria Y" + cancel/confirm. Desfazer por linha individual mantido. |
| IGNORAR + "não me incomodar mais" cria regra ruim que esconde tx importante futura | UI mostra "X regras de ignorar ativas" em settings, fácil revisar/desativar. Lista filtrável. |
| User esquece de selecionar categoria no CRIAR | Bloquear botão até categoria preenchida + tooltip explicando. |
| "Trocar candidato" abre lista enorme | Limitar top 10 por score + busca por descrição. |
| Migration 5 colunas em `transactions` quebra index | Todas nullable, sem ALTER de tipo. Risco real zero. Backup antes da migration assim mesmo. |

---

## 11. Validação visual antes de construir

Quando aprovar este mockup:
1. Faço HTML estático/Figma das 3 telas-chave (Conciliar com CASAR, Conciliar com CRIAR, Conciliar em lote)
2. Você revisa no browser (mockup mock — sem backend) — só pra confirmar UX
3. **Depois disso** começo a Fase A

---

## Apêndice — Comparação Antes × Depois (PIZZARIA)

### ANTES (Fase 2 atual)
- Yussef abre conciliação
- Aba "🟡 Revisar (15)": 9 fornecedores certos + 5 falsos positivos + 1 duvidoso
- Aba "⚪ Sem match (240)": 80 PIX recebidos sem candidato (porque AR não existe) + tx legítimas sem par
- Aba "🟢 Alta (0)" vazia
- Cliques: ~50-100 individuais. Falsos positivos voltam todo dia.
- Recebimentos: precisaria entrar TX a TX manualmente em `/transacoes` cadastrando customer fake.

### DEPOIS (Mockup reformulado)
- Yussef abre conciliação. **Default "Só Pagamentos"** — vê só 12 OFX DEBIT
- 9 com tab CASAR ★ (score ≥80): clica 9× "Casar este par" → 9 conciliadas
- 3 sem candidato: CRIAR direto (categoria) ou TRANSFERIR ou IGNORAR
- Troca pra "Conciliar em lote" + "Só Recebimentos"
- Ordena por descrição → 80 PIX MAQUININHA visíveis
- Seleciona todos + Categoria "Receita Vendas" + ☑ criar regra → **1 clique categoriza 80**
- Banner topo: "Saldo bate ✓"
- **Tempo total:** 5-8 minutos.

---

**Próximo passo:** você revisa, aprova as 7 decisões da seção 8, e a gente começa pela Fase A (seletor de tipo — 1 dia). Cada fase termina com smoke em prod antes da próxima.
