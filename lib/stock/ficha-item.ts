// ESTOQUE FASE 1 — FICHA do produto. Só LÊ o ledger (stock_movement) + o item.
//
// ⛔⛔ **ELA NUNCA FOI "HISTÓRICO DE COMPRAS" (corrigido 08/09/2026).** O comentário original
// dizia *"preparada pra crescer (consumo/contagem/produção nas próximas fases leem os mesmos
// movimentos)"* — e as fases chegaram, os movimentos entraram, **e o rótulo ficou**. O
// `findMany` nunca teve filtro de tipo: o ledger inteiro caía num campo chamado `compras`,
// com interface `CompraLinha`. Medido no BACON: **16 de 19 linhas não eram compra e 14 eram
// negativas**, exibidas sob a coluna "Preço un.".
//
// ⭐ Agora é o que sempre foi: o **HISTÓRICO DO ITEM**. Quem diz o que cada linha é, quem fez
// e de onde veio é `movimento-explicado.ts` — o MESMO dono que o extrato usa (REGRA 4).

import type { PrismaClient, Prisma } from '@prisma/client'
import { selosDeEncerrado, fraseDoSelo } from './itens/encerrar-item'
import { prisma as defaultPrisma } from '@/lib/db'
import { saldoItem } from './saldo'
import { statusEstoque, type StatusEstoqueResult } from './status-estoque'
import { explicarMovimentos, tiposPresentes, dobrarProducao, colapsarAnulados, anotarSaldo, somaDasLinhas, type LinhaDoHistorico } from './movimento-explicado'
import { pilulaDoItem, type PilulaDoItem } from './item/pilula-do-item'
import { consumoDoItem, coberturaDoItem, prazoDeReposicao, minimoSugerido, type ConsumoDoItem, type CoberturaDoItem, type MinimoSugerido } from './item/consumo-e-cobertura'
import { usadoEmFichas, type UsadoEmFichas } from './item/usado-em-fichas'

type Db = PrismaClient | Prisma.TransactionClient

const CAT_LABEL: Record<string, string> = { MATERIA_PRIMA: 'Matéria-prima', REVENDA: 'Revenda', EMBALAGEM: 'Embalagem', LIMPEZA: 'Limpeza', USO_INTERNO: 'Uso interno', INTERMEDIARIO: 'Intermediário', PRODUTO_FINAL: 'Produto final' }

// nNF vem embutido na chave (posições 25..33, 9 dígitos).
const nNFdaChave = (chave: string | null) => (chave && chave.length === 44 ? String(Number(chave.slice(25, 34))) : null)

export interface FichaItem {
  item: { id: string; nome: string; unidadeControle: string; categoria: string; categoriaLabel: string; ativo: boolean; estoqueMin: number | null; estoqueMax: number | null }
  /** ⭐ "item encerrado em DD/MM — motivo" (19/09). null = não foi encerrado. */
  encerrado: string | null
  saldo: number
  custoMedio: number | null
  valor: number
  status: StatusEstoqueResult
  /** ⭐ TUDO que aconteceu com este item — entradas E saídas, cada linha com tipo/quem/origem */
  historico: LinhaDoHistorico[]
  /** os tipos que existem NESTE item — o filtro não oferece opção vazia */
  tipos: { tipo: string; chip: string; n: number }[]
  /**
   * ⭐⭐ A CONFERÊNCIA DA PRÓPRIA TABELA (09/09/2026): a soma da coluna TOTAL das linhas
   * exibidas **é** o saldo. Vai no payload pra a tela poder DIZER isso ao dono — e pra o
   * teste travar a igualdade contra o `saldo.ts`, não contra outra soma minha.
   *
   * ⛔ `confere: false` é bug de tabela, não detalhe visual: significa que a tela está
   * somando algo que o saldo não conta (ou deixando de somar algo que conta).
   */
  conferencia: { somaQuantidade: number; saldo: number; somaValor: number; valor: number; confere: boolean }
  /** ⭐ quantos pares foram colapsados — o toggle "mostrar tudo (forense)" só aparece se > 0 */
  anulados: number
  precoTempo: { data: string; preco: number }[] // só ENTRADA_NF (pra o gráfico)
  /**
   * ⭐⭐ A PÍLULA DE ESTADO (06/10) — decidida no SERVIDOR, pela régua única.
   * ⛔ Se a tela derivasse, seriam duas respostas pra *"em que estado este item está?"*, e
   * elas divergiriam do `statusEstoque` que a Posição desenha no primeiro ajuste.
   */
  pilula: PilulaDoItem
  /** dias desde o último movimento; `null` = o item nunca se moveu */
  diasSemMovimento: number | null
  /** ⭐ o giro e a cobertura — "dá pra ~N dias" */
  consumo: ConsumoDoItem
  cobertura: CoberturaDoItem
  /** ⭐ a sugestão de mínimo: SUGERE, nunca grava (o campo é do dono) */
  sugestaoMinimo: MinimoSugerido
  /** ⭐⭐ a BUSCA REVERSA: toda ficha ativa que usa este item, com a dose e o alerta */
  usoEmFichas: UsadoEmFichas
  /** ⭐ o rastro da última troca de categoria (quem/quando) — a tabela guardava e ninguém mostrava */
  categoriaRastro: { de: string; para: string; quando: string; quem: string | null } | null
}

export async function buildFichaItem(companyId: string, itemId: string, db: Db = defaultPrisma, opts: { forense?: boolean; agora?: Date } = {}): Promise<FichaItem | null> {
  const item = await db.stockItem.findFirst({ where: { id: itemId, companyId }, select: { id: true, nome: true, unidadeControle: true, categoria: true, ativo: true, estoqueMin: true, estoqueMax: true } })
  if (!item) return null

  const [saldo, movimentos] = await Promise.all([
    saldoItem(db, companyId, itemId),
    db.stockMovement.findMany({
      where: { companyId, itemId },
      orderBy: { dataMovimento: 'desc' },
      select: {
        id: true, itemId: true, tipo: true, quantidade: true, custoUnitario: true, custoTotal: true,
        nfeChave: true, receiptId: true, estornoDeId: true, dataMovimento: true,
        criadoPorId: true, origem: true,
      },
    }),
  ])

  // ⛔⛔ A REGRA DO HISTÓRICO HONESTO: o consumo de produção **não move a prateleira** (o
  // insumo já saiu na separação) e por isso não pode ficar na tabela como uma segunda saída
  // do mesmo tamanho — era o que fazia o dono ver baixa dupla onde o saldo estava certo.
  const completo = dobrarProducao(await explicarMovimentos(companyId, movimentos, db))
  // ⭐⭐ MODO CLEAN por padrão (11/09): par movimento+estorno que se anula vira UMA linha fina.
  // ⛔ O forense devolve a lista crua — o rastro é o que provou o desastre de 10/09.
  const limpo = colapsarAnulados(completo)
  // ⭐ a COLUNA SALDO desce do saldo de HOJE: a 1ª linha vale o número da Posição, e daí pra
  // baixo cada linha devolve o próprio efeito. Aqui a lista é SEMPRE o item inteiro até hoje
  // (a query não filtra nem limita), então dá pra afirmar o saldo de cada instante.
  const historico = anotarSaldo(opts.forense ? completo : limpo, new Map([[itemId, saldo.saldo]]))
  const anulados = historico.filter((l) => l.anulado).length
  const soma = somaDasLinhas(historico)

  /**
   * ⛔⛔ O GRÁFICO DE PREÇO PASSA PELA MESMA RÉGUA DO HISTÓRICO (11/09) — e isto era um
   * defeito real: ele lia `ENTRADA_NF` do CRU, então **uma compra 100% estornada entrava na
   * curva de preço** como se alguém tivesse pago aquilo.
   *
   * ⭐ A fonte é a lista JÁ COLAPSADA — não um filtro local a mais. Compra desfeita não é
   * preço pago, exatamente como ela saiu da aba "só compras".
   * ⚠️ E usa sempre `limpo`, nunca o forense: o gráfico responde "que preços eu paguei?",
   * pergunta que não muda quando o dono liga o modo de auditoria.
   */
  const precoTempo = limpo
    .filter((l) => l.tipo === 'ENTRADA_NF')
    .map((l) => ({ data: l.data.slice(0, 10), preco: l.custoUnitario }))
    .sort((a, b) => a.data.localeCompare(b.data))

  // ⭐ o selo do encerrado — a ficha é onde o histórico dele é consultado
  const selo = (await selosDeEncerrado(companyId, [itemId], db)).get(itemId)

  /**
   * ⭐⭐ AS LEITURAS NOVAS DO v4 (06/10) — todas sobre a lista JÁ EXPLICADA, nunca sobre o cru.
   *
   * ⛔ `limpo` e não `completo`: par 100% anulado não é consumo (ele não aconteceu), e usar o
   * cru faria uma compra desfeita entrar no prazo de reposição — o mesmo defeito que o gráfico
   * de preço tinha em 11/09.
   * ⛔ E só o que MOVE A PRATELEIRA: é a régua do `saldo.ts`, a mesma do rodapé e da coluna
   * SALDO. O `PRODUCAO_CONSUMO` cai por aqui sem precisar de uma 2ª lista de exclusão.
   */
  const agora = opts.agora ?? new Date()
  const paraConsumo = limpo
    .filter((l) => l.movePrateleira)
    .map((l) => ({ tipo: l.tipo, data: l.data, quantidade: l.quantidade, estornoDeTipo: l.estornoDe?.tipo ?? null }))
  const consumo = consumoDoItem(paraConsumo, agora)
  const prazo = prazoDeReposicao(paraConsumo)
  /**
   * ⚠️ "parado" conta do ÚLTIMO movimento que mexeu na prateleira — e a lista é desc, então é
   * a 1ª. ⛔ Movimento que não move o saldo (consumo de produção) não "desparalisa" o item:
   * dizer que ele girou seria contar transferência interna como vida.
   */
  const ultimoMov = limpo.find((l) => l.movePrateleira)?.data ?? null
  const diasSemMovimento = ultimoMov
    ? Math.floor((Date.parse(agora.toISOString().slice(0, 10)) - Date.parse(ultimoMov.slice(0, 10))) / 86_400_000)
    : null

  /** ⭐ o rastro da troca de categoria — mais recente primeiro */
  const troca = await db.stockItemCategoriaTrocada.findFirst({
    where: { companyId, itemId },
    orderBy: { criadoEm: 'desc' },
    select: { de: true, para: true, criadoEm: true, trocadoPorId: true },
  })
  const quemTrocou = troca?.trocadoPorId
    ? (await db.user.findUnique({ where: { id: troca.trocadoPorId }, select: { name: true } }))?.name ?? null
    : null

  return {
    encerrado: selo ? fraseDoSelo(selo) : null,
    item: { ...item, categoriaLabel: CAT_LABEL[item.categoria] ?? item.categoria },
    saldo: saldo.saldo,
    custoMedio: saldo.custoMedio,
    valor: saldo.valor,
    status: statusEstoque(saldo.saldo, item.estoqueMin, item.estoqueMax),
    historico,
    tipos: tiposPresentes(historico),
    anulados,
    conferencia: {
      somaQuantidade: soma.quantidade, saldo: saldo.saldo,
      somaValor: soma.valor, valor: saldo.valor,
      confere: soma.quantidade === saldo.saldo && soma.valor === saldo.valor,
    },
    precoTempo,
    pilula: pilulaDoItem({ saldo: saldo.saldo, estoqueMin: item.estoqueMin, estoqueMax: item.estoqueMax, diasSemMovimento }),
    diasSemMovimento,
    consumo,
    cobertura: coberturaDoItem(saldo.saldo, consumo),
    sugestaoMinimo: minimoSugerido(consumo, prazo, item.unidadeControle),
    usoEmFichas: await usadoEmFichas(companyId, itemId, db),
    categoriaRastro: troca
      ? { de: CAT_LABEL[troca.de] ?? troca.de, para: CAT_LABEL[troca.para] ?? troca.para, quando: troca.criadoEm.toISOString(), quem: quemTrocou }
      : null,
  }
}
