# Conciliação Bancária — Tela nível líder (Conta Azul + diferenciais Conta IA)

**Data:** 03/06/2026
**Tipo:** Proposta visual + plano de execução (SEM código ainda — espera aprovação)
**Pré-requisitos:** ✅ Sprint A deployada + Sprint A-fix deployada (matcher funciona, endpoint enriquece, UI mostra 3 candidatos pra Nestle com score 85 CONFIRM)
**Documento irmão:** `docs/sprints/conciliacao-matching.md` (investigação + Sprint A-D)

---

## 🎯 Resumo executivo

**Hoje:** tela atual `/conciliacao` é um esqueleto — 2 colunas pobres (extrato + "candidatos"), sem filtros fortes, sem indicador de saldo, sem aba conciliado, sem bulk, score escondido em badge. Funciona como POC.

**O que vamos fazer:** redesenhar 100% pra ficar **nível Conta Azul + Botkeeper + 3 diferenciais que ninguém faz** (bulk approve só de alta confiança, normalização IA dos nomes, conciliação preditiva no preview do import). Mantém o engine da Sprint A (`find-candidates` relaxado, `normalize-for-match`, `scoreMatch`) — só envelopa em UI de outra liga.

**Princípio:** o trabalho diário de conciliação não pode ser clicar 1 a 1. **O comum (97% match) some sozinho via bulk approve. O incomum (3% borderline) vai pra revisão humana.** Conta Azul não faz isso. QuickBooks também não. Conta IA faz.

---

## 📌 Pendência registrada (03/06/2026)

**Gap residual na Cacula Mix após Fase 1:**
- Diferença saldo sistema vs banco = R$ 40.065,95
- Duplicatas identificadas pela heurística = **22 contas somando R$ 30.040,49**
- **Resto não explicado = ~R$ 10.025,46**

**Hipóteses pro resto (investigar pós-desdup):**
1. Tx OFX sem par Excel/Manual cadastrado (saída de caixa que Yussef não lançou no sistema antes do OFX chegar)
2. Saldo inicial não importado (OFX começa a contar do 1º import, mas o banco já tinha histórico)
3. Receitas duplicadas (heurística atual foca despesas via DEBIT-vs-DEBIT)
4. Transferências entre contas não pareadas (Sprint 0.5 cobriu mas pode ter casos legados)

**Decisão:** desduplica primeiro as 22 conhecidas (Fase 2). Depois investiga os ~R$ 10k restantes (provavelmente vira Sprint A-effected.fase-1-fix ou direto no escopo da Fase 3+4).

---

## 💡 Melhorias futuras anotadas (03/06/2026 — dry-run das 22 da Cacula revelou)

### 1. Vendor enrichment → bulk approve viável
**Problema atual:** dos 16 pares ≥70 no dry-run da Cacula, 10 são claramente certos (Nestle/Ambev style: mesmo dia, valor exato, descrição quase idêntica), mas nenhum atinge ≥90 porque o **supplier match (15pts)** sempre dá 0 — os fornecedores PJ da Cacula não têm registro em `suppliers` linkado nas tx Excel.

**Solução:** cadastrar suppliers (CNPJ + razaoSocial) e linkar `transactions.supplierId` em massa. Pipeline F3.4.3 (BrasilAPI lookup por CNPJ) já existe — basta integrar no import Excel ou rodar batch.

**Impacto esperado:** 10 pares óbvios saltariam de score 85 → 100 → entram em "🟢 Alta confiança" → **bulk approve funciona** → 1 click resolve tudo.

**Esforço:** ~1 dia. Pode ser Sprint dedicada "Vendor enrichment" ou parte da Fase 4.

### 2. Threshold de Alta Confiança descer pra ≥85
**Hoje:** AUTO_RECONCILE ≥90, CONFIRM 70-89.
**Hipótese:** após Yussef conciliar manualmente N casos de score 85 (Nestle-style) e confirmar zero falsos positivos, sobe threshold pra ≥85 → bulk approve funciona pra "match perfeito sem supplier_id".

**Pré-requisito:** validação histórica empírica (zero falsos positivos em N=10+ conciliações score 85).

**Risco:** com 85 vira default, casos limítrofes (D±1d, descrição diferente) entrariam no bulk e gerariam falsos positivos como DIVINE/TURATTI do dry-run da Cacula. Precisa cuidado.

**Recomendado:** manter ≥90 enquanto Vendor enrichment (#1) não estiver pronto. Vendor enrichment + threshold 90 dá segurança e bulk.

### 3. Fase 4 — Marcar par como "não é match"
**Caso real:** dos 16 pares ≥70 da Cacula, 5 são **falsos positivos** (nomes diferentes, só compartilham valor próximo: DIVINE↔TURATTI, ECO VERDE↔PREFEITURA, FERNANDA↔CIA DA FRUTA, 2× PODAL com valor 5% diferente). Hoje esses pares ficam permanentemente na aba "🟡 Revisar" — Yussef ignora visualmente mas eles voltam toda vez que ele abre a tela.

**Solução proposta:** nova tabela `match_rejections (ofxId, candidateId, reason, rejectedAt, rejectedBy)`. UI ganha botão "Não é match" no card de Revisar → grava rejeição. `find-candidates` filtra rejeitados (NOT EXISTS) → aquele par específico nunca mais aparece como sugestão.

**Aba "Ignorado" da Fase 4** ganha listagem das rejeições com botão "Reverter" pra desfazer.

**Esforço:** ~3-4h (1 migration aditiva + endpoints CRUD + UI).

---

## 0. Estado atual (auditoria visual)

### 0.1 Tela `/conciliacao` hoje
- Grid 2 colunas `lg:grid-cols-2`
- Esquerda: lista vertical de tx OFX (descrição + data + banco + valor sinalizado)
- Direita: lista vertical de `<MatchCard>` (existente em `components/conciliacao/match-card.tsx`)
- Header simples: título + qtd. tx OFX
- Sem filtro de período. Sem busca. Sem aba. Sem stats. Sem bulk.

### 0.2 `<MatchCard>` hoje (boa base — vamos reusar)
- 2 lados side-by-side (OFX × Candidato) com ArrowRight no meio
- Score badge colorido (≥90 verde, ≥70 amarelo, <70 cinza)
- Recommendation badge (AUTO_RECONCILE / CONFIRM)
- Pills de "razões" (Valor exato, Mesmo dia, etc)
- Checkbox por card + botão "Conciliar" no rodapé da página
- **O card está bom, é a página em volta que precisa virar profissional.**

### 0.3 Engine de match (Sprint A)
- `findReconciliationCandidates`: 2 ramos (PAYABLE pendente + EFFECTED órfão Excel/Manual)
- `scoreMatch`: 0-100 = valor 50 + data 30 + supplier 15 + descrição 10 (normalizada via `normalizeForMatch`)
- `classifyRecommendation`: ≥90 AUTO, 70-89 CONFIRM, <70 NO_MATCH
- `/api/conciliacao/match`: response embarca candidate metadata (Sprint A-fix)

**Tudo isso continua. A tela nova é UI em cima.**

---

## 1. Benchmark consolidado

| Recurso | Conta Azul | QuickBooks | Botkeeper | **Conta IA novo** |
|---|---|---|---|---|
| Layout principal | 2 col + agrupamento por data | Inline na linha do extrato | Tabela única com colunas | 2 col + abas + filtros |
| Tolerância | ±5d / ±7% (fixo) | 90d antes / 20d depois | Configurável | ±5d / ±20% (default) + configurável por conta |
| Match auto | sim, sugere par | sim, "1 record found" verde | sim, 3 níveis confidence | sim, 3 abas de confiança |
| **Bulk approve** | ❌ não tem | ❌ não tem | ✅ "Mark Reviewed" lote | ✅ "Aprovar 24 alta-confiança" |
| **Indicador de saldo** | ✅ linha amarela na data | parcial (resumo banco) | não | ✅ banner no topo + linha amarela na data |
| Aba "Já conciliado" | sim (mesma tela) | sim (In QuickBooks) | sim | sim — separada + histórico paginado + filtros |
| **Undo** | ✅ 3 modos | ✅ Undo | ✅ Mark Reviewed undo | ✅ 3 modos (copia Conta Azul) |
| Many-to-one (PIX consolidado) | sim | sim | sim | sim |
| Aba "Ignorados" | sim | sim | sim | sim |
| **Normalização IA de nomes** | ❌ favorecido literal | ❌ | ✅ NLP descrição | ✅ `normalizeForMatch` + Claude boost |
| **Match preditivo no import** | ❌ | ❌ | ❌ | ✅ Sprint D (`docs/sprints/conciliacao-matching.md`) |
| Detecção de duplicatas | ❌ explícita | ❌ | parcial | ✅ banner "R$ X em duplicatas detectadas" |

**O que dá pra ROUBAR:**
- Layout 2 colunas + agrupamento por data (Conta Azul)
- Inline match com caixa colorida (QuickBooks)
- 3 níveis de confiança + bulk (Botkeeper)
- 3 modos de undo (Conta Azul)

**O que dá pra GANHAR:**
- Bulk approve só de alta confiança (CTA primário no topo)
- Banner global "R$ X em duplicatas detectadas" (preditivo no Dashboard também)
- Normalização IA + supplier por CNAE/CNPJ (já temos pipeline F3/F4)
- Match preditivo durante o preview do OFX (Sprint D)

---

## 2. Mockup completo

### 2.1 Header global (sempre visível)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Conciliação Bancária · CACULA MIX                       [Trocar empresa ▾]   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  💰 Banrisul PJ · maio/2026  [▾]                                             │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │ ⚠️  Saldo com diferença de R$ 30.565,65                              │    │
│  │     Saldo sistema: R$ 12.450,30  ·  Saldo banco: R$ 43.015,95        │    │
│  │     Causa provável: 24 prováveis duplicatas + 8 lançamentos sem par. │    │
│  │     [Conciliar em massa →]  [Ver ajustes de saldo →]                 │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Filtros: Período [▾]  Tipo [▾]  Busca [_______________]  Status [▾]         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Notas:**
- O banner amarelo é o **diferencial Conta Azul ampliado** — em vez de só uma linha amarela embedded por data, é um banner no topo que resume TUDO. Inline por data continua existindo no body (item 2.3).
- "Saldo sistema" = soma OFX EFFECTED + reconciliada (via reconciledWithId), seguindo o filtro Sprint 4.0.2.
- "Saldo banco" = saldo bruto OFX (último balance OFX importado).
- Diferença = sistema − banco. Negativa em amarelo, alta em vermelho, zero em verde.
- "Causa provável" usa a heurística da Sprint A/B (24 duplicatas + lançamentos sem par detectados pelo matcher).

### 2.2 Filtros (linha sob banner)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Período: [Maio/2026 ▾]   Tipo: [Todos ▾]   Conta: [Banrisul PJ ▾]        │
│ Busca:   [Nestle______]  Status: [Pendente ▾]  Valor: [_de_]–[_até_]    │
│ □ Mostrar só prováveis duplicatas                            [Limpar]    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Padrão:**
- Período = mês corrente
- Status pendente (não conciliada) por default — aba "Pendente"
- Busca = casa em description OR supplierName (normalizada via `normalizeForMatch` server-side, mesmo do matcher!)
- "Prováveis duplicatas" = pre-filtro: só tx OFX que têm pelo menos 1 candidato com score ≥ 70

### 2.3 Corpo principal — 4 ABAS

```
┌──[🟢 Alta confiança (24) ]──[🟡 Revisar (8)]──[⚪ Sem match (3)]──[✓ Conciliado (247)]──[⊘ Ignorado (12)]──┐
│                                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 📅 03/06/2026  ──  Saldo dia: bate ✓                                                               │  │
│  ├────────────────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                                                    │  │
│  │  ☐ NESTLE BRASIL LTDA - Pagamento     − R$ 105,86   [Score 98 ★] AUTO_RECONCILE  [Conciliar →]    │  │
│  │       ↳ Match: "Nestle Brasil Ltda" (AP Excel, R$ 105,86, vence 03/06)                            │  │
│  │       💡 Método: valor exato + mesmo dia + nome normalizado IA                                    │  │
│  │  ─────────────────────────────────────────────────────────────────────────────────────────         │  │
│  │  ☐ AMBEV - Pagamento                  − R$ 1.245,00 [Score 94 ★] AUTO_RECONCILE  [Conciliar →]    │  │
│  │       ↳ Match: "AMBEV S.A." (AP Excel, R$ 1.245,00, vence 02/06)                                   │  │
│  │       💡 Método: valor exato + D±1 + supplier por CNPJ + nome normalizado                         │  │
│  │  ─────────────────────────────────────────────────────────────────────────────────────────         │  │
│  │  ☐ PIX CONSOLIDADO R$ 25.000,00       − R$ 25.000   [Score 92 ★] AUTO_RECONCILE  [Editar split ▾] │  │
│  │       ↳ Match many-to-one com 3 AP:                                                                │  │
│  │           ▪ Nestle Brasil Ltda     R$ 105,86                                                       │  │
│  │           ▪ AMBEV S.A.             R$ 1.245,00                                                     │  │
│  │           ▪ Coca-Cola FEMSA       R$ 23.649,14                                                     │  │
│  │           ──────────────────────────                                                               │  │
│  │           Total                    R$ 25.000,00 ✓ (bate exato)                                     │  │
│  │       💡 Método: soma exata + mesmo dia                                                            │  │
│  │                                                                                                    │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 📅 02/06/2026  ──  ⚠️ Saldo dia: diferença R$ 416,19                                               │  │
│  ├────────────────────────────────────────────────────────────────────────────────────────────────────┤  │
│  │  ☐ CIA DA FRUTA COMERCIO − R$ 416,19  [Score 92 ★] AUTO_RECONCILE  [Conciliar →]                   │  │
│  │       ↳ Match: "CIA DA FRUTA COMERCIO DE FRUTAS..." (AP Excel R$ 416,19, vence 01/06)              │  │
│  │       💡 Método: valor exato + D+1 + nome normalizado IA                                           │  │
│  │  ... (mais 20 cards alta confiança)                                                                │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ ☑ Selecionar todas as 24 alta-confiança                                      │
│ [Aprovar 24 selecionadas]  ← CTA primário azul                              │
│ Tolerância de data: [±5 dias ▾]   📊 Mostrar IA boost: ☑                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Aba "🟡 Revisar" (score 70-89)

Mesmo agrupamento por data, mas:
- Card mostra **top 3 candidatos** com radio (não só 1)
- "Por que esses?" expand revela breakdown completo do score
- Sem bulk approve (decisão humana caso a caso é o ponto)
- Botão "Conciliar" individual + "Pular" + "Marcar como sem match"
- Edge: se candidato #1 estourar 90 após user ajustar (ex: corrigir supplier), promove pra aba alta confiança

### 2.5 Aba "⚪ Sem match" (<70 ou zero candidatos)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 📅 03/06/2026                                                              │
├────────────────────────────────────────────────────────────────────────────┤
│ ☐ ARMARINHOS LTDA           − R$ 215,00  Nenhum candidato encontrado       │
│      💡 Sugestão IA: parece "Material de escritório" (categoria sugerida)  │
│      [Criar nova conta a pagar →]  [Lançar como despesa avulsa →]          │
│      [Ignorar (não é da empresa)]                                          │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.6 Aba "✓ Conciliado" (histórico)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Filtros: Período [Maio ▾]  Fornecedor [▾]  Busca [______]                  │
├────────────────────────────────────────────────────────────────────────────┤
│ 📅 03/06/2026                                                              │
│  ✓ Nestle Brasil Ltda × NESTLE BRASIL LTDA - Pagamento  R$ 105,86          │
│     conciliada manualmente · há 2h · por Yussef Musa                       │
│     [Desfazer ▾]                                                           │
│        ↳ Apenas desfazer (volta tx pra "Paga", OFX volta a pendente)       │
│        ↳ Voltar para "Em aberto" (volta tx pra "A pagar")                  │
│        ↳ Excluir lançamento (apaga AP)                                     │
│                                                                            │
│  ✓ AMBEV S.A. × AMBEV - Pagamento                       R$ 1.245,00        │
│     conciliada automaticamente · há 2h · score 94                          │
│     [Desfazer ▾]                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

**Notas:**
- 3 modos de undo copiando Conta Azul (vamos cobrir paridade — eles fazem bonito aqui)
- Mostra quem conciliou (manual) ou score (auto)
- Filtros mais fortes que Conta Azul (eles agrupam só por data)

### 2.7 Aba "⊘ Ignorado" (tx fora do extrato ou marcadas como "não conta")

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ⊘ DEVOLUÇÃO PIX FRAUDE      + R$ 100,00  ignorada manualmente · há 4d      │
│    motivo: "tentativa de golpe estornada"                                  │
│    [Re-ativar (volta pra pendente)]                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Especificações dos diferenciais

### 3.1 Bulk approve (CTA primário)

**Regra:** botão "Aprovar N selecionadas" SÓ aparece na aba "🟢 Alta confiança" (score ≥ 90). Outras abas não têm bulk (decisão humana).

**Comportamento:**
1. Default: todos os 24 vêm pré-selecionados (checkbox ☑)
2. User pode desmarcar individualmente os que não confia
3. Clique no CTA → POST `/api/conciliacao/bulk-confirmar` (endpoint já existe — Sprint 4.0.2)
4. Loading state + progress ("Conciliando 18/24...")
5. Sucesso: toast "24 conciliações criadas. Saldo agora bate (diferença R$ 0,00)" + redireciona pra aba "Conciliado"
6. Falha parcial: mostra quais falharam + permite retry

**Audit log:** 1 entrada por conciliação (rastreabilidade total).

### 3.2 Indicador de saldo no topo

**Cálculo (server-side, cache 30s):**
```
saldoBanco   = bank_accounts.balance (último OFX importado já atualizou)
saldoSistema = sum(transactions WHERE companyId AND lifecycle='EFFECTED' AND reconciledWithId IS NULL)
diferenca    = saldoSistema − saldoBanco
```

**Cores:**
- |diferenca| < R$ 1 → verde "Saldo bate ✓"
- R$ 1 ≤ |diferenca| ≤ R$ 100 → cinza (margem aceitável de arredondamento)
- R$ 100 < |diferenca| ≤ R$ 10.000 → amarelo
- |diferenca| > R$ 10.000 → vermelho

**Endpoint novo:** `GET /api/conciliacao/balance-check?bankAccountId=…` retorna `{ saldoSistema, saldoBanco, diferenca, causasProvaveis: ["24 duplicatas", "8 sem par"] }`.

### 3.3 Linha amarela por dia (Conta Azul style)

```
📅 02/06/2026  ──  ⚠️ Saldo dia: diferença R$ 416,19
```

**Quando aparece:** o saldo do dia (sum de tx OFX desse dia − sum de tx sistema desse dia) é > R$ 100 absoluto. Discreto inline, complementa o banner global.

**Click expande:** detalhe das tx OFX vs tx sistema lado a lado naquele dia, com ações inline (criar AP, ignorar OFX, ajustar manual).

### 3.4 Match many-to-one (PIX consolidado)

**Caso real Cacula:** 1 PIX de R$ 25.000 sai do banco. Esse PIX paga 3 boletos. O matcher precisa achar combinações:
```
target = 25.000
candidatos = [Nestle 105.86, AMBEV 1245, Coca 23649.14]
sum(candidatos) = 25.000 ✓ → match many-to-one
```

**Algoritmo:**
- Após `findReconciliationCandidates`, se o top candidato single tem score < 90 E há ≥3 candidatos do mesmo dia ±1, tentar combinações 2-of-N e 3-of-N que somam ±R$ 0,01 do valor da OFX.
- Implementação MVP: brute-force combinações até 4 candidatos (4 * findCandidates loop). 5+ é improvável e fica pra Sprint futura.
- UI mostra "many-to-one com X AP" + lista expandida + soma exata destacada.
- Reconcile: 1 OFX vira `reconciledWithId` no campo de TODOS os N AP (precisa schema change? NÃO — `reconciledWithId UNIQUE` no AP, então é o AP que aponta pro OFX. 3 AP apontando pro mesmo OFX já funciona com schema atual).

### 3.5 Match preditivo no preview do OFX (Sprint D)

Quando user clica "Importar OFX" e o preview mostra as 47 tx detectadas, mostrar também: **"💡 De 47 transações, 31 já têm match com AP existente — você pode importar + conciliar de uma vez"**. Marca checkbox "Conciliar automaticamente no import" → durante o import, rodar matcher e já criar os links pra score ≥ 90.

### 3.6 Banner "R$ X em duplicatas detectadas" no Dashboard

Não é da tela de Conciliação — vai no Dashboard `/dashboard`. Quando heurística detecta duplicação no DRE (mesma lógica do `conciliacao-matching.md` PARTE A.1), aparece um banner amarelo no topo do Dashboard:

```
⚠️ Detectamos R$ 30.565 em prováveis duplicatas no DRE de maio.
   Conciliar agora →
```

Click leva pra `/conciliacao?empresaId=…&filter=duplicatas`.

---

## 4. Componentes que vão ser construídos

### 4.1 Reuso (sem mexer)
- `lib/conciliacao/find-candidates.ts` (Sprint A)
- `lib/conciliacao/match.ts` (Sprint A)
- `lib/conciliacao/normalize-for-match.ts` (Sprint A)
- `lib/conciliacao/jaro-winkler.ts`
- `lib/conciliacao/claude-judge.ts` (boost semântico)
- `lib/conciliacao/reconcile.ts` (efetiva 1 par)
- `components/conciliacao/match-card.tsx` (refactor leve pra slot dentro do dia)
- Endpoints: `/api/conciliacao/match`, `/api/conciliacao/confirmar`, `/api/conciliacao/bulk-confirmar`, `/api/conciliacao/scan-by-import`

### 4.2 Novos componentes (app/(dashboard)/conciliacao/_components/)
- `BalanceBanner.tsx` — banner amarelo/vermelho/verde do saldo
- `FilterBar.tsx` — filtros período/tipo/conta/busca/valor/status/duplicatas
- `ConfidenceTabs.tsx` — 5 abas (Alta / Revisar / Sem match / Conciliado / Ignorado)
- `DayGroup.tsx` — agrupador por data + saldo dia inline
- `BulkApproveBar.tsx` — sticky bottom com seleção + CTA + tolerância configurável
- `ManyToOneCard.tsx` — variant do MatchCard pra many-to-one
- `UndoMenu.tsx` — dropdown com 3 modos de undo (paridade Conta Azul)
- `EmptyCandidateCard.tsx` — sem match + sugestão IA de categoria + 3 CTAs
- `IgnoreReasonModal.tsx` — modal pra capturar motivo da exclusão

### 4.3 Novos endpoints
- `GET /api/conciliacao/balance-check?bankAccountId=` → saldo sistema vs banco
- `GET /api/conciliacao/list?empresaId=&tab=&filters=` → lista paginada agrupada por dia
- `POST /api/conciliacao/many-to-one/find?ofxTransactionId=` → busca combinações 2-of-N, 3-of-N
- `POST /api/conciliacao/many-to-one/confirmar` → cria N links
- `POST /api/conciliacao/ignorar` → marca tx como ignorada com motivo
- `POST /api/conciliacao/desfazer` → 3 modos (LINK_ONLY / VOLTAR_ABERTO / EXCLUIR_AP)
- `GET /api/conciliacao/historico` → lista paginada da aba conciliado

---

## 5. Schema — precisa mexer?

### 5.1 Aditivos sugeridos (todos opcionais — tabelas com dados reais)

| Tabela | Coluna | Tipo | Razão | Risco |
|---|---|---|---|---|
| `bank_accounts` | `reconcileToleranceDays Int? @default(5)` | ADD COLUMN nullable c/ default | UI configurável de tolerância. Default 5 (Conta Azul). Sprint A já discutiu | **Zero** — coluna nova c/ default |
| `transactions` | `ignoredAt DateTime?` + `ignoredReason String?` + `ignoredByUserId String?` | ADD COLUMN nullable | Aba "Ignorado" + audit | Zero — colunas novas opcionais |
| `transactions` | `reconciledViaScore Int?` | ADD COLUMN nullable | Audit: registra com que score foi auto-conciliada (Sprint 5 IA learning) | Zero |

Total: 1 migration aditiva. Nenhum dado real alterado. Compatível com versão antiga.

### 5.2 ⚠️ ALTERs em tabela com DADOS REAIS

| Tabela | Operação | Linhas afetadas | Risco | Mitigação |
|---|---|---|---|---|
| `bank_accounts` | `+reconcileToleranceDays Int? @default(5)` | 26 contas reais (5 prod + sandbox) | **Zero** — nullable c/ default, contas existentes recebem 5 automaticamente | Backup ANTES (regra padrão) |
| `transactions` | `+ignoredAt, +ignoredReason, +ignoredByUserId, +reconciledViaScore` | 3014 tx reais — TODAS recebem NULL | **Zero** — colunas novas nullable | Backup ANTES |

Nada de UPDATE em massa. Nada de DROP. Migration 100% aditiva pura.

---

## 6. Plano de execução (4 fases — você aprova entre cada)

### Fase 1 — Indicador de saldo + filtros (2 dias)
- BalanceBanner + endpoint `/balance-check`
- FilterBar funcional (período + tipo + busca + duplicatas)
- Sem mudar layout principal ainda — só envelopa a tela atual com header + filtros
- **Marco:** Yussef abre conciliação e bate olho na diferença de saldo + filtra por período.

### Fase 2 — 4 abas + bulk approve (2-3 dias)
- ConfidenceTabs (Alta / Revisar / Sem match / Conciliado / Ignorado)
- BulkApproveBar sticky
- DayGroup agrupando por data + saldo dia inline
- Endpoint `/conciliacao/list` paginado
- **Marco:** Yussef pode clicar "Aprovar 24" e conciliar tudo de uma vez. Saldo deve bater depois.

### Fase 3 — Many-to-one + undo 3 modos (2 dias)
- ManyToOneCard + endpoint `/many-to-one/find` + `/many-to-one/confirmar`
- UndoMenu na aba conciliado
- Endpoint `/conciliacao/desfazer` com 3 variantes
- **Marco:** PIX consolidado vira 3 conciliações em 1 click. Yussef pode desfazer com 3 modos diferentes.

### Fase 4 — Aba Ignorado + match preditivo + banner Dashboard (1-2 dias)
- IgnoreReasonModal + endpoint `/ignorar`
- Aba Ignorado completa
- Match preditivo no preview de import OFX (Sprint D — coordenar com pipeline F3/F4)
- Banner duplicação no Dashboard
- **Marco:** Sprint 100% entregue. Conciliação vira side-effect do import.

**Total estimado: 7-9 dias.**

---

## 7. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Bulk approve concilia errado em massa → desfazer 24 vezes é dor | Só ≥90 vem pré-selecionado. User pode desmarcar. Toast confirma X conciliações. Undo 3 modos disponível. |
| Many-to-one brute-force explode (10+ candidatos) | Cap em 4 candidatos. Timeout 2s server-side. Se passar, mostra "Muitas combinações — escolha manualmente" |
| Indicador de saldo cacheado pode atrasar | Cache 30s. Invalidar em mutations (conciliar, ignorar, desfazer) via tag `bank-balance:${bankAccountId}`. |
| Aba "Conciliado" com 247 itens carrega lento | Paginação 25/página + virtualização (react-window) se ultrapassar 100 visíveis. |
| Mexer no MatchCard quebra tela atual | Refactor incremental: novo wrapper `MatchCardCompact` pra DayGroup, mantém `MatchCard` clássico pra fallback. |

---

## 8. O que NÃO está nessa sprint (futuro)

- **Open Finance integração**: continua congelado (FASE 10 do roadmap)
- **Reconciliação contábil** (DRE × DFC × LALUR): outra frente
- **Importação automática Pluggy diária**: FASE 10
- **Conciliação de cartão de crédito** (faturas vs débito da fatura): Sprint dedicada PF (já temos Fatia 2 do cartão, faltaria integrar conciliação)

---

## 9. Decisões pendentes (Yussef aprova antes da Fase 1)

1. **Aprovar 4 fases nessa ordem** (1 → 2 → 3 → 4) ou priorizar diferente?
2. **Bulk approve só ≥90** (Auto-conciliação) ou também ≥80 com confirmação dupla?
3. **Indicador de saldo no topo** OU **só inline por data** (Conta Azul puro) ou **ambos** (recomendado)?
4. **Many-to-one cap em 4 candidatos** OK ou prefere 3 pra ser conservador?
5. **Aba "Ignorado" obrigatória ou só backlog?** (Conta Azul tem, simplifica suporte; pode ficar pra Fase 4)
6. **Tolerância default ±5 dias** (recomendado, padrão Conta Azul) ou ±15 (matcher atual)?
7. **Conciliação preditiva no import (Fase 4)**: ativar por default ou opt-in checkbox?

---

## 10. Validação visual antes de construir

Quando aprovar o mockup, antes de criar componentes:
1. Fazer 1 wireframe Figma-style (não pintura final — fluxo + densidade)
2. Smoke nas 3 telas mais complexas com dados reais da Cacula em prod
3. Yussef valida em browser pré-build (mockup HTML estático + dados mockados)

---

## Apêndice — Antes/Depois visual

**ANTES (hoje, pós Sprint A-fix):**
```
┌──────────────────────────────────────────────┐
│ Conciliação                                  │
├──────────────────────────────────────────────┤
│ [empresa selecionada]                        │
│                                              │
│ Extrato (lista vertical)  │ Candidatos       │
│  • Nestle 03/06 -105,86   │  Score 85        │
│  • Ambev  02/06 -1245     │  Confirme manual │
│  • ...                    │  [Conciliar]     │
│                                              │
└──────────────────────────────────────────────┘
```

**DEPOIS (Sprint Conciliação 2.0):**
```
┌─────────────────────────────────────────────────────────────────┐
│ Conciliação · CACULA MIX · Banrisul PJ                          │
│ ⚠️ Saldo com diferença R$ 30.565 · [Conciliar em massa →]        │
│ Filtros: Maio ▾  Tipo ▾  [busca______]  ☐ Só duplicatas          │
├─────────────────────────────────────────────────────────────────┤
│ [🟢 Alta(24)] [🟡 Revisar(8)] [⚪ Sem match(3)] [✓ Conciliado(247)] │
├─────────────────────────────────────────────────────────────────┤
│ 📅 03/06 ── Saldo dia: bate ✓                                   │
│  ☑ NESTLE 105,86 ↔ Nestle Brasil Ltda [98 ★ AUTO]               │
│  ☑ AMBEV 1245 ↔ AMBEV S.A. [94 ★ AUTO]                          │
│  ☑ PIX 25k ↔ many-to-one 3 AP [92 ★ AUTO]                       │
│  ... 21 cards mais ...                                          │
├─────────────────────────────────────────────────────────────────┤
│ ☑ Selecionar todas (24)                                         │
│ [Aprovar 24 selecionadas] ← CTA azul primário                   │
│ Tolerância: ±5d ▾                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

**Próximo passo:** você revisa, dá os OKs das 7 decisões da seção 9, e a gente começa pela Fase 1 (saldo + filtros — 2 dias). Cada fase termina com smoke em prod antes da próxima.
