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
import { reconhecerBancoPF, diagnosticarFalha } from './registry-fatura-pf'
import { resolverTotalDeclarado, conferirTotal, type OrigemTotal } from './total-declarado'
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
    /** ⭐ como o BANCO chama esse encargo — vira a descrição da linha no confirm */
    encargosRotulo: string
  }
  portadores: string[]
  linhas: LinhaFaturaPF[]
  novas: number
  jaExistem: number
  /** ⭐ o que o BANCO declara que vem nas próximas faturas (fato, não estimativa) */
  proximasFaturas: {
    proxima: number | null; seguinte: number | null; demais: number | null; total: number | null
    rotuloProxima: string | null; rotuloSeguinte: string | null
    /** a mesma conta feita a partir das nossas linhas — só CONFERÊNCIA */
    projetadoProxima: number
    bate: boolean
  }
  /** ⭐ qual das quatro falhas foi — a tela decide o que OFERECER a partir disto
   *  (banco desconhecido não tem saída manual; documento sem totais tem). */
  causa?: 'BANCO_NAO_RECONHECIDO' | 'SEM_TOTAIS_DECLARADOS' | 'LINHAS_NAO_LIDAS' | 'NAO_FECHA'
  /** de onde veio o total declarado que foi conferido */
  origemTotal?: OrigemTotal
}

/**
 * Resposta quando nem dá pra tentar ler (banco desconhecido).
 * ⚠️ Devolve a MESMA forma do preview, com zero linha — a tela não precisa de um segundo
 * caminho de erro, e o `ok:false` já a impede de oferecer o confirmar.
 */
function semLeitura(
  card: { id: string }, mensagem: string, causa: NonNullable<PreviewFaturaPF['causa']>,
): PreviewFaturaPF {
  void card
  return {
    ok: false, erro: mensagem, causa,
    banco: 'desconhecido', vencimento: null, referencia: null, totalDeclarado: null,
    conferencia: {
      despesasCalculado: 0, despesasDeclarado: null,
      saldoCalculado: 0, saldoDeclarado: null, fecha: false,
      encargosDeclarados: 0, encargosRotulo: 'Encargos',
    },
    portadores: [], linhas: [], novas: 0, jaExistem: 0,
    proximasFaturas: {
      proxima: null, seguinte: null, demais: null, total: null,
      rotuloProxima: null, rotuloSeguinte: null, projetadoProxima: 0, bate: false,
    },
  }
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
/**
 * ⛔ O ENCARGO DO BANRISUL SAIU DAQUI (09/09/2026). Ele lia rótulos que só existem na
 * fatura do Banrisul ("Encargos sobre rotativo") e rodava pra QUALQUER banco — código de
 * um layout aplicado a todos, que é a doença que este import acabou de curar. Agora mora
 * em `adaptadores-fatura-pf.ts`, junto da régua do banco dele.
 */

export async function previewFaturaPF(input: {
  userId: string
  profileId: string
  cardId: string
  texto: string
  /** ⭐ o dono digitou o total olhando a fatura em papel? (só vale quando o PDF não declara) */
  totalDigitado?: number | null
}): Promise<PreviewFaturaPF> {
  // ⚠️ `getCardInProfile` só confere que o CARTÃO é do PERFIL — não que o USUÁRIO é
  // dono do perfil. Todo write deste módulo passa por aqui antes; sem isto, bastaria
  // trocar o id na URL pra importar fatura no perfil de outra pessoa.
  await checkProfileAccess(input.userId, input.profileId, 'OWNER')
  const card = await getCardInProfile(input.profileId, input.cardId)

  // ⛔⛔ A PORTA QUE FALTAVA (31/08/2026). Isto aqui chamava `parseBanrisulFaturaPF` DIRETO,
  // sem perguntar de que banco era o PDF — e o `?? 'Banrisul'` lá embaixo maquiava o
  // resultado. O dono subiu uma fatura do NUBANK, o Banrisul foi aplicado por cima, e a
  // falha saiu como *"o PDF não declarou o total (layout inesperado)"*: **"banco não
  // reconhecido" vestido de "o layout mudou"**. Ele foi caçar mudança que não existia.
  //
  // ⚠️ Banco não reconhecido agora PARA AQUI, com a frase certa e a lista do que eu leio.
  const parser = reconhecerBancoPF(input.texto)
  if (!parser) {
    const d = diagnosticarFalha({ banco: null, linhas: 0, temTotalDeclarado: false, fecha: false })!
    return semLeitura(card, d.mensagem, d.causa)
  }

  // ⭐⭐⭐ AQUI ESTAVA O BURACO (09/09/2026): esta linha era
  // `parseBanrisulFaturaPF(input.texto)` — CRAVADA. O registry reconhecia o banco e em
  // seguida o Banrisul lia tudo, inclusive uma fatura do Nubank. Agora quem lê é o banco
  // reconhecido, pela forma única.
  const lida = parser.ler(input.texto)
  const enc = lida.conferencia.encargosDeclarados

  const despesasCalculado = lida.conferencia.despesasCalculado
  const saldoCalculado = lida.conferencia.saldoCalculado

  // A fatura do EXTRATO: a que vence na data impressa no PDF.
  const venc = lida.vencimento ? new Date(`${lida.vencimento}T00:00:00.000Z`) : null
  const referencia = venc ? `${venc.getUTCFullYear()}-${String(venc.getUTCMonth() + 1).padStart(2, '0')}` : null

  const linhasCru = lida.linhas.map((l) => {
    const base = {
      data: l.data, descricao: l.descricao, valor: l.valor, parcelaNumero: l.parcelaNumero,
    }
    return {
      ...base,
      credito: l.credito,
      parcelaTotal: l.parcelaTotal,
      portador: l.portador,
      internacional: l.internacional,
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

  // ⚠️ CONFERÊNCIA da projeção — NUNCA a fonte. Na fatura real ela dá 71.733,16 contra
  // 28.989,62 declarados, porque uma compra grande tem 4 parcelas na MESMA fatura + um
  // estorno de −20.954,54 (parcelamento antecipado). Quando diverge, a tela mostra o
  // DECLARADO e avisa que a conta própria não bateu — não inventa número.
  let projetadoProxima = 0
  for (const l of linhasCru) {
    if (l.parcelaNumero != null && l.parcelaTotal != null && l.parcelaNumero < l.parcelaTotal && !l.credito) {
      projetadoProxima = round2(projetadoProxima + l.valor)
    }
  }
  const pf = lida.proximas
  const bateProjecao = pf.proxima != null && Math.abs(projetadoProxima - pf.proxima) <= 1

  // ⭐ O TOTAL DECLARADO — do PDF, ou digitado pelo dono olhando a fatura. A conferência
  // é a MESMA nos dois casos; o que muda é só de onde o número veio (e isso fica gravado).
  const total = resolverTotalDeclarado({ doPdf: lida.conferencia.saldoDeclarado, digitado: input.totalDigitado })
  const conf = total ? conferirTotal(saldoCalculado, total) : null

  /**
   * ⛔⛔ A SAÍDA MANUAL PASSOU A VALER (09/09/2026) — ela existia e nunca dava verde.
   *
   * O `ok` era só `lida.conferencia.fecha`, a régua do BANCO. Num PDF que não declara o
   * total, essa régua é `false` por construção — então o dono digitava o número, via
   * `origemTotal: DIGITADO` na tela, e o import continuava recusando.
   *
   * ⚠️ A trava não afrouxou: o digitado só entra quando **o documento é omisso**
   * (`saldoDeclarado == null`), quando **tudo o mais que dava pra conferir fechou**
   * (`fechaSemOTotal`) e quando **o número dele bate** com o que foi lido. PDF que
   * declara e não bate continua recusado — digitar não é `force`.
   */
  const fechaPeloDigitado = lida.conferencia.saldoDeclarado == null
    && lida.conferencia.fechaSemOTotal
    && total?.origem === 'DIGITADO'
    && !!conf?.fecha
  const fecha = lida.conferencia.fecha || fechaPeloDigitado

  // ⭐ UMA decisão, um lugar: preview e confirm dizem a MESMA coisa da MESMA falha.
  const diag = diagnosticarFalha({
    banco: parser.banco,
    linhas: linhas.length,
    temTotalDeclarado: total != null,
    fecha,
    // ⭐ o detalhe é do BANCO: cada layout explica a própria composição
    detalhe: [lida.conferencia.detalhe, conf?.detalhe ?? null].filter(Boolean).join('\n'),
  })
  const erro = fecha ? null : diag?.mensagem ?? null

  return {
    ok: fecha,
    erro,
    // ⭐ o banco vem do RECONHECIMENTO, não de um default: `detectedBank` era 'Banrisul'
    // cravado no parser, então o `??` nunca podia ajudar.
    banco: parser.banco,
    causa: fecha ? undefined : diag?.causa,
    origemTotal: total?.origem,
    vencimento: lida.vencimento,
    referencia,
    // ⭐ o total que VALEU na conferência — pode ter vindo do PDF ou do dono
    totalDeclarado: total?.valor ?? null,
    conferencia: {
      despesasCalculado,
      despesasDeclarado: lida.conferencia.despesasDeclarado,
      saldoCalculado,
      saldoDeclarado: lida.conferencia.saldoDeclarado,
      fecha,
      encargosDeclarados: enc,
      encargosRotulo: lida.conferencia.encargosRotulo,
    },
    portadores: lida.portadores,
    linhas,
    novas: linhas.filter((l) => !l.jaExiste).length,
    jaExistem: linhas.filter((l) => l.jaExiste).length,
    proximasFaturas: {
      proxima: pf.proxima, seguinte: pf.seguinte, demais: pf.demais, total: pf.total,
      rotuloProxima: pf.rotuloProxima, rotuloSeguinte: pf.rotuloSeguinte,
      projetadoProxima, bate: bateProjecao,
    },
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
  /**
   * ⛔⛔⛔ O TOTAL DIGITADO PRECISA CHEGAR ATÉ AQUI (09/09/2026) — e não chegava.
   *
   * A saída "digite o total olhando a fatura" foi construída em 31/08 pro caso do PDF que
   * não declara o total. Ela funcionava no PREVIEW e **evaporava no CONFIRM**: este
   * parâmetro não existia e a rota não o repassava, então o confirm rerodava o preview
   * SEM o número, caía em `SEM_TOTAIS_DECLARADOS` e **recusava gravar**.
   *
   * ⚠️ Medido em prod (09/09): o dono digitou o total da fatura do Magalu, o preview
   * ficou verde, ele confirmou — e o cartão tem **0 lançamentos**. Ele acreditou que
   * tinha importado ("importei com o total digitado pra fechar o mês"). É a família
   * "preview e confirm discordando", que este projeto já pagou caro no import de OFX:
   * **a tela dizia uma coisa e a gravação fazia outra.**
   */
  totalDigitado?: number | null
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
    // ⭐ BUG 1 (26/08): a fatura gravava 18.348,10 e o boleto dizia 18.348,72 — faltavam
    // os **R$ 0,62 de encargos sobre rotativo**. Eles são declarados no RESUMO e não
    // aparecem como linha de transação, então a Σ das linhas ficava 0,62 curta.
    // ⚠️ A correção é criar a LINHA do encargo, não somar no total "por fora": assim o
    // invariante KP1 (`totalAmount == Σ das linhas`) continua valendo e o dono VÊ a
    // cobrança na lista em vez de um total que não fecha com o que ele soma na mão.
    const enc = prev.conferencia.encargosDeclarados
    // ⭐ o NOME é o do banco (09/09): "Encargos sobre rotativo" é rótulo do Banrisul, e o
    // Itaú chama de "Encargos (financiamento + moratório)".
    const rotuloEnc = prev.conferencia.encargosRotulo
    if (enc > 0) {
      const hashEnc = hashLinha(input.cardId, {
        data: prev.vencimento!, valor: enc, descricao: rotuloEnc.toUpperCase(), parcelaNumero: null,
      })
      // ⚠️ dedup por HASH **ou** por (fatura + descrição + valor): o encargo pode ter
      // sido lançado à mão (foi o que aconteceu na correção da fatura de 26/08 — a
      // linha nasceu sem `dedupHash` e o reimport criou uma segunda, 182 → 183).
      // Procurar só pelo hash confia que todo mundo passou por aqui; não passou.
      const jaTem = await tx.personalTransaction.findFirst({
        where: {
          creditCardId: input.cardId,
          OR: [
            { dedupHash: hashEnc },
            { creditCardInvoiceId: invoice.id, description: rotuloEnc, amount: enc },
          ],
        },
        select: { id: true },
      })
      if (!jaTem) {
        await tx.personalTransaction.create({
          data: {
            profileId: input.profileId, date: new Date(`${prev.vencimento}T12:00:00.000Z`),
            description: rotuloEnc, amount: enc, type: 'DEBIT',
            status: 'RECONCILED', origin: 'PDF_FATURA', dedupHash: hashEnc,
            creditCardId: input.cardId, creditCardInvoiceId: invoice.id,
            notes: 'declarado no resumo da fatura (não é linha de transação)',
          },
        })
        criadas++
      }
    }
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
    await tx.creditCardInvoice.update({
      where: { id: invoice.id },
      data: {
        totalAmount: total,
        // o que o BANCO declara sobre as próximas faturas — fato, não estimativa
        declaredUpcoming: JSON.stringify(prev.proximasFaturas),
      },
    })
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
