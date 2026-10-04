/**
 * ⭐⭐ A PREFERÊNCIA CONTRA O BANCO — *"volto amanhã e está como deixei"* (04/10/2026).
 *
 * ⛔⛔ **O TESTE QUE JUSTIFICA O DESENHO É O 2º: O DELTA PRESERVA O QUE ESTÁ FORA DA TELA.**
 *
 * O painel só conhece as receitas do período ABERTO. Se o gesto mandasse a LISTA INTEIRA, abrir
 * *"hoje"* (onde o TOMATE PICADO não produziu) e mexer em qualquer coisa **apagaria o TOMATE da
 * preferência em silêncio** — o dono voltaria amanhã e o preparo miúdo que ele escondeu estaria
 * de volta, sem ninguém ter pedido e sem nada na tela dizendo. *Só se decide sobre o que se vê.*
 *
 * ⚠️ REGRA 3: executa `lerOcultas`/`aplicarDelta` contra o banco, não grep. Um teste puro
 * provaria a aritmética do Set e **não provaria o upsert nem a chave única**.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { lerOcultas, aplicarDelta } from '../receitas-ocultas'

const CNPJ = '74747474000255'
let companyId = ''
const DONO = 'user-dono'
const OUTRO = 'user-marcyelle'

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'RECEITAS OCULTAS' } })
  companyId = c.id
})

afterEach(async () => {
  // ⚠️ `stock_*` não cascateia (o isolamento proíbe @relation) — apaga explícito
  await prisma.stockPorDiaPreferencia.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐⭐ a escolha fica salva, por pessoa', () => {
  it('⭐ sem preferência nenhuma, TUDO aparece (o default seguro é mostrar)', async () => {
    expect(await lerOcultas(companyId, DONO, prisma)).toEqual([])
  })

  it('⭐⭐ esconde, lê de novo e continua lá — é o "volto amanhã"', async () => {
    await aplicarDelta(companyId, DONO, { ocultar: ['it-tomate', 'it-milho'] }, prisma)
    expect(await lerOcultas(companyId, DONO, prisma)).toEqual(['it-milho', 'it-tomate'])

    // ⚠️ e uma 2ª gravação não duplica a linha (upsert na chave única do banco)
    await aplicarDelta(companyId, DONO, { ocultar: ['it-ervilha'] }, prisma)
    expect(await prisma.stockPorDiaPreferencia.count({ where: { companyId } })).toBe(1)
    expect(await lerOcultas(companyId, DONO, prisma)).toEqual(['it-ervilha', 'it-milho', 'it-tomate'])
  })

  /**
   * ⛔⛔ **O TESTE CENTRAL.** O dono esconde 3 preparos no período de 30 dias; no dia seguinte
   * abre "hoje", onde SÓ a ervilha produziu, e desoculta ela. O TOMATE e o MILHO — que não
   * estavam na tela — **não podem ser tocados**.
   */
  it('⛔⛔ o delta NÃO apaga o que está fora do período aberto', async () => {
    await aplicarDelta(companyId, DONO, { ocultar: ['it-tomate', 'it-milho', 'it-ervilha'] }, prisma)

    // a tela de "hoje" só conhece a ervilha, e o dono manda mostrá-la
    const depois = await aplicarDelta(companyId, DONO, { mostrar: ['it-ervilha'] }, prisma)

    expect(depois, 'tomate e milho sobreviveram ao gesto').toEqual(['it-milho', 'it-tomate'])
    expect(await lerOcultas(companyId, DONO, prisma)).toEqual(['it-milho', 'it-tomate'])
  })

  it('⭐ "todas" e "nenhuma" agem só sobre os ids que a tela mandou', async () => {
    await aplicarDelta(companyId, DONO, { ocultar: ['it-fora-da-tela'] }, prisma)
    // "nenhuma" no período aberto = esconder os 2 que estão na tela
    await aplicarDelta(companyId, DONO, { ocultar: ['it-a', 'it-b'] }, prisma)
    expect(await lerOcultas(companyId, DONO, prisma)).toEqual(['it-a', 'it-b', 'it-fora-da-tela'])
    // "todas" = mostrar os 2 da tela; o de fora continua escondido
    await aplicarDelta(companyId, DONO, { mostrar: ['it-a', 'it-b'] }, prisma)
    expect(await lerOcultas(companyId, DONO, prisma)).toEqual(['it-fora-da-tela'])
  })

  /**
   * ⚠️ **POR USUÁRIO, não por empresa.** O dono esconde os preparos miúdos porque olha o
   * resultado; a marcyelle quer ver justamente eles. A chave única é `(companyId, userId)`.
   */
  it('⭐⭐ a escolha de um NÃO mexe na do outro', async () => {
    await aplicarDelta(companyId, DONO, { ocultar: ['it-tomate'] }, prisma)
    await aplicarDelta(companyId, OUTRO, { ocultar: ['it-queijo'] }, prisma)

    expect(await lerOcultas(companyId, DONO, prisma)).toEqual(['it-tomate'])
    expect(await lerOcultas(companyId, OUTRO, prisma)).toEqual(['it-queijo'])
    expect(await prisma.stockPorDiaPreferencia.count({ where: { companyId } })).toBe(2)
  })

  /**
   * ⛔ REGRA 8 — a preferência é da EMPRESA também: a mesma pessoa em duas empresas tem duas
   * escolhas. Sem o `companyId` na chave, esconder o TOMATE na Caçula esconderia na outra.
   */
  it('⛔ a mesma pessoa em OUTRA empresa tem outra escolha', async () => {
    await aplicarDelta(companyId, DONO, { ocultar: ['it-tomate'] }, prisma)
    expect(await lerOcultas('outra-empresa', DONO, prisma)).toEqual([])
  })

  it('⛔ o mesmo id em ocultar E mostrar: o OCULTAR ganha (escolha explícita)', async () => {
    const r = await aplicarDelta(companyId, DONO, { ocultar: ['it-x'], mostrar: ['it-x'] }, prisma)
    expect(r).toEqual(['it-x'])
  })

  it('⭐ delta vazio não derruba nem muda nada', async () => {
    await aplicarDelta(companyId, DONO, { ocultar: ['it-a'] }, prisma)
    expect(await aplicarDelta(companyId, DONO, {}, prisma)).toEqual(['it-a'])
  })
})
