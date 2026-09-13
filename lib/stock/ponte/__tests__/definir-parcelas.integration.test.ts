// ⭐⭐⭐ NOTA SEM VENCIMENTO VIRA CONTA A PAGAR — o caso MARIA LUIZA (13/09/2026).
//
// **Medido em prod antes de escrever:** 21 notas · R$ 8.588,75 no estado A DEFINIR,
// **todas sem duplicata nenhuma no XML**. A linha da stone de **2.843,35 (08/09)** paga
// 6 notas da MARIA LUIZA: 2 com conta (1.486,50) + **4 invisíveis** (463,74 · 326,69 ·
// 235,16 · 331,28 = **1.356,87**). A diferença que o card não fechava eram elas.
//
// ⚠️ Este teste roda o CAMINHO REAL (o mesmo orquestrador que a rota chama), não uma
// réplica da lógica — senão provaria o meu raciocínio, não o sistema.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { buildAuthContextForTest } from '@/lib/auth/rbac'
import { confirmarConferencia } from '../../confirmar-conferencia'
import { estadoDasParcelas } from '../estado-das-parcelas'
import { parcelasSemData } from '../vencimento'
import { checkPonteInvariants } from '../../ponte-invariants'
import {
  previewDefinirParcelas, definirParcelasEEnviar, notasSemVencimento, fraseDaFila, DefinirParcelasError,
} from '../definir-parcelas'

const CNPJ = '50607080000414'
const CNPJ_FORN = '88728027000148'
const TOTAL = 463.74 // a NF 68770459 da MARIA LUIZA, valor real
let companyId = ''
let userId = ''
let nfeId = ''
let itemNfeId = ''

const ctx = () => buildAuthContextForTest({ user: { id: userId }, company: { id: companyId }, permissions: ['*'] })

/** a nota como ela entrou de verdade: sem duplicata nenhuma no XML */
async function notaSemDuplicata() {
  // ⚠️ a chave é POSICIONAL: o nº da NF vive em [25,34) — 25 de prefixo + '068770459' + 10
  const chave = `4326088872802700014855001068770459162114${Math.floor(Math.random() * 9000 + 1000)}`
  const nfe = await prisma.stockNfe.create({
    data: { companyId, chave, nsu: '9', status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: true, emitNome: 'MARIA LUIZA COELHO PIENEGONDA', emitCnpj: CNPJ_FORN, vNF: TOTAL },
  })
  const item = await prisma.stockNfeItem.create({
    data: { companyId, nfeId: nfe.id, chave, nItem: 1, cProd: 'V1', xProd: 'VERDURA', uCom: 'KG', qCom: 10, vUnCom: 46.374, vProd: TOTAL },
  })
  return { nfeId: nfe.id, itemId: item.id }
}

const conferir = () => confirmarConferencia({
  companyId, nfeId, userId,
  fornecedor: { cnpj: CNPJ_FORN, nome: 'MARIA LUIZA COELHO PIENEGONDA' },
  itens: [{
    nfeItemId: itemNfeId, cProd: 'V1', xProd: 'VERDURA', uCom: 'KG',
    qtdNota: 10, vUnCom: 46.374, qtdRecebida: 10,
    mapeado: { itemId: '', nome: 'VERDURA', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', fatorConversao: 1, novo: true },
  }],
  // ⭐ o estado que o gesto novo existe pra resolver — agora escolhido, não esquecido
  pagamento: { semDataDefinirDepois: true },
})

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA DEFINIR' } })).id
  userId = (await prisma.user.create({ data: { email: `def-${companyId}@t.com`, password: 'x', name: 'Yussef' } })).id
  const n = await notaSemDuplicata()
  nfeId = n.nfeId; itemNfeId = n.itemId
  await conferir()
})

afterEach(async () => {
  await prisma.transaction.deleteMany({ where: { OR: [{ supplier: { companyId } }, { bankAccount: { companyId } }] } })
  await prisma.supplier.deleteMany({ where: { companyId } })
  for (const t of ['stockVencimentoEvento', 'stockPayableLink', 'stockPayableSuggestion', 'stockParcelaCombinada',
    'stockConferenceItem', 'stockReceiptConference', 'stockMovement', 'stockSaldoCache', 'stockItem',
    'stockSupplierProduct', 'stockSupplier', 'stockNfeItem', 'stockNfe'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ a nota A DEFINIR aparece — e tem gesto', () => {
  it('⛔⛔ o RECIBO não fica mudo: a parcela sem data é A_DEFINIR, não ausência', async () => {
    // ⚠️ antes de 13/09 o `combinadoDaNota` devolvia lista vazia (parcela sem data não
    // "vale") e o recibo não mostrava NADA — justamente onde havia dívida.
    const p = await estadoDasParcelas(companyId, nfeId, prisma)
    expect(p).toHaveLength(1)
    expect(p[0].estado).toBe('A_DEFINIR')
    expect(p[0].valor).toBeCloseTo(TOTAL, 2)
    expect(p[0].vencimento).toBeNull()
    expect(p[0].frase).toMatch(/defina as parcelas/)
  })

  it('⭐ a FILA lista a nota com fornecedor, número e total — é o roteiro do dono', async () => {
    const fila = await notasSemVencimento(companyId, prisma)
    expect(fila).toHaveLength(1)
    expect(fila[0].fornecedor).toBe('MARIA LUIZA COELHO PIENEGONDA')
    expect(fila[0].nNF).toBe('68770459')
    expect(fila[0].total).toBeCloseTo(TOTAL, 2)
    expect(fraseDaFila(fila)).toContain('463,74')
  })

  it('⛔⛔ e cada linha LEVA ao recibo — fila sem link é a porta sem maçaneta do outro lado', async () => {
    // ⚠️ a REGRA 11 pegou este buraco: sem esta asserção dava pra apagar a resolução do
    // `conferenceId` e a fila ficava VERDE listando o trabalho sem jeito de alcançá-lo.
    // É a 6ª volta da família (o motor em prod e o dedo do dono sem chegar nele).
    const [n] = await notasSemVencimento(companyId, prisma)
    const conf = await prisma.stockReceiptConference.findFirstOrThrow({ where: { companyId, nfeId } })
    expect(n.conferenceId, 'a linha da fila não abre o recibo').toBe(conf.id)
  })
})

describe('⭐⭐⭐ definir as parcelas CRIA a conta a pagar', () => {
  it('⭐⭐ 1 parcela → 1 conta a pagar, amarrada à nota', async () => {
    const r = await definirParcelasEEnviar({
      companyId, nfeId, parcelas: [{ valor: TOTAL, dVenc: '2026-09-08' }],
      cadastrarFornecedores: true, ctx: ctx(), userId,
    }, prisma)
    expect(r.contasCriadas).toBe(1)
    expect(r.valorTotal).toBeCloseTo(TOTAL, 2)
    expect(r.erros).toEqual([])

    // ⭐ a conta existe no FINANCEIRO, com a marca de origem da ponte
    const link = await prisma.stockPayableLink.findFirstOrThrow({ where: { companyId, refId: nfeId } })
    const conta = await prisma.transaction.findUniqueOrThrow({ where: { id: link.transactionId } })
    expect(conta.lifecycle).toBe('PAYABLE')
    expect(conta.origin).toBe('ESTOQUE_NF')
    expect(conta.dueDate?.toISOString().slice(0, 10)).toBe('2026-09-08')

    // ⭐⭐ e o RECIBO passa a contar a história: a parcela deixou de ser A_DEFINIR
    const p = await estadoDasParcelas(companyId, nfeId, prisma)
    expect(p).toHaveLength(1)
    expect(p[0].estado).toBe('ABERTA')
  })

  it('⭐ N parcelas → N contas, cada uma com o seu vencimento', async () => {
    const r = await definirParcelasEEnviar({
      companyId, nfeId,
      parcelas: [{ valor: 231.87, dVenc: '2026-09-08' }, { valor: 231.87, dVenc: '2026-10-08' }],
      cadastrarFornecedores: true, ctx: ctx(), userId,
    }, prisma)
    expect(r.contasCriadas).toBe(2)
    const p = await estadoDasParcelas(companyId, nfeId, prisma)
    expect(p.map((x) => x.vencimento)).toEqual(['2026-09-08', '2026-10-08'])
  })

  it('⭐⭐ e a nota SAI da fila — o F5 desce sozinho, sem ninguém marcar nada', async () => {
    expect((await checkPonteInvariants(prisma)).filter((f) => f.companyId === companyId && f.invariante === 'F5')).toHaveLength(1)
    await definirParcelasEEnviar({
      companyId, nfeId, parcelas: [{ valor: TOTAL, dVenc: '2026-09-08' }],
      cadastrarFornecedores: true, ctx: ctx(), userId,
    }, prisma)
    expect(await notasSemVencimento(companyId, prisma)).toEqual([])
    expect(await parcelasSemData(companyId, prisma)).toEqual([])
    // ⭐ o invariante é a MESMA pergunta da fila — os dois zeram juntos, por construção
    expect((await checkPonteInvariants(prisma)).filter((f) => f.companyId === companyId && f.invariante === 'F5')).toHaveLength(0)
  })
})

describe('⚠️ a soma que não fecha AVISA — e só passa com o motivo escrito', () => {
  it('⛔ soma diferente do total, sem motivo: RECUSA dizendo a diferença', async () => {
    const pv = await previewDefinirParcelas(companyId, nfeId, [{ valor: 500, dVenc: '2026-09-08' }], null, prisma)
    expect(pv.podeGravar).toBe(false)
    expect(pv.diferenca).toBeCloseTo(36.26, 2)
    expect(pv.erros.join(' ')).toMatch(/motivo/)
    await expect(definirParcelasEEnviar({
      companyId, nfeId, parcelas: [{ valor: 500, dVenc: '2026-09-08' }],
      cadastrarFornecedores: true, ctx: ctx(), userId,
    }, prisma)).rejects.toThrow(DefinirParcelasError)
    // ⛔ e nada nasce pela metade
    expect(await prisma.stockPayableLink.count({ where: { companyId } })).toBe(0)
  })

  it('⭐ COM o motivo passa — boleto com juros embutido é o mundo real', async () => {
    // ⚠️ travar aqui empurraria o dono a lançar a conta por fora, que é exatamente o que
    // produziu estas 21 notas
    const r = await definirParcelasEEnviar({
      companyId, nfeId, parcelas: [{ valor: 500, dVenc: '2026-09-08' }], motivo: 'juros do boleto',
      cadastrarFornecedores: true, ctx: ctx(), userId,
    }, prisma)
    expect(r.contasCriadas).toBe(1)
    const parc = await prisma.stockParcelaCombinada.findFirstOrThrow({ where: { companyId, refId: nfeId, ativo: true } })
    expect(parc.motivo).toBe('juros do boleto')
  })
})

describe('⛔ o gesto não invade o vizinho', () => {
  it('⛔⛔ nota que JÁ tem parcelas definidas manda pro gesto de RENEGOCIAR', async () => {
    await definirParcelasEEnviar({
      companyId, nfeId, parcelas: [{ valor: TOTAL, dVenc: '2026-09-08' }],
      cadastrarFornecedores: true, ctx: ctx(), userId,
    }, prisma)
    // dois caminhos pro mesmo fato divergiriam no 1º caso de borda — e aqui há contas
    // criadas que precisariam ser canceladas, coisa que só o gesto de renegociar faz
    await expect(definirParcelasEEnviar({
      companyId, nfeId, parcelas: [{ valor: TOTAL, dVenc: '2026-10-08' }],
      cadastrarFornecedores: true, ctx: ctx(), userId,
    }, prisma)).rejects.toThrow(/Ajustar parcelas/)
  })

  it('⛔ e nenhuma linha da PJ nasce sem o gesto — a fronteira do isolamento', async () => {
    // conferir a nota NÃO cria conta a pagar; quem cria é o dono, com `stock.manage`
    expect(await prisma.transaction.count({ where: { supplier: { companyId } } })).toBe(0)
    expect(await prisma.supplier.count({ where: { companyId } })).toBe(0)
  })
})
