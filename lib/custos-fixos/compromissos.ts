/**
 * ⭐⭐⭐ A PRATELEIRA 📅 COMPROMISSOS DO MÊS (07/10/2026) — "não são custo, são caixa que sai".
 *
 * **Ordem do dono:** *"(a) PARCELAS DE EMPRÉSTIMO puxadas dos contratos que o sistema já tem —
 * linha por contrato: nome · parcela R$ · vence dia · «faltam N parcelas (termina MM/AAAA)» ·
 * selo. (b) FATURA DO CARTÃO: linha por cartão — fatura do mês R$ X (N compras) · vence dia ·
 * selo, lendo do cartão→faturas existente."*
 *
 * ⛔⛔ **ZERO MOTOR NOVO — e isso é o que mantém esta prateleira honesta.** Quem diz em que pé
 * está a parcela é o `estadoDaParcela` (o dono único desde 02/10, que conhece a PARCIAL, a
 * isenção do FLEXIBLE e o *"PAID gravado ganha da aritmética"*); quem prevê o valor do POS é o
 * `forecastProxima`; quem soma a fatura é o `faturaNetTotal` (a REGRA 6); quem diz em que pé
 * está a fatura é o `estadoDaFatura`. Uma régua própria aqui faria esta tela discordar da
 * carteira de empréstimos e da tela de cartões sobre o MESMO fato.
 *
 * ⚠️⚠️ **O SELO DA PARCELA NÃO É O `statusDaConta`, e é um desvio DELIBERADO da letra da
 * ordem.** O pedido diz *"selo pago/vence/atrasado pelo statusDaConta"* — mas parcela de
 * empréstimo tem dono próprio (`estadoDaParcela`), e ele sabe três coisas que o
 * `statusDaConta` não sabe: PARCIAL (a parcela paga em mordidas — a #21 real do C41033828 saiu
 * em 3 pedaços no mesmo dia), a isenção do FLEXIBLE (o mútuo da Arafat **nunca** é "atrasado":
 * a devolução é conforme caixa) e *"a soma só PROMOVE"*. Usar o `statusDaConta` aqui chamaria o
 * mútuo de atrasado — o que o CLAUDE.md proíbe por escrito.
 *
 * ⛔⛔⛔ **A REFERÊNCIA FLEXÍVEL É PAGA PELO CAIXA DO MÊS, E CONTA SEMPRE NA Σ (07/10/2026).**
 * A lei mora em `lib/loans/referencia-flexivel.ts` (o bloco de lá conta a história inteira):
 * no recorte de um mês, a referência daquele mês é paga pelo **caixa que SAIU dentro do mês**,
 * nunca pela ordem do vínculo — foi o vínculo que fez OUTUBRO mostrar *"paga"* a partir de um
 * pagamento de AGOSTO. Não paga, ela entra pelo **NOMINAL**, marcada `~referência flexível`.
 *
 * ⚠️⚠️ **ISTO REVERTEU DUAS FRASES QUE EU ESCREVI AQUI NO MESMO DIA** (*"não entra na Σ
 * enquanto não for paga"* e *"um pagamento que ele ainda não decidiu fazer"*): o dono devolveu
 * em TRÊS meses seguidos, então o caixa sai mesmo — *"tela de compromissos que esconde 41 mil
 * me faz afundar sorrindo"*.
 *
 * ⚠️ **DIVERGÊNCIA DECLARADA:** o `parcelaMensalTotal` da carteira de empréstimos **continua
 * excluindo FLEXIBLE** (desde 06/08) — ele responde *"quanto de parcela OBRIGATÓRIA eu pago"*,
 * e o mútuo não tem parcela obrigatória. As duas telas passam a mostrar números diferentes
 * para a Arafat, de propósito; mudar o outro não foi pedido e seria decisão do dono.
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { janelaDoMes } from '@/lib/periodo/mes-corrente'
import { estadoDaParcela, type EstadoDaParcela } from '@/lib/loans/estado-da-parcela'
import { prepararContrato, avaliarParcela } from '@/lib/loans/valor-da-parcela'
import { CONTRATO_VISIVEL } from '@/lib/loans/ficha'
import { faturaNetTotal } from '@/lib/credit-card-pj/fatura-net-total'
import {
  fechamentoDaCompetencia,
  vencimentoDaCompetencia,
} from '@/lib/credit-card-pj/faturas-pra-quitar'
import { estadoDaFatura, type EstadoFatura } from '@/lib/credit-card/estado-fatura'
import { formatBRL } from '@/lib/format/money'

type Db = PrismaClient | Prisma.TransactionClient

export interface LinhaDeParcela {
  loanId: string
  /** "Banrisul 002100064956967" — como a carteira escreve */
  contrato: string
  numero: number
  /** `null` = a apurar (POS sem parcela casada que sirva de base) */
  valor: number | null
  /** ⚠️ `true` = ~previsto (POS), `false` = o número da agenda é fato (PRE) */
  valorEhPrevisto: boolean
  valorPorque: string | null
  vencimento: string
  diaDoVencimento: number
  /** "faltam 12 parcelas (termina 09/2027)" */
  faltam: string
  selo: string
  estado: EstadoDaParcela
  flexible: boolean
  /**
   * ⭐ a frase que explica a referência flexível do mês (a linha-mitigação de 07/10).
   * `null` em parcela bancária e na referência flexível já paga.
   */
  avisoFlexivel: string | null
  /**
   * ⭐ O RESTO DO SELO — vai no `title` do chip (10/10, a dieta de texto).
   *
   * ⚠️ `null` em parcela bancária: ali o selo já é curto ("paga", "a vencer") e um tooltip
   * repetindo o óbvio é ruído.
   */
  seloDetalhe: string | null
  /**
   * ⛔ entra na Σ da prateleira? **Só a parcela "a apurar" fica FORA** — e a tela DIZ por quê,
   * nunca esconde a linha. ⚠️ A referência FLEXÍVEL não-paga **ENTRA pelo nominal** desde
   * 07/10 (ajuste do dono; ver o bloco no laço).
   */
  contaNaSoma: boolean
  href: string
}

export interface LinhaDeFatura {
  cardId: string
  nome: string
  ultimos4: string | null
  /** compras − estornos (a REGRA 6). `null` = fatura deste mês não importada */
  net: number | null
  compras: number
  estornos: number
  /** quantas compras a fatura tem — o "(N compras)" que o dono pediu */
  nCompras: number
  vencimento: string | null
  diaDoVencimento: number
  pago: { valor: number; data: string } | null
  selo: string
  estado: EstadoFatura | 'NAO_IMPORTADA'
  /** ⚠️ a fatura do mês ainda não entrou no sistema — estado PRÓPRIO, nunca R$ 0,00 */
  naoImportada: boolean
  contaNaSoma: boolean
  href: string
}

export interface CompromissosDoMes {
  parcelas: LinhaDeParcela[]
  faturas: LinhaDeFatura[]
  somaParcelas: number
  somaFaturas: number
  total: number
  /** quantas linhas ficaram fora da Σ, e por quê — exclusão escondida é pior que exclusão nenhuma */
  foraDaSoma: { n: number; porque: string[] }
  /**
   * ⭐⭐ A PERGUNTA DA DUPLA CONTAGEM, MEDIDA — não suposta.
   *
   * A ordem diz: *"se o juro da parcela já estiver em categoria marcada no BANCO, a tela DIZ
   * em 1 linha"*. Isto é a CONDIÇÃO, avaliada contra o dado: existe transação que pagou parcela
   * neste mês carregando categoria de uma prateleira BANCO? `null` = não há, então a linha não
   * aparece (frase sobre algo que não acontece é ruído que treina o dono a não ler).
   */
  jurosJaNoBanco: string | null
}

const mmaaaa = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/**
 * ⭐⭐⭐ LÊ OS COMPROMISSOS DO MÊS — parcelas de empréstimo e faturas de cartão.
 *
 * ⚠️ Em POUCAS consultas (uma pelos contratos com a agenda inteira, uma pelos cartões, duas
 * pelas linhas/pagamentos de fatura) — não uma por contrato. É a cicatriz dos 4.909 ms de
 * 28/09, e esta tela abre todo dia.
 */
export async function lerCompromissos(
  companyId: string,
  mes: string,
  agora: Date = new Date(),
  db: Db = prisma,
  /** ⭐ as categorias marcadas na prateleira BANCO — pra avaliar a condição da dupla contagem */
  categoriasDoBanco: string[] = [],
): Promise<CompromissosDoMes> {
  const { de, ate } = janelaDoMes(mes)
  const fim = new Date(ate.getTime() - 1)

  const [loans, cartoes] = await Promise.all([
    db.loan.findMany({
      where: { companyId, status: 'ACTIVE', ...CONTRATO_VISIVEL },
      select: {
        id: true,
        lender: true,
        contractNumber: true,
        rateType: true,
        /**
         * ⚠️ A TAXA ENTRA PORQUE O SELO PRECISA SABER SE OS ENCARGOS SÃO APURADOS NO
         * PAGAMENTO (19/10) — no pós-fixado o `interest` da aberta é 0 por desenho, e sem a
         * taxa o `encargosSaoApurados` não tem como distinguir *"não tem juros"* de *"o juros
         * deste mês ainda não existe"*. É a doença do select incompleto de novo: sem o campo,
         * o motor decide calado.
         */
        interestRateMonthly: true,
        scheduleSource: true,
        installments: {
          select: {
            number: true,
            dueDate: true,
            status: true,
            payment: true,
            interest: true,
            paidTotal: true,
            reconciledTransactionId: true,
            /**
             * ⚠️⚠️ A DATA do pagamento é o campo que faltava — foi a ausência dela que deixou
             * o selo de OUTUBRO sair de um pagamento de AGOSTO (07/10). Sem `date` nos dois
             * vínculos, a lei da referência flexível não tem como existir. É a doença do
             * select incompleto (o PIX de 7.000, 17/08): o motor decide com um campo que a
             * consulta não trouxe, e não dá erro — dá silêncio.
             */
            reconciledTransaction: { select: { date: true, amount: true } },
            payments: { select: { amount: true, transaction: { select: { date: true } } } },
          },
          orderBy: { number: 'asc' },
        },
      },
      orderBy: { lender: 'asc' },
    }),
    db.businessCreditCard.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, lastDigits: true, closingDay: true, dueDay: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const ids = cartoes.map((c) => c.id)
  const [linhasDeFatura, pagamentos] = await Promise.all([
    ids.length
      ? db.transaction.findMany({
          where: { businessCreditCardId: { in: ids }, invoiceMonth: mes, isCardPayment: false },
          select: { businessCreditCardId: true, type: true, amount: true },
        })
      : Promise.resolve([]),
    ids.length
      ? db.transaction.findMany({
          where: { businessCreditCardId: { in: ids }, paidInvoiceMonth: mes, isCardPayment: true },
          select: { businessCreditCardId: true, amount: true, date: true },
        })
      : Promise.resolve([]),
  ])

  // ─────────── (a) PARCELAS DE EMPRÉSTIMO ───────────
  const parcelas: LinhaDeParcela[] = []
  const foraPorque: string[] = []

  for (const l of loans) {
    const flexible = l.scheduleSource === 'FLEXIBLE'
    const noMes = l.installments.filter((i) => i.dueDate >= de && i.dueDate < ate)
    if (noMes.length === 0) continue

    // ⭐ R58 (25/11/2026) — o preparo e o valor da parcela vêm de UMA função (a carteira usa a mesma)
    const prep = prepararContrato(l)

    const contrato = `${l.lender}${l.contractNumber ? ` ${l.contractNumber}` : ''}`
    const ultima = l.installments[l.installments.length - 1]

    for (const i of noMes) {
      /**
       * ⛔⛔ AQUI A LEI SE BIFURCA, e o escopo é o que a mantém honesta: FLEXIBLE pergunta
       * *"o caixa deste mês cobriu a referência?"*; bancário segue no `estadoDaParcela`, onde
       * *"PAID gravado é DECISÃO"* — a Caixa #28 venceu em maio e foi paga em junho, e no
       * recorte de maio ela É paga, com atraso. Uma lei só mentiria num dos dois.
       */
      const { veredito, v, ref } = avaliarParcela(l, prep, i, { mes, de, ate }, agora)

      /**
       * ⚠️ "faltam N parcelas" conta o que o `estadoDaParcela` NÃO chama de PAGA — não o
       * `status` cru: parcela `PAID` sem vínculo nenhum continua pedindo o pagamento, e
       * contar pelo campo gravado prometeria um contrato mais curto do que ele é.
       */
      const abertas = l.installments.filter(
        (x) =>
          estadoDaParcela(
            {
              dueDate: x.dueDate,
              payment: x.payment,
              interest: x.interest,
              status: x.status,
              paidTotal: x.paidTotal,
              pagamentos: x.payments,
              valorDoVinculo11: null,
            },
            { flexible, hoje: agora, rateMonthly: l.interestRateMonthly },
          ).estado !== 'PAGA',
      ).length

      /**
       * ⭐⭐ O AJUSTE DO DONO (07/10) QUE REVERTEU UMA DECISÃO MINHA DO MESMO DIA.
       *
       * Eu havia escrito *"FLEXIBLE não-paga fica FORA da Σ"* supondo *"um pagamento que o
       * dono ainda não decidiu fazer"*. **A premissa estava errada**: ele devolveu em TRÊS
       * meses seguidos (jul 40k · ago 50k · set 50k). Nas palavras dele: *"eu devolvo todo
       * mês, esse caixa certamente sai; tela de compromissos que esconde 41 mil me faz
       * afundar sorrindo"*.
       *
       * ⛔ Então a referência flexível **CONTA sempre** — pelo nominal quando não paga
       * (marcada `~referência flexível`), pelo que saiu quando paga. O único motivo de ficar
       * fora da Σ voltou a ser UM: **valor a apurar** (o POS sem parcela casada).
       */
      const contaNaSoma = v.valor != null
      if (!contaNaSoma) {
        foraPorque.push(`${contrato} parcela ${i.number}: valor a apurar`)
      }

      parcelas.push({
        loanId: l.id,
        contrato,
        numero: i.number,
        valor: v.valor,
        valorEhPrevisto: v.valorEhPrevisto,
        valorPorque: v.valorPorque,
        vencimento: i.dueDate.toISOString().slice(0, 10),
        diaDoVencimento: i.dueDate.getUTCDate(),
        faltam: flexible
          ? `agenda flexível — ${abertas} parcela(s) de referência`
          : `faltam ${abertas} parcela(s)${ultima ? ` (termina ${mmaaaa(ultima.dueDate)})` : ''}`,
        selo: veredito.selo,
        estado: veredito.estado,
        flexible,
        /**
         * ⭐ A LINHA-MITIGAÇÃO (exigência do dono): a página do empréstimo diz "#2 paga"
         * (pergunta do CONTRATO) e outubro diz "a vencer" (pergunta do MÊS). São perguntas
         * diferentes, e por regra da casa isso não pode ficar mudo — a prateleira DIZ qual
         * é a dela, com a data da última devolução.
         */
        avisoFlexivel: ref?.porque ?? null,
        seloDetalhe: ref?.seloDetalhe ?? null,
        contaNaSoma,
        href: `/empresas/${companyId}/emprestimos/${l.id}`,
      })
    }
  }
  parcelas.sort((a, b) => a.vencimento.localeCompare(b.vencimento))

  // ─────────── (b) FATURA DO CARTÃO ───────────
  const porCartao = new Map<string, { type: string; amount: number }[]>()
  for (const it of linhasDeFatura) {
    const k = it.businessCreditCardId as string
    porCartao.set(k, [...(porCartao.get(k) ?? []), { type: it.type, amount: it.amount }])
  }
  const pagoPorCartao = new Map<string, { valor: number; data: string }>()
  for (const p of pagamentos) {
    const k = p.businessCreditCardId as string
    const atual = pagoPorCartao.get(k)
    pagoPorCartao.set(k, {
      valor: (atual?.valor ?? 0) + p.amount,
      data: atual?.data ?? p.date.toISOString().slice(0, 10),
    })
  }

  const faturas: LinhaDeFatura[] = cartoes.map((c) => {
    const itens = porCartao.get(c.id) ?? []
    const pago = pagoPorCartao.get(c.id) ?? null
    const venc = vencimentoDaCompetencia(mes, c.dueDay)
    const fecha = fechamentoDaCompetencia(mes, c.closingDay, c.dueDay)
    const base = {
      cardId: c.id,
      nome: c.name,
      ultimos4: c.lastDigits ?? null,
      vencimento: venc,
      diaDoVencimento: c.dueDay,
      pago,
      href: `/empresas/${companyId}/cartoes/${c.id}`,
    }

    /**
     * ⛔⛔ FATURA NÃO IMPORTADA É ESTADO PRÓPRIO, NUNCA R$ 0,00. Medido em prod: nenhum dos
     * 4 cartões tem a fatura de 2026-10 (a de outubro fechou dia 5 e ainda não entrou).
     * Mostrar zero diria *"este mês o cartão não custou nada"* na véspera do vencimento.
     */
    if (itens.length === 0 && !pago) {
      return {
        ...base,
        net: null,
        compras: 0,
        estornos: 0,
        nCompras: 0,
        selo: `fatura de ${mes} ainda não importada — vence dia ${c.dueDay}`,
        estado: 'NAO_IMPORTADA' as const,
        naoImportada: true,
        contaNaSoma: false,
      }
    }

    const net = faturaNetTotal(itens.map((i) => ({ amount: i.amount, type: i.type })))
    const e =
      venc && fecha
        ? estadoDaFatura(
            {
              closingDate: new Date(`${fecha}T00:00:00.000Z`),
              dueDate: new Date(`${venc}T00:00:00.000Z`),
              totalAmount: net.net,
              paidAmount: pago?.valor ?? 0,
            },
            agora,
          )
        : null

    return {
      ...base,
      net: net.net,
      compras: net.compras,
      estornos: net.estornos,
      nCompras: itens.length,
      selo: e ? `${e.rotulo} · ${e.detalhe}` : `vence dia ${c.dueDay}`,
      estado: e?.estado ?? ('FECHADA' as const),
      naoImportada: false,
      contaNaSoma: true,
    }
  })

  for (const f of faturas) {
    if (!f.contaNaSoma) {
      foraPorque.push(`${f.nome}: fatura de ${mes} não importada`)
    }
  }

  const somaParcelas = parcelas.filter((p) => p.contaNaSoma).reduce((s, p) => s + (p.valor ?? 0), 0)
  const somaFaturas = faturas.filter((f) => f.contaNaSoma).reduce((s, f) => s + (f.net ?? 0), 0)

  // ─────────── a condição da dupla contagem, MEDIDA ───────────
  let jurosJaNoBanco: string | null = null
  if (categoriasDoBanco.length > 0) {
    const comCategoriaDoBanco = await db.transaction.count({
      where: {
        OR: [{ loanInstallmentPaid: { isNot: null } }, { loanInstallmentPayments: { some: {} } }],
        bankAccount: { companyId },
        date: { gte: de, lte: fim },
        categoryId: { in: categoriasDoBanco },
      },
    })
    if (comCategoriaDoBanco > 0) {
      jurosJaNoBanco =
        'o juro destas parcelas já aparece na prateleira do banco — por isso ele não é somado duas vezes'
    }
  }

  return {
    parcelas,
    faturas,
    somaParcelas,
    somaFaturas,
    total: somaParcelas + somaFaturas,
    foraDaSoma: { n: foraPorque.length, porque: foraPorque },
    jurosJaNoBanco,
  }
}

/** ⭐ o texto do rodapé da prateleira — a Σ que o dono confere no dedo */
export function rodapeDosCompromissos(c: CompromissosDoMes): string {
  return `parcelas ${formatBRL(c.somaParcelas)} + faturas ${formatBRL(c.somaFaturas)} = ${formatBRL(c.total)}`
}
