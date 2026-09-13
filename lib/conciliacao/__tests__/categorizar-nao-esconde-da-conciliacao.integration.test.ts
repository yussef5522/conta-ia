// ⭐⭐⭐ "CATEGORIZAR NÃO REMOVE DA CONCILIAÇÃO" — a prova da dúvida (13/09/2026).
//
// **O dono:** *"se a medição achar qualquer caminho onde categoria esconde linha da fila,
// aí está o teu bug de verdade — categoria e conciliação NUNCA se estragam."*
//
// ⛔ A DÚVIDA TEM HISTÓRIA: a fila VELHA era `origin=OFX + NEEDS_REVIEW` (que exige
// `categoryId IS NULL`) — **a linha saía da fila pra sempre no instante em que ganhava
// categoria, mesmo com a conta aberta.** O `LINHA_DISPONIVEL_WHERE` de 07/09 nasceu sem
// `categoryId` DE PROPÓSITO, e este teste é o que impede alguém de "otimizar" e trazer o
// filtro de volta.
//
// ⚠️ **E ele EXECUTA o caminho** (REGRA 3): categoriza de verdade, e roda as MESMAS
// funções que a tela chama. Um grep por `categoryId` na fonte não distinguiria "não
// filtra" de "filtra noutro lugar".

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { LINHA_DISPONIVEL_WHERE, contasEsperandoPagamento, lotesDaFila } from '../fila-de-conciliacao'

const CNPJ = '50607080000515'
const CNPJ_FORN = '88728027000149'
let companyId = ''
let contaId = ''
let supplierId = ''
let categoryId = ''
let linhaId = ''
let notaId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA CATEG' } })).id
  contaId = (await prisma.bankAccount.create({ data: { companyId, name: 'stone', bankName: 'Stone' } })).id
  supplierId = (await prisma.supplier.create({ data: { companyId, razaoSocial: 'FOCATTO DISTRIBUIDORA DE ALIMENTOS LTDA', cnpj: CNPJ_FORN } })).id
  categoryId = (await prisma.category.create({ data: { companyId, name: 'Matéria-Prima - Alimentos', type: 'EXPENSE' } })).id

  // a linha do extrato: dinheiro que saiu, sem vínculo nenhum
  linhaId = (await prisma.transaction.create({
    data: {
      description: 'FOCATTO DISTRIBUIDORA A L ME - Pagamento', amount: -2528.31,
      date: new Date('2026-09-08'), type: 'DEBIT', lifecycle: 'EFFECTED', status: 'PENDING',
      origin: 'OFX', bankAccountId: contaId,
    },
  })).id
  // a conta a pagar que ela quita
  notaId = (await prisma.transaction.create({
    data: {
      description: 'FOCATTO — NF 1240679', amount: 2459.76, date: new Date('2026-09-04'),
      dueDate: new Date('2026-09-04'), type: 'DEBIT', lifecycle: 'PAYABLE', status: 'PENDING',
      origin: 'ESTOQUE_NF', supplierId,
    },
  })).id
})

afterEach(async () => {
  await prisma.transaction.deleteMany({ where: { OR: [{ bankAccount: { companyId } }, { supplier: { companyId } }, { category: { companyId } }] } })
  await prisma.category.deleteMany({ where: { companyId } })
  await prisma.supplier.deleteMany({ where: { companyId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** o gesto REAL de categorizar: categoria + status RECONCILED (a escada do PJ) */
const categorizar = () => prisma.transaction.update({
  where: { id: linhaId }, data: { categoryId, status: 'RECONCILED' },
})

const linhaEstaDisponivel = async () =>
  (await prisma.transaction.count({ where: { id: linhaId, ...LINHA_DISPONIVEL_WHERE } })) === 1

describe('⛔⛔ categorizar NÃO tira a linha da conciliação', () => {
  it('⭐⭐ antes E depois de categorizar, a linha continua DISPONÍVEL pra casar', async () => {
    expect(await linhaEstaDisponivel(), 'a linha já nasce fora da fila').toBe(true)
    await categorizar()
    // ⭐ é este o coração: ter categoria NÃO quita conta nenhuma
    expect(await linhaEstaDisponivel(), 'ganhar categoria escondeu a linha').toBe(true)
  })

  it('⭐⭐ e a CONTA continua sendo oferecida com a sugestão — pelo caminho real', async () => {
    await categorizar()
    const contas = await contasEsperandoPagamento(companyId, prisma)
    const a = contas.find((c) => c.conta.id === notaId)
    expect(a, 'a conta sumiu da fila depois de a linha ganhar categoria').toBeDefined()
    // ⚠️ a diferença de 68,55 é 2,7% da linha → degrau PERGUNTA: aparece, e fecha com o
    // dono nomeando o juros. O que este teste trava é ela APARECER.
    expect(a!.sugestoes.length).toBeGreaterThan(0)
    expect(a!.sugestoes[0].extrato.id).toBe(linhaId)
  })

  it('⭐ o motor de LOTE também não a perde', async () => {
    const antes = await lotesDaFila(companyId, prisma)
    await categorizar()
    const depois = await lotesDaFila(companyId, prisma)
    const ids = (f: { naoFecham: { extratoId: string }[] }) => f.naoFecham.map((x) => x.extratoId)
    expect(ids(depois), 'o lote esqueceu a linha categorizada').toEqual(ids(antes))
  })

  it('⛔⛔ o CONTRAFACTUAL: a régua velha (categoryId IS NULL) escondia a linha', async () => {
    // ⚠️ é ele que dá sentido aos três de cima — sem o contrafactual eles passariam
    // verdes num mundo onde nada nunca filtrou por categoria, e ninguém saberia que a
    // régua velha existia e era exatamente esta.
    await categorizar()
    const comReguaVelha = await prisma.transaction.count({
      where: { id: linhaId, ...LINHA_DISPONIVEL_WHERE, categoryId: null },
    })
    expect(comReguaVelha, 'a régua velha deixaria a linha passar — então ela não era o bug').toBe(0)
  })

  it('⭐⭐ o que TIRA da fila é CONCILIAR — e só isso', async () => {
    await categorizar()
    expect(await linhaEstaDisponivel()).toBe(true)
    await prisma.transaction.update({ where: { id: notaId }, data: { reconciledWithId: linhaId, lifecycle: 'EFFECTED', status: 'RECONCILED' } })
    // ⭐ agora sim: a linha tem dono, e oferecê-la de novo seria o mesmo dinheiro 2×
    expect(await linhaEstaDisponivel(), 'linha conciliada continua sendo oferecida').toBe(false)
  })
})
