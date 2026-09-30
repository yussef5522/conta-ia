/**
 * ⛔⛔⛔ TROCAR A CONTA DE UM LANÇAMENTO — a fronteira e o movimento (30/09/2026)
 *
 * **A ordem do dono:** *"o formulário ganha o seletor CONTA pros lançamentos MANUAIS; trocar
 * a conta re-ancora o saldo das DUAS contas pela régua; recalcula a competência pela régua
 * da conta NOVA e avisa se mudou; grava no rastro. FRONTEIRA: linha que VEIO DE EXTRATO não
 * troca de conta; conciliada manual pede desfazer primeiro."*
 *
 * ⭐ A fronteira é o que faz o gesto ser seguro, e ela é ALLOWLIST: só `MANUAL` (e o legado
 * sem `origin`) se move. Origem nova cai no lado que RECUSA — porque quem leva um "não" com
 * o motivo escrito vem perguntar, e quem move uma linha de extrato sem perceber só descobre
 * quando o saldo para de fechar.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import {
  podeMoverDeConta,
  prepararMudancaDeConta,
  competenciaNaConta,
  MoverDeContaError,
} from '../mover-de-conta'
import { reAncorarContas } from '@/lib/balance/recalcular'

const CNPJ = '72727272000172'
let companyId = ''
let stone = ''
let cofre = ''
const dia = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({
    data: { name: 'Mover Teste', cnpj: CNPJ, state: 'RS' },
    select: { id: true },
  })
  companyId = c.id
  stone = (
    await prisma.bankAccount.create({
      data: {
        companyId, name: 'stone', bankCode: '197', accountType: 'CHECKING',
        balance: 168.36, ledgerBal: 168.36, ledgerBalDate: dia('2026-09-25'),
      },
      select: { id: true },
    })
  ).id
  cofre = (
    await prisma.bankAccount.create({
      data: { companyId, name: 'caixa loja/cofre', accountType: 'CASH', balance: 0 },
      select: { id: true },
    })
  ).id

  /**
   * ⚠️ As regras de recebimento REAIS da Caçula, porque é o que faz a competência mudar de
   * dia: dinheiro no cofre é **D+1 CORRIDO** (dinheiro que entra hoje é venda de ontem) e
   * PIX na Stone é **D+0**. Sem as duas regras o teste não teria como provar o aviso.
   */
  const perfil = await prisma.perfilRecebimento.create({
    data: { companyId },
    select: { id: true },
  })
  await prisma.regraRecebimento.createMany({
    data: [
      { perfilId: perfil.id, companyId, bankAccountId: stone, meio: 'PIX', diasUteisAtraso: 0, recebeSabDom: true, vigenteDe: dia('2026-08-01'), confirmadoPeloDono: true },
      { perfilId: perfil.id, companyId, bankAccountId: cofre, meio: 'DINHEIRO', diasUteisAtraso: 1, recebeSabDom: true, vigenteDe: dia('2026-08-01'), confirmadoPeloDono: true },
    ],
  })
})

afterAll(async () => {
  await prisma.perfilRecebimento.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

const criarManual = (contaId: string, extra: Record<string, unknown> = {}) =>
  prisma.transaction.create({
    data: {
      bankAccountId: contaId,
      date: dia('2026-09-17'),
      description: 'receita de venda dinheiro',
      amount: 2112,
      type: 'CREDIT',
      status: 'RECONCILED',
      lifecycle: 'EFFECTED',
      origin: 'MANUAL',
      ...extra,
    },
  })

describe('⛔ A FRONTEIRA (pura) — quem se move e quem não', () => {
  const base = { origin: 'MANUAL', reconciledWithId: null, transferGroupId: null, type: 'CREDIT', lifecycle: 'EFFECTED' }

  it('⭐ lançamento MANUAL efetivado: pode', () => {
    expect(podeMoverDeConta(base).pode).toBe(true)
  })

  it('⭐ legado sem `origin` também pode (é o histórico de antes do campo existir)', () => {
    expect(podeMoverDeConta({ ...base, origin: null }).pode).toBe(true)
  })

  it('⛔⛔ linha do EXTRATO não troca de conta — e a frase diz o CAMINHO', () => {
    const v = podeMoverDeConta({ ...base, origin: 'OFX' })
    expect(v.pode).toBe(false)
    expect(v.motivo).toBe('VEIO_DO_EXTRATO')
    // ⚠️ recusa que não ensina a saída é beco: a frase tem que dizer "reimporte na conta certa"
    expect(v.explicacao).toContain('reimportar o extrato na conta certa')
  })

  it('⛔ PDF de extrato e Open Finance caem na MESMA régua (são espelho do banco também)', () => {
    for (const o of ['PDF_STATEMENT', 'OPEN_FINANCE']) {
      expect(podeMoverDeConta({ ...base, origin: o }).motivo).toBe('VEIO_DO_EXTRATO')
    }
  })

  it('⛔ CONCILIADA pede desfazer primeiro, e nomeia com o quê quando dá', () => {
    const v = podeMoverDeConta({ ...base, reconciledWithId: 'abc', conciliadaCom: 'NF 123' })
    expect(v.motivo).toBe('CONCILIADA')
    expect(v.explicacao).toContain('NF 123')
    expect(v.explicacao).toContain('Desfaça a conciliação')
  })

  it('⛔ perna de TRANSFERÊNCIA não se move sozinha (quebraria o par)', () => {
    expect(podeMoverDeConta({ ...base, transferGroupId: 'g1' }).motivo).toBe('PERNA_DE_TRANSFERENCIA')
    expect(podeMoverDeConta({ ...base, type: 'TRANSFER' }).motivo).toBe('PERNA_DE_TRANSFERENCIA')
  })

  it('⛔ conta a pagar EM ABERTO não troca por aqui (a conta se escolhe na baixa)', () => {
    expect(podeMoverDeConta({ ...base, lifecycle: 'PAYABLE' }).motivo).toBe('NAO_EFETIVADA')
  })

  it('⛔⛔ ALLOWLIST: origem NOVA cai no lado que RECUSA, sem ninguém cadastrar nada', () => {
    /**
     * ⚠️ É a metade que faz a regra envelhecer bem. `ESTOQUE_NF` e `ADJUSTMENT` existem
     * hoje; amanhã vai existir outra. Com denylist, a origem nova nasceria PODENDO se
     * mover — e o erro seria invisível. Aqui ela nasce recusada, e a frase diz por quê.
     */
    for (const o of ['ESTOQUE_NF', 'ADJUSTMENT', 'PLUGGY', 'ORIGEM_QUE_AINDA_NAO_EXISTE']) {
      const v = podeMoverDeConta({ ...base, origin: o })
      expect(v.pode, `origem ${o} deveria ser recusada`).toBe(false)
      expect(v.explicacao).toContain(o)
    }
  })
})

describe('⭐⭐ O MOVIMENTO — saldo das duas contas e a competência', () => {
  it('⭐⭐ move da stone pro cofre: as DUAS contas re-ancoram pela régua', async () => {
    const t = await criarManual(stone)
    await reAncorarContas(prisma, [stone, cofre])

    // a stone é ANCORADA em 25/09 e a linha é de 17/09 → o saldo dela nem sentiu a linha
    expect((await prisma.bankAccount.findUniqueOrThrow({ where: { id: stone } })).balance).toBe(168.36)

    const m = await prepararMudancaDeConta(prisma, {
      transacaoId: t.id, contaDestinoId: cofre, companyId,
    })
    expect(m.de.nome).toBe('stone')
    expect(m.para.nome).toBe('caixa loja/cofre')
    expect(m.rastro).toBe('movida de stone pra caixa loja/cofre')

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({ where: { id: t.id }, data: { bankAccountId: cofre } })
      await reAncorarContas(tx, [stone, cofre])
    })

    // ⭐ stone segue no que o banco declarou; o cofre (sem âncora) soma a linha
    expect((await prisma.bankAccount.findUniqueOrThrow({ where: { id: stone } })).balance).toBe(168.36)
    expect((await prisma.bankAccount.findUniqueOrThrow({ where: { id: cofre } })).balance).toBe(2112)

    await prisma.transaction.delete({ where: { id: t.id } })
    await reAncorarContas(prisma, [stone, cofre])
  })

  it('⭐⭐ A COMPETÊNCIA ANDA DE DIA — e é isso que a tela tem que dizer', async () => {
    /**
     * ⭐ O caso real: dinheiro que entra dia 17 no COFRE é venda do dia 16 (D+1 corrido);
     * PIX que entra dia 17 na STONE é venda do dia 17 (D+0). A MESMA linha vale por dois
     * dias diferentes dependendo da conta — mexer no calendário sem dizer seria a família
     * do "gravou e não disse".
     */
    const naStone = await competenciaNaConta(prisma, companyId, stone, dia('2026-09-17'))
    const noCofre = await competenciaNaConta(prisma, companyId, cofre, dia('2026-09-17'))
    expect(naStone.meio).toBe('PIX')
    expect(noCofre.meio).toBe('DINHEIRO')
    expect(naStone.inicio).toBe('2026-09-17')
    expect(noCofre.inicio).toBe('2026-09-16')

    const t = await criarManual(stone)
    const m = await prepararMudancaDeConta(prisma, { transacaoId: t.id, contaDestinoId: cofre, companyId })
    expect(m.competencia.mudou).toBe(true)
    expect(m.competencia.antes.inicio).toBe('2026-09-17')
    expect(m.competencia.depois.inicio).toBe('2026-09-16')
    await prisma.transaction.delete({ where: { id: t.id } })
  })

  it('⛔ REGRA 8 — conta de OUTRA empresa é recusada', async () => {
    const outra = await prisma.company.create({
      data: { name: 'Outra', cnpj: '72727272000199', state: 'RS' },
      select: { id: true },
    })
    const contaAlheia = await prisma.bankAccount.create({
      data: { companyId: outra.id, name: 'alheia', accountType: 'CHECKING', balance: 0 },
      select: { id: true },
    })
    const t = await criarManual(stone)
    await expect(
      prepararMudancaDeConta(prisma, { transacaoId: t.id, contaDestinoId: contaAlheia.id, companyId }),
    ).rejects.toThrow(MoverDeContaError)
    await prisma.transaction.delete({ where: { id: t.id } })
    await prisma.company.delete({ where: { id: outra.id } })
  })

  it('⛔ mover pra MESMA conta é recusado (nada a fazer, e não é sucesso)', async () => {
    const t = await criarManual(stone)
    await expect(
      prepararMudancaDeConta(prisma, { transacaoId: t.id, contaDestinoId: stone, companyId }),
    ).rejects.toThrow(/mesma/i)
    await prisma.transaction.delete({ where: { id: t.id } })
  })

  it('⛔⛔ linha de OFX é recusada pelo ORQUESTRADOR, não só pela função pura', async () => {
    /**
     * ⚠️ A régua pura passar não prova que a porta a consulta — é a lição do guard que
     * testava a lib e aprovava a tela que a ignorava. Este caso executa o caminho real.
     */
    const t = await criarManual(stone, { origin: 'OFX', dedupHash: 'h-teste-ofx' })
    await expect(
      prepararMudancaDeConta(prisma, { transacaoId: t.id, contaDestinoId: cofre, companyId }),
    ).rejects.toThrow(/espelho do que o banco registrou/)
    await prisma.transaction.delete({ where: { id: t.id } })
  })
})
