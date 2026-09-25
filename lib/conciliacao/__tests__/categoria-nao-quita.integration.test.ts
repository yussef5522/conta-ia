/**
 * ⭐⭐⭐ "CATEGORIZADA" SÓ É DESFECHO PRA QUEM NÃO TEM NOTA (25/09/2026) — decisão do dono.
 *
 * **O achado do mapa do problema 3:** 68 saídas arquivadas só com categoria, das quais **18
 * (R$ 16.201,01) são de fornecedor que emite nota** — DOCEOLI 5.234,88, as duas do CASPER de
 * 04/09, DIVINE, CEREALISTA, E-CAIXAS, frete. ***Dinheiro que saiu, não baixou conta a pagar
 * nenhuma, fora da caixa e sem ninguém cobrando.***
 *
 * ⚠️ REGRA 3: roda o `resolverLinha` REAL e a leitura REAL da caixa contra o banco.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { lerCaixa, paraLei } from '../leitura-da-caixa'
import { estacaoDaLinha, comoFoiResolvida, acoesDoSentido } from '../caixa-de-entrada'
import { resolverLinha } from '../resolver-linha'
import { categoriaResolveSozinha, GRUPOS_QUE_A_CATEGORIA_RESOLVE, SELO_AVULSA_CONFIRMADA } from '../categoria-nao-quita'

const CNPJ = '50607080001466' // ⚠️ exclusivo deste arquivo
let companyId = ''
let contaId = ''
let catSalario = ''
let catFornecedor = ''
let linhaId = ''
let userId = ''

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const co = await prisma.company.create({ data: { name: 'categoria-nao-quita', cnpj: CNPJ }, select: { id: true } })
  companyId = co.id
  contaId = (await prisma.bankAccount.create({ data: { companyId, name: 'stone', bankCode: '197', balance: 0 }, select: { id: true } })).id
  catSalario = (await prisma.category.create({ data: { companyId, name: 'Salários', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL' }, select: { id: true } })).id
  catFornecedor = (await prisma.category.create({ data: { companyId, name: 'Matéria-Prima - Alimentos', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO' }, select: { id: true } })).id
  /**
   * ⚠️ USUÁRIO DE VERDADE (a cicatriz de 23/09): o `auditLog` tem **FK pro User**, então um
   * id inventado passa no TypeScript e **estoura no banco** — e como o rastro é fail-soft,
   * ele estouraria em SILÊNCIO. Foi exatamente assim que este teste ficou vermelho.
   */
  userId = (await prisma.user.create({ data: { email: `cat-quita-${CNPJ}@teste.local`, name: 'Yussef', password: 'x' }, select: { id: true } })).id
})

afterAll(async () => {
  await prisma.conciliacaoAvulsaConfirmada.deleteMany({ where: { companyId } })
  await prisma.transaction.deleteMany({ where: { bankAccountId: contaId } })
  await prisma.category.deleteMany({ where: { companyId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.auditLog.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.user.deleteMany({ where: { id: userId } })
})

/** a linha do DIVINE: R$ 933,39 de 23/09, categorizada como mercadoria e SEM vínculo */
beforeEach(async () => {
  await prisma.conciliacaoAvulsaConfirmada.deleteMany({ where: { companyId } })
  await prisma.transaction.deleteMany({ where: { bankAccountId: contaId } })
  const t = await prisma.transaction.create({
    data: {
      bankAccountId: contaId, description: 'DIVINE ALIMENTOS LTDA - Pagamento',
      amount: 933.39, type: 'DEBIT', date: new Date('2026-09-23T12:00:00.000Z'),
      origin: 'OFX', lifecycle: 'EFFECTED', status: 'RECONCILED', categoryId: catFornecedor,
    },
    select: { id: true },
  })
  linhaId = t.id
})

const naCaixa = async () => {
  const { rows } = await lerCaixa(companyId, prisma)
  const r = rows.find((x) => x.id === linhaId)
  return r ? estacaoDaLinha(paraLei(r)) === 'CAIXA' : false
}
const selo = async () => {
  const { rows } = await lerCaixa(companyId, prisma)
  const r = rows.find((x) => x.id === linhaId)
  return r ? comoFoiResolvida(paraLei(r)) : 'linha não encontrada'
}

describe('⛔⛔ a linha de FORNECEDOR não arquiva só com categoria', () => {
  it('⭐⭐⭐ O CASO DO DIVINE: categorizada como mercadoria → FICA na caixa', async () => {
    expect(await naCaixa(), 'a linha de fornecedor voltou a arquivar só com categoria').toBe(true)
    expect(await selo()).toBeNull()
  })

  it('⭐⭐ e a de SALÁRIO arquiva como sempre — a régua não virou parede', async () => {
    await prisma.transaction.update({ where: { id: linhaId }, data: { categoryId: catSalario } })
    expect(await naCaixa(), 'salário não tem boleto pra casar — cobrar vínculo aqui é parede').toBe(false)
    expect(await selo()).toBe('categorizada')
  })

  it('⛔⛔ categoria SEM dreGroup não resolve — ausência nunca é "pode arquivar"', async () => {
    /**
     * ⚠️ É a lição do `?? 'CAIXA'` que sumiu com o CASPER em 20/09: **default que resolve é
     * default que esconde**. Categoria sem grupo é configuração incompleta.
     */
    const semGrupo = await prisma.category.create({ data: { companyId, name: 'Sem grupo', type: 'EXPENSE' }, select: { id: true } })
    await prisma.transaction.update({ where: { id: linhaId }, data: { categoryId: semGrupo.id } })
    expect(await naCaixa()).toBe(true)
    await prisma.category.delete({ where: { id: semGrupo.id } })
  })

  it('⛔ e a A_CLASSIFICAR nunca resolve — ela é o balde de "ninguém sabe"', () => {
    expect(categoriaResolveSozinha('A_CLASSIFICAR')).toBe(false)
    expect(GRUPOS_QUE_A_CATEGORIA_RESOLVE).not.toContain('A_CLASSIFICAR')
  })

  it('⛔⛔ grupo NOVO cai no lado que EXIGE vínculo (lista fechada, erro seguro)', () => {
    expect(categoriaResolveSozinha('GRUPO_QUE_ALGUEM_INVENTAR_AMANHA')).toBe(false)
  })
})

describe('⭐⭐ a saída honesta: "é despesa avulsa — não tem nota"', () => {
  it('⭐⭐⭐ o gesto ARQUIVA com selo PRÓPRIO, e grava quem decidiu', async () => {
    const r = await resolverLinha({ companyId, txId: linhaId, acao: 'AVULSA_CONFIRMADA', userId, motivoLivre: 'compra anterior ao sistema' }, prisma)
    expect(r.saiuDaCaixa).toBe(true)
    expect(await naCaixa(), 'a confirmação do dono não fechou o caso — o aviso vira beco').toBe(false)
    /**
     * ⛔ Selo PRÓPRIO, nunca reusando *"categorizada"*: misturar *"o dono disse que não tem
     * nota"* com *"ninguém olhou ainda"* é exatamente o que escondeu os R$ 16.201,01.
     */
    /**
     * ⚠️⚠️ A 1ª VERSÃO DESTA ASSERÇÃO NÃO MORDIA: ela comparava `selo()` com a própria
     * constante `SELO_AVULSA_CONFIRMADA` — trocar a constante pra `'categorizada'` mudava os
     * DOIS lados e o teste passava verde. **Tautologia**, a família do *"menção, não uso"*.
     * O que morde é o LITERAL, e a afirmação de que ele é DIFERENTE do outro selo.
     */
    expect(await selo()).toBe('avulsa confirmada')
    expect(SELO_AVULSA_CONFIRMADA, 'o selo da decisão do dono voltou a se misturar com "categorizada"')
      .not.toBe('categorizada')
    const dec = await prisma.conciliacaoAvulsaConfirmada.findUniqueOrThrow({ where: { transactionId: linhaId } })
    expect(dec.confirmadoPorId, 'decisão sem autor é a mesma coisa que silêncio').toBe(userId)
    expect(dec.motivo).toBe('compra anterior ao sistema')
  })

  it('⭐ confirmar duas vezes é o dono clicando duas vezes, não um erro', async () => {
    await resolverLinha({ companyId, txId: linhaId, acao: 'AVULSA_CONFIRMADA', userId }, prisma)
    await resolverLinha({ companyId, txId: linhaId, acao: 'AVULSA_CONFIRMADA', userId }, prisma)
    expect(await prisma.conciliacaoAvulsaConfirmada.count({ where: { transactionId: linhaId } })).toBe(1)
  })

  it('⛔⛔ e CONCILIAR é a outra saída — ela também tira da caixa', async () => {
    // simula o vínculo (o gesto real é o CASAR_PAGAR, provado em outro arquivo)
    const nota = await prisma.transaction.create({
      data: { description: 'DIVINE — NF 123', amount: 933.39, type: 'DEBIT', date: new Date('2026-09-20T00:00:00Z'), lifecycle: 'EFFECTED', status: 'RECONCILED', origin: 'ESTOQUE_NF', reconciledWithId: linhaId },
      select: { id: true },
    })
    expect(await naCaixa()).toBe(false)
    expect(await selo()).toBe('conciliada com conta')
    await prisma.transaction.delete({ where: { id: nota.id } })
  })

  it('⭐ o gesto é oferecido na SAÍDA e não na entrada — crédito não paga nota', () => {
    expect(acoesDoSentido('SAIDA').some((a) => a.acao === 'AVULSA_CONFIRMADA')).toBe(true)
    expect(acoesDoSentido('ENTRADA').some((a) => a.acao === 'AVULSA_CONFIRMADA')).toBe(false)
  })
})

describe('⭐⭐ A AUDITORIA DA CAIXA — dá pra saber QUEM produziu o estado', () => {
  it('⭐⭐⭐ todo gesto da caixa grava evento com o id da LINHA', async () => {
    /**
     * **O buraco medido no mapa:** as 2 linhas do CASPER de 21/09 estavam conciliadas e a
     * auditoria tinha **0 eventos pelo id da linha** — o dono ficou sem saber se tinha sido
     * ele às 00:27.
     */
    const ctx = {
      user: { id: userId, name: 'Yussef', email: 'y@y.y' },
      company: { id: companyId },
      role: { id: 'r', name: 'OWNER', isSystemDefault: true },
      permissions: ['*'], requirePermission: () => {},
    } as never
    await resolverLinha({ companyId, txId: linhaId, acao: 'AVULSA_CONFIRMADA', userId, authCtx: ctx }, prisma)
    const aud = await prisma.auditLog.findMany({ where: { companyId, entityId: linhaId } })
    expect(aud, 'o gesto da caixa voltou a não deixar rastro').toHaveLength(1)
    const m = JSON.parse(String(aud[0].metadata ?? '{}'))
    expect(m.gesto).toBe('AVULSA_CONFIRMADA')
    expect(m.origem).toBe('caixa-de-entrada')
    expect(m.efeito).toContain('avulsa')
    expect(aud[0].userName).toBe('Yussef')
    await prisma.auditLog.deleteMany({ where: { companyId } })
  })

  it('⛔ e o rastro é FAIL-SOFT — sem contexto o gesto ainda grava', async () => {
    // ⚠️ rastro que derruba o gesto seria pior que rastro nenhum
    const r = await resolverLinha({ companyId, txId: linhaId, acao: 'IGNORAR' }, prisma)
    expect(r.saiuDaCaixa).toBe(true)
  })
})
