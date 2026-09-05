// ⭐⭐⭐ A NOTA É FATO; A ENTRADA É COMBINADO (05/09/2026) — o caso do LEITE EM PÓ.
//
// **Nota REAL do ALAN SALBEGO, 05/09:**
//
//     cProd 12457 · "LEITE EM PO INTEGRAL AURORA 400G" · 12 KG × 15,99 = 191,88 · trib 12 UN
//
// São **12 latas de 400 g**, não 12 quilos. E a própria nota se contradiz: `uCom = KG`,
// `uTrib = UN` — é daí que sai a sugestão, medida, não chutada.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { confirmarConferencia } from '../confirmar-conferencia'
import { buildConferenceView } from '../conference'
import { avaliarUnidadeDeEntrada, custoNaUnidadeDeEntrada, rastroDaCorrecao } from '../unidade-de-entrada'
import { saldoItem } from '../saldo'

const CNPJ = '08850740000188'
const CNPJ_FORN = '08850740000129'
let companyId = ''
let userId = ''
let nfeId = ''
let itemNfeId = ''
let chave = ''

async function notaDoLeite() {
  chave = `4326${Date.now()}`.padEnd(44, '0')
  const nfe = await prisma.stockNfe.create({
    data: { companyId, chave, status: 'EM_CONFERENCIA', temXmlCompleto: true, vNF: 191.88,
      dataEmissao: new Date('2026-09-05T00:00:00Z'), nsu: `${Date.now()}` },
  })
  const item = await prisma.stockNfeItem.create({
    // ⚠️ os números são os REAIS da nota: 12 KG no comercial, 12 UN no tributário
    data: { companyId, nfeId: nfe.id, chave, nItem: 1, cProd: '12457',
      xProd: 'LEITE EM PO INTEGRAL AURORA 400G', uCom: 'KG', qCom: 12, vUnCom: 15.99, vProd: 191.88,
      uTrib: 'UN', qTrib: 12 },
  })
  await prisma.stockNfeEmit.create({ data: { companyId, nfeId: nfe.id, cnpj: CNPJ_FORN, xNome: 'ALAN SALBEGO DA SILVA' } })
  return { nfeId: nfe.id, itemId: item.id }
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'LEITE' } })).id
  userId = (await prisma.user.create({ data: { email: `leite-${companyId}@t.com`, password: 'x', name: 'Yussef' } })).id
  const n = await notaDoLeite()
  nfeId = n.nfeId; itemNfeId = n.itemId
})

afterEach(async () => {
  for (const t of ['stockUnidadeCorrigida', 'stockPayableSuggestion', 'stockConferenceItem', 'stockReceiptConference',
    'stockMovement', 'stockSaldoCache', 'stockSupplierProduct', 'stockItem', 'stockSupplier',
    'stockNfeEmit', 'stockNfeItem', 'stockNfe'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const confirmar = (unidadeEntrada: string | null) =>
  confirmarConferencia({
    companyId, nfeId, userId,
    fornecedor: { cnpj: CNPJ_FORN, nome: 'ALAN SALBEGO DA SILVA' },
    itens: [{
      nfeItemId: itemNfeId, cProd: '12457', xProd: 'LEITE EM PO INTEGRAL AURORA 400G',
      uCom: 'KG', uTrib: 'UN', qtdNota: 12, vUnCom: 15.99, qtdRecebida: 12,
      unidadeEntrada,
      mapeado: { itemId: '', nome: 'Leite em pó Aurora 400g', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', fatorConversao: 1, novo: true },
    }],
  })

describe('⭐⭐ conferir 12 KG da nota como 12 UN', () => {
  it('⭐⭐ o LEDGER entra 12 UN no item certo, a R$ 15,99 por LATA', async () => {
    await confirmar('UN')
    const item = await prisma.stockItem.findFirstOrThrow({ where: { companyId }, select: { id: true, unidadeControle: true } })
    expect(item.unidadeControle).toBe('UN')
    const mov = await prisma.stockMovement.findFirstOrThrow({ where: { companyId, tipo: 'ENTRADA_NF' } })
    expect(mov.quantidade).toBe(12)
    expect(mov.custoUnitario).toBeCloseTo(15.99, 4)
    expect(mov.custoTotal, 'o valor da nota não muda — só o denominador').toBeCloseTo(191.88, 2)
    expect((await saldoItem(prisma, companyId, item.id)).saldo).toBe(12)
  })

  it('⭐⭐ a NOTA fica como veio — 12 KG, imutável', async () => {
    await confirmar('UN')
    const linha = await prisma.stockNfeItem.findUniqueOrThrow({ where: { id: itemNfeId }, select: { uCom: true, qCom: true, vProd: true } })
    expect(linha.uCom, 'reescreveram o documento fiscal').toBe('KG')
    expect(linha.qCom).toBe(12)
    expect(linha.vProd).toBe(191.88)
  })

  it('⭐⭐ e o RASTRO fica gravado, com quem conferiu', async () => {
    await confirmar('UN')
    const r = await prisma.stockUnidadeCorrigida.findFirstOrThrow({ where: { companyId } })
    expect(r.unidadeNota).toBe('KG')
    expect(r.unidadeEntrada).toBe('UN')
    expect(r.qtdNota).toBe(12)
    expect(r.qtdEntrada).toBe(12)
    expect(r.cProd).toBe('12457')
    expect(r.corrigidoPorId).toBe(userId)
    expect(rastroDaCorrecao(12, 'KG', 12, 'UN', 'Yussef'))
      .toBe('A nota dizia 12 KG; entrada conferida como 12 UN, por Yussef.')
  })

  it('⛔ sem correção, nada é gravado — correção que não corrige não existe', async () => {
    // item em KG, entrada em KG: caminho normal
    await confirmarConferencia({
      companyId, nfeId, userId, fornecedor: { cnpj: CNPJ_FORN, nome: 'ALAN' },
      itens: [{
        nfeItemId: itemNfeId, cProd: '12457', xProd: 'LEITE', uCom: 'KG', uTrib: 'UN',
        qtdNota: 12, vUnCom: 15.99, qtdRecebida: 12, unidadeEntrada: null,
        mapeado: { itemId: '', nome: 'Leite a granel', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', fatorConversao: 1, novo: true },
      }],
    })
    expect(await prisma.stockUnidadeCorrigida.count({ where: { companyId } })).toBe(0)
  })
})

describe('⭐⭐ a próxima nota do mesmo fornecedor APRENDE — e sugere, não decide', () => {
  it('⭐⭐ "da última vez você conferiu como UN — conferir igual?"', async () => {
    await confirmar('UN')
    // a nota seguinte, mesmo fornecedor, mesmo cProd, mesma unidade errada
    const outra = await prisma.stockNfe.create({
      data: { companyId, chave: `4326${Date.now() + 1}`.padEnd(44, '0'), status: 'EM_CONFERENCIA',
        temXmlCompleto: true, vNF: 191.88, dataEmissao: new Date('2026-09-10T00:00:00Z'), nsu: `${Date.now() + 1}` },
    })
    await prisma.stockNfeItem.create({
      data: { companyId, nfeId: outra.id, chave: outra.chave, nItem: 1, cProd: '12457',
        xProd: 'LEITE EM PO INTEGRAL AURORA 400G', uCom: 'KG', qCom: 12, vUnCom: 15.99, vProd: 191.88, uTrib: 'UN', qTrib: 12 },
    })
    await prisma.stockNfeEmit.create({ data: { companyId, nfeId: outra.id, cnpj: CNPJ_FORN, xNome: 'ALAN SALBEGO DA SILVA' } })

    const v = await buildConferenceView(companyId, outra.id, prisma)
    const linha = v!.itens[0]
    expect(linha.correcaoAnterior, 'a correção anterior não foi lembrada').not.toBeNull()
    expect(linha.correcaoAnterior!.unidadeEntrada).toBe('UN')
    expect(linha.sugestaoDeUnidade).toMatch(/última vez/)
    expect(linha.sugestaoDeUnidade).toMatch(/UN/)
    expect(linha.sugestaoDeUnidade, 'sugere, não decide').toMatch(/\?$/)
  })

  it('⭐ e reabrir a NOTA CORRIGIDA mostra a correção — não a esquece', async () => {
    await confirmar('UN')
    const v = await buildConferenceView(companyId, nfeId, prisma)
    expect(v!.itens[0].correcaoAnterior?.unidadeEntrada).toBe('UN')
    expect(v!.itens[0].uCom, 'a nota segue dizendo KG').toBe('KG')
  })
})

describe('⛔⛔ o GUARD do fator continua valendo (item 4 do dono)', () => {
  it('⛔⛔ KG → UN com fator 1 é RECUSADO quando o item é de outra unidade', async () => {
    // entrada em KG (a da nota) contra item controlado em UN, sem fator: bloqueia
    await expect(confirmarConferencia({
      companyId, nfeId, userId, fornecedor: { cnpj: CNPJ_FORN, nome: 'ALAN' },
      itens: [{
        nfeItemId: itemNfeId, cProd: '12457', xProd: 'LEITE', uCom: 'KG', uTrib: 'UN',
        qtdNota: 12, vUnCom: 15.99, qtdRecebida: 12, unidadeEntrada: 'KG',
        mapeado: { itemId: '', nome: 'Leite lata', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', fatorConversao: 0, novo: true },
      }],
    })).rejects.toThrow(/quantos UN tem 1 KG|não dá pra dar entrada/)
    expect(await prisma.stockMovement.count({ where: { companyId } }), 'gravou meia entrada').toBe(0)
  })

  it('⭐ a régua pura: identidade só entre unidades IGUAIS', () => {
    const mesmo = avaliarUnidadeDeEntrada({ unidadeNota: 'KG', unidadeEntrada: 'UN', unidadeItem: 'UN', fator: 1 })
    expect(mesmo.ok).toBe(true)
    expect(mesmo.corrigida).toBe(true)

    const diferente = avaliarUnidadeDeEntrada({ unidadeNota: 'KG', unidadeEntrada: 'KG', unidadeItem: 'UN', fator: null })
    expect(diferente.ok, 'fator 1 silencioso entre KG e UN').toBe(false)
    expect(diferente.bloqueio).toMatch(/quantos UN tem 1 KG/)

    const comFator = avaliarUnidadeDeEntrada({ unidadeNota: 'CX', unidadeEntrada: 'CX', unidadeItem: 'UN', fator: 12 })
    expect(comFator.ok).toBe(true)
  })

  it('⭐ a sugestão sai da própria nota (uCom × uTrib), com o motivo à vista', () => {
    const a = avaliarUnidadeDeEntrada({ unidadeNota: 'KG', unidadeTributaria: 'UN', unidadeItem: 'UN', fator: 1 })
    expect(a.sugestao).toMatch(/TRIBUTÁRIA/)
    expect(a.sugestao).toMatch(/UN/)
    // ⛔ e não sugere nada quando a nota é coerente
    expect(avaliarUnidadeDeEntrada({ unidadeNota: 'UN', unidadeTributaria: 'UN', unidadeItem: 'UN', fator: 1 }).sugestao).toBeNull()
  })

  it('⭐ o custo: o denominador muda, o valor da nota nunca', () => {
    expect(custoNaUnidadeDeEntrada(15.99, 1)).toBeCloseTo(15.99, 4)   // 191,88 ÷ 12 latas
    expect(custoNaUnidadeDeEntrada(15.99, 2)).toBeCloseTo(7.995, 4)   // 24 latas nos mesmos "12 KG"
    expect(12 * 2 * custoNaUnidadeDeEntrada(15.99, 2)).toBeCloseTo(191.88, 2)
  })
})
