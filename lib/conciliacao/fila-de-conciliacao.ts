// ⭐⭐⭐ A FILA DE CONCILIAÇÃO (07/09/2026) — o que a tela DEVE listar.
//
// ⛔⛔ O QUE A TELA LISTAVA ATÉ HOJE, e por que estava errada dos dois lados:
//
// A query era `origin=OFX` + `NEEDS_REVIEW` (que exige `categoryId IS NULL`) +
// `cashCoded=false`. Isso não é uma fila de CONCILIAÇÃO — é a fila de
// CLASSIFICAÇÃO (a dos Pendentes) com um nome trocado. As duas consequências,
// medidas em prod na Caçula (07/09):
//
//   • **MOSTRA O QUE NÃO É DELA:** qualquer linha sem categoria entra, tenha ou
//     não par pra casar. Conciliar não é categorizar.
//   • **NÃO MOSTRA O QUE É DELA:** no dia da medição a tela listava **0 linhas** —
//     tudo já tinha categoria — enquanto havia **93 contas em aberto** e uma
//     ex-payable de R$ 230,81 em dupla contagem com uma linha do extrato. Uma vez
//     categorizada, a linha sai da fila PARA SEMPRE, mesmo com a conta aberta.
//
// ⭐ A REGRA NOVA: **a fila é sobre VÍNCULO QUE FALTA, nunca sobre categoria que
// falta.** Categoria é a fila dos Pendentes; aqui a pergunta é "estes dois
// registros são o mesmo dinheiro?".
//
// ⛔ E O CONTADOR É HONESTO: zero é zero. Nenhuma aba lista fantasma pra parecer
// ocupada — foi por isso que a régua de duplicata mudou (ver `duplicatasSuspeitas`).

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import {
  sugerirVinculos, type LadoDoPar, type SugestaoDeVinculo, type FornecedorConhecido,
} from './sugestao-de-vinculo'

type Db = PrismaClient

/** janela de busca do par, em dias. Mesma do `find-candidates` histórico. */
const JANELA_DIAS = 15

/**
 * ⛔⛔ QUANDO UMA LINHA DO EXTRATO ESTÁ **DISPONÍVEL** PRA SER O PAGAMENTO DE UMA CONTA.
 *
 * Achado pelos guards da casa em 07/09: a primeira versão desta fila oferecia
 * QUALQUER linha OFX sem vínculo — inclusive dinheiro que **já tem dono**:
 * pagamento de fatura de cartão, parcela de empréstimo já casada, transferência
 * entre contas próprias, linha que o dono mandou ignorar. Sugerir uma dessas como
 * pagamento de um boleto é oferecer o mesmo dinheiro duas vezes.
 *
 * ⚠️ E o que **NÃO** entra aqui é tão importante quanto: `categoryId IS NULL` fica
 * DE FORA de propósito. Era exatamente ele que fazia a tela velha esquecer a linha
 * assim que ela ganhava categoria — **ter categoria não quita conta nenhuma**.
 */
export const LINHA_DISPONIVEL_WHERE = {
  origin: 'OFX',
  lifecycle: 'EFFECTED',
  reconciledWithId: null,
  reconciledFrom: { none: {} },
  isCardPayment: false,
  loanInstallmentPaid: { is: null },
  loanInstallmentPayments: { none: {} },
  pendingTransfer: false,
  isInternalTransfer: false,
  transferGroupId: null,
  ignoredAt: null,
  type: { not: 'TRANSFER' as const },
} as const

export interface ContaEsperandoPagamento {
  conta: LadoDoPar
  /** PAYABLE em aberto · EX_PAYABLE = já marcada como paga e sem vínculo (dupla contagem) */
  situacao: 'EM_ABERTO' | 'DUPLA_CONTAGEM'
  fornecedor: string | null
  sugestoes: (SugestaoDeVinculo & { extrato: LadoDoPar; extratoConta: string | null; extratoCategoria: string | null })[]
}

export interface TransferenciaEsperandoPar {
  id: string
  descricao: string
  valor: number
  data: Date
  tipo: string
  conta: string
}

export interface DuplicataSuspeita {
  chave: string
  linhas: { id: string; descricao: string; valor: number; data: Date; conta: string; fitid: string | null; criadaEm: Date }[]
}

export interface FilaDeConciliacao {
  contas: ContaEsperandoPagamento[]
  transferencias: TransferenciaEsperandoPar[]
  duplicatas: DuplicataSuspeita[]
  /** contadores honestos — cada um é o tamanho da sua lista, sem inflar */
  totais: { contas: number; comSugestao: number; transferencias: number; duplicatas: number }
}

// ────────────────────────────────────────────────────────────────

/** os fornecedores da empresa — a lista que faz o nome do extrato valer 15 pontos */
export async function fornecedoresDaEmpresa(db: Db, companyId: string): Promise<FornecedorConhecido[]> {
  const fs = await db.supplier.findMany({
    where: { companyId, isActive: true },
    select: { id: true, razaoSocial: true, nomeFantasia: true },
  })
  return fs
}

/** os pares que o dono já recusou — o filtro vale nas DUAS telas */
export async function paresRecusados(db: Db, companyId: string) {
  const rs = await db.conciliacaoParRecusado.findMany({
    where: { companyId }, select: { extratoId: true, contaId: true },
  })
  return rs
}

/**
 * ⭐ AS CONTAS QUE ESPERAM PAGAMENTO — a pilha principal.
 *
 * Duas situações entram, e a diferença importa pro dono:
 *   • **EM_ABERTO** — conta a pagar que ainda não foi paga. Casar aqui liquida.
 *   • **DUPLA_CONTAGEM** — a conta já foi marcada como paga (virou EFFECTED) mas
 *     ficou SEM vínculo. O mesmo dinheiro está em duas linhas, e o saldo mente até
 *     alguém costurar. ⛔ Esta é a situação do Cancian, e era invisível na tela
 *     velha porque a linha do banco já tinha categoria.
 */
export async function contasEsperandoPagamento(
  companyId: string, db: Db = defaultPrisma,
): Promise<ContaEsperandoPagamento[]> {
  const [contas, fornecedores, recusados] = await Promise.all([
    db.transaction.findMany({
      where: {
        OR: [
          { lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] }, status: 'PENDING', paymentDate: null },
          // ⭐ a ex-payable já marcada como paga e sem vínculo — a dupla contagem
          { lifecycle: 'EFFECTED', origin: 'ESTOQUE_NF' },
        ],
        reconciledWithId: null,
        reconciledFrom: { none: {} },
        AND: [{ OR: [
          { bankAccount: { companyId } }, { supplier: { companyId } },
          { customer: { companyId } }, { category: { companyId } },
        ] }],
      },
      select: {
        id: true, description: true, amount: true, date: true, dueDate: true, type: true,
        lifecycle: true, supplierId: true, supplier: { select: { razaoSocial: true } },
      },
      orderBy: { dueDate: 'asc' },
    }),
    fornecedoresDaEmpresa(db, companyId),
    paresRecusados(db, companyId),
  ])
  if (!contas.length) return []

  // ⚠️ UMA query só pro extrato inteiro da janela, e o casamento roda em memória.
  // Uma query por conta seriam 93 idas ao banco pra desenhar uma tela.
  const alvos = contas.map((c) => (c.dueDate ?? c.date).getTime())
  const janela = JANELA_DIAS * 86400000
  const extratos = await db.transaction.findMany({
    where: {
      ...LINHA_DISPONIVEL_WHERE,
      bankAccount: { companyId },
      date: { gte: new Date(Math.min(...alvos) - janela), lte: new Date(Math.max(...alvos) + janela) },
    },
    select: {
      id: true, description: true, amount: true, date: true, type: true,
      supplierId: true, bankAccountId: true,
      bankAccount: { select: { name: true } }, category: { select: { name: true } },
    },
  })

  const out: ContaEsperandoPagamento[] = []
  for (const c of contas) {
    const alvo = c.dueDate ?? c.date
    const lado: LadoDoPar = {
      id: c.id, descricao: c.description, valor: Math.abs(c.amount), data: alvo,
      tipo: c.type as 'CREDIT' | 'DEBIT', fornecedorId: c.supplierId, contaBancariaId: null,
    }
    const sugestoes: ContaEsperandoPagamento['sugestoes'] = []
    for (const e of extratos) {
      if (Math.abs(e.date.getTime() - alvo.getTime()) > janela) continue
      const ladoE: LadoDoPar = {
        id: e.id, descricao: e.description, valor: Math.abs(e.amount), data: e.date,
        tipo: e.type as 'CREDIT' | 'DEBIT', fornecedorId: e.supplierId,
        contaBancariaId: e.bankAccountId,
      }
      // ⛔ A MESMA função da tela de Pendentes e do import. Fonte única de sugestão.
      const [s] = sugerirVinculos({ extrato: ladoE, contas: [lado], fornecedores, recusados })
      if (s) sugestoes.push({
        ...s, extrato: ladoE,
        extratoConta: e.bankAccount?.name?.trim() ?? null,
        extratoCategoria: e.category?.name ?? null,
      })
    }
    sugestoes.sort((a, b) => b.score - a.score)
    out.push({
      conta: lado,
      situacao: c.lifecycle === 'EFFECTED' ? 'DUPLA_CONTAGEM' : 'EM_ABERTO',
      fornecedor: c.supplier?.razaoSocial ?? null,
      sugestoes,
    })
  }
  // ⚠️ quem TEM sugestão sobe: a tela é uma fila de decisão, e o que não tem par
  // é informação de fundo, não trabalho pendente.
  return out.sort((a, b) => (b.sugestoes[0]?.score ?? -1) - (a.sugestoes[0]?.score ?? -1))
}

/** transferência entre contas que ficou sem par */
export async function transferenciasEsperandoPar(
  companyId: string, db: Db = defaultPrisma,
): Promise<TransferenciaEsperandoPar[]> {
  const ts = await db.transaction.findMany({
    where: { bankAccount: { companyId }, pendingTransfer: true, transferGroupId: null },
    select: {
      id: true, description: true, amount: true, date: true, type: true,
      bankAccount: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  })
  return ts.map((t) => ({
    id: t.id, descricao: t.description, valor: t.amount, data: t.date, tipo: t.type,
    conta: t.bankAccount?.name?.trim() ?? '—',
  }))
}

/**
 * ⛔⛔ DUPLICATA SUSPEITA — e a régua aqui foi a parte mais difícil de acertar.
 *
 * Três réguas foram MEDIDAS em prod (Caçula, desde 01/08) antes de escolher:
 *   1. mesma conta + dia + valor + tipo  → **84 grupos**, quase todos Pix de gente
 *      DIFERENTE com o mesmo valor. Alarme falso puro.
 *   2. (1) + nome parecido ≥85%          → ainda erra: "RECEBIMENTO PIX-PIX_CRED
 *      <cpf> <nome>" tem prefixo longo idêntico e o Jaro-Winkler premia prefixo.
 *   3. (1) + **mesmo FITID** + descrição idêntica → **0 grupos**. É esta.
 *
 * ⚠️ E o FITID sozinho também não serve: o Banrisul RECICLA (o FITID "000000"
 * cobre 14 eventos diferentes — IOF, JUROS, TARIFA). Por isso a régua exige que
 * TUDO bata. **FITID diferente = o banco disse que são eventos diferentes**, e
 * acreditar na minha heurística contra a identidade que o banco deu é exatamente
 * o que a casa proíbe.
 *
 * O resultado hoje é **zero** — e zero é a resposta certa: o dedup do import está
 * fazendo o trabalho dele. Melhor uma aba honesta vazia que 84 fantasmas.
 */
export async function duplicatasSuspeitas(
  companyId: string, db: Db = defaultPrisma, desde = new Date('2026-08-01'),
): Promise<DuplicataSuspeita[]> {
  const linhas = await db.transaction.findMany({
    where: {
      bankAccount: { companyId }, origin: 'OFX', lifecycle: 'EFFECTED',
      externalId: { not: null }, date: { gte: desde }, ignoredAt: null,
    },
    select: {
      id: true, description: true, amount: true, date: true, type: true,
      externalId: true, createdAt: true, bankAccountId: true,
      bankAccount: { select: { name: true } },
    },
  })
  const grupos = new Map<string, typeof linhas>()
  for (const t of linhas) {
    const k = [
      t.bankAccountId, t.externalId, t.date.toISOString().slice(0, 10),
      t.type, t.amount.toFixed(2), t.description.trim().toLowerCase(),
    ].join('|')
    grupos.set(k, [...(grupos.get(k) ?? []), t])
  }
  return [...grupos.entries()]
    .filter(([, g]) => g.length > 1)
    .map(([chave, g]) => ({
      chave,
      linhas: g.map((t) => ({
        id: t.id, descricao: t.description, valor: t.amount, data: t.date,
        conta: t.bankAccount?.name?.trim() ?? '—', fitid: t.externalId, criadaEm: t.createdAt,
      })),
    }))
}

/** as três pilhas de uma vez — o que a tela carrega num fetch só */
export async function filaDeConciliacao(
  companyId: string, db: Db = defaultPrisma,
): Promise<FilaDeConciliacao> {
  const [contas, transferencias, duplicatas] = await Promise.all([
    contasEsperandoPagamento(companyId, db),
    transferenciasEsperandoPar(companyId, db),
    duplicatasSuspeitas(companyId, db),
  ])
  return {
    contas, transferencias, duplicatas,
    totais: {
      contas: contas.length,
      comSugestao: contas.filter((c) => c.sugestoes.length > 0).length,
      transferencias: transferencias.length,
      duplicatas: duplicatas.length,
    },
  }
}

/**
 * ⭐⭐ AS SUGESTÕES PRA FILA DE PENDENTES — o buraco que o dono achou.
 *
 * *"A linha do Cancian estava nos PENDENTES me pedindo categoria — e as opções são
 * só Despesa/Transferência/Pgto cartão/Pgto empréstimo/Ignorar. (…) Resultado: eu
 * olhando uma conta a pagar casável e sem gesto pra casar."*
 *
 * ⛔ E o caso dele é o SENTIDO INVERSO: a linha que estava lá não é do extrato — é a
 * **ex-payable** da NF 834771 (medido: a fila tinha 1 linha, `ESTOQUE_NF/EFFECTED`).
 * Por isso esta função trata os dois lados: linha de extrato procura conta, conta
 * procura linha de extrato. **A mesma régua dos dois lados** (`sugerirVinculos`).
 */
export async function sugestoesParaPendentes(
  companyId: string, db: Db = defaultPrisma,
): Promise<Record<string, (SugestaoDeVinculo & { outroLado: LadoDoPar; rotulo: string })[]>> {
  const [fornecedores, recusados] = await Promise.all([
    fornecedoresDaEmpresa(db, companyId), paresRecusados(db, companyId),
  ])

  // As linhas que a fila de Pendentes mostra (mesma régua da tela — NEEDS_REVIEW).
  const pendentes = await db.transaction.findMany({
    where: {
      categoryId: null, transferGroupId: null, reconciledWithId: null,
      reconciledFrom: { none: {} }, isCardPayment: false,
      loanInstallmentPaid: { is: null }, loanInstallmentPayments: { none: {} },
      pendingTransfer: false, isInternalTransfer: false, ignoredAt: null,
      type: { not: 'TRANSFER' },
      bankAccount: { companyId },
    },
    select: {
      id: true, description: true, amount: true, date: true, dueDate: true, type: true,
      origin: true, lifecycle: true, supplierId: true, bankAccountId: true,
    },
  })
  if (!pendentes.length) return {}

  const janela = JANELA_DIAS * 86400000
  const min = Math.min(...pendentes.map((t) => (t.dueDate ?? t.date).getTime())) - janela
  const max = Math.max(...pendentes.map((t) => (t.dueDate ?? t.date).getTime())) + janela

  // O outro lado, nas duas direções, numa query cada.
  const [contasAbertas, linhasDoExtrato] = await Promise.all([
    db.transaction.findMany({
      where: {
        OR: [
          { lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] }, status: 'PENDING', paymentDate: null },
          { lifecycle: 'EFFECTED', origin: 'ESTOQUE_NF' },
        ],
        reconciledWithId: null, reconciledFrom: { none: {} },
        AND: [{ OR: [
          { bankAccount: { companyId } }, { supplier: { companyId } },
          { customer: { companyId } }, { category: { companyId } },
        ] }],
      },
      select: {
        id: true, description: true, amount: true, date: true, dueDate: true, type: true,
        supplierId: true, supplier: { select: { razaoSocial: true } },
      },
    }),
    db.transaction.findMany({
      where: {
        ...LINHA_DISPONIVEL_WHERE,
        bankAccount: { companyId },
        date: { gte: new Date(min), lte: new Date(max) },
      },
      select: {
        id: true, description: true, amount: true, date: true, type: true,
        supplierId: true, bankAccountId: true, bankAccount: { select: { name: true } },
      },
    }),
  ])

  const out: Record<string, (SugestaoDeVinculo & { outroLado: LadoDoPar; rotulo: string })[]> = {}
  for (const t of pendentes) {
    const ehExtrato = t.origin === 'OFX'
    const lado: LadoDoPar = {
      id: t.id, descricao: t.description, valor: Math.abs(t.amount),
      data: ehExtrato ? t.date : (t.dueDate ?? t.date),
      tipo: t.type as 'CREDIT' | 'DEBIT',
      fornecedorId: t.supplierId, contaBancariaId: t.bankAccountId,
    }
    const achados: (SugestaoDeVinculo & { outroLado: LadoDoPar; rotulo: string })[] = []

    if (ehExtrato) {
      // linha do extrato → contas a pagar em aberto
      const contas = contasAbertas
        .filter((c) => c.id !== t.id)
        .map((c): LadoDoPar => ({
          id: c.id, descricao: c.description, valor: Math.abs(c.amount),
          data: c.dueDate ?? c.date, tipo: c.type as 'CREDIT' | 'DEBIT',
          fornecedorId: c.supplierId, contaBancariaId: null,
        }))
      for (const s of sugerirVinculos({ extrato: lado, contas, fornecedores, recusados })) {
        const o = contas.find((c) => c.id === s.contaId)!
        achados.push({ ...s, outroLado: o, rotulo: 'conta a pagar' })
      }
    } else {
      // conta a pagar / ex-payable → linhas do extrato (⭐ o caso do Cancian)
      for (const e of linhasDoExtrato) {
        if (e.id === t.id) continue
        const ladoE: LadoDoPar = {
          id: e.id, descricao: e.description, valor: Math.abs(e.amount), data: e.date,
          tipo: e.type as 'CREDIT' | 'DEBIT', fornecedorId: e.supplierId,
          contaBancariaId: e.bankAccountId,
        }
        const [s] = sugerirVinculos({ extrato: ladoE, contas: [lado], fornecedores, recusados })
        if (s) achados.push({ ...s, outroLado: ladoE, rotulo: 'linha do extrato' })
      }
    }
    if (achados.length) out[t.id] = achados.sort((a, b) => b.score - a.score).slice(0, 3)
  }
  return out
}

/**
 * ⭐ O NÚMERO DO BADGE DO MENU — a MESMA derivação da tela.
 *
 * ⛔ O badge tinha uma query própria (a definição velha da fila). Duas derivações
 * da mesma pergunta divergem no primeiro caso de borda, e este já tinha divergido:
 * com a fila nova, o menu mostraria **0** enquanto a tela mostra **2 pares**.
 *
 * ⚠️ Roda a busca inteira de propósito. Uma versão "leve e aproximada" seria a
 * segunda derivação de novo, com outro nome.
 */
export async function contarVinculosEsperandoDecisao(
  companyId: string, db: Db = defaultPrisma,
): Promise<number> {
  const contas = await contasEsperandoPagamento(companyId, db)
  return contas.filter((c) => c.sugestoes.length > 0).length
}
