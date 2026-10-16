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
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⭐⭐⭐ A LEI DO "VENDEU" — PALAVRA DO DONO (16/10/2026), E ELA REVERTE A DECISÃO DE 10/10
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * > *"relatorio de produtos ja vem total que foi vendido. a gente baixa relatorio
 * > complementos SO pra pegar os sabores de pizza e cocas que sairam. valor de venda mesmo
 * > so vem de 1 relatorio: produtos."*
 *
 * **VENDEU = Σ do relatório de PRODUTOS, e SÓ.** O complemento continua sendo importado e
 * continua valendo — mas como **QUANTIDADE** (que sabor saiu, que bebida saiu), pra baixa de
 * estoque, ficha, mix e cobertura. **O `valorTotal` dele NUNCA soma na venda.**
 *
 * ⛔⛔ **O QUE ESTE ARQUIVO AFIRMAVA ATÉ 11/10 ESTAVA ERRADO, e o número prova:** ele dizia
 * *"o cliente paga os dois na mesma nota"* e somava. O estudo de 16/10 mostrou que o
 * adicional/borda **JÁ ENTRA no `valorTotal` da linha de PRODUTOS** (é por isso que o preço
 * praticado de uma pizza grande sai ~17% acima da tabela) — então somar o complemento por
 * cima é **contar o mesmo dinheiro DUAS VEZES**. Medido em prod, outubro:
 *
 * ```
 * Σ produtos ...... R$ 292.099,08   ⭐ VENDEU
 * Σ complementos .. R$  20.803,39   ⛔ era somado em cima — dupla contagem
 * Σ "total" velho .. R$ 312.902,47
 * o caso de 06/10: 15.873,77 + 1.228,86 = 17.102,63 (velho) → 15.873,77 (certo)
 * ```
 *
 * ⚠️ **E O CAMPO MUDOU DE NOME DE PROPÓSITO (`total` → `vendeu`).** `total` prometia *"a soma
 * de tudo"*; chamar de `total` um número que é só produtos seria exatamente o rótulo que
 * mente que esta casa persegue desde 13/09 (*"nenhum rótulo promete mais do que entrega"*).
 * ⭐ E o rename é o que faz a REGRA 4 sair de graça: **o `tsc` acha TODOS os leitores** em vez
 * de eu confiar num grep — foi assim que `temVinculoDeGesto` achou os 4 chamadores em 27/09.
 *
 * ⚠️ `complementos` **continua viajando no payload**, e não é sobra: a central mostra o Σ dele
 * como **conferência do import** (*"o arquivo de sabores entrou?"*), com o rótulo dizendo que
 * ele **não soma**. O relatório de complementos **não declara total** (`somaValor` é `null`
 * ali, porque 34% das linhas valem R$ 0,00 — sabor incluso no preço); quem confere complemento
 * é a CONTAGEM de ocorrências, nunca o dinheiro.
 */
import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/** ⭐ o que o PDV registrou num dia — `null` em campo nenhum: dia sem import não entra no mapa */
export interface TotalDoPdvNoDia {
  /** `YYYY-MM-DD` */
  dia: string
  /** Σ `valorTotal` das linhas de PRODUTOS */
  produtos: number
  /**
   * Σ `valorTotal` das linhas de COMPLEMENTOS (sabor, adicional).
   *
   * ⛔⛔ **NÃO É VENDA — não soma em `vendeu`, não entra em projeção, não entra em DRE.** É
   * conferência de import: *"o arquivo de sabores do dia entrou?"*. A lei de 16/10 está no
   * topo deste arquivo.
   */
  complementos: number
  /**
   * ⭐⭐ **O QUE VENDEU NO DIA = Σ do relatório de PRODUTOS, e só** (lei do dono, 16/10).
   * É o número LISO que a tela de Vendas, a central, o calendário, o placar e os estudos
   * mostram — e é a MESMA pergunta nos cinco, porque todos leem este campo.
   */
  vendeu: number
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
      a = { dia, produtos: 0, complementos: 0, vendeu: 0, unidades: 0 }
      mapa.set(dia, a)
    }
    return a
  }

  for (const r of prod) garante(diaDe(r.data)).produtos = round2(r._sum.valorTotal ?? 0)
  for (const r of comp) garante(diaDe(r.data)).complementos = round2(r._sum.valorTotal ?? 0)
  for (const i of imports) garante(diaDe(i.data)).unidades = i.totalUnidades

  /**
   * ⭐⭐ A LEI, numa linha: **vendeu == produtos**. O complemento fica ao lado, nomeado, e
   * nunca entra na soma (ver o cabeçalho deste arquivo — a palavra do dono de 16/10).
   *
   * ⛔ `vendeu` NÃO é derivado na tela: ele sai daqui. Se cada consumidor somasse por conta
   * própria, a definição de "vendeu" voltaria a existir em 6 lugares — e o dia em que um
   * deles ficasse pra trás, duas telas mostrariam números diferentes pro MESMO dia, que é
   * a doença que esta casa mais paga.
   */
  for (const a of mapa.values()) a.vendeu = a.produtos
  return mapa
}
