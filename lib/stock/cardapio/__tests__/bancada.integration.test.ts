/**
 * ⭐⭐ BANCADA DE VÍNCULOS + NEGATIVOS NO SININHO (19/11/2026) — EXECUTADO contra o banco.
 * Lei: docs/bancada-referencia.html (R32–R35). Pinos puros em bancada-pinos.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { bancadaDeVinculos, placarDe } from '../bancada'
import { upsertVendaMap } from '../../vendas/venda-map'
import { montarPlanoDeLinhas } from '../../vendas/baixa-venda'
import { guardarBaixaDoDia, ORIGEM_SEM_VINCULO } from '../../vendas/guarda-da-baixa'
import { avisarNegativos, itensNegativos, ORIGEM_NEGATIVO } from '../../negativos-no-sininho'

const CNPJ = '19111911000119'
let companyId = ''
let queijo = ''
const HA = (dias: number) => new Date(Date.now() - dias * 86_400_000)

async function limpar() {
  const cs = await prisma.company.findMany({ where: { cnpj: CNPJ }, select: { id: true } })
  for (const { id } of cs) {
    for (const t of ['aviso', 'stockMovement', 'stockSaldoCache', 'stockVendaLinha', 'stockVendaComplementoLinha', 'stockVendaImport', 'stockVendaProdutoMap',
      'stockVendaComplementoMap', 'stockVendaIgnorado', 'stockItemNomeAnterior', 'stockItemCustoVigente', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
      await (prisma[t] as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId: id } })
    }
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
}

async function ficha(nome: string, tipo: 'PRODUTO_FINAL' | 'SABOR') {
  const item = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria: tipo, criadoVia: 'MANUAL' } })
  const f = await prisma.stockFicha.create({ data: { companyId, itemProduzidoId: item.id, tipoProduto: tipo, versaoAtual: 1 } })
  const v = await prisma.stockFichaVersao.create({ data: { companyId, fichaId: f.id, versao: 1, loteBase: 1, unidadeLoteBase: 'UN' } })
  await prisma.stockFichaComponente.create({ data: { companyId, versaoId: v.id, itemId: queijo, qtdPlanejada: 0.1, unidade: 'KG', posicao: 0 } })
  return f.id
}

async function vendas(produtos: [string, number, number][], complementos: [string, number, number][], dia = HA(2)) {
  const imp = await prisma.stockVendaImport.create({ data: { companyId, data: dia, totalLinhas: produtos.length, totalUnidades: 1, status: 'CONFIRMADO' } })
  if (produtos.length) await prisma.stockVendaLinha.createMany({ data: produtos.map(([n, q, v]) => ({ companyId, importId: imp.id, data: dia, nomeSuitable: n, quantidade: q, valorTotal: v })) })
  if (complementos.length) await prisma.stockVendaComplementoLinha.createMany({ data: complementos.map(([n, q, v]) => ({ companyId, importId: `c-${imp.id}`, data: dia, nomeSuitable: n, ocorrencias: q, valorTotal: v })) })
}

async function contarEscritas() {
  return Promise.all([
    prisma.stockVendaProdutoMap.count({ where: { companyId } }), prisma.stockVendaComplementoMap.count({ where: { companyId } }),
    prisma.stockVendaIgnorado.count({ where: { companyId } }), prisma.aviso.count({ where: { companyId } }), prisma.stockMovement.count({ where: { companyId } }),
  ])
}

beforeEach(async () => {
  await limpar()
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'BANCADA' } })).id
  queijo = (await prisma.stockItem.create({ data: { companyId, nome: 'QUEIJO', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })).id
  await prisma.stockMovement.create({ data: { companyId, itemId: queijo, tipo: 'ENTRADA_NF', quantidade: 50, custoUnitario: 40, custoTotal: 2000, origem: 'SEFAZ', dataMovimento: HA(20) } })
})
afterEach(limpar)

describe('R32–R35 · a fila única, pela régua da baixa', () => {
  async function cenario() {
    const xis = await ficha('XIS COMPLETO', 'PRODUTO_FINAL')
    await ficha('X SALADA', 'PRODUTO_FINAL') // sem vínculo: vira SUGESTÃO pro "X-SALADA"
    const calab = await ficha('CALABRESA BLACK FRIDAY', 'SABOR')
    await upsertVendaMap(companyId, 'XIS COMPLETO', { tipo: 'FICHA', fichaId: xis }, 'dono', prisma)
    await upsertVendaMap(companyId, 'TAXA ENTREGA', { tipo: 'IGNORAR' }, 'dono', prisma)
    await prisma.stockVendaComplementoMap.create({ data: { companyId, nomeSuitable: 'CALABRESA BLACK FRIDAY', alvoTipo: 'FICHA', fichaId: calab } })
    await prisma.stockVendaComplementoMap.create({ data: { companyId, nomeSuitable: 'GRANDE', alvoTipo: 'IGNORAR' } })
    await vendas(
      [['XIS COMPLETO', 10, 300], ['Xis Completo', 2, 60], ['MILKSHAKE OVONINHO', 5, 100], ['X-SALADA', 3, 75], ['TAXA ENTREGA', 9, 45], ['PIZZA GRANDE CALABRESA BLACK FRIDAY', 4, 120]],
      [['CALABRESA BLACK FRIDAY', 4, 0], ['BORDA CATUPIRY', 3, 45], ['CHOCOLATE PRETO', 10, 0], ['GRANDE', 6, 0]],
    )
    // o que baixou nos 30 dias (a base da razão): R$ 72 de custo
    await prisma.stockMovement.create({ data: { companyId, itemId: queijo, tipo: 'BAIXA_VENDA', quantidade: -1.8, custoUnitario: 40, custoTotal: -72, origem: 'MANUAL', dataMovimento: HA(2) } })
  }

  it('produtos E complementos na MESMA fila; estados pela régua da baixa; ordenada pelo R$', async () => {
    await cenario()
    const b = await bancadaDeVinculos(companyId, prisma)
    const por = Object.fromEntries(b.linhas.map((l) => [l.chave, l.estado]))
    expect(por).toEqual({
      'P:XIS COMPLETO': 'RESOLVIDO', 'P:Xis Completo': 'RESOLVIDO', // grafia irmã: a baixa casa, a bancada também
      'P:MILKSHAKE OVONINHO': 'PENDENTE', 'P:X-SALADA': 'PENDENTE', 'P:TAXA ENTREGA': 'IGNORADO',
      'P:PIZZA GRANDE CALABRESA BLACK FRIDAY': 'PENDENTE',
      'C:CALABRESA BLACK FRIDAY': 'RESOLVIDO', 'C:BORDA CATUPIRY': 'PENDENTE', 'C:CHOCOLATE PRETO': 'PENDENTE', 'C:GRANDE': 'IGNORADO',
    })
    const fila = b.linhas.filter((l) => l.estado === 'PENDENTE').map((l) => l.nome)
    expect(fila).toEqual(['PIZZA GRANDE CALABRESA BLACK FRIDAY', 'MILKSHAKE OVONINHO', 'X-SALADA', 'BORDA CATUPIRY', 'CHOCOLATE PRETO'])
    // razão = custo que baixou ÷ faturamento dos que baixam (300 + 60 + 0)
    expect(b.razao).toEqual({ custoBaixado: 72, faturamentoQueBaixa: 360, razao: 0.2 })
    const p = placarDe(b.linhas, b.razao.razao)
    expect(p).toMatchObject({ fat30: 340, produtos: 3, complementos: 2, total: 5 })
    expect(p.custoDia).toBeCloseTo(340 * 0.2 / 30, 6)
  })

  it('sugestão e dica de casca aparecem — e a leitura NÃO GRAVA NADA (nunca liga sozinha)', async () => {
    await cenario()
    const antes = await contarEscritas()
    const b = await bancadaDeVinculos(companyId, prisma)
    const l = (k: string) => b.linhas.find((x) => x.chave === k)!
    expect(l('P:X-SALADA').sugestao).toMatchObject({ nomeFicha: 'X SALADA', motivo: 'mesmo nome' })
    expect(l('P:MILKSHAKE OVONINHO').sugestao).toBeNull()
    expect(l('P:PIZZA GRANDE CALABRESA BLACK FRIDAY').casca).toEqual({ familia: 'BLACK FRIDAY', sabores: ['CALABRESA BLACK FRIDAY'] })
    expect(await contarEscritas()).toEqual(antes)
    expect(l('P:X-SALADA').estado).toBe('PENDENTE')
  })

  it('o produto IGNORADO pelo dono sai do pendente da BAIXA também (a guarda para de acusar)', async () => {
    await cenario()
    const plano = await montarPlanoDeLinhas(companyId, '2026-11-17', [{ produto: 'TAXA ENTREGA', quantidade: 9, valorTotal: 45 }, { produto: 'MILKSHAKE OVONINHO', quantidade: 5, valorTotal: 100 }], null, prisma)
    expect(plano.ignorados.map((i) => i.nome)).toEqual(['TAXA ENTREGA'])
    expect(plano.pendentes.map((i) => i.nome)).toEqual(['MILKSHAKE OVONINHO'])
  })

  it('a ligação do dono (a MESMA gravação das abas) tira o nome da fila no recarregar', async () => {
    await cenario()
    const xsalada = (await bancadaDeVinculos(companyId, prisma)).linhas.find((x) => x.chave === 'P:X-SALADA')!
    await upsertVendaMap(companyId, 'X-SALADA', { tipo: 'FICHA', fichaId: xsalada.sugestao!.fichaId }, 'dono', prisma)
    const b = await bancadaDeVinculos(companyId, prisma)
    expect(b.linhas.find((x) => x.chave === 'P:X-SALADA')).toMatchObject({ estado: 'RESOLVIDO', nomeFicha: 'X SALADA' })
    expect(placarDe(b.linhas, b.razao.razao).fat30).toBe(265)
  })
})

describe('negativos no sininho — todo dia até zerar', () => {
  async function negativo() {
    const papel = await prisma.stockItem.create({ data: { companyId, nome: 'PAPEL ACOPLADO', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    await prisma.stockMovement.create({ data: { companyId, itemId: papel.id, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 0.86, custoTotal: 86, origem: 'SEFAZ', dataMovimento: HA(15) } })
    await prisma.stockMovement.create({ data: { companyId, itemId: papel.id, tipo: 'BAIXA_VENDA', quantidade: -130, custoUnitario: 0.86, custoTotal: -111.8, origem: 'MANUAL', dataMovimento: HA(9) } })
    // a memória do custo (o caminho oficial `criarMovimento` grava; aqui o fixture grava direto)
    await prisma.stockItemCustoVigente.create({ data: { companyId, itemId: papel.id, custoMedio: 0.86 } })
    return papel.id
  }

  it('lista item · saldo · há quantos dias · custo da dívida; resolve quando zera', async () => {
    const papel = await negativo()
    const ns = await itensNegativos(companyId, prisma)
    expect(ns).toEqual([expect.objectContaining({ nome: 'PAPEL ACOPLADO', saldo: -30, dias: 9, divida: 25.8 })])
    await avisarNegativos(companyId, prisma)
    const a = await prisma.aviso.findFirstOrThrow({ where: { companyId, origem: ORIGEM_NEGATIVO, resolvidoEm: null } })
    expect(a.corpo.replace(/\u00a0/g, ' ')).toContain('PAPEL ACOPLADO · -30 UN · há 9 dias · R$ 25,80')
    expect(a.titulo.replace(/\u00a0/g, ' ')).toBe('Acerte 1 item com saldo negativo — R$ 25,80 de dívida')
    await prisma.stockMovement.create({ data: { companyId, itemId: papel, tipo: 'ENTRADA_MANUAL', quantidade: 30, custoUnitario: 0.86, custoTotal: 25.8, origem: 'MANUAL' } })
    await avisarNegativos(companyId, prisma)
    expect(await prisma.aviso.count({ where: { companyId, origem: ORIGEM_NEGATIVO, resolvidoEm: null } })).toBe(0)
  })

  it('⭐ a GUARDA DIÁRIA leva a seção — até em dia sem venda; e o "sem vínculo" linka pra Bancada', async () => {
    await negativo()
    await guardarBaixaDoDia(companyId, '2026-01-05', prisma) // dia sem nada: SEM_DIA
    expect(await prisma.aviso.count({ where: { companyId, origem: ORIGEM_NEGATIVO, resolvidoEm: null } })).toBe(1)
    const dia = '2026-11-10'
    await vendas([['MILKSHAKE OVONINHO', 2, 40]], [], new Date(`${dia}T12:00:00`))
    await guardarBaixaDoDia(companyId, dia, prisma)
    const sv = await prisma.aviso.findFirstOrThrow({ where: { companyId, origem: ORIGEM_SEM_VINCULO, alvo: dia } })
    expect(sv.acaoHref).toBe(`/empresas/${companyId}/estoque/cardapio?aba=bancada`)
  })
})
