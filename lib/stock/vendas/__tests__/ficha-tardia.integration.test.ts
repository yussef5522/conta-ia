/**
 * ⭐⭐⭐ A FICHA QUE CHEGOU DEPOIS (25/11/2026) — o PROMOO 3 PIZZAS GRANDES de 24/11, em miniatura.
 *
 * O CASO (medido em prod): vendeu 31 un sem ficha → o fechamento gravou ZERO movimento pra ele; a
 * ficha nasceu 43 min depois. A coluna "destino no estoque" passou a dizer "baixou ficha ✓" (lia o
 * mapa de hoje), a guarda falou só de "porção queijo / caixa" e ninguém perguntou do que ficou pra trás.
 *
 * Os 3 replantios que mordem (REGRA 11):
 *   (a) a coluna lendo a config atual de novo     → o teste da coluna fica vermelho;
 *   (b) a guarda cega pro vendido × 0             → o teste da guarda fica vermelho;
 *   (c) o acerto que duplica o item contado       → o teste da trava da contagem fica vermelho.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '@/lib/stock/producao/fichas'
import { diaEmSaoPaulo, somarDias } from '@/lib/datas/dia-sao-paulo'
import { processarLinhasDaApi, montarPlanoDeLinhas } from '../baixa-venda'
import { lerDetalheDoDia } from '../detalhe-do-dia'
import { lerCentralDeImport } from '../central-de-import'
import { conferirBaixaDoDia, guardarBaixaDoDia } from '../guarda-da-baixa'
import { listarFichaTardia, acertarFichaTardia, ORIGEM_AVISO_FICHA_TARDIA, ALVO_AVISO_FICHA_TARDIA } from '../ficha-tardia'
import { ORIGEM_ACERTO_FICHA_TARDIA } from '../baixou-na-hora'
import { explicarMovimentos } from '../../movimento-explicado'

const CNPJ = '81828384000357'
const PROMO = 'PROMOO 3 PIZZAS GRANDES POR APENAS'
const HOJE = diaEmSaoPaulo()
const DIA = somarDias(HOJE, -1)
const ddmm = `${DIA.slice(8, 10)}/${DIA.slice(5, 7)}`
let companyId = ''
let importId = ''
const it_ = { caixa: '', queijo: '', pao: '' }

const item = async (nome: string, qtd: number, custo: number) => {
  const i = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
  await prisma.stockMovement.create({ data: { companyId, itemId: i.id, tipo: 'ENTRADA_NF', quantidade: qtd, custoUnitario: custo, custoTotal: qtd * custo, origem: 'SEFAZ' } })
  return i.id
}
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'FICHA TARDIA' } })).id
  it_.caixa = await item('CAIXA P/ PIZZA 35 cm', 500, 2.76)
  it_.queijo = await item('porçao queijo 130 grama', 1000, 3.81)
  it_.pao = await item('PAO DE XIS', 100, 1)
  // o XIS já tinha ficha no fechamento; o PROMOO não
  await criarFicha({ companyId, nomeProduzido: 'XIS', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN',
    componentes: [{ itemId: it_.pao, qtdPlanejada: 1, unidade: 'UN' }], mapearNomeSuitable: 'XIS' }, prisma)
  await espera(15)
  const r = await processarLinhasDaApi(companyId, DIA, [
    { produto: 'XIS', quantidade: 4, valorTotal: 120 },
    { produto: PROMO, quantidade: 31, valorTotal: 3330.4 },
  ], prisma, true)
  importId = r.importId
  await espera(15)
  // ⭐ a ficha chega DEPOIS do fechamento (o dono cadastra na manhã seguinte)
  await criarFicha({ companyId, nomeProduzido: PROMO, unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN',
    componentes: [{ itemId: it_.caixa, qtdPlanejada: 3, unidade: 'UN' }, { itemId: it_.queijo, qtdPlanejada: 6, unidade: 'UN' }], mapearNomeSuitable: PROMO }, prisma)
  // ⛔ e o queijo foi CONTADO depois da venda — a contagem já fixou a verdade dele
  const cont = await prisma.stockContagem.create({ data: { companyId, tipo: 'ROTINA', status: 'FINALIZADA', finalizadaEm: new Date() } })
  await prisma.stockContagemItem.create({ data: { companyId, contagemId: cont.id, itemId: it_.queijo, saldoSistema: 1000, qtdContada: 814, divergencia: -186, custoUnitario: 3.81, valorDivergencia: -708.66, contadoEm: new Date() } })
})

afterAll(async () => {
  await prisma.aviso.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('o REGISTRO do fechamento', () => {
  it('⭐ o writer grava o EVENTO: XIS baixou, PROMOO não (zero movimento dele)', async () => {
    const linhas = await prisma.stockVendaLinha.findMany({ where: { companyId, importId }, select: { nomeSuitable: true, mapeadoNoImport: true } })
    expect(Object.fromEntries(linhas.map((l) => [l.nomeSuitable, l.mapeadoNoImport]))).toEqual({ XIS: true, [PROMO]: false })
    const itens = (await prisma.stockMovement.findMany({ where: { companyId, receiptId: importId, tipo: 'BAIXA_VENDA' }, select: { itemId: true } })).map((m) => m.itemId)
    expect(itens).toEqual([it_.pao])
  })
})

describe('(a) a coluna "destino no estoque" — o evento manda', () => {
  it('⛔ CONTRAFACTUAL: a config de HOJE diria que o PROMOO tem destino (era a mentira)', async () => {
    const p = await montarPlanoDeLinhas(companyId, DIA, [{ produto: PROMO, quantidade: 31, valorTotal: 3330.4 }], null, prisma)
    expect(p.produtos.map((x) => x.nome)).toEqual([PROMO])
  })

  it('⭐⭐ PROMOO: "não baixou — sem ficha na hora ✕", e cai nos sem destino do rodapé', async () => {
    const d = await lerDetalheDoDia(companyId, DIA, prisma)
    const promo = d.produtos.find((p) => p.nome === PROMO)!
    expect(promo.destino).toBe('SEM_FICHA_NA_HORA')
    expect(promo.destinoRotulo).toBe('não baixou — sem ficha na hora ✕')
    expect(d.produtos.find((p) => p.nome === 'XIS')!.destino).toBe('BAIXOU_FICHA')
    expect(d.totais.semDestino).toBe(1)
  })

  it('⭐ a lista de dias da central conta o mesmo sem destino (irmão da coluna, REGRA 14)', async () => {
    const c = await lerCentralDeImport(companyId, DIA.slice(0, 7), prisma, HOJE)
    const dia = c.dias.find((x: { dia: string }) => x.dia === DIA) as { conferencia: { semDestino: number } }
    expect(dia.conferencia.semDestino).toBe(1)
  })
})

describe('(b) a GUARDA DIÁRIA — vendido × movimento registrado', () => {
  it('⭐⭐ acusa o PRODUTO (31 × 0) e grita vermelho no sininho, na língua do balcão', async () => {
    const c = await conferirBaixaDoDia(companyId, DIA, prisma)
    expect(c.ficaramPraTras).toEqual([{ nome: PROMO, qtd: 31 }])
    expect(c.status).toBe('FURO')
    await guardarBaixaDoDia(companyId, DIA, prisma)
    const av = await prisma.aviso.findUnique({ where: { companyId_origem_alvo: { companyId, origem: ORIGEM_AVISO_FICHA_TARDIA, alvo: ALVO_AVISO_FICHA_TARDIA } } })
    expect(av?.severidade).toBe('vermelho')
    expect(av?.titulo).toBe(`Acerte o estoque: ${PROMO} vendeu 31 un em ${ddmm} e nada saiu do estoque`)
    expect(av?.resolvidoEm).toBeNull()
    const furo = await prisma.aviso.findFirst({ where: { companyId, origem: 'BAIXA_FURADA', alvo: DIA } })
    expect(furo?.titulo).toContain(`${PROMO} vendeu 31 un`)
  })
})

describe('(c) a pergunta de acerto — trava da contagem e idempotência', () => {
  it('⭐⭐ a pergunta lista o que sai (caixa) e o que fica FORA (queijo contado depois)', async () => {
    const [p] = await listarFichaTardia(companyId, {}, prisma)
    expect(p.nomeSuitable).toBe(PROMO)
    expect(p.quantidade).toBe(31)
    expect(p.baixa.map((b) => [b.itemId, b.qtd])).toEqual([[it_.caixa, 93]])
    expect(p.foraPorContagem.map((b) => [b.itemId, b.qtd])).toEqual([[it_.queijo, 186]])
  })

  it('⭐⭐ o SIM baixa HOJE só a caixa; rodar 2× = 1 acerto; o queijo contado não sai de novo', async () => {
    const agora = new Date()
    const r1 = await acertarFichaTardia(companyId, { importId, nomeSuitable: PROMO }, undefined, prisma, { agora })
    const r2 = await acertarFichaTardia(companyId, { importId, nomeSuitable: PROMO }, undefined, prisma)
    expect(r1.jaFeito).toBe(false)
    expect(r2.jaFeito).toBe(true)
    const acerto = await prisma.stockMovement.findMany({ where: { companyId, origem: ORIGEM_ACERTO_FICHA_TARDIA } })
    expect(acerto.map((m) => [m.itemId, m.quantidade, m.tipo, m.receiptId])).toEqual([[it_.caixa, -93, 'BAIXA_VENDA', importId]])
    expect(acerto[0].dataMovimento.getTime()).toBe(agora.getTime())
    expect(await prisma.stockAcertoFichaTardia.count({ where: { companyId } })).toBe(1)
  })

  it('⭐ o extrato do item diz o motivo', async () => {
    const movs = await prisma.stockMovement.findMany({ where: { companyId, origem: ORIGEM_ACERTO_FICHA_TARDIA } })
    const [l] = await explicarMovimentos(companyId, movs, prisma)
    expect(l.detalhe).toBe(`acerto · ficha criada depois (venda de ${ddmm})`)
  })

  it('⭐ depois do acerto: a coluna diz "acertado depois", o rodapé zera, a guarda bate e o sininho cala', async () => {
    const d = await lerDetalheDoDia(companyId, DIA, prisma)
    expect(d.produtos.find((p) => p.nome === PROMO)!.destino).toBe('ACERTADO_DEPOIS')
    expect(d.totais.semDestino).toBe(0)
    const c = await conferirBaixaDoDia(companyId, DIA, prisma)
    expect(c.status).toBe('BATE')
    expect(await listarFichaTardia(companyId, {}, prisma)).toEqual([])
    const av = await prisma.aviso.findUnique({ where: { companyId_origem_alvo: { companyId, origem: ORIGEM_AVISO_FICHA_TARDIA, alvo: ALVO_AVISO_FICHA_TARDIA } } })
    expect(av?.resolvidoEm).not.toBeNull()
  })
})
