// ESTOQUE FASE 3 PARTE 2 — CONTAGEM end-to-end contra banco real (REGRA 3: roda o
// pipeline, não procura string). Prova o que importa: o ajuste ENTRA no ledger na hora,
// o saldo passa a bater com o contado, o freio RECUSA sem aceite, e recontar não duplica.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { saldoItem } from '../saldo'
import { iniciarContagem, contarLinha, finalizarContagem, getQuadro, listarContagens, ContagemError } from '../contagem'

const CNPJ = '50607080000133'
let companyId: string
let carne: string // KG, com entrada de nota
let refri: string // UN
let sal: string   // KG barato (não deve disparar o freio)

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA CONTAGEM' } })
  companyId = c.id
  const mk = (nome: string, un: string) => prisma.stockItem.create({ data: { companyId, nome, unidadeControle: un, categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  carne = (await mk('Coxão Mole', 'KG')).id
  refri = (await mk('Coca 2L', 'UN')).id
  sal = (await mk('Sal', 'KG')).id
  // saldo inicial pelo ledger (é assim que o estoque nasce: nota → movimento)
  await criarMovimento(prisma, { companyId, itemId: carne, tipo: 'ENTRADA_NF', quantidade: 30, custoUnitario: 40, origem: 'SEFAZ' })
  await criarMovimento(prisma, { companyId, itemId: refri, tipo: 'ENTRADA_NF', quantidade: 24, custoUnitario: 8, origem: 'SEFAZ' })
  await criarMovimento(prisma, { companyId, itemId: sal, tipo: 'ENTRADA_NF', quantidade: 2, custoUnitario: 3, origem: 'SEFAZ' })
})

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  await prisma.stockContagemItem.deleteMany({ where: { companyId } })
  await prisma.stockContagem.deleteMany({ where: { companyId } })
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockSaldoCache.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('sessão de contagem', () => {
  it('a PRIMEIRA contagem da empresa nasce INICIAL (ponto-zero)', async () => {
    const c = await iniciarContagem(companyId, { userId: 'u1', userName: 'Cristian' }, prisma)
    expect(c.tipo).toBe('INICIAL')
    expect(c.status).toBe('ABERTA')
  })

  it('RECUSA abrir uma segunda sessão (1 aberta por vez)', async () => {
    await expect(iniciarContagem(companyId, { userId: 'u1' }, prisma)).rejects.toThrow(ContagemError)
    const abertas = await prisma.stockContagem.count({ where: { companyId, status: 'ABERTA' } })
    expect(abertas).toBe(1)
  })

  it('o quadro mostra "sem contagem" (null, NUNCA zero) pra item nunca contado', async () => {
    const q = await getQuadro(companyId, new Date(), prisma)
    const l = q.linhas.find((x) => x.itemId === carne)!
    expect(l.ultimaContagemEm).toBeNull()
    expect(l.diasSemContagem).toBeNull()
    expect(l.saldoSistema).toBe(30) // o teórico que o contador vê
  })
})

describe('contar uma linha — o ajuste entra no ledger NA HORA', () => {
  it('divergência gera AJUSTE_CONTAGEM e o saldo passa a bater com o CONTADO', async () => {
    const q = await getQuadro(companyId, new Date(), prisma)
    const r = await contarLinha({ companyId, contagemId: q.contagem!.id, itemId: carne, qtdContada: 28.5, userId: 'u1', userName: 'Cristian' }, prisma)

    expect(r.divergencia).toBe(-1.5)
    expect(r.valorDivergencia).toBe(-60) // 1,5 KG × R$ 40
    expect(r.movementId).toBeTruthy()

    const mov = await prisma.stockMovement.findUnique({ where: { id: r.movementId! } })
    expect(mov!.tipo).toBe('AJUSTE_CONTAGEM')
    expect(mov!.quantidade).toBe(-1.5)

    // o que importa: o saldo DERIVADO agora é o contado
    const s = await saldoItem(prisma, companyId, carne)
    expect(s.saldo).toBe(28.5)
  })

  it('contagem que BATE não cria movimento (ledger intocado), mas registra a linha', async () => {
    const q = await getQuadro(companyId, new Date(), prisma)
    const antes = await prisma.stockMovement.count({ where: { companyId, itemId: refri } })
    const r = await contarLinha({ companyId, contagemId: q.contagem!.id, itemId: refri, qtdContada: 24, userId: 'u1', userName: 'Cristian' }, prisma)

    expect(r.divergencia).toBe(0)
    expect(r.movementId).toBeNull()
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: refri } })).toBe(antes)
    const linha = await prisma.stockContagemItem.findFirst({ where: { contagemId: q.contagem!.id, itemId: refri } })
    expect(linha).toBeTruthy()
    expect(linha!.contadoPorNome).toBe('Cristian') // "quem contou" fica gravado
  })

  it('RECUSA quantidade fracionada em item UN', async () => {
    const q = await getQuadro(companyId, new Date(), prisma)
    await expect(contarLinha({ companyId, contagemId: q.contagem!.id, itemId: refri, qtdContada: 23.5 }, prisma)).rejects.toThrow(ContagemError)
  })
})

describe('O FREIO — divergência grande não passa sem aceite', () => {
  it('RECUSA gravar (code=FREIO) e o ledger NÃO se move', async () => {
    const q = await getQuadro(companyId, new Date(), prisma)
    const movsAntes = await prisma.stockMovement.count({ where: { companyId, itemId: carne } })
    // 28,5 → 5 KG a R$ 40 = 82% fora, R$ 940
    await expect(contarLinha({ companyId, contagemId: q.contagem!.id, itemId: carne, qtdContada: 5 }, prisma))
      .rejects.toMatchObject({ code: 'FREIO' })
    // NADA gravado — é o ponto do freio
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: carne } })).toBe(movsAntes)
    expect((await saldoItem(prisma, companyId, carne)).saldo).toBe(28.5)
  })

  it('COM o aceite explícito, grava e marca freioConfirmado', async () => {
    const q = await getQuadro(companyId, new Date(), prisma)
    const r = await contarLinha({ companyId, contagemId: q.contagem!.id, itemId: carne, qtdContada: 5, confirmarFreio: true, userId: 'u1', userName: 'Cristian' }, prisma)
    expect(r.movementId).toBeTruthy()
    expect((await saldoItem(prisma, companyId, carne)).saldo).toBe(5)
    const linha = await prisma.stockContagemItem.findFirst({ where: { contagemId: q.contagem!.id, itemId: carne } })
    expect(linha!.freioConfirmado).toBe(true)
  })

  it('item barato com desvio grande PASSA sem freio (não vira alarme à toa)', async () => {
    const q = await getQuadro(companyId, new Date(), prisma)
    const r = await contarLinha({ companyId, contagemId: q.contagem!.id, itemId: sal, qtdContada: 0.5 }, prisma) // 2 → 0,5 KG a R$ 3
    expect(r.freio.grande).toBe(false)
    expect(r.movementId).toBeTruthy()
  })
})

describe('recontar o mesmo item na mesma sessão', () => {
  it('atualiza a linha (não cria uma 2ª), troca QUEM contou e o saldo fecha no último valor', async () => {
    const q = await getQuadro(companyId, new Date(), prisma)
    // outra pessoa reconta: a atribuição tem que passar pra ela (o dono vai ver "quem
    // contou" no tap da tela; nome errado ali é pior que nome nenhum)
    await contarLinha({ companyId, contagemId: q.contagem!.id, itemId: carne, qtdContada: 6, confirmarFreio: true, userId: 'u2', userName: 'Yussef' }, prisma)

    const linhas = await prisma.stockContagemItem.findMany({ where: { contagemId: q.contagem!.id, itemId: carne } })
    expect(linhas).toHaveLength(1) // UNIQUE(contagemId,itemId) — nunca uma 2ª linha
    expect(linhas[0].qtdContada).toBe(6)
    expect(linhas[0].contadoPorNome).toBe('Yussef') // quem contou POR ÚLTIMO
    // o ledger soma: cada ajuste parte do saldo já corrigido, então fecha no contado
    expect((await saldoItem(prisma, companyId, carne)).saldo).toBe(6)
  })
})

describe('finalizar', () => {
  it('finaliza, some da lista de abertas e o resumo bate', async () => {
    const q = await getQuadro(companyId, new Date(), prisma)
    await finalizarContagem(companyId, q.contagem!.id, prisma)

    const depois = await getQuadro(companyId, new Date(), prisma)
    expect(depois.contagem).toBeNull() // não há mais sessão aberta

    const [resumo] = await listarContagens(companyId, prisma)
    expect(resumo.status).toBe('FINALIZADA')
    expect(resumo.tipo).toBe('INICIAL')
    expect(resumo.itensContados).toBe(3)
    expect(resumo.criadoPorNome).toBe('Cristian')
  })

  it('depois de finalizada, a PRÓXIMA sessão nasce ROTINA e o item mostra a última contagem', async () => {
    const c2 = await iniciarContagem(companyId, { userId: 'u1', userName: 'Cristian' }, prisma)
    expect(c2.tipo).toBe('ROTINA')
    const q = await getQuadro(companyId, new Date(), prisma)
    const l = q.linhas.find((x) => x.itemId === carne)!
    expect(l.ultimaContagemEm).not.toBeNull()
    expect(l.ultimaContagemPor).toBe('Yussef') // a última contagem da carne foi dele
    expect(l.contado).toBeNull() // sessão nova: ninguém contou ainda NESTA
  })

  it('não finaliza sessão sem nenhum item contado', async () => {
    const q = await getQuadro(companyId, new Date(), prisma)
    await expect(finalizarContagem(companyId, q.contagem!.id, prisma)).rejects.toThrow(ContagemError)
  })
})
