/**
 * ⛔⛔⛔ A LISTA DE FICHAS EM LOTE — O N+1 QUE FEZ O DONO ESPERAR 7 SEGUNDOS (28/09/2026)
 *
 * **Medido em prod antes de tocar em código:** `/estoque/producao/receitas` levava
 * **4.909 ms** e disparava **1.786 consultas** — **9,4 por ficha × 189 fichas** —, sendo
 * só **1.200 ms de SQL**: os outros 76% eram **round-trip**. O `$request_time` que nasceu
 * no mesmo dia pegou o dono esperando `rt=6.979`.
 *
 * ⭐⭐ **O QUE MORDE AQUI É A CONTAGEM NÃO CRESCER COM N.** Medir "está rápido" em
 * milissegundos seria teste que passa ou falha pela máquina de quem roda; o que prova o
 * conserto é: **dobrar o número de fichas NÃO dobra as idas ao banco**. Com o laço
 * `for (… await versaoView …)` de volta, a contagem cresce com N e este arquivo fica
 * vermelho (REGRA 11 — reposto e medido).
 *
 * ⭐ E o 2º guard é o que impede o conserto de virar uma SEGUNDA verdade: a view que a
 * LISTA devolve tem que ser **idêntica** à que a ficha sozinha (`getFicha`) devolve. Duas
 * montagens divergiriam no primeiro campo novo, e a lista mostraria um custo e a tela da
 * ficha outro — a doença que este módulo mais paga.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import type { PrismaClient, Prisma } from '@prisma/client'
import { criarFicha, listFichas, getFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao, iniciarProducao } from '../ordens'
import { concluir } from '../conclusao'

const CNPJ = '62626262000162'
let companyId: string

/** itens que servem de componente — custo vem de ENTRADA_NF, a mesma fonte da Posição */
const INSUMOS = [{ nome: 'CARNE LOTE', custo: 40 }, { nome: 'PAO LOTE', custo: 2 }]
let insumoIds: Record<string, string> = {}

/**
 * ⭐ O ESPIÃO — conta as idas ao banco POR MODELO, delegando tudo pro Prisma real.
 *
 * ⚠️ É a única forma honesta de medir isto sem depender de tempo de parede: o que o N+1
 * custa é **round-trip**, e round-trip se conta, não se cronometra.
 */
function espiao(real: PrismaClient) {
  const chamadas: string[] = []
  const proxy = new Proxy(real as unknown as Record<string, unknown>, {
    get(alvo, modelo: string) {
      const delegate = alvo[modelo]
      if (typeof modelo !== 'string' || modelo.startsWith('$') || delegate == null || typeof delegate !== 'object') {
        return delegate
      }
      return new Proxy(delegate as Record<string, unknown>, {
        get(d, op: string) {
          const fn = d[op]
          if (typeof fn !== 'function') return fn
          return (...args: unknown[]) => {
            chamadas.push(`${modelo}.${op}`)
            return (fn as (...a: unknown[]) => unknown).apply(d, args)
          }
        },
      })
    },
  })
  return { db: proxy as unknown as PrismaClient & Prisma.TransactionClient, chamadas }
}

async function criarFichaComPrefixo(n: number) {
  const f = await criarFicha({
    companyId, nomeProduzido: `RECEITA LOTE ${n}`, unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 1, unidadeLoteBase: 'KG', validadeDias: 10,
    etapas: [{ nome: 'gessado' }, { nome: 'moldar' }],
    componentes: INSUMOS.map((k, i) => ({ itemId: insumoIds[k.nome], qtdPlanejada: 1, unidade: 'KG', posicao: i })),
  }, prisma)
  return f.fichaId
}

/** conclui um lote de verdade (é isso que dá rendimento medido pra ficha) */
async function produzir(fichaId: string, qtdGerada: number) {
  const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 1, dataProducao: new Date('2026-09-20') }, prisma)
  await confirmarSeparacao(companyId, ordemId, INSUMOS.map((k) => ({ itemId: insumoIds[k.nome], qtdSeparada: 1 })), prisma)
  await iniciarProducao(companyId, ordemId)
  await concluir({ companyId, ordemId, consumo: INSUMOS.map((k) => ({ itemId: insumoIds[k.nome], qtdConsumida: 1 })), qtdGerada }, prisma)
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'LISTA EM LOTE' } })
  companyId = c.id; insumoIds = {}
  for (const k of INSUMOS) {
    const it = await prisma.stockItem.create({ data: { companyId, nome: k.nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
    insumoIds[k.nome] = it.id
    await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 500, custoUnitario: k.custo, custoTotal: k.custo * 500, origem: 'SEFAZ' } })
  }
})
afterEach(async () => {
  for (const t of ['stockProducaoConclusao', 'stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem', 'stockSaldoCache'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⛔⛔ a lista de fichas não pergunta N vezes o que se pergunta uma', () => {
  it('⭐⭐ as idas ao banco NÃO crescem com o número de fichas', async () => {
    for (let i = 1; i <= 3; i++) await criarFichaComPrefixo(i)
    const a = espiao(prisma)
    const tres = await listFichas(companyId, a.db)
    expect(tres).toHaveLength(3)

    for (let i = 4; i <= 9; i++) await criarFichaComPrefixo(i)
    const b = espiao(prisma)
    const nove = await listFichas(companyId, b.db)
    expect(nove).toHaveLength(9)

    // ⭐ O CORAÇÃO: 3× mais fichas, MESMA quantidade de consultas.
    expect(b.chamadas.length, `3 fichas → ${a.chamadas.length} consultas; 9 fichas → ${b.chamadas.length}. ` +
      'Crescer com N é o N+1 de volta (era 9,4 por ficha).').toBe(a.chamadas.length)

    // ⚠️ e é um punhado, não uma por ficha — se alguém "otimizar" pra 20 consultas fixas,
    // o teste acima ainda passa; este piso diz que o lote é lote de verdade.
    expect(b.chamadas.length).toBeLessThanOrEqual(10)

    // ⛔ nenhum modelo pode ser consultado uma vez por ficha
    const porModelo = b.chamadas.reduce<Record<string, number>>((m, c) => ({ ...m, [c]: (m[c] ?? 0) + 1 }), {})
    for (const [chamada, n] of Object.entries(porModelo)) {
      expect(n, `${chamada} foi chamado ${n}× pra 9 fichas — tem que ser 1`).toBeLessThanOrEqual(2)
    }
  })

  it('⭐ a view da LISTA é idêntica à da ficha sozinha (uma montagem, dois chamadores)', async () => {
    const f1 = await criarFichaComPrefixo(1)
    const f2 = await criarFichaComPrefixo(2)
    await produzir(f1, 12)
    await produzir(f1, 14)

    const lista = await listFichas(companyId, prisma)
    for (const fichaId of [f1, f2]) {
      const sozinha = await getFicha(companyId, fichaId, prisma)
      const naLista = lista.find((v) => v.id === fichaId)
      expect(naLista, 'a ficha sumiu da lista').toBeDefined()
      expect(naLista).toEqual(sozinha!.ficha)
    }
    // ⭐ e o dado do rendimento medido atravessou o lote (era a consulta mais cara: 3 por ficha)
    const comProducao = lista.find((v) => v.id === f1)!
    expect(comProducao.rendimentoLotes).toBe(2)
    expect(comProducao.rendimentoMedio).toBe(13) // (12 + 14) / 2
    expect(comProducao.custoPorUnidade).toBe(3.23) // (40 + 2) / 13
    expect(lista.find((v) => v.id === f2)!.rendimentoMedio).toBeNull() // nunca produziu
  })

  it('⛔⛔ o teto de 5 lotes na média é POR FICHA, nunca do conjunto', async () => {
    /**
     * ⚠️ É a armadilha do lote: buscar "as 5 conclusões mais recentes" do conjunto inteiro
     * daria a média da ficha mais produzida **a todas as outras** — e o número sai
     * plausível, então a tela não denuncia. Aqui a ficha A tem 6 conclusões e a B tem 2:
     * se o corte fosse global, a B ficaria sem média (ou com a média da A).
     */
    const fa = await criarFichaComPrefixo(1)
    const fb = await criarFichaComPrefixo(2)
    for (const q of [10, 10, 10, 10, 10, 10]) await produzir(fa, q) // 6 lotes, todos 10
    for (const q of [20, 20]) await produzir(fb, q)

    const lista = await listFichas(companyId, prisma)
    const a = lista.find((v) => v.id === fa)!
    const b = lista.find((v) => v.id === fb)!
    expect(a.rendimentoLotes).toBe(5) // o teto morde: 6 conclusões, 5 na média
    expect(a.rendimentoMedio).toBe(10)
    expect(b.rendimentoLotes).toBe(2) // ⭐ a B tem a MÉDIA DELA, não a da A
    expect(b.rendimentoMedio).toBe(20)
  })

  it('⭐ ficha sem a versão atual sai de fora, como o `null` do caminho antigo', async () => {
    const f1 = await criarFichaComPrefixo(1)
    const f2 = await criarFichaComPrefixo(2)
    // aponta a ficha 2 pra uma versão que não existe (o estado que o `null` cobria)
    await prisma.stockFicha.update({ where: { id: f2 }, data: { versaoAtual: 99 } })

    const lista = await listFichas(companyId, prisma)
    expect(lista.map((v) => v.id)).toEqual([f1]) // a f2 não entra, e a lista não quebra
    expect(await getFicha(companyId, f2, prisma)).toBeNull()
  })

  it('⭐ as etapas de cada ficha ficam na ficha certa (o lote não embaralha)', async () => {
    const f1 = await criarFichaComPrefixo(1)
    await criarFicha({
      companyId, nomeProduzido: 'RECEITA SEM ETAPA', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
      loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: insumoIds['PAO LOTE'], qtdPlanejada: 1, unidade: 'KG' }],
    }, prisma)

    const lista = await listFichas(companyId, prisma)
    const comEtapas = lista.find((v) => v.id === f1)!
    expect(comEtapas.etapas.map((e) => e.nome)).toEqual(['gessado', 'moldar'])
    expect(lista.find((v) => v.nomeProduzido === 'RECEITA SEM ETAPA')!.etapas).toEqual([])
  })
})
