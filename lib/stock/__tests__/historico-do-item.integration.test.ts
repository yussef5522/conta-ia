// ⛔⛔⛔ O HISTÓRICO DO ITEM — cada linha diz O QUE É, QUEM FEZ e DE ONDE VEIO (08/09/2026).
//
// **O CASO DO DONO:** *"A tela 'Histórico de compras' mistura tudo e mente no rótulo: linhas
// NEGATIVAS (consumo!) aparecem como 'recibo' de compra, entradas grandes sem dizer se foi
// contagem/ajuste/estorno, e NADA diz quem fez."*
//
// **MEDIDO EM PROD, no BACON (`cmtda5dwo006nek1cy78rlzvn`), antes de mexer em código:**
//   19 linhas na tela de "compras" · 16 NÃO eram compra · 14 eram NEGATIVAS
//   tipos: AJUSTE_CONTAGEM=4 · PRODUCAO_CONSUMO=6 · SEPARACAO_SAIDA=6 · ENTRADA_NF=3
//   e as 19 linkavam pra /estoque/recibos/{receiptId} — inclusive as de contagem e produção.
//
// **O PAR ±222 QUE O DONO ESTAVA OLHANDO, com os ids:**
//   [cmtmfja4v00c47928yywxsq18] 04/09 · AJUSTE_CONTAGEM · +222,19 KG · R$ 6.661,26
//   [cmtsxzxet00rylxp5xheux6a1] 08/09 · AJUSTE_CONTAGEM · −222,01 KG · R$ −6.631,44
//   ⭐ os DOIS apontam pro MESMO `receiptId` cmtmf0htx00007928189dzw11 — uma sessão de
//   contagem ROTINA que segue ABERTA. Não é compra nem consumo: é **a mesma linha de
//   contagem RECONTADA** (`@@unique(contagemId,itemId)` → recontar vira UPDATE da linha e
//   gera o ajuste compensatório). Líquido +0,18 KG.
//
// A fixture abaixo reproduz essa cena com os números reais.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { buildFichaItem } from '../ficha-item'
import { listMovimentos } from '../movimentos'
import { faceDoTipo, rotuloDoPreco, explicarMovimentos } from '../movimento-explicado'

const CNPJ = '55901224000177'
let companyId = ''
let itemId = ''
let userId = ''
let conferenceId = ''
let contagemId = ''
let ordemId = ''
let importId = ''

const CHAVE = '4326' + '0'.repeat(21) + '000001234' + '0'.repeat(10)

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.user.deleteMany({ where: { email: 'hist-item@teste.local' } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'HIST' } })).id
  userId = (await prisma.user.create({ data: { email: 'hist-item@teste.local', name: 'Yussef', password: 'x' } })).id
  itemId = (await prisma.stockItem.create({
    data: { companyId, nome: 'BACON', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })).id

  const nfe = await prisma.stockNfe.create({
    data: { companyId, chave: CHAVE, nsu: '1', status: 'CONFIRMADA', emitNome: 'FRIGORIFICO SILVA', dataEmissao: new Date('2026-09-04') },
  })
  conferenceId = (await prisma.stockReceiptConference.create({
    data: { companyId, nfeId: nfe.id, chave: CHAVE, status: 'CONFIRMADA' },
  })).id
  contagemId = (await prisma.stockContagem.create({
    data: { companyId, tipo: 'ROTINA', status: 'ABERTA', iniciadaEm: new Date('2026-09-04T03:50:00Z'), criadoPorId: userId, criadoPorNome: 'Yussef' },
  })).id
  const itemProduzido = await prisma.stockItem.create({
    data: { companyId, nome: 'Porção de bacon', unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
  })
  const ficha = await prisma.stockFicha.create({
    data: { companyId, itemProduzidoId: itemProduzido.id, tipoProduto: 'INTERMEDIARIO' },
  })
  ordemId = (await prisma.stockProductionOrder.create({
    data: { companyId, fichaId: ficha.id, versaoFicha: 1, itemProduzidoId: itemProduzido.id, estado: 'CONCLUIDA', escalaReceitas: 1, dataProducao: new Date('2026-09-06T12:00:00Z') },
  })).id
  importId = (await prisma.stockVendaImport.create({
    data: { companyId, data: new Date('2026-09-07T00:00:00Z'), totalLinhas: 10, totalUnidades: 40, criadoPorId: userId },
  })).id
})

afterEach(async () => {
  for (const t of ['stockContagemItem', 'stockContagem', 'stockVendaImport', 'stockMovement', 'stockReceiptConference', 'stockNfe', 'stockProductionOrder', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.user.deleteMany({ where: { id: userId } })
})

/** as linhas reais do BACON, na mesma forma em que estão em prod */
async function cenaDoBacon() {
  const mk = (d: Record<string, unknown>) =>
    prisma.stockMovement.create({ data: { companyId, itemId, origem: 'MANUAL', criadoPorId: userId, ...d } as never })

  const compra = await mk({
    tipo: 'ENTRADA_NF', quantidade: 58.42, custoUnitario: 29.98, custoTotal: 1751.43,
    nfeChave: CHAVE, receiptId: conferenceId, origem: 'SEFAZ',
    dataMovimento: new Date('2026-09-04T10:00:00Z'),
  })
  // ⭐ o par ±222: a MESMA linha de contagem, contada e depois RECONTADA
  const cont1 = await mk({
    tipo: 'AJUSTE_CONTAGEM', quantidade: 222.19, custoUnitario: 29.98, custoTotal: 6661.26,
    receiptId: contagemId, dataMovimento: new Date('2026-09-04T04:04:00Z'),
  })
  const cont2 = await mk({
    tipo: 'AJUSTE_CONTAGEM', quantidade: -222.01, custoUnitario: 29.87, custoTotal: -6631.44,
    receiptId: contagemId, dataMovimento: new Date('2026-09-08T17:27:00Z'),
  })
  await prisma.stockContagemItem.create({
    data: {
      companyId, contagemId, itemId, saldoSistema: 0, qtdContada: 0.18, divergencia: -222.01,
      custoUnitario: 29.87, valorDivergencia: -6631.44, movementId: cont2.id,
      contadoPorId: userId, contadoPorNome: 'Carlise',
    },
  })
  const consumo = await mk({
    tipo: 'PRODUCAO_CONSUMO', quantidade: -15.05, custoUnitario: 29.9, custoTotal: -449.99,
    receiptId: ordemId, dataMovimento: new Date('2026-09-06T14:00:00Z'),
  })
  const venda = await mk({
    tipo: 'BAIXA_VENDA', quantidade: -3.2, custoUnitario: 29.9, custoTotal: -95.68,
    receiptId: importId, dataMovimento: new Date('2026-09-07T20:00:00Z'),
  })
  const estorno = await mk({
    tipo: 'ESTORNO', quantidade: -58.42, custoUnitario: 29.98, custoTotal: -1751.43,
    nfeChave: CHAVE, receiptId: conferenceId, estornoDeId: compra.id, origem: 'SEFAZ',
    dataMovimento: new Date('2026-09-08T09:00:00Z'),
  })
  return { compra, cont1, cont2, consumo, venda, estorno }
}

describe('⛔⛔ a tela deixou de ser "compras" e passou a ser HISTÓRICO', () => {
  it('⛔ NENHUMA linha sobra com o rótulo "recibo" — cada uma tem o TIPO real', async () => {
    await cenaDoBacon()
    const f = (await buildFichaItem(companyId, itemId))!
    expect(f.historico).toHaveLength(6)
    for (const l of f.historico) {
      expect(l.chip, `“${l.tipo}” ficou sem chip`).toBeTruthy()
      expect(l.chip.toLowerCase()).not.toBe('recibo')
      expect(l.detalhe.toLowerCase()).not.toBe('recibo')
    }
    expect(f.historico.map((l) => l.chip)).toEqual([
      'Contagem', 'Estorno', 'Baixa de venda', 'Produção · consumiu', 'Compra (NF-e)', 'Contagem',
    ])
  })

  it('⛔⛔ O PAR ±222 é CONTAGEM — não compra, não consumo — e aponta pra MESMA sessão', async () => {
    const { cont1, cont2 } = await cenaDoBacon()
    const f = (await buildFichaItem(companyId, itemId))!
    const a = f.historico.find((l) => l.movimentoId === cont1.id)!
    const b = f.historico.find((l) => l.movimentoId === cont2.id)!

    expect(a.chip).toBe('Contagem')
    expect(b.chip).toBe('Contagem')
    expect(a.familia).toBe('CONTAGEM')
    expect(a.sentido).toBe('AJUSTE')
    // ⭐ os dois levam pra MESMA sessão — é o que explica o par
    expect(a.href).toBe(`/empresas/${companyId}/estoque/contagens#c-${contagemId}`)
    expect(b.href).toBe(a.href)
    expect(a.detalhe).toContain('contagem de 04/09')
    expect(a.detalhe).toContain('rotina')
    // ⛔ e NÃO é preço de compra: é ajuste sobre o custo médio
    expect(a.precoEhDeCompra).toBe(false)
    expect(a.precoRotulo).toBe('Custo médio un.')
    expect(a.ehCompra).toBe(false)
  })

  it('⭐ QUEM: a contagem mostra quem CONTOU, não quem abriu a sessão', async () => {
    const { cont2, compra } = await cenaDoBacon()
    const f = (await buildFichaItem(companyId, itemId))!
    // ⚠️ a linha da contagem foi contada pela Carlise; o movimento foi gravado pelo Yussef.
    // Numa sessão longa quem conta pode não ser quem abriu — o desnormalizado é mais preciso.
    expect(f.historico.find((l) => l.movimentoId === cont2.id)!.quem).toBe('Carlise')
    expect(f.historico.find((l) => l.movimentoId === compra.id)!.quem).toBe('Yussef')
  })

  it('⭐ DE ONDE: cada tipo linka pra SUA fonte, nunca todos pro recibo', async () => {
    const { compra, consumo, venda } = await cenaDoBacon()
    const f = (await buildFichaItem(companyId, itemId))!
    const h = (id: string) => f.historico.find((l) => l.movimentoId === id)!

    expect(h(compra.id).href).toBe(`/empresas/${companyId}/estoque/recibos/${conferenceId}`)
    expect(h(compra.id).detalhe).toBe('NF nº 1234 · FRIGORIFICO SILVA')

    // ⛔ era ISTO que ia pra /recibos/{ordemId} e abria um recibo que não existe
    expect(h(consumo.id).href).toBe(`/empresas/${companyId}/estoque/producao/${ordemId}`)
    expect(h(consumo.id).detalhe).toContain('ordem de 06/09')
    expect(h(consumo.id).detalhe).toContain('Porção de bacon')

    expect(h(venda.id).href).toBe(`/empresas/${companyId}/estoque/vendas?aba=processados#dia-2026-09-07`)
    expect(h(venda.id).detalhe).toBe('vendas de 07/09')
  })

  it('⭐ ESTORNO diz o que estornou — e herda a origem do original', async () => {
    const { compra, estorno } = await cenaDoBacon()
    const f = (await buildFichaItem(companyId, itemId))!
    const e = f.historico.find((l) => l.movimentoId === estorno.id)!
    expect(e.chip).toBe('Estorno')
    expect(e.estornoDe?.movimentoId).toBe(compra.id)
    expect(e.estornoDe?.chip).toBe('Compra (NF-e)')
    // ⭐ o estorno de uma compra continua sendo assunto de compra, e leva ao MESMO recibo
    expect(e.ehCompra).toBe(true)
    expect(e.href).toBe(`/empresas/${companyId}/estoque/recibos/${conferenceId}`)
  })

  it('⭐ a aba "só compras" devolve o uso original, limpo', async () => {
    await cenaDoBacon()
    const f = (await buildFichaItem(companyId, itemId))!
    const compras = f.historico.filter((l) => l.ehCompra)
    // a compra + o estorno dela; contagem, produção e venda ficam de fora
    expect(compras.map((c) => c.chip).sort()).toEqual(['Compra (NF-e)', 'Estorno'])
    expect(compras.every((c) => c.quantidade !== 0)).toBe(true)
    expect(f.historico.filter((l) => l.familia === 'CONTAGEM')).toHaveLength(2)
  })

  it('⭐ o filtro só oferece tipos que EXISTEM neste item', async () => {
    await cenaDoBacon()
    const f = (await buildFichaItem(companyId, itemId))!
    expect(f.tipos.map((t) => t.tipo).sort()).toEqual(
      ['AJUSTE_CONTAGEM', 'BAIXA_VENDA', 'ENTRADA_NF', 'ESTORNO', 'PRODUCAO_CONSUMO'],
    )
    expect(f.tipos.find((t) => t.tipo === 'AJUSTE_CONTAGEM')?.n).toBe(2)
  })

  it('⭐ o gráfico de preço continua só com COMPRA — a média da baixa não polui', async () => {
    await cenaDoBacon()
    const f = (await buildFichaItem(companyId, itemId))!
    expect(f.precoTempo).toHaveLength(1)
    expect(f.precoTempo[0].preco).toBe(29.98)
  })
})

describe('⛔ o EXTRATO tinha a mesma mentira — e agora lê o mesmo dono', () => {
  it('⛔ produção e contagem não são mais rotuladas "conferência"', async () => {
    await cenaDoBacon()
    const linhas = await listMovimentos(companyId, { itemId })
    for (const l of linhas) {
      expect(l.referencia.label).not.toBe('conferência')
      expect(l.chip).toBeTruthy()
    }
    const prod = linhas.find((l) => l.tipo === 'PRODUCAO_CONSUMO')!
    expect(prod.chip).toBe('Produção · consumiu')
    expect(prod.href).toBe(`/empresas/${companyId}/estoque/producao/${ordemId}`)
    const cont = linhas.find((l) => l.tipo === 'AJUSTE_CONTAGEM')!
    expect(cont.detalhe).toContain('contagem de')
  })
})

describe('⭐ a régua dos tipos (pura)', () => {
  it('⛔ só COMPRA tem preço de compra — o resto é custo médio', async () => {
    expect(rotuloDoPreco(faceDoTipo('ENTRADA_NF'))).toBe('Preço un.')
    expect(rotuloDoPreco(faceDoTipo('ENTRADA_MANUAL'))).toBe('Preço un.')
    for (const t of ['BAIXA_VENDA', 'PRODUCAO_CONSUMO', 'SEPARACAO_SAIDA', 'AJUSTE_CONTAGEM', 'PERDA', 'USO_INTERNO']) {
      expect(rotuloDoPreco(faceDoTipo(t)), `${t} não pode dizer "preço de compra"`).toBe('Custo médio un.')
    }
  })

  it('⛔ tipo DESCONHECIDO aparece com o nome cru, nunca vira "recibo" nem some', async () => {
    // ⚠️ era o fallback silencioso que produziu o defeito: melhor uma linha feia e honesta
    // que uma linha bonita e errada.
    const f = faceDoTipo('TIPO_QUE_AINDA_NAO_EXISTE')
    expect(f.chip).toBe('TIPO_QUE_AINDA_NAO_EXISTE')
    expect(f.familia).toBe('OUTRO')
    expect(f.precoEhDeCompra).toBe(false)
  })

  it('⭐ lote vazio não quebra e não consulta nada', async () => {
    expect(await explicarMovimentos(companyId, [])).toEqual([])
  })
})
