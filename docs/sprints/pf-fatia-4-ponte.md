# Sprint PF Fatia 4 — Ponte PJ→PF (diferencial competitivo final)

> **Status:** plano APROVADO pelo Yussef + 5 decisões de privacidade multi-sócio.
> **Doc precursor:** `docs/sprints/pf-perfis-estudo.md` §4 + §10 + §11.
> **Data do plano:** 03/06/2026 (v1) + ajustes multi-sócio (v2).
> **Estimativa:** 6-8 dias (consistente com estimativa do estudo).

---

## 0.b ⚠️ DECISÕES DE PRIVACIDADE MULTI-SÓCIO (aprovadas 03/06/2026)

Uma empresa PJ pode ter até ~10 sócios; cada um pode ter perfil PF privado. A ponte conecta dado público (tx PJ) com dado privado (tx PF). Por isso:

| # | Decisão | Onde aplica |
|---|---|---|
| A | `/empresas/[id]/pontes` mostra **só pontes do user logado** (`profileId IN owned_by_user`) | Tela A + queries |
| B | Badge tx PJ pra TERCEIRO mostra "🌉 Saída pareada com perfil PF de sócio" anônimo (sem nome/conta) | Componente `<BridgeBadge>` com prop `belongsToMe` |
| C | `GET /pontes/[id]` retorna **404** pra quem não é dono OU criador (mínima revelação) | Endpoint + rota Tela D |
| D | Sugestão de ponte filtra pelo **user logado** (`UserPersonalProfile.userId`) — só sugere pra perfis acessíveis | `lib/bridges/find-candidate-profile.ts` |
| E | Visão consolidada anonimizada pra ADMINISTRADOR societário fica pra Fatia 6+ | Fora MVP |

**Princípio:** saída da empresa = pública (DRE/Fluxo/Tx PJ). Perfil PF de cada sócio = privado (saldo + conta + bridge details).

**Tabela do que cada sócio vê:**

| Coisa | Sócio dono do perfil PF | Outro sócio da mesma empresa |
|---|---|---|
| Tx PJ em `/transacoes` | ✅ Vê com badge 🌉 "Sua ponte" + link | ✅ Vê com badge 🌉 anônimo (sem link) |
| `/empresas/[id]/pontes` | ✅ Vê SUAS pontes | ✅ Vê SUAS pontes (nada do outro) |
| `/pontes/<id>` alheio | 200 com dados | **404** (não revela existência) |
| Sugestão em `/pendentes` | ✅ Aparece quando CPF match perfil dele | ❌ Não aparece (CPF não bate) |
| DRE/Fluxo/Categoria | ✅ Vê (totais públicos) | ✅ Vê (mesmo) |

### ⚠️ CAVEAT pra revisitar (NÃO faz nessa sprint)

Se categoria PJ é nomeada "Distribuição p/Yussef" (com nome), ela vira dado público → outros sócios vêem o nome. **Melhoria pós-Fatia 4** (registrar no `docs/decisoes/`): permitir categoria genérica "Distribuição de Lucros — Sócios" sem nominar; nome do sócio só em notas/audit (privados). Refactor de plano de contas — fora dessa sprint.

---

## 0. TL;DR (1 parágrafo)

Conectar SAÍDA da empresa (PJ) com ENTRADA no perfil pessoal (PF) do dono, preservando o **Princípio da Entidade**: cada lado fica na sua tabela (`transactions` e `personal_transactions`), mas existe um registro `PJtoPFBridge` (tabela nova) que aponta pros dois e classifica o tipo de retirada. Quando o sistema já detecta um Pix PJ→CPF (Sprint 5.0.2.h existente), agora também **propõe criar a ponte com 1 clique**. O lado PJ continua afetando o DRE da empresa conforme a categoria (`DESPESAS_PESSOAL` pra pró-labore, `DISTRIBUICAO_LUCROS` pra dividendos — fora do resultado); o lado PF aparece como CREDIT na categoria "Pró-labore/Lucros".

---

## 1. ⚠️ Migration — análise de risco com REGRA DE TABELAS COM DADOS REAIS

**Decisão arquitetural CRÍTICA:** zero ALTER em `transactions` (PJ, 2907 linhas reais) e zero ALTER em `personal_transactions` (PF, 0 linhas hoje). Lookup do "essa tx tem ponte?" será feito via `PJtoPFBridge.findUnique({ where: { pjTransactionId } })` — O(1) com índice único.

### 1.1 Tabelas afetadas

| Tabela | Operação | Linhas afetadas | Risco | Mitigação |
|---|---|---|---|---|
| **`pj_to_pf_bridges`** (NOVA) | `CREATE TABLE` | 0 (tabela nova) | **Zero** | N/A |
| `transactions` (PJ) | **Nenhuma** | 2907 não-tocadas | **Zero** | Não há ALTER |
| `personal_transactions` (PF) | **Nenhuma** | 0 não-tocadas | **Zero** | Não há ALTER |
| `socios_pf` | **Nenhuma** | dados-zero atualmente, mas N seria irrelevante | **Zero** | Apenas FK reversa via relation no Prisma (não cria coluna nova lá) |

### 1.2 Migration NÃO tem seção destacada "⚠️ ALTERs em tabelas com DADOS REAIS"

Como a migration é **100% ADITIVA PURA** (`CREATE TABLE` em tabela nova, sem ALTER em nada existente), ela se enquadra no critério "100% aditivo puro" do CLAUDE.md — não precisa de destaque obrigatório de risco.

**Por que essa escolha:**
- Adicionar `bridgeId` em `transactions` seria ALTER em 2907 linhas (risco baixo, mas exigiria destaque)
- Adicionar `bridgeId` em `personal_transactions` seria ALTER em tabela vazia (zero risco real)
- A ergonomia de "consultar via `bridge.pjTransactionId` UNIQUE" é equivalente a ter o campo na própria tx — Prisma faz a JOIN automática via `include`
- **Princípio: ZERO toque em `transactions` PJ. É a tabela mais crítica do projeto.**

### 1.3 Backup obrigatório

Mesmo sendo aditivo puro, manter o protocolo:
```bash
pg_dump -Fc -f /var/backups/conta-ia/pre-pf-fatia-4-$(date +%Y%m%d_%H%M%S).dump
```
Confirma `pg_restore --list | wc -l` >= 400 itens antes de aplicar migration.

---

## 2. SCHEMA da `PJtoPFBridge`

```prisma
model PJtoPFBridge {
  id        String @id @default(cuid())

  // === LADO PJ (empresa) ===
  // Sempre type=DEBIT (saída) na transação PJ. UNIQUE: cada tx PJ pode
  // participar de no máximo UMA ponte.
  pjTransactionId String  @unique
  // companyId redundante mas necessário pra queries multi-tenant rápidas
  // (filtrar "todas as pontes da empresa X" sem JOIN).
  companyId       String

  // === LADO PF (perfil pessoal) ===
  // Sempre type=CREDIT (entrada) na PersonalTransaction. UNIQUE: cada tx PF
  // pode participar de no máximo UMA ponte.
  pfTransactionId String  @unique
  // profileId redundante por simetria com companyId. Permite lookup
  // "todas as pontes do perfil X" sem JOIN.
  profileId       String

  // === CLASSIFICAÇÃO DA RETIRADA ===
  // PRO_LABORE       — salário do sócio (afeta DRE como DESPESAS_PESSOAL)
  // DISTRIBUICAO     — dividendos/lucros distribuídos (NÃO afeta DRE — non-DRE)
  // REEMBOLSO        — sócio adiantou despesa da empresa do bolso, agora devolve
  // ADIANTAMENTO     — empréstimo informal da empresa pro sócio (não afeta DRE)
  // RETIRADA_SOCIOS  — genérico (pra decidir depois — afeta DRE conforme apuração final)
  kind String

  // Valor e data redundantes (igual aos das 2 transações). Facilita
  // auditoria + relatório "pontes do mês" sem JOIN duplo.
  amount Float
  date   DateTime

  // === RASTREABILIDADE OPCIONAL ===
  // Quando a ponte foi criada via detecção Pix PJ→CPF (Sprint 5.0.2.h),
  // aponta pro SocioPF que disparou a sugestão. NULL quando criação manual.
  socioPFId String?

  // === AUDITORIA ===
  // Quem criou a ponte (user logado). NULL apenas em backfills futuros.
  createdById String
  // CREATED_FROM_DETECTION (sistema sugeriu, user aprovou)
  // CREATED_MANUAL (user criou do zero)
  createdVia String @default("CREATED_MANUAL")

  notes String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // === RELATIONS ===
  pjTransaction Transaction         @relation(fields: [pjTransactionId], references: [id], onDelete: Restrict)
  pfTransaction PersonalTransaction @relation(fields: [pfTransactionId], references: [id], onDelete: Restrict)
  company       Company             @relation(fields: [companyId], references: [id], onDelete: Cascade)
  profile       PersonalProfile     @relation(fields: [profileId], references: [id], onDelete: Cascade)
  socioPF       SocioPF?            @relation(fields: [socioPFId], references: [id], onDelete: SetNull)
  createdBy     User                @relation(fields: [createdById], references: [id], onDelete: Restrict)

  // ÍNDICES
  // Filtros principais: "todas pontes da empresa X num período"
  @@index([companyId, date])
  // "todas pontes do perfil Y num período"
  @@index([profileId, date])
  // "todas pontes ligadas ao sócio Z" (rastreabilidade)
  @@index([socioPFId])

  @@map("pj_to_pf_bridges")
}
```

### 2.1 Por que `onDelete: Restrict` em pjTransaction e pfTransaction?

**Decisão crítica:** se Yussef deletar a tx PJ que originou a ponte (ex: deletou direto do `/transacoes` por engano), o banco DEVE bloquear porque senão a ponte fica órfã apontando pra nada. Forçar Restrict:
- Bloqueio explícito do banco → Prisma lança P2003 que tratamos como erro de UX claro
- Caminho correto: deletar a ponte ANTES (que em cascata orienta a remover ou manter as 2 tx — ver §4.4)

**Excepção sensata:** se a Company for deletada (Cascade) ou o PersonalProfile (Cascade), aí TUDO vai junto — bridges + tx PJ + tx PF — coerente com a remoção da entidade-pai.

### 2.2 Outras relations a adicionar (nas tabelas existentes)

```prisma
// Em `Transaction` (PJ) — apenas inverse relation, NÃO adiciona coluna:
//   bridge PJtoPFBridge?  @relation("PjBridge")

// Em `PersonalTransaction` (PF) — apenas inverse relation:
//   bridge PJtoPFBridge?  @relation("PfBridge")

// Em `Company`, `PersonalProfile`, `User`, `SocioPF` — inverse [] das suas pontes
```

> **IMPORTANTE:** essas linhas no schema.prisma NÃO são `ADD COLUMN` no Postgres — Prisma trata inverse relations como meta-informação do client. Migration final tem só `CREATE TABLE pj_to_pf_bridges` + índices + FKs.

### 2.3 Constraint adicional (validações no banco)

Não vou adicionar `CHECK` constraints SQL — fica difícil de testar em SQLite (dev). Em vez disso, validação no lib via Zod (ver §6).

---

## 3. TRATAMENTO CONTÁBIL (lado PJ e lado PF)

### 3.1 Lado PJ — DRE da empresa

Mapeamento `kind` → `dreGroup` que a tx PJ recebe:

| `kind` (Bridge) | `dreGroup` da tx PJ | Onde aparece no DRE | Categoria sugerida |
|---|---|---|---|
| `PRO_LABORE` | `DESPESAS_PESSOAL` | Linha "(-) Despesas com Pessoal" — afeta resultado | "Pró-labore — `<nome do sócio>`" |
| `DISTRIBUICAO` | `DISTRIBUICAO_LUCROS` | **Fora do DRE** — reportado separadamente em "Distribuição de Lucros / Pró-labore" | "Distribuição de Lucros — `<sócio>`" |
| `REEMBOLSO` | depende do que foi reembolsado (ex: `DESPESAS_ADMINISTRATIVAS` se viagem) | Mesma linha da despesa original | "Reembolso de despesas — `<sócio>`" |
| `ADIANTAMENTO` | `DISTRIBUICAO_LUCROS` (default, ajustável) | Fora do DRE (não é receita nem despesa de fato) | "Adiantamento a sócios — `<sócio>`" |
| `RETIRADA_SOCIOS` | `DISTRIBUICAO_LUCROS` (default genérico) | Fora do DRE | "Retirada de sócio — `<sócio>`" |

**Decisão pendente (perguntar pro Yussef ANTES de implementar):**
- Pra `REEMBOLSO`, o user precisa escolher a categoria manualmente (ex: "Reembolso de Viagem" vai em `DESPESAS_ADMINISTRATIVAS`). Bridge **não** decide dreGroup pra esse caso — UI obriga seleção.
- Pra `ADIANTAMENTO`, contabilmente o correto seria conta patrimonial (Ativo - "Contas a receber de sócios"). Como nosso schema atual não tem balanço patrimonial separado, vai pra `DISTRIBUICAO_LUCROS` como neutralização do caixa. **Marcador pra Sprint futura de Balanço.**

### 3.2 Lado PF — Categoria sugerida

| `kind` | Categoria PF sugerida (vinda dos defaults Fatia 1) |
|---|---|
| `PRO_LABORE` | "Pró-labore/Lucros" (existe nos defaults) |
| `DISTRIBUICAO` | "Pró-labore/Lucros" |
| `REEMBOLSO` | "Outros Recebimentos" |
| `ADIANTAMENTO` | "Outros Recebimentos" |
| `RETIRADA_SOCIOS` | "Pró-labore/Lucros" |

Sempre `type=CREDIT` na PersonalTransaction.

### 3.3 Saldo das contas (PJ e PF)

- **Lado PJ:** tx PJ já existe (origin OFX) — saldo da `BankAccount` PJ JÁ FOI ATUALIZADO no import. Bridge não mexe nele.
- **Lado PF:** ao criar a ponte, criamos a `PersonalTransaction` CREDIT na `PersonalBankAccount` escolhida pelo user. Engine de saldo da Fatia 1 (`lib/balance/`) recalcula automaticamente ao listar.

---

## 4. FLUXO completo de criar a ponte

### 4.1 Caminho 1 — DETECÇÃO AUTOMÁTICA (já existe — só conecta)

```
1. OFX import da PROFIT entra → 
   ImportStaging detecta Pix DEBIT R$ 10k pra "Yussef Musa CPF 600.258.890-60"
2. lib/pix-detection (Sprint 5.0.2.h) classifica como SOCIO_PF + 
   sugere dreGroup=DISTRIBUICAO_LUCROS ou PRO_LABORE
3. Tx PJ é criada com:
   - relatedPartyType='SOCIO_PF'
   - relatedPartyId=<SocioPF.id>
   - categoryId=<categoria com dreGroup='DISTRIBUICAO_LUCROS'>
4. ★ NOVO (Fatia 4): hook pós-creation faz lookup:
   - SocioPF tem CPF? → busca PersonalProfile.cpf = mesmo CPF
   - Se achou + user logado tem acesso ao perfil →
     Cria TRANSACTION_FLAG no audit/staging: "Ponte sugerida"
   - Página /pendentes (já existente) ou /transferencias mostra card 
     "🎯 Esse R$10k pro CPF X é distribuição de lucros pro perfil 'Yussef'?
      Criar ponte com 1 clique?"
5. User clica "Confirmar ponte":
   - Modal mostra: tipo (default DISTRIBUICAO), conta PF de destino, 
     categoria PF (sugerida), data (= data da tx PJ)
   - User aprova → POST /api/pontes/from-detection
   - Backend: cria PersonalTransaction CREDIT + PJtoPFBridge atomic
6. UI atualiza: card desaparece da lista de sugestões + aparece 
   na lista de pontes do mês
```

### 4.2 Caminho 2 — CRIAÇÃO MANUAL

```
1. User vai em /empresas/[id]/pontes/nova OU /perfis/[id]/pontes/nova
2. Form pede:
   - Empresa (já contextual se entrou pela rota /empresas)
   - Perfil PF (já contextual se entrou pela rota /perfis)
   - Transação PJ existente (autocompleta tx DEBIT da empresa nos últimos 90 dias)
   - kind (radio com 5 opções)
   - Conta bancária PF onde vai a entrada
   - Categoria PF (sugerida pelo kind)
   - Data (default = data da tx PJ)
3. Submit → POST /api/pontes
4. Backend valida: user tem acesso aos 2 lados, tx PJ não tem bridge ainda, 
   monta o atomic: cria PersonalTransaction CREDIT + PJtoPFBridge
5. UI redireciona pra lista de pontes
```

### 4.3 Atomic operation (transação Prisma)

```typescript
// lib/bridges/create.ts (esboço — NÃO implementa ainda)
return prisma.$transaction(async (tx) => {
  // 1. Confirma a tx PJ existe + é da empresa correta + é DEBIT + 
  //    NÃO tem bridge ainda + valor confere
  const pjTx = await tx.transaction.findUnique({
    where: { id: pjTransactionId },
    include: { bridge: true }, // checa NULL
  })
  if (!pjTx || pjTx.bankAccount?.companyId !== companyId)
    throw new BridgeError('Tx PJ não encontrada', 'PJ_NOT_FOUND')
  if (pjTx.type !== 'DEBIT')
    throw new BridgeError('Tx PJ deve ser DEBIT', 'PJ_WRONG_TYPE')
  if (pjTx.bridge)
    throw new BridgeError('Tx PJ já tem ponte', 'PJ_ALREADY_BRIDGED')

  // 2. Cria a PersonalTransaction CREDIT (lado PF)
  const pfTx = await tx.personalTransaction.create({
    data: {
      profileId,
      bankAccountId: pfBankAccountId,
      categoryId: pfCategoryId,
      date: pjTx.date,
      description: buildPfDescription(kind, pjTx, socioPFName),
      amount: pjTx.amount,
      type: 'CREDIT',
      status: 'RECONCILED',
      origin: 'AI', // CRIADO via bridge counts como origem AI
      notes,
    },
  })

  // 3. Cria a Bridge
  const bridge = await tx.pJtoPFBridge.create({
    data: {
      pjTransactionId: pjTx.id,
      pfTransactionId: pfTx.id,
      companyId,
      profileId,
      kind,
      amount: pjTx.amount,
      date: pjTx.date,
      socioPFId, // opcional
      createdById: userId,
      createdVia: source, // CREATED_FROM_DETECTION | CREATED_MANUAL
      notes,
    },
  })

  // 4. Audit log (em UMA entrada, scoped à empresa)
  await tx.auditLog.create({ ... })

  return { bridge, pfTransaction: pfTx }
})
```

Se qualquer passo falha, todo o atomic reverte (incluindo PF tx criada).

### 4.4 Deletar uma ponte — DECISÃO DE PRODUTO

Quando user clica "Excluir ponte" em `/perfis/[id]/pontes/[id]`:

**Opção sugerida (recomendada):** apresenta modal com 3 opções:

```
A) Apenas desfazer o vínculo
   → deleta PJtoPFBridge, mantém as 2 transações
   → Use caso: "errei só o vínculo, as 2 tx estão certas"

B) Desfazer vínculo + deletar SÓ a entrada do perfil PF
   → deleta PJtoPFBridge + delete PersonalTransaction
   → Use caso: "o dinheiro não foi pro meu CPF de fato, foi pra X"
   → Mantém tx PJ (já existe no extrato, real)

C) Cancelar
```

**NÃO oferecemos** "deletar tx PJ" via essa UI — tx PJ veio de OFX/manual; pra deletá-la o user vai no `/empresas/[id]/transacoes` (caminho normal de delete).

**Atomic do delete (opção A):**
```typescript
return prisma.$transaction(async (tx) => {
  await tx.pJtoPFBridge.delete({ where: { id: bridgeId } })
  await tx.auditLog.create({ action: 'BRIDGE_DELETED_LINK_ONLY', ... })
})
```

**Atomic do delete (opção B):**
```typescript
return prisma.$transaction(async (tx) => {
  const bridge = await tx.pJtoPFBridge.findUnique({ where: { id } })
  await tx.pJtoPFBridge.delete({ where: { id } })
  await tx.personalTransaction.delete({ where: { id: bridge.pfTransactionId } })
  // saldo PF recalcula automaticamente na próxima listagem
  await tx.auditLog.create({ action: 'BRIDGE_DELETED_WITH_PF_TX', ... })
})
```

### 4.5 Se a tx PJ for deletada externamente

Cenário: user vai em `/empresas/[id]/transacoes/<id>` e clica "Excluir" numa tx que tem bridge.

**FK Restrict bloqueia o delete.** O endpoint de delete de tx PJ precisa ser ESTENDIDO:

```typescript
// app/api/transacoes/[id]/route.ts DELETE — extensão Fatia 4
const tx = await prisma.transaction.findUnique({
  where: { id }, include: { bridge: true }
})
if (tx?.bridge) {
  return NextResponse.json({
    erro: 'Essa transação tem uma ponte ativa pro perfil PF. Remova a ponte primeiro.',
    code: 'HAS_ACTIVE_BRIDGE',
    bridgeId: tx.bridge.id,
  }, { status: 409 })
}
```

Mesma lógica em `PersonalTransaction` delete (se tx PF tem bridge → bloqueia delete direto).

---

## 5. ISOLAMENTO / SEGURANÇA

### 5.1 Validação de acesso a ambos os lados (CRÍTICA)

Pra criar uma ponte, user PRECISA TER:
1. **Permissão `transaction.view` na empresa do `pjTransactionId`** (via RBAC normal já existente)
2. **Acesso `OWNER` no perfil PF** (via `checkProfileAccess`, helper Fatia 1)

Se faltar um dos dois → 403/404.

### 5.2 Função orquestradora

```typescript
// lib/bridges/create.ts (esboço)
export async function createBridge(input: CreateBridgeInput) {
  // 1. Multi-tenant PF
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  // 2. RBAC PJ — usa o mesmo padrão de transaction.create
  await assertPermission(input.userId, input.companyId, 'transaction.create')
  // 3. Atomic
  return prisma.$transaction(async (tx) => { /* ver §4.3 */ })
}
```

### 5.3 Casos de attack a cobrir nos testes

| Cenário | Resposta esperada |
|---|---|
| UserB → empresa de UserA → criar bridge | 403 RBAC |
| UserB com acesso ao perfil de UserA → criar bridge entre 2 entidades alheias | 403 (faltam ambos os checks) |
| UserA tem acesso à empresa MAS NÃO ao perfil PF do dono → criar ponte | 403 ProfileAccessError |
| UserA tenta passar `pjTransactionId` de empresa B (mas tem acesso à B!) → tenta linkar tx PJ de B com perfil PF de A | 400 — `companyId` do form não bate com `bankAccount.companyId` da tx PJ |
| Race: 2 requests concorrentes tentando criar ponte na mesma tx PJ | UNIQUE constraint bloqueia o segundo (P2002) → 409 |
| **Sócio B → POST /pontes com profileId do sócio A** | **404 PF_PROFILE_NOT_FOUND (não revela existência)** |
| **Sócio B → GET /empresas/A/pontes (A é sócio do mesmo PJ)** | **Lista SÓ pontes do B (filtro `profileId IN owned_by_B`)** |
| **Sócio B → GET /pontes/<id-A-criou>** | **404 (mesmo sendo da mesma empresa)** |
| **Sócio B → GET /pendentes na empresa compartilhada com A** | **Não aparecem sugestões pra CPF do A** (filtro userId) |

### 5.4 Smuggling

Endpoints PF de bridge (`/api/perfis/[id]/pontes/*`) NUNCA aceitam `userId` no body — sempre via JWT. Endpoints PJ (`/api/empresas/[id]/pontes/*`) mesma coisa.

---

## 6. PIPELINE DE DETECÇÃO (reuso máximo)

### 6.1 O que JÁ EXISTE (zero implementação)

| Componente | Onde | Função |
|---|---|---|
| Detecção CPF/CNPJ na descrição | `lib/pix-detection/detect-pix-relacionado.ts` | Retorna `{tipo:'SOCIO_PF', destinatarioId:socioPFId, dreGroupSugerido:'PRO_LABORE'\|'DISTRIBUICAO_LUCROS'}` |
| SocioPF lookup por CPF | `prisma.socioPF.findUnique({where:{companyId_cpf}})` | Já indexado |
| `relatedPartyType` + `relatedPartyId` na tx PJ | `transactions` (já em schema) | Marca tx como ligada a SocioPF |
| Categoria com `dreGroup` | `lib/dre/types.ts` + categorias seedadas | Já distingue `DESPESAS_PESSOAL` vs `DISTRIBUICAO_LUCROS` |
| `checkProfileAccess` | `lib/personal-profile/queries.ts` | Multi-tenant PF |

### 6.2 O que precisa SER CRIADO (lado bridge)

| Componente | Onde | Função |
|---|---|---|
| `lib/bridges/find-candidate-profile.ts` | NOVO | Dada uma tx PJ com `relatedPartyType='SOCIO_PF'` + **`userId` do user logado**, busca SocioPF → pega CPF → busca PersonalProfile com mesmo CPF AND `type='OWN'` AND linkado ao userId via UserPersonalProfile. **Filtra explicitamente pelo userId pra não vazar entre sócios.** Retorna `{profile, socioPF}` ou null |
| `lib/bridges/suggest-bridge.ts` | NOVO | Lê tx PJ recente sem bridge + `relatedPartyType='SOCIO_PF'` + candidate PF achado → retorna lista de sugestões pra UI |
| `lib/bridges/create.ts` | NOVO | Orquestra criação atomic (§4.3) |
| `lib/bridges/delete.ts` | NOVO | Orquestra delete A ou B (§4.4) |
| `lib/bridges/kind-defaults.ts` | NOVO | Mapeia `kind → dreGroup PJ + category sugerida PF` (§3.1, §3.2) |
| `lib/bridges/types.ts` | NOVO | Tipos + `BridgeError` codes |
| `lib/bridges/queries.ts` | NOVO | List + summary (pontes do mês, total por kind, etc) |

### 6.3 Pipeline de sugestão (cronjob? sob demanda?)

**Decisão sugerida (aguarda confirmação):** sob demanda — quando user abre `/empresas/[id]/pendentes` ou `/perfis/[id]` (dashboard), endpoint roda `suggest-bridge` em paralelo com as outras queries (Promise.all). Cache 60s tag `bridges:suggestions:${companyId}`. Sem cronjob.

**Alternativa rejeitada:** cron diário gerando sugestões — overhead pra benefício marginal; lookups são baratos.

---

## 7. ENDPOINTS REST

### 7.1 Lista propostas

| Verbo | Path | Função |
|---|---|---|
| GET | `/api/empresas/[id]/pontes` | Lista pontes da empresa (paginada + filtros) |
| GET | `/api/perfis/[id]/pontes` | Lista pontes do perfil PF |
| GET | `/api/empresas/[id]/pontes/sugestoes` | Lista sugestões (tx PJ sem bridge + SocioPF + PersonalProfile candidato) |
| POST | `/api/pontes` | Cria ponte (manual ou via detecção). Aceita `companyId`, `profileId`, `pjTransactionId`, `kind`, `pfBankAccountId`, `pfCategoryId`, `notes`, `socioPFId?`, `createdVia` |
| GET | `/api/pontes/[id]` | Detalhe da ponte (com tx PJ + tx PF + sócio) |
| DELETE | `/api/pontes/[id]?mode=LINK_ONLY\|WITH_PF_TX` | Delete §4.4 |
| GET | `/api/pontes/summary?empresaId=&profileId=&period=` | Agregados pra dashboard |

### 7.2 Mensagens de erro tipadas (BridgeError codes)

```typescript
type BridgeErrorCode =
  | 'PJ_NOT_FOUND'         // 404
  | 'PJ_WRONG_TYPE'        // 400 — tx PJ não é DEBIT
  | 'PJ_ALREADY_BRIDGED'   // 409 — UNIQUE constraint
  | 'PF_PROFILE_NOT_FOUND' // 404
  | 'PF_ACCOUNT_NOT_FOUND' // 404
  | 'PF_CATEGORY_INVALID'  // 400 — categoria pertence a outro perfil ou wrong type
  | 'INVALID_KIND'         // 400 — kind fora do enum
  | 'COMPANY_MISMATCH'     // 400 — tx PJ não pertence à companyId do request
  | 'NO_RBAC_PJ'           // 403
  | 'NO_ACCESS_PF'         // 403
  | 'BRIDGE_NOT_FOUND'     // 404 — DELETE de ID inexistente
```

---

## 8. UX — onde aparece, telas novas vs reuso

### 8.1 Onde aparece a SUGESTÃO de ponte (caminho 1)

**Decisão (aguarda confirmação):**

| Lugar | Como |
|---|---|
| `/empresas/[id]/pendentes` (já existe) | Adiciona seção "🌉 Pontes sugeridas pro perfil PF" no topo |
| `/empresas/[id]/transacoes/[id]` (detalhe da tx PJ) | Banner azul "Essa tx parece ir pro seu perfil PF. Criar ponte?" |
| `/dashboard` PJ | Card "🌉 N pontes sugeridas" no Hero secundário |
| `/perfis/[id]` (dashboard PF) | Card "🌉 N pontes pendentes pra confirmar" |
| Notificação proativa (futuro) | Fora do MVP |

### 8.2 Telas NOVAS (Fatia 4)

| Rota | Tipo | Função |
|---|---|---|
| `/empresas/[id]/pontes` | Lista | Pontes da empresa, filtros (período, kind, sócio), botão "+ Nova ponte" |
| `/perfis/[id]/pontes` | Lista | Pontes do perfil, filtros (período, empresa, kind) |
| `/empresas/[id]/pontes/nova` | Form criação manual | Caminho 2 §4.2 |
| `/perfis/[id]/pontes/nova` | Form criação manual | Mesma coisa, contextual no perfil |
| `/pontes/[id]` | Detalhe | Mostra tx PJ + tx PF + sócio + audit + botão "Excluir" (com modal §4.4) |
| Modal "🎯 Confirmar ponte" (componente reusável) | Aparece nos lugares §8.1 | 1-clique aproveitando defaults |

### 8.3 Componentes UI novos

- `<BridgeKindRadio>` — radio button com 5 opções + descrição contábil de cada
- `<BridgeSuggestionCard>` — card pra aparecer em pendentes/dashboard com botões "Confirmar / Ignorar"
- `<BridgeDeleteModal>` — 3 opções A/B/C §4.4
- `<BridgeBadge>` — badge "🌉 Pareada com PF" na tx PJ + badge "🌉 Veio da PROFIT" na tx PF
- `<BridgesList>` — tabela paginada compartilhada entre `/empresas/.../pontes` e `/perfis/.../pontes`

### 8.4 Integração com telas existentes (não-bridge)

| Tela | Ajuste |
|---|---|
| `/empresas/[id]/transacoes` (tabela) | Coluna "Ponte?" mostrando 🌉 quando tx PJ tem bridge |
| `/perfis/[id]/transacoes` (tabela) | Mesma coisa |
| `/empresas/[id]/transacoes/[id]` (detalhe) | Section "Ponte ativa" com link pra `/pontes/<id>` (quando existe) |
| `/empresas/[id]/dre` | Nada muda — DRE já filtra por `dreGroup` correto |
| `/empresas/[id]/relatorios` (categorias / comparativo / etc) | Nada muda — agregação por dreGroup já existe |

---

## 9. O QUE REUSA vs NOVO (resumo executivo)

### 9.1 ✅ REUSA (zero código novo)

- `lib/pix-detection/detect-pix-relacionado.ts` (Sprint 5.0.2.h)
- `lib/dre/types.ts` + calculator (DRE não muda)
- `lib/personal-profile/queries.ts` (checkProfileAccess)
- `lib/balance/*` (saldo PF recalcula sozinho)
- `lib/categories/*` (categorias seed PJ existentes — pró-labore, distribuição)
- Categorias PF seed Fatia 1 ("Pró-labore/Lucros", "Outros Recebimentos")
- `Transaction.relatedPartyType/relatedPartyId` (já marca SocioPF)
- `prisma.$transaction` pattern já consagrado nas Fatias 1-3
- RBAC PJ existente (`transaction.create/view/delete`)
- Audit log (`AuditLog` + `auditLog.create` em transactions)

### 9.2 ✨ NOVO

| Categoria | Itens |
|---|---|
| Schema | 1 model novo `PJtoPFBridge` + relations inverse em 5 models existentes (sem ADD COLUMN) |
| Lib | `lib/bridges/` com 7 arquivos (§6.2) |
| Endpoints | 7 (§7.1) |
| UI | 5 telas + 5 componentes (§8.2, §8.3) |
| Audit actions | `BRIDGE_CREATED`, `BRIDGE_DELETED_LINK_ONLY`, `BRIDGE_DELETED_WITH_PF_TX` |
| Migration | 1 aditiva pura |
| Testes | ~80 (§10) |

---

## 10. TESTES (cobertura mínima)

### 10.1 Função pura `lib/bridges/kind-defaults.ts` (10 testes)
- Mapeamento dos 5 kinds → dreGroup PJ correto
- Mapeamento dos 5 kinds → categoria PF sugerida correta
- REEMBOLSO retorna null pra dreGroup (force user choice)

### 10.2 `lib/bridges/find-candidate-profile.ts` (12 testes)
- SocioPF sem CPF → null
- SocioPF com CPF, sem PersonalProfile correspondente → null
- SocioPF com CPF, PersonalProfile existe MAS user logado sem acesso → null
- Match completo → retorna {profile, socioPF}
- Múltiplos PersonalProfile com mesmo CPF (deduplicado / 1º match)
- CPF formatado diferente (600.258.890-60 vs 60025889060) → normaliza match

### 10.3 `lib/bridges/create.ts` integration (15 testes)
- Caminho feliz: cria bridge + PF tx + audit log
- Tx PJ não existe → PJ_NOT_FOUND
- Tx PJ é CREDIT → PJ_WRONG_TYPE
- Tx PJ já tem bridge → PJ_ALREADY_BRIDGED (UNIQUE)
- Categoria PF de outro perfil → PF_CATEGORY_INVALID
- Conta PF de outro perfil → PF_ACCOUNT_NOT_FOUND
- Saldo: PF CREDIT entra corretamente na conta escolhida (verificar via `calculateBalance` após)
- DRE: tx PJ com `dreGroup=DISTRIBUICAO_LUCROS` NÃO aparece no resultado (filtro non-DRE)
- DRE: tx PJ com `dreGroup=DESPESAS_PESSOAL` AFETA o resultado
- Atomic: se PJtoPFBridge.create falha (ex: UNIQUE), PersonalTransaction também é revertida
- createdVia preservado ('CREATED_FROM_DETECTION' vs 'CREATED_MANUAL')

### 10.4 `lib/bridges/delete.ts` (10 testes)
- Modo LINK_ONLY: deleta bridge, mantém 2 tx
- Modo WITH_PF_TX: deleta bridge + PF tx
- Bridge inexistente → BRIDGE_NOT_FOUND
- Audit log em cada modo
- Saldo PF recalcula corretamente após WITH_PF_TX

### 10.5 Endpoints (12 testes)
- POST sem auth → 401
- POST sem RBAC PJ → 403
- POST sem acesso PF → 403
- POST sucesso retorna 201 com bridge + pfTx
- GET lista paginada + filtros funcionam
- DELETE com `mode` inválido → 400
- DELETE com FK Restrict (tentativa de hard delete tx PJ com bridge) → 409 HAS_ACTIVE_BRIDGE

### 10.6 Multi-tenant isolation + PRIVACIDADE MULTI-SÓCIO (17 testes — críticos)
- UserB → criar bridge entre empresaA + perfilA → 403
- UserB → criar bridge entre empresaA + perfilB (UserB OWNER do perfilB) → 403 RBAC
- UserA tem acesso à empresa MAS NÃO ao perfil → 403
- UserA com acesso a ambos os lados → 201
- UserA → GET /api/pontes/[id] que pertence a UserB → 404
- UserA → DELETE bridge de UserB → 404
- POST sem auth → 401
- POST com `socioPFId` de outra empresa → COMPANY_MISMATCH
- POST com tx PJ de empresa B (mas user tem acesso à B) → criação ok SE perfil é dele
- POST com `pjTransactionId` que aponta pra tx PJ com bankAccount inexistente → erro
- Race condition: 2 POST concorrentes mesma `pjTransactionId` → 1 sucesso 1 conflict
- UserB lista pontes da empresaA → não vê nenhuma (filtro companyId via RBAC)
- UserB lista pontes do perfilA → não vê nenhuma (filtro profileId via checkProfileAccess)
- DELETE endpoint sem cookie → 401
- GET summary com profileId alheio → 404
- **★ Sócio B + A da mesma empresa: B → GET /empresas/comum/pontes → vê SÓ as dele (zero das de A)**
- **★ Sócio B + A da mesma empresa: B → GET /pontes/<id-criado-por-A> → 404 (não revela existência)**
- **★ Sócio B + A da mesma empresa: detect-candidate de tx PJ pra CPF de A → user B recebe null (não sugere)**
- **★ Sócio B → POST com profileId do A → 404 PF_PROFILE_NOT_FOUND (não 403, mínima revelação)**

### 10.7 Pegadinhas específicas (8 testes)
- Tx PJ tem `categoryId` que não bate com `kind`. Ex: tx categorizada como "Despesas Administrativas" mas kind=DISTRIBUICAO → permitir? **Decisão:** sim, log warning; bridge não muda categoria PJ existente (user já classificou)
- Tx PJ é de uma `BankAccount` que foi soft-deleted (`isActive=false`) → ainda permite criar bridge? **Decisão:** sim — tx histórica
- Tentar criar bridge entre 2 entidades de meses diferentes (tx PJ em jan, data PF em mar) → permitir mas warn? **Decisão:** UI default copia data PJ, mas user pode override; sem warn
- Tx PJ com `isInternalTransfer=true` (transferência entre empresas do grupo) → BLOQUEAR criação de bridge (essa tx tá pareada com outra PJ, não PF)
- Tx PJ com `transferGroupId` setado (Sprint 0.5 — transferência interna mesma empresa) → BLOQUEAR
- Tx PJ com `lifecycle='PAYABLE'` (não pagou ainda) → BLOQUEAR (não há dinheiro saindo de fato)
- Tx PJ com `reconciledWithId` (foi conciliada com outra PAYABLE) → permitir mas warn
- Re-criar bridge depois de delete LINK_ONLY → permitir (UNIQUE foi removido junto)

---

## 11. SAFETY NETS pré-deploy

### 11.1 Backup obrigatório
```bash
ssh root@198.211.103.10
cd /opt/conta-ia
DBURL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | sed 's/?schema=public//')
pg_dump -Fc "$DBURL" -f "/var/backups/conta-ia/pre-pf-fatia-4-$(date +%Y%m%d_%H%M%S).dump"
pg_restore --list "$BAK" | wc -l  # >= 419 (baseline F3.5)
```

### 11.2 Counts antes/depois (mesma lista das fatias anteriores + nova tabela)
```
users · companies · subscriptions · personal_profiles · credit_cards ·
credit_card_invoices · personal_ofx_imports · personal_transactions ·
transactions · ai_learning_rules · personal_pdf_extract_cache · pj_to_pf_bridges
```

Esperado pós-migration: TODOS idênticos exceto `pj_to_pf_bridges=0` (nova).

### 11.3 Smoke test pós-deploy
- POST /api/pontes sem auth → 401
- GET /api/empresas/[id]/pontes autenticado → `{pontes:[]}` (vazio)
- POST manual (Yussef cria 1 ponte real: tx PJ PROFIT R$10k → perfil PF "Yussef" CPF 600.258.890-60 → DISTRIBUICAO)
- Validar:
  - DRE PROFIT: tx aparece em "Distribuição de Lucros/Pró-labore" (fora do resultado)
  - Dashboard PF: card mostra +R$10k de entrada
  - Audit log: 1 entrada BRIDGE_CREATED
- DELETE em modo LINK_ONLY → ambas tx ficam, bridge some
- Re-criar mesma ponte → permite

### 11.4 prisma generate DEPOIS do swap (regra de sempre)

Procedimento padrão CAIXAOS validado nas Fatias 1-3:
```
git pull → swap-prisma-to-postgres.sh → prisma generate → migrate deploy → build → pm2 reload
```

### 11.5 Zero PGPASSWORD/credencial em log

Quando rodar SQL inline pelo SSH:
```bash
DBURL=$(grep ... | sed 's/PGPASSWORD=[^@]*@/***@/g')  # sanitize antes de printar
psql "$REAL_DBURL" ...  # mas usa o real internamente
```

---

## 12. RISCOS RESIDUAIS + MITIGAÇÕES

| Risco | Severidade | Mitigação |
|---|---|---|
| User deleta tx PJ órfã (sem bridge) e DRE muda | Baixa | Comportamento normal, sem mudança |
| User cria bridge errada (kind errado) | Média | Edit ponte (PATCH endpoint stretch — ou só delete+recriar no MVP) |
| Falso positivo na detecção: CPF parece de sócio mas é homônimo | Baixa | Sugestão NUNCA cria automático — sempre confirma com 1 clique |
| 2 perfis PF com mesmo CPF na conta do mesmo user (dependente?) | Baixa | `find-candidate-profile` retorna SÓ o `type=OWN` ou warn ambiguidade |
| Tx PJ com bridge é re-conciliada via OFX → comportamento? | Média | Bridge segue válida — reconciliedWithId não afeta vínculo |
| Cache `dashboard:${companyId}` invalidate quando ponte criada | Baixa | Adicionar tag `bridges:${companyId}` no revalidate |

---

## 13. ESCOPO FORA DA FATIA 4 (registrar pra Fatia 5+)

- **Edit ponte** (PATCH endpoint) — MVP só DELETE+recriar
- **Bulk import de pontes históricas** (ex: backfill últimos 6 meses) — manual MVP
- **Cron noturno** sugerindo pontes — sob demanda MVP
- **Pontes PF→PJ inversas** (sócio aporta capital na empresa) — fora do escopo Fatia 4
- **Conta de "Pró-labore acumulado"** no balanço patrimonial — sem balanço ainda
- **Cálculo IRPF/INSS no pró-labore** — sem cálculo de impostos PF ainda
- **Convites entre Users** (Fatia 5) — ponte assume 1 user gerencia ambos os lados

---

## 14. ✅ DECISÕES APROVADAS PELO YUSSEF (03/06/2026)

1. **UX da sugestão (§8.1)** — ✅ APROVADO: pendentes + banner + cards
2. **Delete (§4.4)** — ✅ APROVADO: só 2 modos (A LINK_ONLY / B WITH_PF_TX), sem deletar tx PJ
3. **REEMBOLSO força categoria manual (§3.1)** — ✅ APROVADO
4. **Detecção só perfil OWN (§12)** — ✅ APROVADO (ignora DEPENDENT)
5. **Sem cronjob (§6.3)** — ✅ APROVADO (lookup sob demanda + cache 60s)
6. **Editar ponte fora MVP (§13)** — ✅ APROVADO (delete+recriar)
7. **Wireframes ASCII** — ✅ ENTREGUES + APROVADOS (com ajustes multi-sócio §0.b)

### Privacidade multi-sócio (decisões adicionais em §0.b):
- A: Lista mostra só pontes do user logado
- B: Badge tx PJ anonimizado pra terceiros
- C: GET /pontes/[id] = 404 pra quem não é dono/criador
- D: Sugestão filtra por userId
- E: Visão consolidada anonimizada fica pra Fatia 6+

---

## 15. APÊNDICE — exemplo END-TO-END

**Cenário real do Yussef:**
- PROFIT distribuiu R$ 10.000 pra Yussef em 28/05/2026 via Pix
- OFX da PROFIT veio com a tx; sistema atual (5.0.2.h) detectou Pix → SocioPF "Yussef" CPF 600.258.890-60 → categorizou como "Distribuição de Lucros" (dreGroup `DISTRIBUICAO_LUCROS`)

**Com Fatia 4:**

1. Após import: `/empresas/profit/pendentes` mostra card:
   ```
   🎯 Ponte sugerida
   PROFIT → Pix R$ 10.000,00 (28/05/2026)
   Vai pro perfil PF "Yussef Musa" (CPF ***.258.890-**)
   Tipo: Distribuição de Lucros (sugerido)
   [Confirmar ponte] [Ignorar]
   ```

2. Yussef clica "Confirmar ponte":
   - Modal: tipo (DISTRIBUICAO pré-selecionado), conta PF Nubank, categoria "Pró-labore/Lucros", data 28/05
   - Confirma → atomic cria:
     - `PersonalTransaction` CREDIT R$ 10k no Nubank PF
     - `PJtoPFBridge` { kind=DISTRIBUICAO, socioPFId=<yussef>, createdVia=CREATED_FROM_DETECTION, ... }
     - 1 audit log

3. `/empresas/profit/dre` (mês maio):
   - Linha "(-) Despesas com Pessoal": SEM esse R$ 10k (porque dreGroup é DISTRIBUICAO_LUCROS)
   - Section "Lançamentos fora do DRE" → "Distribuição de Lucros / Pró-labore: R$ 10.000,00"
   - Resultado do exercício: NÃO afetado

4. `/perfis/yussef` (dashboard PF, maio):
   - Hero: "+R$ 10.000 de entrada"
   - Top categorias: "Pró-labore/Lucros: R$ 10.000"

5. `/perfis/yussef/pontes`:
   - Linha: "28/05 · R$ 10.000 · Distribuição · PROFIT · 🔗 PRO-PROFIT-OFX-7891 ↔ PF-NU-CR-2341"

6. Se Yussef deletar a bridge (modo LINK_ONLY):
   - Bridge some
   - Tx PJ PROFIT continua intacta (R$ 10k em "Distribuição de Lucros" no DRE)
   - Tx PF Nubank continua intacta (+R$ 10k no saldo)
   - Próximo import: sistema vai re-sugerir ponte (caso 1 de novo)

---

**Próximo passo:** Yussef revisa esse plano, responde as 7 decisões pendentes em §14, e depois implemento sequência:

1. Migration + schema (1 dia)
2. Lib `lib/bridges/*` + testes puros (1-2 dias)
3. Endpoints + testes integration (1 dia)
4. UI telas novas + componentes (2 dias)
5. Smoke + deploy (0.5 dia)

**Total estimado:** 5-6 dias úteis (otimista) a 6-8 dias (com extras de UX/polimento).
