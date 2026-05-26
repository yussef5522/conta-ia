# Sprint 5.0.2.f — Engine de Cálculo Realista

**Status:** ✅ CONCLUÍDO em 25/05/2026
**Suite testes:** 2183 → **2233 (+50 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled

## Motivação — 2 erros graves reportados

❌ **ERRO 1 — Sistema recomendou Simples Nacional para empresa acima do teto**
Cacula Mix simulou receita R$ 450k/mês (= R$ 5,4M/ano). Sistema mostrou Simples como melhor regime com "economia R$ 734k/ano". **LC 123/2006 art. 3º, II** limita Simples a R$ 4,8M/ano. Cacula Mix excede em R$ 600k. **NÃO PODE entrar no Simples.**

❌ **ERRO 2 — Lucro Real ignorava créditos PIS/COFINS não-cumulativos**
Real cobrava PIS+COFINS brutos (9,25% sobre receita) sem deduzir créditos sobre compras (Lei 10.637/2002 + Lei 10.833/2003). Real ficava artificialmente caro → Simples parecia milagre mesmo inviável.

## Causa raiz do ERRO 1

`comparison-engine.ts` validava `rbaAcumulada + receitaBrutaMes > 4.8M`. Mas `rbaAcumulada` vem de `calculateRBA12m` que LÊ do banco. Em empresa de teste com poucas Transactions, RBA fica baixa → soma 450k + 0 = 450k < 4,8M → Simples vira "aplicável".

**Fix:** projeção `max(rbaHistorico, receitaBrutaMes × 12)`. Quando user simula "vou faturar X/mês", a projeção anual conservadora é mais honesta.

## Implementação

### `lib/tax/regime-validators.ts` (NOVO)

3 funções de validação que rodam **ANTES** do engine de cálculo:

```typescript
validateSimplesNacional({ rbaProjecada12m, cnaeCode, hasSocioPJ, hasDebitos }) → { aplicavel, motivoNaoAplicavel, baseLegal }
validateLucroPresumido({ rbaProjecada12m, cnaeCode }) → idem
validateLucroReal() → sempre aplicável
calcularRBAProjecada(rbaHistorico, receitaBrutaMes) → max(historico, mes × 12)
isCNAEVedadoSimples(cnae) → boolean
```

Regras cobertas:
- **Simples > R$ 4,8M** → `LC 123/2006 art. 3º, II`
- **CNAE vedado** (factoring, bancos, seguros) → `LC 123/2006 art. 17`
- **Sócio PJ** → `LC 123/2006 art. 3º §4º VII`
- **Débitos fiscais** → `LC 123/2006 art. 17 V`
- **Presumido > R$ 78M** → `Lei 9.718/1998 art. 13`
- **CNAE obrigado Real** (bancos, seguros) → `Lei 9.718/1998 art. 14`

### `lib/tax/presumido-margens.ts` (NOVO)

Wrapper fino que delega para `deriveActivityFromCNAE` + `findMargemPresuncao`:
```typescript
getPresumidoMargem(cnaeCode?) → { atividade, margemIRPJ, margemCSLL, source }
describePresumidoMargem(cnaeCode?) → "COMERCIO (IRPJ 8% · CSLL 12%)"
```
Não duplica tabelas — consolida o caminho CNAE → atividade → margem.

### `lib/tax/detect-compras.ts` (NOVO)

Detecta compras que geram crédito PIS/COFINS (Lei 10.637 + 10.833) nas Transactions últimos 12m. Heurística dupla:
- **dreGroup:** CUSTO_MERCADORIA / CUSTO_INSUMO / CUSTO_PRODUCAO / CUSTOS_OPERACIONAIS / DESPESAS_INSUMOS
- **Keywords:** fornecedor, material, insumo, embalagem, compra, mercadoria, estoque, alimentos, bebidas, carnes, hortifruti

Função pura `detectComprasFromTransactions(txs)` testável sem DB + loader DB `detectComprasUltimos12m(companyId)`.

### `lib/tax/real-engine.ts` — Refatorado

Aceita `comprasMes` opcional. Calcula créditos automaticamente:
```
creditoPIS = comprasMes × 1,65%
creditoCOFINS = comprasMes × 7,6%
PIS líquido = max(0, receita × 1,65% − creditoPIS)
COFINS líquido = max(0, receita × 7,6% − creditoCOFINS)
```

`creditosPIS` / `creditosCOFINS` em R$ continuam como override pra casos avançados (cliente sabe o crédito exato).

Warning automático quando `comprasMes = 0` e sem override: `"⚠️ Sem compras informadas — créditos PIS/COFINS não-cumulativos NÃO aplicados (Lei 10.637/02 + 10.833/03)"`.

### `lib/tax/comparison-engine.ts` — Refatorado

- Calcula `rbaProjecada = max(rbaAcumulada, receitaBrutaMes × 12)` ANTES de validar
- Roda `validateSimplesNacional` + `validateLucroPresumido` ANTES de calcular
- Quando inválido: retorna `aplicavel: false` + `motivoNaoAplicavel` + `baseLegal` (sem chamar engine)
- Recomendação considera APENAS regimes aplicáveis
- Repassa `comprasMes` pro Real (créditos automáticos)
- Aceita `cnaeCode` opcional pra validar CNAEs vedados

### `app/api/empresas/[id]/detectar-compras/route.ts` (NOVO)

GET endpoint que devolve compras detectadas. UI chama no mount pra auto-popular o campo.

### `lib/validations/tax-compare.ts`

Schema Zod expandido:
- `comprasMes` (opcional)
- `cnaeCode` (opcional)
- `hasSocioPJ` (opcional)
- `hasDebitos` (opcional)

### `components/tributario/comparativo-section.tsx` — UI atualizada

- **Campo novo:** `Compras mensais (R$)` com texto explicativo "Insumos/embalagens/mercadorias. Gera crédito PIS+COFINS 9,25% no Lucro Real."
- **Auto-detect:** botão "✨ Detectado nas suas transações: R$ X/mês (Y% da receita, Z fornecedores)" — clica e auto-preenche
- **Card "Não aplicável":** cinza com X icon + motivo + baseLegal (formato monoespaçado)
- `cnaeCode` enviado no submit pra validação backend

### `lib/tax/ai-analysis/data-aggregator.ts` — Aggregator IA

Adicionado campo `compras` em `CompanyTaxAnalysisData`:
```typescript
compras: {
  total12m, mensalMedia, percentSobreReceita, fornecedoresDetectados
}
```

### `lib/tax/ai-analysis/claude-analyzer.ts` — Prompt IA

Novo bloco no `buildAnalysisContext`:
```
### COMPRAS DETECTADAS (Sprint 5.0.2.f — geram créditos PIS/COFINS no Lucro Real)
Total 12m: R$ X
Mensal média: R$ Y
✅ Use **comprasMes: Y** ao chamar calculate_regime para LUCRO_REAL.
```

Tarefa 2 reescrita: "Para Lucro Real passe SEMPRE comprasMes. Se receita anual projetada > R$ 4,8M, Simples é NÃO APLICÁVEL (LC 123/06 art. 3º) — não recomende."

### `lib/tax/ai-analysis/tools.ts` — Tool calculate_regime

`comprasMes` adicionado no input_schema com descrição explícita orientando Claude a usar sempre que disponível.

### `lib/tax/expert-prompt.ts` — System prompt

Nova seção **"REGRAS CRÍTICAS (Sprint 5.0.2.f)"**:
1. NUNCA recomendar regime acima do limite legal
2. SEMPRE considerar créditos PIS/COFINS no Lucro Real
3. Quando "não aplicável", citar a lei

## Cenários validados nos testes (50 novos)

### `tax-regime-validators` (22 tests)
- Simples ≤ 4,8M aplicável, > 4,8M bloqueado citando art. 3º
- Cacula Mix 5,4M → mensagem contém "5,4M" e "4,8M"
- CNAEs vedados (bancário 6422, factoring 6491) com motivo + baseLegal
- Sócio PJ, débitos fiscais
- Ordem de validação: limite tem prioridade
- Presumido > 78M, CNAE obrigado Real
- `calcularRBAProjecada` pega max(histórico, mes × 12)

### `tax-creditos-pis-cofins` (9 tests)
- comprasMes=0 → sem créditos
- comprasMes 50k → PIS 825 / COFINS 3800
- **Cenário Cacula:** receita 450k + compras 180k → PIS líquido 4455 (de 7425 bruto) / COFINS líquido 20520 (de 34200 bruto)
- Compras > receita não deixa negativo
- Override manual em R$
- Warning quando sem compras
- Economia proporcional às compras

### `tax-comparison-bloqueio` (7 tests)
- **Cacula Mix 450k/mês simulado:** Simples NÃO aplicável + baseLegal LC 123/2006
- Recomendação NÃO é Simples quando inviável
- RBA projetada bloqueia mesmo com histórico baixo
- CNAE vedado + faturamento baixo → só Real aplicável
- comprasMes flui pro Real

### `tax-detect-compras` (12 tests)
- Keywords (Fornecedores, Material, Insumos, Embalagens, Bebidas)
- dreGroups (CUSTO_MERCADORIA, CUSTO_INSUMO)
- NÃO detecta aluguel/energia
- Top categorias ordenado com pct
- Fornecedores únicos via supplier OR description
- Ignora TRANSFER

## Arquivos

### Novos (5)
- `lib/tax/regime-validators.ts`
- `lib/tax/presumido-margens.ts`
- `lib/tax/detect-compras.ts`
- `app/api/empresas/[id]/detectar-compras/route.ts`
- 4 arquivos de teste + docs

### Modificados (8)
- `lib/tax/real-engine.ts` (créditos via comprasMes)
- `lib/tax/comparison-engine.ts` (validators + projeção + comprasMes)
- `lib/tax/ai-analysis/data-aggregator.ts` (campo compras)
- `lib/tax/ai-analysis/claude-analyzer.ts` (contexto compras + tarefa atualizada)
- `lib/tax/ai-analysis/tools.ts` (comprasMes em calculate_regime)
- `lib/tax/expert-prompt.ts` (regras críticas)
- `lib/validations/tax-compare.ts` (comprasMes + cnaeCode + flags)
- `app/api/empresas/[id]/tax-compare/route.ts` (repassa novos campos)
- `components/tributario/comparativo-section.tsx` (UI compras + auto-detect + cards não-aplicável)
- 2 tests atualizados (campo `compras` em fixtures)

## Smoke test pra Yussef (Cacula Mix)

1. `/tributario?tab=analise` → "Comparativo de Regimes"
   - Receita R$ 450.000 + margem 15% → Calcular
   - **Esperado:**
     - Simples em CINZA com "Não aplicável — Receita anual projetada R$ 5,4M excede o limite Simples Nacional R$ 4,8M · Base legal: LC 123/2006 art. 3º, II"
     - Presumido aplicável (5,4M < 78M)
     - Real aplicável
     - **Recomendação NÃO é Simples** (impossível)
2. Mesmo Comparativo: bater campo "Compras mensais"
   - Auto-detect mostra "✨ Detectado nas suas transações: R$ X/mês"
   - Após preencher R$ 180.000 + Calcular → Real vem mais barato (créditos R$ 16.650/mês PIS+COFINS)
3. Análise IA → "Analisar agora"
   - Recomendação NÃO inclui Simples se receita > R$ 4,8M
   - Cita Lei 10.637/02 + 10.833/03 ao explicar créditos
   - calculate_regime do Real recebe comprasMes

## Próximo

**Sprint 5.0.3** — IA Agent conversacional.
**Sprint 5.0.4** — Reforma Tributária IBS/CBS UI dedicada.
**Sprint 5.0.5** — Folha de pagamento + apuração trimestral.
