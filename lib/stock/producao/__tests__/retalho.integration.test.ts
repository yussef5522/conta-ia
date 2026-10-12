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
import { confirmarPedido } from '../confirmar-pedido'
import { filaDeConferencia } from '../fila-de-conferencia'
import { fiscalDeOrdens } from '../fiscal-dos-lotes'
import { produzirAvisosDeRetalho } from '@/lib/avisos/produtores/retalho'
import { PESO_DA_METADE_G, configDeRetalho, retalhoDasOrdens, linhaDoRetalho } from '../retalho'

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
    prisma.stockFicha, prisma.stockProductionOrder, prisma.stockOrdemPedidoDeclarado,
    prisma.stockOrdemMeta, prisma.stockItem,
    prisma.stockSaldoCache,
  ]) {
    await (t as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/**
 * ⚠️⚠️ ATUALIZADO EM 11/10 — **o gesto virou DOIS, e a prova ficou mais forte.**
 *
 * Até 10/10 a quantidade (e o retalho) eram perguntados na CRIAÇÃO. O dono achou o fantasma
 * (*"quantidade perguntada 2×, e o 1º número assombra a tela"*): agora criar é enxuto e a
 * pergunta — número **e** retalho — vive na página da ordem, com o writer único
 * `confirmarPedido`. O helper passou a exercitar **os dois gestos**, que é o caminho real.
 */
const criar = async (fichaId: string, pedido: number, retalhoKg?: number) => {
  const o = await criarOrdem({ companyId, fichaId, dataProducao: new Date() }, prisma)
  await confirmarPedido({ companyId, ordemId: o.ordemId, unidades: pedido, retalhoKg: retalhoKg ?? null }, prisma)
  return o
}

describe('⛔⛔ O RETALHO SÓ EXISTE NA RECEITA MARCADA', () => {
  it('⛔⛔ receita NÃO marcada RECUSA o retalho — e quem recusa é o SERVIDOR', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId: fichaOutra, dataProducao: new Date() }, prisma)
    await expect(
      confirmarPedido({ companyId, ordemId, unidades: 100, retalhoKg: 5 }, prisma),
    ).rejects.toThrow(OrdemError)
    /**
     * ⛔⛔ **E NADA FICA GRAVADO PELA METADE — o achado da prova em prod (09/10), agora um
     * degrau acima.** A 1ª versão daquele dia checava a config DEPOIS do `create` da ordem: a
     * rota devolvia 422 e a ordem ficava no banco em PLANEJADA, vazia (a contabilidade de
     * escrita da prova pegou, 531 → 532).
     *
     * ⚠️ Com a pergunta na página da ordem, a ordem **existe legitimamente** (ela nasceu de um
     * gesto próprio, que deu certo). O que não pode ficar pela metade é **o PEDIDO** — e por
     * isso a config é conferida ANTES de a meta, o rastro ou a escala serem tocados.
     */
    expect(await prisma.stockOrdemRetalho.count({ where: { companyId } })).toBe(0)
    expect(await prisma.stockOrdemMeta.count({ where: { companyId, ordemId } }), 'a meta ficou gravada pela metade').toBe(0)
    expect(await prisma.stockOrdemPedidoDeclarado.count({ where: { companyId, ordemId } })).toBe(0)
    const o = await prisma.stockProductionOrder.findUniqueOrThrow({ where: { id: ordemId }, select: { escalaReceitas: true } })
    expect(o.escalaReceitas, 'a escala não pode ter andado').toBe(1)
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

/**
 * ⭐⭐⭐ O RETALHO VISÍVEL E CORRIGÍVEL (12/10) — passos 1 e 2 do pedido do dono.
 *
 * **O caso:** ordem de 10 UN com 10 KG de retalho declarado, e a página não mostrava nada. A
 * perícia (passo 0) achou os 10 KG **gravados** — o buraco era de EXIBIÇÃO. E ao fechar o
 * buraco apareceu o segundo defeito: *corrigir o pedido APAGAVA o retalho em silêncio*.
 */
describe('⭐⭐ PASSO 1 — o retalho é LEGÍVEL em qualquer estado', () => {
  /**
   * ⛔⛔ O VERMELHO Nº 1 DO DONO: *"ordem COM retalho gravado sem a linha visível no pedido"*.
   *
   * ⚠️ Este teste exercita a **composição que a rota monta** (config + declarado + a lib da
   * linha) **depois de SEPARAR e depois de CONCLUIR** — os estados em que a rota, até 12/10,
   * nem consultava o retalho. O gate `planejada` era o defeito inteiro.
   */
  it('⭐⭐ separada e concluída: a linha continua dizendo "10 KG → +50 UN"', async () => {
    const { ordemId } = await criar(fichaMassa, 10, 10)

    const linhaAgora = async () => {
      const cfg = (await configDeRetalho(companyId, [fichaMassa], prisma)).get(fichaMassa)
      const decl = (await retalhoDasOrdens(companyId, [ordemId], prisma)).get(ordemId)
      return linhaDoRetalho({
        aceita: !!cfg?.aceita, kg: decl?.kg ?? null,
        pesoUnidadeG: cfg?.pesoUnidadeG ?? null, unidade: 'UN',
      })
    }

    for (const estado of ['SEPARADA', 'EM_PRODUCAO'] as const) {
      await prisma.stockProductionOrder.update({ where: { id: ordemId }, data: { estado } })
      const l = await linhaAgora()
      expect(l, `em ${estado} a linha existe`).not.toBeNull()
      expect(l!.declarado, `em ${estado} o retalho é visível`).toBe(true)
      expect(l!.texto).toContain('10 KG')
      expect(l!.texto).toContain('+50 UN')
    }

    /** ⭐ e na CANCELADA também — era o estado da ordem real do dono quando ele reclamou */
    await prisma.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'CANCELADA' } })
    expect((await linhaAgora())!.declarado).toBe(true)
  })

  /** ⛔⛔ receita que aceita e ordem SEM retalho DIZ isso — ausência nunca é dúvida */
  it('⛔⛔ sem retalho declarado a linha DIZ "sem retalho declarado"', async () => {
    const { ordemId } = await criar(fichaMassa, 10)
    const cfg = (await configDeRetalho(companyId, [fichaMassa], prisma)).get(fichaMassa)
    const decl = (await retalhoDasOrdens(companyId, [ordemId], prisma)).get(ordemId)
    const l = linhaDoRetalho({
      aceita: !!cfg?.aceita, kg: decl?.kg ?? null,
      pesoUnidadeG: cfg?.pesoUnidadeG ?? null, unidade: 'UN',
    })
    expect(l!.texto).toBe('sem retalho declarado')
  })

  /** ⛔ e a receita vizinha (as outras 189) não ganha linha nenhuma */
  it('⛔ receita que não aceita segue muda', async () => {
    const { ordemId } = await criar(fichaOutra, 10)
    const cfg = (await configDeRetalho(companyId, [fichaOutra], prisma)).get(fichaOutra)
    const decl = (await retalhoDasOrdens(companyId, [ordemId], prisma)).get(ordemId)
    expect(linhaDoRetalho({
      aceita: !!cfg?.aceita, kg: decl?.kg ?? null,
      pesoUnidadeG: cfg?.pesoUnidadeG ?? null, unidade: 'UN',
    })).toBeNull()
  })
})

describe('⭐⭐ PASSO 2 — corrigir o retalho, pela MESMA porta', () => {
  /**
   * ⛔⛔⛔ **O DEFEITO QUE A PRÓPRIA CONSTRUÇÃO DO PASSO 1 EXPÔS.** O campo do retalho nasce
   * VAZIO na correção (ordem do dono: *"nunca pré-preenchido"*), e até 12/10 *"não respondi"*
   * e *"não tem"* eram a MESMA coisa pro servidor → **corrigir só o número apagava os 10 KG**,
   * sem uma palavra na tela, e o fiscal voltava a acusar o lote à toa.
   */
  it('⛔⛔⛔ corrigir SÓ o pedido NÃO apaga o retalho declarado', async () => {
    const { ordemId } = await criar(fichaMassa, 10, 10)
    expect(await prisma.stockOrdemRetalho.count({ where: { companyId, ordemId } })).toBe(1)

    /** ⚠️ o campo ausente = *"não respondi"* — é o caminho que a tela usa quando ele só troca o número */
    await confirmarPedido({ companyId, ordemId, unidades: 20 }, prisma)

    const r = await prisma.stockOrdemRetalho.findFirstOrThrow({ where: { companyId, ordemId } })
    expect(r.kg, 'os 10 KG continuam').toBe(10)
    const meta = await prisma.stockOrdemMeta.findFirstOrThrow({ where: { companyId, ordemId } })
    expect(meta.unidades, 'e o pedido foi corrigido').toBe(20)
  })

  /** ⭐ *"Não tem"* é resposta EXPLÍCITA e apaga — bônus que o dono retirou não pode sobreviver */
  it('⭐ responder "não tem" (null) APAGA o retalho', async () => {
    const { ordemId } = await criar(fichaMassa, 10, 10)
    await confirmarPedido({ companyId, ordemId, unidades: 10, retalhoKg: null }, prisma)
    expect(await prisma.stockOrdemRetalho.count({ where: { companyId, ordemId } })).toBe(0)
  })

  /** ⭐ e corrigir o KG substitui, sem deixar duas linhas (o unique do banco) */
  it('⭐ corrigir o kg substitui a linha, nunca empilha', async () => {
    const { ordemId } = await criar(fichaMassa, 10, 10)
    await confirmarPedido({ companyId, ordemId, unidades: 10, retalhoKg: 9.2 }, prisma)
    const rs = await prisma.stockOrdemRetalho.findMany({ where: { companyId, ordemId } })
    expect(rs).toHaveLength(1)
    expect(rs[0].kg).toBe(9.2)
  })

  /**
   * ⛔⛔ O VERMELHO Nº 5 DO DONO: *"corrigir retalho depois de separado = vermelho (trava)"*.
   *
   * ⚠️ A trava é a MESMA do pedido, e isso é o ponto: **não nasceu porta nova**. O material já
   * saiu da câmara obedecendo ao pedido atual; mexer no bônus do fiscal depois disso mudaria a
   * régua do lote que já está na panela.
   */
  it('⛔⛔ depois de SEPARADA o retalho não se corrige — e o kg antigo fica intacto', async () => {
    const { ordemId } = await criar(fichaMassa, 10, 10)
    await prisma.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'SEPARADA' } })

    await expect(
      confirmarPedido({ companyId, ordemId, unidades: 10, retalhoKg: 30 }, prisma),
    ).rejects.toThrow(OrdemError)
    await expect(
      confirmarPedido({ companyId, ordemId, unidades: 10, retalhoKg: null }, prisma),
    ).rejects.toThrow(OrdemError)

    const r = await prisma.stockOrdemRetalho.findFirstOrThrow({ where: { companyId, ordemId } })
    expect(r.kg, 'nada do retalho se mexeu').toBe(10)
  })

  /** ⛔ e a trava da receita não marcada vale igual na CORREÇÃO, não só na 1ª declaração */
  it('⛔ corrigir pra uma receita que não aceita segue 422, sem gravar', async () => {
    const { ordemId } = await criar(fichaOutra, 10)
    await expect(
      confirmarPedido({ companyId, ordemId, unidades: 20, retalhoKg: 5 }, prisma),
    ).rejects.toThrow(OrdemError)
    const meta = await prisma.stockOrdemMeta.findFirstOrThrow({ where: { companyId, ordemId } })
    expect(meta.unidades, 'o pedido antigo não foi tocado').toBe(10)
  })
})
