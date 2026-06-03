# Sprint Unificar Sócios + Pontes — proposta de UX

> **Status:** estudo + proposta — aguardando aprovação do Yussef.
> **Data:** 03/06/2026.
> **Tipo:** refactor de UI/navegação (ZERO migration).
> **Estimativa:** 2-3 dias.

---

## 0. TL;DR

UNIFICAR `/pessoas-vinculadas` (cadastro) + `/empresas/[id]/pontes` (movimentações) num conceito único de **Sócios** — estilo QuickBooks/Xero/Conta Azul. Sidebar fica com 1 item ("Sócios & Grupo") em vez de 2 (que confundem). Detalhe do sócio mostra cadastro + timeline de pontes recebidas + agregados num único lugar.

**ZERO mudança em dados/migration/funções existentes:**
- SocioPF model intacto
- PJtoPFBridge model intacto
- EmpresaRelacionada model intacto
- Detecção Pix continua funcionando idem (consulta SocioPF)
- Privacidade multi-sócio mantida (queries com filtro por userId)
- Endpoints atuais ficam (criamos só 1 endpoint novo agregador)

É **só reorganização de UI + sidebar + 1 endpoint agregador**.

---

## 1. Pesquisa visual dos líderes

### 1.1 QuickBooks Online (referência principal)

QuickBooks chama de **"Owners/Partners"** (ou "Members" em LLC). Padrão:

```
NAVEGAÇÃO:
├─ Banking
├─ Sales
├─ Expenses
├─ Payroll
└─ Accountant Tools
    └─ Partners ← UM lugar só

TELA "Partners":
┌─────────────────────────────────────────────────────────────┐
│ Partners                                       [+ Add]      │
├─────────────────────────────────────────────────────────────┤
│ NAME              INVESTED    DRAWS THIS YEAR    BALANCE   │
│ ─────────────────────────────────────────────────────       │
│ John Smith        $50,000     $35,000            $15,000   │
│ Jane Doe          $50,000     $32,000            $18,000   │
└─────────────────────────────────────────────────────────────┘

CLICK em "John Smith":
┌─ John Smith ────────────────────────────────────────────────┐
│ Profile: SSN, address, % ownership                          │
│                                                              │
│ Tabs: [ Overview ] [ Activity ] [ Reports ]                 │
│                                                              │
│ ACTIVITY (timeline):                                         │
│  May 28  Owner draw            -$5,000                       │
│  May 15  Distribution          -$10,000                      │
│  May 01  Contribution          +$2,000                       │
│  ...                                                          │
│ [+ Add transaction ▾]                                       │
│   ↳ Owner draw                                              │
│   ↳ Distribution                                            │
│   ↳ Contribution                                            │
│   ↳ Loan to partner                                         │
└─────────────────────────────────────────────────────────────┘
```

**Key learnings:**
- 1 item no sidebar ("Partners"), não 2
- Lista mostra **agregados** ($ investido, $ retirado, balance)
- Click → detalhe com **timeline unificada** de TODAS as movimentações
- Tipos de transação ("draw", "distribution", "contribution") são botões em **submenu** do "+ Add"
- Reports separados (Owner Equity Statement, K-1) ficam numa terceira aba

### 1.2 Xero

Padrão **Contacts → tag "Partner"**. Cada Contact tem:
- Dados pessoais
- Aba "Activity" com timeline de tx vinculadas
- Aba "Statement" (extrato cumulativo)
- Aba "Notes"

Importante: o `Contact` é MULTI-PROPÓSITO (vendor + customer + employee + partner) e a relação é só uma tag/label.

Não vamos copiar isso 100% porque nosso SocioPF é separado de Supplier/Customer — mas o padrão de tabs no detalhe é útil.

### 1.3 Conta Azul (mercado BR)

Aba **"Pessoas"** dentro do menu lateral com sub-tipo "Sócios":
- Lista sócios cadastrados
- Click → ficha do sócio com dados + histórico
- Não tem ponte PJ→PF (nossa vantagem)

Mais simples que QuickBooks, mais próximo da nossa escala.

### 1.4 Padrão comum dos 3

1. **1 item no menu** ("Owners/Partners/Sócios"), não 2
2. **Lista resumo** com agregados ($ recebido, # transações)
3. **Click → detalhe** com timeline unificada
4. **CNPJs do grupo são SEPARADOS** (Xero: Contact tipo "Related Company"; QuickBooks: "Related parties" em Reports)
5. **Botão "+ Nova transação"** dentro do detalhe do sócio (contexto preservado)

---

## 2. Mapeamento do que temos hoje

### 2.1 `/pessoas-vinculadas` (Sprint 5.0.2.h)

**Função:** cadastrar quem é quem na empresa atual.

**O que mostra:**
- **Seção "Sócios e Familiares (PF)"** — lista de SocioPF cadastrados
  - Campos: nome, CPF, papel (SOCIO/ADMINISTRADOR/FAMILIAR), chaves Pix
  - Modelo Prisma: `SocioPF`
- **Seção "Empresas Relacionadas (Mesmo Grupo)"** — lista de CNPJs do grupo
  - Campos: nomeFantasia, CNPJ, chaves Pix, tipo relação (MESMO_GRUPO/SOCIO_COMUM/CONTROLADA/CONTROLADORA)
  - Modelo Prisma: `EmpresaRelacionada`

**Onde é usado pelo sistema (NÃO PODE QUEBRAR):**
- `lib/pix-detection/detect-pix-relacionado.ts` — consulta SocioPF + EmpresaRelacionada pra detectar Pix
- `lib/pix-detection/auto-apply-pix.ts` — aplica classificação automática
- `lib/conciliation/match-internal-transfer.ts` — pareia transferências entre empresas do grupo
- `lib/categorization/build-categorize-plan.ts` — usa categoria sugerida da detecção
- `app/api/empresas/[id]/recategorize-pix/route.ts` — re-roda classificação

### 2.2 `/empresas/[id]/pontes` (Fatia 4, recém-deployada)

**Função:** ver/criar/deletar PJtoPFBridge (pareamento PJ→PF).

**O que mostra:**
- Lista **filtrada pelo user logado** (privacidade multi-sócio decisão A)
- Banner explicativo de privacidade
- Stats: contagem + valor + por tipo
- Form criação (`/empresas/[id]/pontes/nova`)
- Detalhe (`/pontes/[id]`)

**Onde é usado pelo sistema:**
- `lib/bridges/*` (toda a Fatia 4)

### 2.3 Sobreposição real

| Tela | Cadastra sócio? | Mostra dinheiro do sócio? | Privacidade? |
|---|---|---|---|
| `/pessoas-vinculadas` | ✅ | ❌ (só mostra que existe) | ❌ (todos os sócios vêem todos os cadastros) |
| `/empresas/[id]/pontes` | ❌ (consome SocioPF) | ✅ (PJ→PF pareadas) | ✅ (cada user vê só as próprias) |

**O fluxo mental do usuário:**
> "Eu cadastrei o sócio Yussef. Quero ver quanto ele recebeu este ano."

Hoje precisa de 2 telas (cadastro em /pessoas-vinculadas → movimentações em /empresas/[id]/pontes). **Confuso.**

### 2.4 Diferença real (NÃO sobrepõem)

- **EmpresaRelacionada** (CNPJ do grupo) NÃO é sócio PF — é uma empresa parceira/do mesmo grupo. Deve ficar **separada**, não misturar com sócios PF.
- Detecção de Pix usa AMBOS (SocioPF para CPF + EmpresaRelacionada para CNPJ), mas conceitualmente são entidades diferentes.

**Decisão:** unificar SocioPF + Pontes; manter EmpresaRelacionada como aba/seção separada.

---

## 3. Proposta de UX unificada

### 3.1 Sidebar — antes e depois

**ANTES:**
```
├─ Pendentes (badge)
├─ Pessoas Vinculadas         ← OLD
├─ Conciliação
├─ Movimentações
├─ Pontes PJ→PF               ← OLD (Fatia 4)
├─ Relatórios
└─ ...
```

**DEPOIS:**
```
├─ Pendentes (badge)
├─ Sócios & Grupo             ← UNIFICADO (rota /socios)
│   ├─ Sócios PF              (aba default)
│   └─ Empresas do Grupo      (aba)
├─ Conciliação
├─ Movimentações
├─ Relatórios
└─ ...
```

→ Sidebar **reduz de 9 pra 8 itens** (mais limpo).

### 3.2 Tela principal `/empresas/[id]/socios` (rota nova)

```
┌─ Header ─────────────────────────────────────────────────────────────────┐
│  Sócios & Grupo · profit sao borja                  [+ Adicionar ▾]     │
│                                                       ├ Sócio PF         │
│                                                       └ Empresa do grupo │
└──────────────────────────────────────────────────────────────────────────┘
   ↓ ↓ ↓

┌─ Tabs ───────────────────────────────────────────────────────────────────┐
│  [ Sócios PF (3) ]  [ Empresas do Grupo (2) ]                           │
└──────────────────────────────────────────────────────────────────────────┘

ABA "Sócios PF":
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ℹ Você vê os cadastros de todos os sócios (público).                   │
│    Os pagamentos (pontes) que CADA sócio recebeu são privados —         │
│    você só vê os seus.                                                  │
│                                                                          │
│ ┌─ Tabela ────────────────────────────────────────────────────────────┐ │
│ │ NOME             CPF              PAPEL          SUAS PONTES (5)   │ │
│ │ ─────────────────────────────────────────────────────────────────  │ │
│ │ Yussef Musa      ***.258.890-**   SOCIO          R$ 25k  (3) →    │ │
│ │ Cláudia Musa     ***.451.123-**   FAMILIAR       —                 │ │
│ │ João Silva       ***.789.456-**   ADMIN          —                 │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Coluna "SUAS PONTES" — só mostra valor pros sócios cujo perfil PF      │
│  o user logado tem acesso. Senão "—" (privacidade decisão A).           │
└──────────────────────────────────────────────────────────────────────────┘

ABA "Empresas do Grupo":
┌──────────────────────────────────────────────────────────────────────────┐
│ ┌─ Tabela ────────────────────────────────────────────────────────────┐ │
│ │ NOME FANTASIA   CNPJ               TIPO RELAÇÃO                    │ │
│ │ ─────────────────────────────────────────────────────────────────  │ │
│ │ CACULA Eventos   00.123.456/0001   MESMO_GRUPO                     │ │
│ │ Profit Filial    00.234.567/0001   CONTROLADA                      │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Aqui ficam só CNPJs do grupo. Sem timeline (não há "ponte" pra CNPJ).  │
│  Tipo relação afeta detecção automática de transferências internas.    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Detalhe do sócio `/empresas/[id]/socios/[socioId]` (rota nova)

```
┌─ Header ─────────────────────────────────────────────────────────────────┐
│  ← Voltar pra Sócios                                                    │
│                                                                          │
│  👤 Yussef Musa                                          [Editar]       │
│  CPF ***.258.890-** · SOCIO · 2 chaves Pix cadastradas                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌─ Stats (filtradas por privacidade) ──────────────────────────────────────┐
│ ┌─────────────────┬─────────────────┬─────────────────┐                │
│ │ SUAS PONTES     │ SEU TOTAL       │ POR TIPO        │                │
│ │ 5 este ano      │ R$ 67.500       │ 4 Distrib       │                │
│ │                 │                 │ 1 Pró-labore    │                │
│ └─────────────────┴─────────────────┴─────────────────┘                │
│                                                                          │
│ Se user logado não é dono do perfil PF deste sócio:                    │
│  → todos os números são "—" + label "privado"                          │
└──────────────────────────────────────────────────────────────────────────┘

┌─ Tabs ───────────────────────────────────────────────────────────────────┐
│  [ Dados ]  [ Suas pontes ]  [ Detecção Pix ]                           │
└──────────────────────────────────────────────────────────────────────────┘

ABA "Dados" (público):
┌──────────────────────────────────────────────────────────────────────────┐
│ Nome:       Yussef Abu Zahry Musa                                       │
│ CPF:        ***.258.890-**                                              │
│ Papel:      SOCIO                                                        │
│ Chaves Pix: yussef@email.com · 51-99999-9999                            │
│                                                                          │
│ Cadastrado em 28/05/2026 por yussef@contaia.com.br                      │
│                                                                          │
│ [Editar]   [Adicionar chave Pix]                                        │
└──────────────────────────────────────────────────────────────────────────┘

ABA "Suas pontes" (privado — só dono do perfil PF):
┌──────────────────────────────────────────────────────────────────────────┐
│  Timeline cronológica das pontes que VOCÊ recebeu deste sócio          │
│                                                              [+ Nova]   │
│                                                                          │
│  28/05/2026 · Banrisul PJ                                                │
│  🏷 Distribuição · R$ 10.000,00 → Nubank PF                            │
│  [Ver detalhes →]                                                       │
│                                                                          │
│  22/05/2026 · Sicredi PJ                                                 │
│  💼 Pró-labore · R$ 5.000,00 → Banrisul PF                              │
│  [Ver detalhes →]                                                       │
│                                                                          │
│  Se user não é dono do perfil PF deste sócio:                          │
│  → "Suas pontes" não aparece (aba escondida)                           │
│  → Banner "🔒 Pontes deste sócio são privadas ao próprio sócio"       │
└──────────────────────────────────────────────────────────────────────────┘

ABA "Detecção Pix" (público, info útil):
┌──────────────────────────────────────────────────────────────────────────┐
│  Tx PJ identificadas pela detecção automática como vindo PRA esse sócio │
│  (qualquer user da empresa pode ver, é dado público da empresa)         │
│                                                                          │
│  28/05  Pix R$ 10.000   Banrisul    [tem ponte 🌉 (anon ou link)]      │
│  22/05  Pix R$ 5.000    Sicredi     [tem ponte 🌉]                     │
│  15/04  Pix R$ 8.000    Sicoob      [sem ponte — sugestão pendente]    │
│                                                                          │
│  Sem privacy filter — é a mesma info que aparece em /transacoes,       │
│  mas agregada por sócio. Útil pra contador auditar.                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Onde aparecem outros acessos a Pontes

| Acesso | Onde fica agora | Onde fica depois |
|---|---|---|
| Lista geral de TODAS minhas pontes em N empresas | `/perfis/[id]/pontes` | **MANTÉM** (lado PF) — útil pra "quanto recebi este ano de TODAS empresas" |
| Lista de pontes desta empresa | `/empresas/[id]/pontes` | **REMOVE** + redirect 301 pra `/empresas/[id]/socios` |
| Criar ponte manual | `/empresas/[id]/pontes/nova` | Move pra `/empresas/[id]/socios/[socioId]?action=nova-ponte` (contexto preservado) |
| Detalhe da ponte | `/pontes/[id]` | **MANTÉM** (mesma rota global) |
| Sugestão em /pendentes | Card | **MANTÉM** (caminho 1 do fluxo) |
| Banner em detalhe de tx PJ | Banner azul | **MANTÉM** (caminho 2 do fluxo) |

### 3.5 Privacidade — mantida intacta

| Cenário | Comportamento |
|---|---|
| Lista `/empresas/[id]/socios` — todos os sócios | **público** (era em /pessoas-vinculadas, continua) |
| Coluna "SUAS PONTES" na lista | **filtrada** por `profileId IN owned_by_user` (decisão A) |
| Detalhe `/socios/[id]` aba Dados | **público** (já era) |
| Aba "Suas pontes" no detalhe | **só aparece** se user é dono do perfil PF correspondente |
| Aba "Detecção Pix" | **público** (mesma info que /transacoes mostra hoje) |
| Form + Nova ponte | **só funciona** se user é OWNER do perfil PF (já era) |

→ **Zero regressão de privacidade.** Toda lógica do Fatia 4 reaproveitada.

---

## 4. É refactor de UI ou de dados?

**SÓ UI.** Confirmado.

| Camada | Muda? |
|---|---|
| `prisma/schema.prisma` — SocioPF, EmpresaRelacionada, PJtoPFBridge | ❌ **NÃO** |
| Migration | ❌ **NÃO** — zero migration |
| `lib/pix-detection/*` (detecção) | ❌ **NÃO** |
| `lib/bridges/*` (criação/delete/privacidade) | ❌ **NÃO** |
| `lib/conciliation/match-internal-transfer.ts` | ❌ **NÃO** |
| Endpoints `/api/empresas/[id]/socios-pf/*` | ❌ **NÃO** (renomeio opcional, não bloqueia) |
| Endpoints `/api/empresas/[id]/pontes/*` | ❌ **NÃO** (continuam servindo dados pras novas telas) |
| Endpoints `/api/pontes/*` | ❌ **NÃO** |

**1 endpoint NOVO opcional:** `GET /api/empresas/[id]/socios/[socioId]/aggregated` — junta dados do SocioPF + agregado de pontes filtradas pelo userId. Pode ser feito via Promise.all no client; recomendo criar endpoint dedicado pra ter cache 60s e código limpo.

→ **ZERO risco em dados de produção.** A regra de "ALTER em tabela com dados reais" do CLAUDE.md NÃO se aplica aqui porque não há migration.

---

## 5. Reuso vs Novo

### 5.1 ✅ Reuso direto

| Item | Origem |
|---|---|
| Componentes `BridgeBadge`, `BridgeDeleteModal`, `BridgeKindRadio`, `BridgeSuggestionCard` | Fatia 4 |
| Form de criação de ponte | Fatia 4 (extrair em componente reutilizável `<NovaPonteForm>`) |
| Lib `lib/bridges/queries.ts` (listBridges, getBridgeSummary) | Fatia 4 |
| Lib `lib/personal-profile/queries.ts` (checkProfileAccess) | Fatia 1 |
| Formulários CRUD de SocioPF + EmpresaRelacionada | `/pessoas-vinculadas` atual (extrair em componentes) |
| Detecção Pix lookup | `lib/pix-detection/` (sem mudança) |

### 5.2 ✨ Novo

**Rotas (3 novas):**
- `/empresas/[id]/socios` (tabs PF / Empresas)
- `/empresas/[id]/socios/[socioId]` (detalhe com 3 abas)
- `/empresas/[id]/socios/[socioId]/nova-ponte` ou query param `?action=nova-ponte`

**Componentes (4-5 novos):**
- `SociosTable` (lista com coluna agregada filtrada por user)
- `EmpresasGrupoTable` (lista simples sem agregados)
- `SocioDetailTabs` (tabs Dados / Suas pontes / Detecção Pix)
- `<SocioPonteTimeline>` (timeline visual das pontes do sócio)
- Banner privacidade reutilizável

**Endpoint novo (opcional, 1):**
- `GET /api/empresas/[id]/socios/[socioId]/aggregated`
  - Retorna `{ socio: SocioPF, suasPontes: BridgeListItem[], totalRecebido: number, byKind: {...}, txPixDetected: [...] }`
  - Cache 60s tag `socio-aggregated:${empresaId}:${socioId}:${userId}` (chave inclui userId por privacidade)

**Redirect 301:**
- `/empresas/[id]/pontes` → `/empresas/[id]/socios` (configurar em `next.config.mjs`)
- `/empresas/[id]/pontes/nova` → `/empresas/[id]/socios?action=nova-ponte` (precisa contexto sócio, melhor um wizard)

**Sidebar update:**
- Remove item "Pontes PJ→PF" e "Pessoas Vinculadas"
- Adiciona item "Sócios & Grupo" → `/empresas/[id]/socios`

### 5.3 Estimativa (2-3 dias)

| Dia | Foco |
|---|---|
| 1 | Lista nova `/socios` com 2 tabs + endpoint agregador opcional + sidebar update |
| 2 | Detalhe `/socios/[id]` com 3 tabs + extrair NovaPonteForm reutilizável |
| 3 | Redirects 301 + smoke + ajustes + tests (8-10 novos) + deploy |

**Sem migration → deploy é só git pull + build + reload em prod.**

---

## 6. Riscos + mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Quebrar detecção Pix | Alta | Zero mudança em `lib/pix-detection/` — só UI que renomeio |
| Quebrar privacidade Fatia 4 | Alta | Reuso de `getUserOwnedProfileIds` + queries existentes — sem nova lógica de filtro |
| Links antigos em prod (404) | Média | Redirect 301 em `next.config.mjs` pras URLs antigas |
| User confundir o que mudou | Média | Toast/banner "Pontes PJ→PF agora estão em Sócios" durante 1 mês |
| Cache antigo (`bridges:suggestions`) coexistir | Baixa | Cache key inalterado; conteúdo igual |
| Endpoint `/api/empresas/[id]/socios-pf` quebra | Baixa | Manter rota; só UI mudou |

---

## 7. Ordem de execução — minha recomendação

### Faz a unificação ANTES do Dashboard PF.

**Razões objetivas:**

1. **Coerência de links no dashboard PF.** O Dashboard PF vai ter o card "🌉 Ponte PJ→PF" mostrando "+R$ 15k de PROFIT este mês". Quando o user clicar, vai cair onde? Se unificarmos primeiro, vai pra `/empresas/profit/socios/yussef` → coerente. Se deixar pra depois, vamos linkar pra `/empresas/profit/pontes` → e DEPOIS retrabalhar quando unificarmos.

2. **Refactor menor primeiro.** Unificação = 2-3 dias. Dashboard = 4-5 dias. Fazer o pequeno primeiro destrava o maior sem dívida pendente.

3. **UX consistente ANTES do destaque.** Faz pouco sentido construir um dashboard "lindo nível Mobills" se a navegação por trás ainda tá confusa (2 itens redundantes). O Yussef vai bater o olho no dashboard polido e depois entrar num menu desorganizado — desproporcional.

4. **Smoke real do Dashboard usa nova URL.** Quando você fizer smoke real do dashboard PF "criar 1 ponte → ver entrada", o caminho vai ser via `/socios` se unificarmos. Senão, smoke será via fluxo "antigo".

5. **Zero risco em dados.** Unificação não toca produção real (só UI). Pode ir AGORA com confiança.

**Sequência recomendada:**
1. **Esta sprint (2-3 dias):** Unificação Sócios + Pontes
2. **Próxima sprint (4-5 dias):** Dashboard PF Mobills-level
3. **Depois:** outras (Fatia 5 Família, ligar PDF, Asaas 3D, etc)

---

## 8. Aprovações pendentes

1. **Ordem recomendada** (unificação ANTES do dashboard) — concorda?
2. **Nome do item no sidebar** — "Sócios & Grupo" ou outro? ("Sócios", "Vínculos", "Sócios e CNPJs")
3. **Endpoint agregador novo** (`/socios/[id]/aggregated`) — OK criar ou faz com Promise.all no client?
4. **Empresas Relacionadas como TAB** dentro de Sócios — OK ou prefere ITEM SEPARADO no sidebar?
5. **Redirect 301** das URLs antigas — OK incluir no `next.config.mjs`?
6. **Toast informativo** "Pontes agora estão em Sócios" durante 30 dias — OK ou enxuto?

---

## 9. Próximo passo

Aguardo aprovação dos 6 pontos. Quando aprovar, sigo §5.3:
- Dia 1: Lista nova + sidebar
- Dia 2: Detalhe + extrair NovaPonteForm
- Dia 3: Redirects + smoke + deploy
