# CAIXAOS — PRODUCT BIBLE

**Versão:** 6.1 (Corrigida após feedback Claude Code)
**Data:** 22 de maio de 2026
**Autor:** Yussef Musa + Claude
**Status:** ✅ DOCUMENTO PRINCIPAL — Foco 100% em produto

---

## 📋 NATUREZA DESTE DOCUMENTO

Este é o documento principal do CAIXAOS. Substitui v5.1 (CAIXAOS 2030) que foi deletado.

**FILOSOFIA:** "Construir produto TÃO BOM que vender será consequência natural."

**O QUE ESTE DOCUMENTO É:**
✅ Bíblia do PRODUTO CAIXAOS
✅ Visão técnica e UX
✅ Estado real (atualizado v6.1)
✅ Roadmap de construção
✅ Padrões de qualidade

**O QUE NÃO É:**
❌ Plano de marketing/vendas
❌ Projeções financeiras
❌ Pitch valuation

**⚠️ IMPORTANTE — FONTE ÚNICA DE DECISÕES TÉCNICAS:**
Para decisões arquiteturais (D1-D16), consulte sempre `/docs/DECISOES.md`.
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

**ESTADO ATUAL HONESTO (CORRIGIDO v6.1):**
- IA #1: ⭐⭐⭐⭐⚪ (4/5) — funciona em prod
- IA #2: ⭐⭐⚪⚪⚪ (2/5) — 7 detectors básicos no dashboard
- IA #3: ⚪⚪⚪⚪⚪ (0/5) — ❌ ZERO código WhatsApp/voz/imagem (CORRIGIDO de 1/5)
- IA #4: ⚪⚪⚪⚪⚪ (0/5) — não existe
- IA #5: ⚪⚪⚪⚪⚪ (0/5) — não existe
- **TOTAL: 22% pronto** (corrigido de 28%)

## SEÇÃO 5: IA #1 — CONTADORA INTELIGENTE

**Promessa:** "Lança sem pensar. IA classifica perfeitamente, aprende contigo."

**Pipeline 4 camadas:**
1. RULE engine (instantâneo, <1ms)
2. KEYWORD detector (instantâneo)
3. BRASILAPI (300ms)
4. CLAUDE Sonnet (1s, contexto profundo)

**Estado atual (atualizado 22/05):**
- 13 regras em prod (atualizado após refazer Cacula Mix)
- 6 fornecedores detectados
- 333 de 378 transações classificadas
- Confidence média 0.85+
- ⚠️ Aprendizado RESETADO — vai melhorar com uso

**Para ser 5⭐:**
- Sprint 3.2: Explainability UI + Confidence visual + atalhos teclado
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

**Estado:** 0/5 — ZERO arquivos WhatsApp/voz/imagem (corrigido de 1/5).

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

**Atual:** 40-60 min/dia
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

# PARTE 4 — ESTADO ATUAL HONESTO (ATUALIZADO v6.1)

## SEÇÃO 14: ESTADO ATUAL REAL

**✅ ONDA 1 + 2 COMPLETAS:**
- Tests: 1.564 passing ✅
- Tags onda-1-completa + onda-2-completa ✅
- Pipeline 3-layer funcionando ✅
- OFX multi-import ✅

**📊 NÚMEROS REAIS (22/05/2026):**
- 13 regras IA em prod (Yussef refez Cacula Mix)
- 6 fornecedores detectados
- 333 de 378 transações classificadas
- 4 users (TU + 3 testes)
- 2 cupons no DB

**🚨 PROBLEMAS CRÍTICOS:**

**#1 APLICAÇÃO/RESGATE AUTOMÁTICO:**
- Banrisul confirmado: "APLICACAO AUTOMATICA CDB" / "RESGATE AUTOMATICO CDB"
- Outros bancos: padrões diferentes (precisa OFX)
- DRE inflado nos dois lados

**#2 IA RECOMEÇOU APRENDIZADO (NOVO):**
- TU deletou empresa pra refazer
- Aprendizado anterior PERDIDO
- IA está acertando menos categorias
- VAI MELHORAR com uso e correções

**#3 IMPORT MANUAL:**
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

ADICIONAIS (Claude Code apontou):
7. Coverage real ~50-60%, não 95%
8. audit_log sem retention policy
9. Schema dual SQLite/Postgres
10. swap-prisma-to-postgres.sh hack
11. Sem rollback automatizado de deploy
12. JWT 24h sem refresh token
13. AiClaudeCache cresce sem TTL
14. Cookie Secure flag em prod (verificar .env)
15. autoClassifyTransactions reset em re-import (BUG)

**🚨 STACK REAL (CORRIGIDO):**

Atual em package.json:
- Next.js 16 ✅
- Prisma 5.22 (não 6)
- React 18.3.1 (não 19)
- Tailwind 3.4 (não v4)
- TypeScript 5+ strict ✅
- Vitest 2.1
- shadcn/ui ✅
- console.error (não Pino)
- SEM Sentry

Stack futuro (quando precisar):
- Pino logging
- Sentry
- Pluggy (Open Finance BR)
- WhatsApp Cloud API
- pgvector (NÃO Pinecone)
- OpenAI TTS

---

# PARTE 5 — ROADMAP DE PRODUTO

## SEÇÃO 15: ROADMAP REALISTA

### SPRINT IMEDIATO (Semana 1 — 22-29/maio)

**Sprint 2.6 — VALIDAÇÃO REAL OFX (YUSSEF):**
- TU refez Cacula Mix ✅
- TU subiu OFX Banrisul + Stone + Sicredi ✅
- ⚠️ IA "mais burra" — aprendendo do zero
- Medir % auto-classificação real
- Identificar padrões de erro

### SEMANA 2 — QUICK WINS

**Quick Wins valiosos (Claude Code sugeriu):**
1. Health check endpoint (/api/health) — 1h
2. Dashboard custo Claude (/admin/ai-costs) — 2h
3. Welcome flow OFX (D+7 sem import → email) — 2h
4. Email saldo negativo cheque especial — 4h
5. Export DRE PDF (@react-pdf/renderer) — 6h
6. Status page (status.caixaos.com.br) — 1h

**Total:** ~16h = 2-3 dias trabalho

### SEMANAS 3-4 — SPRINT 3.0 (10 DIAS, NÃO 5!)

**APLICAÇÃO/RESGATE FIX (corrigido):**

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
- Auth consolidation (lib/auth.ts → lib/auth/)
- Anthropic SDK oficial
- Cache rehydration helper (Date/Decimal)
- .npmrc com legacy-peer-deps
- Cookie SECURE em prod (verificar)
- AiClaudeCache TTL
- Sincronizar Bible com DECISOES.md real

### SEMANAS 7-12 — IA #1 ULTRA (3 sprints)

**Sprint 3.2 (Sem 7-8) — Explainability:**
- /pendentes premium
- Atalhos teclado (J/K/A/E/S)
- Confidence visual (badges, cores)
- Modal "Por que essa categoria?"

**Sprint 3.3 (Sem 9-10) — Aprendizado profundo:**
- Pattern recognition pessoal
- Sugestão de regras automática
- Bulk classification

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

# PARTE 6 — DECISÕES ARQUITETURAIS

## SEÇÃO 16: PRINCÍPIOS TÉCNICOS

10 mandamentos: Simples antes de complexo, TS strict, testes, observabilidade, segurança, performance, migrations seguras, documentar, feature flags, refactoring contínuo.

**MULTI-TENANT:** Toda query SQL filtra empresa_id. SEMPRE.

## SEÇÃO 17: STACK ATUAL REAL (CORRIGIDO)

**Frontend:** Next.js 16 + TypeScript 5 + Tailwind 3.4 + shadcn/ui + Framer Motion + React 18.3

**Backend:** Node.js + Next.js API + Prisma 5.22 + PostgreSQL + JWT próprio

**IA:** Claude Sonnet 4.6 (fetch direto, MIGRAR para SDK) + BrasilAPI

**Infra:** DigitalOcean Droplet + Cloudflare + PM2

**Testing:** Vitest 2.1

**TOTAL:** ~20 tecnologias core REAIS (não 30 como inflado antes)

## SEÇÃO 18: STACK FUTURO

**Filosofia:** Adicionar quando precisar, não antes.

**Mapeamento (futuro):**
- Sprint 3.1: Anthropic SDK + .npmrc
- Onda 4: WhatsApp Cloud API + pgvector
- Onda 5: Pluggy/Belvo
- Quando escalar: Redis Upstash, Sentry, Pino

---

# PARTE 7 — APÊNDICES

## SEÇÃO 19: GLOSSÁRIO

**CAIXAOS** = nome do produto (pasta = conta-ia)
**Onda** = fase ~3 meses
**Sprint** = 1-2 semanas
**IA #1-#5** = 5 super-IAs ultras

## SEÇÃO 20: WIREFRAMES

5 telas-chave: Landing, Dashboard, /pendentes premium, WhatsApp chat (futuro), Insights.

## SEÇÃO 21: SCHEMA DADOS CORE

**Multi-tenant:** Todos modelos filtram empresaId.

**Novos campos Sprint 3.0:**
- Transaction.transferKind String? // 'APPLICATION' | 'INTERBANK'
- Reusa transferGroupId existente

## SEÇÃO 22: DECISÕES ARQUITETURAIS

**⚠️ IMPORTANTE — FONTE ÚNICA DE VERDADE:**

Para D1-D16 e decisões oficiais, consulte:
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

**Decisões PROPOSTAS (não tomadas ainda):**
- D17 (futuro): Sistema cupons flexível
- D18 (futuro): Detecção aplicação/resgate com transferKind
- D19 (futuro): pgvector ao invés de Pinecone
- D20 (futuro): WhatsApp Cloud API (não Z-API)
- D21 (futuro): Anthropic SDK oficial
- D22 (futuro): React Native (após PWA validar)

---

## REGISTRO DE MUDANÇAS

| Data | Versão | Mudanças |
|------|--------|----------|
| 21/05/2026 | 6.0 | Documento refeito — foco produto |
| 22/05/2026 | 6.1 | **Correções após feedback Claude Code:** IA #3 = 0/5, Stack real, D1-D16 referenciar DECISOES.md, Sprint 3.0 = 10 dias, schema transferKind, números atualizados |

---

## ESTADO ATUAL (22/05/2026)

**O QUE TÁ NO AR:**
- Onda 1 + Onda 2 completas
- 1.564 testes passing
- 13 regras IA (refeitas)
- 6 fornecedores (refeitos)
- 333 transações classificadas (Cacula Mix novo)

**PROBLEMAS ATIVOS:**
- 🚨 Aplicação/Resgate inflando DRE
- 🚨 IA aprendendo do zero (acertando menos)
- 🚨 Tech debt mapeado (15 itens)

**PRÓXIMA AÇÃO:**
1. Investigar % real auto-classificação após reset
2. Quick wins (Semana 2)
3. Sprint 3.0 — Aplicação/Resgate (Semana 3-4)
4. Sprint 3.1 — Tech Debt (Semana 5-6)
5. Sprint 3.2-3.4 — IA #1 ULTRA (Semana 7-12)

---

# 🏆 PRODUCT BIBLE v6.1

**Status:** ✅ CORRIGIDO E PRONTO

**Próxima ação imediata:**
Sprint 2.6 (Yussef valida OFX real) + Quick Wins paralelos

**Filosofia central:**
"Construir produto TÃO BOM que vender será consequência natural."

🚀 **CAIXAOS — O sistema de gestão que TU quer usar todo dia.**
