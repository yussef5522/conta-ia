/**
 * ⭐⭐⭐ A AVULSA PEDE CATEGORIA, E TEM VOLTA (30/09/2026) — COMPORTAMENTO, contra o banco.
 *
 * **O caso real que motivou:** a linha da COOPERATIVA DE PAIS E MESTRES (PIX −100,00 de
 * 30/09, stone). O dono escolheu *«Distribuição de Lucros»* no seletor, a ponte **não
 * abriu**, ele clicou *«é despesa avulsa»* — e o gesto **jogou a categoria escolhida no
 * lixo**. Medido em prod: `categoryId = null`, `avulsaConfirmada = true`, estação ARQUIVO.
 * Ou seja, a despesa **saiu da caixa sem entrar em DRE nenhum**, e sem ponte.
 *
 * ⛔ O guard estrutural irmão (`__tests__/regras-ui/desfecho-pede-confirmacao-e-tem-volta`)
 * prova a FORMA da tela — sem jsdom não dá pra clicar. **Este aqui roda os gestos de
 * verdade** e pergunta ao banco o que ficou: é ele que impede o conserto de ser uma
 * afirmação sobre o mundo bom.
 *
 * ⚠️ E a estação é lida pela **MESMA** `paraLei`/`estacaoDaLinha` que a caixa usa, sobre o
 * **MESMO `SELECT_DA_CAIXA`** — montar a `LinhaParaEstacao` à mão aqui seria a segunda
 * derivação que já custou o desaparecimento do CASPER em 20/09.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { resolverLinha, ResolverError } from '../resolver-linha'
import { SELECT_DA_CAIXA, paraLei } from '../leitura-da-caixa'
import { estacaoDaLinha } from '../caixa-de-entrada'
import { GRUPO_RETIRADA } from '../categorias-do-gesto'

const CNPJ = '50607080001899' // ⚠️ exclusivo deste arquivo
let companyId = ''
let contaBancariaId = ''
let userId = ''
let catRetiradaId = ''
let catDespesaId = ''
let linhaId = ''

/**
 * ⚠️ O `authCtx` vai COMPLETO de propósito (a cicatriz do `as never` de 20/09) e **nada é
 * mockado**: *guard que substitui a peça não prova o encaixe dela*.
 */
const pedido = (extra: Record<string, unknown> = {}) => ({
  companyId,
  txId: linhaId,
  acao: 'AVULSA_CONFIRMADA' as const,
  userId,
  authCtx: {
    user: { id: userId, name: 'teste', email: 't@t.t' },
    company: { id: companyId },
    role: { id: 'r', name: 'OWNER', isSystemDefault: true },
    permissions: ['*'],
    requirePermission: () => {},
  } as never,
  ...extra,
})

/**
 * A linha pelos olhos da TELA — o mesmo select, a mesma lei.
 *
 * ⚠️ O `avulsaConfirmada` **não está no `SELECT_DA_CAIXA`** (é tabela à parte): o `lerCaixa`
 * o preenche com uma segunda consulta, e aqui se faz igual. Montar a `LinhaParaEstacao` à
 * mão seria a segunda derivação que sumiu com o CASPER em 20/09.
 */
async function daCaixa() {
  const r = await prisma.transaction.findUniqueOrThrow({
    where: { id: linhaId },
    select: { ...SELECT_DA_CAIXA, status: true },
  })
  const avulsa = await prisma.conciliacaoAvulsaConfirmada.count({ where: { transactionId: linhaId } })
  return {
    crua: r,
    avulsas: avulsa,
    estacao: estacaoDaLinha(paraLei({ ...r, avulsaConfirmada: avulsa > 0 } as never)),
  }
}

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const co = await prisma.company.create({
    data: { name: 'avulsa-categoria', cnpj: CNPJ },
    select: { id: true },
  })
  companyId = co.id
  // ⚠️ usuário de VERDADE: o choke-point grava auditoria, e `auditLog` tem FK pro `User`.
  const u = await prisma.user.create({
    data: { email: `avulsa-${CNPJ}@teste.local`, name: 'teste', password: 'x' },
    select: { id: true },
  })
  userId = u.id
  const ba = await prisma.bankAccount.create({
    data: { companyId, name: 'stone', bankCode: '197', balance: 0 },
    select: { id: true },
  })
  contaBancariaId = ba.id
  const retirada = await prisma.category.create({
    data: { companyId, name: 'Distribuição de Lucros', type: 'EXPENSE', dreGroup: GRUPO_RETIRADA },
    select: { id: true },
  })
  catRetiradaId = retirada.id
  const despesa = await prisma.category.create({
    data: { companyId, name: 'Despesas Diversas', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
    select: { id: true },
  })
  catDespesaId = despesa.id
})

afterAll(async () => {
  await prisma.conciliacaoAvulsaConfirmada.deleteMany({ where: { companyId } })
  await prisma.transaction.deleteMany({ where: { bankAccountId: contaBancariaId } })
  await prisma.category.deleteMany({ where: { companyId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.auditLog.deleteMany({ where: { userId } })
  await prisma.user.deleteMany({ where: { id: userId } })
})

/** a cena REAL: o PIX de −100,00 da COOPERATIVA na caixa, sem categoria */
beforeEach(async () => {
  await prisma.conciliacaoAvulsaConfirmada.deleteMany({ where: { companyId } })
  await prisma.transaction.deleteMany({ where: { bankAccountId: contaBancariaId } })
  const l = await prisma.transaction.create({
    data: {
      bankAccountId: contaBancariaId,
      date: new Date('2026-09-30T12:00:00.000Z'),
      description: 'PAGAMENTO PIX-PIX_DEB COOPERATIVA DE PAIS E MESTRES ESCOLA SANTA TERESA',
      amount: 100,
      type: 'DEBIT',
      status: 'PENDING',
      lifecycle: 'EFFECTED',
      origin: 'OFX',
    },
    select: { id: true },
  })
  linhaId = l.id
})

describe('⛔⛔ a AVULSA exige categoria — nada sai da caixa sem classificação', () => {
  it('⛔⛔⛔ sem categoria: RECUSA e NÃO GRAVA NADA (o caso da COOPERATIVA)', async () => {
    await expect(resolverLinha(pedido(), prisma)).rejects.toThrow(ResolverError)

    // ⭐ o que importa não é a exceção: é o banco INTACTO
    const { crua, estacao } = await daCaixa()
    expect(crua.categoryId, 'categorizou mesmo recusando').toBeNull()
    expect(crua.status).toBe('PENDING')
    expect(
      await prisma.conciliacaoAvulsaConfirmada.count({ where: { transactionId: linhaId } }),
      'arquivou a decisão mesmo recusando',
    ).toBe(0)
    expect(estacao, 'a linha saiu da caixa numa recusa').toBe('CAIXA')
  })

  it('⛔ e a recusa ENSINA — ela separa "não tem nota" de "o que é isto"', async () => {
    /**
     * ⚠️ Recusa que não diz o que fazer vira ruído, e o dono clica de novo. A frase tem que
     * nomear as DUAS perguntas, porque o gesto responde só uma delas.
     */
    await expect(resolverLinha(pedido(), prisma)).rejects.toThrow(/categoria/i)
    await expect(resolverLinha(pedido(), prisma)).rejects.toThrow(/DRE/)
  })

  it('⭐⭐ COM categoria: GRAVA a escolha e arquiva — a categoria não vai pro lixo', async () => {
    /**
     * ⭐ Este é o red-then-green do caso real: antes, a avulsa arquivava com
     * `categoryId = null` **mesmo com o dono tendo escolhido** a categoria no seletor.
     */
    const r = await resolverLinha(pedido({ categoryId: catDespesaId }), prisma)
    expect(r.saiuDaCaixa).toBe(true)

    const { crua, estacao } = await daCaixa()
    expect(crua.categoryId, 'a categoria escolhida foi jogada no lixo').toBe(catDespesaId)
    expect(crua.status).toBe('RECONCILED')
    expect(estacao).toBe('ARQUIVO')
    const av = await prisma.conciliacaoAvulsaConfirmada.findUniqueOrThrow({
      where: { transactionId: linhaId },
      select: { confirmadoPorId: true },
    })
    // ⚠️ decisão sem autor é decisão que ninguém assume — é o que separa
    // "o dono disse que não tem nota" de "ninguém olhou ainda".
    expect(av.confirmadoPorId, 'a avulsa ficou sem autor').toBe(userId)
  })

  it('⛔⛔ o SELO é PRÓPRIO: a estação vem da avulsa, não do selo "categorizada"', async () => {
    /**
     * ⚠️ A categoria aqui é de FORNECEDOR (`DESPESAS_ADMINISTRATIVAS`), que pela régua de
     * 24/09 **não quita** — ela sozinha deixaria a linha na CAIXA cobrando a nota. O que
     * arquiva é a DECISÃO do dono, registrada. Reusar o selo *"categorizada"* misturaria
     * *"não tem nota"* com *"ninguém olhou"* — a mistura que escondeu R$ 16.201,01.
     */
    await resolverLinha(pedido({ categoryId: catDespesaId }), prisma)
    const comAvulsa = await daCaixa()
    expect(comAvulsa.estacao).toBe('ARQUIVO')

    // tiro SÓ a decisão, mantendo a categoria: ela tem que VOLTAR a pedir decisão
    await prisma.conciliacaoAvulsaConfirmada.deleteMany({ where: { transactionId: linhaId } })
    const semAvulsa = await daCaixa()
    expect(semAvulsa.crua.categoryId, 'a categoria sumiu junto').toBe(catDespesaId)
    expect(semAvulsa.estacao, 'a categoria de fornecedor arquivou sozinha').toBe('CAIXA')
  })
})

describe('⛔⛔ ARQUIVO INENCONTRÁVEL = VERMELHO — a volta funciona de verdade', () => {
  it('⭐⭐ DESFAZER_AVULSA traz pra caixa e a CATEGORIA FICA', async () => {
    await resolverLinha(pedido({ categoryId: catDespesaId }), prisma)
    expect((await daCaixa()).estacao).toBe('ARQUIVO')

    const volta = await resolverLinha(pedido({ acao: 'DESFAZER_AVULSA' }), prisma)
    expect(volta.saiuDaCaixa, 'a volta diz que a linha saiu da caixa').toBe(false)

    const { crua, estacao } = await daCaixa()
    expect(estacao, 'a linha não voltou pra caixa').toBe('CAIXA')
    expect(
      await prisma.conciliacaoAvulsaConfirmada.count({ where: { transactionId: linhaId } }),
      'a decisão continua arquivada',
    ).toBe(0)
    /**
     * ⭐ A categoria FICA de propósito: desfazer o arquivamento não desfaz a classificação
     * que o dono deu. Apagá-la seria perder trabalho dele num gesto de navegação.
     */
    expect(crua.categoryId, 'a volta apagou a categoria do dono').toBe(catDespesaId)
  })

  it('⭐ e o ciclo é COMPLETO: volta → arquiva de novo, sem duplicar a decisão', async () => {
    await resolverLinha(pedido({ categoryId: catDespesaId }), prisma)
    await resolverLinha(pedido({ acao: 'DESFAZER_AVULSA' }), prisma)
    await resolverLinha(pedido({ categoryId: catDespesaId }), prisma)
    expect(await prisma.conciliacaoAvulsaConfirmada.count({ where: { transactionId: linhaId } })).toBe(1)
    expect((await daCaixa()).estacao).toBe('ARQUIVO')
  })

  it('⛔ desfazer o que NÃO é avulsa recusa ENSINANDO, em vez de calar', async () => {
    /**
     * ⚠️ `deleteMany` de 0 linhas é sucesso pro Prisma — sem a checagem do `count`, a tela
     * diria *"de volta na caixa"* sobre uma linha que nunca saiu. **Sucesso disfarçado.**
     */
    await expect(resolverLinha(pedido({ acao: 'DESFAZER_AVULSA' }), prisma)).rejects.toThrow(
      /não está marcada como despesa avulsa/i,
    )
  })
})

describe('⭐⭐⭐ CATEGORIA-COM-PONTE DISPARA A PONTE — decidido no SERVIDOR', () => {
  it('⭐⭐ categorizar como RETIRADA devolve a consequência (o caso da COOPERATIVA)', async () => {
    /**
     * ⛔⛔ **O beco:** o dono escolhia *«Distribuição de Lucros»* e **nada acontecia** — nem
     * ponte, nem erro. A causa era a tela DERIVAR o convite (`categorias.find(...)` +
     * `conviteDaPonte`): se a lista de categorias falhasse ao carregar, ou o `dreGroup` não
     * viesse no payload, a retirada ficava **meia-ponte em silêncio**.
     *
     * ⭐ Agora quem sabe é quem GRAVOU, e o teste pergunta isso ao servidor.
     */
    const r = await resolverLinha(pedido({ acao: 'CATEGORIA', categoryId: catRetiradaId }), prisma)
    expect(r.consequencia?.tipo, 'a ponte não foi oferecida').toBe('PONTE_PJ_PF')
    expect(r.consequencia?.ondeReabrir, 'o convite não diz onde reabrir').toBeTruthy()
  })

  it('⛔ e ela NÃO dispara em categoria comum — alarme falso mata o alarme', async () => {
    const r = await resolverLinha(pedido({ acao: 'CATEGORIA', categoryId: catDespesaId }), prisma)
    expect(r.consequencia ?? null).toBeNull()
  })

  it('⭐ a AVULSA de retirada também carrega a consequência — é a MESMA pergunta', async () => {
    /**
     * ⚠️ A consequência é decidida **no wrapper, envolvendo o switch** — então gesto que
     * grava categoria a ganha de graça. Dentro de um ramo, o próximo gesto nasceria sem
     * disparar a ponte: *"N caminhos, 1 esquecido"*, a doença que custou o gatilho de vendas.
     */
    const r = await resolverLinha(pedido({ categoryId: catRetiradaId }), prisma)
    expect(r.consequencia?.tipo).toBe('PONTE_PJ_PF')
  })
})
