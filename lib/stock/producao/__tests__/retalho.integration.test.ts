/**
 * ⭐⭐⭐ RETALHO — CONTRA BANCO, PELO CAMINHO REAL (09/10/2026, Parte 1).
 *
 * ⛔ Integração e não teste puro porque as três coisas que mais importam só existem no caminho
 * real: (a) **a trava do servidor** (retalho em receita não marcada é recusado), (b) **ZERO
 * LEDGER** (o retalho não gera movimento nenhum — Fase 1, ordem do dono) e (c) **a separação
 * NÃO muda** (ficha × pedido, a lei de 03/10).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarOrdem, OrdemError, explodirSeparacao } from '../ordens'
import { filaDeConferencia } from '../fila-de-conferencia'
import { fiscalDeOrdens } from '../fiscal-dos-lotes'
import { produzirAvisosDeRetalho } from '@/lib/avisos/produtores/retalho'
import { PESO_DA_METADE_G } from '../retalho'

const CNPJ = '71727374000171'
let companyId = ''
let fichaMassa = ''
let fichaOutra = ''
let itemMassa = ''
let itemOutro = ''
let farinhaId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'RETALHO DE MASSA' } })
  companyId = c.id

  const farinha = await prisma.stockItem.create({
    data: { companyId, nome: 'FARINHA', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
  })
  farinhaId = farinha.id

  /** a receita do caso: «metade de bolinha massa de pizza» — 10 metades por receita */
  const prod = await prisma.stockItem.create({
    data: { companyId, nome: 'metade de bolinha massa de pizza', unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
  })
  itemMassa = prod.id
  const f1 = await prisma.stockFicha.create({
    data: { companyId, itemProduzidoId: itemMassa, tipoProduto: 'INTERMEDIARIO', versaoAtual: 1 },
  })
  fichaMassa = f1.id
  const v1 = await prisma.stockFichaVersao.create({
    data: { companyId, fichaId: fichaMassa, versao: 1, loteBase: 10, unidadeLoteBase: 'UN' },
  })
  await prisma.stockFichaComponente.create({
    data: { companyId, versaoId: v1.id, itemId: farinhaId, qtdPlanejada: 2, unidade: 'KG', posicao: 0 },
  })
  /** ⭐ o interruptor: SÓ esta ficha aceita retalho, com a metade pesando 200 g */
  await prisma.stockFichaRetalho.create({
    data: { companyId, fichaId: fichaMassa, aceitaRetalho: true, pesoUnidadeG: PESO_DA_METADE_G },
  })

  /** ⛔ a receita VIZINHA — ela representa as outras 189: NADA muda nela */
  const outro = await prisma.stockItem.create({
    data: { companyId, nome: 'porcao de carne 100 grama', unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
  })
  itemOutro = outro.id
  const f2 = await prisma.stockFicha.create({
    data: { companyId, itemProduzidoId: itemOutro, tipoProduto: 'INTERMEDIARIO', versaoAtual: 1 },
  })
  fichaOutra = f2.id
  const v2 = await prisma.stockFichaVersao.create({
    data: { companyId, fichaId: fichaOutra, versao: 1, loteBase: 10, unidadeLoteBase: 'UN' },
  })
  await prisma.stockFichaComponente.create({
    data: { companyId, versaoId: v2.id, itemId: farinhaId, qtdPlanejada: 1, unidade: 'KG', posicao: 0 },
  })
})

afterEach(async () => {
  for (const t of [
    prisma.stockOrdemRetalho, prisma.stockFichaRetalho, prisma.aviso,
    prisma.stockConclusaoCarimbo, prisma.stockProducaoConclusao, prisma.stockMovement,
    prisma.stockOrdemEtapa, prisma.stockFichaComponente, prisma.stockFichaVersao,
    prisma.stockFicha, prisma.stockProductionOrder, prisma.stockOrdemMeta, prisma.stockItem,
    prisma.stockSaldoCache,
  ]) {
    await (t as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const criar = (fichaId: string, pedido: number, retalhoKg?: number) =>
  criarOrdem(
    { companyId, fichaId, escalaReceitas: pedido / 10, pedidoUnidades: pedido, retalhoKg, dataProducao: new Date() },
    prisma,
  )

describe('⛔⛔ O RETALHO SÓ EXISTE NA RECEITA MARCADA', () => {
  it('⛔⛔ receita NÃO marcada RECUSA o retalho — e quem recusa é o SERVIDOR', async () => {
    const ordensAntes = await prisma.stockProductionOrder.count({ where: { companyId } })
    await expect(criar(fichaOutra, 100, 5)).rejects.toThrow(OrdemError)
    /**
     * ⛔⛔ **E NADA FICA GRAVADO PELA METADE — este é o achado da prova em prod (09/10).** A 1ª
     * versão checava a config DEPOIS do `create`: a rota devolvia 422 e **a ordem ficava no
     * banco**, em PLANEJADA, sem nada. A contabilidade de escrita da prova pegou (531 → 532).
     */
    expect(await prisma.stockOrdemRetalho.count({ where: { companyId } })).toBe(0)
    expect(await prisma.stockProductionOrder.count({ where: { companyId } }), 'a ordem ficou gravada pela metade').toBe(ordensAntes)
  })

  it('⭐ a receita marcada aceita e GRAVA com rastro', async () => {
    const { ordemId } = await criar(fichaMassa, 200, 9.2)
    const r = await prisma.stockOrdemRetalho.findFirstOrThrow({ where: { companyId, ordemId } })
    expect(r.kg).toBe(9.2)
    expect(r.declaradoEm).toBeInstanceOf(Date)
  })

  /** ⛔ "não tem" é a AUSÊNCIA da linha — e o CHECK do banco exige kg > 0 */
  it('⛔ "não tem" não grava linha nenhuma', async () => {
    await criar(fichaMassa, 200)
    expect(await prisma.stockOrdemRetalho.count({ where: { companyId } })).toBe(0)
  })

  /**
   * ⛔⛔ **O INTERRUPTOR MANDA, NÃO A LINHA.** Ordem antiga que declarou retalho numa ficha que
   * o dono DESLIGOU depois volta a ser fiscalizada sem o bônus — senão a config não valeria nada.
   */
  it('⛔⛔ desligar o interruptor zera o bônus das ordens antigas', async () => {
    const { ordemId } = await criar(fichaMassa, 200, 9.2)
    await prisma.stockFichaRetalho.updateMany({ where: { companyId, fichaId: fichaMassa }, data: { aceitaRetalho: false } })
    await concluir(ordemId, 246, 40)
    const f = (await fiscalDeOrdens(companyId, [ordemId], prisma)).get(ordemId)!
    expect(f.bonusDeRetalho).toBe(0)
    expect(f.retalhoKg).toBeNull()
  })
})

/** ⭐ conclui a ordem: consumo real + a geração, pelo ledger (é o que o fiscal lê) */
async function concluir(ordemId: string, qtdGerada: number, consumoFarinha: number) {
  const ordem = await prisma.stockProductionOrder.findFirstOrThrow({ where: { id: ordemId } })
  await prisma.stockMovement.create({
    data: {
      companyId, itemId: farinhaId, tipo: 'PRODUCAO_CONSUMO', quantidade: -consumoFarinha,
      custoUnitario: 1, custoTotal: -consumoFarinha, receiptId: ordemId, origem: 'MANUAL',
    },
  })
  await prisma.stockProducaoConclusao.create({
    data: {
      companyId, ordemId, qtdGerada, escalaConsumida: ordem.escalaReceitas,
      rendimento: 0, custoLoteReal: 0, custoUnitarioReal: 0,
    },
  })
  await prisma.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'CONCLUIDA' } })
}

describe('⛔⛔⛔ FASE 1 SEM LEDGER — o retalho NÃO é item', () => {
  it('⛔⛔ criar ordem COM retalho gera ZERO movimento', async () => {
    const antes = await prisma.stockMovement.count({ where: { companyId } })
    await criar(fichaMassa, 200, 9.2)
    expect(await prisma.stockMovement.count({ where: { companyId } })).toBe(antes)
  })

  /**
   * ⭐⭐ **A SEPARAÇÃO NÃO MUDA — e esta é a prova que fecha a lei de 03/10.** O material que
   * sai da câmara é o do PEDIDO; o retalho **já estava na cozinha**.
   */
  it('⭐⭐ a separação com e sem retalho é IDÊNTICA', async () => {
    const a = await criar(fichaMassa, 200)
    const b = await criar(fichaMassa, 200, 9.2)
    /** ⚠️ a assinatura devolve `{ ordem, linhas }` — chutei o array e o teste cobrou */
    const sa = await explodirSeparacao(companyId, a.ordemId, prisma)
    const sb = await explodirSeparacao(companyId, b.ordemId, prisma)
    expect(sb.linhas.map((l) => [l.itemId, l.qtdPlanejada]))
      .toEqual(sa.linhas.map((l) => [l.itemId, l.qtdPlanejada]))
    /** ⚠️ e é o material do pedido: 200 ÷ 10 × 2 KG = 40 KG */
    expect(sb.linhas[0].qtdPlanejada).toBe(40)
  })
})

describe('⭐⭐⭐ O CASO REAL DO DONO: pedido 200 + 9,2 kg → declarou 246 → confere', () => {
  it('⛔ SEM retalho o fiscal ACUSA (o alarme falso que ele mediu)', async () => {
    const { ordemId } = await criar(fichaMassa, 200)
    await concluir(ordemId, 246, 40)
    const f = (await fiscalDeOrdens(companyId, [ordemId], prisma)).get(ordemId)!
    expect(f.permitido).toBe(200)
    expect(f.impossivel).toBe(true)
  })

  it('⭐⭐ COM 9,2 kg o MESMO lote confere — e a fila mostra o esperado', async () => {
    const { ordemId } = await criar(fichaMassa, 200, 9.2)
    await concluir(ordemId, 246, 40)

    const f = (await fiscalDeOrdens(companyId, [ordemId], prisma)).get(ordemId)!
    expect(f.bonusDeRetalho).toBe(46)
    expect(f.permitido).toBe(246)
    expect(f.impossivel).toBe(false)
    expect(f.retalhoKg).toBe(9.2)

    const fila = await filaDeConferencia(companyId, prisma)
    expect(fila.aguardando).toBe(1)
    const c = fila.cartoes[0]
    expect(c.declarado).toBe(246)
    expect(c.pedido).toBe(200)
    /** ⭐ o esperado COM retalho — e ele vive SÓ aqui (payload de gerência) */
    expect(c.esperadoComRetalho).toBe(246)
    expect(c.esperadoTxt).toBe('246')
    expect(c.retalhoKg).toBe(9.2)
    expect(c.fiscalOk).toBe(true)
    expect(c.fiscalResumo).toBe('confere')
  })

  /** ⛔ as outras 189: nada muda — nem esperado, nem bônus, nem retalho */
  it('⛔⛔ a receita vizinha não ganha esperado nem bônus', async () => {
    const { ordemId } = await criar(fichaOutra, 100)
    await concluir(ordemId, 100, 10)
    const f = (await fiscalDeOrdens(companyId, [ordemId], prisma)).get(ordemId)!
    expect(f.bonusDeRetalho).toBe(0)
    expect(f.retalhoKg).toBeNull()
    const c = (await filaDeConferencia(companyId, prisma)).cartoes[0]
    expect(c.esperadoComRetalho).toBeNull()
    expect(c.esperadoTxt).toBeNull()
    expect(c.retalhoKg).toBeNull()
  })
})

describe('⚠️ A SANIDADE — retalho > 20 kg avisa (e não trava)', () => {
  it('⭐ 25 kg vira aviso ÂMBAR no sininho, com a consequência dita', async () => {
    const { ordemId } = await criar(fichaMassa, 200, 25)
    const r = await produzirAvisosDeRetalho(companyId, new Date(), prisma)
    expect(r.gravados).toBe(1)
    expect(r.recusados).toEqual([])
    const a = await prisma.aviso.findFirstOrThrow({ where: { companyId, origem: 'RETALHO_ALTO' } })
    expect(a.severidade).toBe('ambar')
    expect(a.setor).toBe('producao')
    expect(a.alvo).toBe(`ordem:${ordemId}`)
    /** ⭐ a CONSEQUÊNCIA: o retalho afrouxa o fiscal — sem isso é só uma observação */
    expect(a.corpo).toMatch(/folga no fiscal/)
    /** ⛔ e NÃO TRAVOU: a ordem existe */
    expect(await prisma.stockProductionOrder.count({ where: { companyId, id: ordemId } })).toBe(1)
  })

  it('⛔ 9,2 kg (o normal) NÃO avisa — alarme em tudo é alarme em nada', async () => {
    await criar(fichaMassa, 200, 9.2)
    const r = await produzirAvisosDeRetalho(companyId, new Date(), prisma)
    expect(r.gravados).toBe(0)
    expect(await prisma.aviso.count({ where: { companyId, origem: 'RETALHO_ALTO' } })).toBe(0)
  })

  /** ⚠️ ANTI-SPAM padrão: origem+alvo é único, então 3 rodadas = 1 aviso */
  it('⚠️ 3 rodadas = 1 aviso', async () => {
    await criar(fichaMassa, 200, 25)
    for (let i = 0; i < 3; i++) await produzirAvisosDeRetalho(companyId, new Date(), prisma)
    expect(await prisma.aviso.count({ where: { companyId, origem: 'RETALHO_ALTO' } })).toBe(1)
  })
})
