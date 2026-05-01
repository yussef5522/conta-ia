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
| IA | Anthropic Claude API + BrasilAPI | FASE 4 |

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
suppliers            # fornecedores identificados por CNPJ (FASE 4)
ai_learning_rules    # regras aprendidas pela IA (FASE 4)
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

### Identificação automática de pagamentos (FASE 4)
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

### Regra especial PJ → PF (FASE 4)
- Detectar transferências entre contas do mesmo dono (CNPJ → CPF)
- Classificar como "Distribuição de Lucros" ou "Pró-labore"
- Não é despesa operacional → afeta DRE corretamente

---

## 🚀 Roadmap completo

### ✅ FASE 2.1 — Correções rápidas (CONCLUÍDA)
3 botões + try/catch nas rotas. Destravou navegação.

### 📍 FASE 3 — Melhorar UX OFX (3-5 dias)
- Drag & drop de upload
- Preview antes de importar (X transações, período)
- Detecção automática do banco pelo OFX
- Detecção de duplicatas (hash dedup)
- "Última atualização há X dias" — pressão visual amigável
- Múltiplos arquivos de uma vez
- Histórico de uploads
- **Stretch:** CSV com wizard de mapeamento
- **Stretch:** PDF com Claude (fase 2)

### 📍 FASE 4 — IA Contadora (1-2 semanas) — DIFERENCIAL DO PRODUTO
**Setup técnico Yussef (manual, 30 min):**
- ✅ Conta `meu.pluggy.ai` criada
- ✅ Banrisul conectado
- [ ] Conectar Sicoob, Itaú, etc
- [ ] Criar Application Development em `dashboard.pluggy.ai`
- [ ] Salvar CLIENT_ID e CLIENT_SECRET no `.env` LOCAL (só Yussef)
- [ ] OAuth ligando Meu Pluggy → App Dev

**Tabelas novas no Prisma:**
- [ ] `suppliers` (id, company_id, cnpj, razao_social, categoria_padrao)
- [ ] `ai_learning_rules` (id, company_id, padrao, tipo_match, category_id, supplier_id, confianca, vezes_aplicada)

**Pipeline de classificação (3 etapas):**
1. Match em `ai_learning_rules` (exato → contém)
2. Identificação por CNPJ via BrasilAPI
3. Claude Haiku com few-shot

**Loop de aprendizado:**
- User confirma/corrige → cria/atualiza regra
- Re-processa transações pendentes similares
- Nunca pergunta 2x

**Telas:**
- [ ] Pendentes de Classificação
- [ ] Regras Aprendidas (CRUD)
- [ ] Fornecedores

**Dashboard:**
- [ ] Cards: saldo, receitas, despesas, resultado
- [ ] Gráfico fluxo de caixa (12 meses)
- [ ] Gráfico composição despesas (donut)
- [ ] Alertas de pendências

**Treino com dados reais (Yussef):**
- Importar via Meu Pluggy + OFX
- Yussef classifica 30-50 transações manualmente
- IA aprende padrões de academia
- Ajustar prompts conforme aparece

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

1. **Relatórios e dashboards** ← Fases 4 + 6
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

### 30/04/2026 — Auditoria e correção de checkboxes
**Contexto:** primeira sessão usando Claude Code apontado para `Desktop\conta-ia` após a reorganização do dia 29/04.

**Descobertas:**
- FASE 2.1 já estava 100% implementada no código (commits `00817ea`, `0f7d45f`, `34ea23c`, `9d59af1`), mas a reescrita do CLAUDE.md de 29/04 regrediu os checkboxes para `[ ]` por descuido.
- Os 5 itens foram verificados linha-a-linha contra o código real.

**Decisões:**
- Corrigir só o CLAUDE.md (marcar FASE 2.1 como concluída) e seguir para auditoria + plano da FASE 3 antes de codar qualquer coisa.

**Próximo passo:** apresentar plano da FASE 3 (UX OFX) em etapas pequenas, e aguardar OK do Yussef antes de começar a primeira etapa.

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
