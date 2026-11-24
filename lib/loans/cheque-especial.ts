// ⭐⭐⭐ R64 + R65 — CHEQUE ESPECIAL É CRÉDITO (25/11/2026, lei docs/emprestimos-referencia.html).
//
// R64: as linhas rotativas (cheque especial / conta garantida) moram na tela de empréstimos, em
// seção própria POR CONTA: juros pagos no ano e no mês, usado × limite quando o limite estiver
// cadastrado. O CUSTO DO DINHEIRO soma contratos + cheque especial, declarado separado. Rotativo
// NÃO entra na montanha nem no compromisso — não tem agenda.
//
// R65: linha do extrato com descrição conhecida de juros de limite chega na caixa de entrada com
// palpite pronto ("juros de cheque especial · conta X"); confirmada uma vez, vira regra aprendida
// (conta + descrição). ⛔ NUNCA se marca sozinha.
//
// ⚠️ MEDIDO em prod (24/11, Caçula, 2026): os juros de limite estão no extrato com o CÓDIGO DO
// BANCO na descrição — Sicredi `JUROS UTILIZ.CH.ESPECIAL-ENC036` / `JUROS CHEQUE INADIMPLENTE`,
// Banrisul `TRANSF. ENCARGOS CTA UNICA` / `JUROS`, Caixa `COBRANCA DE JUROS` — espalhados em 3
// categorias diferentes. ⛔ E a Stone tem `JUROS — <FORNECEDOR>` (mora de boleto pago atrasado),
// que NÃO é crédito rotativo: por isso o "JUROS" sozinho só vale EXATO, nunca como prefixo.
// ⚠️ IOF de operação de crédito fica FORA: a lei fala em juros; o IOF é tributo.

import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/** a lista da LEI (o pino P18 roda contra ela) + os códigos de banco medidos em prod */
export const REGRAS_JUROS_CHEQUE: readonly string[] = [
  'JUROS CHEQUE ESPECIAL', 'JUROS LIMITE', 'JUR ADC', 'JUROS CONTA GARANTIDA', 'ENCARGOS LIMITE', 'JUROS S/ SALDO DEVEDOR',
  'JUROS UTILIZ.CH.ESPECIAL', 'JUROS UTILIZ CH ESPECIAL', 'JUROS CHEQUE INADIMPLENTE', 'JUROS ADTO. CREDITO',
  'COBRANCA DE JUROS', 'ENCARGOS CTA UNICA',
]
/** descrições que só valem INTEIRAS (o "JUROS" do Banrisul × o "JUROS — fornecedor" da Stone) */
const EXATAS: readonly string[] = ['JUROS']

/** a forma normalizada da descrição — a CHAVE da regra aprendida (conta + padrão) */
export function padraoDaDescricao(desc: string | null | undefined): string {
  return String(desc ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

/** pino P18 da lei: a descrição é de juros de limite? */
export function sugereJurosCheque(desc: string | null | undefined): boolean {
  const d = padraoDaDescricao(desc)
  if (!d) return false
  if (EXATAS.includes(d)) return true
  return REGRAS_JUROS_CHEQUE.some((p) => d.includes(padraoDaDescricao(p)))
}

/** ⚠️ linha que fala de PARCELA de contrato não é rotativo, mesmo na categoria de juros */
const FALA_DE_PARCELA = /\b(LIQUIDACAO|AMORTIZACAO|PARCELA|PRESTA)/

export interface LinhaParaCheque {
  description: string | null
  bankAccountId: string | null
  categoryName: string | null
  temVinculoDeContrato: boolean
}

/** as categorias pra onde o PALPITE aponta (a dedicada primeiro) */
export const CATEGORIAS_DE_JUROS_DE_CREDITO = ['Juros Cheque Especial', 'Juros sobre Empréstimos'] as const

/**
 * ⛔ a ÚNICA categoria que, sozinha, faz a linha contar como rotativo. "Juros sobre Empréstimos" NÃO
 * decide: em prod (25/11) ela carregava prestação sem vínculo (PREV-EMP.BBH 4.177,96) e pagamento de
 * Mercado Pago (2.568,04) — heurística sugere, nunca decide. Essas linhas viram regra só se o dono confirmar.
 */
export const CATEGORIA_DO_CHEQUE = 'Juros Cheque Especial'

/**
 * ⭐ a régua da TELA (R64): a linha conta como juros de crédito rotativo se é débito sem vínculo
 * de contrato e (a) tem descrição conhecida de juros de limite, (b) casa uma regra aprendida da
 * conta, ou (c) o dono a categorizou em "Juros Cheque Especial" e ela não fala de parcela.
 */
export function ehJurosDeCheque(l: LinhaParaCheque, regras: ReadonlySet<string>): boolean {
  if (l.temVinculoDeContrato) return false
  const padrao = padraoDaDescricao(l.description)
  if (sugereJurosCheque(l.description)) return true
  if (l.bankAccountId && regras.has(`${l.bankAccountId}|${padrao}`)) return true
  if (l.categoryName === CATEGORIA_DO_CHEQUE) {
    return !FALA_DE_PARCELA.test(padrao)
  }
  return false
}

export interface ChequeDaConta {
  bankAccountId: string
  conta: string
  banco: string | null
  jurosAno: number
  jurosMes: number
  linhasAno: number
  /** o que está usado do limite AGORA: o saldo negativo da conta */
  usado: number
  /** ⛔ só se o limite estiver CADASTRADO — sem limite, a tela mostra só o usado (nunca inventa) */
  limite: number | null
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** pino P17 da lei: o cheque por conta fecha no total */
export function somaCheque(qs: ReadonlyArray<{ jurosAno: number }>): number {
  return r2(qs.reduce((s, q) => s + q.jurosAno, 0))
}

/**
 * ⭐ lê o cheque especial da empresa, por conta corrente — em 3 consultas (contas, regras,
 * linhas do ano), nunca uma por conta.
 */
export async function lerChequeEspecial(
  db: Db, companyId: string, ano: number, mes: string,
): Promise<ChequeDaConta[]> {
  const p = db as PrismaClient
  const [contas, regras] = await Promise.all([
    p.bankAccount.findMany({
      where: { companyId, accountType: 'CHECKING' },
      select: { id: true, name: true, bankName: true, balance: true, creditLimit: true },
      orderBy: { name: 'asc' },
    }),
    p.chequeEspecialRegra.findMany({ where: { companyId }, select: { bankAccountId: true, padrao: true } }),
  ])
  if (contas.length === 0) return []
  const chaves = new Set(regras.map((r) => `${r.bankAccountId}|${r.padrao}`))
  const linhas = await p.transaction.findMany({
    where: {
      bankAccountId: { in: contas.map((c) => c.id) },
      type: 'DEBIT',
      status: { not: 'IGNORED' },
      date: { gte: new Date(Date.UTC(ano, 0, 1)), lt: new Date(Date.UTC(ano + 1, 0, 1)) },
    },
    select: {
      amount: true, date: true, description: true, bankAccountId: true,
      category: { select: { name: true } },
      loanInstallmentPaid: { select: { id: true } },
      loanInstallmentPayments: { select: { id: true }, take: 1 },
      loanDisbursement: { select: { id: true } },
    },
  })
  const porConta = new Map<string, { ano: number; mes: number; n: number }>()
  for (const t of linhas) {
    if (!t.bankAccountId) continue
    const ok = ehJurosDeCheque({
      description: t.description, bankAccountId: t.bankAccountId, categoryName: t.category?.name ?? null,
      temVinculoDeContrato: !!t.loanInstallmentPaid || t.loanInstallmentPayments.length > 0 || !!t.loanDisbursement,
    }, chaves)
    if (!ok) continue
    const acc = porConta.get(t.bankAccountId) ?? { ano: 0, mes: 0, n: 0 }
    acc.ano += t.amount
    acc.n += 1
    if (t.date.toISOString().slice(0, 7) === mes) acc.mes += t.amount
    porConta.set(t.bankAccountId, acc)
  }
  return contas
    .map((c) => {
      const a = porConta.get(c.id)
      return {
        bankAccountId: c.id,
        conta: c.name.trim(),
        banco: c.bankName,
        jurosAno: r2(a?.ano ?? 0),
        jurosMes: r2(a?.mes ?? 0),
        linhasAno: a?.n ?? 0,
        usado: r2(Math.max(0, -c.balance)),
        limite: c.creditLimit > 0 ? c.creditLimit : null,
      }
    })
    .filter((c) => c.jurosAno > 0 || c.usado > 0)
}

/** ⭐ R65 — confirmou o palpite uma vez: vira regra da conta (idempotente) */
export async function aprenderJurosDeCheque(
  db: Db, companyId: string, bankAccountId: string, descricao: string | null,
): Promise<void> {
  const padrao = padraoDaDescricao(descricao)
  if (!padrao) return
  await (db as PrismaClient).chequeEspecialRegra.upsert({
    where: { bankAccountId_padrao: { bankAccountId, padrao } },
    create: { companyId, bankAccountId, padrao },
    update: {},
  })
}

/** a categoria pra onde o palpite aponta: a dedicada se o dono a usa (ativa), senão a de juros de crédito */
export async function categoriaDosJurosDeCheque(db: Db, companyId: string): Promise<{ id: string; name: string } | null> {
  const cats = await (db as PrismaClient).category.findMany({
    where: { companyId, isActive: true, name: { in: [...CATEGORIAS_DE_JUROS_DE_CREDITO] } },
    select: { id: true, name: true },
  })
  return cats.find((c) => c.name === 'Juros Cheque Especial') ?? cats.find((c) => c.name === 'Juros sobre Empréstimos') ?? null
}
