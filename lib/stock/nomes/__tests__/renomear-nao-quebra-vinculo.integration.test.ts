// ⛔⛔⛔ RENOMEAR NÃO PODE QUEBRAR VÍNCULO (09/09/2026) — o dono exigiu conferir ANTES.
//
// *"O que NÃO pode quebrar (confirma ANTES do primeiro rename): renomear não mexe no mapa
// fornecedor→produto, não mexe em ficha, não mexe em histórico. Se ALGUM vínculo for por NOME
// do item, me avisa antes."*
//
// ⭐ **A RESPOSTA, conferida no código e travada aqui:** nenhum vínculo do módulo é por nome.
//   fornecedor → produto  `(cnpj, cProd) → itemId`  · ficha `componente.itemId`
//   histórico `movement.itemId`  · venda `mapa.itemId/fichaId`  · contagem `contagemItem.itemId`
//
// ⚠️ A única busca por NOME é a dedup de "criar item novo" na conferência — e ela não é
// vínculo. O apelido fecha esse flanco.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { renomearEmLote, itensParaRevisarNome, apelidosPorItem } from '../renomear-em-lote'
import { montarPlanoDeLinhas } from '../../vendas/baixa-venda'
import { upsertVendaMap } from '../../vendas/venda-map'
import { filtrarPorBusca } from '@/lib/busca-texto'

const CNPJ = '55901224000199'
const CNPJ_FORN = '11222333000181'
let companyId = ''
let item = ''
let userId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.user.deleteMany({ where: { email: 'nomes@teste.local' } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'NOMES' } })).id
  userId = (await prisma.user.create({ data: { email: 'nomes@teste.local', name: 'Yussef', password: 'x' } })).id
  item = (await prisma.stockItem.create({
    data: { companyId, nome: 'CC 600 PET 12', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'CONFERENCIA' },
  })).id
  await prisma.stockMovement.create({
    data: { companyId, itemId: item, tipo: 'ENTRADA_NF', quantidade: 408, custoUnitario: 3.31, custoTotal: 1350.48, origem: 'SEFAZ' },
  })
  // o vínculo com o fornecedor, por cProd
  await prisma.stockSupplierProduct.create({
    data: { companyId, supplierCnpj: CNPJ_FORN, cProd: '7894900011517', xProd: 'CC 600 PET 12', itemId: item, fatorConversao: 12, unidadeNota: 'CX' },
  })
})

afterEach(async () => {
  for (const t of ['stockItemNomeAnterior', 'stockSupplierProduct', 'stockVendaProdutoMap', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockMovement', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.user.deleteMany({ where: { id: userId } })
})

describe('⛔⛔ o rename e os vínculos', () => {
  it('⭐ a sugestão chega pronta e o dono ainda não gravou nada', async () => {
    const antes = await prisma.stockItem.findUnique({ where: { id: item }, select: { nome: true } })
    const linhas = await itensParaRevisarNome(companyId, prisma)
    const l = linhas.find((x) => x.itemId === item)!
    // ⚠️ era 'COCA COLA 600'; o dono pediu a unidade junto (09/09) e o volume solto ganha ML
    expect(l.sugestao).toBe('COCA COLA 600ML')
    expect(l.saldo).toBe(408)
    // ⛔ LER NÃO ESCREVE
    expect((await prisma.stockItem.findUnique({ where: { id: item }, select: { nome: true } }))!.nome).toBe(antes!.nome)
  })

  it('⭐⭐ depois do rename, a PRÓXIMA NF cai no MESMO item (o vínculo é por cProd)', async () => {
    await renomearEmLote({ companyId, userId, pedidos: [{ itemId: item, nomeNovo: 'COCA COLA 600ML' }] }, prisma)

    const mapa = await prisma.stockSupplierProduct.findUnique({
      where: { companyId_supplierCnpj_cProd: { companyId, supplierCnpj: CNPJ_FORN, cProd: '7894900011517' } },
      select: { itemId: true, fatorConversao: true },
    })
    expect(mapa?.itemId, 'a nota nova tem que cair no mesmo item').toBe(item)
    expect(mapa?.fatorConversao, 'e o fator de conversão continua').toBe(12)
  })

  it('⭐⭐ a ficha continua explodindo NELE, e a venda baixa o mesmo item', async () => {
    // ⚠️ FIXTURE CORRIGIDA (09/09): antes a ficha produzia o MESMO item que consumia — um
    // ciclo que `criarFicha` recusa e que só existia porque o teste gravava por SQL cru. Com
    // o caminho único a explosão passou a alcançá-lo e estourou "ciclo?". A ficha real produz
    // o INVÓLUCRO (a linha do cardápio) e consome a garrafa.
    const involucro = await prisma.stockItem.create({
      data: { companyId, nome: 'COCA COLA 600ML (menu)', unidadeControle: 'UN', categoria: 'PRODUTO_FINAL', criadoVia: 'MANUAL' },
    })
    const ficha = await prisma.stockFicha.create({ data: { companyId, itemProduzidoId: involucro.id, tipoProduto: 'PRODUTO_FINAL' } })
    const v = await prisma.stockFichaVersao.create({ data: { companyId, fichaId: ficha.id, versao: 1, loteBase: 1, unidadeLoteBase: 'UN' } })
    await prisma.stockFichaComponente.create({ data: { companyId, versaoId: v.id, itemId: item, qtdPlanejada: 1, unidade: 'UN', posicao: 0 } })
    await upsertVendaMap(companyId, 'COCA COLA 600ML', { tipo: 'FICHA', fichaId: ficha.id }, userId, prisma)

    await renomearEmLote({ companyId, userId, pedidos: [{ itemId: item, nomeNovo: 'COCA COLA 600ML' }] }, prisma)

    const plano = await montarPlanoDeLinhas(companyId, '2026-09-09', [{ produto: 'COCA COLA 600ML', quantidade: 5, valorTotal: 55 }], null, prisma)
    expect(plano.agregada).toHaveLength(1)
    expect(plano.agregada[0].itemId).toBe(item)
    expect(plano.agregada[0].qtd).toBe(5)
  })

  it('⭐⭐ o histórico não se mexe — o saldo é o mesmo depois do rename', async () => {
    const antes = await prisma.stockMovement.count({ where: { companyId, itemId: item } })
    await renomearEmLote({ companyId, userId, pedidos: [{ itemId: item, nomeNovo: 'COCA COLA 600ML' }] }, prisma)
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: item } })).toBe(antes)
  })

  it('⭐⭐ A BUSCA ACHA PELOS DOIS NOMES — a Marcyelle não se perde', async () => {
    await renomearEmLote({ companyId, userId, pedidos: [{ itemId: item, nomeNovo: 'COCA COLA 600ML' }] }, prisma)
    const apel = await apelidosPorItem(companyId, [item], prisma)
    expect(apel.get(item)).toContain('CC 600 PET 12')

    // a mesma composição que a rota da busca usa
    const lista = [{ id: item, nome: 'COCA COLA 600ML' }]
    const alvo = (i: { id: string; nome: string }) => [i.nome, ...(apel.get(i.id) ?? [])].join(' ')
    expect(filtrarPorBusca(lista, 'CC 600', alvo), 'o nome ANTIGO ainda acha').toHaveLength(1)
    expect(filtrarPorBusca(lista, 'coca 600', alvo), 'e o nome NOVO também').toHaveLength(1)
    expect(filtrarPorBusca(lista, 'fanta', alvo), 'e não vira coringa').toHaveLength(0)
  })

  it('⭐ o rastro guarda QUEM renomeou', async () => {
    await renomearEmLote({ companyId, userId, pedidos: [{ itemId: item, nomeNovo: 'COCA COLA 600ML' }] }, prisma)
    const r = await prisma.stockItemNomeAnterior.findFirst({ where: { companyId, itemId: item }, select: { renomeadoPorId: true, nomeAnterior: true } })
    expect(r?.renomeadoPorId).toBe(userId)
    expect(r?.nomeAnterior).toBe('CC 600 PET 12')
  })

  it('⛔ dois itens não podem terminar com o MESMO nome', async () => {
    const outro = (await prisma.stockItem.create({
      data: { companyId, nome: 'CC Zero PET 2L 8U FL', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'CONFERENCIA' },
    })).id
    const r = await renomearEmLote({
      companyId, userId,
      pedidos: [{ itemId: item, nomeNovo: 'REFRI' }, { itemId: outro, nomeNovo: 'refri' }],
    }, prisma)
    expect(r.aplicados).toHaveLength(1)
    expect(r.pulados[0].motivo).toContain('já é o nome de outro item')
  })

  it('⭐ renomear duas vezes guarda os DOIS apelidos', async () => {
    await renomearEmLote({ companyId, userId, pedidos: [{ itemId: item, nomeNovo: 'COCA 600' }] }, prisma)
    await renomearEmLote({ companyId, userId, pedidos: [{ itemId: item, nomeNovo: 'COCA COLA 600ML' }] }, prisma)
    const apel = (await apelidosPorItem(companyId, [item], prisma)).get(item) ?? []
    expect(apel.sort()).toEqual(['CC 600 PET 12', 'COCA 600'])
  })
})
