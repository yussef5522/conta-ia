/**
 * ⛔⛔⛔ A LISTA DE DIAS DE COMPLEMENTO MONTA OS N DIAS EM **LOTE** (20/10/2026).
 *
 * **A medição que motivou:** a lista levava **~12 s** com 42 dias. `listarDiasComplemento`
 * chamava `montarPlanoComplementos` **dentro do laço** — um plano COMPLETO por dia, e cada
 * plano relia o mapa de nomes, remontava o `ctx` das fichas e varria saldo+custo do ledger
 * inteiro. 42 vezes. Pra a lista aproveitar **DOIS booleanos** (`baixado`,
 * `precisaReprocessar`).
 *
 * ⭐⭐ **O GUARD MEDE CONTAGEM DE CONSULTAS QUE NÃO CRESCE COM N, NUNCA MILISSEGUNDO** — o
 * padrão de 28/09 (o N+1 das 189 fichas): *o que o N+1 custa é round-trip, e round-trip se
 * CONTA, não se cronometra.* Teste em milissegundo passa ou falha pela máquina de quem roda;
 * a contagem não.
 *
 * ⛔ E o espião vem do **dono único** (`lib/testing/espiao-de-consultas.ts`): ele nasceu no
 * guard de 28/09 e saiu pra lá hoje, quando o segundo N+1 apareceu. **Copiá-lo seria a 2ª
 * régua de "o que conta como ida ao banco"** — e as duas divergiriam no primeiro `$`-método
 * novo, com um guard medindo o que o outro ignora (REGRA 4).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { espiaoDeConsultas } from '@/lib/testing/espiao-de-consultas'
import { listarDiasComplemento } from '../baixa-complemento'
import { criarFicha } from '../../producao/fichas'

/** ⚠️ CNPJ conferido LIVRE no repo antes de escolher — o guard `cnpj-de-teste-nao-colide` reprova colisão */
const CNPJ = '92929292000192'
let companyId = ''
let fichaId = ''
let itemId = ''

/** ⭐ o nome do PDV é o MESMO em todos os dias — é o caso real (a CALABRESA vende todo dia) */
const NOME = 'CALABRESA'

async function criarDias(quantos: number) {
  for (let i = 0; i < quantos; i++) {
    // ⚠️ dias distintos e no PASSADO: data fixa no futuro é bomba de calendário (REGRA 12 de 01/09)
    const dia = new Date(Date.UTC(2026, 0, i + 1, 0, 0, 0))
    await prisma.stockVendaComplementoLinha.create({
      data: {
        companyId,
        // ⚠️ o `importId` sintético é o mesmo formato do import real (`comp-<companyId>-<data>`)
        importId: `comp-${companyId}-2026-01-${String(i + 1).padStart(2, '0')}`,
        data: dia,
        nomeSuitable: NOME,
        ocorrencias: 3,
        valorTotal: 0,
      },
    })
  }
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'LISTA EM LOTE' } })
  companyId = c.id

  const it0 = await prisma.stockItem.create({
    data: { companyId, nome: 'porcao de calabresa 120 grama', unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
  })
  itemId = it0.id
  await prisma.stockMovement.create({
    data: { companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 500, custoUnitario: 2, custoTotal: 1000, origem: 'SEFAZ' },
  })

  // ⭐ pela porta da casa (versiona de verdade) e com o vínculo na MESMA transação
  const f = await criarFicha(
    {
      companyId,
      nomeProduzido: 'CALABRESA (sabor)',
      unidadeProduzido: 'UN',
      tipoProduto: 'SABOR',
      loteBase: 1,
      unidadeLoteBase: 'UN',
      componentes: [{ itemId, qtdPlanejada: 1, unidade: 'UN' }],
      mapearComplemento: NOME,
    },
    prisma,
  )
  fichaId = f.fichaId
})

afterEach(async () => {
  /**
   * ⚠️ Apaga as `stock_*` EXPLICITAMENTE — o isolamento do módulo proíbe `@relation` às
   * tabelas fechadas (o `companyId` é VALOR indexado), então não existe cascade. A cicatriz
   * de 02/10: o teste DISCIPLINADO que apaga a própria `Company` tira a empresa da rede de
   * limpeza e deixa 161.810 linhas órfãs pra sempre.
   */
  for (const t of ['stockMovement', 'stockVendaComplementoLinha', 'stockVendaComplementoMap', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐⭐ a contagem de consultas NÃO cresce com o número de dias', () => {
  it('3 dias e 9 dias custam as MESMAS idas ao banco', async () => {
    await criarDias(3)
    const a = espiaoDeConsultas(prisma)
    const d3 = await listarDiasComplemento(companyId, a.db)
    expect(d3).toHaveLength(3)

    await criarDias(9) // ⚠️ dias 1..3 já existem; `criarDias(9)` recria 1..3 e acrescenta 4..9
    const dias = await prisma.stockVendaComplementoLinha.groupBy({ by: ['data'], where: { companyId }, _count: true })
    expect(dias.length).toBe(9)

    const b = espiaoDeConsultas(prisma)
    const d9 = await listarDiasComplemento(companyId, b.db)
    expect(d9).toHaveLength(9)

    expect(
      b.chamadas.length,
      `3 dias → ${a.chamadas.length} consultas; 9 dias → ${b.chamadas.length}. ` +
        'Crescer com N é o N+1 de volta (eram ~6 por dia: mapa + ctx + saldo + custo + baixas + estornos).',
    ).toBe(a.chamadas.length)

    // ⚠️ piso ABSOLUTO: sem ele o teste passaria com 300 consultas fixas em qualquer N
    expect(b.chamadas.length).toBeLessThanOrEqual(10)
  })

  it('⛔ NENHUM modelo é consultado uma vez por dia', async () => {
    await criarDias(9)
    const e = espiaoDeConsultas(prisma)
    await listarDiasComplemento(companyId, e.db)

    const porModelo = e.porModelo()
    for (const [chamada, vezes] of Object.entries(porModelo)) {
      expect(
        vezes,
        `${chamada} foi chamado ${vezes}× pra 9 dias — consulta por dia é o N+1.`,
      ).toBeLessThan(9)
    }
  })

  it('⭐ o mapa, as fichas e as baixas são lidos UMA vez', async () => {
    await criarDias(9)
    const e = espiaoDeConsultas(prisma)
    await listarDiasComplemento(companyId, e.db)

    const m = e.porModelo()
    expect(m['stockVendaComplementoMap.findMany'] ?? 0).toBeLessThanOrEqual(1)
    // ⭐ as BAIXA_VENDA ativas dos N dias em 2 consultas (as baixas + os estornos), nunca 2 por dia
    expect(m['stockMovement.findMany'] ?? 0).toBeLessThanOrEqual(2)
  })

  /**
   * ⛔⛔ O CASO QUE **ISOLA** A 2ª CONSULTA DO LOTE (os estornos).
   *
   * ⚠️ A REGRA 11 me pegou aqui: repondo *"um `findFirst` de estorno POR BAIXA"* dentro do
   * `baixasAtivasEmLote`, os testes acima ficavam **VERDES** — porque nenhum deles tem baixa,
   * e sem baixa o lote retorna ANTES do laço (`if (!baixas.length) return out`). ***Guard que
   * não roda contra o defeito que o motivou é uma afirmação sobre o mundo bom.***
   */
  it('⛔ 9 dias TODOS baixados: os estornos saem em UMA consulta, nunca uma por baixa', async () => {
    await criarDias(9)
    const dias = await listarDiasComplemento(companyId, prisma)
    expect(dias).toHaveLength(9)
    for (const d of dias) {
      await prisma.stockMovement.create({
        data: {
          companyId, itemId, tipo: 'BAIXA_VENDA', quantidade: -3,
          custoUnitario: 2, custoTotal: -6, origem: 'SUITABLE', receiptId: d.importId,
        },
      })
    }

    const e = espiaoDeConsultas(prisma)
    const d9 = await listarDiasComplemento(companyId, e.db)
    expect(d9.every((d) => d.baixado), 'os 9 dias estão baixados — é a cena que exercita o lote').toBe(true)

    const m = e.porModelo()
    expect(
      m['stockMovement.findMany'] ?? 0,
      'as 9 baixas + os estornos delas saem em 2 consultas; uma por baixa é o N+1 por dentro.',
    ).toBeLessThanOrEqual(2)
    expect(m['stockMovement.findFirst'] ?? 0, 'estorno resolvido um a um é o N+1 por dentro').toBe(0)
    expect(e.chamadas.length).toBeLessThanOrEqual(10)
  })
})

/**
 * ⭐⭐ AUTO-TESTE DO INSTRUMENTO (REGRA 11).
 *
 * ⚠️ Sem isto o guard passa por **CEGUEIRA**: repondo *"o espião para de contar"* todos os
 * testes acima ficavam **VERDES**, porque `0 === 0`, `0 <= 10` e um `porModelo()` vazio
 * satisfazem cada asserção. ***Instrumento cego aprova qualquer coisa*** — é a mesma lição dos
 * detectores de fonte que nasceram sem auto-teste nesta casa.
 */
describe('⭐ o espião CONTA de verdade (auto-teste)', () => {
  it('registra cada ida ao banco por modelo.operação e delega o resultado', async () => {
    const e = espiaoDeConsultas(prisma)
    const achou = await e.db.company.findFirst({ where: { id: companyId }, select: { cnpj: true } })
    await e.db.stockItem.findMany({ where: { companyId }, select: { id: true } })

    expect(achou?.cnpj, 'o espião DELEGA — ele mede, não substitui o Prisma').toBe(CNPJ)
    expect(e.chamadas).toEqual(['company.findFirst', 'stockItem.findMany'])
    expect(e.porModelo()).toEqual({ 'company.findFirst': 1, 'stockItem.findMany': 1 })
  })
})

describe('⭐ o LOTE devolve a MESMA verdade que o dia a dia', () => {
  it('dia sem baixa: baixado=false, precisaReprocessar=false, apurado=true', async () => {
    await criarDias(2)
    const dias = await listarDiasComplemento(companyId, prisma)
    expect(dias).toHaveLength(2)
    for (const d of dias) {
      expect(d.baixado).toBe(false)
      expect(d.precisaReprocessar).toBe(false)
      // ⛔ `apurado` é o 4º silêncio fechado: ausência de MEDIÇÃO não é ausência de baixa
      expect(d.apurado).toBe(true)
      expect(d.linhas).toBe(1)
      expect(d.ocorrencias).toBe(3)
    }
  })

  it('⭐ dia JÁ baixado pelo motor aparece como baixado e NÃO pede reprocesso', async () => {
    await criarDias(1)
    const [d0] = await listarDiasComplemento(companyId, prisma)

    // a baixa que o motor gravaria: 3 ocorrências × 1 UN da porção
    await prisma.stockMovement.create({
      data: {
        companyId, itemId, tipo: 'BAIXA_VENDA', quantidade: -3,
        custoUnitario: 2, custoTotal: -6, origem: 'SUITABLE', receiptId: d0.importId,
      },
    })

    const [d1] = await listarDiasComplemento(companyId, prisma)
    expect(d1.baixado).toBe(true)
    expect(d1.precisaReprocessar, 'o motor e o ledger concordam — nada a reprocessar').toBe(false)
    expect(d1.apurado).toBe(true)
  })

  it('⛔⛔ baixa que NÃO fecha com o motor pede reprocesso', async () => {
    await criarDias(1)
    const [d0] = await listarDiasComplemento(companyId, prisma)

    // baixou 1 onde o motor diz 3 (o dia foi baixado com o mapa de ANTES)
    await prisma.stockMovement.create({
      data: {
        companyId, itemId, tipo: 'BAIXA_VENDA', quantidade: -1,
        custoUnitario: 2, custoTotal: -2, origem: 'SUITABLE', receiptId: d0.importId,
      },
    })

    const [d1] = await listarDiasComplemento(companyId, prisma)
    expect(d1.baixado).toBe(true)
    expect(d1.precisaReprocessar).toBe(true)
  })

  it('⭐ baixa ESTORNADA não conta como baixado — o dia volta a pedir a baixa', async () => {
    await criarDias(1)
    const [d0] = await listarDiasComplemento(companyId, prisma)

    const b = await prisma.stockMovement.create({
      data: {
        companyId, itemId, tipo: 'BAIXA_VENDA', quantidade: -3,
        custoUnitario: 2, custoTotal: -6, origem: 'SUITABLE', receiptId: d0.importId,
      },
    })
    await prisma.stockMovement.create({
      data: {
        companyId, itemId, tipo: 'ESTORNO', quantidade: 3,
        custoUnitario: 2, custoTotal: 6, origem: 'SUITABLE', receiptId: d0.importId, estornoDeId: b.id,
      },
    })

    const [d1] = await listarDiasComplemento(companyId, prisma)
    expect(d1.baixado, 'estorno anula a baixa — o dia NÃO está baixado').toBe(false)
    expect(d1.precisaReprocessar).toBe(false)
  })
})
