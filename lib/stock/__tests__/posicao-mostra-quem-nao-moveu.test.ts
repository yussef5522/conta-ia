// ⛔⛔⛔ ITEM SEM MOVIMENTO SUMIA DA POSIÇÃO (11/09/2026)
//
// **O dono, depois de criar a receita:** *"o item produzido não está na Posição junto com
// as outras porções. Se a régua é 'só quem tem movimento', me diz."*
//
// **Medido em prod:** a lista nascia de `saldosDaEmpresa`, que é um `groupBy` em
// `stockMovement` — **item com zero movimento não existia pra ela**. E não era só o dele:
// **9 itens ativos estavam invisíveis**, entre eles `tomate`, `gas` e a
// `HEINEKEN LONG NECK ZERO 330ML` — justamente uma das bebidas que em 09/09 registramos
// como *"nasce com saldo 0 e entra na fila de contagem"*. Elas entraram na contagem e
// **sumiram da tela onde o dono confere o estoque**.
//
// ⭐ A RÉGUA QUE FICOU: a Posição é a PRATELEIRA, e prateleira com zero unidades continua
// sendo uma linha da prateleira. **Saldo 0 é um FATO ("não tem"), não ausência de dado.**

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { listPosicao } from '../posicao'

const companyId = `pos-test-${Date.now()}`
let produzidoId = ''
let compradoId = ''
let saborId = ''

beforeAll(async () => {
  const mk = (nome: string, categoria: string) => prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: 'UN', categoria, criadoVia: 'MANUAL' },
    select: { id: true },
  })
  produzidoId = (await mk('porcao beef de alimenuta', 'INTERMEDIARIO')).id
  compradoId = (await mk('tomate', 'MATERIA_PRIMA')).id
  saborId = (await mk('CALABRESA', 'SABOR')).id
  // ⚠️ nenhum dos três tem movimento: é exatamente o estado do dia em que o dono criou
})

afterAll(async () => {
  await prisma.stockItem.deleteMany({ where: { companyId } })
})

describe('⭐⭐ a Posição mostra quem existe, não só quem moveu', () => {
  it('o item PRODUZIDO recém-criado aparece — com saldo 0', async () => {
    const p = await listPosicao(companyId, prisma)
    const l = p.itens.find((i) => i.itemId === produzidoId)
    expect(l, 'o item produzido sumiu da Posição').toBeDefined()
    expect(l!.saldo).toBe(0)
    expect(l!.valor).toBe(0)
    expect(l!.custoMedio).toBeNull()
  })

  it('o item COMPRADO sem nota nenhuma também aparece (o caso do `tomate`)', async () => {
    const p = await listPosicao(companyId, prisma)
    expect(p.itens.some((i) => i.itemId === compradoId)).toBe(true)
  })

  it('⛔ mas o invólucro do cardápio continua FORA — ninguém estoca "CALABRESA"', async () => {
    // a régua de 09/09 (`seContaFisicamente`) não afrouxou: o que mudou foi de onde a
    // lista parte, não quem tem direito de estar nela.
    const p = await listPosicao(companyId, prisma)
    expect(p.itens.some((i) => i.itemId === saborId)).toBe(false)
  })

  it('⚠️ e o VALOR TOTAL não muda — zero não soma', async () => {
    const p = await listPosicao(companyId, prisma)
    expect(p.valorTotal).toBe(0)
  })

  it('⭐ item DESATIVADO segue fora', async () => {
    const inativo = await prisma.stockItem.create({
      data: { companyId, nome: 'sumido', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL', ativo: false },
      select: { id: true },
    })
    const p = await listPosicao(companyId, prisma)
    expect(p.itens.some((i) => i.itemId === inativo.id)).toBe(false)
  })
})
