/**
 * ⭐⭐⭐ A FILA DE RETIRADAS ENXERGA DINHEIRO, NÃO LINHA — CONTRA BANCO (05/11/2026)
 *
 * ⛔ **O caso real, medido em prod em 04/11 (zero escrita):** a retirada vive em DUAS linhas
 * conciliadas — a `MANUAL` que o dono digitou e a `OFX` do extrato, casadas por
 * `reconciledWithId`. É **um dinheiro**. A ponte PJ→PF é `@unique` por `pjTransactionId`
 * (uma por LINHA) e a fila excluía por `bridge:{is:null}` na própria linha. O dono resolveu
 * o lado `OFX` (3 pontes de 04/11, corretas) e a fila devolveu a gêmea `MANUAL`:
 *
 *   escola 100,00 · escola 1.318,57 · carro 2.845,00  ← 3 fantasmas, já resolvidos
 *   formatura 190,00 ×2 · camiseta 59,00 ×2           ← os dois lados, lado a lado
 *
 * ⚠️ **Por que integração:** o colapso depende de `reconciledWithId`/`reconciledFrom` e da
 * relação `bridge` — relações não existem num `db` de mentira, e um mock aprovaria a régua
 * lendo o array que eu mesmo escrevi. *A sonda tem que medir o que o banco faz.*
 *
 * ⛔ Fixtures com campo PREENCHIDO: valores reais (190 · 59 · 2.845/2.849), descrições reais
 * e a ponte gravada de verdade — *campo zerado passa verde com a régua certa E com a errada*.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { countOrphanWithdrawals, listOrphanWithdrawals } from '../orphan-query'
import { dinheirosDeRetiradaPendentes, montarDinheiro, type LadoDaRetirada } from '../dinheiro-da-retirada'
import { createBridge } from '@/lib/bridges/create'

/** ⚠️ CNPJ MEDIDO como livre no repo (o guard `cnpj-de-teste-nao-colide` cobra isso) */
const CNPJ = '10203040000688'

let companyId: string
let contaId: string
let categoriaId: string
let profileId: string
let socioId: string
let userId: string

/** cria o par conciliado MANUAL+OFX — o formato em que a retirada REALMENTE vive */
async function parConciliado(opts: {
  rotulo: string; descricaoExtrato: string; valorManual: number; valorExtrato: number; dia: string
}) {
  const ofx = await prisma.transaction.create({
    data: {
      bankAccountId: contaId, categoryId: categoriaId,
      date: new Date(`${opts.dia}T12:00:00Z`),
      description: opts.descricaoExtrato, amount: opts.valorExtrato,
      type: 'DEBIT', status: 'RECONCILED', lifecycle: 'EFFECTED', origin: 'OFX',
    },
  })
  const manual = await prisma.transaction.create({
    data: {
      bankAccountId: contaId, categoryId: categoriaId,
      date: new Date(`${opts.dia}T12:00:00Z`),
      description: opts.rotulo, amount: opts.valorManual,
      type: 'DEBIT', status: 'RECONCILED', lifecycle: 'EFFECTED', origin: 'MANUAL',
      // ⭐ o vínculo é unidirecional: a MANUAL aponta pra OFX
      reconciledWithId: ofx.id,
    },
  })
  return { manual, ofx }
}

/** a retirada de uma linha só — dinheiro do caixa, sem extrato pra casar */
async function soManual(rotulo: string, valor: number, dia: string) {
  return prisma.transaction.create({
    data: {
      bankAccountId: contaId, categoryId: categoriaId,
      date: new Date(`${dia}T12:00:00Z`), description: rotulo, amount: valor,
      type: 'DEBIT', status: 'RECONCILED', lifecycle: 'EFFECTED', origin: 'MANUAL',
    },
  })
}

/** grava a ponte DE VERDADE no lado escolhido (é assim que o dono resolveu as 3) */
async function pontearLado(pjTransactionId: string, amount: number, dia: string) {
  const pf = await prisma.personalTransaction.create({
    data: {
      profileId, date: new Date(`${dia}T12:00:00Z`), amount, type: 'CREDIT',
      description: 'Distribuição de Lucros (teste)', status: 'RECONCILED', origin: 'MANUAL',
    },
  })
  return prisma.pJtoPFBridge.create({
    data: {
      companyId, profileId, socioPFId: socioId, pjTransactionId, pfTransactionId: pf.id,
      kind: 'DISTRIBUICAO', amount, date: new Date(`${dia}T12:00:00Z`),
      createdById: userId, createdVia: 'CREATED_MANUAL',
    },
  })
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'FILA POR DINHEIRO' } })
  companyId = c.id
  contaId = (await prisma.bankAccount.create({
    data: { companyId, name: 'stone', accountType: 'CHECKING', balance: 0 },
  })).id
  categoriaId = (await prisma.category.create({
    data: { companyId, name: 'Distribuição de Lucros', type: 'EXPENSE', dreGroup: 'DISTRIBUICAO_LUCROS' },
  })).id
  // ⚠️ campos LIDOS do schema: PersonalProfile usa `name`; SocioPF NÃO tem profileId
  const prof = await prisma.personalProfile.create({ data: { name: 'Yussef (teste)' } })
  profileId = prof.id
  socioId = (await prisma.socioPF.create({
    data: { companyId, nome: 'Yussef (teste)', papel: 'SOCIO' },
  })).id
  // ⚠️ `createdById` é FK NOT NULL pra users: sem um usuário real a ponte não grava
  // (o erro era "Foreign key constraint violated", não campo faltando)
  userId = (await prisma.user.create({
    data: { name: 'Teste Fila', email: `fila-dinheiro-${CNPJ}@teste.local`, password: 'x' },
  })).id
})

afterEach(async () => {
  await prisma.pJtoPFBridge.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.personalTransaction.deleteMany({ where: { profileId } }).catch(() => {})
  await prisma.socioPF.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.transaction.deleteMany({ where: { bankAccount: { companyId } } }).catch(() => {})
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.personalProfile.deleteMany({ where: { id: profileId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {})
})

describe('a fila conta DINHEIRO', () => {
  /**
   * (a) ⭐⭐ O FANTASMA — o caso exato dos 3 de prod: ponte criada no lado OFX, e a gêmea
   * MANUAL não pode voltar à fila.
   */
  it('(a) par resolvido pelo lado OFX → fila VAZIA pra esse dinheiro', async () => {
    const { ofx } = await parConciliado({
      rotulo: 'escola', descricaoExtrato: 'COOPERATIVA DE PAIS E MESTRES DA ESCOLA',
      valorManual: 1318.57, valorExtrato: 1318.57, dia: '2026-10-30',
    })
    await pontearLado(ofx.id, 1318.57, '2026-10-30')

    expect(await countOrphanWithdrawals(prisma, companyId),
      'a gêmea MANUAL não é uma retirada nova — é o mesmo dinheiro').toBe(0)
    expect(await listOrphanWithdrawals(prisma, companyId)).toEqual([])
  })

  it('(a2) e dá no mesmo quando a ponte foi criada no lado MANUAL', async () => {
    const { manual } = await parConciliado({
      rotulo: 'escola', descricaoExtrato: 'COOPERATIVA DE PAIS E MESTRES DA ESCOLA',
      valorManual: 100, valorExtrato: 100, dia: '2026-10-30',
    })
    await pontearLado(manual.id, 100, '2026-10-30')

    expect(await countOrphanWithdrawals(prisma, companyId),
      'o sentido do vínculo não pode mudar a resposta').toBe(0)
  })

  /**
   * (b) ⭐⭐ O COLAPSO: os dois lados viram UMA entrada. Rótulo humano da MANUAL, número do
   * extrato — e o `id` oferecido é o do lado do extrato, onde o dinheiro real saiu.
   */
  it('(b) par SEM ponte → UMA entrada, com rótulo da mão e número do extrato', async () => {
    const { manual, ofx } = await parConciliado({
      rotulo: 'formatura', descricaoExtrato: 'Liege Da Silva Boeira - Transferência | Pix',
      valorManual: 190, valorExtrato: 190, dia: '2026-11-03',
    })

    const d = await dinheirosDeRetiradaPendentes(prisma, companyId)
    expect(d, 'duas linhas, um dinheiro').toHaveLength(1)
    expect(d[0]!.id, 'o gesto vai no lado do EXTRATO — é o dinheiro real').toBe(ofx.id)
    expect(d[0]!.idDaGemea).toBe(manual.id)
    expect(d[0]!.description, 'o dono reconhece "formatura", não o nome do favorecido').toBe('formatura')
    expect(d[0]!.amount).toBe(190)
    expect(d[0]!.colapsado).toBe(true)
    expect(await countOrphanWithdrawals(prisma, companyId)).toBe(1)
  })

  /**
   * ⭐ O CARRO: os valores DIVERGEM (MANUAL 2.845,00 · OFX 2.849,00) e o PF recebeu 2.849,00.
   * ⛔ A fila tem que pedir o número do BANCO, não o que foi digitado por aproximação — senão
   * ela cobra 2.845 e o PF recebe 2.849, e os R$ 4,00 ficam pendurados em ninguém.
   */
  it('(b2) valores divergentes no par: a fila mostra o do EXTRATO (2.849, não 2.845)', async () => {
    const { ofx } = await parConciliado({
      rotulo: 'carro', descricaoExtrato: 'LM TRANSP INTER SERV COM S A - Pagamento',
      valorManual: 2845, valorExtrato: 2849, dia: '2026-10-26',
    })

    const d = await dinheirosDeRetiradaPendentes(prisma, companyId)
    expect(d).toHaveLength(1)
    expect(d[0]!.amount, 'número do banco').toBe(2849)
    expect(d[0]!.description, 'rótulo da mão').toBe('carro')
    expect(d[0]!.id).toBe(ofx.id)
  })

  /**
   * (e) ⭐ A retirada de UMA linha só (dinheiro do caixa, sem extrato) segue na fila
   * exatamente como hoje — a cura não pode comer o caso legítimo.
   */
  it('(e) retirada SEM par conciliado segue na fila, com o próprio rótulo e valor', async () => {
    const tx = await soManual('nura', 700, '2026-10-20')

    const d = await dinheirosDeRetiradaPendentes(prisma, companyId)
    expect(d).toHaveLength(1)
    expect(d[0]!.id).toBe(tx.id)
    expect(d[0]!.idDaGemea).toBeNull()
    expect(d[0]!.amount).toBe(700)
    expect(d[0]!.description).toBe('nura')
    expect(d[0]!.colapsado, 'não houve colapso — o rótulo não promete o que não entrega').toBe(false)
  })

  /**
   * (d) ⛔⛔ O CONTRAFACTUAL — a régua VELHA, reproduzida com o cenário completo de prod:
   * 3 fantasmas + 2 pares. Ela listava **7 linhas**; a nova lista **2 dinheiros**.
   */
  it('(d) a régua VELHA listava 7 linhas no cenário de prod; a nova lista 2', async () => {
    // os 3 fantasmas: par conciliado com ponte no lado OFX
    for (const f of [
      { rotulo: 'escola', valor: 100, dia: '2026-10-30' },
      { rotulo: 'escola', valor: 1318.57, dia: '2026-10-30' },
      { rotulo: 'carro', valor: 2845, dia: '2026-10-26' },
    ]) {
      const { ofx } = await parConciliado({
        rotulo: f.rotulo, descricaoExtrato: `EXTRATO ${f.rotulo}`,
        valorManual: f.valor, valorExtrato: f.valor, dia: f.dia,
      })
      await pontearLado(ofx.id, f.valor, f.dia)
    }
    // os 2 pares abertos
    await parConciliado({ rotulo: 'formatura', descricaoExtrato: 'EXTRATO formatura', valorManual: 190, valorExtrato: 190, dia: '2026-11-03' })
    await parConciliado({ rotulo: 'camiseta da formatura', descricaoExtrato: 'EXTRATO camiseta', valorManual: 59, valorExtrato: 59, dia: '2026-11-03' })

    // ⛔ a régua VELHA: exclusão de ponte NA PRÓPRIA LINHA
    const velha = await prisma.transaction.count({
      where: {
        bankAccount: { companyId }, type: 'DEBIT', lifecycle: 'EFFECTED',
        isInternalTransfer: false, transferGroupId: null, bridge: { is: null },
        category: { dreGroup: { in: ['DISTRIBUICAO_LUCROS'] } },
      },
    })
    expect(velha, '3 gêmeas MANUAL dos fantasmas + os 4 lados dos 2 pares').toBe(7)

    // ⭐ a régua NOVA
    const nova = await dinheirosDeRetiradaPendentes(prisma, companyId)
    expect(nova, 'só os 2 dinheiros realmente pendentes').toHaveLength(2)
    expect(nova.map((d) => d.description).sort()).toEqual(['camiseta da formatura', 'formatura'])
    expect(Math.round(nova.reduce((s, d) => s + d.amount, 0) * 100) / 100).toBe(249)
  })

  /** ⛔ o par cuja gêmea saiu do filtro (outra categoria) ainda conta como resolvido */
  it('⛔ gêmea FORA das candidatas, mas com ponte, ainda resolve o dinheiro', async () => {
    const outraCat = await prisma.category.create({
      data: { companyId, name: 'Outras Saídas', type: 'EXPENSE', dreGroup: 'DESPESA_OPERACIONAL' },
    })
    const { manual, ofx } = await parConciliado({
      rotulo: 'escola', descricaoExtrato: 'EXTRATO escola',
      valorManual: 100, valorExtrato: 100, dia: '2026-10-30',
    })
    // a gêmea do extrato deixa de ser "retirada" (categoria trocada) MAS tem a ponte
    await prisma.transaction.update({ where: { id: ofx.id }, data: { categoryId: outraCat.id } })
    await pontearLado(ofx.id, 100, '2026-10-30')

    const d = await dinheirosDeRetiradaPendentes(prisma, companyId)
    expect(d.map((x) => x.id), 'ausência da gêmea na lista não é ausência de ponte')
      .not.toContain(manual.id)
    expect(d).toHaveLength(0)
  })
})

/**
 * ⭐⭐⭐ (c) O GUARD POR DINHEIRO — NO SERVIDOR (05/11/2026)
 *
 * ⛔⛔ **A conta que ele impede:** o guard antigo era `if (pjTx.bridge)` + `@unique` em
 * `pjTransactionId` — os dois **por linha**. Com a ponte no lado OFX, confirmar a gêmea
 * MANUAL passava os dois e criava uma 2ª `PersonalTransaction` CREDIT do mesmo dinheiro.
 * Só nos dois pares abertos de prod eram **R$ 249,00 dobrados no PF**.
 *
 * ⚠️ A fila colapsada já não oferece o dinheiro resolvido — mas *régua que vive só na tela
 * some no dia em que a rota for chamada por outro caminho*, e o endpoint do lote chama
 * `createBridge` em laço. A trava é do servidor (REGRA 5: disciplina vira impossibilidade).
 */
describe('(c) o guard recusa a 2ª ponte do MESMO dinheiro', () => {
  let contaPf: string

  beforeEach(async () => {
    // acesso OWNER user↔profile: `createBridge` chama `checkProfileAccess(…, 'OWNER')`
    await prisma.userPersonalProfile.create({ data: { userId, profileId, role: 'OWNER' } })
    contaPf = (await prisma.personalBankAccount.create({
      data: { profileId, name: 'conta PF teste', accountType: 'CHECKING', balance: 0 },
    })).id
  })

  afterEach(async () => {
    await prisma.userPersonalProfile.deleteMany({ where: { profileId } }).catch(() => {})
    await prisma.personalBankAccount.deleteMany({ where: { profileId } }).catch(() => {})
  })

  const gesto = (pjTransactionId: string) => createBridge({
    userId, companyId, pjTransactionId, profileId, pfBankAccountId: contaPf,
    kind: 'DISTRIBUICAO', createdVia: 'CREATED_MANUAL', socioPFId: socioId,
  })

  it('⛔ ponte no lado OFX → a gêmea MANUAL é RECUSADA ("este dinheiro já tem ponte")', async () => {
    const { manual, ofx } = await parConciliado({
      rotulo: 'formatura', descricaoExtrato: 'Liege Da Silva Boeira - Transferência | Pix',
      valorManual: 190, valorExtrato: 190, dia: '2026-11-03',
    })

    await gesto(ofx.id) // o 1º, legítimo
    await expect(gesto(manual.id), 'a 2ª ponte do mesmo dinheiro dobraria o PF')
      .rejects.toThrow(/já tem ponte pro PF/)

    // ⭐ e nada ficou pela metade: UMA ponte, UMA entrada PF
    expect(await prisma.pJtoPFBridge.count({ where: { companyId } })).toBe(1)
    expect(await prisma.personalTransaction.count({ where: { profileId, type: 'CREDIT' } })).toBe(1)
  })

  it('⛔ e no sentido inverso também: ponte na MANUAL → a OFX é recusada', async () => {
    const { manual, ofx } = await parConciliado({
      rotulo: 'camiseta da formatura', descricaoExtrato: 'MARILIA FLORES PIRES - Transferência',
      valorManual: 59, valorExtrato: 59, dia: '2026-11-03',
    })

    await gesto(manual.id)
    await expect(gesto(ofx.id), 'o sentido do vínculo não pode abrir a porta')
      .rejects.toThrow(/já tem ponte pro PF/)
    expect(await prisma.pJtoPFBridge.count({ where: { companyId } })).toBe(1)
  })

  /** ⭐ o caso legítimo não foi comido: retirada sem par ainda pode virar ponte */
  it('⭐ retirada SEM par conciliado segue podendo virar ponte', async () => {
    const tx = await soManual('nura', 700, '2026-10-20')
    const r = await gesto(tx.id)
    expect(r.bridgeId).toBeTruthy()
    expect(await prisma.pJtoPFBridge.count({ where: { companyId } })).toBe(1)
  })

  /** ⛔ e a própria linha 2× segue barrada pelo guard antigo — a cura não o removeu */
  it('⛔ a MESMA linha 2× segue recusada (o guard antigo continua de pé)', async () => {
    const tx = await soManual('nura', 700, '2026-10-20')
    await gesto(tx.id)
    await expect(gesto(tx.id)).rejects.toThrow(/já tem ponte/)
    expect(await prisma.pJtoPFBridge.count({ where: { companyId } })).toBe(1)
  })
})

/**
 * ⭐⭐⭐ O COLAPSO, PURO E NOS DOIS SENTIDOS (05/11/2026)
 *
 * ⛔⛔ **ESTE BLOCO NASCEU DE DOIS FUROS MEDIDOS NA REGRA 11.** Repus `alvo = eu` (em vez de
 * `doExtrato ?? eu`) e a suíte ficou **VERDE**: os testes de integração criam o par com a
 * MESMA data, a consulta ordena por `date desc`, e **qual lado vem primeiro é indefinido** —
 * eles passavam por sorte de ordenação. *Teste que depende da ordem do banco não prova a
 * régua; ele prova o dia de sorte.*
 *
 * ⭐ `montarDinheiro` é pura: chamá-la com `eu = MANUAL` e com `eu = OFX` força os dois
 * sentidos e torna o resultado determinístico.
 */
describe('montarDinheiro — número do banco, rótulo da mão (determinístico)', () => {
  const lado = (over: Partial<LadoDaRetirada>): LadoDaRetirada => ({
    id: 'x', date: new Date('2026-10-26T12:00:00Z'), amount: 0, description: '',
    origin: 'MANUAL', temPonte: false, bankAccountId: 'b1', bankAccountName: 'stone',
    categoryId: 'c1', categoryName: 'Distribuição de Lucros', ...over,
  })

  /** o CARRO real: MANUAL 2.845,00 digitada · OFX 2.849,00 do extrato */
  const manual = lado({ id: 'manual', origin: 'MANUAL', amount: 2845, description: 'carro' })
  const ofx = lado({ id: 'ofx', origin: 'OFX', amount: 2849, description: 'LM TRANSP INTER SERV COM S A - Pagamento' })

  it('⛔ eu = MANUAL: o alvo é a OFX, o número é 2.849 e o rótulo é "carro"', () => {
    const d = montarDinheiro(manual, ofx)
    expect(d.id, 'o gesto vai no lado do extrato').toBe('ofx')
    expect(d.idDaGemea).toBe('manual')
    expect(d.amount, 'número do BANCO, não o digitado por aproximação').toBe(2849)
    expect(d.description, 'rótulo da MÃO').toBe('carro')
    expect(d.colapsado).toBe(true)
  })

  it('⛔ eu = OFX: a resposta é IDÊNTICA — o lado por onde eu cheguei não decide', () => {
    const a = montarDinheiro(manual, ofx)
    const b = montarDinheiro(ofx, manual)
    expect(b.id).toBe(a.id)
    expect(b.idDaGemea).toBe(a.idDaGemea)
    expect(b.amount).toBe(a.amount)
    expect(b.description).toBe(a.description)
  })

  it('sem par: o lado único responde pelos dois e `colapsado` é falso', () => {
    const d = montarDinheiro(lado({ id: 'so', amount: 700, description: 'nura' }), null)
    expect(d).toMatchObject({ id: 'so', idDaGemea: null, amount: 700, description: 'nura', colapsado: false })
  })

  /** ⚠️ duas MANUAIS conciliadas: sem lado de extrato, o gesto fica em `eu` — sem inventar preferência */
  it('duas linhas sem extrato: fica em `eu`, com o número dele', () => {
    const a = lado({ id: 'm1', amount: 100, description: 'escola' })
    const b = lado({ id: 'm2', amount: 100, description: 'escola (2)' })
    const d = montarDinheiro(a, b)
    expect(d.id).toBe('m1')
    expect(d.amount).toBe(100)
  })
})

/**
 * ⛔ O SENTIDO INVERSO CONTRA BANCO — o furo nº 1 da REGRA 11.
 *
 * O laço de `reconciledFrom` só é exercitado quando eu chego pelo lado do EXTRATO e a gêmea
 * MANUAL **não está** nas candidatas (ela é que aponta, e `reconciledWithId` só existe nela).
 * Meu primeiro teste tirou a OFX do filtro — o lado errado — e por isso removê-lo ficava
 * verde.
 */
describe('o par se enxerga pelos DOIS sentidos, contra banco', () => {
  it('⛔ MANUAL fora das candidatas e COM ponte → a OFX não vira retirada nova', async () => {
    const outraCat = await prisma.category.create({
      data: { companyId, name: 'Outras Saídas', type: 'EXPENSE', dreGroup: 'DESPESA_OPERACIONAL' },
    })
    const { manual, ofx } = await parConciliado({
      rotulo: 'escola', descricaoExtrato: 'COOPERATIVA DE PAIS E MESTRES DA ESCOLA',
      valorManual: 1318.57, valorExtrato: 1318.57, dia: '2026-10-30',
    })
    // a MANUAL sai do filtro (categoria trocada) e é ELA que tem a ponte
    await prisma.transaction.update({ where: { id: manual.id }, data: { categoryId: outraCat.id } })
    await pontearLado(manual.id, 1318.57, '2026-10-30')

    const d = await dinheirosDeRetiradaPendentes(prisma, companyId)
    expect(d.map((x) => x.id), 'só `reconciledFrom` acha a gêmea daqui').not.toContain(ofx.id)
    expect(d).toHaveLength(0)
  })

  it('⛔ MANUAL fora das candidatas e SEM ponte → a OFX aparece UMA vez, colapsada', async () => {
    const outraCat = await prisma.category.create({
      data: { companyId, name: 'Outras Saídas 2', type: 'EXPENSE', dreGroup: 'DESPESA_OPERACIONAL' },
    })
    const { manual, ofx } = await parConciliado({
      rotulo: 'formatura', descricaoExtrato: 'Liege Da Silva Boeira - Transferência | Pix',
      valorManual: 190, valorExtrato: 190, dia: '2026-11-03',
    })
    await prisma.transaction.update({ where: { id: manual.id }, data: { categoryId: outraCat.id } })

    const d = await dinheirosDeRetiradaPendentes(prisma, companyId)
    expect(d).toHaveLength(1)
    expect(d[0]!.id).toBe(ofx.id)
    expect(d[0]!.idDaGemea, 'a gêmea é achada mesmo fora do filtro').toBe(manual.id)
    expect(d[0]!.description, 'e o rótulo humano dela é usado').toBe('formatura')
  })
})
