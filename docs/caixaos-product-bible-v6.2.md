# CAIXAOS — PRODUCT BIBLE

**Versão:** 6.2 (Pós-sessão histórica 22-23/05/2026)
**Data:** 23 de maio de 2026
**Autor:** Yussef Musa + Claude
**Status:** ✅ Sistema em produção · Cacula Mix 96.5% classificada · 1667 testes passing

---

## 📋 NATUREZA DESTE DOCUMENTO

Este é o documento principal do CAIXAOS. Substitui v5.1 (CAIXAOS 2030) que foi deletado.
Sucede v6.1 (22/05/2026) — preservada como histórico em `caixaos-product-bible-v6.1.md`.

**FILOSOFIA:** "Construir produto TÃO BOM que vender será consequência natural."

**O QUE ESTE DOCUMENTO É:**
✅ Bíblia do PRODUTO CAIXAOS
✅ Visão técnica e UX
✅ Estado real (atualizado v6.2)
✅ Roadmap de construção
✅ Padrões de qualidade

**O QUE NÃO É:**
❌ Plano de marketing/vendas
❌ Projeções financeiras
❌ Pitch valuation

**⚠️ IMPORTANTE — FONTE ÚNICA DE DECISÕES TÉCNICAS:**
Para decisões arquiteturais (D1-D22), consulte sempre `/docs/DECISOES.md`.
Este documento NÃO substitui DECISOES.md.

---

# PARTE 1 — VISÃO PRODUTO

## SEÇÃO 1: MANIFESTO DE QUALIDADE

**O QUE ESTAMOS CONSTRUINDO:**
"Sistema de gestão financeira que entregue valor REAL para PMEs brasileiras, com IA que funciona de verdade, sem inflar resultados."

**OS 7 PRINCÍPIOS DE QUALIDADE:**
1. Zero bugs em produção (coverage realista ≥80% lib/ puro + smoke E2E críticos)
2. Visual delicioso (mirar 10x melhor que Conta Azul/Omie)
3. Performance obsessiva (LCP <1.5s, API P95 <500ms)
4. IA que funciona (confiança ≥0.85, sem hallucinations)
5. Detalhes importam (microcopy obsessivo)
6. Mobile first (PWA → Native quando necessário)
7. Simplicidade radical (cada feature pull weight)

**BENCHMARK REAL:**
- Concorrentes diretos: Conta Azul, Omie, Bling, eGestor
- Meta: ser 10x melhor que eles em produto e UX
- Inspirações de UX: Linear, Vercel, Stripe (referências, não comparação 1:1)

## SEÇÃO 2: FILOSOFIA PRODUTO

**Quality × Focus = Sucesso** (não Build × Features)

**OBSESSION-DRIVEN DEVELOPMENT:**
Antes de toda feature, perguntar:
1. TU usa todo dia?
2. TU ficaria irritado se faltasse?
3. TU se orgulha de mostrar?
4. TU consideraria perfeito?
5. TU pagaria por isso?

**USER OBSESSION:**
TU (Yussef) = Product Manager + Usuário #1
TU usa → sente fricção → reporta → constrói → testa → ama ou refina

## SEÇÃO 3: TARGETS DE QUALIDADE

**PERFORMANCE:**
- LCP <1.5s, FID <50ms, CLS <0.05
- API P50 <100ms, P95 <500ms
- IA classificação <2s, chat <5s
- Build <3min

**QUALIDADE:**
- Coverage ≥80% lib/ puro (não 95%)
- Tests 100% passing sempre
- Bugs prod monitorados (sem meta numérica até ter clientes)
- Lighthouse ≥90 (não 95)
- WCAG 2.1 AA

---

# PARTE 2 — AS 5 IAs ULTRAS

## SEÇÃO 4: VISÃO GERAL

**POR QUE 5?** Profundidade > Quantidade.

**AS 5 IAs em 1 linha:**
1. 🤖 CONTADORA INTELIGENTE — "Lança despesa. IA classifica perfeitamente."
2. 📊 VIDENTE FINANCEIRA — "Vê o futuro do teu caixa. Avisa antes."
3. 💬 ASSISTENTE PESSOAL — "Conversa pelo WhatsApp. Como um sócio."
4. 🧠 CONSULTOR ESTRATÉGICO — "Te diz o que fazer. Decisões com dados."
5. ⚡ AUTOMAÇÃO AUTÔNOMA — "Trabalha sozinho. Cobra, alerta, age."

## SEÇÃO 4.1: STATUS DAS 5 IAs ULTRA (23/05/2026) — ATUALIZADO

| IA | Nome | Status | Progresso |
|----|------|--------|-----------|
| #1 | Contadora Inteligente | Em produção | 4/5 ⭐ |
| #2 | Vidente Financeira | Insights básicos | 2/5 ⭐ |
| #3 | Assistente Pessoal | Planejada | 0/5 ⭐ |
| #4 | Consultor Estratégico | Planejada | 0/5 ⭐ |
| #5 | Automação Autônoma | Planejada | 0/5 ⭐ |

**Total: 22% pronto**

### Próximos passos por IA:

**IA #1 - Contadora:**
- Pipeline 4-layer (RULE → KEYWORD → CNPJ → CLAUDE) em produção
- Cacula Mix: 96.5% classificada com base aprendida
- Falta: filtros amount em AiLearningRule (Sprint 3.1)
- Falta: explainability UI + atalhos teclado (Sprint 3.2)

**IA #2 - Vidente:**
- 7 detectors básicos rodando
- Falta: forecasting, anomalias avançadas, projeções

**IA #3 - Assistente:**
- ZERO arquivos criados
- Plano: WhatsApp + Voz + Visão
- Yussef manda foto da nota fiscal
- "Quanto gastei essa semana?"

**IA #4 - Consultor:**
- Planejada para após IA #3
- Sugere otimizações
- Detecta oportunidades

**IA #5 - Automação:**
- Última fase
- Pagamentos automáticos
- Conciliação total

## SEÇÃO 5: IA #1 — CONTADORA INTELIGENTE

**Promessa:** "Lança sem pensar. IA classifica perfeitamente, aprende contigo."

**Pipeline 4 camadas:**
1. RULE engine (instantâneo, <1ms)
2. KEYWORD detector (instantâneo)
3. BRASILAPI (300ms)
4. CLAUDE Sonnet (1s, contexto profundo)

**Estado atual (atualizado 23/05):**
- 138 regras IA aprendidas em prod
- 13 fornecedores detectados
- 1.694 de 1.755 transações classificadas (96.5%)
- 29 pendentes intencionais + 30 ignored
- Confidence média 0.85+
- Base profissional sólida após sessão histórica D17-D22

**Para ser 5⭐:**
- Sprint 3.1: Filtros amount em AiLearningRule (tech debt crítico)
- Sprint 3.2: Explainability UI + Confidence visual + atalhos teclado (✓ JÁ feito parcialmente em 3.0.4)
- Sprint 3.3: Pattern recognition pessoal + multi-empresa sharing
- Sprint 3.4: Reconciliação inteligente + dashboard performance IA

## SEÇÃO 6: IA #2 — VIDENTE FINANCEIRA

**Promessa:** "Vê o futuro. Detecta anomalias. Avisa antes."

**3 capacidades:**
1. Detecção anomalias
2. Previsão fluxo
3. Insights proativos

**Estado atual:** 7 detectors em `lib/insights/detectors/`. Falta engine predictive. 2/5.

**Roadmap (após IA #1 perfeita):**
- Anomaly explainer avançado
- Predictive cashflow (3 cenários)
- Insights profundos acionáveis

## SEÇÃO 7: IA #3 — ASSISTENTE PESSOAL

**Promessa:** "Conversa naturalmente via WhatsApp. Voz, texto, foto."

**Estado:** 0/5 — ZERO arquivos WhatsApp/voz/imagem.

**Stack futuro (decidido):**
- WhatsApp Cloud API (Meta direto, NÃO Z-API) ✓
- Claude áudio nativo (quando GA 2026) ou Whisper
- Claude Sonnet Vision (boletos, NFs)
- OpenAI TTS (alternativa ElevenLabs)

**Roadmap REALISTA (Mês 7-9, não 4-5):**
- Onboarding Meta Business: 2-4 semanas
- Setup WhatsApp Cloud API
- Conversação texto básica
- Voz (STT)
- Visão (OCR boleto/NF)
- Conversação livre + memória

## SEÇÃO 8: IA #4 — CONSULTOR ESTRATÉGICO

**Estado:** 0/5

**Stack:** Claude Opus 4.7 quando GA

**Roadmap (Mês 10-12+):** Briefings → Recomendações → Decisões interativas

## SEÇÃO 9: IA #5 — AUTOMAÇÃO AUTÔNOMA

**Estado:** 0/5

**Roadmap (Mês 12+):** Workflow engine → Cobrança automática

---

# PARTE 3 — EXPERIÊNCIA DO USUÁRIO

## SEÇÃO 10: ONBOARDING 5 MIN

Setup automático por CNAE (academias, restaurantes, lojas), primeiro OFX em <3 min.

## SEÇÃO 11: DIA TÍPICO

**Atual:** 40-60 min/dia (caiu pra 15-20 min após Sprint 3.0.4 — atalhos teclado + bulk + export)
**Futuro (com WhatsApp):** 10-15 min/dia

## SEÇÃO 12: INTERFACES

**Multi-plataforma:**
- Primary: Web Desktop + Mobile responsive
- Secondary: PWA mobile (Mês 8+, não 6)
- Tertiary: WhatsApp (Mês 7+)
- Future: Native iOS/Android (após PWA validar)

**Design System:** Cores #0a0a0a/#185FA5/#10b981, Inter+Geist, dark mode primeiro.

## SEÇÃO 13: PRINCÍPIOS UX

10 mandamentos: Velocidade, foco, teclado, visual, microcopy, sem surpresas, mobile first, dark mode, acessibilidade, delight.

---

# PARTE 4 — ESTADO ATUAL HONESTO (ATUALIZADO v6.2)

## SEÇÃO 14: ESTADO ATUAL REAL

**✅ ONDA 1 + 2 + 3.0.x COMPLETAS:**
- Tests: **1.667 passing** ✅ (era 1.564 em v6.1, +103 testes)
- Tags onda-1-completa + onda-2-completa ✅
- Sprint 3.0.1 + 3.0.2 + 3.0.3 + 3.0.4 entregues ✅
- Pipeline 4-layer funcionando ✅
- OFX multi-import ✅
- Sistema em produção `app.caixaos.com.br` ✅

**📊 NÚMEROS REAIS (23/05/2026 — Cacula Mix):**
- 1.755 transações totais
- 1.694 classificadas (96.5%)
- 29 pendentes intencionais
- 30 ignored
- 138 regras IA aprendidas
- 13 fornecedores detectados
- 32 funcionárias identificadas
- 4 backups preservados
- ~35 commits GitHub (sessão 22-23/05)

## SEÇÃO 14.1: ESTADO REAL DO PRODUTO (Snapshot)

### Em Produção:
✅ Sistema CAIXAOS em https://app.caixaos.com.br
✅ Domínio CAIXAOS.COM.BR ativo
✅ DigitalOcean Droplet (198.211.103.10)
✅ PostgreSQL produção
✅ PM2 + Nginx
✅ Cacula Mix com dados reais (96.5%)

### Stack Real Confirmada:
- Next.js 16 + App Router + Turbopack
- TypeScript 5 strict
- Tailwind 3.4 + shadcn/ui
- React 18.3
- Prisma 5.22 + PostgreSQL
- JWT próprio + Safari fix
- Claude Sonnet 4.6 (fetch direto)
- BrasilAPI integration
- Vitest 2.1 (1667 testes passing)

## SEÇÃO 14.2: PROBLEMAS ATIVOS

**#1 APLICAÇÃO/RESGATE AUTOMÁTICO (ainda pendente):**
- Banrisul confirmado: "APLICACAO AUTOMATICA CDB" / "RESGATE AUTOMATICO CDB"
- Outros bancos: padrões diferentes (precisa OFX)
- DRE inflado nos dois lados
- Sprint 3.0 (10 dias) ainda pendente

**#2 IMPORT MANUAL:**
- 13 academias = 13 OFX manuais/dia
- Solução futura: Pluggy/Belvo

**🚨 TECH DEBT MAPEADO:**

CRÍTICO:
1. lib/auth.ts dual com lib/auth/ ✅ confirmado
2. npm install --legacy-peer-deps ✅ confirmado
3. Cache unstable_cache (Date bug) ✅ confirmado em 4 arquivos
4. BankAccount.balance Float ✅ confirmado
5. Anthropic SDK não usado ✅ fetch direto
6. Rate limit em memória ✅ confirmado
7. **AiLearningRule sem filtros amount** (NOVO — limita "PIX >R$ 250 fica pendente")

ADICIONAIS (Claude Code apontou):
8. Coverage real ~50-60%, não 95%
9. audit_log sem retention policy
10. Schema dual SQLite/Postgres
11. swap-prisma-to-postgres.sh hack
12. Sem rollback automatizado de deploy
13. JWT 24h sem refresh token
14. AiClaudeCache cresce sem TTL
15. Cookie Secure flag em prod (verificar .env)
16. autoClassifyTransactions reset em re-import (BUG)
17. **dedupHash NULL em transferências** (NOVO — vulnerabilidade futura)
18. **56 erros PM2 pair-pendentes** (NOVO — UNIQUE constraint failed)
19. **OP.CREDITO sem espaço** (NOVO — 4 tx pendentes intencionais)

## SEÇÃO 14.3: TECH DEBT (Sprint 3.1 prioritário)

### Alta prioridade:
1. **AiLearningRule sem filtros amount**:
   - Schema atual não suporta amountMin/amountMax/requireType
   - Limita regras complexas (ex: "PIX >R$ 250 fica pendente")
   - Impede otimizações por valor

2. **Auth consolidation**:
   - lib/auth.ts legacy + lib/auth/ novo
   - Unificar em uma estrutura

3. **Anthropic SDK oficial**:
   - Atualmente usando fetch direto
   - Migrar para @anthropic-ai/sdk

4. **Cache rehydration helper**:
   - Date/Decimal viram string ao recuperar de unstable_cache
   - Criar helper genérico para reidratação

### Média prioridade:
5. **dedupHash NULL em transferências**:
   - Tx manuais podem ter NULL
   - Vulnerabilidade futura (duplicação)

6. **56 erros PM2 pair-pendentes**:
   - prisma.transaction.create() UNIQUE constraint failed
   - Investigar fluxo de pareamento

7. **OP.CREDITO sem espaço**:
   - 4 tx pendentes intencionais (conservador)
   - Decidir se aplica regra ou mantém manual

### Baixa prioridade:
8. **AiClaudeCache TTL policy**: Definir política de expiração
9. **Cookie SECURE flag verificar prod**: Garantir flag ativa
10. **.npmrc legacy-peer-deps**: Adicionar configuração

---

# PARTE 5 — SESSÃO HISTÓRICA 22-23/05/2026 (NOVA — v6.2)

## SEÇÃO 14.4: SESSÃO HISTÓRICA 22-23/05/2026

### Conquistas em 22 horas:

**Migrações Executadas (7):**
- D17: Plano contábil profissional Cacula Mix (39 regras)
- D18: PIX/Stone/Conta Única Banrisul (602 vendas - R$ 233.733)
- D19: Transferências + Salários + Fornecedores (106 tx - R$ 438.015)
- D20: Funcionárias + Imobilizado + Outros (52 tx)
- D20.1 + D21: Finalização Parte 1 (19 tx - R$ 30.589)
- D22: Fechamento Final (66 tx + 57 regras + 3 categorias)

**Sprints Concluídas (5+2 fixes):**
- Sprint 3.0.1: Fix Safari ITP cookie bug em /pendentes
- Sprint 3.0.2: Conferência pós-import (5 features — filtro, busca, badges, drill-down)
- Hotfix Sidebar: Adicionar link "Transações" no menu
- Sprint 3.0.3: Edição Power (3 features — inline edit, bulk, filtro valor)
- Sprint 3.0.4: Polimento Pro (4 features — export CSV, atalhos teclado, preview regra, URL persistente)
- Fix Dashboard UX: Labels claros + tooltips + Resultado Operacional
- Fix Bug Visual Mini-DRE: Números sobrepostos quando previous=0

### Métricas Finais:
- 866 transações classificadas
- R$ 814.303,68 movimentado registrado
- Cacula Mix: 47% → 96.5% (+49.1pp)
- ~120 regras IA criadas (subiu pra 138 no fim)
- ~30 categorias profissionais
- 32 funcionárias identificadas
- **1.667 testes passing (+103 vs v6.1)**
- ~35 commits no GitHub

## SEÇÃO 14.5: DECISÕES ARQUITETURAIS RECENTES

Ver detalhamento em `/docs/DECISOES.md` (D1-D22 documentadas).

Resumo principais (D17-D22):
- **D17:** CMV hierarquia (Matéria-Prima, Bebidas, Embalagens, Frete Compras)
- **D18:** Conta Única Banrisul = vendas (cheque especial empresarial)
- **D19:** Transferências PJ→PJ = "Entre Contas Próprias" (não DRE)
- **D20:** Imobilizado separado (não despesa)
- **D21:** Tudo em produção, 91.1% Cacula Mix
- **D22:** Distribuição Lucros (escola filho), Investimentos (Consórcio)

## SEÇÃO 14.6: LIÇÕES APRENDIDAS (22-23/05)

### Técnicas:

1. **Safari ITP cookie bug**: Sessões longas no Safari suprimem cookie auth.
   Solução: detectar 401, redirect login, banner persistente, credentials:'include'.

2. **Cache do browser pós-deploy**: Build novo subiu, Safari mostra antigo.
   Solução documentada: Cmd+Shift+R obrigatório após deploy.

3. **Math + UX matter**: Cards Receita-Despesa não batiam visualmente com Resultado.
   Solução: trocar para Resultado Operacional + tooltips explicativos.

4. **Layout overflow**: Quando variação = valor (mês anterior = 0), número
   duplicado overflow no slot pequeno.
   Solução: fallback "novo" + slot maior (88px).

### Estratégicas:

1. **Documentação valida produto**: Refazer Bible v5.1 → v6.0 → v6.1 → v6.2 baseado
   em feedback Claude Code transformou doc em ferramenta de produto.

2. **Sprint pequena > Sprint grande**: 5 sprints de 1h-3h cada > 1 sprint
   de 15h. Maior controle, menor risco.

3. **Dual chat (Claude + Claude Code)**: Estratégia + Execução em paralelo.
   Yussef vira maestro que coordena os dois.

4. **Trust but verify**: Yussef questionou comportamento estranho,
   descobriu Safari bug + bug visual DRE. Processo evita acumular bugs.

---

# PARTE 6 — ROADMAP DE PRODUTO (ATUALIZADO v6.2)

## SEÇÃO 15: ROADMAP REALISTA

### PRÓXIMOS 7 DIAS (24-31/maio):
- [ ] D23: Replicar Cacula Mix structure para academias (12 empresas)
- [ ] IA #3 ULTRA: Setup inicial WhatsApp
- [ ] Sprint 3.1: Tech debt — filtros amount em AiLearningRule

### PRÓXIMAS 4 SEMANAS (junho):
- [ ] Onda 1 Comercial: Deploy comercial CAIXAOS
- [ ] IA #3 ULTRA: WhatsApp + Voz + Visão completo
- [ ] Landing page caixaos.com.br
- [ ] Pricing model
- [ ] Primeiros 5 clientes beta

### PRÓXIMO TRIMESTRE (jul-ago-set):
- [ ] IA #4 ULTRA: Consultor Estratégico
- [ ] IA #5 ULTRA: Automação Autônoma
- [ ] Multi-tenant architecture
- [ ] 50 clientes pagantes
- [ ] R$ 50k MRR

### SPRINT IMEDIATO (preservado de v6.1):

**Sprint 3.0 — APLICAÇÃO/RESGATE FIX (10 dias):**

**Schema (melhor abordagem - Claude Code):**
```prisma
model Transaction {
  // ... existente
  transferKind String?  // 'APPLICATION' | 'INTERBANK' (NULL = não é transferência)
  // Reusa transferGroupId existente do Sprint 0.5
  // NÃO criar TRANSFER_INTERNAL — quebra filtros existentes
}
```

**Cronograma realista:**
- Dia 1-2: Schema + helper isInternalTransfer (PURO)
- Dia 3-4: Lib financial-applications + patterns por banco + tests
- Dia 5: UI badge + página /aplicacoes-automaticas (revisão)
- Dia 6: Refactor filtros (DRE, cashflow, 7+ insight detectors)
- Dia 7-8: Golden tests com dados reais (regressão DRE)
- Dia 9: Deploy + smoke + backfill prod
- Dia 10: Buffer + docs

**Patterns confirmados:**
- Banrisul: `/APLICA[CÇ]AO\s+AUTOMATIC[AO]\s+CDB/i`
- Outros (precisa OFX): Bradesco, Sicredi, Itaú, Inter, Santander

**Backfill:**
- Idempotente
- Dry-run obrigatório primeiro
- Audit log de cada detecção
- Reversível

### SEMANAS 5-6 — SPRINT 3.1 (TECH DEBT)

**Tech debt crítico:**
- AiLearningRule filtros amount (NOVO PRIORITÁRIO)
- Auth consolidation (lib/auth.ts → lib/auth/)
- Anthropic SDK oficial
- Cache rehydration helper (Date/Decimal)
- .npmrc com legacy-peer-deps
- Cookie SECURE em prod (verificar)
- AiClaudeCache TTL
- Sincronizar Bible com DECISOES.md real

### SEMANAS 7-12 — IA #1 ULTRA (3 sprints)

**Sprint 3.2 (Sem 7-8) — Explainability:**
- /pendentes premium (✓ JÁ tem em 3.0.2)
- Atalhos teclado (✓ FEITO em 3.0.4: J/K/E/X/Enter/Cmd+A/?/...)
- Confidence visual (✓ FEITO em 3.0.2: badges, cores)
- Modal "Por que essa categoria?" (PENDENTE)

**Sprint 3.3 (Sem 9-10) — Aprendizado profundo:**
- Pattern recognition pessoal
- Sugestão de regras automática
- Bulk classification (✓ FEITO em 3.0.3)
- Preview de regra (✓ FEITO em 3.0.4)

**Sprint 3.4 (Sem 11-12) — Trust + UX:**
- Reconciliação inteligente
- Dashboard performance IA
- Trust badges
- Mobile otimizado

### META 90 DIAS:
✅ Aplicação/Resgate RESOLVIDO
✅ Tech debt CRÍTICO zerado
✅ IA #1 → ⭐⭐⭐⭐⭐
✅ Quick wins implementados

### MÊS 4-6 — IA #2 ULTRA

(Após IA #1 perfeita)

### MÊS 7-9 — IA #3 (WhatsApp)

(Realista: Mês 7+, não 4-5 — Meta onboarding leva 2-4 semanas)

### MÊS 10-12 — IA #4 + INÍCIO IA #5

⚠️ **NOTA HONESTA:** 5 IAs perfeitas em 12 meses solo = irrealista.
Opção 1: Contratar Eng#2 antes IA #4
Opção 2: Adiar IA #4 e #5 para Ano 2

---

# PARTE 7 — DECISÕES ARQUITETURAIS

## SEÇÃO 16: PRINCÍPIOS TÉCNICOS

10 mandamentos: Simples antes de complexo, TS strict, testes, observabilidade, segurança, performance, migrations seguras, documentar, feature flags, refactoring contínuo.

**MULTI-TENANT:** Toda query SQL filtra empresa_id. SEMPRE.

## SEÇÃO 17: STACK ATUAL REAL (CORRIGIDO v6.2)

**Frontend:** Next.js 16 + TypeScript 5 + Tailwind 3.4 + shadcn/ui + Framer Motion + React 18.3

**Backend:** Node.js + Next.js API + Prisma 5.22 + PostgreSQL + JWT próprio

**IA:** Claude Sonnet 4.6 (fetch direto, MIGRAR para SDK) + Haiku 4.5 (categorizer) + BrasilAPI

**Infra:** DigitalOcean Droplet + Cloudflare + PM2

**Testing:** Vitest 2.1 (1667 testes)

**Charts/Anim:** Recharts 3.8 + Framer Motion 12.38

**TOTAL:** ~22 tecnologias core REAIS

## SEÇÃO 18: STACK FUTURO

**Filosofia:** Adicionar quando precisar, não antes.

**Mapeamento (futuro):**
- Sprint 3.1: Anthropic SDK + .npmrc
- Onda 4: WhatsApp Cloud API + pgvector
- Onda 5: Pluggy/Belvo
- Quando escalar: Redis Upstash, Sentry, Pino

---

# PARTE 8 — APÊNDICES

## SEÇÃO 19: GLOSSÁRIO

**CAIXAOS** = nome do produto (pasta = conta-ia)
**Onda** = fase ~3 meses
**Sprint** = 1-2 semanas
**IA #1-#5** = 5 super-IAs ultras
**D17-D22** = migrações de plano contábil profissional Cacula Mix (22-23/05)

## SEÇÃO 20: WIREFRAMES

5 telas-chave: Landing, Dashboard, /pendentes premium, WhatsApp chat (futuro), Insights.

## SEÇÃO 21: SCHEMA DADOS CORE

**Multi-tenant:** Todos modelos filtram empresaId.

**Novos campos Sprint 3.0:**
- Transaction.transferKind String? // 'APPLICATION' | 'INTERBANK'
- Reusa transferGroupId existente

**Sprint 3.0.4 (sem schema):**
- C1-C4 todos puramente código, sem migrations

## SEÇÃO 22: DECISÕES ARQUITETURAIS

**⚠️ IMPORTANTE — FONTE ÚNICA DE VERDADE:**

Para D1-D22 e decisões oficiais, consulte:
`/docs/DECISOES.md`

Este documento Bible NÃO duplica/inventa decisões.

**Decisões REAIS atuais (resumo, conforme DECISOES.md):**
- D1: Gerenciador separado
- D2: JWT_SECRET separados
- D3: Cookie Domain literal
- D4: users.role='CLIENT'
- D5: Anti-enumeration
- D6: Rate limit em memória
- D7: Resend
- D8: Código 6 dígitos
- D9: API routes (não Server Actions)
- D10: Branch ff/main
- D11: gerenciador_audit_log NULL
- D12: Snapshot coupon_redemptions
- D13: Resgate cupom fire-and-forget
- D14: Onda 2 caminho A
- D15: Multi-OFX sequencial
- D16: Reverter import DELETE+REVERTED
- D17: CMV hierarquia Cacula Mix (Matéria-Prima/Bebidas/Embalagens/Frete)
- D18: Conta Única Banrisul = vendas (cheque especial empresarial)
- D19: Transferências PJ→PJ = "Entre Contas Próprias" (não DRE)
- D20: Imobilizado separado de despesas
- D21: Tudo em produção (91.1% após D17-D20, depois 96.5% após D22)
- D22: Distribuição Lucros + Investimentos categorizados

**Decisões PROPOSTAS (não tomadas ainda):**
- D23 (futuro): Replicar Cacula Mix structure pras 12 academias
- D24 (futuro): Detecção aplicação/resgate com transferKind
- D25 (futuro): pgvector ao invés de Pinecone
- D26 (futuro): Anthropic SDK oficial
- D27 (futuro): React Native (após PWA validar)

---

## REGISTRO DE MUDANÇAS

| Data | Versão | Mudanças |
|------|--------|----------|
| 21/05/2026 | 6.0 | Documento refeito — foco produto |
| 22/05/2026 | 6.1 | Correções após feedback Claude Code: IA #3 = 0/5, Stack real, D1-D16 referenciar DECISOES.md, Sprint 3.0 = 10 dias, schema transferKind, números atualizados |
| 23/05/2026 | **6.2** | **Sessão histórica 22-23/05/2026 documentada (D17-D22 + 5 sprints + 2 fixes). Cacula Mix 47% → 96.5%. Testes 1.564 → 1.667. Tech debt +3 itens. Status 5 IAs atualizado. Roadmap próximos 7d/4 sem/trimestre. Lições aprendidas técnicas + estratégicas.** |

---

## ESTADO ATUAL (23/05/2026)

**O QUE TÁ NO AR:**
- Onda 1 + Onda 2 + Sprint 3.0.x completas
- Sistema em produção `app.caixaos.com.br`
- 1.667 testes passing (+103 vs v6.1)
- 138 regras IA aprendidas (Cacula Mix)
- 13 fornecedores detectados
- 1.694 transações classificadas (96.5%)
- 5 commits Sprint 3.0.4 (export CSV + atalhos + preview regra + URL)
- 2 fixes pós-3.0.4 (Dashboard UX + Mini-DRE visual)

**PROBLEMAS ATIVOS:**
- 🚨 Aplicação/Resgate inflando DRE (Sprint 3.0 ainda pendente)
- 🚨 AiLearningRule sem filtros amount (Sprint 3.1)
- 🚨 Tech debt mapeado (19 itens)

**PRÓXIMA AÇÃO:**
1. D23: Replicar Cacula Mix structure pras 12 academias
2. Sprint 3.1: Tech debt — filtros amount
3. IA #3 ULTRA: Setup inicial WhatsApp
4. Sprint 3.0 — Aplicação/Resgate (10 dias)

---

# 🏆 PRODUCT BIBLE v6.2

**Status:** ✅ ATUALIZADO PÓS-SESSÃO HISTÓRICA 22-23/05

**Próxima ação imediata:**
D23 (replicar Cacula Mix) + Sprint 3.1 (tech debt) em paralelo

**Filosofia central:**
"Construir produto TÃO BOM que vender será consequência natural."

🚀 **CAIXAOS — O sistema de gestão que TU quer usar todo dia.**
