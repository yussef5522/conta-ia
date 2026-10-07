/**
 * ⭐⭐⭐ A MARGEM DE CONTRIBUIÇÃO — E A HONESTIDADE DO "A APURAR" (06/10/2026).
 *
 * **Ordem do dono:** *"PONTO DE EQUILÍBRIO: custo fixo diário ÷ margem de contribuição média
 * dos últimos 30d (receita − CMV pelas portas que o fluxo/Real×Teórico já têm — **NUNCA conta
 * paralela**; margem indisponível com confiança = cartão «a apurar» honesto, nunca número
 * inventado)."*
 *
 * ⛔⛔ **A PORTA É O `whereFluxoCaixa`, e isso não é detalhe.** Todas as regras de honestidade
 * do dinheiro vivo moram lá — transferência entre contas próprias fora, conta a pagar em aberto
 * não é caixa, conciliada não conta 2×, compra no cartão fora e pagamento de fatura dentro.
 * Uma consulta própria aqui seria a **conta paralela** que a ordem proíbe, e ela divergiria do
 * ENTROU/SAIU que o dono vê na tela de Fluxo de Caixa no primeiro caso de borda.
 *
 * ⚠️⚠️ **E A RESSALVA É PARTE DO NÚMERO, não um rodapé decorativo: este CMV é por COMPRA.** O
 * CMV por CONSUMO (competência) é a FASE 4 do estoque e **não existe**. Então o percentual
 * oscila com o mês em que a nota entrou — medido em prod: 54,5% (jul) · 58,1% (ago) · 49,2%
 * (set). A tela DIZ isso. Esconder a ressalva faria o dono tomar decisão de preço sobre um
 * número que ele não tem como defender.
 *
 * ⚠️ **E O QUE FICA DE FORA, fica NOMEADO:** custo variável que o dono não classificou como
 * CMV (medido: `ENTREGADOR DELIVERY`, R$ 21.893,10 em setembro, em `OUTRAS_DESPESAS`) **não
 * entra na conta** — escolher por conta própria quais despesas são "variáveis" seria inventar
 * a régua do dono. Quem decide o que é CMV é o `dreGroup` que ele já definiu.
 */
import { prisma } from '@/lib/db'
import { whereFluxoCaixa } from '@/lib/fluxo-caixa/motor'
// ⚠️ UM formatador de moeda no projeto (ordem do dono: `formatBRL` em toda moeda). As frases
// desta lib (`conta`, `porque`) vão PRONTAS pra tela, então elas também passam por ele.
import { formatBRL } from '@/lib/format/money'

/** ⭐ a janela da ordem do dono */
export const JANELA_DA_MARGEM_DIAS = 30

/**
 * ⚠️ sem dado suficiente a margem não é "zero", é DESCONHECIDA. Vinte dias de receita na janela
 * de 30 é o piso — abaixo disso um feriadão ou um import atrasado viraria "a casa não vende".
 */
export const DIAS_MINIMOS_DA_JANELA = 20

export interface MargemMedida {
  /** 0,54 = 54%. `null` = a apurar, e `porque` DIZ o motivo */
  pct: number | null
  porque: string | null
  receita: number
  cmv: number
  diasComReceita: number
  diasDaJanela: number
  de: Date
  ate: Date
  /** ⭐ a conta ESCRITA, pra tela nunca mostrar percentual sem régua */
  conta: string
  ressalva: string
}

export interface EntradaDaMargem {
  receita: number
  cmv: number
  diasComReceita: number
  diasDaJanela: number
  de: Date
  ate: Date
}

const RESSALVA =
  'CMV por COMPRA (a nota que entrou na janela), não por consumo — o CMV por competência é a próxima fase do estoque'

/** ⭐ função PURA: o veredito da margem. Testável sem banco. */
export function avaliarMargem(e: EntradaDaMargem): MargemMedida {
  const base = {
    receita: e.receita,
    cmv: e.cmv,
    diasComReceita: e.diasComReceita,
    diasDaJanela: e.diasDaJanela,
    de: e.de,
    ate: e.ate,
    ressalva: RESSALVA,
  }

  if (e.receita <= 0) {
    return { ...base, pct: null, porque: 'não há receita registrada nesta janela', conta: '—' }
  }
  if (e.cmv <= 0) {
    return {
      ...base,
      pct: null,
      porque: 'não há custo de mercadoria (CMV) categorizado nesta janela — sem ele a margem sairia 100%',
      conta: '—',
    }
  }
  if (e.diasComReceita < DIAS_MINIMOS_DA_JANELA) {
    return {
      ...base,
      pct: null,
      porque: `só ${e.diasComReceita} dos ${e.diasDaJanela} dias da janela têm receita — pouco dado pra uma média`,
      conta: '—',
    }
  }

  const pct = (e.receita - e.cmv) / e.receita
  const conta = `(receita ${formatBRL(e.receita)} − CMV ${formatBRL(e.cmv)}) ÷ receita = ${(pct * 100).toFixed(1)}%`

  /**
   * ⛔ Margem ZERO ou NEGATIVA não vira ponto de equilíbrio: a divisão explodiria (ou daria
   * número negativo com cara de meta). Vendendo abaixo do custo **não existe** quanto vender
   * pra pagar a casa — e dizer isso é mais útil que mostrar um ∞ disfarçado.
   */
  if (pct <= 0) {
    return {
      ...base,
      pct,
      porque: 'o CMV da janela ficou igual ou acima da receita — não dá pra calcular quanto vender pra pagar a casa',
      conta,
    }
  }

  return { ...base, pct, porque: null, conta }
}


/**
 * ⭐ MEDE a margem no banco, pelas portas existentes.
 *
 * ⚠️ A janela termina no FIM do mês olhado (ou agora, se o mês for o corrente) — assim navegar
 * pra trás mostra a margem DAQUELE período, e não a de hoje aplicada ao passado. Uma régua só,
 * que serve os dois casos.
 */
export async function medirMargem(
  companyId: string,
  fimDaJanela: Date,
  db: typeof prisma = prisma,
): Promise<MargemMedida> {
  const ate = fimDaJanela
  const de = new Date(ate.getTime() - JANELA_DA_MARGEM_DIAS * 86_400_000)
  const periodo = { de, ate }

  const [receitaAgg, cmvAgg, diasTx] = await Promise.all([
    db.transaction.aggregate({
      _sum: { amount: true },
      where: { ...whereFluxoCaixa(companyId, periodo), type: 'CREDIT', category: { dreGroup: 'RECEITA_BRUTA' } },
    }),
    db.transaction.aggregate({
      _sum: { amount: true },
      where: { ...whereFluxoCaixa(companyId, periodo), type: 'DEBIT', category: { dreGroup: 'CUSTO_PRODUTO_VENDIDO' } },
    }),
    db.transaction.findMany({
      where: { ...whereFluxoCaixa(companyId, periodo), type: 'CREDIT', category: { dreGroup: 'RECEITA_BRUTA' } },
      select: { date: true },
    }),
  ])

  const diasComReceita = new Set(diasTx.map((t) => t.date.toISOString().slice(0, 10))).size

  return avaliarMargem({
    receita: receitaAgg._sum.amount ?? 0,
    cmv: cmvAgg._sum.amount ?? 0,
    diasComReceita,
    diasDaJanela: JANELA_DA_MARGEM_DIAS,
    de,
    ate,
  })
}

/**
 * ⭐⭐ O PONTO DE EQUILÍBRIO MUDOU DE CASA (07/10) — a fórmula vive em `prateleira.ts`.
 *
 * ⛔⛔ **REEXPORTE, NUNCA 2ª CÓPIA.** A TELA precisa da fórmula pra recalcular os cartões no
 * toggle dos chips, e este arquivo importa `prisma` no topo — importá-lo num componente
 * `'use client'` arrastaria o Prisma pro bundle do navegador. Então a conta mudou pra um
 * arquivo PURO e aqui ficou o endereço antigo: os importadores de sempre continuam
 * funcionando, e **existe uma fórmula só**.
 */
export { pontoDeEquilibrio, type PontoDeEquilibrio } from './prateleira'
