/**
 * ⭐⭐⭐ A PÁGINA DO ITEM v4, CONTRA BANCO — e o guard que o dono mandou preservar.
 *
 * **Ordem do dono:** *"MANTÉM (…) Σ do rodapé que bate com o saldo (intocados — guard:
 * Σ(linhas)==saldo segue)"*. Então o 1º teste deste arquivo é exatamente esse, rodando pelo
 * `buildFichaItem` **depois** de todas as peças novas entrarem no payload.
 *
 * ⛔ O pior caso é o teste (ordem dele): a cena é a da **ERVILHA real** — saldo negativo com
 * dinheiro positivo e custo médio NULO.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '@/lib/stock/movement'
import { buildFichaItem } from '@/lib/stock/ficha-item'
import { saldoItem } from '@/lib/stock/saldo'
import { criarFicha } from '@/lib/stock/producao/fichas'

const SUFIXO = `item-v4-${Date.now()}`
let companyId = ''
const ids: Record<string, string> = {}
/** ⚠️ relativo ao relógio: data fixa no futuro é bomba de calendário */
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000)

async function item(nome: string, unidade = 'KG', categoria = 'MATERIA_PRIMA') {
  const i = await prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: unidade, categoria, criadoVia: 'MANUAL' },
    select: { id: true },
  })
  return i.id
}

beforeAll(async () => {
  const c = await prisma.company.create({ data: { name: `Empresa ${SUFIXO}`, cnpj: `83${Date.now()}`.slice(0, 14) } })
  companyId = c.id

  /** (1) a ERVILHA: saldo negativo com dinheiro POSITIVO — o espelho medido em prod */
  ids.ervilha = await item('ERVILHA')
  await criarMovimento(prisma, { companyId, itemId: ids.ervilha, tipo: 'ENTRADA_NF', quantidade: 36, custoUnitario: 13.145, custoTotal: 473.22, origem: 'SEFAZ', dataMovimento: diasAtras(40) })
  await criarMovimento(prisma, { companyId, itemId: ids.ervilha, tipo: 'SEPARACAO_SAIDA', quantidade: -114.39, custoUnitario: 0.0285, custoTotal: -3.26, origem: 'MANUAL', dataMovimento: diasAtras(5) })

  /** (2) um item SÃO com giro e 3 compras — é dele que sai cobertura e mínimo sugerido */
  ids.sao = await item('Coxão Mole')
  for (const [d, q, t] of [[21, 20, 400], [14, 20, 400], [7, 20, 400]] as const) {
    await criarMovimento(prisma, { companyId, itemId: ids.sao, tipo: 'ENTRADA_NF', quantidade: q, custoUnitario: t / q, custoTotal: t, origem: 'SEFAZ', dataMovimento: diasAtras(d) })
  }
  await criarMovimento(prisma, { companyId, itemId: ids.sao, tipo: 'BAIXA_VENDA', quantidade: -30, custoUnitario: 20, custoTotal: -600, origem: 'MANUAL', dataMovimento: diasAtras(2) })
})

afterAll(async () => {
  const fs = await prisma.stockFicha.findMany({ where: { companyId }, select: { id: true } })
  const vs = await prisma.stockFichaVersao.findMany({ where: { companyId }, select: { id: true } })
  await prisma.stockFichaComponente.deleteMany({ where: { versaoId: { in: vs.map((v) => v.id) } } })
  await prisma.stockFichaVersao.deleteMany({ where: { fichaId: { in: fs.map((f) => f.id) } } })
  await prisma.stockFicha.deleteMany({ where: { companyId } })
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockSaldoCache.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⛔⛔ O GUARD QUE NÃO PODE CAIR: Σ(linhas) == saldo', () => {
  it('⛔⛔ a soma da tabela continua sendo o saldo — no item NEGATIVO', async () => {
    const f = (await buildFichaItem(companyId, ids.ervilha, prisma))!
    const s = await saldoItem(prisma, companyId, ids.ervilha)
    expect(f.conferencia.confere, 'a tabela fecha com o saldo').toBe(true)
    expect(f.conferencia.somaQuantidade).toBe(s.saldo)
    expect(f.conferencia.somaValor).toBe(s.valor)
  })

  it('⛔ e no item SÃO também', async () => {
    const f = (await buildFichaItem(companyId, ids.sao, prisma))!
    expect(f.conferencia.confere).toBe(true)
  })

  /** ⭐ a coluna SALDO desce do saldo de hoje — a 1ª linha É o número da Posição */
  it('⭐ a 1ª linha do histórico vale o saldo de hoje', async () => {
    const f = (await buildFichaItem(companyId, ids.ervilha, prisma))!
    expect(f.historico[0].saldoApos).toBe(f.saldo)
  })
})

describe('⭐⭐ A ERVILHA — o pior caso, com tudo "—" em vez de número inventado', () => {
  it('⛔⛔ pílula NEGATIVA, cobertura e custo médio ausentes — nenhum zero disfarçado', async () => {
    const f = (await buildFichaItem(companyId, ids.ervilha, prisma))!
    expect(f.saldo).toBeLessThan(0)
    expect(f.custoMedio, 'o saldo.ts se recusa a dividir negativo').toBeNull()
    expect(f.pilula.estado).toBe('NEGATIVO')
    expect(f.pilula.tom).toBe('vermelho')
    expect(f.cobertura.dias, 'previsão sobre dado impossível não se faz').toBeNull()
    expect(f.cobertura.porque).toBe('SALDO_NAO_POSITIVO')
  })

  it('⛔ com UMA compra só, nenhuma sugestão de mínimo', async () => {
    const f = (await buildFichaItem(companyId, ids.ervilha, prisma))!
    expect(f.sugestaoMinimo.minimo).toBeNull()
    expect(f.sugestaoMinimo.prazoDias).toBeNull()
  })

  it('⭐ e a separação de 5 dias atrás CONTA como consumo (o giro existe)', async () => {
    const f = (await buildFichaItem(companyId, ids.ervilha, prisma))!
    expect(f.consumo.consumoNaJanela).toBeCloseTo(114.39, 2)
    expect(f.diasSemMovimento).toBe(5)
  })
})

describe('⭐⭐ O ITEM SÃO — cobertura e mínimo sugerido com a conta escrita', () => {
  it('⭐ cobertura = saldo ÷ consumo/dia, e o prazo sai da MEDIANA das compras', async () => {
    const f = (await buildFichaItem(companyId, ids.sao, prisma))!
    expect(f.saldo).toBe(30)
    expect(f.consumo.consumoNaJanela).toBe(30)
    expect(f.consumo.porDia).toBe(1)
    expect(f.cobertura.dias, '30 ÷ 1').toBe(30)
    expect(f.sugestaoMinimo.prazoDias, 'mediana de [7, 7]').toBe(7)
    expect(f.sugestaoMinimo.minimo, '1/dia × 7 × 1,3').toBeCloseTo(9.1, 2)
    expect(f.sugestaoMinimo.conta).toContain('7 dia')
  })

  it('⭐ a pílula lê o mínimo pela régua ÚNICA do `statusEstoque`', async () => {
    await prisma.stockItem.update({ where: { id: ids.sao }, data: { estoqueMin: 50, estoqueMax: 100 } })
    const f = (await buildFichaItem(companyId, ids.sao, prisma))!
    expect(f.pilula.estado).toBe('ABAIXO_DO_MINIMO')
    expect(f.status.status, 'e o status da Posição concorda').toBe('ABAIXO')
    await prisma.stockItem.update({ where: { id: ids.sao }, data: { estoqueMin: null, estoqueMax: null } })
  })
})

describe('⭐⭐⭐ A BUSCA REVERSA — quem usa este item', () => {
  beforeAll(async () => {
    // 3 fichas com dose parecida + 1 com a dose 100× errada → a 4ª é a suspeita
    for (const [nome, dose] of [['pão A', 0.003], ['pão B', 0.003], ['pão C', 0.0035], ['pão ERRADO', 0.3]] as const) {
      await criarFicha(
        {
          companyId, nomeProduzido: nome, unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
          loteBase: 1, unidadeLoteBase: 'UN',
          componentes: [{ itemId: ids.ervilha, qtdPlanejada: dose, unidade: 'KG' }],
        },
        prisma,
      )
    }
  })

  it('⭐ lista toda ficha ATIVA que usa o item, com a dose por extenso', async () => {
    const f = (await buildFichaItem(companyId, ids.ervilha, prisma))!
    expect(f.usoEmFichas.fichas).toHaveLength(4)
    expect(f.usoEmFichas.fichas.every((x) => x.doseTexto.length > 0)).toBe(true)
    // ⭐ o `formatarQtd` da casa escreve a dose menor que 1 KG em GRAMA
    expect(f.usoEmFichas.fichas.find((x) => x.nome === 'pão A')!.doseTexto).toBe('3 g')
  })

  it('⭐⭐ a dose destoante é MARCADA e vem PRIMEIRO, com a porta pra a dose', async () => {
    const f = (await buildFichaItem(companyId, ids.ervilha, prisma))!
    expect(f.usoEmFichas.suspeitas).toBe(1)
    const primeira = f.usoEmFichas.fichas[0]
    expect(primeira.nome).toBe('pão ERRADO')
    expect(primeira.suspeita!.frase).toMatch(/as outras 3 receitas usam/)
    // ⭐ a porta leva DIRETO na dose (o editor acende a linha do componente) e sabe voltar
    expect(primeira.hrefCorrigir).toContain(`foco=${ids.ervilha}`)
    expect(primeira.hrefCorrigir).toContain('voltar=')
  })

  it('⛔ item que nenhuma ficha usa diz isso — ausência é informação', async () => {
    const f = (await buildFichaItem(companyId, ids.sao, prisma))!
    expect(f.usoEmFichas.fichas).toHaveLength(0)
    expect(f.usoEmFichas.suspeitas).toBe(0)
  })

  it('⛔⛔ ficha INATIVA sai da lista — ela não baixa mais nada', async () => {
    const umaFicha = await prisma.stockFicha.findFirstOrThrow({ where: { companyId }, select: { id: true } })
    await prisma.stockFicha.update({ where: { id: umaFicha.id }, data: { ativo: false } })
    const f = (await buildFichaItem(companyId, ids.ervilha, prisma))!
    expect(f.usoEmFichas.fichas).toHaveLength(3)
    await prisma.stockFicha.update({ where: { id: umaFicha.id }, data: { ativo: true } })
  })

  /**
   * ⛔⛔ SÓ A VERSÃO ATUAL: a versão antiga continua no banco (ordem antiga aponta pra ela), e
   * listá-la mostraria a MESMA ficha duas vezes com doses diferentes — o dono leria isso como
   * "dose suspeita" onde só há histórico.
   */
  it('⛔⛔ versão ANTIGA da mesma ficha não duplica a linha', async () => {
    const ficha = await prisma.stockFicha.findFirstOrThrow({ where: { companyId }, select: { id: true, versaoAtual: true } })
    const nova = await prisma.stockFichaVersao.create({
      data: { companyId, fichaId: ficha.id, versao: ficha.versaoAtual + 1, loteBase: 1, unidadeLoteBase: 'UN' },
    })
    await prisma.stockFichaComponente.create({
      data: { companyId, versaoId: nova.id, itemId: ids.ervilha, qtdPlanejada: 0.004, unidade: 'KG' },
    })
    await prisma.stockFicha.update({ where: { id: ficha.id }, data: { versaoAtual: ficha.versaoAtual + 1 } })

    const f = (await buildFichaItem(companyId, ids.ervilha, prisma))!
    expect(f.usoEmFichas.fichas, 'continua 1 linha por ficha').toHaveLength(4)
    const essa = f.usoEmFichas.fichas.find((x) => x.fichaId === ficha.id)!
    expect(essa.versao, 'e a dose exibida é a da versão ATUAL').toBe(ficha.versaoAtual + 1)
    expect(essa.dose).toBe(0.004)
  })
})
