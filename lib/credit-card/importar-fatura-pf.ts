// IMPORT DE FATURA PDF NO **PF** (26/08) — o ciclo que a PJ já tinha.
//
// ⚠️ POR QUE NÃO DÁ PRA USAR `createPurchase`: aquela função recebe o TOTAL de uma
// compra e a DIVIDE em N parcelas futuras, espalhadas pelas próximas faturas. O PDF
// traz outra coisa: **a parcela DESTE mês, já cobrada** ("QATAR 02/05 4.749,36" é a
// 2ª de 5, e as outras 4 não são minhas pra criar). Importar por `createPurchase`
// duplicaria as parcelas futuras que o próprio banco vai cobrar depois.
// Aqui cada linha do PDF vira UMA transação na fatura DESTE extrato, guardando
// `installmentNumber/Total` só pra mostrar na tela.
//
// ⚠️ A FATURA É ESCOLHIDA PELO VENCIMENTO DO PDF, não pela data das compras. Uma
// fatura que vence 10/08 tem compras de 11/11 do ano passado (parceladas) — deixar
// cada linha cair na "sua" fatura pela data espalharia o extrato por 12 meses.
//
// ⚠️ NUNCA GRAVA FATURA QUE NÃO FECHA. Mesma disciplina da PJ: se a Σ das linhas não
// bate com o total declarado no PDF, o preview devolve `ok:false` e o confirm recusa.
// Fatura de cartão que não bate é dado que vai mentir no fluxo de caixa depois.

import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { parseBanrisulFaturaPF } from '@/lib/fatura-banrisul/banrisul-fatura-pf'
import { getCardInProfile, getOrCreateInvoice, CreditCardError } from './queries'
import { checkProfileAccess } from '@/lib/personal-profile/queries'
import { calculateInvoiceReference, type CardConfig } from './calculate-invoice-reference'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const TOL = 0.02

export interface LinhaFaturaPF {
  data: string // YYYY-MM-DD
  descricao: string
  valor: number // sempre positivo; `credito` diz o sinal
  credito: boolean // estorno / crédito na fatura
  parcelaNumero: number | null
  parcelaTotal: number | null
  portador: string | null // final do cartão (a fatura pode ter vários)
  internacional: boolean
  dedupHash: string
  jaExiste: boolean
}

export interface PreviewFaturaPF {
  ok: boolean
  erro: string | null
  banco: string
  vencimento: string | null
  referencia: string | null
  /** o que se paga (declarado no PDF) */
  totalDeclarado: number | null
  conferencia: {
    despesasCalculado: number
    despesasDeclarado: number | null
    saldoCalculado: number
    saldoDeclarado: number | null
    fecha: boolean
    /** encargo que só existe no resumo (não é linha) */
    encargosDeclarados: number
  }
  portadores: string[]
  linhas: LinhaFaturaPF[]
  novas: number
  jaExistem: number
}

/** Identidade da linha — o que a torna a MESMA em dois uploads do mesmo PDF. */
export function hashLinha(cardId: string, l: {
  data: string; valor: number; descricao: string; parcelaNumero: number | null
}): string {
  const desc = l.descricao.toUpperCase().replace(/\s+/g, ' ').trim()
  return createHash('sha256')
    .update(`${cardId}|${l.data}|${l.valor.toFixed(2)}|${desc}|${l.parcelaNumero ?? ''}`)
    .digest('hex')
}

/** Encargo declarado no resumo que NÃO aparece como linha (rotativo, juros). */
function encargosDeclarados(texto: string): number {
  let soma = 0
  for (const re of [
    /Encargos sobre rotativo\s+([\d.]+,\d{2})/i,
    /Encargos sobre saque\s+([\d.]+,\d{2})/i,
    /Encargos sobre pagamento de contas\s+([\d.]+,\d{2})/i,
  ]) {
    const m = texto.match(re)
    if (m) soma += Number(m[1].replace(/\./g, '').replace(',', '.'))
  }
  return round2(soma)
}

export async function previewFaturaPF(input: {
  userId: string
  profileId: string
  cardId: string
  texto: string
}): Promise<PreviewFaturaPF> {
  // ⚠️ `getCardInProfile` só confere que o CARTÃO é do PERFIL — não que o USUÁRIO é
  // dono do perfil. Todo write deste módulo passa por aqui antes; sem isto, bastaria
  // trocar o id na URL pra importar fatura no perfil de outra pessoa.
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  const card = await getCardInProfile(input.profileId, input.cardId)
  const r = parseBanrisulFaturaPF(input.texto)
  const enc = encargosDeclarados(input.texto)

  const despesasCalculado = r.computed.sumPositives
  const saldoCalculado = round2(r.computed.sumEstornos + despesasCalculado + enc)
  const despesasOk =
    r.declared.brasil != null && Math.abs(despesasCalculado - r.declared.brasil) <= TOL
  const saldoOk =
    r.declared.saldoAtual != null && Math.abs(saldoCalculado - r.declared.saldoAtual) <= TOL
  const fecha = despesasOk && saldoOk

  // A fatura do EXTRATO: a que vence na data impressa no PDF.
  const venc = r.extraction.dueDate ? new Date(`${r.extraction.dueDate}T00:00:00.000Z`) : null
  const referencia = venc ? `${venc.getUTCFullYear()}-${String(venc.getUTCMonth() + 1).padStart(2, '0')}` : null

  const linhasCru = (r.extraction.lines ?? []).map((l) => {
    const credito = !!l.note?.includes('estorno')
    const base = {
      data: l.date,
      descricao: l.description,
      valor: round2(l.amount),
      parcelaNumero: l.installmentNumber ?? null,
    }
    return {
      ...base,
      credito,
      parcelaTotal: l.installmentTotal ?? null,
      portador: (l as { cardLastDigits?: string }).cardLastDigits ?? null,
      internacional: !!l.note?.includes('internacional'),
      dedupHash: hashLinha(input.cardId, base),
      jaExiste: false,
    }
  })

  // dedup contra o que já está gravado NESTE cartão
  const hashes = linhasCru.map((l) => l.dedupHash)
  const existentes = hashes.length
    ? await prisma.personalTransaction.findMany({
        where: { creditCardId: input.cardId, dedupHash: { in: hashes } },
        select: { dedupHash: true },
      })
    : []
  const jaGravados = new Set(existentes.map((e) => e.dedupHash))
  const linhas = linhasCru.map((l) => ({ ...l, jaExiste: jaGravados.has(l.dedupHash) }))

  const erro = fecha
    ? null
    : [
        'A fatura NÃO fecha com os totais declarados no PDF — nada será importado.',
        r.declared.brasil != null
          ? `   despesas: lido R$ ${despesasCalculado.toFixed(2)} · declarado R$ ${r.declared.brasil.toFixed(2)}`
          : '   despesas: o PDF não declarou o total (layout inesperado)',
        r.declared.saldoAtual != null
          ? `   saldo da fatura: lido R$ ${saldoCalculado.toFixed(2)} · declarado R$ ${r.declared.saldoAtual.toFixed(2)}`
          : '   saldo da fatura: o PDF não declarou o total',
      ].join('\n')

  return {
    ok: fecha,
    erro,
    banco: r.extraction.detectedBank ?? 'Banrisul',
    vencimento: r.extraction.dueDate,
    referencia,
    totalDeclarado: r.declared.saldoAtual,
    conferencia: {
      despesasCalculado,
      despesasDeclarado: r.declared.brasil,
      saldoCalculado,
      saldoDeclarado: r.declared.saldoAtual,
      fecha,
      encargosDeclarados: enc,
    },
    portadores: r.extraction.cardLastDigitsFound ?? [],
    linhas,
    novas: linhas.filter((l) => !l.jaExiste).length,
    jaExistem: linhas.filter((l) => l.jaExiste).length,
  }
}

export interface ConfirmResultPF {
  criadas: number
  puladas: number
  invoiceId: string
  referencia: string
  totalFatura: number
}

/**
 * Uma data de compra que cai na fatura cujo vencimento é `venc`.
 * Tenta o próprio mês e os 2 anteriores; se nenhum bater, usa o mês do vencimento
 * (o `getOrCreateInvoice` ainda cria algo coerente e o total fica visível na tela).
 */
export function ancoraParaVencimento(venc: Date, cfg: CardConfig): Date {
  const alvo = venc.toISOString().slice(0, 10)
  for (let atras = 0; atras <= 2; atras++) {
    const cand = new Date(Date.UTC(venc.getUTCFullYear(), venc.getUTCMonth() - atras, 1))
    if (calculateInvoiceReference(cand, cfg).dueDate.toISOString().slice(0, 10) === alvo) return cand
  }
  return new Date(Date.UTC(venc.getUTCFullYear(), venc.getUTCMonth(), 1))
}

export async function confirmarFaturaPF(input: {
  userId: string
  profileId: string
  cardId: string
  texto: string
}): Promise<ConfirmResultPF> {
  const prev = await previewFaturaPF(input)
  // ⛔ a mesma recusa do preview, no servidor: quem chamar direto não escapa.
  if (!prev.ok) throw new CreditCardError(prev.erro ?? 'Fatura não fecha', 'FATURA_NAO_FECHA')
  if (!prev.vencimento) throw new CreditCardError('PDF sem data de vencimento', 'SEM_VENCIMENTO')

  const card = await getCardInProfile(input.profileId, input.cardId)
  const cfg: CardConfig = {
    closingDay: card.closingDay,
    dueDay: card.dueDay,
    closingDayRule: card.closingDayRule as 'ATUAL' | 'PROXIMA',
  }
  // ⚠️ A FATURA É A QUE VENCE NA DATA IMPRESSA NO PDF — e achar essa não é óbvio:
  // com "fecha 29 / vence 10" (o cartão real do dono), o vencimento cai no mês
  // SEGUINTE ao fechamento. Usar o dia 1 do mês do vencimento como âncora pegava a
  // fatura errada (o teste pegou: esperava vencer 10/08 e vinha 10/09).
  // Então: anda pra trás mês a mês e escolhe a referência cujo VENCIMENTO calculado
  // bate com o do PDF. Determinístico, sem adivinhar a regra do banco.
  const venc = new Date(`${prev.vencimento}T00:00:00.000Z`)
  const ancora = ancoraParaVencimento(venc, cfg)
  const invoice = await getOrCreateInvoice(input.cardId, cfg, ancora)

  const novas = prev.linhas.filter((l) => !l.jaExiste)
  let criadas = 0
  await prisma.$transaction(async (tx) => {
    for (const l of novas) {
      await tx.personalTransaction.create({
        data: {
          profileId: input.profileId,
          date: new Date(`${l.data}T12:00:00.000Z`),
          description: l.descricao,
          amount: l.valor,
          type: l.credito ? 'CREDIT' : 'DEBIT',
          status: 'RECONCILED',
          origin: 'PDF_FATURA',
          dedupHash: l.dedupHash,
          creditCardId: input.cardId,
          creditCardInvoiceId: invoice.id,
          ...(l.parcelaNumero ? { installmentNumber: l.parcelaNumero } : {}),
          ...(l.parcelaTotal ? { installmentTotal: l.parcelaTotal } : {}),
          isInternational: l.internacional,
          ...(l.portador ? { notes: `portador ****${l.portador}` } : {}),
        },
      })
      criadas++
    }
    // total da fatura = Σ débitos − Σ créditos das tx do cartão nesta fatura
    const doCartao = await tx.personalTransaction.findMany({
      where: { creditCardInvoiceId: invoice.id, isInvoicePayment: false },
      select: { amount: true, type: true },
    })
    const total = round2(
      doCartao.reduce((s, t) => s + (t.type === 'CREDIT' ? -t.amount : t.amount), 0),
    )
    await tx.creditCardInvoice.update({ where: { id: invoice.id }, data: { totalAmount: total } })
  })

  const atualizada = await prisma.creditCardInvoice.findUniqueOrThrow({ where: { id: invoice.id } })
  return {
    criadas,
    puladas: prev.jaExistem,
    invoiceId: invoice.id,
    referencia: atualizada.reference,
    totalFatura: atualizada.totalAmount,
  }
}
