/**
 * ⭐⭐⭐ ALARME SEM PORTA É A PORTA SEM MAÇANETA, DO LADO DO ALARME (24/09/2026).
 *
 * **O caso do dono:** nota do M. IVAN LUNARDI, R$ 326,50, conferida em 13/09 com o boleto do
 * papel (venc 14/09) — e **nunca enviada pro contas a pagar**. O **F3 gritou por 10 dias** e
 * **nenhuma tela mostrava o boleto**, porque a única fila desenhada filtrava `dVenc: null`.
 *
 * ⚠️ A fila do **F5** ganhou tela em 13/09 com a lição escrita no arquivo (*"e-mail noturno
 * não é lugar de dívida vencendo — o dono lê TELA"*) — e o **F3 ficou de fora**. Este guard
 * existe pra o alarme e a porta nunca mais nascerem separados.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { parcelasNaoEnviadas } from '../vencimento'
import { notasSemVencimento } from '../definir-parcelas'
import { checkPonteInvariants } from '../../ponte-invariants'

const CNPJ = '50607080001377' // ⚠️ exclusivo deste arquivo
let companyId = ''
let nfeId = ''

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const co = await prisma.company.create({ data: { name: 'alarme-tem-porta', cnpj: CNPJ }, select: { id: true } })
  companyId = co.id
})
afterAll(async () => {
  await prisma.stockPayableLink.deleteMany({ where: { companyId } })
  await prisma.stockPayableSuggestion.deleteMany({ where: { companyId } })
  await prisma.stockReceiptConference.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** o cenário EXATO do IVAN: conferida há 11 dias, boleto com data, nunca enviado */
beforeEach(async () => {
  await prisma.stockPayableLink.deleteMany({ where: { companyId } })
  await prisma.stockPayableSuggestion.deleteMany({ where: { companyId } })
  await prisma.stockReceiptConference.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  const n = await prisma.stockNfe.create({
    data: {
      companyId, chave: '4326088872802700014855001068770459162114' + '3404', nsu: '1',
      emitNome: 'M. IVAN LUNARDI OURIQUE LTDA', vNF: 326.5, status: 'CONFIRMADA',
      dataEmissao: new Date('2026-09-10T00:00:00Z'),
    },
    select: { id: true, chave: true },
  })
  nfeId = n.id
  await prisma.stockReceiptConference.create({
    data: {
      companyId, nfeId, chave: n.chave, status: 'CONFIRMADA',
      confirmadoEm: new Date('2026-09-13T20:38:00Z'),
    },
  })
  await prisma.stockPayableSuggestion.create({
    data: {
      companyId, nfeId, chave: n.chave, supplierNome: 'M. IVAN LUNARDI OURIQUE LTDA',
      nDup: null, valor: 326.5, dVenc: new Date('2026-09-14T00:00:00Z'), status: 'SUGERIDA',
      criadoEm: new Date('2026-09-13T20:38:00Z'),
    },
  })
})

describe('⛔⛔ o boleto conferido COM data e não enviado aparece em TELA', () => {
  it('⭐⭐⭐ O CASO DO IVAN: a fila mostra o boleto, com a data', async () => {
    const fila = await parcelasNaoEnviadas(companyId, prisma)
    expect(fila, 'o boleto com data voltou a ficar invisível — o vão do IVAN').toHaveLength(1)
    expect(fila[0].valor).toBe(326.5)
    expect(fila[0].dVenc?.toISOString().slice(0, 10)).toBe('2026-09-14')
    expect(fila[0].enviada).toBe(false)
  })

  it('⭐⭐ e a LISTA da tela o traz, com os ids que o envio precisa', async () => {
    const notas = await notasSemVencimento(companyId, prisma)
    expect(notas, 'a lista de Recebimentos não mostra o boleto').toHaveLength(1)
    expect(notas[0].dVenc?.toISOString().slice(0, 10)).toBe('2026-09-14')
    // ⭐ sem os suggestionIds a linha seria um aviso sem gesto — a porta pintada
    expect(notas[0].suggestionIds).toHaveLength(1)
    expect(notas[0].conferenceId, 'sem conferência não há recibo pra abrir').toBeTruthy()
  })

  it('⭐⭐⭐ O ALARME E A PORTA CONTAM A MESMA COISA — por construção', async () => {
    /**
     * ⛔ É a régua de 13/09 (*"a fila nasce da MESMA pergunta do invariante, pra o e-mail e
     * a tela nunca contarem números diferentes"*) — que existia pro F5 e não pro F3.
     */
    const f3 = (await checkPonteInvariants(prisma, new Date('2026-09-24T12:00:00Z')))
      .filter((f) => f.companyId === companyId && f.invariante === 'F3')
    const fila = await parcelasNaoEnviadas(companyId, prisma)
    expect(f3.length, 'o F3 tem que estar gritando neste cenário').toBe(1)
    expect(fila.length, 'o F3 grita e a fila mostra — nunca um sem o outro').toBe(f3.length)
  })

  it('⭐ e quando o boleto VAI pro financeiro, a fila e o alarme zeram juntos', async () => {
    const sug = await prisma.stockPayableSuggestion.findFirstOrThrow({ where: { companyId } })
    await prisma.stockPayableLink.create({
      data: {
        companyId, origem: 'NFE', refId: nfeId, suggestionId: sug.id, nDup: null,
        chave: sug.chave, transactionId: 'tx-ivan', supplierId: 'sup-ivan',
        valor: 326.5, dVenc: new Date('2026-09-14T00:00:00Z'),
      },
    })
    expect(await parcelasNaoEnviadas(companyId, prisma)).toHaveLength(0)
    expect(await notasSemVencimento(companyId, prisma)).toHaveLength(0)
    const f3 = (await checkPonteInvariants(prisma, new Date('2026-09-24T12:00:00Z')))
      .filter((f) => f.companyId === companyId && f.invariante === 'F3')
    expect(f3).toHaveLength(0)
  })

  it('⛔ e a parcela SEM data continua no domínio do F5 — um caso, um alarme', async () => {
    await prisma.stockPayableSuggestion.updateMany({ where: { companyId }, data: { dVenc: null } })
    const fila = await parcelasNaoEnviadas(companyId, prisma)
    expect(fila).toHaveLength(1)
    expect(fila[0].dVenc, 'sem data é OUTRO trabalho — combinar, não mandar').toBeNull()
    const fails = await checkPonteInvariants(prisma, new Date('2026-09-24T12:00:00Z'))
    const meus = fails.filter((f) => f.companyId === companyId)
    // ⚠️ o MESMO caso em dois alarmes é como se ensina o dono a ignorar os dois (a régua
    // que o F3 já respeitava ao excluir as "A DEFINIR")
    expect(meus.filter((f) => f.invariante === 'F5')).toHaveLength(1)
    expect(meus.filter((f) => f.invariante === 'F3')).toHaveLength(0)
  })
})
