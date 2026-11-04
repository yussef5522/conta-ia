/**
 * ⭐⭐⭐ O CARD DOS R$ 408,65 SUMIU — CONTRA BANCO (04/11/2026)
 *
 * ⚠️⚠️ **POR QUE INTEGRAÇÃO, e por que o teste puro da régua NÃO BASTA:** o `select` da
 * fila não trazia `bankAccount.accountType` nem `categoryId`. Com a régua nova e o select
 * velho, `situacao-da-conta.test.ts` fica **todo verde** e a tela **continua mentindo** —
 * `accountType` chegaria `undefined` e toda conta paga voltaria pra `DUPLA_CONTAGEM`. *A
 * régua só vale se os fatos chegarem até ela.* É a "porta sem maçaneta" com o select no
 * lugar do botão.
 *
 * **A fixture é o caso real, com os campos PREENCHIDOS** (medido em prod em 04/11):
 *   conta `caixa loja/cofre` · `accountType='CASH'` · `cashKind='MAIN'` · 0 tx de extrato
 *   tx `ESTOQUE_NF` / `EFFECTED` / **408,65** / E.M.S. / categoria `Matéria-Prima - Alimentos`
 *
 * ⛔ Nenhuma asserção aqui é sobre campo zerado: valor 408,65, categoria com id de verdade e
 * `accountType` declarado — *campo zerado passa verde com a régua certa E com a errada*.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { contasEsperandoPagamento, filaDeConciliacao } from '../fila-de-conciliacao'

/** ⚠️ CNPJ MEDIDO como livre no repo (o guard `cnpj-de-teste-nao-colide` cobra isso) */
const CNPJ = '50607080004455'
const VALOR = 408.65

let companyId: string
let contaDinheiro: string
let contaComExtrato: string
let categoriaId: string

/** cria a conta a pagar JÁ PAGA (EFFECTED, sem vínculo) — o estado que o card lia errado */
async function pagaSemVinculo(bankAccountId: string, categoria: string | null) {
  return prisma.transaction.create({
    data: {
      bankAccountId,
      date: new Date('2026-11-03T12:00:00Z'),
      dueDate: new Date('2026-11-03T00:00:00Z'),
      paymentDate: new Date('2026-11-03T00:00:00Z'),
      description: 'E.M.S. COMERCIO DE ALIMENTOS LTDA — compra sem nota',
      amount: VALOR,
      type: 'DEBIT',
      status: 'RECONCILED',
      lifecycle: 'EFFECTED',
      origin: 'ESTOQUE_NF',
      categoryId: categoria,
    },
  })
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'PAGA POR FORA' } })
  companyId = c.id

  // ⭐ o DECLARADO: é este campo que distingue os dois mundos, não a contagem de tx
  contaDinheiro = (await prisma.bankAccount.create({
    data: { companyId, name: 'caixa loja/cofre', accountType: 'CASH', cashKind: 'MAIN', balance: 0 },
  })).id
  contaComExtrato = (await prisma.bankAccount.create({
    data: { companyId, name: 'stone', accountType: 'CHECKING', balance: 0 },
  })).id

  categoriaId = (await prisma.category.create({
    data: { companyId, name: 'Matéria-Prima - Alimentos', type: 'EXPENSE' },
  })).id
})

afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('a fila lê os fatos do banco e o card para de mentir', () => {
  it('(a) O CASO REAL: 408,65 paga em dinheiro e CATEGORIZADA → zero alarme na fila', async () => {
    await pagaSemVinculo(contaDinheiro, categoriaId)

    const contas = await contasEsperandoPagamento(companyId, prisma)
    expect(contas).toHaveLength(1)
    expect(contas[0]!.situacao, 'paga em dinheiro + categoria = resolvida').toBe('PAGA_POR_FORA_RESOLVIDA')

    const fila = await filaDeConciliacao(companyId, prisma)
    expect(fila.totais.duplaContagem, 'o alarme dos 408,65 tem que ser ZERO').toBe(0)
    expect(fila.totais.valorEmDuplaContagem).toBe(0)
    expect(fila.totais.pagaPorFora, 'nem pede classificação: já tem categoria').toBe(0)
    expect(fila.totais.pagaPorForaResolvida, 'ela existe — como selo de arquivo').toBe(1)
    // ⛔ e ela SAI da lista de trabalho: fila que cobra o que já foi decidido morre
    expect(fila.contas.map((c) => c.conta.id)).toEqual([])
  })

  it('(b) o MESMO caso SEM categoria → PAGA_POR_FORA, na lista, com o valor certo', async () => {
    const tx = await pagaSemVinculo(contaDinheiro, null)

    const fila = await filaDeConciliacao(companyId, prisma)
    expect(fila.totais.duplaContagem, 'não é dupla contagem — não há par possível').toBe(0)
    expect(fila.totais.pagaPorFora).toBe(1)
    expect(fila.totais.valorPagaPorFora).toBe(VALOR)
    // ⭐ e ela CHEGA na lista que o card desenha — é por aqui que o link existe
    expect(fila.contas.map((c) => c.conta.id)).toEqual([tx.id])
    expect(fila.contas[0]!.situacao).toBe('PAGA_POR_FORA')
  })

  it('(c) paga numa conta COM extrato → segue DUPLA_CONTAGEM e segue na lista', async () => {
    const tx = await pagaSemVinculo(contaComExtrato, categoriaId)

    const fila = await filaDeConciliacao(companyId, prisma)
    expect(fila.totais.duplaContagem, 'ali o par é possível — o alarme é legítimo').toBe(1)
    expect(fila.totais.valorEmDuplaContagem).toBe(VALOR)
    expect(fila.totais.pagaPorFora).toBe(0)
    expect(fila.contas.map((c) => c.conta.id)).toEqual([tx.id])
  })

  /**
   * ⛔⛔ O TESTE QUE DISCRIMINA O SELECT. Os dois mundos existem ao MESMO tempo na mesma
   * empresa: se `accountType` não chegar à régua, as duas viram dupla contagem e este
   * número vira 2. É o defeito que o select incompleto produzia.
   */
  it('⛔ dinheiro e banco juntos: 1 dupla contagem e 1 paga-por-fora, nunca 2 alarmes iguais', async () => {
    await pagaSemVinculo(contaDinheiro, null)
    await pagaSemVinculo(contaComExtrato, null)

    const fila = await filaDeConciliacao(companyId, prisma)
    expect(fila.totais.duplaContagem).toBe(1)
    expect(fila.totais.pagaPorFora).toBe(1)
    expect(fila.totais.valorEmDuplaContagem).toBe(VALOR)
    expect(fila.totais.valorPagaPorFora).toBe(VALOR)
  })

  /** ⭐ a conta a pagar em ABERTO não foi afetada pelo sprint */
  it('conta a pagar ainda não paga segue EM_ABERTO', async () => {
    await prisma.transaction.create({
      data: {
        bankAccountId: contaComExtrato,
        date: new Date('2026-11-03T12:00:00Z'),
        dueDate: new Date('2026-11-10T00:00:00Z'),
        description: 'E.M.S. — nota a vencer',
        amount: VALOR, type: 'DEBIT', status: 'PENDING', lifecycle: 'PAYABLE', origin: 'ESTOQUE_NF',
      },
    })

    const contas = await contasEsperandoPagamento(companyId, prisma)
    expect(contas).toHaveLength(1)
    expect(contas[0]!.situacao).toBe('EM_ABERTO')
    const fila = await filaDeConciliacao(companyId, prisma)
    expect(fila.totais.duplaContagem).toBe(0)
    expect(fila.totais.pagaPorFora).toBe(0)
  })
})

/**
 * ⭐⭐ REGRA 14 — O IRMÃO ESQUECIDO (04/11/2026)
 *
 * ⛔⛔ Achado ao varrer quem mais lê `situacao`: `resumirSemPar` filtrava
 * `situacao !== 'DUPLA_CONTAGEM'`. Isso funcionava com DOIS estados; com o terceiro, a
 * exclusão passou a **admitir** a conta paga em dinheiro, e o alarme dos R$ 408,65 sairia do
 * card pra reaparecer no número de *"sem par — lacuna real"*. ***Curar um card e deixar o
 * irmão contando o mesmo dinheiro é não ter curado nada.***
 */
describe('REGRA 14 — a cura vale nos irmãos que leem a situação', () => {
  it('⛔ a paga-por-fora NÃO entra no "sem par" (nem a resolvida)', async () => {
    await pagaSemVinculo(contaDinheiro, null)
    await pagaSemVinculo(contaDinheiro, categoriaId)

    const fila = await filaDeConciliacao(companyId, prisma)
    expect(fila.semPar.total, 'paga em dinheiro não é conta esperando pagamento').toBe(0)
    expect(fila.semPar.comExtratoImportado, 'e muito menos "lacuna real"').toBe(0)
    // ⭐ ela aparece no lugar certo, e só nele
    expect(fila.totais.pagaPorFora).toBe(1)
    expect(fila.totais.pagaPorForaResolvida).toBe(1)
  })

  it('⛔ a dupla contagem segue fora do "sem par" — o filtro não afrouxou', async () => {
    await pagaSemVinculo(contaComExtrato, null)

    const fila = await filaDeConciliacao(companyId, prisma)
    expect(fila.semPar.total).toBe(0)
    expect(fila.totais.duplaContagem).toBe(1)
  })

  it('⭐ e a conta EM ABERTO sem par continua contada — a cura não comeu o caso legítimo', async () => {
    await prisma.transaction.create({
      data: {
        bankAccountId: contaComExtrato,
        date: new Date('2026-11-03T12:00:00Z'),
        dueDate: new Date('2026-11-03T00:00:00Z'),
        description: 'FORNECEDOR SEM PAR — nota vencida',
        amount: 777.77, type: 'DEBIT', status: 'PENDING', lifecycle: 'PAYABLE', origin: 'ESTOQUE_NF',
      },
    })

    const fila = await filaDeConciliacao(companyId, prisma)
    expect(fila.semPar.total, 'invariante que mata o caso legítimo é pior que nenhum').toBe(1)
  })
})
