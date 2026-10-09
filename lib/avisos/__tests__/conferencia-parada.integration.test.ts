/**
 * ⭐⭐ O AVISO DA CONFERÊNCIA PARADA (item 2d, 09/10/2026) — contra BANCO, pelo caminho real.
 *
 * ⛔ **Não é teste de função pura de propósito.** O que pode quebrar aqui é o ENCAIXE: o produtor
 * lendo a fila (que exclui estornada e já-conferida), o setor que decide quem VÊ, e o
 * reconciliar que tira o aviso da frente quando o gerente carimba. Nenhuma dessas três coisas
 * existe num fixture montado à mão — é a lição do guard que testava a lib e aprovava a tela.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { produzirAvisosDeConferencia, ORIGEM, haQuantoTempoTxt } from '../produtores/conferencia'
import { setoresVisiveis, podeVerSetor } from '../visibilidade'
import { confirmarConclusao } from '@/lib/stock/producao/conferencia'
import { avisosAbertos } from '../central'

const CNPJ = '91929394000191'
let companyId = ''
let ordemId = ''
let itemId = ''
let colabDeclara = ''
let colabConfere = ''
let userId = ''

async function cena(minutosAtras: number) {
  const agora = Date.now()
  const conc = await prisma.stockProducaoConclusao.create({
    data: {
      companyId,
      ordemId,
      qtdGerada: 50,
      escalaConsumida: 1,
      custoLoteReal: 100,
      custoUnitarioReal: 2,
      rendimento: 50,
      colaboradorId: colabDeclara,
      criadoEm: new Date(agora - minutosAtras * 60_000),
    },
  })
  return conc.id
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { name: 'Conferência 2d', cnpj: CNPJ } })
  companyId = c.id
  const u = await prisma.user.create({
    data: { email: `conf2d-${Date.now()}@teste.local`, name: 'Gerente', password: 'x' },
  })
  userId = u.id
  /**
   * ⭐ O CARIMBO EXIGE PAPEL NESTA EMPRESA (09/10) — a trava nova mordeu esta fixture, que
   * criava o usuário solto. Sem o vínculo o selo diria "✓✓ conferido" sem ninguém por trás.
   */
  const papel = await prisma.role.findFirst({ where: { name: 'GERENTE_ESTOQUE', companyId: null } })
    ?? await prisma.role.create({ data: { name: 'GERENTE_ESTOQUE', isSystemDefault: true, companyId: null } })
  await prisma.userCompanyRole.create({ data: { userId: u.id, companyId, roleId: papel.id } })

  const item = await prisma.stockItem.create({
    data: { companyId, nome: 'porçao teste 2d', unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
  })
  itemId = item.id
  const ficha = await prisma.stockFicha.create({
    data: { companyId, itemProduzidoId: itemId, tipoProduto: 'INTERMEDIARIO', versaoAtual: 1 },
  })
  await prisma.stockFichaVersao.create({
    data: { companyId, fichaId: ficha.id, versao: 1, loteBase: 50, unidadeLoteBase: 'UN' },
  })
  const o = await prisma.stockProductionOrder.create({
    data: {
      companyId,
      fichaId: ficha.id,
      versaoFicha: 1,
      itemProduzidoId: itemId,
      escalaReceitas: 1,
      estado: 'CONCLUIDA',
      dataProducao: new Date(),
    },
  })
  ordemId = o.id

  const d = await prisma.stockColaborador.create({ data: { companyId, nome: 'nadine' } })
  const f = await prisma.stockColaborador.create({ data: { companyId, nome: 'cristian' } })
  colabDeclara = d.id
  colabConfere = f.id
})

afterEach(async () => {
  for (const t of [
    prisma.aviso, prisma.stockConclusaoCarimbo, prisma.stockConclusaoEstornada,
    prisma.stockProducaoDesvio, prisma.stockProducaoConclusao, prisma.stockMovement,
    prisma.stockFichaComponente, prisma.stockFichaVersao, prisma.stockFicha,
    prisma.stockProductionOrder, prisma.stockOrdemMeta, prisma.stockColaboradorPin,
    prisma.stockColaborador, prisma.stockItem, prisma.stockSaldoCache,
  ]) {
    await (t as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.user.deleteMany({ where: { id: userId } })
})

describe('⭐ o degrau das 3h sai da MESMA fila que desenha os cartões', () => {
  it('conclusão de 10 minutos NÃO vira aviso — é o turno, não pendência', async () => {
    await cena(10)
    const r = await produzirAvisosDeConferencia(companyId)
    expect(r.gravados).toBe(0)
    expect(await avisosAbertos(companyId)).toHaveLength(0)
  })

  it('⭐ conclusão de 4h vira UM aviso, coral, setor gerencia', async () => {
    await cena(240)
    const r = await produzirAvisosDeConferencia(companyId)
    expect(r.gravados).toBe(1)
    const [a] = await avisosAbertos(companyId)
    expect(a.setor).toBe('gerencia')
    expect(a.severidade).toBe('coral')
    expect(a.titulo).toContain('porçao teste 2d')
    /** ⭐ a CONSEQUÊNCIA na frase — o que o dono perde, não o estado técnico */
    expect(a.corpo).toContain('estoque já baixou')
    expect(a.corpo).toContain('nadine declarou')
    expect(a.acaoHref).toContain('#conferencia-do-dia')
  })

  it('⛔ o VEREDITO DO FISCAL nunca entra no texto — a lei de 05/10 vale no sininho também', async () => {
    await cena(240)
    await produzirAvisosDeConferencia(companyId)
    const [a] = await avisosAbertos(companyId)
    const texto = `${a.titulo} ${a.corpo} ${a.oQueFazer}`.toLowerCase()
    for (const cola of ['o material dava', 'permite ~', 'esperado', 'a receita promete']) {
      expect(texto, `cola de prova vazou pro aviso: ${cola}`).not.toContain(cola)
    }
  })
})

describe('⛔ anti-spam e reconciliação', () => {
  it('3 rodadas = 1 aviso só (origem+alvo é único)', async () => {
    await cena(240)
    await produzirAvisosDeConferencia(companyId)
    await produzirAvisosDeConferencia(companyId)
    await produzirAvisosDeConferencia(companyId)
    expect(await avisosAbertos(companyId)).toHaveLength(1)
  })

  it('⭐⭐ CONFERIR RESOLVE o aviso — trabalho feito sai da fila', async () => {
    const conclusaoId = await cena(240)
    await produzirAvisosDeConferencia(companyId)
    expect(await avisosAbertos(companyId)).toHaveLength(1)

    /**
     * ⭐ O CARIMBO ASSINA PELA SESSÃO — nenhum PIN no caminho (correção do dono, 09/10).
     * ⚠️ E o `userId` precisa ter PAPEL nesta empresa: sem vínculo, o motor recusa com
     * `SEM_PAPEL`, porque o selo diria "✓✓ conferido" sem ninguém por trás.
     */
    await confirmarConclusao({ companyId, conclusaoId, userId }, prisma)

    const r = await produzirAvisosDeConferencia(companyId)
    expect(r.resolvidos).toBe(1)
    expect(await avisosAbertos(companyId)).toHaveLength(0)
  })

  it('⛔ conclusão ESTORNADA nunca cobra conferência — o número já foi substituído', async () => {
    const conclusaoId = await cena(240)
    await prisma.stockConclusaoEstornada.create({
      data: { companyId, conclusaoId, motivo: 'grandeza errada', criadoPorId: userId },
    })
    const r = await produzirAvisosDeConferencia(companyId)
    expect(r.gravados).toBe(0)
  })
})

describe('⛔⛔ quem VÊ o setor gerencia', () => {
  it('quem só OPERA estoque não vê — foi quem declarou o lote', () => {
    expect(podeVerSetor(['stock.view', 'stock.operate'], 'gerencia')).toBe(false)
    expect(setoresVisiveis(['stock.view', 'stock.operate'])).not.toContain('gerencia')
  })

  it('⭐ quem GERENCIA vê', () => {
    expect(podeVerSetor(['stock.manage'], 'gerencia')).toBe(true)
    expect(setoresVisiveis(['stock.*'])).toContain('gerencia')
  })

  it('⚠️ e o aviso de produção continua chegando no tablet (a fronteira é só desta família)', () => {
    expect(podeVerSetor(['stock.view'], 'producao')).toBe(true)
  })
})

describe('a frase do tempo', () => {
  it('fala minuto embaixo de 1h30 e hora acima', () => {
    expect(haQuantoTempoTxt(45)).toBe('45 min')
    expect(haQuantoTempoTxt(89)).toBe('89 min')
    expect(haQuantoTempoTxt(240)).toBe('4h')
    expect(haQuantoTempoTxt(255)).toBe('4h15')
  })
})
