// ⭐⭐ O CASO DO PRINT, PONTA A PONTA (01/09/2026) — "porção queijo 135 grama".
//
// Prova as três coisas que o dono pediu, rodando o caminho REAL (ficha → ordem → separação
// → conclusão), não a lib pura isolada:
//   1. a separação devolve **0,135 KG**, não o `0,14` arredondado que ele viu no print;
//   2. a **previsão** da tela e o **rendimento gravado** saem da MESMA escala (fonte única);
//   3. o **desvio + motivo** ficam gravados na ordem.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao, iniciarProducao, explodirSeparacao } from '../ordens'
import { concluir, rendimentoMedidoDaFicha } from '../conclusao'
import { escalaDoConsumo, preverSaida, insumoParaSaida } from '../previsao-rendimento'

const CNPJ = '50505050000177'
const POR_LOTE = 0.135 // KG de mussarela por porção — a precisão que o print perdia
let companyId: string
let queijoId: string
let fichaId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'PREVISAO' } })
  companyId = c.id
  const it = await prisma.stockItem.create({ data: { companyId, nome: 'MUSSARELA EM PECA', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  queijoId = it.id
  await prisma.stockMovement.create({ data: { companyId, itemId: queijoId, tipo: 'ENTRADA_NF', quantidade: 200, custoUnitario: 31.9, custoTotal: 6380, origem: 'SEFAZ' } })
  const f = await criarFicha({
    companyId, nomeProduzido: 'porção queijo 135 grama', unidadeProduzido: 'UN',
    tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN', validadeDias: 10,
    componentes: [{ itemId: queijoId, qtdPlanejada: POR_LOTE, unidade: 'KG', posicao: 0 }],
  }, prisma)
  fichaId = f.fichaId
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockProducaoDesvio', 'stockProducaoConclusao', 'stockMovement', 'stockProductionOrder', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** faz uma produção inteira e devolve o rendimento gravado */
async function produzir(kgSeparado: number, qtdGerada: number, motivo?: string) {
  const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 1, dataProducao: new Date() }, prisma)
  await confirmarSeparacao(companyId, ordemId, [{ itemId: queijoId, qtdSeparada: kgSeparado }], prisma)
  await iniciarProducao(companyId, ordemId, prisma)
  const r = await concluir({ companyId, ordemId, consumo: [{ itemId: queijoId, qtdConsumida: kgSeparado }], qtdGerada, motivoDesvio: motivo ?? null }, prisma)
  return { ordemId, ...r }
}

describe('⛔⛔ o 0,14 do print', () => {
  it('⛔⛔ a separação devolve 0,135 KG — a precisão da FICHA, não arredondada', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 1, dataProducao: new Date() }, prisma)
    const { linhas, ordem } = await explodirSeparacao(companyId, ordemId, prisma)
    expect(linhas[0].qtdPlanejada).toBe(0.135) // era 0,14 com o round2
    expect(linhas[0].porLote).toBe(0.135)      // a régua que a tela usa pra converter
    expect(ordem.loteBase).toBe(1)             // o teórico da versão TRAVADA na ordem
  })

  it('⛔ em 370 porções o arredondamento seria 1,85 KG de queijo (o número do dono)', async () => {
    const comArredondamento = 0.14 * 370
    const certo = POR_LOTE * 370
    expect(comArredondamento - certo).toBeCloseTo(1.85, 2)
  })
})

describe('⭐⭐ a previsão e o rendimento gravado saem da MESMA escala', () => {
  it('⭐ 20,85 KG → a tela prevê ~154 e o rendimento gravado bate com ela', async () => {
    // a tela calcularia assim, com o `porLote` que a rota devolve:
    const escalaDaTela = escalaDoConsumo([{ qtd: 20.85, porLote: POR_LOTE }])!
    const previsto = preverSaida(escalaDaTela, { teorico: 1, medido: null, lotes: 0 })
    expect(Math.round(previsto.teorico)).toBe(154) // o "~154" que faltava no print

    // e o motor, ao concluir com exatamente esse número, grava rendimento ≈ 1 por receita
    const r = await produzir(20.85, 154)
    expect(r.escalaConsumida).toBeCloseTo(escalaDaTela, 3) // ⭐ a MESMA escala
    expect(r.rendimento).toBeCloseTo(0.9971, 3)
  })

  it('⭐⭐ o sentido principal: "faz 200 porções" com média medida → 29,3 KG', async () => {
    // duas produções a ~92% criam a régua medida
    await produzir(20.85, 142)
    await produzir(20.85, 142)
    const { media, lotes } = await rendimentoMedidoDaFicha(companyId, fichaId, prisma)
    expect(lotes).toBe(2)
    expect(media).toBeCloseTo(0.92, 2)

    const kg = insumoParaSaida(200, POR_LOTE, { teorico: 1, medido: media, lotes })!
    expect(kg).toBeCloseTo(29.35, 1)  // e não 27, que faria FALTAR queijo
  })
})

describe('⭐ o desvio e o motivo ficam gravados na ordem', () => {
  it('⭐ saíram 120 de ~154 → desvio gravado com o motivo escrito pelo dono', async () => {
    await produzir(20.85, 142)
    await produzir(20.85, 142) // régua medida existe (2 lotes)
    const r = await produzir(20.85, 120, 'queijo veio com muita casca')

    expect(r.variacao.faixa).toBe('ABAIXO')
    expect(r.variacao.pctTeorico).toBeCloseTo(0.777, 2) // o "78%" do dono

    const d = await prisma.stockProducaoDesvio.findFirst({ where: { companyId, conclusaoId: r.conclusaoId } })
    expect(d).not.toBeNull()
    expect(d!.motivo).toBe('queijo veio com muita casca')
    expect(d!.lotesNaMedia).toBe(2)
    expect(d!.pctTeorico).toBeCloseTo(0.777, 2)
    // ⭐ o gravado é o MESMO julgamento que a tela mostrou — não há segunda conta
    expect(d!.pctMedia).toBeCloseTo(r.variacao.pctMedia!, 4)
  })

  it('⚠️ produção NORMAL também grava o desvio, e sem motivo', async () => {
    // ⚠️ guardar só quando destoa perderia a linha de base: sem os lotes normais não dá
    // pra dizer depois o que era "normal".
    const r = await produzir(20.85, 154)
    const d = await prisma.stockProducaoDesvio.findFirst({ where: { companyId, conclusaoId: r.conclusaoId } })
    expect(d).not.toBeNull()
    expect(d!.motivo).toBeNull()
    expect(d!.lotesNaMedia).toBe(0) // 1ª produção: não havia régua medida
  })

  it('⛔ com 1 lote só NÃO acusa desvio — "normal" de uma medição é régua inventada', async () => {
    await produzir(20.85, 142)
    const r = await produzir(20.85, 120)
    expect(r.variacao.faixa).toBe('SEM_REGUA')
    expect(r.variacao.alerta).toBe(false)
  })
})
