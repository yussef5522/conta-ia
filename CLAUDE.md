# Conta IA — Documento Mestre do Projeto

> **ESTE É O ÚNICO ARQUIVO DE REFERÊNCIA DO PROJETO.**  
> Toda sessão de trabalho deve começar com Claude (chat ou Claude Code) lendo este arquivo.  
> **Última atualização:** 30/04/2026

---

## 📌 Visão geral do produto

**Nome:** Conta IA  
**Tagline:** "Seu contador inteligente que nunca dorme"  
**Domínio:** contaia.com.br  
**Público-alvo:** PMEs brasileiras de qualquer setor (academias, lojas, restaurantes, clínicas, salões, prestadores)  
**Modelo de cobrança:** SaaS recorrente — Starter R$149 / Business R$399 / Enterprise R$999  
**Beta nos próximos 60 dias:** Yussef (13 academias) + amigos beta testers via OFX manual

### Diferenciais competitivos
1. IA agentica que **aprende e raciocina** sobre contabilidade BR (não só categoriza)
2. Pronto para **Reforma Tributária 2026** (IBS/CBS/Split Payment) desde o dia 1
3. Open Finance nativo via Pluggy (FASE 10 — quando tiver receita)
4. Multi-empresa com consolidação automática
5. Preço acessível
6. Interface 100% em português, design moderno

---

## 🛠️ Stack técnica REAL (rodando)

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js | 16.2.4 (NÃO 14 — atualizado) |
| Linguagem | TypeScript | 5.x strict mode |
| Frontend | React + TailwindCSS + shadcn/ui | React 18.3.1, Tailwind 3.4 |
| Backend | Next.js API Routes | (NÃO Express — fullstack Next.js) |
| ORM | Prisma | 5.22 |
| DB Dev | SQLite | `file:./dev.db` |
| DB Prod | PostgreSQL 16 | DigitalOcean droplet |
| Auth | JWT (jose) + bcrypt + cookies httpOnly | jose 5.9, bcrypt 2.4 |
| Validação | Zod | 3.23 |
| Testes | Vitest | 2.1 |
| Lint | ESLint | next/core-web-vitals |
| Importação bancária | OFX/QFX (SGML e XML) | atual |
| Open Finance | Pluggy.ai | implementado FASE 2, ATIVO via Meu Pluggy (Yussef dev) |
| IA | Anthropic Claude API + BrasilAPI | FASE 3+4 |

### Hosting
- **Dev:** localhost Windows do Yussef → `http://localhost:3000` ✅ FUNCIONANDO
- **Prod:** DigitalOcean droplet `167.172.159.101:3001` (PM2 + nginx)
- **Estratégia dual SQLite/Postgres:** schema usa SQLite em dev; deploy roda 2 `sed` que trocam pra postgresql antes de `prisma migrate deploy`. Detalhes em `docs/DEPLOY.md`.

### Estrutura de pastas (real)
```
conta-ia/
├── .claude/
├── .next/
├── __tests__/             # Testes Vitest
├── app/                   # Next.js App Router
│   ├── (auth)/            # /login, /cadastro
│   ├── (dashboard)/       # /dashboard, /empresas, etc
│   └── api/               # API Routes
├── components/
│   ├── ui/                # shadcn/ui
│   ├── layout/            # Sidebar, Header
│   └── empresas/
├── docs/
│   └── DEPLOY.md
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   ├── utils.ts
│   ├── i18n/pt-BR.ts
│   └── validations/
├── node_modules/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── .env / .env.example / .gitignore
├── next.config.mjs / tsconfig.json / tailwind.config.ts
├── package.json
├── proxy.ts               # middleware proteção rotas
├── vitest.config.ts
└── CLAUDE.md              # ← ESTE ARQUIVO
```

---

## 📊 Estado atual do projeto

### ✅ FASE 1 — Fundação (CONCLUÍDA)
- [x] Setup Next.js + Prisma + SQLite
- [x] Schema multi-tenant (users, companies, user_companies)
- [x] Auth completo: signup, login, JWT (jose), bcrypt rounds=12, cookies httpOnly
- [x] CRUD de usuários
- [x] CRUD de empresas com `company_type` (service, retail, restaurant, industry, mixed, other)
- [x] Middleware `proxy.ts` protege rotas privadas
- [x] Seed: admin@contaia.com.br / ContaIA@2025

### ✅ FASE 2 — Bancos e OFX (CONCLUÍDA)
- [x] CRUD de contas bancárias (`bank_accounts`)
- [x] Modelo de transações (`transactions`)
- [x] Categorias customizáveis por empresa (`categories`)
- [x] Importação OFX/QFX (parser SGML e XML)
- [x] Pluggy implementado (mas desabilitado — vamos reativar só na FASE 10)

### ✅ FASE 2.1 — Correções de UX (CONCLUÍDA)
- [x] Botão "Nova Conta" no header de `/contas-bancarias` (dropdown inteligente por nº de empresas)
- [x] Botão "Nova Conta" no estado vazio (CTA "Ir para Empresas")
- [x] Botão "Nova Transação" na página global de transações (mesmo padrão de dropdown)
- [x] `try/catch` no GET de `/api/contas-bancarias`
- [x] `try/catch` no GET de `/api/transacoes`

Commits relacionados: `00817ea`, `0f7d45f`, `34ea23c`, `9d59af1`, `3256259`.

---

## 💡 Estratégia decidida (29/04/2026)

### Princípio: **gastar zero antes de ter clientes pagando**

| Fase | Open Finance | Custo | Quem usa |
|---|---|---|---|
| **Dev e treino IA** | Meu Pluggy (Yussef) | R$ 0 | Só Yussef pra treinar IA |
| **Lançamento beta** | OFX manual | R$ 0 | Yussef + amigos beta testers |
| **Pós-validação (10+ clientes pagantes)** | Pluggy produção | R$500-1500/mês | Todos os clientes |

### Por que faz sentido
- Diferencial real do Conta IA é a **IA Contadora**, não Open Finance (Conta Azul, Omie, Nibo todos têm)
- Validar IA primeiro com OFX é mais barato e rápido
- Mira PMEs que **odeiam complicação** dos concorrentes (academia, salão, padaria, mecânica)
- Quando provar valor (R$2-5k/mês de receita), Pluggy paga por si

### Status do Meu Pluggy (Yussef pessoal)
- ✅ Conta criada em `meu.pluggy.ai` com `yussefmusa5522@gmail.com`
- ✅ **Banrisul conectado** (1 ativa)
- ⏳ Sicoob: a conectar
- ⏳ Outros bancos: conforme necessário

---

## 🎯 Norte do Produto — PRODUTO-NORTE.md

Toda decisão estratégica do produto (priorização de features, escopo de fases, posicionamento de mercado, definição de templates por subsetor, integração com IA) deve ser tomada à luz do documento `docs/PRODUTO-NORTE.md` na raiz deste projeto.

Esse documento é resultado de pesquisa profunda de mercado (30+ buscas, fontes oficiais BR, benchmark de 15 sistemas) feita em 03/05/2026 e é o NORTE permanente do produto pelos próximos 12 meses.

Antes de propor qualquer mudança de roadmap, nova fase ou ajuste de prioridades, releia as seções relevantes do PRODUTO-NORTE.md.

Especialização: produto inicia foco em SERVICE/Academia (Yussef = expert), depois replica pra Clínica, Salão, Restaurante (cacula mix), Loja.

---

## 🏦 Bancos do Yussef (validados)

Todos os 7 bancos exportam OFX nativamente. Pluggy também suporta todos:

| Banco | OFX | Pluggy | Tipo | Observação |
|---|---|---|---|---|
| Banrisul | ✅ | ✅ ATIVO | PF + PJ | Conectado no Meu Pluggy 29/04 |
| Bradesco | ✅ | ✅ | PF + PJ | Internet Banking → OFX |
| Itaú | ✅ | ✅ | PF + PJ | Bankline → OFX |
| Santander | ✅ | ✅ | PF + PJ | Net Empresas → OFX |
| Sicredi | ✅ | ✅ | PJ | Bankline → OFX |
| Sicoob | ✅ | ✅ | PF + PJ | Sisbr → OFX |
| Caixa | ✅ | ⚠️ 30 min auth | PF + PJ | Internet Banking PJ |
| Nubank PJ | ✅ | ⚠️ Limitado | PJ | App → Exportar extrato |

**Decisão:** sistema deve suportar contas PF (CPF) + PJ (CNPJ) nativamente. Quando dinheiro sai do PJ pro PF do dono, classificar automaticamente como "Distribuição de Lucros / Pró-labore".

---

## 🗄️ Modelo de dados (multi-tenant)

```
users                # donos das empresas (Yussef = primeiro user)
companies            # cada CNPJ = empresa separada
user_companies       # N:N (user pode ter várias empresas)
bank_accounts        # cada conta pertence a uma empresa
transactions         # movimentações vinculadas à conta
categories           # plano de contas customizável por empresa
suppliers            # fornecedores identificados por CNPJ (FASE 3+4)
ai_learning_rules    # regras aprendidas pela IA (FASE 3+4)
invoices             # NF-e, NFC-e, NFS-e (FASE 6)
```

### Tipos de empresa (enum `company_type`)
- `service` — academias, clínicas, salões (foco ISS, mensalidades)
- `retail` — lojas, comércios (foco ICMS, NFC-e)
- `restaurant` — bares, restaurantes (SAT, alto giro)
- `industry` — indústrias (IPI, insumos)
- `mixed` — empresas híbridas
- `other`

Cadastro de empresa permite escolher tipo, sistema ajusta automaticamente plano de contas sugerido, categorias típicas, relatórios e alertas.

---

## 📋 Regras de negócio críticas

### Identificação automática de pagamentos (FASE 3+4)
1. Sistema recebe transação (Pluggy ou OFX importado)
2. Identifica tipo (PIX, TED, boleto, débito automático)
3. Se tem CNPJ na descrição → consulta `suppliers` local OU BrasilAPI
4. Se identifica → categoriza automaticamente
5. Se NÃO identifica → cria entrada "pendente" e notifica usuário
6. User responde uma vez → cria regra em `ai_learning_rules` → aplica em todas as próximas similares
7. **Nunca pergunta 2x o mesmo padrão**

### Reforma Tributária 2026
A partir de **01/01/2026** todas NF-e DEVEM destacar:
- IBS (0,1%)
- CBS (0,9%)

Sistema precisa:
- Suportar novos campos no XML NF-e
- Calcular créditos CBS/IBS
- Relatórios de apuração
- Alertar sobre Split Payment

### Multi-empresa
- User pode ter empresas ilimitadas (limitado pelo plano SaaS)
- Cada empresa = dados isolados
- Dashboard consolidado mostra visão geral
- Comparativo entre empresas do mesmo tipo
- IA aprende padrões POR EMPRESA (não mistura entre empresas)

### Regra especial PJ → PF (FASE 3+4)
- Detectar transferências entre contas do mesmo dono (CNPJ → CPF)
- Classificar como "Distribuição de Lucros" ou "Pró-labore"
- Não é despesa operacional → afeta DRE corretamente

---

## 🚀 Roadmap completo

### ✅ FASE 2.1 — Correções rápidas (CONCLUÍDA)
3 botões + try/catch nas rotas. Destravou navegação.

### 📍 FASE 3+4 — Importar e classificar perfeito (4-6 semanas) — DIFERENCIAL DO PRODUTO

**Objetivo:** Yussef importa um OFX e a IA classifica automaticamente com ≥80% de acerto, aprendendo a cada confirmação manual.

**Princípio de execução:** entrar no fluxo "OFX + IA" o quanto antes para Yussef testar com dados reais já a partir de 1 arquivo. Multi-arquivo e histórico de uploads ficam pro fim — não bloqueiam validação da IA.

**Notação:** sub-etapas mantêm os prefixos `3.x` (UX OFX) e `4.x` (IA) por origem, mas a ordem de execução abaixo intercala os dois.

#### 🧪 BLOCO A — UX OFX rápido (1-2 dias)
Pequenas vitórias visuais antes de mexer com IA. Sem migration.

- [x] **3.1 — Detecção automática do banco no preview** (concluída 30/04/2026)
  - parser já extraía `BANKID`; passou a usar
  - lista canônica em `lib/bancos.ts` (15 bancos brasileiros — fonte única, ver entrada do log)
  - `lib/ofx/bancos.ts` com helpers `detectarBanco` e `bateComPerfilDaConta`
  - API preview retorna `banco: { codigo, nome, batePerfilConta }`
  - UI mostra "Banco detectado: **Banrisul** (041)" e oferece auto-preencher se conta sem `bankName`
  - **Validado com dados reais:** 270 transações do Banrisul importadas, saldo R$ 5.821,08 correto, detecção verde.

- [ ] **3.2 — "Atualizado há X dias" na lista de contas** (~1-2h)
  - calcular `lastImportAt = max(transactions.createdAt where origin in (OFX, PLUGGY))`
  - badge na `/contas-bancarias` com cor: verde (<7d), amarelo (8-14d), vermelho (>14d ou nunca)
  - **Teste:** importar OFX → badge "hoje" verde.

#### 🧠 BLOCO B — Classificação com 1 arquivo (2-3 semanas) — TESTES COM DADOS REAIS COMEÇAM AQUI
Foco em fazer Yussef classificar manualmente já criando regras, depois automatizar.

- [ ] **4.1 — Schema novo (suppliers + ai_learning_rules)** (~2-3h)
  - migration: `suppliers` (id, companyId, cnpj, razaoSocial, categoriaId?, fonte=BRASILAPI/MANUAL/CLAUDE, createdAt)
  - migration: `ai_learning_rules` (id, companyId, padrao, tipoMatch=EXACT/CONTAINS/CNPJ, categoriaId, supplierId?, confianca, vezesAplicada, createdAt, updatedAt)
  - sem mudança de UI ainda; só base
  - rodar migration em dev (não em prod ainda)

- [ ] **4.5 — Tela "Pendentes de Classificação" (manual ainda, sem IA)** (~3-4h)
  - rota nova `/empresas/[id]/pendentes` (ou filtro `?status=PENDING` na página global de transações)
  - lista transações com `status = PENDING` (todas as importadas via OFX entram assim)
  - cada linha tem dropdown de categoria + botão "Confirmar"
  - sem IA ainda — só interface humana eficiente
  - **Teste:** importar 1 OFX e classificar 30-50 manualmente; medir tempo.

- [ ] **4.6 — Loop: confirmar manualmente cria/atualiza regra** (~3-4h)
  - ao confirmar categoria, salva `ai_learning_rule` com padrão = primeiras N palavras significativas do `description` (stop-words removidas)
  - se regra similar já existe (mesmo `padrao` + `tipoMatch`), incrementa `vezesAplicada`
  - se descrição contém CNPJ válido, salva `supplier` também
  - 🎯 **MARCO 1:** Yussef já consegue treinar manualmente uma base de regras a partir de 1 OFX importado.

- [ ] **4.2 — Pipeline etapa 1: aplicar regras automaticamente no import** (~2-3h)
  - hook: ao inserir transações novas via OFX, antes do `createMany`, rodar match contra `ai_learning_rules` da empresa
  - ordem de match: EXACT → CNPJ → CONTAINS
  - se bate, `categoryId` preenchido + `status = RECONCILED` (ou novo `AUTOMATICO`)
  - 🎯 **MARCO 2:** próximo OFX já vem 30-50% pré-classificado.

- [ ] **4.3 — Pipeline etapa 2: enriquecer por CNPJ via BrasilAPI** (~3-4h)
  - extractor de CNPJ na descrição (regex `\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}`)
  - cache local em `suppliers` por CNPJ
  - se não tem cache, consulta BrasilAPI (`/cnpj/v1/{cnpj}`), salva `razaoSocial` + sugestão de `categoria` baseada em CNAE primário
  - rate-limit cliente: 3 req/s
  - 🎯 **MARCO 3:** transações com CNPJ vêm com fornecedor identificado mesmo sem regra prévia.

- [ ] **4.4 — Pipeline etapa 3: Claude Haiku com few-shot** (~4-6h)
  - rota interna `/api/classificar` recebe `{ description, amount, type }` retorna `{ categoriaSugerida, confianca, justificativa }`
  - prompt few-shot com 10-15 exemplos do setor da empresa
  - prompt caching da Anthropic na parte fixa do prompt
  - chama só pra transações que escaparam de 4.2 e 4.3
  - 🎯 **MARCO 4:** pipeline completo 3 etapas funcionando. Critério de saída: ≥80% automático.

#### 🪟 BLOCO C — Visibilidade e dashboard (1-2 semanas)
Painéis para Yussef visualizar o que foi aprendido.

- [ ] **4.7 — Tela "Regras Aprendidas" (CRUD)** (~3-4h)
  - rota `/empresas/[id]/regras`
  - tabela: padrão / tipo / categoria / vezes aplicada / confiança / ações (editar, desativar, excluir)
  - filtro por categoria

- [ ] **4.8 — Tela "Fornecedores"** (~2-3h)
  - rota `/empresas/[id]/fornecedores`
  - tabela: CNPJ / razão social / categoria padrão / total movimentado / última transação
  - cada linha linka para transações filtradas

- [ ] **4.9 — Dashboard com cards e gráficos** (~6-8h)
  - cards: saldo consolidado, receitas mês, despesas mês, resultado
  - gráfico linha: fluxo de caixa últimos 12 meses
  - gráfico donut: composição de despesas por categoria no mês
  - alertas: "X transações pendentes de classificação"
  - usar Recharts (já em shadcn/ui)
  - 🎯 **MARCO 5:** Yussef abre dashboard e bate olho em 1 academia inteira em 30 segundos.

#### 📦 BLOCO D — Escalar import (1 semana)
Depois que IA está validada, melhora ergonomia para volumes maiores.

- [ ] **3.3 — Múltiplos arquivos OFX por vez** (~2-3h)
  - input `multiple`, estado `arquivos: File[]`
  - preview paralelo + confirmação em série
  - tratamento de falha parcial (sem rollback — quem importou ficou)
  - mensagem final: "5 arquivos · 142 transações importadas · 23 duplicadas · 1 com erro"

- [ ] **3.4 — Histórico de uploads** (~3-4h)
  - migration: `OfxImport` (id, bankAccountId, importedByUserId, fileName, fileSize, totalLidas, inseridas, duplicadas, errosCount, errosJSON, createdAt)
  - rota `GET /api/contas-bancarias/[id]/importacoes`
  - página `/empresas/[id]/contas/[contaId]/importacoes`
  - link "Histórico" no header da página de transações da conta

#### Setup técnico paralelo (Yussef faz manual, fora do código)
- ✅ Conta `meu.pluggy.ai` criada
- ✅ Banrisul conectado
- [ ] Conectar Sicoob, Itaú, etc (conforme dado real for sendo necessário pra treinar IA)

#### Stretch (depois de tudo)
- [ ] CSV com wizard de mapeamento
- [ ] PDF com Claude (extrair extrato de PDF, fase 2)

### 📍 FASE 5 — Beta com amigos (2-3 semanas)
- Convidar 5-10 amigos donos de PMEs (diversificar setores)
- Onboarding: explicar que upload OFX é manual
- Coletar feedback semanal
- **Critério saída:** 5+ usuários ativos satisfeitos, IA classificando 80%+ automático

### 📍 FASE 6 — Relatórios profissionais (1-2 semanas)
- DRE Gerencial completa (estrutura BR padrão)
- Export PDF (com logo) + Excel
- DFC realizado e projetado
- Conciliação bancária (split view)
- Centro de Custo (essencial pras 13 academias)
- KPIs: Margem Bruta, Líquida, Burn Rate, Runway

### 📍 FASE 7 — Cobrança SaaS (1 semana)
- Painel Super Admin (Yussef vê tudo)
- Integração Asaas (recorrência em real, PIX, boleto)
- Trial 14 dias sem cartão
- Onboarding wizard
- Email transacional (Resend)

### 📍 FASE 8 — Apuração de Impostos
- Simples Nacional (DAS)
- IRPJ + CSLL
- **Reforma Tributária 2026: IBS + CBS**
- Suporte XML NF-e 2026
- Calendário fiscal

### 📍 FASE 9 — Chat IA Contadora
- Interface de chat
- RAG com legislação BR
- Contexto: dados financeiros da empresa
- Perguntas: "Quanto gastei com fornecedores em outubro?"

### 📍 FASE 10 — Pluggy Produção (quando justificar)
**Disparador:** 10+ clientes pagando = R$1.500-3.000/mês de receita
- Iniciar processo comercial Pluggy (KYC 2-4 semanas)
- Application Production
- Migrar do Meu Pluggy → API Produção (mesma estrutura, troca env vars)
- UI: cliente clica "Conectar Banco" e widget Pluggy abre dentro do Conta IA
- Manter OFX como fallback (planos starter mais baratos)

### 📍 FASE 11 — PWA + Mobile
### 📍 FASE 12 — Polimento + Lançamento público

---

## 🎯 Prioridade do Yussef (ranking)

1. **Relatórios e dashboards** ← Fases 3+4 + 6
2. **Conciliação bancária automática** ← Fase 6
3. **IA contadora que calcula impostos** ← Fases 8 + 9
4. **Open Finance** ← Fase 10 (quando tiver clientes pagando)

---

## 🔐 Convenções de código

- TypeScript strict mode em TUDO
- Commits semânticos (feat, fix, refactor, docs, test, chore)
- Validação com Zod em todas as rotas de API
- Textos de UI em português brasileiro
- Logs de erro descritivos em português
- Comentários em português quando explicam regra de negócio
- Componentes UI: shadcn/ui
- Path alias: `@/*` aponta pra raiz

---

## 🛡️ Segurança e LGPD

- ✅ Senhas com bcrypt rounds=12
- ✅ JWT em cookie httpOnly (não acessível via JS)
- ✅ Validação Zod em todas as rotas
- ✅ Multi-tenant isolation (cada user só vê suas empresas)
- [ ] Refresh tokens (FASE 7)
- [ ] Rate limiting (FASE 7)
- [ ] Logs de auditoria pra ações financeiras
- [ ] Criptografia em repouso pra dados sensíveis (CNPJ, dados Pluggy)
- [ ] Tela LGPD: exportar dados, excluir conta com purga 30 dias
- [ ] Termo de Uso + Política de Privacidade
- [ ] Certificado A1/A3 pra emissão NF-e (futuro)

---

## 📝 Log de sessões

### 29/04/2026 — Reorganização e estratégia OFX-first
**Contexto:** sessão de planejamento via chat com Claude (não Claude Code ainda).

**Descobertas:**
- Existem 2 pastas no Desktop: `conta ia` (vazia, lixo) e `conta-ia` (projeto real)
- Pasta correta: `Desktop\conta-ia` (com hífen)
- Stack real é Next.js 16.2.4, não 14 como dizia o CLAUDE.md antigo
- Yussef tem 7 bancos pra conectar (Banrisul, Bradesco, Itaú, Santander, Sicredi, Sicoob, Caixa, Nubank PJ)
- Banrisul já conectado no Meu Pluggy

**Decisões tomadas:**
- Workflow: chat (estratégia) + Claude Code no PC (execução)
- **Estratégia OFX-first:** zero custo Pluggy até ter receita
- Meu Pluggy SÓ pra Yussef em dev (treinar IA com dados reais)
- Clientes beta usam upload OFX manual
- Pluggy produção paga só na FASE 10 (10+ clientes pagantes)
- Suportar PF + PJ nativamente (rastrear pró-labore)
- Documento mestre único: este CLAUDE.md (consolidado)

**Próximo passo:** Yussef abre Claude Code apontado pra `Desktop\conta-ia`, cola prompt de auditoria/execução FASE 2.1.

### 30/04/2026 — Auditoria 2.1 + unificação 3+4 + sub-etapa 3.1 + 2 bugs bloqueadores

**Contexto:** primeira sessão de execução com Claude Code apontado pra `Desktop\conta-ia` após a reorganização do dia 29/04.

**O que foi feito (5 commits):**
- `0d54c80` — Auditoria FASE 2.1: marcada como concluída no doc (já estava 100% no código, regressão de checkboxes na reescrita de 29/04).
- `a83fe87` — Unificação FASE 3 (UX OFX) + FASE 4 (IA Contadora) em "Importar e classificar perfeito", com sub-etapas reordenadas pra encurtar tempo até teste com dados reais.
- `3ebba31` — Sub-etapa 3.1: detecção automática do banco no preview (BANKID → nome via mapa FEBRABAN; UI mostra detecção e oferece auto-preencher cadastro).
- `e4141ee` — **Bug bloqueador descoberto no teste:** lista de bancos do form de cadastro estava divergente da do OFX (Banrisul, Sicredi, Sicoob, BTG, Safra ausentes no form). Refatorado pra fonte única em `lib/bancos.ts` com testes de consistência ida-e-volta.
- `54921d4` — **Bug bloqueador descoberto no teste com dados reais:** Banrisul reusa FITIDs ("000001", "000002", ...) entre transações distintas no mesmo OFX. A constraint `@@unique([bankAccountId, externalId])` fazia o import inteiro falhar. Refatorada dedup pra usar `dedupHash = sha256(fitid + data + valor + memo)` num campo separado; `externalId` virou só auditoria. Pluggy ficou intocado.

**Validação final com dados reais:** Yussef importou 270 transações do Banrisul, saldo R$ 5.821,08 calculado correto, transações de março/2026 aparecem ao filtrar pelo período, detecção automática do banco funciona (card verde "Banco detectado: Banrisul (041)").

**Decisões de produto registradas:**
- Pluggy congelado por tempo indeterminado — não pega contas PJ direito. Foco 100% em OFX manual até nova ordem.
- Código FEBRABAN 290 = "PagBank" (nome de mercado, não razão social "PagSeguro").

**Descoberta interessante:**
- 2 dos 5 commits foram bugs bloqueadores descobertos só ao Yussef testar com dados reais (lista de bancos incompleta + FITIDs duplicados do Banrisul). Reforça o valor da estratégia "testar com 1 OFX real ASAP" do plano da FASE 3+4 — esses bugs ficariam invisíveis num beta sem dados brasileiros reais.

**Próximo passo:** sub-etapa 4.1 — criar tabelas `suppliers` e `ai_learning_rules` no schema Prisma (base pra pipeline de classificação automática).

### 03/05/2026 — Pesquisa profunda de mercado e definição do NORTE
**Contexto:** Yussef estabeleceu filosofia "qualidade extrema > velocidade" (02/05) e pediu pesquisa profunda antes de prosseguir com Fase B do Plano de Contas.

**Pesquisa realizada (no chat com Claude, não Code):**
- 30+ buscas web profundas via WebSearch
- Fontes oficiais (Receita Federal, Ministério Fazenda, leis)
- Benchmark de 15 sistemas (BR e globais)
- Análise IA financeira 2026
- Cronograma Reforma Tributária 2026-2033

**Resultado:**
- Documento `docs/PRODUTO-NORTE.md` (~37KB, 934 linhas)
- 5 insights principais de mercado
- 6 diferenciais sustentáveis identificados
- Roadmap revisado de 12 meses
- Posicionamento e pricing definidos

**Decisões registradas:**
- Foco inicial: SERVICE/Academia (Yussef = expert)
- Templates por SUBSETOR (não setor amplo)
- IA como cérebro central, não feature
- Recomendação tributária ativa = diferencial chave
- Folha integrada nativa (não add-on)
- Pronto pra Reforma Tributária 2026 desde dia 1

**Próximo passo:** Yussef revisa o PRODUTO-NORTE.md, confirma decisões pendentes (seção 10.3), e damos sequência à Fase B do Plano de Contas com profundidade extrema (80-120 categorias, 3 níveis, foco academia primeiro).

### [Próxima sessão] — preencher
- Data:
- O que foi feito:
- Próximo passo:

---

## 🆘 Workflow obrigatório a cada sessão

### Início de sessão (chat OU Claude Code)
1. Ler ESTE arquivo (`CLAUDE.md`) por completo
2. Olhar último item do "Log de sessões"
3. Confirmar com Yussef qual fase/item antes de codar

### Fim de sessão
1. Atualizar "Log de sessões" com:
   - Data
   - O que foi feito (lista de checkboxes marcados)
   - O que descobrimos
   - Próximo passo claro
2. Marcar checkboxes concluídos no roadmap

### NUNCA
- Começar do zero (sempre tem contexto)
- Mudar stack sem justificativa
- Pular fases
- Codar antes de confirmar plano
- Criar pasta nova com nome parecido (causa confusão)

---

## 📞 Links úteis

- Pluggy docs: https://docs.pluggy.ai
- Meu Pluggy (Yussef): https://meu.pluggy.ai
- Pluggy Dashboard (dev): https://dashboard.pluggy.ai
- Claude API docs: https://docs.claude.com
- Reforma Tributária: https://www.gov.br/fazenda/reforma-tributaria
- Layout NF-e 2026: https://www.nfe.fazenda.gov.br
- shadcn/ui: https://ui.shadcn.com
- BrasilAPI: https://brasilapi.com.br
