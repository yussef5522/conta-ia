/**
 * ⭐⭐ GÊMEOS: A RÉGUA, A UNIFICAÇÃO MECÂNICA, A PORTA E A FILA (16/11/2026) — EXECUTADO contra o banco.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { reguaDoNome, mesmoNome } from '@/lib/nomes/regua-do-nome'
import { gruposDeGemeos, unificarGrupo } from '../unificar-gemeos'
import { itemComMesmoNome } from '../porta-do-nome'
import { paresSuspeitos, decidirPar, avisarFilaDeGemeos, saoParecidos, ORIGEM_GEMEOS } from '../fila-de-gemeos'
import { itemDeEstoqueComMesmoNome } from '../../producao/fichas'
import { saldoItem } from '../../saldo'

const CNPJ = '16222622000162'
let companyId = ''

async function limpar() {
  const cs = await prisma.company.findMany({ where: { cnpj: CNPJ }, select: { id: true } })
  for (const { id } of cs) {
    for (const t of ['stockMovement', 'stockSaldoCache', 'stockItemMesclado', 'stockItemNomeAnterior', 'stockItemParDecidido', 'stockSupplierProdutoNome', 'stockVendaProdutoMap', 'stockItem', 'aviso'] as const) {
      await (prisma[t] as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId: id } })
    }
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
}
beforeEach(async () => { await limpar(); companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'GEMEOS' } })).id })
afterEach(limpar)

async function item(nome: string, categoria = 'MATERIA_PRIMA', unidadeControle = 'KG', entradas: number[] = []) {
  const i = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle, categoria, criadoVia: 'CONFERENCIA' } })
  for (const q of entradas) await prisma.stockMovement.create({ data: { companyId, itemId: i.id, tipo: 'ENTRADA_NF', quantidade: q, custoUnitario: 4, custoTotal: q * 4, origem: 'SEFAZ' } })
  return i
}

describe('1 · a régua oficial do nome', () => {
  it('caixa, acento, espaço duplo e pontuação somem; dígito e palavra não', () => {
    expect(new Set(['COCA-COLA  2L', 'Coca Cola 2l', 'COCA COLA 2L', 'coca-cola 2L'].map(reguaDoNome))).toEqual(new Set(['COCA COLA 2L']))
    expect(mesmoNome('Pizza Grande (35cm)', 'PIZZA GRANDE 35CM')).toBe(true)
    expect(mesmoNome('Açúcar ', 'acucar')).toBe(true)
    expect(mesmoNome('FANTA LARANJA 2L', 'FANTA UVA 2L')).toBe(false)
    expect(mesmoNome('1/2', '12')).toBe(false)
  })
})

describe('2 · unificação mecânica — só igual sob a régua, mesma prateleira, com prova', () => {
  it('TOMATE × tomate: grupo mecânico, canônico = mais movimentos; Fantas nunca se tocam; receita × garrafa é outra prateleira', async () => {
    const T = await item('TOMATE', 'MATERIA_PRIMA', 'KG', [10, 5.25])
    await item('tomate', 'MATERIA_PRIMA', 'KG', [1.5])
    await item('FANTA LARANJA 2L', 'REVENDA', 'UN', [6])
    await item('FANTA UVA 2L', 'REVENDA', 'UN', [4])
    await item('COCA-COLA  2L', 'REVENDA', 'UN', [12])
    await item('COCA COLA 2L', 'PRODUTO_FINAL', 'UN')
    const { grupos, outrasPrateleiras } = await gruposDeGemeos(companyId, prisma)
    expect(grupos.map((g) => [g.chave, g.mecanico, g.canonico.id])).toEqual([['TOMATE', true, T.id]])
    expect(grupos.some((g) => g.chave.includes('FANTA'))).toBe(false)
    expect(outrasPrateleiras.map((o) => o.chave)).toEqual(['COCA COLA 2L'])
  })

  it('a PROVA: saldo somado antes = saldo do canônico depois; movimentos vivos preservados; nome velho vira apelido; mapa da nota migra', async () => {
    const T = await item('TOMATE', 'MATERIA_PRIMA', 'KG', [10, 5.25])
    const t = await item('tomate', 'MATERIA_PRIMA', 'KG', [1.554])
    await prisma.stockSupplierProdutoNome.create({ data: { companyId, supplierCnpj: '1', xProd: 'TOMATE KG', xProdNormalizado: 'tomate kg', itemId: t.id, origem: 'NOME' } })
    const [g] = (await gruposDeGemeos(companyId, prisma)).grupos
    const p = await unificarGrupo(companyId, g, 'u', prisma)
    expect(p).toMatchObject({ canonico: 'TOMATE', absorvidos: ['tomate'], saldoAntes: 16.804, saldoDepois: 16.804, vivosAntes: 3, vivosDepois: 3, bate: true })
    expect((await prisma.stockItem.findUniqueOrThrow({ where: { id: t.id } })).ativo).toBe(false)
    expect((await saldoItem(prisma, companyId, t.id)).saldo).toBe(0)
    expect(await prisma.stockItemNomeAnterior.findMany({ where: { companyId, itemId: T.id }, select: { nomeAnterior: true } })).toEqual([{ nomeAnterior: 'tomate' }])
    expect((await prisma.stockSupplierProdutoNome.findFirstOrThrow({ where: { companyId } })).itemId).toBe(T.id)
    // ⭐ e a grafia velha casa sozinha pra sempre (pelo nome canônico E pelo apelido)
    expect(await itemComMesmoNome(prisma, companyId, 'tomate', 'MATERIA_PRIMA')).toMatchObject({ id: T.id })
  })

  it('⛔ grupo de receita de venda (PRODUTO_FINAL) NÃO é mecânico — unir as fichas é decisão do dono', async () => {
    await item('PIZZA GRANDE 35CM', 'PRODUTO_FINAL', 'UN')
    await item('Pizza Grande (35cm)', 'PRODUTO_FINAL', 'UN')
    const [g] = (await gruposDeGemeos(companyId, prisma)).grupos
    expect(g).toMatchObject({ mecanico: false })
    await expect(unificarGrupo(companyId, g, 'u', prisma)).rejects.toThrow('não é mecânico')
  })
})

describe('3 · a porta fecha: gêmeo igual-sob-a-régua não nasce', () => {
  it('a porta acha o existente pela régua (nome com pontuação/caixa diferente) na mesma prateleira — e só nela', async () => {
    const C = await item('COCA-COLA  2L', 'REVENDA', 'UN')
    expect(await itemComMesmoNome(prisma, companyId, 'Coca Cola 2L', 'REVENDA')).toMatchObject({ id: C.id, via: 'NOME' })
    expect(await itemComMesmoNome(prisma, companyId, 'coca cola 2l', 'MATERIA_PRIMA')).toMatchObject({ id: C.id }) // físico × físico
    expect(await itemComMesmoNome(prisma, companyId, 'COCA COLA 2L', 'PRODUTO_FINAL')).toBeNull() // a receita de passagem pode nascer
    expect(await itemComMesmoNome(prisma, companyId, 'FANTA LARANJA 2L', 'REVENDA')).toBeNull()
  })
  it('a ficha também pergunta pela régua: "Coca Cola 2L" acha "COCA-COLA  2L" na prateleira', async () => {
    const C = await item('COCA-COLA  2L', 'REVENDA', 'UN')
    expect(await itemDeEstoqueComMesmoNome(companyId, 'Coca Cola 2L', prisma)).toMatchObject({ id: C.id })
  })
})

describe('4 · a fila de casamento assistido — parecido vira pergunta, nunca fusão', () => {
  it('a régua do parecido: palavras contidas (2+) ou até 2 letras sem mudar dígito', () => {
    expect(saoParecidos('MAIONESE CASEIRA', 'MAIONESE CASEIRA COM ALHO')).toBe(true)
    expect(saoParecidos('COCACOLA 2L', 'COCA COLA 2L')).toBe(true)
    expect(saoParecidos('FANTA LARANJA 2L', 'FANTA UVA 2L')).toBe(false)
    expect(saoParecidos('FANTA LARANJA 2L', 'FANTA LARANJA 1L')).toBe(false)
    expect(saoParecidos('QUEIJO', 'QUEIJO MUSSARELA')).toBe(false)
    expect(saoParecidos('QUEIJO MUSSARELA', 'QUEIJO MUSSARELLA')).toBe(true)
    // ⛔ os falsos medidos em prod (16/11): palavra CURTA trocada é outro produto
    expect(saoParecidos('AGUA SEM GAS 500ML', 'AGUA COM GAS 500ML')).toBe(false)
    expect(saoParecidos('CAMISETAS POLIVISCOSE PRETAS MANGA CURTA TAM G', 'CAMISETAS POLIVISCOSE PRETAS MANGA CURTA TAM GG')).toBe(false)
    expect(saoParecidos('CAIXA FRANGO P', 'CAIXA FRANGO M')).toBe(false)
    expect(saoParecidos('COCA COLA 2L', 'COCA COLA ZERO 2L')).toBe(false)
    expect(saoParecidos('FRUKI GUARANA 600ML', 'FRUKI GUARANA LIGHT ZERO 600ML')).toBe(false)
    expect(saoParecidos('LIXA', 'LATA')).toBe(false)
    expect(saoParecidos('PORCAO FRANGO FRITO 200 GRAMA', 'PORCAO FRANGO PRATO 200 GRAMA')).toBe(false)
    expect(saoParecidos('COXAO MOLE', 'COXAO MOLE BIFE')).toBe(true)
  })

  it('MAIONESE CASEIRA × COM ALHO: vira sugestão no sininho e NADA se funde sozinho; "são diferentes" cala o par pra sempre', async () => {
    const a = await item('MAIONESE CASEIRA', 'MATERIA_PRIMA', 'KG', [2])
    const b = await item('MAIONESE CASEIRA COM ALHO', 'MATERIA_PRIMA', 'KG', [1])
    expect(await avisarFilaDeGemeos(companyId, prisma)).toBe(1)
    expect(await prisma.aviso.findFirst({ where: { companyId, origem: ORIGEM_GEMEOS, resolvidoEm: null } })).toMatchObject({ acaoHref: `/empresas/${companyId}/estoque/itens/gemeos#pergunta-gemeos` }) // ⭐ pousa NA pergunta (lei de 19/11)
    // ⛔ a máquina não funde: os dois seguem vivos, cada um com o seu saldo
    expect(await prisma.stockItem.count({ where: { companyId, ativo: true } })).toBe(2)
    expect((await saldoItem(prisma, companyId, a.id)).saldo).toBe(2)
    await decidirPar({ companyId, itemXId: b.id, itemYId: a.id, decisao: 'DIFERENTES', userId: 'dono' }, prisma)
    expect(await paresSuspeitos(companyId, prisma)).toEqual([])
    expect(await prisma.aviso.count({ where: { companyId, origem: ORIGEM_GEMEOS, resolvidoEm: null } })).toBe(0)
    expect(await prisma.stockItem.count({ where: { companyId, ativo: true } })).toBe(2)
  })

  it('"juntar" funde com a prova de saldo e grava a decisão com autor', async () => {
    const a = await item('COCACOLA 2L', 'REVENDA', 'UN', [3])
    await item('COCA COLA 2L', 'REVENDA', 'UN', [7, 1])
    const r = await decidirPar({ companyId, itemXId: a.id, itemYId: (await prisma.stockItem.findFirstOrThrow({ where: { companyId, nome: 'COCA COLA 2L' } })).id, decisao: 'JUNTAR', userId: 'dono' }, prisma)
    expect(r).toMatchObject({ decisao: 'JUNTADOS', saldoAntes: 11, saldoDepois: 11 })
    expect(await prisma.stockItem.count({ where: { companyId, ativo: true } })).toBe(1)
    expect(await prisma.stockItemParDecidido.findFirstOrThrow({ where: { companyId } })).toMatchObject({ decisao: 'JUNTADOS', decididoPorId: 'dono' })
  })
})
