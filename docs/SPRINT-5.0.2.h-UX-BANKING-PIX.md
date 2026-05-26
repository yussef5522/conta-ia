# Sprint 5.0.2.h — UX Banking + Fix Pendentes + Detecção Pix PJ↔PF/PJ

**Status:** ✅ CONCLUÍDO em 25/05/2026
**Suite testes:** 2295 → **2336 (+41 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled

## Motivação (Yussef em produção)

❌ **Bug Pendentes ERROR 1446651374** — dava erro genérico ao clicar em "Pendentes" dentro de empresa.

❌ **Upload OFX confuso** — 6 cliques (Dashboard → Empresas → Empresa → Contas modal → seleciona → Importar).

❌ **Pix PJ↔PF/PJ categorizado errado** — Pix do Cacula Mix (PJ) pro CPF do Yussef ou pra outro CNPJ dele virava despesa genérica em vez de Distribuição/Pró-labore ou Transferência.

## Bug raiz #1 (Pendentes) — RESOLVIDO

**Causa:** `Error: Cookies can only be modified in a Server Action or Route Handler` (digest `1446651374`).

8 páginas `/empresas/[id]/<route>/page.tsx` (Sprint 4.0.5.b) chamavam `setCurrentEmpresaCookie(id)` em Server Component render — Next.js 15+ bloqueia cookies.set fora de Server Action/Route Handler.

**Fix:** novo route handler `app/api/empresas/[id]/select-and-redirect/route.ts` faz set + redirect. Pages antigas viraram redirects 308 pra esse handler. Anti open-redirect via whitelist de destinos.

## Parte A — UX Banking (padrão QuickBooks/Xero)

### Sidebar
3 itens novos em FINANCEIRO:
- **Landmark · Bancos** → `/bancos`
- **Inbox · Pendentes** → `/pendentes` (com badge dinâmico)
- **Users · Pessoas Vinculadas** → `/pessoas-vinculadas`

### `/bancos` (NOVO)
Server component que lista contas com:
- Card visual por conta (ícone Landmark, nome, banco, saldo formatado)
- Badge de frescor (verde/âmbar/vermelho por dias desde último import)
- Botão **"Importar OFX"** direto → `/empresas/[id]/contas/[contaId]/importar`
- Botão **"Ver tx"** → `/transacoes?empresa=X&contaId=Y`
- Empty state com CTA "Cadastrar primeira conta"

### `/pendentes` (já existia, agora visível)
Mesma página robusta de Sprint 4.0.5.b (PendentesClient com 800+ linhas, atalhos, sugestões Claude). Agora acessível direto via sidebar com **badge contador**.

### Badge contador `transacoesPendentes`
Endpoint `/api/dashboard/badges` ganhou 1 query nova:
```typescript
transacoesPendentes: Transaction.count({
  bankAccount: { companyId },
  lifecycle: 'EFFECTED',
  status: 'PENDING',
})
```
Badge âmbar mostra quantas tx faltam categorizar.

## Parte B — Detecção Pix PJ↔PF/PJ

### Schema (migration 20260526000000_sprint_5_0_2h_pix_detection)

**SocioPF:**
- companyId, nome, cpf (nullable), pixKeys (TEXT JSON array), papel (SOCIO/ADMINISTRADOR/FAMILIAR)
- @@unique([companyId, cpf])

**EmpresaRelacionada:**
- companyId, cnpjRelacionado, nomeFantasia, pixKeys (TEXT JSON), relacao (MESMO_GRUPO/SOCIO_COMUM/CONTROLADA/CONTROLADORA)
- @@unique([companyId, cnpjRelacionado])

**Transaction** +`relatedPartyType` (SOCIO_PF | GRUPO_PJ | null) + `relatedPartyId` (sem FK constraint pra flexibilidade)

### Lib detecção (`lib/pix-detection/`)

**parse-pix.ts** — função pura `parsePixDescription(desc)`:
- Detecta keywords Pix/TED/transferência
- Extrai CPF formatado (`xxx.xxx.xxx-xx`) — prioridade absoluta
- Extrai CNPJ formatado ou 14 dígitos
- Extrai email (regex padrão)
- Extrai telefone 10/11 dígitos (DDD + número)
- CPF puro só se nada outro bater (anti-conflito telefone)
- Retorna `textoLimpo` sem identificadores pra match por nome
- `nameMatch(nome, texto)`: case-insensitive, sem acento, >=2 palavras significativas (≥3 chars) OU substring exato

**detect-pix-relacionado.ts** — função pura `detectPixRelacionado(input)`:

Ordem de match (alta → baixa confiança):
1. **CNPJ** → GRUPO_PJ (Transferência entre Contas, dreGroup TRANSFERENCIA)
2. **CPF do sócio** → SOCIO_PF (Distribuição Lucros / Pró-labore conforme papel)
3. **Email/telefone** nas pixKeys de empresa relacionada → GRUPO_PJ
4. **Email/telefone** nas pixKeys de sócio → SOCIO_PF
5. **Nome** (textoLimpo via nameMatch) → empresa primeiro, depois sócio
6. Sem match → `tipo: null` (mantém PIX_NORMAL)

Papel determina sugestão:
- `SOCIO` → Distribuição de Lucros (dreGroup DISTRIBUICAO_LUCROS)
- `ADMINISTRADOR` / `FAMILIAR` → Pró-labore (dreGroup PRO_LABORE)

Loader DB `detectPixForTransaction(companyId, description)` busca cadastros + roda detecção.

### Endpoints CRUD
- `GET/POST /api/empresas/[id]/socios-pf`
- `PATCH/DELETE /api/empresas/[id]/socios-pf/[socioId]`
- `GET/POST /api/empresas/[id]/empresas-relacionadas`
- `DELETE /api/empresas/[id]/empresas-relacionadas/[empresaRelId]`

Auth via getAuthContext + permissions `transaction.view/create/delete`. Validação Zod estrita (CPF 11 dígitos, CNPJ 14 dígitos, pixKeys array max 10 items).

### UI `/pessoas-vinculadas`
- Card explicativo no topo (Sparkles): explica detecção automática
- Card "Sócios e Familiares (PF)" + botão Adicionar
  - Form: Nome, CPF (11 dígitos), Papel (Sócio/Administrador/Familiar), Chaves Pix textarea
  - Lista visual com badges
- Card "Empresas Relacionadas (Mesmo Grupo)" + botão Adicionar
  - Form: CNPJ (14 dígitos), Nome fantasia, Relação, Chaves Pix textarea
  - Lista visual com badges
- Delete confirmado via confirm()

## Validação (41 tests novos)

- **27 parse-pix**: detecção keywords (PIX/TED/transferência), CPF formatado/puro, CNPJ formatado/puro, email lowercase, telefone DDD, textoLimpo, nameMatch (substring/case/acento/N palavras/empty), normalizePixKey
- **14 detect-pix-relacionado**: não-Pix retorna null, match SOCIO_PF por CPF (papel SOCIO=Distribuição, ADMIN/FAMILIAR=Pró-labore), match GRUPO_PJ por CNPJ (prioridade absoluta), match por email/telefone, match por nome fallback, sem match → PIX_NORMAL, prioridade CNPJ > nome em conflito

## Arquivos

### Novos (12)
- `app/api/empresas/[id]/select-and-redirect/route.ts` (fix bug)
- `app/api/empresas/[id]/socios-pf/route.ts`
- `app/api/empresas/[id]/socios-pf/[socioId]/route.ts`
- `app/api/empresas/[id]/empresas-relacionadas/route.ts`
- `app/api/empresas/[id]/empresas-relacionadas/[empresaRelId]/route.ts`
- `app/(dashboard)/bancos/page.tsx`
- `app/(dashboard)/pessoas-vinculadas/page.tsx`
- `app/(dashboard)/pessoas-vinculadas/pessoas-vinculadas-client.tsx`
- `lib/pix-detection/parse-pix.ts`
- `lib/pix-detection/detect-pix-relacionado.ts`
- `prisma/migrations/20260526000000_sprint_5_0_2h_pix_detection/`
- `__tests__/pix-parse.test.ts` + `__tests__/pix-detect-relacionado.test.ts`

### Modificados (12)
- `prisma/schema.prisma` (+SocioPF + EmpresaRelacionada + Transaction.relatedParty*)
- `components/sidebar/global-sidebar.tsx` (+3 items: Bancos, Pendentes, Pessoas Vinculadas)
- `lib/hooks/use-sidebar-badges.ts` (+transacoesPendentes)
- `app/api/dashboard/badges/route.ts` (+query transacoesPendentes)
- `app/(dashboard)/empresas/[id]/<8 pages>/page.tsx` (redirect via route handler novo)
- `docs/SPRINT-5.0.2.h-UX-BANKING-PIX.md`

## Smoke test pra Yussef

1. **Sidebar** — agora tem **Bancos**, **Pendentes** (com badge âmbar contador), **Pessoas Vinculadas**
2. **`/bancos`** — ver Sicredi, Banrisul, Stone do Cacula Mix em cards, botão "Importar OFX" direto
3. **`/pendentes`** — **NÃO dá mais erro** (bug `setCurrentEmpresaCookie` em SC corrigido via route handler)
4. **`/pessoas-vinculadas`** — adicionar:
   - Sócio: "Yussef Musa", CPF 12345678900, papel "Sócio", chave Pix email/tel
   - Empresa: CNPJ academia, nome "Academia Força Total", chaves Pix
5. **Próximo Pix detectado** vai retornar via `detectPixForTransaction`:
   - Pix com CPF Yussef → tipo SOCIO_PF, categoria "Distribuição de Lucros"
   - Pix com CNPJ academia → tipo GRUPO_PJ, categoria "Transferência entre Contas"

## Pendências pra próxima sprint

- **Integração no pipeline IA categorize** (chamar `detectPixForTransaction` antes de Claude) — escopo de Sprint 5.0.2.i
- **Conciliação automática transferências internas** (Empresa A saída + Empresa B entrada mesmo dia/valor) — escopo separado
- **Badge visual nas transações** com `relatedPartyType` — UI Pendentes precisa expor o campo

## Decisões técnicas

- **Cookie fix via route handler** — Next.js 15+ bloqueia `cookies().set()` em SC render. Solução padrão: route handler dedicado pra set + redirect.
- **pixKeys como TEXT JSON** — compat dual-DB (SQLite dev / Postgres prod). Postgres permite String[] mas o resto do schema usa esse padrão.
- **CPF formatado tem prioridade > 11 dígitos puros** — 11 dígitos é ambíguo com telefone. Pra parser ser conservador, CPF formatado sempre ganha; puro só se nada bater.
- **nameMatch flexível** — substring exato OU >=2 palavras significativas. Nome único (1 palavra) precisa match exato. Reduz falsos positivos.
- **relatedPartyId sem FK constraint** — flexibilidade pra detecção retroativa (Sprint pode renomear/deletar SocioPF sem cascade nas tx antigas).
