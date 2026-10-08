/**
 * ⭐⭐ B1/B2 — o guard do dono CONTRA O BANCO. Red-then-green em cada estado real de prod.
 *
 * ⛔ Integração e não teste puro: o que B1 vigia é **o ESTADO da receita no banco**, e a
 * receita é editável pela tela a qualquer momento. Um teste puro provaria a régua
 * (`conferirBaseDeTamanho` já tem isso) e aprovaria o dia em que o juiz parasse de chamá-la —
 * é a lição do "guard que testa a lib aprova a tela que a ignora".
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { checkBaseInvariants } from '../base-invariants'

const CNPJ = '71828182000171'
let companyId: string
let idMassa: string, idQueijo: string, idCx25: string, idCx35: string, idCx45: string
let fichaGrande: string

const soDesta = (fs: Awaited<ReturnType<typeof checkBaseInvariants>>, inv: string) =>
  fs.filter((f) => f.companyId === companyId && f.invariante === inv)

async function criarItem(nome: string, categoria = 'MATERIA_PRIMA') {
  const i = await prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: 'UN', categoria, criadoVia: 'MANUAL' },
  })
  return i.id
}

/** cria uma ficha PRODUTO_FINAL com os componentes dados, na forma que a tela grava */
async function criarFichaComComponentes(nome: string, comps: { itemId: string; qtd: number }[]) {
  const item = await criarItem(nome, 'PRODUTO_FINAL')
  const ficha = await prisma.stockFicha.create({
    data: { companyId, itemProduzidoId: item, tipoProduto: 'PRODUTO_FINAL', versaoAtual: 1 },
  })
  const v = await prisma.stockFichaVersao.create({
    data: { companyId, fichaId: ficha.id, versao: 1, loteBase: 1, unidadeLoteBase: 'UN' },
  })
  await prisma.stockFichaComponente.createMany({
    data: comps.map((c, i) => ({ companyId, versaoId: v.id, itemId: c.itemId, qtdPlanejada: c.qtd, unidade: 'UN', posicao: i })),
  })
  return ficha.id
}

async function trocarComponentes(fichaId: string, comps: { itemId: string; qtd: number }[]) {
  const f = await prisma.stockFicha.findFirstOrThrow({ where: { id: fichaId } })
  const v = await prisma.stockFichaVersao.findFirstOrThrow({ where: { fichaId, versao: f.versaoAtual } })
  await prisma.stockFichaComponente.deleteMany({ where: { versaoId: v.id } })
  await prisma.stockFichaComponente.createMany({
    data: comps.map((c, i) => ({ companyId, versaoId: v.id, itemId: c.itemId, qtdPlanejada: c.qtd, unidade: 'UN', posicao: i })),
  })
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA JUIZ BASE' } })).id

  // ⚠️ os nomes são os REAIS da Caçula — é por eles que o resolvedor único acha os itens
  idMassa = await criarItem('metade de bolinha massa de pizza', 'INTERMEDIARIO')
  idQueijo = await criarItem('porçao queijo 135 grama', 'INTERMEDIARIO')
  idCx25 = await criarItem('CAIXA P/ PIZZA 25 CM', 'EMBALAGEM')
  idCx35 = await criarItem('CAIXA P/ PIZZA 35 cm', 'EMBALAGEM')
  idCx45 = await criarItem('CAIXA P/ PIZZA 45 CM', 'EMBALAGEM')

  // a base GRANDE já NORMALIZADA (massa 2 + queijo 2 + caixa 35)
  fichaGrande = await criarFichaComComponentes('PIZZA GRANDE 35CM', [
    { itemId: idMassa, qtd: 2 },
    { itemId: idQueijo, qtd: 2 },
    { itemId: idCx35, qtd: 1 },
  ])
  await prisma.stockBaseDoTamanho.create({ data: { companyId, tamanho: 'GRANDE', fichaId: fichaGrande } })
})

afterEach(async () => {
  for (const t of ['stockBaseDoTamanho', 'stockDoseADeclarar', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('B1 — a base apontada tem massa + queijo + caixa', () => {
  it('⭐ base normalizada passa VERDE', async () => {
    expect(soDesta(await checkBaseInvariants(prisma), 'B1')).toHaveLength(0)
  })

  it('⛔ PEGA a base SEM MASSA — o estado real de `PIZZA GRANDE 35CM` e `GRANDE PRECINHO`', async () => {
    await trocarComponentes(fichaGrande, [{ itemId: idQueijo, qtd: 2 }, { itemId: idCx35, qtd: 1 }])
    const f = soDesta(await checkBaseInvariants(prisma), 'B1')
    expect(f).toHaveLength(1)
    expect(f[0].detalhe).toContain('massa')
    expect(f[0].detalhe).toContain('margem vem inflada')
    expect(f[0].nivel ?? 'erro').toBe('erro')
  })

  it('⛔ PEGA a base SEM CAIXA — o estado real de `PIZZA GRANDE PRECINHO` (1.096 un/mês)', async () => {
    await trocarComponentes(fichaGrande, [{ itemId: idQueijo, qtd: 2 }, { itemId: idMassa, qtd: 2 }])
    const f = soDesta(await checkBaseInvariants(prisma), 'B1')
    expect(f).toHaveLength(1)
    expect(f[0].detalhe).toContain('caixa')
  })

  it('⛔ PEGA a base sem massa E sem caixa — o estado real de `Pizza Grande (35cm)`', async () => {
    await trocarComponentes(fichaGrande, [{ itemId: idQueijo, qtd: 2 }])
    const f = soDesta(await checkBaseInvariants(prisma), 'B1')
    expect(f).toHaveLength(1)
    expect(f[0].detalhe).toMatch(/massa \+ caixa/)
  })

  it('⛔⛔ MOLHO É ISENTO: base completa com o molho de fora segue VERDE', async () => {
    await criarItem('MOLHO TOMATE PIZZA 1,01KG ODERICH')
    expect(soDesta(await checkBaseInvariants(prisma), 'B1')).toHaveLength(0)
  })

  it('⛔ PEGA base apontada pra ficha que NÃO TEM FORMA de base (combo com 2 caixas)', async () => {
    await trocarComponentes(fichaGrande, [
      { itemId: idMassa, qtd: 2 },
      { itemId: idQueijo, qtd: 2 },
      { itemId: idCx35, qtd: 1 },
      { itemId: idCx25, qtd: 1 },
    ])
    const f = soDesta(await checkBaseInvariants(prisma), 'B1')
    expect(f).toHaveLength(1)
    // ⚠️ a frase é OUTRA de propósito: mandar consertar "a massa" num combo faria o dono
    //    mexer na coisa errada
    expect(f[0].detalhe).toContain('não tem a forma de uma base')
    expect(f[0].detalhe).not.toContain('está sem')
  })

  it('⛔ PEGA base apontada pra ficha DESATIVADA', async () => {
    await prisma.stockFicha.update({ where: { id: fichaGrande }, data: { ativo: false } })
    const f = soDesta(await checkBaseInvariants(prisma), 'B1')
    expect(f).toHaveLength(1)
    expect(f[0].detalhe).toContain('DESATIVADA')
  })

  it('⚠️ empresa que nunca apontou base nenhuma NÃO entra no universo (zero alarme falso)', async () => {
    await prisma.stockBaseDoTamanho.deleteMany({ where: { companyId } })
    const fs = await checkBaseInvariants(prisma)
    expect(fs.filter((f) => f.companyId === companyId)).toHaveLength(0)
  })
})

describe('B2 — "não consigo conferir" é DITO, nunca silêncio', () => {
  it('⛔ sem a caixa de 45 cadastrada, B2 AVISA em vez de o juiz calar', async () => {
    await prisma.stockItem.delete({ where: { id: idCx45 } })
    const b2 = soDesta(await checkBaseInvariants(prisma), 'B2')
    expect(b2).toHaveLength(1)
    expect(b2[0].nivel).toBe('aviso')
    expect(b2[0].detalhe).toContain('FAMILIA')
    // ⛔ e NÃO acusa B1 por não conseguir conferir — silêncio ≠ aprovação, mas aviso ≠ erro
    expect(soDesta(await checkBaseInvariants(prisma), 'B1')).toHaveLength(0)
  })

  it('⛔ DOIS candidatos pra mesma peça também bloqueia (não escolhe no escuro)', async () => {
    await criarItem('CAIXA P/ PIZZA 35 cm REFORCADA', 'EMBALAGEM')
    const b2 = soDesta(await checkBaseInvariants(prisma), 'B2')
    expect(b2).toHaveLength(1)
    expect(b2[0].detalhe).toContain('GRANDE')
  })
})
