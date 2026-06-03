# Estudo de Arquitetura — Perfis PF (Pessoa Física)

> **Status:** estudo técnico, ZERO código escrito. Yussef + Claude decidem
> arquitetura ANTES de fatiar a implementação.
>
> **Data:** 02/06/2026
> **HEAD relevante:** `8a34ebb` (após Sprint 3C webhook deployado)

---

## 1. Mapeamento da base atual relevante

### 1.1 Como `Company` está modelada

`Company` é o tenant central do sistema:
- `cnpj String @unique` — chave de unicidade (assume PJ por design)
- `taxRegime` default `SIMPLES_NACIONAL` (não tem opção "sem regime")
- 28 relações reversas (BankAccount, Category, Supplier, Customer, Employee, AuditLog, Role, TaxProfile…)
- **26 models do schema têm campo `companyId`** — é a "espinha dorsal" do multi-tenant

### 1.2 Como `User` ↔ `Company` se relacionam

```
User ──< UserCompany >── Company     (N:N via UserCompany)
User ──< UserCompanyRole >── Company (RBAC — Role por par user/empresa)
```

- `UserCompany`: N:N simples (user pode ter várias empresas; empresa pode ter vários users)
- `UserCompanyRole`: aponta pra `Role` (OWNER/ADMIN/ACCOUNTANT/FINANCIAL/VIEWER ou custom)
- `Role` pode ser global (`companyId=null`) ou custom por empresa
- Permissões granulares em `RolePermission` (many-to-many com `Permission`)

### 1.3 Como o usuário "troca de empresa"

- Componente: `components/layout/workspace-switcher.tsx` + `lib/contexts/empresa-context.tsx`
- Provider React `EmpresaProvider` envolve `(dashboard)/layout.tsx`
- 4 fontes de verdade pra `currentEmpresaId` (prioridade):
  1. `/empresas/[id]/*` na URL (path ganha)
  2. `?empresaId=` query string
  3. `localStorage['caixaos:empresa-context:current']`
  4. 1ª empresa do user (fallback)
- Cookie httpOnly via `POST /api/empresas/atual` pra Server Components lerem
- **34 páginas em `app/(dashboard)/empresas/[id]/*`** — todas assumem `id` na URL

### 1.4 Como `Transaction`/`BankAccount`/`Category` se ligam

```
Company
  ├──< BankAccount ──< Transaction
  └──< Category ────< Transaction (categoryId)
  └──< Supplier ────< Transaction (supplierId)
  └──< Employee ────< Transaction (employeeId)
```

- `BankAccount.companyId NOT NULL` — sem conta órfã
- `Transaction.bankAccountId String?` (nullable — PAYABLE/RECEIVABLE pendente)
- `Transaction.type`: `CREDIT` | `DEBIT` | `TRANSFER` (par interno mesma empresa)
- `Transaction.transferGroupId` (Sprint 0.5): une as 2 pontas de transferência

**Filtro multi-tenant** em ~61 queries no `app/api/` usa `where: { companyId }` direto.

### 1.5 Sistema de planos

- `lib/planos/config.ts`: 4 planos (Início 29,99 / Controle 89,99 / Inteligência 149,99 / Performance 349,99)
- **Limite atual de plano = `Plano.empresas: number`** (1/3/10/Infinity)
- Reforçado onde? **Não há check formal hoje** — nem no signup nem na criação de empresa. A criação `POST /api/empresas` aceita ilimitado.
- Subscription model (`prisma/schema.prisma:1717`) tem `planId String` mas não bloqueia features (só `EXPIRED` bloqueia tudo via middleware).

### 1.6 Artefato relevante já existente: `SocioPF`

Sprint 5.0.2.h já criou:
```prisma
model SocioPF {
  companyId String   // ⚠️ é PERTENCE-A-EMPRESA, não entidade própria
  nome      String
  cpf       String?
  pixKeys   String   // JSON array
  papel     String   // SOCIO | ADMINISTRADOR | FAMILIAR
}
```

**Função atual:** "lista de chaves Pix dos sócios da empresa" pra IA detectar Pix PJ↔PF nas transações. **NÃO é um perfil financeiro independente.**

**Implicação importante:** o sistema **já reconhece** que existem "pessoas físicas relacionadas a uma empresa" pra fins de classificação. Os perfis PF reais vão se conectar com isso, mas são entidades DISTINTAS.

---

## 2. Opinião técnica honesta

### 2.1 Como modelar "perfil PF" — minha recomendação

**Eu NÃO faria `Company` virar `Entity` genérica.**

Razões:
- 26 models têm `companyId` — refactor renomeando pra `entityId` toca cerca de **400+ queries**, todos os endpoints, middleware, contexts, RBAC, sidebar
- "Company" tem campos PJ-específicos: `cnpj @unique`, `taxRegime`, `Supplier`, `Customer`, `Employee`, `TaxProfile`, `CompanyInvite`, regimes tributários
- PF NÃO tem fornecedor/cliente/funcionário/regime tributário — forçar abstração genérica obriga 9-12 campos nullable que só PJ usa
- O **princípio de produto** (Entidade Contábil PF ≠ PJ) é **traído** se tudo virar "Entity". Tratamento legal diferente, alíquota diferente, regras de ponte diferentes.

**Eu também NÃO faria PF como "Company com flag `isPF`".**

Razões:
- Constraint `cnpj @unique` quebra (PF não tem CNPJ — só CPF)
- Risco de bug futuro: query esquece de filtrar `WHERE isPF = false` e mistura PJ+PF num relatório consolidado
- "Tudo é Company" mancha o domínio — DRE/regimes/funcionários ficam visíveis em perfil PF

#### ✅ Recomendação: **`PersonalProfile` como model SEPARADO** (paralelo a `Company`)

```prisma
model PersonalProfile {
  id        String  @id @default(cuid())
  cpf       String? // NÃO unique — multiplos perfis por CPF NÃO permitido, mas null permite
  name      String  // "Yussef", "Filho Pedro", "Filha Ana"
  type      String  @default("OWN")  // OWN | DEPENDENT | SHARED
  birthDate DateTime?
  isActive  Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // RBAC: quem gerencia esse perfil
  users               UserPersonalProfile[]  // N:N similar a UserCompany

  // Dados financeiros próprios
  bankAccounts        PersonalBankAccount[]
  transactions        PersonalTransaction[]
  categories          PersonalCategory[]

  // Ponte PJ→PF: transações vindas de uma empresa (pró-labore/lucros)
  bridgesFrom         PJtoPFBridge[]
}
```

**Por quê `PersonalBankAccount` separada de `BankAccount`** (não compartilhar):
- `BankAccount.companyId NOT NULL` — não dá pra forçar nullable sem refactor pesado
- Schemas separados mantêm constraint forte: "uma conta pertence a UMA entidade (PF ou PJ), nunca ambas"
- Reuso de UI/lógica via **componentes/libs genéricas** (parametrizadas pelo dono), NÃO via schema unificado

**Lib compartilhada (parametrizada):**
```
lib/balance/*    — já é genérico (não depende de Company)
lib/cashflow/*   — refactor pequeno: parametrizar `companyId | profileId`
lib/dre/*        — SÓ PJ (PF não tem DRE técnico — tem Fluxo Pessoal)
lib/transfers/*  — refactor: aceita transferência entre contas DA MESMA entidade (PJ OU PF)
```

### 2.2 Impacto no código existente

#### Mudanças NECESSÁRIAS (mas LOCALIZADAS):
1. **EmpresaContext → EntityContext** — generaliza pra suportar PF OU PJ como "espaço de trabalho atual"
2. **Sidebar + WorkspaceSwitcher** — UI mostra ambos os tipos com ícones diferentes (Building2 vs Users)
3. **Roteamento novo paralelo:** `/perfis/[id]/*` espelhando estrutura `/empresas/[id]/*` (mas com SET REDUZIDO de páginas — sem DRE, sem fornecedores, sem regime tributário)
4. **lib/planos/config.ts** — adicionar `perfisPF: number` + plano PF novo
5. **Signup flow** — opção "PF apenas" vs "PJ" (afeta UX inicial)
6. **Subscription/billing** — plano PF não precisa CNPJ na cobrança Asaas (já temos `User.cpfCnpj`, então OK)

#### Mudanças que NÃO acontecem (proteção dos dados):
- **`Company`, `BankAccount`, `Transaction` (PJ) ficam intactos** — zero migration destrutiva
- **5 users + 2663 transações reais (profit, Cacula) intocados**
- **Subscription model + Sprint 3A/3B/3C** continuam funcionando (cobrança PF reusa mesmo Asaas/checkout)
- **RBAC PJ continua intacto** — RBAC PF é estrutura paralela (mais simples — só 2 níveis: OWNER e VIEWER)

### 2.3 Ponte PJ→PF — como modelar

#### ✅ Recomendação: **2 transações pareadas com link de ponte**

```prisma
model PJtoPFBridge {
  id String @id @default(cuid())

  // Lado PJ: a Transaction de saída da empresa
  pjTransactionId String  @unique
  pjTransaction   Transaction @relation(fields: [pjTransactionId], references: [id])

  // Lado PF: a transação de entrada no perfil PF
  pfTransactionId   String  @unique
  pfTransaction     PersonalTransaction @relation(fields: [pfTransactionId], references: [id])

  // Tipo da retirada (impacto contábil/fiscal):
  // PRO_LABORE       — salário do sócio (INSS + IRPF retidos pela empresa)
  // DISTRIBUICAO     — distribuição de lucros (isento até R$50k/mês em 2026)
  // REEMBOLSO        — reembolso de despesa (não é renda)
  // ADIANTAMENTO     — adiantamento (compromisso de retorno)
  // RETIRADA_SOCIOS  — retirada genérica (Yussef classifica manualmente)
  kind String

  createdAt DateTime @default(now())

  @@index([pjTransactionId])
  @@index([pfTransactionId])
  @@map("pj_to_pf_bridges")
}
```

**Por que 2 transações em vez de "uma só compartilhada":**
- Princípio da Entidade preservado: cada lado tem sua transação, sua data, seu valor, sua categoria
- DRE PJ (lado PJ) mostra como `Despesas com Pessoal` ou `Distribuição` — diferente de "saída de caixa"
- Fluxo Pessoal PF (lado PF) mostra como `Receita pessoal: pró-labore`
- Auditoria forte: cada lado tem ID próprio + categoria própria + status próprio (uma pode estar reconciliada, a outra pendente)
- Compatível com o `transferGroupId` que já existe (mesma filosofia)

**Filtragem em relatórios:**
- DRE PJ: `Transaction.type !== 'TRANSFER'` (já é assim) + considera tx de ponte normalmente como despesa
- Fluxo PF: inclui PFTransaction normalmente
- Consolidado da família: queries futuras

**UX da ponte:**
- No PJ, ao classificar uma saída como "Distribuição/Pró-labore", se houver perfil PF ativo do usuário, o sistema **sugere** criar a ponte com 1 clique
- Quem confirma o destino pode escolher: "vai pro meu perfil" / "vai pro perfil do meu filho" / "não criar perfil" (deixa só no PJ)

### 2.4 Multi-perfis / família — modelo de permissão

#### ✅ Recomendação: **Reusar conceito RBAC mas SIMPLIFICADO**

PJ tem RBAC complexo (5 roles + permissions granulares + Roles custom) — necessário porque empresa tem contador externo, time financeiro, etc.

PF é mais simples: ou você gerencia totalmente OU você só vê.

```prisma
model UserPersonalProfile {
  id        String  @id @default(cuid())
  userId    String
  profileId String

  // OWNER  — gerencia completo (pai gerenciando perfil do filho menor)
  // OWN    — é o dono do perfil (titular adulto, gerencia o próprio)
  // VIEWER — só vê (mãe acompanha gastos do filho mas não edita)
  // Sem ADMIN/ACCOUNTANT etc — overkill pra PF
  role String

  createdAt DateTime @default(now())

  user    User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  profile PersonalProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([userId, profileId])
  @@map("user_personal_profiles")
}
```

**Cenário típico (família):**
- Yussef (`User`) tem `UserPersonalProfile` OWNER pra perfil "Yussef", "Filho Pedro" (menor), "Filha Ana" (menor)
- Esposa do Yussef (`User` separado, ou convidada via mesmo email?) tem `UserPersonalProfile` VIEWER pros mesmos perfis
- Filho Pedro (quando crescer e tiver conta própria) — Yussef pode "transferir ownership" do perfil

**Decisão aberta pro Yussef:**
1. Compartilhamento entre Users: o filho cria sua própria `User` e Yussef "delega" o perfil? Ou Yussef gerencia tudo do mesmo user?
2. Convites: vai existir "convidar membro da família"? (similar a `CompanyInvite`)

**Minha sugestão MVP:** começar com **1 User = N perfis PF próprios + dependentes**. Sem convites entre users na 1ª fatia. Convites/compartilhamento real entre usuários ficam pra fatia posterior (alvo "pai gerencia o filho" cobre 90% do uso inicial).

### 2.5 O que faria DIFERENTE / RISCOS / SIMPLIFICAÇÕES

#### 🎯 Sugestões além do que vocês planejaram

**A) Reusar conceitos já implementados mas evitar acoplamento ao Company:**
- `Subscription` aponta pra `User` (não pra empresa) — pagamento é feito por user, não por empresa. **Plano PF se encaixa naturalmente** sem mexer no schema de Subscription.
- O `EmpresaContext` precisa evoluir pra `WorkspaceContext` com 2 modos: `'pj' | 'pf'`. Vou chamar de `WorkspaceContext` no resto deste doc.

**B) Sidebar dual:**
- Switcher de workspace mostra duas seções claras: "Empresas" (lista PJ) e "Pessoal" (lista perfis PF)
- Sidebar muda dinamicamente o set de itens conforme tipo do workspace ativo (PJ mostra DRE/Fornecedores; PF mostra Fluxo Pessoal/Metas)
- **Simplificação esperta:** o conjunto de páginas de PF é **MUITO menor** (~6-8 páginas vs ~34 de PJ). PF não tem DRE, Fornecedores, Funcionários, TaxProfile, AI Tributária, regimes.

**C) IA Contadora compartilhada (com contexto):**
- O pipeline IA já existe pra classificar transação. Reusa pra PF MUDANDO O PROMPT (categorias e few-shot do contexto PF) — `lib/ai-categorizer/claude-prompt.ts` pode receber `entityType`.
- Plano de contas PF é mais simples: Alimentação/Transporte/Moradia/Saúde/Lazer/Educação/Investimentos vs categorias contábeis BRA do PJ.

**D) Detecção automática da ponte:**
- A IA já detecta Pix PJ↔PF via `SocioPF` (Sprint 5.0.2.h). Quando criar `PersonalProfile`, o sistema pode **auto-criar ou linkar** o `SocioPF` correspondente. Quando o usuário tiver os dois lados (PJ + PF) e fizer um Pix de R$ 10k da empresa pro CPF dele, a IA propõe "criar ponte de Distribuição de Lucros?".
- **Esse é o diferencial gigante que nenhum concorrente faz.** Mobills só vê PF, Conta Azul só vê PJ. Nós vemos os DOIS LADOS e fazemos a ponte com IA + 1 clique.

**E) Risco que vocês não mencionaram — Reforma Tributária 2026:**
- A reforma trata diferente os tipos de retirada (PJ→PF) pra fins de IBS/CBS. Vale modelar `PJtoPFBridge.kind` com enum aberto pra adicionar tipos novos depois (ex: `DIVIDENDO_QUALIFICADO`, `DIVIDENDO_ORDINARIO`). Não bloqueador, só registra.

**F) Risco moderado — Subscription billing:**
- O plano PF de R$ 9,99 vai exigir Pix one-off de R$ 9,99 (taxa Asaas) ou cartão recorrente. **Pix de R$ 9,99 NÃO compensa pela taxa Asaas** (mínimo ~R$ 1 + 0,99% = ~R$ 1,10 por transação = 11% do plano). Recomendo:
  - Plano PF mensal **só cartão recorrente** (sem opção Pix)
  - Ou Pix com ciclo trimestral (R$ 29,97) / anual (R$ 99,90) — taxa diluída
  - Decisão de produto, não bloqueador técnico

**G) Simplificação esperta — Plano de contas PF padrão único:**
- PJ tem 195 categorias por setor (academia/restaurante/loja). É complexo.
- PF tem um único plano de contas padrão (Alimentação/Moradia/Transporte/Saúde/Lazer/Educação/Investimentos/Salário/Outros). User pode customizar mas começa pronto.
- ~12-18 categorias default — muito mais simples que PJ.

**H) Risco crítico — Privacy entre PF e PJ:**
- Empregado da empresa NÃO pode ver perfil PF do dono. Isso já é garantido porque `UserCompany ≠ UserPersonalProfile` (estruturas separadas).
- MAS: se a IA detecta uma transação PJ→PF como "pró-labore do João", isso aparece no PJ pra QUEM TEM ACESSO ao PJ (incluindo contador). Já é o caso hoje com `SocioPF` — sem regressão.
- Recomendação: na UI da empresa, mostrar "Distribuição de lucros · sócio Yussef" (sem expor o `PersonalProfile.id`). Pra ver o perfil PF do Yussef, precisa ter `UserPersonalProfile` ativo.

#### ⚠️ Riscos altos

1. **Confusão mental do usuário** entre "estou na empresa X" e "estou no perfil pessoal Y". Mitigação: WorkspaceSwitcher visualmente FORTE com cores/ícones distintos (azul PJ vs verde PF, por exemplo). Header indica claramente o contexto.
2. **Multi-tenant nas queries** — adicionar `profileId` como filtro paralelo a `companyId`. RISCO de query esquecer o filtro → vazamento entre perfis PF. Mitigação: helper de query igual aos `lib/cashflow/query.ts` que centraliza filtros.
3. **Conciliação PJ↔PF** — quando o Pix sai do PJ e cai no PF, são DUAS transações no banco real (uma OFX no extrato PJ, outra no extrato PF). Sistema precisa **conciliar** elas via `PJtoPFBridge`. Risco: dupla contagem se conciliação falha. Mitigação: marcador visual `🔗 ponteado` na UI + audit log da ponte.
4. **DRE PJ não pode inflar com transações de ponte** — saída do PJ pra PF É despesa real do PJ (ou distribuição). Não é "transferência interna" como o `TRANSFER` do Sprint 0.5. Modelar como `type='DEBIT'` normal + linkado por `PJtoPFBridge`. DRE conta como despesa/distribuição conforme `kind`.

---

## 3. Riscos consolidados

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | Vazamento de dados entre perfis PF (query sem filtro) | Média | Crítico (LGPD) | Helper de query centralizado (igual `lib/cashflow/query.ts`); RBAC enforcement na lib |
| 2 | Confusão UX (user perdido entre PJ/PF) | Alta | Médio | WorkspaceSwitcher visualmente forte; cor/ícone distintos |
| 3 | Dupla contagem PJ↔PF se ponte falha | Média | Alto | UNIQUE constraint em `pjTransactionId` + `pfTransactionId`; transaction atomic na criação |
| 4 | Refactor de Company quebra dados reais | Baixa (com modelo separado) | Crítico | **Não refatorar** — `PersonalProfile` paralelo; migrations 100% aditivas |
| 5 | Plano PF R$ 9,99 não cobre taxa Asaas em Pix | Alta (matemática) | Médio | Só cartão recorrente (ou Pix anual R$ 99,90) |
| 6 | RBAC PJ contamina conceito de RBAC PF | Média | Médio | `UserPersonalProfile` é estrutura **separada** com 3 roles simples, NÃO usa `Role`/`RolePermission` do PJ |
| 7 | Reforma Tributária 2026 muda regras de retirada | Média | Médio | `PJtoPFBridge.kind` enum aberto; adicionar novos tipos sem migration destrutiva |
| 8 | Dashboard "consolidado família" expõe dados sensíveis | Baixa | Alto | Só renderiza perfis em que user tem `UserPersonalProfile` ativo |

### 🛡️ Proteção dos dados atuais (5 users + 2663 transações)

- **Todas as migrations propostas são ADITIVAS** — só CREATE TABLE em models novos
- **Zero ALTER em `Company`, `Transaction`, `BankAccount`, `Category`, `User`, `Subscription`**
- **Backup `pg_dump -Fc` ANTES de qualquer migration** (igual fizemos no 3C)
- **Cada Fatia tem suas próprias migrations isoladas** — rollback granular se algo der errado
- **Multi-tenant existente intocado** — `companyId` permanece igual em todo lugar

---

## 4. Decisões fechadas (02/06/2026)

1. ✅ **`PersonalProfile` paralelo a `Company`** (não unificar como `Entity`, não fazer `Company.isPF`)
2. ✅ **`PersonalBankAccount` separada** de `BankAccount`
3. ✅ **Ponte = 2 transações pareadas + `PJtoPFBridge`** (preserva Princípio da Entidade)
4. ✅ **Ordem de fatias aprovada** com 1 ajuste crítico: **cartão de crédito vira Fatia 2 dedicada** (peça central PF no Brasil)
5. ✅ **Família MVP: 1 User gerencia N perfis** (próprios + dependentes). Convites entre users ficam pra Fatia 5.
6. ✅ **Plano PF = R$ 19,99/mês** (não 9,99). Suporta 3 modais de pagamento (ver §7 — matemática Asaas revisada).
7. ✅ **Onboarding: pergunta PF/PJ APÓS cadastro** (cadastro atual continua intacto — cria User+Subscription; tela pós-cadastro escolhe o caminho).

---

## 5. Cartão de crédito — modelagem (Fatia 2)

### 6.1 O que JÁ existe no sistema?

**ZERO infraestrutura de cartão hoje.** Verificações:
- ❌ Nenhum model `CreditCard` / `Invoice` / `Fatura` / `Installment` / `Parcela`
- `BankAccount.accountType` aceita `CHECKING` (default) — não tem `CREDIT_CARD`
- `RecurringSchedule` faz recorrência (assinatura mensal) — **NÃO** modela parcelamento Nx
- `parcelaDeduzir` no schema é da fórmula do Simples Nacional (falso positivo)
- Parser OFX não distingue cartão (`CCSTMTRS` vs `BANKACCTFROM`)

**Conclusão:** Fatia 2 vai criar do zero, sem refactor. Aditivo puro.

### 6.2 Modelagem técnica recomendada

#### Por que cartão NÃO é `BankAccount`

- Conta corrente tem **saldo** (positivo ou negativo dentro do limite); cartão tem **dívida + limite disponível** (matemática diferente)
- Tx no extrato bancário = data efetiva; tx no cartão = competência (data da compra) **separada** do pagamento da fatura
- Cartão tem **fatura** (Invoice) como entidade intermediária — bancário não tem
- Parcelamento Nx é nativo do cartão; bancário não tem
- Forçar `BankAccount.accountType='CREDIT_CARD'` cria 5+ campos nullable só pra cartão e código condicional ruim

#### Schema proposto (3 models novos)

```prisma
model CreditCard {
  id          String @id @default(cuid())
  profileId   String              // Fatia 2 SÓ PF; cartão PJ vem futuro

  name        String              // "Nubank Roxinho", "Itaú Personnalité"
  bankName    String?
  lastDigits  String?             // últimos 4 dígitos (auditoria)
  brand       String?             // VISA | MASTERCARD | ELO | AMEX | HIPERCARD

  creditLimit Float               // limite total do cartão
  closingDay  Int                 // 1-31: dia do fechamento
  dueDay      Int                 // 1-31: dia do vencimento

  // Conta que paga a fatura por padrão (PersonalBankAccount.id).
  // null = user escolhe a cada pagamento.
  defaultPaymentAccountId String?

  // Regra do fechamento: compra NO dia do fechamento entra na fatura
  // ATUAL (fecha hoje) ou na PROXIMA (próximo mês). Default ATUAL
  // (regra geral da maioria). User pode ajustar por cartão se conhecer o dele.
  closingDayRule String @default("ATUAL")  // ATUAL | PROXIMA

  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  profile      PersonalProfile        @relation(fields: [profileId], references: [id], onDelete: Cascade)
  invoices     CreditCardInvoice[]
  transactions PersonalTransaction[]

  @@index([profileId])
  @@map("credit_cards")
}

model CreditCardInvoice {
  id           String @id @default(cuid())
  creditCardId String

  // Mês de competência da fatura (YYYY-MM do mês do FECHAMENTO).
  // Ex: cartão Nubank fecha dia 5; fatura "2026-06" fecha em 05/06/2026.
  reference    String

  closingDate  DateTime            // data exata do fechamento
  dueDate      DateTime            // data exata do vencimento

  totalAmount  Float @default(0)   // soma das transações vinculadas
  paidAmount   Float @default(0)   // quanto já foi pago

  // OPEN     — date <= closingDate (ainda aceita lançamentos)
  // CLOSED   — closingDate < now <= dueDate (aguarda pagamento)
  // PAID     — paga total
  // PARTIAL  — paga parcial (rotativo + juros na próxima)
  // OVERDUE  — vencida sem pagar total
  status       String @default("OPEN")

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  creditCard   CreditCard            @relation(fields: [creditCardId], references: [id], onDelete: Cascade)
  transactions PersonalTransaction[]

  @@unique([creditCardId, reference])
  @@index([creditCardId, status])
  @@map("credit_card_invoices")
}
```

E `PersonalTransaction` (criada na Fatia 1) ganha campos opcionais na Fatia 2:
```prisma
// (acrescentar — Fatia 2):
creditCardId        String?    // se for tx de cartão
creditCardInvoiceId String?    // qual fatura
installmentNumber   Int?       // 1 da parcela atual (1, 2, 3, ...)
installmentTotal    Int?       // total de parcelas da compra
installmentGroupId  String?    // une as N parcelas de uma compra Nx (UUID gerado na compra)
```

#### Lógica de inserção (compra Nx → N transações nas faturas certas)

```
1. Compra 600 reais em 6x em 28/01/2026, cartão Nubank (fecha dia 5)
2. Sistema calcula:
   - Parcela 1 (100 R$): data=28/01 → fatura "2026-02" (fecha 05/02/2026)
   - Parcela 2 (100 R$): data=28/02 → fatura "2026-03" (fecha 05/03/2026)
   - Parcela 3 (100 R$): data=28/03 → fatura "2026-04"
   - ... etc até parcela 6
3. Cria 6 PersonalTransaction, todas com:
   - installmentGroupId = mesmo UUID
   - installmentTotal = 6
   - installmentNumber = 1, 2, 3, 4, 5, 6
   - description = "Compra Nx · 1/6", "2/6", etc
4. Auto-vincula cada uma à CreditCardInvoice correspondente (cria invoice se não existe)
```

#### Pagamento da fatura

```
1. Fatura "2026-06" totalAmount = R$ 1.580
2. User clica "Pagar fatura" no app → escolhe conta + valor (default = total)
3. Sistema cria:
   - PersonalTransaction DEBIT na PersonalBankAccount escolhida (valor = pagamento)
   - Atualiza CreditCardInvoice.paidAmount += valor
   - Se paidAmount == totalAmount → status = PAID
   - Se paidAmount > 0 mas < totalAmount → status = PARTIAL
   - Se status = PARTIAL ao virar do mês → joga saldo restante + juros configurados
     como "Rotativo" na fatura SEGUINTE (PersonalTransaction de débito)
```

### 6.3 Pegadinhas e riscos do cartão

| # | Pegadinha | Solução |
|---|---|---|
| 1 | Compra no DIA do fechamento — entra em qual fatura? | `CreditCard.closingDayRule` configurável (default ATUAL); user ajusta por cartão se conhecer o dele |
| 2 | Compra parcelada com virada de mês | Cada parcela calcula sua própria fatura a partir de `dataCompra + (N-1) meses` vs `closingDay`. Pegadinha: fevereiro tem 28/29 dias → `addMonths` com clamp (igual já fazemos em `lib/asaas/webhook.ts:calculateNextPeriodEnd`) |
| 3 | Estorno de compra parcelada | Cancela TODAS as parcelas futuras (`installmentGroupId` permite UPDATE em lote). Parcelas já COBRADAS em faturas pagas viram crédito que abate próxima fatura |
| 4 | Pagamento parcial (rotativo) | `status=PARTIAL` + auto-gera tx "Rotativo + juros" na fatura seguinte. Juros NÃO calculamos no MVP (user informa); Fatia futura pode automatizar via taxa do cartão |
| 5 | Compra internacional em USD | **Fora da Fatia 2 MVP**. Modelar como `currency` + `exchangeRate` opcional. Stretch goal |
| 6 | Cashback/pontos | **Fora do MVP**. Tratamento contábil é "saída zerada" — não impacta caixa real |
| 7 | Anuidade | Vira `RecurringSchedule` reusado (cobrança recorrente fixa) |
| 8 | Limite disponível em tempo real | Derivado, não armazenado: `creditLimit - sum(faturas OPEN/CLOSED) - sum(parcelas futuras)`. Cálculo em query, não no schema |
| 9 | Múltiplos cartões | `CreditCard.profileId` já N:1 — perfil pode ter N cartões; UI consolida visão |
| 10 | Importar OFX/Excel de cartão | **Fatia 3** (OFX/IA PF). Parser OFX precisa entender `CCSTMTRS` (formato cartão Asaas/Nubank) |

### 6.4 Concordo com cartão como Fatia 2 dedicada?

**SIM, fortemente.** Razões:
- No Brasil, ~60-70% dos gastos PF passam no cartão (Mobills/Organizze fizeram a pesquisa). Sem cartão decente, o PF não tem utilidade real
- OFX import (Fatia 3) precisa do cartão MODELADO ANTES de importar `CCSTMTRS` — ordem natural
- Yussef como 1º user vai usar cartão imediatamente — sem isso, ele abre o app e vê "metade do gasto pessoal sumiu"
- Cartão é tecnicamente diferente o suficiente pra merecer uma Fatia exclusiva (3 models novos + lógica de parcelamento + UI de fatura)
- Pegadinhas (fechamento/parcelamento/rotativo) precisam de testes rigorosos → fatia separada = mais espaço pra testes

---

## 6. Matemática plano PF R$ 19,99 revisada

Taxas Asaas sandbox documentadas (valores típicos — confirmar com gerente Asaas antes de prod):

| Método | Taxa fixa | Taxa % | Total R$ 19,99 | Líquido CAIXAOS | Margem |
|---|---|---|---|---|---|
| Pix mensal | R$ 0,99 | 0,99% | R$ 1,19 | R$ 18,80 | 94,0% |
| Cartão recorrente | R$ 0,49 | 2,99% | R$ 1,09 | R$ 18,90 | 94,5% |
| Pix ANUAL R$ 199,90 (20% off) | R$ 0,99 | 0,99% | R$ 2,97 | R$ 196,93 | 98,5% |

**Conclusão:** R$ 19,99 viabiliza **todos os 3 modais** com margem boa. Recomendo oferecer os 3 (concordância com você).

UX sugerida:
- Default destacado: **cartão mensal R$ 19,99**
- Destaque secundário: **Pix anual R$ 199,90** (badge "Economize R$ 39,98 + sem mensalidade")
- Discreto: **Pix mensal R$ 19,99** (sem destaque visual)

---

## 7. Nova ordem de fatias (cartão como Fatia 2)

| Fatia | Foco | Dias | Por que essa ordem |
|---|---|---|---|
| **1** | Fundação PF (perfil + contas + tx + categorias + workspace switcher + onboarding PF/PJ) | 5-7 | Base SEM cartão pra estabilizar a infra dual PJ/PF antes do cartão complicar |
| **2** ⭐ | **CARTÃO ROBUSTO** (CreditCard + Invoice + Installment + lógica fechamento/parcelamento/rotativo) | 7-9 | Peça central PF no Brasil. Modelado antes do OFX porque OFX importará tx pra dentro do cartão |
| **3** | OFX import + IA classificação PF (extrato bancário + extrato cartão `CCSTMTRS`) | 5-6 | Reusa `lib/ofx` e `lib/ai-categorizer`. Precisa cartão modelado pra parser CC |
| **4** ⭐ | **Ponte PJ→PF** (DIFERENCIAL — pró-labore, dividendos, retiradas) | 6-8 | Usa `SocioPF` existente (Sprint 5.0.2.h). É o que NINGUÉM faz no mercado. |
| **5** | Família / multi-perfis compartilhados + convites entre Users | 4-5 | Cima da fundação madura |
| **6** | Plano PF R$ 19,99 + billing (cartão + Pix mensal/anual) | 3-4 | Reusa Asaas 3A/3B/3C |
| **7** | Polish: landing dual PF/PJ + onboarding adaptativo + sidebar marketing | 3-4 | Acabamento comercial |

**Total: 33-43 dias** (estimativa conservadora — sem buffer).

---

## 8. FATIA 1 DETALHADA (escopo enxuto — sem cartão)

### 9.1 Schema (5 models novos, 100% aditivos)

```prisma
model PersonalProfile {
  id        String @id @default(cuid())

  // CPF é OPCIONAL (não único — múltiplos perfis por CPF tipo "casal usa o mesmo
  // CPF pra contas conjuntas" são raros mas válidos; constraint forte só atrapalharia)
  cpf       String?
  name      String              // "Yussef", "Filho Pedro", "Filha Ana"
  type      String @default("OWN")  // OWN (titular adulto) | DEPENDENT (menor, gerenciado pelo OWN)

  birthDate DateTime?
  isActive  Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users        UserPersonalProfile[]
  bankAccounts PersonalBankAccount[]
  transactions PersonalTransaction[]
  categories   PersonalCategory[]

  // Preparado pra Fatia 2 (cartão) e Fatia 4 (ponte)
  // creditCards CreditCard[]           — adicionado na Fatia 2
  // bridgesTo   PJtoPFBridge[]         — adicionado na Fatia 4

  @@index([cpf])
  @@map("personal_profiles")
}

model UserPersonalProfile {
  id        String @id @default(cuid())
  userId    String
  profileId String

  // OWNER  — gerencia tudo (default ao criar perfil)
  // VIEWER — só lê (Fatia 5 introduz isso via convites)
  // OWN_SELF — flag opcional dizendo "este é meu próprio perfil"
  //            (útil pra distinguir o perfil do titular vs dependentes que ele gerencia)
  role String @default("OWNER")
  isSelf Boolean @default(false)  // true: é o perfil DO PRÓPRIO usuário

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user    User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  profile PersonalProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([userId, profileId])
  @@index([userId])
  @@index([profileId])
  @@map("user_personal_profiles")
}

model PersonalBankAccount {
  id            String @id @default(cuid())
  profileId     String

  name          String              // "Conta Itaú", "Nubank PF"
  bankName      String?
  bankCode      String?              // FEBRABAN code
  agency        String?
  accountNumber String?
  accountType   String @default("CHECKING")  // CHECKING | SAVINGS | DIGITAL_WALLET

  balance       Float @default(0)

  // Reuso do conceito de Sprint 0.5 (cheque especial)
  allowNegativeBalance Boolean @default(true)
  creditLimit          Float   @default(0)
  lowBalanceThreshold  Float?

  isActive  Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  profile      PersonalProfile     @relation(fields: [profileId], references: [id], onDelete: Cascade)
  transactions PersonalTransaction[]

  @@index([profileId])
  @@map("personal_bank_accounts")
}

model PersonalTransaction {
  id              String @id @default(cuid())
  bankAccountId   String?              // nullable — preparado pra PAYABLE/RECEIVABLE futuro
  categoryId      String?

  date            DateTime
  description     String
  amount          Float                // sempre positivo; sinal vem de `type`
  type            String               // CREDIT | DEBIT (TRANSFER fica pra fatia futura)
  status          String @default("RECONCILED")  // PENDING | RECONCILED | IGNORED
  origin          String @default("MANUAL")       // MANUAL | OFX | AI (OFX/AI vêm na Fatia 3)
  externalId      String?
  dedupHash       String?

  notes           String?

  // Campos preparados pra Fatias futuras (NULLABLE — não usados na Fatia 1):
  // creditCardId        String?    — adicionado na Fatia 2 (cartão)
  // creditCardInvoiceId String?    — adicionado na Fatia 2
  // installmentGroupId  String?    — adicionado na Fatia 2
  // bridgeId            String?    — adicionado na Fatia 4 (ponte PJ→PF)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  bankAccount PersonalBankAccount? @relation(fields: [bankAccountId], references: [id], onDelete: SetNull)
  category    PersonalCategory?    @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  // FK reversa pra perfil — derivada via bankAccount; mas precisamos
  // pra queries diretas (ex: "todas tx do perfil X"). Solução:
  // campo profileId redundante + check via app-layer + onDelete: Cascade.
  profileId   String
  profile     PersonalProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId, date])
  @@index([bankAccountId])
  @@index([categoryId])
  @@map("personal_transactions")
}

model PersonalCategory {
  id        String @id @default(cuid())
  profileId String?    // NULL = categoria global (template default)

  name      String              // "Alimentação", "Salário", etc
  // INCOME (receita) | EXPENSE (despesa)
  type      String

  color     String?              // hex pra UI
  icon      String?              // lucide icon name
  isDefault Boolean @default(false)   // categoria do plano de contas padrão

  // Hierarquia opcional (ex: "Alimentação" > "Mercado", "Restaurante")
  parentId  String?
  parent    PersonalCategory?   @relation("PersonalCategoryParent", fields: [parentId], references: [id], onDelete: SetNull)
  children  PersonalCategory[]  @relation("PersonalCategoryParent")

  isActive  Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  profile      PersonalProfile?      @relation(fields: [profileId], references: [id], onDelete: Cascade)
  transactions PersonalTransaction[]

  @@index([profileId])
  @@index([parentId])
  @@map("personal_categories")
}
```

### 9.2 Migration (100% aditiva)

- Arquivo: `prisma/migrations/<TS>_pf_fatia_1_fundacao/migration.sql`
- 5× `CREATE TABLE` (personal_profiles, user_personal_profiles, personal_bank_accounts, personal_transactions, personal_categories)
- ~12× `CREATE INDEX` (perf de queries)
- FKs com `onDelete: Cascade` (apaga em cascata se profile excluído) e `SetNull` (preserva tx se category deletada)
- **ZERO ALTER em models PJ existentes** — não toca em `Company`, `User`, `Transaction`, `BankAccount`, `Category`, `Subscription`
- Backup `pg_dump -Fc` obrigatório ANTES (igual fizemos no 3C)
- Counts pré/pós: confirma `users`, `companies`, `transactions`, `subscriptions` inalteradas

### 9.3 Páginas/telas (6 telas novas)

| # | Rota | Conteúdo | Reusa de PJ |
|---|---|---|---|
| 1 | `/perfis` | Lista de perfis PF do user (cards com saldo total + última atividade) | Pattern `app/(dashboard)/empresas/page.tsx` (lista) |
| 2 | `/perfis/novo` | Form: nome + CPF opcional + tipo (próprio/dependente) + nascimento opcional | Pattern `app/(dashboard)/empresas/nova/page.tsx` (form simples) |
| 3 | `/perfis/[id]` | Dashboard PF: saldo consolidado + entrada/saída 30d (sparkline reusa) + top 5 categorias gastas + atalho "Nova transação" | Reusa `Sparkline.tsx`, `KPICard.tsx` (Sprint 1 dashboard); donut top categorias (`TopCategoriesDonut`) |
| 4 | `/perfis/[id]/contas` | Lista contas PF + criar/editar (suporta saldo negativo igual PJ Sprint 0.5) | Pattern `app/(dashboard)/empresas/[id]/contas/page.tsx`; reusa `conta-form.tsx` (parametriza tenant) |
| 5 | `/perfis/[id]/transacoes` | Listar/filtrar/criar/editar transações; debounce + URL persistente | Reusa atalhos de teclado + tabela + filtros do PJ (Sprint 3.0.4) — parametrizar tenant |
| 6 | `/perfis/[id]/categorias` | Gerenciar plano de contas PF (CRUD + restaurar template) | Pattern `app/(dashboard)/empresas/[id]/categorias/page.tsx` simplificado |

**Páginas NÃO entram na Fatia 1** (deixadas pra fatias seguintes):
- ❌ Cartão de crédito → Fatia 2
- ❌ Import OFX → Fatia 3
- ❌ Regras IA aprendidas → Fatia 3
- ❌ Ponte PJ→PF → Fatia 4
- ❌ Convites/permissões → Fatia 5
- ❌ Cobrança → Fatia 6
- ❌ Onboarding marketing PF na landing → Fatia 7

### 9.4 WorkspaceSwitcher (evolução do EmpresaContext)

**Refactor cosmético** do `lib/contexts/empresa-context.tsx`:
- Rename → `lib/contexts/workspace-context.tsx` (mantém alias pra zero quebra durante transição)
- Estado novo: `workspaceType: 'pj' | 'pf'` + `currentEmpresaId | currentProfileId`
- Switcher tem 2 seções claras:
  - **Empresas** (ícone `Building2`, cor primária azul `bg-blue-500/10`)
  - **Pessoal** (ícone `Users`, cor verde `bg-emerald-500/10`)
- Cada item mostra nome + indicador colorido
- Header global: barra fina superior muda cor conforme contexto ativo (azul PJ vs verde PF) — sinalização visual forte

**Sidebar adaptativa** (`global-sidebar.tsx`):
- Quando `workspaceType=pj`: items atuais (Dashboard, Transferências, DRE, Fornecedores, Funcionários, Tributário, etc)
- Quando `workspaceType=pf`: subset reduzido (Dashboard, Contas, Transações, Categorias) — **MUITO menos páginas que PJ**
- Items "globais" (Cupons, Configurações) ficam disponíveis em ambos

**Cookie httpOnly:** evolui `POST /api/empresas/atual` pra também aceitar `profileId`. Server Components leem qual workspace ativo.

### 9.5 Onboarding (pergunta PF/PJ APÓS cadastro)

**Fluxo atual:** cadastro cria User + Subscription TRIAL → redirect `/dashboard` ou `/empresas/nova`.

**Fluxo novo Fatia 1:**
1. Cadastro continua igual (intacto — User + Subscription TRIAL)
2. APÓS cadastro, primeira tela é `/onboarding` (nova):
   - "Como você quer começar com o CAIXAOS?"
   - 3 opções (cards grandes):
     - 🏢 **Tenho uma empresa** → `/empresas/nova` (fluxo atual)
     - 👤 **Sou pessoa física** → `/perfis/novo` (Fatia 1)
     - 🔀 **Os dois** → cria perfil PF "Meu pessoal" automático + redirect `/empresas/nova` (depois user vê os 2 no switcher)
3. Existing users (5 contas atuais) **NÃO veem essa tela** — só users novos (gating via `User.createdAt > 2026-06-XX` OU via flag `onboardingCompleted`)

**Tela `/onboarding` é "fechada" assim que user toma decisão.** Não precisa voltar depois.

### 9.6 Plano de contas PF default (15 categorias)

**Receitas (INCOME):**
1. Salário
2. Pró-labore/Lucros (placeholder pra Fatia 4 da ponte — `kind` aberto)
3. Outros recebimentos

**Despesas (EXPENSE):**
4. Alimentação (Mercado + Restaurante como subcategorias se quiser)
5. Transporte (combustível, Uber, transporte público)
6. Moradia (aluguel, condomínio, IPTU)
7. Contas (luz, água, internet, telefone)
8. Saúde (plano, médico, farmácia)
9. Educação (mensalidade, cursos, livros)
10. Lazer (cinema, streaming, viagens, restaurantes)
11. Vestuário
12. Investimentos (aporte em corretora — não é despesa real mas user trata como saída)
13. Cartão de crédito (placeholder pra Fatia 2 — pagamento de fatura)
14. Empréstimos (parcelas)
15. Outros

**Implementação:** seed em `prisma/seed.ts` cria essas 15 como `isDefault=true` + `profileId=null` (templates globais). Ao criar `PersonalProfile`, o sistema COPIA pro `profileId` específico (igual o PJ faz). User pode customizar/desabilitar.

### 9.7 Testes (alvo: 50-70 testes novos)

**Puros (sem DB):**
- `personal-profile-types.test.ts` — type guards OWN/DEPENDENT
- `personal-category-defaults.test.ts` — lista das 15, dedup, INCOME vs EXPENSE
- `personal-balance.test.ts` — reuso de `lib/balance` parametrizado (testa que funciona com `PersonalTransaction`)

**Integração endpoint (igual webhook 3C — Prisma real SQLite dev):**
- CRUD `/api/perfis` (criar/listar/editar/deletar perfil)
- CRUD `/api/perfis/[id]/contas` (contas PF)
- CRUD `/api/perfis/[id]/transacoes` (transações)
- CRUD `/api/perfis/[id]/categorias`
- Multi-tenant rigoroso: user A não pode ver perfil de user B (10+ testes de isolamento)
- Sem `UserPersonalProfile` → 403/404 (não authorize)

**UI smoke:**
- Workspace switcher renderiza ambos PJ + PF
- Sidebar muda conforme contexto
- `/onboarding` página renderiza 3 opções

### 9.8 O que FICA FORA da Fatia 1 (lista explícita pra não inchar)

- ❌ **Cartão de crédito** (modelado na Fatia 2 — 3 models novos + lógica de fatura/parcelamento)
- ❌ **Import OFX pra contas PF** (Fatia 3 — reusa `lib/ofx` mas precisa adaptar)
- ❌ **IA classificação de transações PF** (Fatia 3 — prompt parametrizado)
- ❌ **Regras aprendidas PF** (Fatia 3 — `AiLearningRule` ganha `profileId`)
- ❌ **TRANSFER entre contas PF do mesmo perfil** (futura — análogo ao Sprint 0.5 PJ)
- ❌ **Ponte PJ→PF** (Fatia 4 — `PJtoPFBridge` + auto-detecção via `SocioPF`)
- ❌ **Convites entre Users pra gerenciar mesmo perfil** (Fatia 5)
- ❌ **RBAC granular PF com permissions** (Fatia 5 — começa só com 2 roles OWNER/VIEWER)
- ❌ **Plano PF R$ 19,99 + cobrança** (Fatia 6 — reusa Asaas 3A/3B/3C)
- ❌ **Onboarding adaptativo na landing** (Fatia 7 — landing fala dos 2 públicos)
- ❌ **Dashboard "família consolidado"** (Fatia 5 — visão de N perfis somados)
- ❌ **Metas/orçamentos** (futura — fora da Fatia 1 inteira)
- ❌ **Cartões/cupons fidelidade** (fora do MVP completo)
- ❌ **RecurringSchedule PF** (futuro — pra assinaturas recorrentes)
- ❌ **Relatórios PF** (Fluxo Pessoal, evolução patrimônio — Fatia futura)

### 9.9 Riscos específicos da Fatia 1

| # | Risco | Mitigação |
|---|---|---|
| 1 | Vazamento entre perfis (query sem `profileId` filter) | Helper centralizado tipo `lib/cashflow/query.ts` (já existente) — refactor leve pra suportar tenant PF; testes de isolamento multi-tenant (10+ testes) |
| 2 | Confusão UX no WorkspaceSwitcher | Cor + ícone fortes (azul/Building2 vs verde/Users); barra superior do header pinta a cor do contexto ativo |
| 3 | Refactor de `EmpresaContext` quebra coisas existentes | Manter alias `useEmpresa()` durante transição; rename → `useWorkspace()` mas exports antigos continuam funcionando |
| 4 | Migration aditiva trava por algum motivo (FK errada, índice colide) | Dry-run em SQLite dev primeiro; `prisma migrate status` antes do deploy; backup + counts pré/pós |
| 5 | Sidebar adaptativa quebra páginas PJ | Defaultear pra PJ se `workspaceType` indefinido; gradualmente migrar pages-by-page |
| 6 | Onboarding ignora users existentes (5 atuais) | Gate por flag `User.createdAt > 2026-06-XX` OU adicionar `onboardingCompletedAt DateTime?` em User |

### 9.10 Duração estimada Fatia 1: 5-7 dias

Quebra:
- Dia 1: Schema + migration + seed das 15 categorias
- Dia 2: API endpoints + multi-tenant guards + lib/balance parametrizada
- Dia 3: WorkspaceContext + Switcher + Sidebar adaptativa
- Dia 4: 4 telas (lista, novo, dashboard, contas)
- Dia 5: 2 telas (transações, categorias) + onboarding
- Dia 6-7: Testes (50-70) + smoke local + buffer

---

## 9. Decisão de arquitetura: `SocioPF` × `PersonalProfile` (02/06/2026)

**Pergunta levantada por Yussef ANTES de criar o 1º perfil PF:** já existe
um `SocioPF "yussef abu zahry musa"` (CPF 600.258.890-60) cadastrado em
`/pessoas-vinculadas`. Criar um `PersonalProfile "Yussef"` com mesmo CPF
não vai duplicar / quebrar / criar bagunça?

### Resposta: NÃO. São conceitos diferentes que coexistem legitimamente.

| Aspecto | `SocioPF` (Sprint 5.0.2.h) | `PersonalProfile` (Fatia 1) |
|---|---|---|
| Função | "Como a empresa X enxerga essa pessoa" (cartão de visita interno) | "Espaço financeiro da pessoa" (carteira pessoal) |
| Vínculo | Pertence a UMA empresa (`companyId NOT NULL`) | Independente de empresas |
| UNIQUE | `(companyId, cpf)` — único POR empresa | NENHUM em `cpf` — só index pra busca |
| Tem contas/tx/categorias? | ❌ Não — é só nome + CPF + chaves Pix + papel | ✅ Sim — bankAccounts + transactions + categories |
| Quantos existem por CPF? | N (1 por empresa que a pessoa é sócia/familiar) | 1 (a vida pessoal) |
| Exemplo Yussef | 3 SocioPF (profit + cacula + itaqui — todos com CPF 600.258.890-60) | 1 PersonalProfile "Yussef" |

### Decisão (opção C — separados, conectam via CPF na Fatia 4)

**Rejeitadas:**
- ❌ Unificar SocioPF → PersonalProfile (quebra modelo: SocioPF é
  por-empresa N:1 ↔ PersonalProfile é por-pessoa 1:1; perde semântica de
  `SocioPF.papel` que só faz sentido relacionado à empresa)
- ❌ FK direta `SocioPF.personalProfileId` (acoplamento desnecessário;
  CPF já basta como elo lógico)

**Aprovada (opção C):**
- ✅ Os dois modelos coexistem sem mudança
- ✅ Conexão lógica por **CPF** (campo comum em ambos)
- ✅ Detecção Pix atual (Sprint 5.0.2.h) continua funcionando EXATAMENTE
  igual — não há mudança em `lib/pix-detection/*`
- ✅ Quando a Fatia 4 (ponte PJ→PF) chegar, vai ADICIONAR um lookup
  paralelo: além de `SocioPF.cpf`, também busca `PersonalProfile.cpf`.
  Se ambos batem → propõe ponte com 1 clique.

### Como a Fatia 4 vai construir a ponte

```
1. Pix R$ 10k sai da PROFIT pro CPF 600.258.890-60 (entra no OFX)
2. Sistema (Sprint 5.0.2.h, ATUAL):
   - Lookup em SocioPF da PROFIT por CPF → acha "Yussef sócio"
   - Classifica como Distribuição de Lucros no DRE da PROFIT
3. Fatia 4 vai ADICIONAR:
   - Lookup em PersonalProfile por CPF → acha "Yussef" (perfil pessoal)
   - Propõe: "🎯 Criar ponte? Dinheiro vai pro seu perfil 'Yussef'"
   - User aprova → cria 2 transações pareadas + PJtoPFBridge
```

### Recomendação adicional pra Fatia 4 (registrar agora)

`PJtoPFBridge` (modelo que vai aparecer na Fatia 4) terá campo opcional
`socioPFId String?` pra rastreabilidade — "essa ponte foi criada porque
o sistema reconheceu o sócio X da empresa Y". Não obrigatório (ponte
pode existir sem SocioPF — ex: user adicionou perfil PF mas não cadastrou
o SocioPF correspondente; CPF basta), mas útil pra auditoria.

Schema preview (decidido na Fatia 4):
```prisma
model PJtoPFBridge {
  id              String @id @default(cuid())
  pjTransactionId String @unique     // lado PJ
  pfTransactionId String @unique     // lado PF
  kind            String              // PRO_LABORE | DISTRIBUICAO | REEMBOLSO | ...
  // Rastreabilidade opcional — qual SocioPF disparou a detecção?
  socioPFId       String?
  socioPF         SocioPF? @relation(...)
  createdAt       DateTime @default(now())
}
```

### Implicação prática para o Yussef criar perfil agora

- ✅ Cria PersonalProfile "Yussef" com CPF 600.258.890-60 (mesmo do
  SocioPF — recomendado, facilita ponte automática)
- ✅ Os 3 SocioPF existentes (profit/cacula/itaqui) ficam INTACTOS
- ✅ Detecção Pix continua igual
- ✅ Zero retrabalho — Fatia 4 conecta sem mexer no schema atual
- ✅ Sem violação de constraint (PersonalProfile.cpf é nullable + sem UNIQUE)

---

## 10. Mapa rápido dos arquivos atuais relevantes (referência futura)

```
SCHEMA:
- prisma/schema.prisma:11    User
- prisma/schema.prisma:97    Company
- prisma/schema.prisma:155   UserCompany
- prisma/schema.prisma:169   BankAccount
- prisma/schema.prisma:208   Transaction
- prisma/schema.prisma:341   Category
- prisma/schema.prisma:658   Role
- prisma/schema.prisma:702   UserCompanyRole
- prisma/schema.prisma:1717  Subscription
- (SocioPF e EmpresaRelacionada já existem como referência Pix)

MULTI-TENANT:
- lib/contexts/empresa-context.tsx     (cliente — currentEmpresaId)
- app/api/empresas/atual/route.ts      (cookie httpOnly sync)
- components/layout/workspace-switcher.tsx
- components/sidebar/global-sidebar.tsx
- proxy.ts                              (middleware)

PLANOS/BILLING:
- lib/planos/config.ts
- lib/subscription/{access,queries,types,create-trial,apply-coupon-bonus}.ts
- app/api/subscription/checkout/{pix,cartao}/route.ts
- app/api/webhooks/asaas/route.ts

LIBS GENÉRICAS (REUSÁVEIS):
- lib/balance/*       (puro — só transações + sinal)
- lib/cashflow/*      (parametrizado por entity)
- lib/ofx/*           (parser puro)
- lib/ai-categorizer/* (prompt parametrizável)
```
