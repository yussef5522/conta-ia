// ⭐⭐ A LISTA DO PAINEL DA PRODUÇÃO É EM LOTE (20/11) — o socorro de 19/11 mediu `listOrdens` chamando
// `getOrdem` UMA VEZ POR ORDEM: 209 ordens → ~850 ms dos ~1 s da tela da cozinha, pico de 7,4 s.
//
// ⛔ O guard CONTA AS CONSULTAS (por execução, com um cliente que conta cada operação): com 3 ordens e
// com 12 ordens o número de consultas é O MESMO. N+1 de volta = o número cresce com N = vermelho.
// ⭐ E a vista em lote é IGUAL à de uma ordem (`getOrdem`), campo a campo — inclusive o
// `rendimentoPendente` de uma ficha que ESPERA o dono (a régua mora num lugar só).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { tornarRotuloTorto } from './_ficha-torta'
import { criarOrdem, getOrdem, listOrdens } from '../ordens'
import { fichaEsperaRendimento, fichasEsperamRendimento } from '../auto-conversao-de-lote'

const CNPJ = '20112026000120'
let companyId: string
let fichaSimples: string
let fichaQueEspera: string
let setorId: string

function clienteQueConta() {
  const conta = { n: 0 }
  const db = prisma.$extends({
    query: { $allModels: { async $allOperations({ args, query }) { conta.n++; return query(args) } } },
  }) as unknown as PrismaClient
  return { db, conta }
}

async function ordens(n: number) {
  for (let i = 0; i < n; i++) {
    await criarOrdem({
      companyId, fichaId: i % 2 ? fichaQueEspera : fichaSimples, escalaReceitas: 1,
      dataProducao: new Date(Date.UTC(2026, 10, 1 + i)), setorId: i % 3 ? setorId : null,
    }, prisma)
  }
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'LISTA EM LOTE' } })).id
  const insumo = await prisma.stockItem.create({ data: { companyId, nome: 'OLEO DE SOJA', unidadeControle: 'LT', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  setorId = (await prisma.stockSetor.create({ data: { companyId, nome: 'Cozinha' } })).id
  fichaSimples = (await criarFicha({
    companyId, nomeProduzido: 'porção simples', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: insumo.id, qtdPlanejada: 0.1, unidade: 'LT' }],
  }, prisma)).fichaId
  // a MAIONESE do porta-do-rendimento: rótulo torto e doses que se movem → ESPERA o número do dono
  fichaQueEspera = (await criarFicha({
    companyId, nomeProduzido: 'MAIONESE', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO',
    loteBase: 2.858, unidadeLoteBase: 'KG', componentes: [{ itemId: insumo.id, qtdPlanejada: 3, unidade: 'LT' }],
  }, prisma)).fichaId
  await tornarRotuloTorto(companyId, fichaQueEspera, 'UN', prisma)
})

afterEach(async () => {
  for (const t of ['stockMovement', 'stockProductionOrder', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockSetor', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('listOrdens em lote', () => {
  it('⛔ o número de consultas NÃO cresce com o número de ordens (3 ordens = 12 ordens)', async () => {
    await ordens(3)
    const a = clienteQueConta()
    expect(await listOrdens(companyId, a.db)).toHaveLength(3)
    await ordens(9)
    const b = clienteQueConta()
    expect(await listOrdens(companyId, b.db)).toHaveLength(12)
    expect(b.conta.n, `3 ordens: ${a.conta.n} consultas · 12 ordens: ${b.conta.n}`).toBe(a.conta.n)
    expect(b.conta.n).toBeLessThanOrEqual(9) // 2 da lista + 3 da vista + até 4 da régua do rendimento
  })

  it('⭐ a vista em lote é IGUAL à de uma ordem, campo a campo — inclusive quem espera o rendimento', async () => {
    await ordens(6)
    const lista = await listOrdens(companyId, prisma)
    for (const o of lista) expect(o).toEqual(await getOrdem(companyId, o.id, prisma))
    const espera = lista.filter((o) => o.fichaId === fichaQueEspera)
    expect(espera.length).toBe(3)
    for (const o of espera) expect(o.rendimentoPendente?.porQue).toContain('o rendimento que só o dono sabe')
    expect(lista.filter((o) => o.fichaId === fichaSimples).every((o) => o.rendimentoPendente === null)).toBe(true)
    expect(lista.filter((o) => o.setorId).every((o) => o.setorNome === 'Cozinha')).toBe(true)
    expect(lista.filter((o) => !o.setorId).every((o) => o.setorNome === null)).toBe(true)
  })

  it('⭐ a pergunta do rendimento: em lote = uma por uma (a régua é a mesma)', async () => {
    const m = await fichasEsperamRendimento(companyId, [fichaSimples, fichaQueEspera, 'nao-existe'], prisma)
    expect(m.get(fichaSimples)).toEqual(await fichaEsperaRendimento(companyId, fichaSimples, prisma))
    expect(m.get(fichaQueEspera)).toEqual(await fichaEsperaRendimento(companyId, fichaQueEspera, prisma))
    expect(m.get(fichaQueEspera)!.espera).toBe(true)
    expect(m.get('nao-existe')).toEqual({ espera: false, porQue: null })
  })

  it('⭐ ordem recém-criada aparece na PRÓXIMA leitura (sem cache que a esconda da cozinha)', async () => {
    await ordens(2)
    expect(await listOrdens(companyId, prisma)).toHaveLength(2)
    await ordens(1)
    expect(await listOrdens(companyId, prisma)).toHaveLength(3)
  })
})
