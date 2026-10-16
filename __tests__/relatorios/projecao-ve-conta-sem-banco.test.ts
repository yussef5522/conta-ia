/**
 * ⛔⛔⛔ A PROJEÇÃO DE 30 DIAS NÃO PODE SER CEGA PRA CONTA SEM BANCO (16/10/2026).
 *
 * **O defeito, medido em prod antes do conserto:**
 * ```
 *   a projeção de /relatorios (próximos 30 dias)   R$       0,00   ⛔
 *   as contas que de fato vencem na janela          82 · R$ 135.777,81
 *   PAYABLE em aberto da empresa                   110 SEM conta bancária · 0 COM
 * ```
 *
 * ⛔⛔ **CONTA A PAGAR NASCE SEM `bankAccountId`** — a ponte do estoque cria a obrigação
 * antes de existir decisão de por onde pagar (desde 24/08). Quem a prende à empresa é
 * fornecedor · funcionário · cliente · categoria · (e às vezes) banco. Filtrar por
 * `bankAccount` **não erra: devolve ZERO, em silêncio**, e lista vazia é resposta plausível.
 *
 * ⚠️⚠️ **É A 4ª OCORRÊNCIA DA MESMA CLASSE**, e as três anteriores estão registradas no
 * CLAUDE.md: o **F1** da ponte (24/08) · o **selo dos custos fixos** (06/10) · a **mesa de
 * operações** (15/10, *"CONTAS 7 DIAS R$ 0"* com R$ 58.653,84 vencendo). ⭐ O que fecha a
 * reincidência é a decisão ter **dono exportado** (`ramosDaEmpresaEmContaAPagar`): as duas
 * primeiras foram consertadas **no call-site**, e a régua boa seguiu sendo um `const` LOCAL —
 * ***invisível pra quem escreve a consulta nova, e a consulta nova é sempre a que esquece***.
 *
 * ⭐⭐ ESTE TESTE EXECUTA O CAMINHO REAL (`getFluxoCaixaPreview` contra banco), não o `where`
 * isolado: *"guard que testa a lib aprova a tela que a ignora"* (14/09), e aqui o defeito
 * vivia justamente no `where` que a função monta.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { loadFluxoCaixaPreview as getFluxoCaixaPreview } from '@/lib/relatorios/preview-queries'
import { lerMesaDeOperacoes } from '@/lib/balance/mesa-de-operacoes'

const CNPJ = '62636465000167'
let companyId = ''
let supplierId = ''
let bankAccountId = ''

/** ⚠️ relógio FIXO no passado — o `sem-data-fixa-no-futuro` reprova data adiante em posição de "agora" */
const AGORA = new Date('2026-10-16T12:00:00.000Z')
const maisDias = (n: number) => new Date(AGORA.getTime() + n * 86_400_000)

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({
    data: { name: 'projecao-sem-banco', cnpj: CNPJ, state: 'RS' },
  })
  companyId = c.id

  const s = await prisma.supplier.create({
    data: { companyId, razaoSocial: 'FORNECEDOR DA PONTE', fonte: 'ESTOQUE_NF' },
  })
  supplierId = s.id

  const b = await prisma.bankAccount.create({
    data: { companyId, name: 'stone', bankCode: '197', accountNumber: '9' },
  })
  bankAccountId = b.id

  /**
   * ⭐ A CONTA DO CASO REAL: nascida da nota, **sem `bankAccountId`**, presa à empresa só
   * pelo fornecedor. É exatamente a forma das 110 que existem em prod.
   */
  await prisma.transaction.create({
    data: {
      supplierId, amount: 135_777.81, type: 'DEBIT',
      date: maisDias(5), dueDate: maisDias(5),
      description: 'NF 1234 — parcela 001', lifecycle: 'PAYABLE', origin: 'ESTOQUE_NF',
    },
  })

  /** ⚠️ e uma a receber, também sem banco — o outro lado da projeção */
  await prisma.transaction.create({
    data: {
      supplierId, amount: 4_000, type: 'CREDIT',
      date: maisDias(7), dueDate: maisDias(7),
      description: 'a receber sem banco', lifecycle: 'RECEIVABLE', origin: 'MANUAL',
    },
  })

  /**
   * ⛔ E UMA FORA DA JANELA (vence em 60 dias) — sem ela o teste passaria num mundo em que
   * a projeção ignora o `dueDate` e soma tudo que está em aberto.
   */
  await prisma.transaction.create({
    data: {
      supplierId, amount: 99_999, type: 'DEBIT',
      date: maisDias(60), dueDate: maisDias(60),
      description: 'vence depois da janela', lifecycle: 'PAYABLE', origin: 'ESTOQUE_NF',
    },
  })

  /** ⭐ e o REALIZADO do mês, que continua vindo por conta bancária (e tem que continuar) */
  await prisma.transaction.create({
    data: {
      bankAccountId, amount: 1_000, type: 'CREDIT',
      date: new Date('2026-10-02T12:00:00.000Z'),
      description: 'venda', lifecycle: 'EFFECTED', origin: 'OFX',
    },
  })
})

afterAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⛔⛔⛔ a projeção de 30 dias VÊ a conta sem banco', () => {
  it('⭐⭐ a saída projetada traz a conta nascida da nota (sem `bankAccountId`)', async () => {
    const f = await getFluxoCaixaPreview(companyId, AGORA)
    expect(f.proxima30.saidas, 'a conta sem banco entra na projeção').toBeCloseTo(135_777.81, 2)
    expect(f.proxima30.entradas, 'e o a receber também').toBeCloseTo(4_000, 2)
    expect(f.proxima30.resultado).toBeCloseTo(4_000 - 135_777.81, 2)
  })

  /**
   * ⛔⛔ O CONTRAFACTUAL — é ele que prova que o teste de cima não passa por acidente. Com a
   * régua velha (`bankAccount.companyId`) a mesma consulta devolve **ZERO**: é o número exato
   * que o dono viu na tela.
   */
  it('⛔⛔ com a régua VELHA (por bankAccount) a mesma conta é INVISÍVEL', async () => {
    const janela = { gte: maisDias(1), lte: maisDias(30) }
    const velha = await prisma.transaction.aggregate({
      where: { bankAccount: { companyId }, lifecycle: 'PAYABLE', paymentDate: null, dueDate: janela },
      _sum: { amount: true }, _count: { _all: true },
    })
    expect(velha._count._all, 'a régua velha não acha nada').toBe(0)
    expect(velha._sum.amount ?? 0, 'e devolve ZERO em silêncio').toBe(0)
  })

  it('⛔ conta que vence DEPOIS da janela continua fora', async () => {
    const f = await getFluxoCaixaPreview(companyId, AGORA)
    expect(f.proxima30.saidas, 'os 99.999 de 60 dias não entram').toBeCloseTo(135_777.81, 2)
  })

  /**
   * ⭐⭐ O ESCOPO DE EMPRESA CONTINUA DE PÉ — abrir a régua **não** é afrouxar o multi-tenant.
   * Conta de OUTRA empresa, pelo mesmo caminho (fornecedor), não pode aparecer.
   */
  it('⛔⛔ conta de OUTRA empresa não entra na projeção desta', async () => {
    const CNPJ2 = '64646464000299'
    await prisma.company.deleteMany({ where: { cnpj: CNPJ2 } })
    const outra = await prisma.company.create({
      data: { name: 'vizinha', cnpj: CNPJ2, state: 'RS' },
    })
    const s2 = await prisma.supplier.create({
      data: { companyId: outra.id, razaoSocial: 'FORNECEDOR DA VIZINHA' },
    })
    await prisma.transaction.create({
      data: {
        supplierId: s2.id, amount: 50_000, type: 'DEBIT',
        date: maisDias(3), dueDate: maisDias(3),
        description: 'conta da vizinha', lifecycle: 'PAYABLE', origin: 'ESTOQUE_NF',
      },
    })
    try {
      const f = await getFluxoCaixaPreview(companyId, AGORA)
      expect(f.proxima30.saidas, 'os 50.000 da vizinha ficam de fora').toBeCloseTo(135_777.81, 2)
    } finally {
      await prisma.company.deleteMany({ where: { cnpj: CNPJ2 } })
    }
  })

  /**
   * ⭐⭐⭐ O VERMELHO DO DONO: *"o módulo de contas da mesa NÃO muda um centavo"*.
   *
   * ⚠️ A mesa já foi corrigida em 15/10 e **já lê os 5 ramos**. Este teste existe pra o
   * conserto da projeção não ter efeito colateral nela — e pra o dia em que alguém "unificar"
   * as duas janelas (a mesa olha 7 dias, a projeção 30) ficar vermelho aqui.
   */
  it('⭐⭐ a mesa de operações não se move — e as janelas são DIFERENTES de propósito', async () => {
    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    expect(mesa.contas7Dias.total, 'a conta de 5 dias entra nos 7 dias da mesa')
      .toBeCloseTo(135_777.81, 2)
    const f = await getFluxoCaixaPreview(companyId, AGORA)
    expect(f.proxima30.saidas, 'e a projeção de 30 dias vê a mesma').toBeCloseTo(135_777.81, 2)
    /**
     * ⛔ A janela da mesa é 7 dias e a da projeção é 30 — os 99.999 de 60 dias ficam fora das
     * DUAS, mas a prova de que elas são réguas distintas é esta: a mesa NÃO pode somar o que
     * vence em 20 dias.
     */
    await prisma.transaction.create({
      data: {
        supplierId, amount: 777, type: 'DEBIT',
        date: maisDias(20), dueDate: maisDias(20),
        description: 'vence em 20 dias', lifecycle: 'PAYABLE', origin: 'ESTOQUE_NF',
      },
    })
    const mesa2 = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    expect(mesa2.contas7Dias.total, 'os 777 de 20 dias NÃO entram nos 7 dias')
      .toBeCloseTo(135_777.81, 2)
    const f2 = await getFluxoCaixaPreview(companyId, AGORA)
    expect(f2.proxima30.saidas, 'mas entram nos 30 dias').toBeCloseTo(135_777.81 + 777, 2)
  })
})

/**
 * ⛔⛔ E A RÉGUA TEM UM DONO SÓ (REGRA 4) — guard estrutural, pra a 5ª cópia não nascer.
 */
describe('⛔⛔ a decisão "o que prende a conta à empresa" mora num lugar', () => {
  it('⛔ a projeção CONSOME `ramosDaEmpresaEmContaAPagar` em vez de repetir a lista', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { semComentarios, usosDe } = await import('../regras-ui/_leitura-de-fonte')
    const src = semComentarios(
      readFileSync(join(process.cwd(), 'lib/relatorios/preview-queries.ts'), 'utf8'),
    )
    expect(usosDe(src, 'ramosDaEmpresaEmContaAPagar'), 'consome o dono único')
      .toBeGreaterThan(0)
    /**
     * ⛔ E a projeção não pode voltar a resolver a empresa por banco. ⚠️ A régua é ESTREITA
     * de propósito: o filtro por `bankAccount` continua CERTO no realizado (`EFFECTED`), e
     * proibi-lo no arquivo inteiro reprovaria código correto.
     *
     * ⚠️⚠️ **E A ÂNCORA É CÓDIGO, NUNCA COMENTÁRIO** — a 1ª versão deste teste ancorava no
     * comentário *"Projeção 30d entradas"* e deu **−1**, porque `semComentarios` apaga
     * justamente ele. *O arquivo que documenta a régua não pode ser o que a localiza.* O que
     * identifica a projeção no código é o **`paymentDate: null`** (o realizado usa
     * `reconciledWithId: null`), e ele aparece exatamente 2× — uma por soma.
     */
    const blocos = [...src.matchAll(/paymentDate:\s*null/g)]
    expect(blocos.length, 'as duas somas da projeção').toBe(2)
    for (const m of blocos) {
      // a vizinhança do `where` daquela soma: 260 caracteres pra cada lado cobre o objeto
      const bloco = src.slice(Math.max(0, m.index! - 260), m.index! + 260)
      expect(bloco, 'a projeção voltou a filtrar por conta bancária')
        .not.toMatch(/bankAccount:\s*\{\s*companyId/)
      expect(bloco, 'e esta soma lê o dono único').toContain('ramosDaEmpresaEmContaAPagar')
    }
  })
})
