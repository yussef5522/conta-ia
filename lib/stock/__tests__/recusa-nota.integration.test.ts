// ⭐⭐ RECUSAR NOTA — a que não chegou, a devolvida na porta, a que não é minha (04/09/2026).
//
// ⛔ NÃO É EXCLUIR: a nota existe na SEFAZ contra o CNPJ do dono. Apagar perderia o rastro de
// um documento que continua valendo lá fora.
//
// ⭐ O ESTADO É DERIVADO (`idsRecusados`), nunca um `status` novo na nota — a lição da ficha
// arquivada de 01/09: com `status` gravado, cada tela precisa lembrar de filtrar, e uma
// esquece. Aqui os quatro leitores (fila, card, juiz, cron da Ciência) herdam a mesma régua.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { recusarNota, reabrirNota, listarRecusadas, previewDaRecusa, idsRecusados, RecusaError, TP_EVENTO_POR_MOTIVO } from '../recusa-nota'
import { listRecebimentos } from '../sefaz/recebimentos'
import { checkNfeInvariants } from '../nfe-invariants'

const CNPJ = '77889900000166'
let companyId = ''
let userId = ''
let nfeId = ''
let chave = ''

async function notaNaFila(vNF = 15000, comXml = true) {
  const c = `4126${Date.now()}${Math.floor(Math.random() * 1000)}`.padEnd(44, '0').slice(0, 44)
  const n = await prisma.stockNfe.create({
    data: {
      companyId, chave: c, status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: comXml,
      vNF, dataEmissao: new Date('2026-08-31T00:00:00Z'), nsu: `${Date.now()}${Math.random()}`.slice(0, 15),
      criadoEm: new Date(Date.now() - 3 * 86_400_000), // velha o bastante pro E10 morder
    },
  })
  await prisma.stockNfeEmit.create({ data: { companyId, nfeId: n.id, xNome: 'TVG COMERCIO DE PECAS', cnpj: '06982344000120' } })
  return n
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'RECUSA' } })).id
  userId = (await prisma.user.create({ data: { email: `recusa-${companyId}@t.com`, password: 'x', name: 'Yussef' } })).id
  const n = await notaNaFila()
  nfeId = n.id; chave = n.chave
})

afterEach(async () => {
  for (const t of ['stockNfeRecusa', 'stockPayableLink', 'stockPayableSuggestion', 'stockMovement',
    'stockSaldoCache', 'stockItem', 'stockNfeEmit', 'stockNfeItem', 'stockNfe'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ recusar tira da fila e não mexe em nada', () => {
  it('⭐⭐ some da FILA e dos cards, com ZERO movimento e ZERO conta a pagar', async () => {
    const antes = await listRecebimentos(companyId, prisma)
    expect(antes.fila.some((f) => f.id === nfeId)).toBe(true)

    await recusarNota({ companyId, nfeId, motivo: 'NAO_CHEGOU', observacao: 'nunca veio', userId }, prisma)

    const depois = await listRecebimentos(companyId, prisma)
    expect(depois.fila.some((f) => f.id === nfeId), 'a nota recusada continuou na fila').toBe(false)
    expect(depois.fila).toHaveLength(antes.fila.length - 1)
    // ⛔ o ledger e o contas a pagar seguem intocados
    expect(await prisma.stockMovement.count({ where: { companyId } })).toBe(0)
    expect(await prisma.stockPayableSuggestion.count({ where: { companyId } })).toBe(0)
  })

  it('⭐⭐ o JUIZ para de vigiar (E10 não cobra XML de nota contestada)', async () => {
    const semXml = await notaNaFila(15000, false)
    const antes = (await checkNfeInvariants(prisma)).filter((f) => f.companyId === companyId)
    expect(antes.some((f) => f.detalhe.includes(semXml.chave.slice(-8))) || antes.length > 0).toBe(true)

    await recusarNota({ companyId, nfeId: semXml.id, motivo: 'NAO_E_MINHA', userId }, prisma)
    const depois = (await checkNfeInvariants(prisma)).filter((f) => f.companyId === companyId)
    expect(depois.length, 'o juiz continuou cobrando a nota recusada').toBeLessThan(antes.length)
  })

  it('⭐ a nota NÃO some do sistema — vai pra "Recusadas" com quem/quando/por quê', async () => {
    await recusarNota({ companyId, nfeId, motivo: 'RECUSADA_NA_ENTREGA', observacao: 'veio errada, devolvi na porta', userId }, prisma)
    const lista = await listarRecusadas(companyId, prisma)
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({
      nfeId, motivo: 'RECUSADA_NA_ENTREGA', observacao: 'veio errada, devolvi na porta',
      recusadaPorNome: 'Yussef', fornecedor: 'TVG COMERCIO DE PECAS', valor: 15000,
    })
    // ⚠️ e a nota em si continua no banco: o documento existe na SEFAZ
    expect(await prisma.stockNfe.count({ where: { id: nfeId } })).toBe(1)
  })

  it('⚠️ o tpEvento fica ANOTADO, e nada é enviado à SEFAZ', async () => {
    await recusarNota({ companyId, nfeId, motivo: 'NAO_E_MINHA', userId }, prisma)
    const lista = await listarRecusadas(companyId, prisma)
    expect(lista[0].tpEventoSugerido).toBe('210220') // Desconhecimento — ainda sem builder
    expect(TP_EVENTO_POR_MOTIVO.NAO_CHEGOU).toBe('210240')
    // ⛔ recusar NÃO manifesta: prazo legal e efeito fiscal são decisão do dono + contador
    expect(await prisma.stockSefazEvent.count({ where: { companyId } })).toBe(0)
  })

  it('⛔ recusar duas vezes não cria a segunda (idempotente)', async () => {
    const a = await recusarNota({ companyId, nfeId, motivo: 'NAO_CHEGOU', userId }, prisma)
    const b = await recusarNota({ companyId, nfeId, motivo: 'NAO_CHEGOU', userId }, prisma)
    expect(b.recusaId).toBe(a.recusaId)
    expect(await prisma.stockNfeRecusa.count({ where: { companyId, nfeId } })).toBe(1)
  })
})

describe('⭐⭐ reabrir devolve pra fila, com rastro nos dois sentidos', () => {
  it('⭐⭐ a mercadoria apareceu depois → volta pra fila', async () => {
    await recusarNota({ companyId, nfeId, motivo: 'NAO_CHEGOU', userId }, prisma)
    expect((await listRecebimentos(companyId, prisma)).fila.some((f) => f.id === nfeId)).toBe(false)

    await reabrirNota(companyId, nfeId, 'chegou com 10 dias de atraso', userId, prisma)
    expect((await listRecebimentos(companyId, prisma)).fila.some((f) => f.id === nfeId), 'não voltou pra fila').toBe(true)
    expect(await listarRecusadas(companyId, prisma)).toHaveLength(0)
  })

  it('⭐ e o rastro dos DOIS sentidos fica no mesmo registro', async () => {
    await recusarNota({ companyId, nfeId, motivo: 'NAO_CHEGOU', observacao: 'nunca veio', userId }, prisma)
    await reabrirNota(companyId, nfeId, 'apareceu', userId, prisma)
    const r = await prisma.stockNfeRecusa.findFirstOrThrow({ where: { companyId, nfeId } })
    expect(r.motivo).toBe('NAO_CHEGOU')
    expect(r.observacao).toBe('nunca veio')
    expect(r.reaberturaMotivo).toBe('apareceu')
    expect(r.reabertaEm).not.toBeNull()
  })

  it('⭐ e dá pra recusar de novo depois de reabrir (o índice único é só da ATIVA)', async () => {
    await recusarNota({ companyId, nfeId, motivo: 'NAO_CHEGOU', userId }, prisma)
    await reabrirNota(companyId, nfeId, null, userId, prisma)
    await recusarNota({ companyId, nfeId, motivo: 'RECUSADA_NA_ENTREGA', userId }, prisma)
    expect(await prisma.stockNfeRecusa.count({ where: { companyId, nfeId } })).toBe(2)
    expect((await listarRecusadas(companyId, prisma))[0].motivo).toBe('RECUSADA_NA_ENTREGA')
  })

  it('⛔ reabrir o que não está recusado é recusado com mensagem', async () => {
    await expect(reabrirNota(companyId, nfeId, null, userId, prisma)).rejects.toThrow(RecusaError)
  })
})

describe('⛔⛔ nada de meia-recusa', () => {
  it('⛔⛔ nota que JÁ virou conta a pagar é BLOQUEADA, com a saída na mensagem', async () => {
    const sug = await prisma.stockPayableSuggestion.create({
      data: { companyId, nfeId, chave, supplierNome: 'TVG', nDup: null, dVenc: new Date('2026-09-20T00:00:00Z'), valor: 15000 },
    })
    await prisma.stockPayableLink.create({
      data: { companyId, origem: 'NFE', refId: nfeId, suggestionId: sug.id, nDup: null, chave, transactionId: 'tx-9', supplierId: 's-9', valor: 15000, dVenc: new Date('2026-09-20T00:00:00Z') },
    })

    const prev = await previewDaRecusa(companyId, nfeId, prisma)
    expect(prev.bloqueio, 'deixou recusar nota que já é obrigação no financeiro').toBeTruthy()
    expect(prev.bloqueio).toMatch(/Cancele a conta lá primeiro/)
    await expect(recusarNota({ companyId, nfeId, motivo: 'NAO_CHEGOU', userId }, prisma)).rejects.toThrow(RecusaError)
    // ⛔ e nada foi tocado
    expect(await prisma.stockPayableSuggestion.count({ where: { companyId } })).toBe(1)
    expect(await idsRecusados(prisma, companyId)).toEqual(new Set())
  })

  it('⭐⭐ sugestão A_DEFINIR ainda no estoque é REMOVIDA junto', async () => {
    await prisma.stockPayableSuggestion.create({
      data: { companyId, nfeId, chave, supplierNome: 'TVG', nDup: null, dVenc: null, valor: 15000 },
    })
    const prev = await previewDaRecusa(companyId, nfeId, prisma)
    expect(prev.sugestoes).toBe(1)
    expect(prev.bloqueio).toBeNull()

    const r = await recusarNota({ companyId, nfeId, motivo: 'NAO_E_MINHA', userId }, prisma)
    expect(r.sugestoesRemovidas).toBe(1)
    expect(await prisma.stockPayableSuggestion.count({ where: { companyId } })).toBe(0)
  })

  it('⭐⭐ movimento de entrada vira ESTORNO — nunca DELETE', async () => {
    const item = await prisma.stockItem.create({ data: { companyId, nome: 'MAQUINA', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
    await prisma.stockMovement.create({
      data: { companyId, itemId: item.id, tipo: 'ENTRADA_NF', quantidade: 1, custoUnitario: 15000, custoTotal: 15000, nfeChave: chave, origem: 'SEFAZ' },
    })
    const r = await recusarNota({ companyId, nfeId, motivo: 'RECUSADA_NA_ENTREGA', userId }, prisma)
    expect(r.estornou).toBe(1)
    // ⚠️ o ledger é IMUTÁVEL: a entrada continua lá, com o estorno ao lado
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'ENTRADA_NF' } })).toBe(1)
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'ESTORNO' } })).toBe(1)
  })
})

describe('⛔⛔ a TRAVA NA FONTE da lista de boletos (04/09)', () => {
  it('⛔⛔ nota NÃO CONFERIDA não vira dívida aprovável, nem com sugestão existindo', async () => {
    // ⚠️ hoje isso já era verdade POR ACIDENTE (sugestão só nasce na conferência). O teste
    // força o estado impossível pra provar que agora é verdade POR DESENHO.
    await prisma.stockPayableSuggestion.create({
      data: { companyId, nfeId, chave, supplierNome: 'TVG', nDup: null, dVenc: new Date('2026-09-20T00:00:00Z'), valor: 15000 },
    })
    const { listarPendentes } = await import('../ponte-contas-pagar')
    expect(await prisma.stockNfe.findUniqueOrThrow({ where: { id: nfeId }, select: { status: true } }))
      .toMatchObject({ status: 'AGUARDANDO_MERCADORIA' })
    expect(await listarPendentes(companyId, prisma), 'mercadoria não conferida entrou na lista de aprovação').toHaveLength(0)
  })

  it('⛔ e nota RECUSADA também não aparece, mesmo conferida', async () => {
    await prisma.stockNfe.update({ where: { id: nfeId }, data: { status: 'CONFIRMADA' } })
    await prisma.stockPayableSuggestion.create({
      data: { companyId, nfeId, chave, supplierNome: 'TVG', nDup: null, dVenc: new Date('2026-09-20T00:00:00Z'), valor: 15000 },
    })
    const { listarPendentes } = await import('../ponte-contas-pagar')
    expect(await listarPendentes(companyId, prisma)).toHaveLength(1)
    await recusarNota({ companyId, nfeId, motivo: 'NAO_E_MINHA', userId }, prisma)
    expect(await listarPendentes(companyId, prisma)).toHaveLength(0)
  })
})
