/**
 * ⭐⭐⭐ EQUIPAMENTO NÃO GERA POSIÇÃO — O CASO REAL DA BOLEADORA BOL600 (20/10/2026).
 *
 * **O item 4 do brief, ao pé da letra:** *"Red-then-green: NF com linha de equipamento →
 * zero movimento de estoque criado; repondo a categoria antiga no caso → posição nasce
 * (vermelho do defeito)."*
 *
 * ⛔⛔ **O CONTRAFACTUAL É O CORAÇÃO DESTE ARQUIVO.** Um teste que só afirme *"a boleadora
 * não virou item"* fica **VERDE de graça** se alguém trocar o destino por uma categoria de
 * estoque — porque aí o `destino` deixa de existir e nenhuma asserção nova aparece. Então o
 * mesmo arquivo manda a MESMA nota pelo caminho ANTIGO (uma categoria de estoque, o único
 * que o funil oferecia até ontem) e exige a posição NASCER — é o que prova que a diferença
 * vem do DESTINO, e não de a nota ser estranha.
 *
 * ⚠️ A régua é a REGRA 3: isto **roda o `confirmarConferencia` de verdade contra o banco**,
 * nunca grep na fonte. Grep não distingue *"refatorei"* de *"quebrei"*.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { confirmarConferencia } from '../confirmar-conferencia'
import { listarEquipamentos, destinosEquipamentoAprendidos, linhasDeEquipamento } from '../equipamento'
import { listPosicao } from '../posicao'
import { snapshotClosedModules, isolationHeld } from '../stock-invariants'
import { DESTINO_EQUIPAMENTO } from '../destino-da-linha'

const CNPJ = '17171717000117'
const FORN = '62626262000162'
const CHAVE = '43261062626262000162550100000009991234567890'
let companyId: string
let nfeId: string
let linhaBoleadora: string
let linhaCaixa: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA EQUIPAMENTO' } })).id
  const nfe = await prisma.stockNfe.create({
    data: {
      companyId, chave: CHAVE, nsu: '000000000000777', status: 'AGUARDANDO_MERCADORIA',
      temXmlCompleto: true, emitCnpj: FORN, emitNome: 'MAQUINAS BOL LTDA',
      dataEmissao: new Date('2026-10-20'), vNF: 21150,
    },
  })
  nfeId = nfe.id
  // ⭐ o caso REAL: a boleadora de 1 UN. A caixa de embalagem existe pra o teste da nota
  // MISTA (equipamento + mercadoria no MESMO documento) poder existir.
  linhaBoleadora = (await prisma.stockNfeItem.create({
    data: { companyId, nfeId, chave: CHAVE, nItem: 1, cProd: 'BOL600', xProd: 'BOLEADORA BOL600', uCom: 'UN', qCom: 1, vUnCom: 21000, vProd: 21000 },
  })).id
  linhaCaixa = (await prisma.stockNfeItem.create({
    data: { companyId, nfeId, chave: CHAVE, nItem: 2, cProd: 'CX30', xProd: 'CAIXA PAPELAO 30CM', uCom: 'UN', qCom: 50, vUnCom: 3, vProd: 150 },
  })).id
  // ⚠️ a duplicata existe porque a nota REAL traz boleto: **sem nenhuma, o
  // `confirmarConferencia` RECUSA pedindo o vencimento** (a porta que fechou a fábrica das
  // 21 notas, 13/09) — e aí o teste falharia por um motivo que não tem nada a ver com
  // equipamento, escondendo o que ele existe pra medir.
  await prisma.stockNfeDup.create({
    data: { companyId, nfeId, nDup: '001', dVenc: new Date('2026-11-20'), vDup: 21150 },
  })
})

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of [
    'stockMovement', 'stockConferenceItem', 'stockReceiptConference', 'stockPayableSuggestion',
    'stockSupplierProduct', 'stockSupplierEquipamento', 'stockEquipamento', 'stockSaldoCache',
    'stockNfeDup', 'stockNfeItem', 'stockNfe', 'stockItem', 'stockSupplier',
  ] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** a mesma nota, com a boleadora indo pelo FUNIL de equipamento */
const comoEquipamento = () => confirmarConferencia({
  companyId, nfeId, userId: 'dono-1',
  fornecedor: { cnpj: FORN, nome: 'MAQUINAS BOL LTDA', uf: 'RS' },
  itens: [
    {
      nfeItemId: linhaBoleadora, cProd: 'BOL600', xProd: 'BOLEADORA BOL600', uCom: 'UN',
      qtdNota: 1, vUnCom: 21000, qtdRecebida: 1,
      destino: DESTINO_EQUIPAMENTO, equipamentoNome: 'Boleadora BOL600', mapeado: null,
    },
  ],
})

/** ⛔ a MESMA nota pelo caminho ANTIGO — o vermelho do defeito */
const comoEstoque = () => confirmarConferencia({
  companyId, nfeId, userId: 'dono-1',
  fornecedor: { cnpj: FORN, nome: 'MAQUINAS BOL LTDA', uf: 'RS' },
  itens: [
    {
      nfeItemId: linhaBoleadora, cProd: 'BOL600', xProd: 'BOLEADORA BOL600', uCom: 'UN',
      qtdNota: 1, vUnCom: 21000, qtdRecebida: 1,
      mapeado: { itemId: 'novo-1', nome: 'BOLEADORA BOL600', unidadeControle: 'UN', categoria: 'USO_INTERNO', fatorConversao: 1, novo: true },
    },
  ],
})

/**
 * ⭐ a POSIÇÃO como a TELA a vê — e ela parte do **CATÁLOGO** (11/09), não do ledger: item
 * que nunca nasceu não tem como aparecer nem com saldo zero. É a prova mais forte que
 * existe de que a máquina não virou linha de prateleira.
 */
const naPosicao = async () => (await listPosicao(companyId, prisma)).itens

describe('⭐ NF com linha de EQUIPAMENTO: zero movimento de estoque', () => {
  it('⭐⭐ a boleadora NÃO cria item, NÃO gera movimento e NÃO entra em valorEntrada', async () => {
    const r = await comoEquipamento()

    expect(r.movimentos, 'a boleadora gerou movimento de estoque').toBe(0)
    expect(r.itensCadastrados, 'a boleadora virou item de prateleira').toBe(0)
    expect(r.valorEntrada, 'a máquina entrou no valor que foi pra o estoque').toBe(0)
    // ⭐ o valor dela aparece, mas no campo DELA — nunca somado ao estoque
    expect(r.valorEquipamentos).toBe(21000)
    expect(r.equipamentos).toBe(1)

    expect(await naPosicao(), 'a máquina apareceu na Posição').toHaveLength(0)
    expect(await prisma.stockMovement.count({ where: { companyId } })).toBe(0)
    expect(await prisma.stockItem.count({ where: { companyId } })).toBe(0)
  })

  it('⭐ ela entra no CADASTRO DE EQUIPAMENTOS, com o nome do DONO e o rastro da nota', async () => {
    await comoEquipamento()
    const lista = await listarEquipamentos(companyId, prisma)

    expect(lista.quantos).toBe(1)
    expect(lista.totalInvestido).toBe(21000)
    const e = lista.linhas[0]
    expect(e.nome, 'o nome do dono perdeu pro xProd da SEFAZ').toBe('Boleadora BOL600')
    expect(e.valor).toBe(21000)
    expect(e.quantidade).toBe(1)
    expect(e.unidade).toBe('UN')
    expect(e.fornecedor).toBe('MAQUINAS BOL LTDA')
    expect(e.data, 'a data é a EMISSÃO da nota, nunca o dia do conserto').toBe('2026-10-20')
    expect(e.nNF, 'o nº da nota saiu da chave pra o dono reconhecer').toBe('999')
    expect(e.conferenceId, 'sem conferência o recibo não tem como ser aberto').toBeTruthy()
  })

  it('⭐ a LINHA fica na conferência (com itemId NULL) — rastro não se apaga pra calar alarme', async () => {
    // ⚠️ apagar a linha "pra limpar a conta do E2" trocaria um alarme falso por um BURACO:
    // o dono conferiu a boleadora, e isso é um fato.
    await comoEquipamento()
    const linhas = await prisma.stockConferenceItem.findMany({ where: { companyId } })
    expect(linhas).toHaveLength(1)
    expect(linhas[0].itemId, 'a linha de equipamento apontou pra um item de estoque').toBeNull()
    expect(linhas[0].xProd).toBe('BOLEADORA BOL600')
  })

  it('⭐⭐ a RÉGUA ÚNICA vê a linha — é dela que o E2 e o E16 descontam', async () => {
    const r = await comoEquipamento()
    const linhas = await linhasDeEquipamento(prisma, companyId)
    expect(linhas).toHaveLength(1)
    expect(linhas[0].nfeItemId).toBe(linhaBoleadora)
    expect(linhas[0].chave).toBe(CHAVE)
    expect(linhas[0].valor).toBe(21000)
    // o E2 conta LINHA conferida × movimento vigente; sem a régua, esta nota ficaria
    // vermelha TODA NOITE sobre um recebimento CORRETO
    expect(linhas[0].conferenceId).toBeTruthy()
    expect(r.movimentos).toBe(0)
  })

  it('⭐ a nota NÃO se confirma duas vezes — o investido não dobra', async () => {
    await comoEquipamento()
    // ⚠️ o nome é honesto: quem barra aqui é o guard de RE-CONFERÊNCIA do motor, não o
    // upsert do cadastro. O upsert (por `companyId_nfeItemId`) existe pra os caminhos que
    // reabrem a conferência — e afirmar que ele é o que segura ISTO seria inventar.
    await expect(comoEquipamento()).rejects.toThrow(/já foi conferida/i)
    const lista = await listarEquipamentos(companyId, prisma)
    expect(lista.quantos).toBe(1)
    expect(lista.totalInvestido).toBe(21000)
  })

  it('⭐ o mapeamento é APRENDIDO: "BOLEADORA → equipamento, uma vez só"', async () => {
    await comoEquipamento()
    const ap = await destinosEquipamentoAprendidos(prisma, companyId, FORN)
    expect(ap.porCodigo.has('BOL600'), 'a próxima nota do mesmo fornecedor não vem pré-marcada').toBe(true)
    expect(ap.porNome.size).toBeGreaterThan(0)
  })
})

describe('⛔ O VERMELHO DO DEFEITO — a MESMA nota pelo caminho antigo', () => {
  it('⛔⛔ repondo a categoria de estoque, a POSIÇÃO NASCE (a máquina polui o estoque)', async () => {
    const r = await comoEstoque()

    // é exatamente o estado que o sprint existe pra impedir
    expect(r.movimentos).toBe(1)
    expect(r.itensCadastrados).toBe(1)
    expect(r.valorEntrada).toBe(21000)
    expect(r.valorEquipamentos).toBe(0)

    const pos = await naPosicao()
    const maquina = pos.find((p) => /BOLEADORA/i.test(p.nome))
    expect(maquina, 'a máquina DEVERIA aparecer na posição por este caminho').toBeTruthy()
    expect(maquina!.saldo).toBe(1)
    // ⭐ e o custo médio de R$ 21.000 é o que envenenaria ficha, cardápio e CMV
    expect(maquina!.custoMedio).toBe(21000)

    // ⛔ e NADA no cadastro de equipamentos — a máquina some do lugar dela
    expect((await listarEquipamentos(companyId, prisma)).quantos).toBe(0)
  })
})

describe('⚠️ nota MISTA — cada linha segue o SEU destino', () => {
  it('⭐ a boleadora vira equipamento e a caixa vira estoque, na MESMA nota', async () => {
    const r = await confirmarConferencia({
      companyId, nfeId, userId: 'dono-1',
      fornecedor: { cnpj: FORN, nome: 'MAQUINAS BOL LTDA', uf: 'RS' },
      itens: [
        {
          nfeItemId: linhaBoleadora, cProd: 'BOL600', xProd: 'BOLEADORA BOL600', uCom: 'UN',
          qtdNota: 1, vUnCom: 21000, qtdRecebida: 1,
          destino: DESTINO_EQUIPAMENTO, equipamentoNome: 'Boleadora BOL600', mapeado: null,
        },
        {
          nfeItemId: linhaCaixa, cProd: 'CX30', xProd: 'CAIXA PAPELAO 30CM', uCom: 'UN',
          qtdNota: 50, vUnCom: 3, qtdRecebida: 50,
          mapeado: { itemId: 'novo-2', nome: 'Caixa papelão 30cm', unidadeControle: 'UN', categoria: 'EMBALAGEM', fatorConversao: 1, novo: true },
        },
      ],
    })

    expect(r.movimentos, 'só a caixa move o estoque').toBe(1)
    expect(r.itensCadastrados).toBe(1)
    expect(r.valorEntrada).toBe(150)
    expect(r.valorEquipamentos).toBe(21000)

    const pos = await naPosicao()
    expect(pos).toHaveLength(1)
    expect(pos[0].nome).toBe('Caixa papelão 30cm')
    expect((await listarEquipamentos(companyId, prisma)).quantos).toBe(1)
  })
})

describe('⛔ a recusa que ENSINA — linha de estoque sem item não some em silêncio', () => {
  it('RECUSA nomeando o produto e a saída, sem gravar nada', async () => {
    // ⚠️ a tela já barra; a rota pode ser chamada por outro caminho, e aí esta recusa é a
    // única proteção que sobra contra a nota entrar com um item a MENOS, calada.
    await expect(confirmarConferencia({
      companyId, nfeId, userId: 'dono-1',
      fornecedor: { cnpj: FORN, nome: 'MAQUINAS BOL LTDA', uf: 'RS' },
      itens: [{
        nfeItemId: linhaCaixa, cProd: 'CX30', xProd: 'CAIXA PAPELAO 30CM', uCom: 'UN',
        qtdNota: 50, vUnCom: 3, qtdRecebida: 50, mapeado: null,
      }],
    })).rejects.toThrow(/CAIXA PAPELAO 30CM[\s\S]*Equipamento/)

    expect(await prisma.stockMovement.count({ where: { companyId } })).toBe(0)
    expect(await prisma.stockReceiptConference.count({ where: { companyId } })).toBe(0)
  })
})

describe('⚠️ ISOLAMENTO — equipamento não atravessa a fronteira', () => {
  it('registrar equipamento não escreve em NENHUM módulo fechado', async () => {
    const antes = await snapshotClosedModules(prisma, companyId)
    await comoEquipamento()
    const depois = await snapshotClosedModules(prisma, companyId)
    expect(isolationHeld(antes, depois), 'o cadastro de equipamento tocou o financeiro').toBe(true)
  })
})
