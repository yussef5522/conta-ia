/**
 * ⛔⛔⛔ TODA LINHA DE EXTRATO ENTRA NA CAIXA — BANCO CAIXA INCLUÍDO (01/10/2026).
 *
 * **O caso real:** o dono importou o extrato do **banco caixa** (um PDF —
 * `Comprovante_2026-09-30_235031.pdf`, porque esse banco só entrega em PDF) com 2 pagamentos
 * de empréstimo, juros, IOF, consórcio e PIX. **O import gravou as 7 linhas perfeitas**
 * (`EFFECTED`, `PENDING`, `dedupHash`) — e na Conciliação **não apareceu NENHUMA**. Só a
 * transferência de R$ 10.000, e só porque o detector de par roda por outro caminho.
 *
 * ```
 * banco caixa   32 linhas · só 4 OFX · 0 no universo da caixa
 * as 7 de hoje  origin PDF → FORA: "a caixa só lê OFX"
 * ```
 *
 * ***O formato do arquivo decidia se a linha existia pra conciliação.***
 *
 * ⚠️⚠️ E eram **DOIS leitores vivos**: a `lerCaixa` e a `LINHA_DISPONIVEL_WHERE` da fila.
 * Consertar um deixaria os 2 pagamentos de empréstimo visíveis na caixa e **sem palpite** —
 * *metade do conserto é pior que nenhum, porque parece resolvido.*
 *
 * ⚠️ REGRA 3: roda a `lerCaixa` REAL contra o banco, com as linhas de verdade.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { lerCaixa, paraLei, TETO_DA_CAIXA, SELECT_DA_CAIXA } from '../leitura-da-caixa'
import { estacaoDaLinha } from '../caixa-de-entrada'
import { LINHA_DISPONIVEL_WHERE } from '../fila-de-conciliacao'
import { ORIGENS_DO_EXTRATO, ehLinhaDeExtrato } from '../origem-do-extrato'

const CNPJ = '50607080002166' // ⚠️ exclusivo deste arquivo
let companyId = ''
let bancoCaixa = ''
let stone = ''

const dia = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

/** o cenário REAL do banco caixa, com os valores de prod */
const AS_SETE = [
  { date: '2026-09-02', amount: 1148.05, type: 'DEBIT', description: 'COBRANCA DE JUROS' },
  { date: '2026-09-02', amount: 25.34, type: 'DEBIT', description: 'DEBITO DE IOF' },
  { date: '2026-09-10', amount: 669.31, type: 'DEBIT', description: 'CONSORCIO - Xs5 Administradora' },
  { date: '2026-09-12', amount: 632, type: 'CREDIT', description: 'CRED PIX QR COD EST' },
  { date: '2026-09-26', amount: 2927.02, type: 'DEBIT', description: 'DEBITO PRESTA SIEMP' },
  { date: '2026-09-28', amount: 7526.06, type: 'DEBIT', description: 'DEBITO PRESTA SIEMP' },
] as const

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const co = await prisma.company.create({
    // ⭐ o corte de época é o MESMO de prod — ele faz parte do recorte que estamos provando
    data: { name: 'extrato-pdf', cnpj: CNPJ, conciliarAPartirDe: dia('2026-09-01') },
    select: { id: true },
  })
  companyId = co.id
  bancoCaixa = (await prisma.bankAccount.create({
    data: { companyId, name: 'banco caixa', bankCode: '104', balance: 0 },
    select: { id: true },
  })).id
  stone = (await prisma.bankAccount.create({
    data: { companyId, name: 'stone', bankCode: '197', balance: 0 },
    select: { id: true },
  })).id
})

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { bankAccountId: { in: [bancoCaixa, stone] } } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

beforeEach(async () => {
  await prisma.transaction.deleteMany({ where: { bankAccountId: { in: [bancoCaixa, stone] } } })
})

const criarAsSete = () =>
  prisma.transaction.createMany({
    data: AS_SETE.map((l) => ({
      bankAccountId: bancoCaixa,
      date: dia(l.date),
      description: l.description,
      amount: l.amount,
      type: l.type,
      status: 'PENDING' as const,
      lifecycle: 'EFFECTED' as const,
      // ⭐ é ISTO que o import de PDF de extrato grava — e era o que sumia
      origin: 'PDF',
    })),
  })

describe('⛔⛔⛔ a linha de extrato em PDF entra na caixa', () => {
  it('⛔⛔⛔ as 6 linhas do banco caixa aparecem na CAIXA (era ZERO)', async () => {
    await criarAsSete()
    const { rows, contadores } = await lerCaixa(companyId, prisma)
    expect(rows, 'as linhas de PDF continuam invisíveis — é o bug de 01/10').toHaveLength(6)
    // 5 saídas + 1 entrada, nenhuma resolvida
    expect(contadores.saidas).toBe(5)
    expect(contadores.entradas).toBe(1)
    expect(contadores.arquivo).toBe(0)
  })

  it('⛔⛔ os 2 pagamentos de EMPRÉSTIMO entram — e na FILA também', async () => {
    /**
     * ⭐ Este é o teste que impede o conserto pela metade: a fila é quem oferece a linha pra
     * casar com a parcela. Com `origin: 'OFX'` cravado lá, os `DEBITO PRESTA SIEMP` ficariam
     * **visíveis na caixa e sem palpite** — e isso parece resolvido.
     */
    await criarAsSete()
    const naFila = await prisma.transaction.findMany({
      where: { ...LINHA_DISPONIVEL_WHERE, bankAccountId: bancoCaixa, date: { gte: dia('2026-09-01') } },
      select: { amount: true, description: true },
    })
    const valores = naFila.map((t) => t.amount).sort((a, b) => a - b)
    expect(valores, 'a fila não oferece as linhas de PDF').toContain(2927.02)
    expect(valores).toContain(7526.06)
  })

  it('⭐ e o OFX continua entrando — a cura não virou troca', async () => {
    await prisma.transaction.create({
      data: {
        bankAccountId: stone, date: dia('2026-09-15'), description: 'PIX RECEBIDO', amount: 100,
        type: 'CREDIT', status: 'PENDING', lifecycle: 'EFFECTED', origin: 'OFX',
      },
    })
    const { rows } = await lerCaixa(companyId, prisma)
    expect(rows).toHaveLength(1)
  })

  it('⛔⛔ a lista é FECHADA: MANUAL / ESTOQUE_NF / ADJUSTMENT NÃO entram', async () => {
    /**
     * ⛔ Medido em prod: incluí-las jogaria **369 linhas** na fila de trabalho. Elas não
     * esperam *"o que é isto?"* — alguém já disse. *Fila que cobra o que já foi decidido é
     * como o dono aprende a não olhar a fila.*
     */
    for (const origin of ['MANUAL', 'ESTOQUE_NF', 'ADJUSTMENT']) {
      await prisma.transaction.create({
        data: {
          bankAccountId: bancoCaixa, date: dia('2026-09-20'), description: `teste ${origin}`,
          amount: 10, type: 'DEBIT', status: 'PENDING', lifecycle: 'EFFECTED', origin,
        },
      })
    }
    const { rows } = await lerCaixa(companyId, prisma)
    expect(rows, 'origem que não é extrato entrou na fila de trabalho').toHaveLength(0)
    for (const o of ['MANUAL', 'ESTOQUE_NF', 'ADJUSTMENT']) expect(ehLinhaDeExtrato(o)).toBe(false)
    for (const o of ORIGENS_DO_EXTRATO) expect(ehLinhaDeExtrato(o)).toBe(true)
  })

  it('⛔ e o `lifecycle` continua mordendo — PAYABLE não é linha de extrato resolvida', async () => {
    /**
     * ⚠️ A cicatriz das 12 `RECEIVABLE` de junho na sicredi: linha que o banco listou como
     * movimento FUTURO e nunca virou caixa. Ela não pode entrar na fila de hoje.
     */
    await prisma.transaction.create({
      data: {
        bankAccountId: bancoCaixa, date: dia('2026-09-20'), description: 'FUTURO',
        amount: 10, type: 'DEBIT', status: 'PENDING', lifecycle: 'PAYABLE', origin: 'PDF',
      },
    })
    const { rows } = await lerCaixa(companyId, prisma)
    expect(rows).toHaveLength(0)
  })
})

describe('⛔⛔⛔ A FILA DE TRABALHO NUNCA TRUNCA O TRABALHO', () => {
  it('⛔⛔⛔ linha que PEDE DECISÃO não é cortada pelo teto, nem sendo a mais antiga', async () => {
    /**
     * **O 2º defeito, medido em prod:** com o `take: 400` único e `date desc`, o teto cortava
     * pela linha **MAIS ANTIGA** — e das 7 do banco caixa ele alcançava **5**. As duas de
     * 02/09 (os **juros de R$ 1.148,05** e o **IOF**) ficariam invisíveis *mesmo depois de
     * consertada a origem*. Era exatamente o que o dono pediu pra aparecer.
     *
     * ⭐ O cenário: `TETO_DA_CAIXA` linhas de arquivo MAIS NOVAS + uma da caixa, antiga.
     */
    const arquivo = Array.from({ length: TETO_DA_CAIXA + 5 }, (_, i) => ({
      bankAccountId: stone,
      // todas em outubro (mais novas) e já resolvidas por IGNORAR
      date: new Date(`2026-10-0${(i % 9) + 1}T12:00:00.000Z`),
      description: `arquivada ${i}`,
      amount: 1 + i,
      type: 'DEBIT' as const,
      status: 'PENDING' as const,
      lifecycle: 'EFFECTED' as const,
      origin: 'OFX',
      ignoredAt: new Date('2026-10-01T12:00:00.000Z'),
    }))
    await prisma.transaction.createMany({ data: arquivo })
    // ⭐ e a linha que PEDE decisão é a MAIS ANTIGA de todas — o caso dos juros de 02/09
    const juros = await prisma.transaction.create({
      data: {
        bankAccountId: bancoCaixa, date: dia('2026-09-02'), description: 'COBRANCA DE JUROS',
        amount: 1148.05, type: 'DEBIT', status: 'PENDING', lifecycle: 'EFFECTED', origin: 'PDF',
      },
      select: { id: true },
    })

    const { rows, contadores, cobertura } = await lerCaixa(companyId, prisma)
    expect(rows.map((r) => r.id), 'o teto escondeu uma linha que pede decisão').toContain(juros.id)
    expect(contadores.saidas).toBe(1)

    // ⭐ e os CONTADORES saem da varredura INTEIRA, não das linhas guardadas
    expect(contadores.total, 'o contador passou a contar só o que a tela desenha').toBe(TETO_DA_CAIXA + 6)
    expect(contadores.arquivo).toBe(TETO_DA_CAIXA + 5)
    expect(cobertura.totalNoPeriodo).toBe(TETO_DA_CAIXA + 6)
    expect(cobertura.periodoInteiro, 'a varredura não alcançou o período inteiro').toBe(true)
    // ⚠️ o ARQUIVO cede espaço — é ele que pode ser truncado, e a tela DIZ
    expect(cobertura.truncado).toBe(true)
  })

  it('⭐⭐ o INVARIANTE DA ESTAÇÃO fecha POR CONTA — banco caixa junto', async () => {
    /**
     * ⭐ O pedido do dono, ao pé da letra: *"o invariante da estação fecha contando o banco
     * caixa junto (Σ período == caixa + arquivo, POR CONTA)"*.
     */
    await criarAsSete()
    // uma transferência já pareada no banco caixa (vai pro ARQUIVO) — a de R$ 10.000
    await prisma.transaction.create({
      data: {
        bankAccountId: bancoCaixa, date: dia('2026-09-28'), description: 'CRED PIX QR COD EST',
        amount: 10000, type: 'TRANSFER', status: 'RECONCILED', lifecycle: 'EFFECTED', origin: 'PDF',
        transferGroupId: 'par-teste', transferDirection: 'IN',
      },
    })
    await prisma.transaction.create({
      data: {
        bankAccountId: stone, date: dia('2026-09-18'), description: 'PIX RECEBIDO', amount: 55,
        type: 'CREDIT', status: 'PENDING', lifecycle: 'EFFECTED', origin: 'OFX',
      },
    })

    for (const contaId of [bancoCaixa, stone]) {
      const noPeriodo = await prisma.transaction.count({
        where: {
          bankAccountId: contaId, lifecycle: 'EFFECTED',
          origin: { in: ORIGENS_DO_EXTRATO as unknown as string[] },
          date: { gte: dia('2026-09-01') },
        },
      })
      const linhas = (await prisma.transaction.findMany({
        where: {
          bankAccountId: contaId, lifecycle: 'EFFECTED',
          origin: { in: ORIGENS_DO_EXTRATO as unknown as string[] },
          date: { gte: dia('2026-09-01') },
        },
        select: SELECT_DA_CAIXA,
      })) as never[]
      let caixa = 0
      let arquivo = 0
      for (const r of linhas) {
        if (estacaoDaLinha(paraLei(r as never)) === 'CAIXA') caixa++
        else arquivo++
      }
      expect(caixa + arquivo, `a conta ${contaId} não fecha: ${noPeriodo} != ${caixa}+${arquivo}`).toBe(noPeriodo)
    }

    // ⭐ e a soma geral fecha com o que a leitura reporta
    const { contadores } = await lerCaixa(companyId, prisma)
    expect(contadores.saidas + contadores.entradas + contadores.arquivo).toBe(contadores.total)
    expect(contadores.arquivo, 'a transferência pareada não foi pro arquivo').toBe(1)
  })
})
