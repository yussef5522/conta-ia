// ⛔⛔⛔ CRÉDITO NUNCA VÊ A FILA DE CONTAS A PAGAR (15/09/2026)
//
// **A régua, palavras do dono:** *"crédito não se casa com dívida; o SENTIDO da linha tem
// que decidir o caminho ANTES de qualquer fila."*
//
// ⛔ **O DEFEITO QUE A CRIOU, medido em prod:** o `LINHA_DISPONIVEL_WHERE` filtrava onze
// coisas (cartão, empréstimo, transferência, ignorada…) e **não filtrava sentido**. A fila
// de *"casar com conta a pagar"* tinha **6.555 linhas, 5.705 delas CRÉDITO — 87%**. O PIX
// de venda de R$ 308,50 do dono estava ali, junto de `ANTECIP STONE`.
//
// ⚠️ **ESTE GUARD RODA CONTRA BANCO**, de propósito: a trava é uma cláusula de QUERY, e
// afirmar que ela existe lendo a fonte é medir a menção, não o efeito (a lição de 12/09 e
// a que me pegou hoje no `acaoValePraSentido`). Aqui a pergunta é feita ao Prisma.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { LINHA_DISPONIVEL_WHERE } from '@/lib/conciliacao/fila-de-conciliacao'

const SUFIXO = 'guard-credito-fila'
let companyId = ''
let contaId = ''

beforeAll(async () => {
  const company = await prisma.company.create({
    data: { name: `Empresa ${SUFIXO}`, cnpj: `99${Date.now()}`.slice(0, 14) },
  })
  companyId = company.id
  const conta = await prisma.bankAccount.create({
    data: { companyId, name: `conta ${SUFIXO}`, balance: 0 },
  })
  contaId = conta.id

  // ⭐ o par que reproduz o caso real: a MESMA forma, os DOIS sentidos
  await prisma.transaction.createMany({
    data: [
      {
        bankAccountId: contaId, type: 'DEBIT', amount: 308.5, date: new Date('2026-09-10T12:00:00Z'),
        description: 'PAGAMENTO FORNECEDOR', origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING',
      },
      {
        // ⛔ este é o PIX de venda que vivia na fila de PAGAR
        bankAccountId: contaId, type: 'CREDIT', amount: 308.5, date: new Date('2026-09-10T12:00:00Z'),
        description: 'RECEBIMENTO PIX', origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING',
      },
    ],
  })
})

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { bankAccount: { companyId } } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⛔ a fila de PAGAR só enxerga dinheiro que SAIU', () => {
  it('⭐ o débito entra e o crédito NÃO — medido na query, não na fonte', async () => {
    const linhas = await prisma.transaction.findMany({
      where: { ...LINHA_DISPONIVEL_WHERE, bankAccount: { companyId } },
      select: { type: true, description: true },
    })

    expect(linhas).toHaveLength(1)
    expect(linhas[0]!.type).toBe('DEBIT')
    expect(
      linhas.filter((l) => l.type === 'CREDIT'),
      'o PIX de venda voltou pra fila de casar com conta a pagar',
    ).toEqual([])
  })

  /**
   * ⚠️ A TRAVA ANTIGA NÃO SE PERDEU. `'DEBIT'` exclui `TRANSFER` **por construção** (é o
   * terceiro valor do enum) — o guard afirma isso executando, pra ninguém "restaurar" o
   * `not: 'TRANSFER'` achando que a proteção sumiu.
   */
  it('⭐ transferência continua fora — agora por construção', async () => {
    const t = await prisma.transaction.create({
      data: {
        bankAccountId: contaId, type: 'TRANSFER', transferDirection: 'OUT', amount: 50,
        date: new Date('2026-09-10T12:00:00Z'), description: `transf ${SUFIXO}`,
        origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING',
      },
    })
    const linhas = await prisma.transaction.findMany({
      where: { ...LINHA_DISPONIVEL_WHERE, bankAccount: { companyId } },
      select: { id: true },
    })
    expect(linhas.map((l) => l.id)).not.toContain(t.id)
  })
})
