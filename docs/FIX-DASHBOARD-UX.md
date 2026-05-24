# Fix UX Dashboard — Cards Consistentes (Opção A + C)

**Data:** 23/05/2026
**Tipo:** Fix UX (zero mudança matemática)
**Branch:** main

---

## Problema

Yussef notou que **Receita − Despesas dos cards do Dashboard NÃO batia com Resultado mostrado**:

| Card | Valor |
|---|---|
| Receita do Mês | R$ 277.099,90 |
| Despesas do Mês | R$ 229.115,52 |
| Resultado | R$ 1.772,56 |
| Subtração visual | **R$ 47.984,38** ≠ R$ 1.772,56 |

### Diagnóstico

Math estava CORRETO. Bug era de **escopo inconsistente entre cards**:

- "Receita do Mês" = `receitaBruta` (sem subtrair deduções)
- "Despesas do Mês" = `totalCustos + totalDespesasOperacionais` (CMV + pessoal + comerciais + admin + outras) — **NÃO inclui Despesas Financeiras (R$ 45.650,31!)**
- "Resultado" = `lucroLiquido` (subtrai TUDO: deduções + custos + operacionais + financeiras + impostos sobre lucro)

Gap residual: R$ 47.984,38 − R$ 1.772,56 = **R$ 46.211,82** = R$ 45.650,31 (financeiras) + R$ 561,51 (deduções).

Para Cacula Mix em 05/2026, R$ 45k de despesas financeiras (juros, IOF) sumiam visualmente entre os cards, e o usuário não conseguia conciliar mentalmente.

---

## Solução aplicada — Opção A + C

### A) "Resultado" passa a mostrar **Resultado Operacional**

```diff
- resultadoMes = dre.totals.lucroLiquido           // 1.772,56
+ resultadoMes = dre.totals.resultadoOperacional   // 47.422,87
```

Resultado Operacional = Receita Bruta − Deduções − CMV − Despesas Operacionais

Agora a subtração visual fecha: 277k − 229k ≈ 47k (gap residual de R$ 561 = deduções, aceitável).

**Lucro Líquido continua visível no Mini-DRE** (linha highlighted) — ninguém perde a informação.

### C) Labels mais precisos + tooltips com Info icon

| Antes | Depois |
|---|---|
| Saldo atual | Saldo atual |
| Receita do mês | **Receita bruta** |
| Despesas do mês | **Despesas operacionais** |
| Resultado | **Resultado operacional** |

Cada card ganha um pequeno ícone `Info` ao lado do label com tooltip nativo do browser (atributo `title` — sem nova dependência).

**Tooltips:**
- **Saldo atual:** "Soma do saldo de todas as contas bancárias da empresa, atualizado em tempo real."
- **Receita bruta:** "Total de vendas no mês, antes de deduções (devoluções, impostos sobre vendas)."
- **Despesas operacionais:** "CMV + Pessoal + Comerciais + Administrativas. NÃO inclui Despesas Financeiras (juros, IOF), que aparecem separadamente no Lucro Líquido do DRE."
- **Resultado operacional:** "Receita Bruta − Deduções − CMV − Despesas Operacionais. Saúde do negócio ANTES de juros e impostos sobre lucro. O Lucro Líquido completo aparece no DRE."

### Footnote "Margem"

Antes: "Margem 31%" (implicava margem líquida).
Depois: "Margem operacional 31%" (alinhado com o novo valor exibido).

---

## Lucro Líquido — onde fica visível?

Já estava no **Mini-DRE** do Dashboard (linha highlighted). Não precisou criar card adicional — a estrutura DRE compacta já mostra a sequência completa:

```
Receita Bruta:           R$ 277.099,90
(-) Deduções:            R$    561,51
Lucro Bruto:             R$ 122.371,31
Resultado Operacional:   R$  47.422,87
Lucro Líquido:           R$   1.772,56  ← highlighted
```

---

## Arquivos modificados

- `lib/dashboard/compute-kpis.ts` — `resultadoMes` agora usa `resultadoOperacional`
- `app/(dashboard)/dashboard/_components/HeroKPIs.tsx` — labels novos + tooltips
- `app/(dashboard)/dashboard/_components/KPICard.tsx` — suporte a prop `tooltip?: string` (ícone Info com title nativo, acessível por padrão)
- `__tests__/dashboard-compute-kpis.test.ts` — comentário + nome do teste atualizados (assertion `7_000` continua válida — sem financeiras/impostos, `resultadoOperacional == lucroLiquido`)

## NÃO modificado

- DRE Gerencial (`/empresas/[id]/dre`) — continua mostrando estrutura completa
- Mini-DRE — já tinha Lucro Líquido highlighted no fim
- Engine de cálculo (`lib/dre/calculator.ts`) — zero mudança matemática
- Outros componentes (Top Categories, Health Check, Recent Activity, Waterfall)

---

## Validação

- **1667/1667 testes passando** (sem regressões)
- TypeScript strict: 0 erros
- Build: ✓ Compiled successfully

### Cenário Cacula Mix 05/2026 (validado contra SQL real)

```
Receita Bruta:           R$ 277.099,90
Despesas Operacionais:   R$ 229.115,52
Resultado Operacional:   R$  47.422,87  ← agora bate com a subtração visual
                                          (gap residual R$ 561,51 = deduções)

(Lucro Líquido R$ 1.772,56 ainda visível no Mini-DRE)
```

---

## Pós-deploy

1. Cmd+Shift+R no Safari pra forçar refresh (cache de assets)
2. Hover no ícone Info ao lado de cada label pra ver tooltip
3. Conferir Mini-DRE pra ver Lucro Líquido completo
