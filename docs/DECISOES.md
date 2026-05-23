# Decisões Arquiteturais — CAIXAOS

Decisões irreversíveis ou de alto impacto registradas pra futuras consultas.
Cada decisão tem **contexto**, **opções consideradas**, **escolha**, **razão**.

---

## D1 — Dois sistemas COMPLETAMENTE separados (app + admin)

**Contexto:** Onda 1 SaaS, necessidade de painel administrativo.

**Opções:**
- (A) Coluna `role=SUPERADMIN` na tabela `User` do app
- (B) Tabela `Gerenciador` totalmente separada, em subdomínio próprio
- (C) Página admin restrita por IP / VPN

**Escolha:** **(B)** — `Gerenciador` em tabela isolada + subdomínio `admin.caixaos.com.br`.

**Razão:**
- Impossibilidade de promoção acidental: bug que mude role do User pra SUPERADMIN viraria escalation crítica
- Compromisso de user no app NÃO compromete admin (cookies/JWT separados)
- LGPD: dados de admin NÃO misturam com dados de cliente
- Audit log separado (`gerenciador_audit_log` vs `audit_log` de companies)
- Por construção: cliente NUNCA "vira admin" porque NEM EXISTE no banco do admin

**Registrado em:** ONDA-1-PLANO.md (Sprint 1.1) · Sprint 1.6 implementou.

---

## D2 — JWT_SECRET separados (app vs admin)

**Contexto:** Sprint 1.6 implementa autenticação do painel admin.

**Opções:**
- (A) Reusar `JWT_SECRET` único pra tokens de app E admin (diferenciar por `scope`)
- (B) Criar `JWT_SECRET_ADMIN` separado, isolado do app

**Escolha:** **(B)** — secrets totalmente separados.

**Razão:**
- Vazamento de `JWT_SECRET` (app) NÃO compromete admin (e vice-versa)
- Princípio de privilégio mínimo: admin precisa de blast radius reduzido
- Rotação independente: posso rotacionar secret admin sem invalidar sessões dos clientes
- Custo: 1 linha extra no `.env`, zero overhead operacional

**Implementação:** `lib/admin-auth/jwt.ts` lê `JWT_SECRET_ADMIN`. Verifica scope `admin-session`.

---

## D3 — Cookie Domain literal pra isolamento absoluto

**Contexto:** App em `app.caixaos.com.br`, admin em `admin.caixaos.com.br`. Subdomínios do mesmo apex.

**Opções:**
- (A) Cookie `Domain=.caixaos.com.br` — vale em todos os subdomínios
- (B) Cookie `Domain=admin.caixaos.com.br` (literal, sem ponto inicial) — só admin
- (C) Sem `Domain` (host-only) — só host setou

**Escolha:** **(B)** pro admin + **(C)** pro app (já é o comportamento default existente).

**Razão:**
- `Domain` sem ponto inicial = host-exclusive (browsers respeitam por spec RFC 6265)
- Garante que `admin_session` NÃO é enviado pra `app.caixaos.com.br`
- App cookie `auth_token` continua host-only (já era assim) → não vaza pro admin
- Segundo perímetro de defesa: nginx tem 3 vhosts separados (Sprint 1.3)

**Implementação:** `getAdminCookieOptions()` em `lib/admin-auth/jwt.ts`. Override via `ADMIN_COOKIE_DOMAIN=off` em dev.

---

## D4 — `users.role` permanece string mas valor único `'CLIENT'`

**Contexto:** Schema tem coluna `User.role` legacy (default `'CLIENT'`, mas 1 user `'ADMIN'`).

**Opções:**
- (A) Remover coluna `role` do `User` (drop)
- (B) Manter coluna + normalizar TODOS pra `'CLIENT'`
- (C) Manter coluna + permitir valores diversos (`STAFF`, `BETA`, etc)

**Escolha:** **(B)** — manter coluna mas TODO user é `'CLIENT'`.

**Razão:**
- Drop teria que migrar referências (potencialmente em queries existentes)
- Permitir múltiplos valores deixa porta aberta pra "escalation acidental" (problema central que D1 resolve)
- Cupons + planos futuros vão usar `Coupon`/`Subscription` separados, não `role`
- Migration M3 (Sprint 1.6) normalizou: `UPDATE users SET role='CLIENT' WHERE role != 'CLIENT'`

---

## D5 — Anti-enumeration em fluxos de auth

**Contexto:** Endpoints `/forgot-password`, `/admin/login`, `/cadastro` podem revelar se um email existe.

**Opções:**
- (A) Retornar erro específico "Email não cadastrado"
- (B) Retornar mensagem genérica que NÃO revela existência

**Escolha:** **(B)** pro forgot-password e admin/login. **Específico só pra cadastro** (UX) — email duplicado retorna 409.

**Razão:**
- Atacante usa diferença entre respostas pra enumerar usuários cadastrados
- Tempo constante: usar `bcrypt.compare` mesmo com user inexistente (delay simulado)
- Logs no servidor diferenciam (auditoria) mas resposta HTTP é genérica
- Trade-off aceito: usuário pode ficar confuso se digitou email errado, mas segurança ganha

**Implementação:**
- `/forgot-password` (Sprint 1.5): sempre 200 + `maskedEmail`
- `/admin/login` (Sprint 1.6): sempre 401 + "Credenciais inválidas"

---

## D6 — Rate limit em memória (lib/rate-limit.ts)

**Contexto:** Várias camadas (login app, login admin, forgot-password) precisam rate limit.

**Opções:**
- (A) Redis
- (B) In-memory `Map` no Node
- (C) Sem rate limit (assumir uso normal)

**Escolha:** **(B)** — `Map` in-memory.

**Razão:**
- 1 instância PM2 hoje — Redis seria overengineering
- Setup zero (sem dependência externa)
- Latência <1ms
- Custo: estado perdido em restart (aceitável: limites de janela 15 min, restart raro)
- Registrado em `PROBLEMAS.md` pra migrar Redis quando escalar > 1 instância

---

## D7 — Resend pra email transacional

**Contexto:** Sprint 1.5 — esqueci senha + convite + welcome precisam enviar email.

**Opções:**
- SendGrid · Resend · Amazon SES · Postmark · Mailgun

**Escolha:** **Resend**.

**Razão:**
- Setup mais simples (verificação DNS em 5 min)
- React Email templates first-class (compatível com nosso stack Next.js)
- Free tier 3k emails/mês (suficiente pra MVP)
- Dashboard com analytics nativo (bounces, opens)
- SDK TypeScript bem documentado

**Implementação:** `lib/email/` (Sprint 1.5). `RESEND_API_KEY` no `.env`.

---

## D8 — Código 6 dígitos vs link com token (reset de senha)

**Contexto:** Sprint 1.5 — UX do fluxo "Esqueci minha senha".

**Opções:**
- (A) Link em email com token longo (`?token=xxx`)
- (B) Código 6 dígitos numérico

**Escolha:** **(B)** — código 6 dígitos.

**Razão:**
- UX padrão BR (Stripe, Conta Azul, Nibo) — usuários conhecem
- Anti-phishing: código NÃO vaza por sharing acidental de tela/screenshot
- Mobile-friendly: digitar 6 dígitos > clicar link em SMS/Gmail mobile
- Rate limit por tentativas mais simples (5 tentativas/código)

---

## D9 — API routes em vez de Server Actions

**Contexto:** Next.js 16 oferece Server Actions como alternativa a API routes.

**Opções:**
- (A) Server Actions (`app/.../actions.ts`)
- (B) API routes (`app/api/.../route.ts`)

**Escolha:** **(B)** — API routes em TODO o projeto.

**Razão:**
- Consistência com código existente (Sprints 1.2-1.5 todas usam)
- Testabilidade: function pura → endpoint chama; mock direto via fetch
- Cacheabilidade: middleware proxy.ts intercepta `/api/*` uniformemente
- Server Actions têm RPC implicit complexity (formData binding, etc) — preferimos JSON explícito

---

## D10 — Branch `feat/sprint-N.M-descricao` + merge ff em main

**Contexto:** Workflow git pra sprints da Onda 1.

**Escolha:** Branch por sprint + merge fast-forward em main.

**Razão:**
- Histórico linear (sem merge commits poluindo log)
- Atomic: 1 sprint = 1 commit grande no main (mais 1-2 hotfixes pequenos)
- Branch fica viva no GitHub pra referência/PR review futuro
- Tag `sprint-N.M-completa` marca cada entrega

---

## D11 — `gerenciador_audit_log.gerenciadorId` NULL pra eventos de sistema

**Contexto:** Sprint 1.7 — `COUPON_REDEEMED` é disparado pelo signup do usuário, NÃO por um gerenciador logado. FK NOT NULL forçaria criar um "Gerenciador sistema" fake.

**Opções:**
- (A) Criar `Gerenciador` sentinel ("system") com email reservado
- (B) Tornar `gerenciadorId` NULL com semântica "evento de sistema"
- (C) Tabela separada `system_audit_log` (duplica infra)

**Escolha:** **(B)** — `gerenciadorId String?` nullable.

**Razão:**
- Sentinel exige row "fake" no banco, complica seeds e gera 2 semânticas pro mesmo campo
- Semântica clara: `gerenciadorId IS NULL` = ação automática do sistema
- Mantém 1 tabela única de audit (queries de auditoria não bifurcam)
- Migration faz `ALTER COLUMN DROP NOT NULL` + recria FK com `ON DELETE CASCADE` (mantém comportamento atual)

**Implementação:** `prisma/migrations/20260519000001_*` faz o ALTER. `redeemCoupon` em `lib/coupons/apply.ts` insere audit com `gerenciadorId: null`.

---

## D12 — Snapshot fields em `coupon_redemptions`

**Contexto:** Sprint 1.7 — cupom pode mudar de descrição/datas após resgates já existirem (edição admin permite mudar `description`, mas valor/type/code são imutáveis por design).

**Opções:**
- (A) Só guardar `couponId` na redemption; sempre buscar valor "atual" do cupom
- (B) Snapshot do estado do cupom no momento do resgate (code, type, value)
- (C) Bloquear toda edição do cupom após primeiro resgate

**Escolha:** **(B)** — `codeSnapshot`, `typeSnapshot`, `valueSnapshot` na redemption.

**Razão:**
- Auditoria: resgate guarda exatamente o que o cliente "pegou" mesmo que o cupom mude depois
- Relatórios fiscais futuros não dependem de estado atual da config
- Cupom EXAURIDO permanece consultável: dá pra reconstruir histórico sem JOIN
- `code` no schema é imutável (não tem PATCH pra ele); snapshot redundante mas barato e à prova de futuro

**Trade-off:** ~30 bytes extras por resgate. Aceito.

---

## D13 — Resgate de cupom é fire-and-forget no signup

**Contexto:** Sprint 1.7 — `POST /api/auth/cadastro` recebe `couponCode` opcional. Falha na aplicação do cupom deve barrar o cadastro?

**Opções:**
- (A) Cadastro 100% atomic: cupom inválido faz rollback do user
- (B) Fire-and-forget: cadastro sempre cria user; cupom é aplicado em paralelo (UI já validou antes)
- (C) Atomic + retornar erro específico de cupom (user tem que retentar)

**Escolha:** **(B)** — fire-and-forget.

**Razão:**
- UI já validou via `POST /api/coupons/validate` ANTES de submeter — caminho feliz já garantido
- Race condition rara (cupom exaure entre validate e cadastro) é tolerável: user cadastra sem desconto, contadores ficam consistentes (servidor é fonte da verdade)
- Falha de cupom NÃO deve bloquear cadastro (UX premium: "ah que pena, não pegou, mas você já está dentro")
- Atomicidade do user (criação + JWT + welcome email) já é alta — empilhar cupom em cima aumenta blast radius

**Implementação:** `app/api/auth/cadastro/route.ts` chama `void redeemCoupon(...)` SEM await; falha vira `console.warn` (logs em produção pra Yussef monitorar).

---

## D14 — Onda 2 = polish IA antes de cobrança (caminho A)

**Contexto:** Após auditoria 20/05/2026 mostrar que engine IA estava 80% pronta (pipeline 3 camadas + Claude + BrasilAPI funcionando) mas docs estavam desatualizados, três caminhos foram considerados pra Onda 2:
- (A) Polir IA + validar com OFX reais antes de divulgar
- (B) Cobrança SaaS (Asaas/Stripe)
- (C) Sprint 3 Dashboard + onboarding beta

**Escolha:** **(A)** — fechar UI da IA (regras + fornecedores), histórico de imports, multi-OFX + badge, e só depois cobrar.

**Razão:**
- FUNDADOR100 já cobre 100 primeiros contratos → cobrança não é urgente
- Validar IA com OFX reais antes de divulgar pros amigos transforma launch em "wow" em vez de "promete IA mas erra"
- Backend pronto + UI bonita = produto verdadeiramente "ship-ready"
- Risco de marketing IA sem validação real é maior que oportunidade de cobrar 100 free users imediatamente

---

## D15 — Multi-OFX processa SEQUENCIALMENTE (não paralelo)

**Contexto:** Sprint 2.4 — usuário pode arrastar 5-20 arquivos OFX de uma vez. Processar em paralelo seria mais rápido mas tem risco de race condition no dedupHash (mesmo hash pode ser INSERT 2x).

**Opções:**
- (A) Promise.all paralelo (mais rápido, race condition possível)
- (B) Loop for...of sequencial (mais lento, zero race)
- (C) Promise.all com mutex por bankAccountId

**Escolha:** **(B)** — sequencial.

**Razão:**
- Tempo de processar 10 arquivos OFX ≈ 5s sequencial vs 1.5s paralelo. Diferença irrelevante pra UX (já mostra fila visual com progress)
- Race condition no `@@unique([bankAccountId, dedupHash])` causaria erro 500 imprevisível, requereria retry logic
- Sequencial reusa rules + categorias carregadas 1 vez (cache de memória entre arquivos)
- Mutex (C) é complexidade desnecessária pra ganho marginal

**Implementação:** `for (const file of files) { ... }` em `app/api/contas-bancarias/[id]/importar-ofx-multiplos/route.ts`.

---

## D16 — Reverter import = DELETE + marcar REVERTED (não soft-delete tx)

**Contexto:** Sprint 2.3 — funcionalidade de "reverter import OFX". Duas semânticas possíveis:
- (A) Marcar transações como `status='REVERTED'` (soft-delete)
- (B) DELETE transações + marcar só o OfxImport como REVERTED (hard-delete tx, soft no audit)

**Escolha:** **(B)** — deletar transações, preservar OfxImport com status REVERTED.

**Razão:**
- Permite re-importar o mesmo arquivo OFX após revert (dedupHash fica livre porque a row sumiu)
- Status REVERTED em Transaction adicionaria 4ª variante semântica (PENDING/RECONCILED/IGNORED/REVERTED) e poluiria queries em todo lugar (DRE, cashflow, balance, etc precisariam filtrar)
- OfxImport.status=REVERTED preserva audit (quem reverteu, quando, quantas tx, ajuste de saldo)
- Transferências (transferGroupId) deletam o par inteiro pra evitar "meia transferência órfã"

**Implementação:** `app/api/empresas/[id]/imports/[importId]/revert/route.ts` faz atomic transaction com deleteMany + decrement balance + update OfxImport.

---

## D17 — Plano de contas profissional pra negócio de comida (Cacula Mix)

**Data:** 2026-05-22
**Status:** ✅ IMPLEMENTADO

**Contexto:** Cacula Mix (pizzaria/lanchonete) precisa de plano de contas contabilmente correto. Frete de mercadoria deve ser separado em "Frete sobre Compras" (CMV) e "Frete sobre Vendas" (Operacional). Templates de categoria base (sistema) não tinham essas distinções.

**Decisão:**
- Criar 4 categorias filhas de "Custo dos Serviços Prestados" (CUSTO_PRODUTO_VENDIDO): Matéria-Prima, Embalagens, Bebidas Revenda, Frete sobre Compras
- Criar 1 filha de "Despesas Operacionais" (DESPESAS_ADMINISTRATIVAS): Frete sobre Vendas
- Reutilizar pai existente "Custo dos Serviços Prestados" em vez de criar raiz nova "CMV" — evita duplicação no DRE (ambos somariam no mesmo dreGroup)
- Criar 39 regras IA `CONTAINS` específicas Cacula Mix (`MANUAL`, confiança 0.95) cobrindo: ATACADAO/MAKRO/ASSAI/CEASA/SADIA/PERDIGAO/LATICINIOS (matéria-prima), COCA COLA/AMBEV/PEPSICO (bebidas revenda), EMBALAGENS/PAPELÃO/CAIXA PIZZA (embalagens), TRANSPORTADORA/RODOVIARIO (frete compras), IFOOD/RAPPI/UBER EATS/MOTOBOY (frete vendas)

**Consequências:**
- DRE Cacula Mix passa a separar custo direto (CMV) de despesas operacionais corretamente
- Frete sobre Vendas (iFood, Rappi, etc) entra como despesa operacional (não infla CMV)
- IA aprende padrões específicos do setor restaurante → replicável pra outras pizzarias/lanchonetes
- 21 transações pendentes migradas automaticamente pra novas categorias (Embalagens 7, Laticínios 7, Frigorífico 4, iFood 3)

**Limitação aceita:**
- Categoria órfã legada "materia prima" (lowercase, sem parent, 2 tx vinculadas) preservada intocada. Yussef decide se desativa/move depois.

---

## D18 — Migração one-shot PIX/Stone/Conta Única Cacula Mix

**Data:** 2026-05-22
**Status:** ✅ EXECUTADO

**Contexto:**
Cacula Mix tinha 917 transações pendentes acumuladas de múltiplas importações OFX (Banrisul, Stone, Sicredi). Padrões identificados:
- `RECEBIMENTO PIX-PIX_CRED`: vendas via PIX (cliente paga)
- `RECEBIMENTO PIX-PIX_CRE` (truncado no extrato): variante do mesmo
- `RECEBIMENTO PIX-CX`: variante PIX
- `STONE DEB BLF`: vendas cartão débito Stone (POS)
- `OP. CREDITO C/GARANTIA`: vendas via Conta Única Banrisul (cheque especial empresarial onde vendas reduzem dívida do limite — NÃO é empréstimo novo)

**Decisão:**
Migração **ONE-SHOT** manual via script atomic (não persistir regra IA).

**Razão técnica:** schema `AiLearningRule` atual só filtra por descrição (campo `padrao` + `tipoMatch`). Não suporta filtros de valor (`amountMin`/`amountMax`) nem tipo de transação. Yussef pediu Regra 2 ("PIX >R$ 250 fica pendente") que NÃO é implementável sem mudar schema + engine `lib/ai-categorizer/predict.ts`.

Adiamos criação de regras IA persistentes pra Sprint 3.1 (tech debt) que vai:
1. Adicionar campos `amountMin Float? / amountMax Float? / requireType String?` ao `AiLearningRule`
2. Migration SQL Postgres
3. Engine integrar filtros no matching
4. UI `/regras` permitir editar filtros

**Aplicado (atomic via `prisma.$transaction`):**
- 602 transações classificadas como "Receita de Vendas"
- Total movimentado: **R$ 233.733,23**
- `classificationSource = 'MANUAL'` (honesto — humano decidiu, não engine)
- `aiConfidence = 0.92`
- `status = 'RECONCILED'`
- Audit log: 602 entries com `metadata.migration = 'D18 one-shot 2026-05-22'` + `matchedPattern` por tx + `batchTotal: 602`
- Backup `/opt/backups/pre-d18-cacula-pix-20260522-190024.sql.gz`

**Breakdown por pattern:**
| Pattern | Tx | R$ |
|---|---:|---:|
| `RECEBIMENTO PIX-PIX_CRED` | 457 | 63.984,19 |
| `RECEBIMENTO PIX-PIX_CRE` (truncado) | 83 | 5.726,24 |
| `OP. CREDITO C/GARANTIA` (Banrisul cheque especial) | 24 | 156.083,94 |
| `RECEBIMENTO PIX-CX` | 24 | 1.891,78 |
| `STONE DEB BLF` | 14 | 6.047,08 |
| **TOTAL** | **602** | **233.733,23** |

**Não aplicado (decisão Yussef — conservador):**
- `OP.CREDITO C/GARANTIA` SEM espaço após ponto (4 tx / R$ 8.017,90) — variante do extrato. Pode ser aplicada em D18.1 se Yussef confirmar.

**Pendentes restantes (315 tx):**
- `Transferência | Pix`: 141 tx / R$ 403.467 (saídas PIX — funcionários/fornecedores informais/contas próprias)
- `Outros (sem match)`: 163 tx (top: CASPER DISTRIBUIDORA 6x, LATICINIOS SANTO CRISTO 5x, SPAL IND BRAS DE BEBIDAS 5x, FRIGORIFICO SILVA 4x — fornecedores que merecem regras próprias)
- `STONE REEMBOLSO`: 8 tx / R$ 456 (devolução cartão — manual)
- `DEVOLUCAO PIX`: 3 tx / R$ 372 (manual)

**Estado pós-migração Cacula Mix:**
- 1.755 tx total
- 1.440 classificadas (82.1%)
- 315 pendentes (17.9%)
- 1.424 em "Receita de Vendas" (R$ 298.769,94)

**Próximos passos:**
1. Sprint 3.1: estender schema `AiLearningRule` com filtros (amountMin/Max, requireType, action)
2. Yussef cria regras pros fornecedores top (CASPER, LATICINIOS SANTO CRISTO, SPAL, FRIGORIFICO SILVA, DIS. DE PROD ALIM. LAMANA, TOZZO, OESA, CARGNELUTTI, BOX PAPER, DALMOLIN VANZIN, I.V.S.) — top 11 padrões cobrem ~40 tx de despesa
3. Após Sprint 3.1: criar regras IA persistentes com filtros pras 13 academias do Yussef
4. Yussef classifica manualmente novos PIX/Stone até Sprint 3.1 ficar pronto

**Limitação aceita:**
Sem regra IA persistente, futuras tx com mesmo padrão entram pendentes e Yussef classifica manual. Aceitável temporariamente porque ele revisa diariamente.

---

## D19 — Correções Cacula Mix: Transferências internas + Salários + Fornecedores

**Data:** 2026-05-22
**Status:** ✅ EXECUTADO

**Contexto:**
Após D18, Yussef revisou padrões pendentes e descobriu 3 correções importantes:
1. **46 tx `YUSSEF ABU ZAHRY MUSA - TRANSFERÊNCIA | PIX`** (R$ 331.120) NÃO são aporte de sócio. São transferências entre contas DA MESMA EMPRESA Cacula Mix (Banrisul/Sicredi ↔ Stone, ambas direções). Não entram no DRE.
2. **3 pessoas identificadas como funcionários** da Cacula Mix: Cristian de Matos Fortes (9 tx), Marcyelle da Silva dos Santos (4 tx), Carlise da Luz Lemos (4 tx). Total 17 tx / R$ 9.677,98.
3. **2 fornecedores reclassificados:** SPAL IND BRAS DE BEBIDAS = engarrafadora Coca-Cola → Bebidas Revenda (não Matéria-Prima); CARGNELUTTI E CIA = distribuidora de cerveja → Bebidas Revenda.

**Decisão:**
- Reutilizar categoria existente `Entre Contas Próprias` (TRANSFER/TRANSFERENCIA, sub de "Transferências") como representação de "Transferência Interna" — semântica idêntica, evita duplicação.
- Criar categoria `Salários e Encargos` (EXPENSE/DESPESAS_PESSOAL, sub de "Pessoal Administrativo"). Convive com `Folha CLT Administrativa`/`Encargos sobre Folha`/`Salários Cozinha/Motoboys/Salão` existentes — Yussef pode migrar pra granularidade maior depois.
- **NÃO criar regras redundantes** (`LATICINIOS SANTO CRISTO`, `FRIGORIFICO SILVA`) — regras genéricas `LATICINIOS` e `FRIGORIFICO` do D17 já capturam essas variações.
- Criar 9 regras IA `CONTAINS` (confiança 0.95, fonte `MANUAL`) — 6 fornecedores + 3 funcionários (pra capturar pagamentos futuros).

**Aplicado (atomic via `prisma.$transaction` em chunks de 50):**

Classificações diretas (63 tx · R$ 340.797,98):
- 46 `YUSSEF ABU ZAHRY MUSA` → Entre Contas Próprias (R$ 331.120,00)
- 9 `CRISTIAN DE MATOS FORTES` → Salários e Encargos (R$ 3.247,58)
- 4 `MARCYELLE DA SILVA DOS SANTOS` → Salários e Encargos (R$ 4.339,82)
- 4 `CARLISE DA LUZ LEMOS` → Salários e Encargos (R$ 2.090,58)

Migração via regras (43 tx · R$ 97.217,55) — inclui regras genéricas D17:
- 7 `LATICINIOS SANTO CRISTO` → Matéria-Prima (via regra genérica `LATICINIOS` D17)
- 4 `FRIGORIFICO SILVA` → Matéria-Prima (via regra genérica `FRIGORIFICO` D17)
- 6 `CASPER DISTRIBUIDORA` → Matéria-Prima (regra nova)
- 6 `BOX PAPER` → Embalagens (regra nova)
- 6 `SPAL IND BRAS DE BEBIDAS` → Bebidas Revenda (regra nova)
- 5 `LAMANA` → Matéria-Prima (regra nova)
- 5 `TOZZO ALIMENTOS` → Matéria-Prima (regra nova)
- 4 `CARGNELUTTI E CIA` → Bebidas Revenda (regra nova)

**Total movimentado: 106 tx · R$ 438.015,53**
**Backup pré-execução:** `/opt/backups/pre-d19-cacula-20260522-195351.sql.gz`
**Audit log:** 106 entries com `metadata.migration = 'D19 2026-05-22'` + `matchedPattern` + `batchKind` (`direct` ou `rule`).

**Estado após D19 (Cacula Mix):**
- Total tx: 1.755
- **Classificadas: 1.546 (88.1%)** ← era 82.1% após D18, era 47% antes do D17
- Pendentes: 209 (11.9%)
- Entre Contas Próprias: 46 tx
- Salários e Encargos: 17 tx
- Matéria-Prima: 29 tx (acumulado D17+D19)
- Bebidas Revenda: 10 tx
- Embalagens: 7 tx
- Receita de Vendas: 1.424 tx (do D18)

**Próximos passos:**
1. Yussef identifica natureza de fornecedores pendentes: `OESA COMERCIO`, `DALMOLIN VANZIN`, `I. V. S.`, `RG CAPITALIZACAO` (provavelmente seguro)
2. Investigar `PIX ENVIADO` genérico (7 tx · R$ 42.387,86) — descrição genérica precisa contexto humano
3. Sprint 3.1 (tech debt): adicionar `amountMin`/`amountMax`/`requireType` ao schema `AiLearningRule` pra regras com filtros robustas

**Limitação aceita:**
Os 209 pendentes restantes incluem fornecedores específicos ainda não cobertos por regra e descrições genéricas (`PIX ENVIADO`, `PIX MARKETPLACE`) que precisam contexto humano. Yussef classifica manualmente via `/pendentes` ou cria regras adicionais.

---

## D20 — Cacula Mix: Fechamento mês (funcionárias + fornecedores + imobilizado + outros)

**Data:** 2026-05-22
**Status:** ✅ EXECUTADO

**Contexto:**
Após D17 (categorias), D18 (PIX/Stone/Conta Única), D19 (transferências internas + 3 funcionários + 6 fornecedores), restavam 209 pendentes na Cacula Mix. Yussef revisou padrão a padrão e definiu natureza de cada um.

**Categorias criadas (3, sob hierarquias existentes):**
- `Imobilizado` (sub `Investimentos`, EXPENSE/INVESTIMENTOS) — pra equipamentos comprados sem identificação específica (vs Fogão/Câmara Fria/Mesas/PDV/etc que já existem como filhas específicas)
- `Títulos de Capitalização` (sub `Investimentos`, EXPENSE/INVESTIMENTOS) — pra RG Capitalização (título de capitalização)
- `Pagamento de Empréstimo` (sub `Despesas Financeiras`, EXPENSE/DESPESAS_FINANCEIRAS) — pra amortização + juros consolidados de empréstimo

**Categorias reusadas (3):**
- `Devoluções de Vendas` (sub `Deduções da Receita Bruta`, EXPENSE/DEDUCOES) — pra STONE REEMBOLSO (deduz receita no DRE corretamente)
- `IOF` (sub `Despesas Financeiras`) — pra IOF + IOF ADICIONAL
- `Salários e Encargos` (criada em D19) — pras 4 funcionárias novas

**Regras IA novas (12, todas CONTAINS, confiança 0.95, fonte MANUAL):**

Salários e Encargos (4 funcionárias):
- `FERNANDA CHAVES RAMIRES`, `ERIKA FERREIRA DA SILVA`, `MARCOS SILVA PAIVA`, `JENIFER DOS SANTOS RODRIGUES`

Matéria-Prima (2 fornecedores):
- `OESA COMERCIO`, `DALMOLIN VANZIN`

Imobilizado (2):
- `I. V. S.` (equipamento), `PIX MARKETPLACE` (sempre compra equipamento)

Outros (4):
- `STONE INSTITUIÇÃO` → Devoluções de Vendas
- `IOF` → IOF (captura tb "IOF ADICIONAL")
- `RG CAPITALIZACAO` → Títulos de Capitalização
- `CAIXA ECONOMICA FEDERAL` → Pagamento de Empréstimo

**Aplicado (atomic, em 91ms):**
| Categoria | Tx aplicadas | Valor |
|---|---:|---:|
| Salários e Encargos | 12 | R$ 3.736,25 |
| Matéria-Prima (OESA + DALMOLIN) | 7 | R$ 12.030,24 |
| Imobilizado (I. V. S. + PIX MARKETPLACE) | 11 | R$ 6.368,43 |
| Devoluções de Vendas | 8 | R$ 456,54 |
| IOF | 7 | R$ 677,40 |
| Títulos de Capitalização | 4 | R$ 708,86 |
| Pagamento de Empréstimo | 3 | R$ 7.707,86 |
| **TOTAL** | **52** | **R$ 31.685,58** |

**Decisão de dedup:** IOF é genérico (casa tudo que contém "IOF") — colocado por último na ordem de patterns. Outros patterns mais específicos pegam primeiro.

**Backup pré-execução:** `/opt/backups/pre-d20-cacula-20260522-201636.sql.gz`
**Audit log:** 52 entries com `metadata.migration = 'D20 2026-05-22'` + `matchedPattern` por tx.

**Pendentes mantidos intencionalmente (manual):**
- `PIX ENVIADO` (7 tx · R$ 42.387,86) — descrição genérica, contexto varia
- `PIX BANRISUL ENVIADO` (3 tx · R$ 22.350,00) — varia
- `OP.CREDITO C/GARANTIA` sem espaço (4 tx · R$ 8.017,90) — Yussef manteve conservador

**Estado final Cacula Mix:**
- 1.755 tx total
- **1.598 classificadas (91.1%)** ← era 88.1% após D19, era 47% antes do D17
- 157 pendentes (8.9%) — mistos de fornecedores ainda não cobertos + descrições genéricas
- Distribuição: Receita de Vendas 1.424 / Entre Contas Próprias 46 / Salários 29 / Matéria-Prima 36 / Imobilizado 11 / Bebidas 10 / Devoluções 8 / IOF 7 / Embalagens 7 / Capitalização 4 / Pagamento Empréstimo 3

**Trajetória D17 → D20 (sessão única 22/05/2026):**
- D17: criou estrutura CMV (5 cat + 39 regras) + 21 tx migradas
- D18: 602 tx PIX/Stone/Conta Única → Receita de Vendas (R$ 233.733)
- D19: 106 tx transferências internas + salários + fornecedores (R$ 438.015)
- D20: 52 tx fechamento mês (R$ 31.685)
- **Acumulado: 781 tx classificadas em 4 migrações · R$ 703.434 movimentados · 47% → 91.1%**

**Próximos passos:**
1. Sprint 3.1 (tech debt): adicionar `amountMin`/`amountMax`/`requireType` ao schema `AiLearningRule` pra regras com filtros (destrava casos como "PIX >R$ 250 fica pendente")
2. Replicar estrutura D17 (CMV) + D19/D20 (fornecedores específicos) pras outras 12 empresas do Yussef (academias) — adaptar regras pra setor SERVICE em vez de RESTAURANT
3. Documentar padrões aprendidos como playbook por setor

---

## D21 — Cacula Mix: Finalização (funcionários + fornecedores + empréstimo) + Safari workaround

**Data:** 2026-05-22
**Status:** ✅ EXECUTADO

**Contexto:**
Após D20 (91.1% classificado, 157 pendentes), Yussef identificou os últimos padrões previsíveis. Em paralelo, investigamos bug reportado "tx volta após excluir" — diagnóstico: Safari ITP / cookie expiration intermitente em `PUT /api/transacoes/[id]` (detalhes em `docs/SPRINT-3.0.1-SAFARI-FIX.md`).

**Ação 1 — Workaround Safari (5 tx):**
5 transações `DEP DINHEIRO ATM` PENDING que Yussef tentou ignorar mas o PUT não chegou ao DB foram marcadas como IGNORED via script direto (`scripts/d21-acao1-ignore-atm.ts`). Audit `metadata.batch = 'D20.1 — Safari workaround'`.

**Ação 2 — D21 classificação direta + regras:**

Categorias usadas (todas existentes — zero criada):
- `Salários e Encargos` (D19)
- `Matéria-Prima` (D17)
- `Pagamento de Empréstimo` (D20)

Regras IA novas (6, CONTAINS, confiança 0.95, fonte MANUAL):
- `WILLIAN FERREIRA DUARTE`, `FRANCIELE DE LIMA DIAS`, `EDUARDA ZENILDA RODRIGUES` → Salários e Encargos
- `CIA DA FRUTA` → Matéria-Prima
- `BAMBERG` → Matéria-Prima
- `AMORTIZACAO CONTRATO` → Pagamento de Empréstimo

Transações classificadas (14 atomic, 58ms):
| Pattern | Tx | R$ |
|---|---:|---:|
| WILLIAN FERREIRA DUARTE | 2 | 3.374,50 |
| FRANCIELE DE LIMA DIAS | 2 | 2.493,51 |
| EDUARDA ZENILDA RODRIGUES | 2 | 2.018,56 |
| CIA DA FRUTA | 2 | 7.914,74 |
| BAMBERG | 4 | 12.660,99 |
| AMORTIZACAO CONTRATO | 2 | 2.127,64 |
| **TOTAL** | **14** | **30.589,94** |

Nota sobre BAMBERG: 4 tx legítimas (3 pagamentos + 1 estorno) — todas `BAMBERG COMERCIO E REPRES LTDA`. Estorno classificado igual aos pagamentos (semântica de Matéria-Prima preservada via amount sign — sinal positivo no estorno reverte automaticamente no DRE).

Nota sobre AMORTIZACAO: 4 tx total na empresa (2 PENDING `C61021196` aplicadas em D21, 2 já RECONCILED `C41022570` em batch anterior pelo Yussef via UI).

**Não classificado (decisão Yussef):**
- `CIRO ASCIONE JUNIOR` (2 tx, R$ 2.243,75) — descrição contém "60 964 094" (8 dígitos, NIS/PIS não CNPJ). BrasilAPI vazia. Provável PF prestador. Yussef decide categoria futuramente.

**Backup pré-execução:** `/opt/backups/pre-d21-cacula-20260522-214256.sql.gz`

**Estado final Cacula Mix:**
- 1.755 tx total
- **1.628 classificadas (92.8%)** ← era 91.1% após D20
- 96 PENDING (5.5%)
- 29 IGNORED (Yussef + workaround D20.1)
- 2 RECONCILED sem categoryId (corner case raro)

**Pendentes restantes intencionais (96):**
- `PIX ENVIADO` (~7 tx) — descrição genérica, manual
- `PIX BANRISUL ENVIADO` (~3 tx) — manual
- `OP.CREDITO C/GARANTIA` (sem espaço, 4 tx) — Yussef conservador
- `CIRO ASCIONE` (2 tx) — investigação pendente
- Outros padrões esparsos (1-2 tx cada) — Yussef classifica manual via UI

**Trajetória D17 → D21 (1 dia, 1 sessão única, 22/05/2026):**
| Migração | Tx classificadas | Após |
|---|---:|---:|
| Inicial | — | 47.4% |
| D17 (estrutura CMV + 39 regras) | 21 | 48.6% |
| D18 (PIX/Stone/Conta Única) | 602 | 82.1% |
| D19 (transferências + salários + fornecedores) | 106 | 88.1% |
| D20 (funcionárias + imobilizado + outros) | 52 | 91.1% |
| D20.1 + D21 (Safari workaround + finalização) | 5+14=19 | **92.8%** |
| **Acumulado** | **800 tx** | **+R$ 734.024,47** movimentados |

**Próximos passos:**
1. **Sprint 3.0.1** — Fix Safari ITP cookie bug (doc criado em `docs/SPRINT-3.0.1-SAFARI-FIX.md`)
2. **Sprint 3.1** (tech debt) — schema `AiLearningRule` com filtros `amountMin/Max/requireType`
3. **D22** — replicar plano contábil Cacula Mix nas outras 12 academias do Yussef (adaptar pra setor SERVICE)

---

## D22 — Cacula Mix: Fechamento Final (funcionárias + 22 fornecedores diversos)

**Data:** 2026-05-22
**Status:** ✅ EXECUTADO

**Contexto:**
Após D17-D21 + Sprint 3.0.1, restavam 96 pendentes. Yussef revisou padrão a padrão (incluindo investigações: CIRO ASCIONE = NIS não CNPJ; COOPERATIVA SANTA TERESA = mensalidade escola filho = despesa pessoal). Esta migração fecha Cacula Mix em ~96.5%.

**3 categorias novas:**
- `Pagamento Cartão de Crédito` (sub `Despesas Financeiras`, DESPESAS_FINANCEIRAS) — pra pagamento da fatura do cartão (distinto de Maquininha, que é taxa adquirência)
- `Segurança e Vigilância` (sub `Despesas Operacionais`, DESPESAS_ADMINISTRATIVAS) — pra serviços recorrentes tipo NC Eletrosul (existe `Sistema de Vigilância` sob INVESTIMENTOS, mas é equipamento, não mensalidade)
- `Despesas Diversas` (sub `Outras Despesas`, OUTRAS_DESPESAS) — bucket pra compras pontuais sem categoria específica

**Categorias reusadas (15):**
Salários e Encargos · Matéria-Prima · Bebidas Revenda · Embalagens · Imobilizado · Maquininha de Cartão · Tarifas Bancárias · Juros e Encargos · Insumos Operacionais · Combustível Delivery · Cartorárias e Taxas Públicas · Marketing Digital · Tecnologia · Frete sobre Compras · Manutenção e Limpeza · Material de Escritório · Investimentos (raiz) · Distribuição de Lucros · Pagamento de Empréstimo

**Regras IA novas (57 CONTAINS, confiança 0.92, fonte MANUAL):**

22 funcionárias → Salários e Encargos (28 tx · R$ 40.543,65):
- Eliane Garcia, Tiele Goncalves, Josyara Costa, Erica Karolayne, Alan Salbego, Renan da Silva Aires, Renan Ardais Cabral, Barbara Soares, Inaiara Silva, Jessica Oviedo, Isabel Almeida, Michelle Grohe, Tatiane de Mello, Ademar Bairros, Jessica Peres, Nadine da Luz, Andressa Raquel, Luana da Silva Ody, Renato Marques, Marcelo Kainoski, Luis Henrique Correa, Liege da Silva Boeira

6 fornecedores → Matéria-Prima (6 tx · R$ 1.176,22):
Nicola e Fernandes, Topflex, Carlos Cancian, Comercial Valoni, Casi Chocolates, Nestle Brasil

1 fornecedor → Bebidas Revenda (2 tx · R$ 1.234,90): Bortolazzo

1 pattern (TRENIER cobre 3 razões sociais) → Embalagens (3 tx · R$ 2.739,93)

1 fornecedor → Imobilizado (1 tx · R$ 1.982,67): Irmãos Braun

4 patterns → Pagamento Cartão de Crédito (4 tx · R$ 12.847,17):
Debito Cartao de Credito, Cartoes Caixa Visa PJ, Deb.Cta.Fatura, NU Pagamentos S/A

4 patterns → Maquininha (4 tx · R$ 1.444,11):
Aluguel Maq Cartoes, Mensalidade Maquininha Stone, Vero Santo Antonio, Vero S A

1 pattern → Tarifas Bancárias (1 tx · R$ 121,50): MENSALIDADE PACOTE

1 pattern → Juros e Encargos (2 tx · R$ 266,45): JUROS

1 pattern → Insumos Operacionais (1 tx · R$ 4.469,82): SUPERGASBRAS (gás cozinha)

1 pattern → Combustível Delivery (1 tx · R$ 208,54): COMBUSTIVEIS PITANGUEIRA

1 pattern → Cartorárias (1 tx · R$ 1.869,62): CARTORIO DO REGISTRO

1 pattern → Marketing Digital (1 tx · R$ 1.000): GHOST AGENCIA

1 pattern → Pagamento Empréstimo (1 tx · R$ 1.623,58): LIQUIDACAO DE PARCELA

4 patterns → Tecnologia (3 tx · R$ 1.802,49):
Vuca Solution, Ikatec Engenharia, NIC.BR, Nucleo de Informacao

1 pattern → Frete sobre Compras (1 tx · R$ 2.849): LM TRANSP

1 pattern → Manutenção (1 tx · R$ 1.000): DI CAR SUSPENSOES

1 pattern → Segurança e Vigilância (1 tx · R$ 143): NC ELETROSUL

1 pattern → Material de Escritório (1 tx · R$ 49,10): RM2 COMERCIO DE MATERIAIS

1 pattern → Investimentos (1 tx · R$ 1.478,51): CONSORCIO (carro/imóvel)

1 pattern → Distribuição de Lucros (1 tx · R$ 1.344,97): COOPERATIVA DE PAIS E MESTRES (mensalidade escola filho — despesa pessoal Yussef, não operacional)

1 pattern → Despesas Diversas (1 tx · R$ 83,98): BRASIL FREE SHOP

**Total aplicado: 66 tx · R$ 80.279,21 em 216ms (atomic via $transaction).**

**Backup pré-execução:** `/opt/backups/pre-d22-cacula-20260522-221127.sql.gz`
**Audit log:** 66 entries com `metadata.migration = 'D22 2026-05-22'` + `matchedPattern`.

**Pendentes intencionais (29 tx restantes):**
- `PIX ENVIADO` (7) / `PIX BANRISUL ENVIADO` (3) — descrições genéricas
- `OP.CREDITO C/GARANTIA` sem espaço (4) — Yussef conservador
- `CIRO ASCIONE JUNIOR` (2) — NIS não CNPJ, decisão pendente
- `SOLOSUL SONDAGENS` (1) · `JR TERRAPLANAGEM` (1)
- PFs esporádicos: Marcio, Ana Caroline, Daniela, Carla, Bruna, Cristiano (~5)
- `PJBANK PAGAMENTOS` (1), `LUANA`, `PAOLA DORNELES`, etc

**Estado final Cacula Mix:**
- 1.755 tx total
- **1.694 classificadas (96.5%)** ← era 92.8% após D21
- 29 PENDING (1.7%)
- 30 IGNORED (Yussef + workaround D20.1)
- 2 RECONCILED sem categoryId (corner case)

**Trajetória D17 → D22 (sessão única dia 22/05/2026):**
| Migração | Tx | % acumulado |
|---|---:|---:|
| Inicial | — | 47.4% |
| D17 (estrutura CMV + 39 regras) | 21 | 48.6% |
| D18 (PIX/Stone/Conta Única) | 602 | 82.1% |
| D19 (transferências + salários + fornecedores) | 106 | 88.1% |
| D20 (funcionárias + imobilizado + outros) | 52 | 91.1% |
| D20.1 + D21 | 19 | 92.8% |
| **D22 (fechamento final)** | **66** | **96.5%** |
| **ACUMULADO** | **866 tx** | **+49.1 pp · R$ 814.303,68 movimentados** |

**Próximos passos:**
1. **D23** — Replicar plano contábil Cacula Mix nas outras 12 academias do Yussef (adaptar pra setor SERVICE em vez de RESTAURANT)
2. **Sprint 3.1 (tech debt)** — schema `AiLearningRule` com filtros `amountMin/Max/requireType`
3. **Yussef classifica os 29 pendentes manuais** via UI (já com Safari fix da Sprint 3.0.1)

---

**Doc mantido em `docs/DECISOES.md`. Atualizar a cada decisão significativa.**
