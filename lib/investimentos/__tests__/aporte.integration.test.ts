/**
 * ⭐⭐⭐ O CICLO DO APORTE, CONTRA BANCO (25/09/2026).
 *
 * ⚠️ **REGRA 3:** isto EXECUTA o caminho real (`resolverLinha` → `registrarAporte`), não
 * procura string. O que morde é o efeito no banco: o vínculo, o rastro e o total derivado.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { resolverLinha } from '@/lib/conciliacao/resolver-linha'
import { registrarAporte, desfazerAporte, AporteError } from '../registrar-aporte'
import { contratosComTotais } from '../contratos'
import { estacaoDaLinha, comoFoiResolvida } from '@/lib/conciliacao/caixa-de-entrada'
import { categoriaResolveSozinha } from '@/lib/conciliacao/categoria-nao-quita'

const db = new PrismaClient()
/**
 * ⚠️ CNPJ exclusivo deste arquivo — e **o guard de 21/09 pegou o meu primeiro**
 * (o 1º já era do `e16-entrada-bate-com-nota`; o 2º, do `subscription/por-empresa` — **parei
 * de chutar e conferi contra os 157 CNPJs de teste do repo antes de escolher**). *Dois arquivos disputando a
 * mesma empresa se derrubam em paralelo, e o vermelho vira loteria.*
 */
const CNPJ = '61616161000161'

let companyId = ''
let bankAccountId = ''
let categoriaInvestimentoId = ''

beforeAll(async () => {
  await db.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await db.company.create({ data: { name: 'Aporte Teste', cnpj: CNPJ } })
  companyId = c.id
  const b = await db.bankAccount.create({ data: { companyId, name: 'banrisul teste', bankName: 'Banrisul', accountType: 'CHECKING' } })
  bankAccountId = b.id
  const cat = await db.category.create({
    data: { companyId, name: 'Investimentos', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS' },
  })
  categoriaInvestimentoId = cat.id
})

afterAll(async () => {
  await db.company.deleteMany({ where: { cnpj: CNPJ } })
  await db.$disconnect()
})

async function linha(valor: number, desc: string, data = new Date('2026-09-09T12:00:00Z')) {
  return db.transaction.create({
    data: {
      bankAccountId, type: 'DEBIT', amount: valor, date: data, description: desc,
      lifecycle: 'EFFECTED', status: 'PENDING', categoryId: categoriaInvestimentoId,
      // ⚠️ `origin: 'OFX'` — é o que a `lerCaixa` exige; fixture sem isso não entra na caixa
      origin: 'OFX',
    },
  })
}

async function contrato(nome: string, valorParcela: number, diaDoMes = 9) {
  return db.investmentContract.create({
    data: { companyId, nome, tipo: 'CONSORCIO', valorParcela, diaDoMes, bankAccountId },
  })
}

describe('⭐⭐ o gesto 📈 pela porta da caixa', () => {
  it('⭐ concilia, deixa o rastro NOMEADO e tira a linha da caixa', async () => {
    const ct = await contrato('Consórcio Randon', 1478.51)
    const tx = await linha(1478.51, 'PAGAMENTO CONSORCIO')

    const r = await resolverLinha({
      txId: tx.id, companyId, acao: 'APORTE_INVESTIMENTO', contractId: ct.id,
    }, db)

    expect(r.saiuDaCaixa).toBe(true)
    // ⭐ o efeito NOMEIA contrato, competência e o acumulado — "registrei" não seria efeito
    expect(r.efeito).toContain('Consórcio Randon')
    expect(r.efeito).toContain('2026-09')

    const depois = await db.transaction.findUnique({ where: { id: tx.id }, select: { notes: true } })
    expect(depois?.notes, 'o rastro não diz em qual contrato o dinheiro entrou')
      .toContain('aporte no Consórcio Randon, parcela de set/2026')

    const v = await db.investmentContribution.findUnique({ where: { transactionId: tx.id } })
    expect(v?.contractId).toBe(ct.id)
    expect(v?.valor).toBe(1478.51)
  })

  it('⛔⛔ a MESMA linha não vira dois aportes', async () => {
    const ct = await contrato('Consórcio Duplo', 500)
    const tx = await linha(500, 'PAGAMENTO CONSORCIO')
    await registrarAporte({ db, companyId, contractId: ct.id, txId: tx.id })
    await expect(registrarAporte({ db, companyId, contractId: ct.id, txId: tx.id }))
      .rejects.toThrow(AporteError)
    expect(await db.investmentContribution.count({ where: { contractId: ct.id } })).toBe(1)
  })

  it('⛔ ENTRADA é recusada — aporte é dinheiro que SAI', async () => {
    const ct = await contrato('Consórcio Entrada', 300)
    const tx = await db.transaction.create({
      data: { bankAccountId, type: 'CREDIT', amount: 300, date: new Date('2026-09-09T12:00:00Z'), description: 'CREDITO', lifecycle: 'EFFECTED', status: 'PENDING' },
    })
    await expect(registrarAporte({ db, companyId, contractId: ct.id, txId: tx.id })).rejects.toThrow(AporteError)
  })

  it('⛔ contrato ENCERRADO recusa — e a recusa ENSINA o caminho', async () => {
    const ct = await contrato('Consórcio Encerrado', 700)
    await db.investmentContract.update({ where: { id: ct.id }, data: { ativo: false } })
    const tx = await linha(700, 'PAGAMENTO CONSORCIO')
    await expect(registrarAporte({ db, companyId, contractId: ct.id, txId: tx.id }))
      .rejects.toThrow(/Reative-o em Investimentos/)
  })

  it('⛔ contrato de OUTRA empresa é recusado (REGRA 8)', async () => {
    const outra = await db.company.create({ data: { name: 'Outra', cnpj: '63636363000163' } })
    const ct = await db.investmentContract.create({
      data: { companyId: outra.id, nome: 'De outra empresa', tipo: 'CONSORCIO', valorParcela: 100, diaDoMes: 1 },
    })
    const tx = await linha(100, 'PAGAMENTO CONSORCIO')
    await expect(registrarAporte({ db, companyId, contractId: ct.id, txId: tx.id })).rejects.toThrow(AporteError)
    await db.company.delete({ where: { id: outra.id } })
  })
})

describe('⭐⭐ o total aportado é DERIVADO — nunca um campo gravado', () => {
  it('⭐ soma os vínculos, e o declarado-antes fica SEPARADO', async () => {
    const ct = await db.investmentContract.create({
      data: { companyId, nome: 'Consórcio Longo', tipo: 'CONSORCIO', valorParcela: 200, diaDoMes: 5, bankAccountId, totalParcelas: 80, parcelasPagasAoIniciar: 12 },
    })
    for (const m of ['2026-07', '2026-08', '2026-09']) {
      const tx = await linha(200, 'PAGAMENTO CONSORCIO', new Date(`${m}-05T12:00:00Z`))
      await registrarAporte({ db, companyId, contractId: ct.id, txId: tx.id })
    }
    const lista = await contratosComTotais(companyId, db)
    const c = lista.find((x) => x.id === ct.id)!
    expect(c.totalAportado).toBe(600)
    expect(c.aportes).toBe(3)
    /**
     * ⭐ 12 declaradas + 3 conciliadas. ⚠️ Uma coisa é o que o SISTEMA viu, outra é o que o
     * dono DECLAROU ter pago antes — misturar faria a tela afirmar um histórico que
     * ninguém conferiu.
     */
    expect(c.parcelasPagasTotal).toBe(15)
    expect(c.parcelasRestantes).toBe(65)
  })

  it('⛔ sem total conhecido, "restantes" é null — 0 se leria como "acabou"', async () => {
    const ct = await contrato('Capitalização sem fim', 70.02)
    const lista = await contratosComTotais(companyId, db)
    expect(lista.find((x) => x.id === ct.id)!.parcelasRestantes).toBeNull()
  })
})

describe('⭐ desfazer devolve a linha ao estado anterior', () => {
  it('⭐ apaga o vínculo E tira o rastro', async () => {
    const ct = await contrato('Consórcio Desfaz', 999)
    const tx = await linha(999, 'PAGAMENTO CONSORCIO')
    await registrarAporte({ db, companyId, contractId: ct.id, txId: tx.id })
    await desfazerAporte(db, companyId, tx.id)
    expect(await db.investmentContribution.findUnique({ where: { transactionId: tx.id } })).toBeNull()
    const depois = await db.transaction.findUnique({ where: { id: tx.id }, select: { notes: true } })
    expect(depois?.notes ?? '', 'o rastro ficou falando de um vínculo que não existe mais')
      .not.toContain('aporte no Consórcio Desfaz')
  })
})

describe('⛔⛔⛔ O APORTE SÓ SAI DA CAIXA COM O CONTRATO VINCULADO', () => {
  /**
   * ⚠️⚠️ **ESTE BLOCO NASCEU DE UM DEFEITO QUE EU CRIEI E MEDI EM PROD.** Ao pôr
   * `INVESTIMENTOS` na lista fechada (item 4, correto — consórcio não emite boleto), a
   * categoria passou a resolver sozinha e **os aportes saíram da caixa**: medido,
   * **14 → 4 linhas**, e o gesto 📈 ficou **inalcançável**. *A porta sem maçaneta, a 11ª
   * volta.*
   *
   * ⭐ A cura é a régua do CARTÃO (20/09): ***a flag diz "parece", o vínculo diz "é"***.
   */
  const base = {
    categoryId: 'cat', dreGroupDaCategoria: 'INVESTIMENTOS',
    isCardPayment: false, faturaVinculada: false, temParcelaVinculada: false,
    temReconciledFrom: false, isInternalTransfer: false, pendingTransfer: false,
    tipo: 'DEBIT', ignoredAt: null, reconciledWithId: null, transferGroupId: null,
    avulsaConfirmada: false,
  }

  it('⛔ SEM vínculo a linha FICA na caixa — é onde o gesto 📈 mora', () => {
    expect(estacaoDaLinha({ ...base, temAporteVinculado: false } as never),
      'o aporte foi arquivado sem ninguém dizer em qual contrato o dinheiro entrou').toBe('CAIXA')
  })

  it('⭐ COM vínculo ela sai, com o selo que nomeia o que houve', () => {
    expect(estacaoDaLinha({ ...base, temAporteVinculado: true } as never)).toBe('ARQUIVO')
    expect(comoFoiResolvida({ ...base, temAporteVinculado: true } as never)).toBe('aporte em investimento')
  })

  it('⛔⛔ e ela NÃO cobra nota — o item 4 continua valendo', () => {
    /**
     * ⭐ A diferença que importa: ela fica na caixa esperando o **CONTRATO**, nunca a NOTA.
     * O aviso *"categorizada, mas sem vínculo — casa com a nota"* cobraria um boleto que o
     * consórcio jamais emite.
     */
    expect(categoriaResolveSozinha('INVESTIMENTOS'),
      'o grupo saiu da lista fechada e voltou a cobrar nota').toBe(true)
  })

  it('⭐⭐ o ciclo inteiro: fica na caixa → gesto → sai com o selo', async () => {
    const ct = await contrato('Consórcio Ciclo', 321.45)
    const tx = await linha(321.45, 'PAGAMENTO CONSORCIO')

    const { lerCaixa, paraLei } = await import('@/lib/conciliacao/leitura-da-caixa')
    const antes = await lerCaixa(companyId, db)
    const linhaAntes = antes.rows.find((r) => r.id === tx.id)
    expect(linhaAntes, 'a linha nem apareceu na leitura').toBeTruthy()
    expect(estacaoDaLinha(paraLei(linhaAntes!)), 'sem vínculo ela devia estar na CAIXA').toBe('CAIXA')

    await registrarAporte({ db, companyId, contractId: ct.id, txId: tx.id })

    const depois = await lerCaixa(companyId, db)
    const linhaDepois = depois.rows.find((r) => r.id === tx.id)!
    expect(estacaoDaLinha(paraLei(linhaDepois)), 'com vínculo ela devia ter saído').toBe('ARQUIVO')
    expect(comoFoiResolvida(paraLei(linhaDepois))).toBe('aporte em investimento')
  })
})
