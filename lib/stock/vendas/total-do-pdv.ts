/**
 * ⭐⭐⭐ O TOTAL VENDIDO POR DIA, PELO PDV — a fonte LISA da tela de Vendas (10/10/2026).
 *
 * **Ordem do dono:** *"Venda importada do PDV (dia a dia, da central de importação) = número
 * LISO, sem ~. Extrato vira só fallback pro dia sem import, com ~ e a explicação no ⓘ."*
 *
 * ⛔⛔ **POR QUE ESTA FUNÇÃO MORA NO MÓDULO DE ESTOQUE, e não em `lib/vendas/`:** quem conhece
 * o schema de `stock_venda_linha`/`stock_venda_complemento_linha` é ELE. É o mesmo desenho do
 * `nota-de-origem.ts` (30/08): *"a função mora no módulo de ESTOQUE — quem conhece
 * `stock_payable_link` é ele; a rota do financeiro recebe o dado pronto e não aprende o
 * esquema do estoque"*. Se `lib/vendas/` fizesse o `groupBy` direto, qualquer mudança nas
 * tabelas do estoque quebraria uma tela de outro módulo em silêncio.
 *
 * ⚠️ **É LEITURA PURA** — nenhuma escrita, nenhum gatilho. O isolamento do módulo segue
 * intacto: só o que o estoque já grava é lido de volta.
 *
 * ⭐⭐ POR QUE PRODUTOS **+** COMPLEMENTOS: o cliente paga os dois na mesma nota. Medido em
 * prod (outubro): o complemento é **R$ 831 a R$ 2.277 por dia** — somar só produtos
 * subestimaria a venda do dia em ~7%, e é justamente o número que a projeção do mês usa.
 * ⚠️ O relatório de complementos **não declara total** (`stock_venda_arquivo.somaValor` é
 * `null` ali, porque 34% das linhas valem R$ 0,00 — sabor incluso no preço), mas as LINHAS
 * dele têm `valorTotal` gravado: é dele que o número sai.
 */
import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/** ⭐ o que o PDV registrou num dia — `null` em campo nenhum: dia sem import não entra no mapa */
export interface TotalDoPdvNoDia {
  /** `YYYY-MM-DD` */
  dia: string
  /** Σ `valorTotal` das linhas de PRODUTOS */
  produtos: number
  /** Σ `valorTotal` das linhas de COMPLEMENTOS (sabor, adicional) */
  complementos: number
  /** produtos + complementos — **o número que a tela mostra LISO** */
  total: number
  /** unidades de produto vendidas (o `totalUnidades` do import) */
  unidades: number
}

const round2 = (n: number) => Math.round(n * 100) / 100
const diaDe = (d: Date) => d.toISOString().slice(0, 10)

/**
 * ⭐ Os totais do PDV de uma janela, indexados por dia.
 *
 * ⚠️⚠️ A LEITURA É POR **FAIXA** DO DIA, nunca por instante exato — e isso é cicatriz medida:
 * `stock_venda_complemento_linha` grava **00:00:00Z** e `stock_venda_linha` grava **15:00:00Z**
 * (porque `new Date('…T12:00:00')` **sem Z** num processo em `America/Sao_Paulo` vira 15h UTC).
 * Comparar o instante acerta um writer e erra o outro — foi o que fez a revisão do import
 * devolver *"0 nomes"* num dia com 130 linhas (14/09).
 *
 * @param ate  EXCLUSIVO (`< ate`) — usar o último dia às 23:59:59 perde o que cair no último
 *             segundo, e é a borda que ninguém vê até acontecer
 */
export async function totaisDoPdvPorDia(
  companyId: string,
  de: Date,
  ate: Date,
  db: Db,
): Promise<Map<string, TotalDoPdvNoDia>> {
  const faixa = { gte: de, lt: ate }

  const [prod, comp, imports] = await Promise.all([
    db.stockVendaLinha.groupBy({
      by: ['data'],
      where: { companyId, data: faixa },
      _sum: { valorTotal: true },
    }),
    db.stockVendaComplementoLinha.groupBy({
      by: ['data'],
      where: { companyId, data: faixa },
      _sum: { valorTotal: true },
    }),
    /**
     * ⛔ O import ESTORNADO não conta: ele é o registro de um dia que foi desfeito, e somá-lo
     * mostraria venda que o próprio sistema já tirou do estoque.
     */
    db.stockVendaImport.findMany({
      where: { companyId, data: faixa, status: 'CONFIRMADO' },
      select: { data: true, totalUnidades: true },
    }),
  ])

  const mapa = new Map<string, TotalDoPdvNoDia>()
  const garante = (dia: string) => {
    let a = mapa.get(dia)
    if (!a) {
      a = { dia, produtos: 0, complementos: 0, total: 0, unidades: 0 }
      mapa.set(dia, a)
    }
    return a
  }

  for (const r of prod) garante(diaDe(r.data)).produtos = round2(r._sum.valorTotal ?? 0)
  for (const r of comp) garante(diaDe(r.data)).complementos = round2(r._sum.valorTotal ?? 0)
  for (const i of imports) garante(diaDe(i.data)).unidades = i.totalUnidades

  for (const a of mapa.values()) a.total = round2(a.produtos + a.complementos)
  return mapa
}
