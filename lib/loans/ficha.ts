// ⭐⭐ R60 — CONTRATO COM FICHA COMPLETA (25/11/2026, lei docs/emprestimos-referencia.html).
//
// Editar EXISTE (campo a campo). Excluir EXISTE com DOIS destinos: sem história apaga de vez;
// com história some de todas as telas e o nome sobrevive só nos relatórios históricos (o DRE lê
// as parcelas pagas, não a lista de contratos). Cadastro incompleto é COBRADO na tela — nunca
// preenchido por palpite.
//
// ⛔ Antes: a API só tinha GET e DELETE, e o DELETE apagava o contrato COM a história — os
// pedaços N:1 caíam em cascata e os encargos já apurados SUMIAM do DRE de meses fechados.

import type { Prisma, PrismaClient } from '@prisma/client'
import { z } from 'zod'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * ⛔⛔ PORTA ÚNICA do "o contrato aparece nas telas". Todo leitor de TELA (carteira, caixa de
 * entrada, compromissos, parcelas do mês, pendentes, import) espalha isto no `where`. O juiz e o
 * DRE NÃO usam — eles leem a história, que sobrevive à exclusão.
 */
export const CONTRATO_VISIVEL = { archivedAt: null } satisfies Prisma.LoanWhereInput

export type DestinoDaExclusao = 'apaga' | 'relatorios'

/** pino P14 da lei */
export function destinoExclusao(temHistoria: boolean): DestinoDaExclusao {
  return temHistoria ? 'relatorios' : 'apaga'
}

export interface HistoriaDoContrato {
  parcelas: number
  pagas: number
  vinculos: number
  liberacaoVinculada: boolean
  temHistoria: boolean
}

export async function historiaDoContrato(db: Db, loanId: string): Promise<HistoriaDoContrato> {
  const p = db as PrismaClient
  const [parcelas, pagas, pedacos, um, loan] = await Promise.all([
    p.loanInstallment.count({ where: { loanId } }),
    p.loanInstallment.count({ where: { loanId, status: 'PAID' } }),
    p.loanInstallmentPayment.count({ where: { installment: { loanId } } }),
    p.loanInstallment.count({ where: { loanId, reconciledTransactionId: { not: null } } }),
    p.loan.findUnique({ where: { id: loanId }, select: { disbursementTransactionId: true } }),
  ])
  const vinculos = pedacos + um
  const liberacaoVinculada = !!loan?.disbursementTransactionId
  // ⚠️ "história" = algo que já aconteceu de verdade: parcela paga, dinheiro vinculado, liberação
  return { parcelas, pagas, vinculos, liberacaoVinculada, temHistoria: pagas > 0 || vinculos > 0 || liberacaoVinculada }
}

/** a confirmação DIZ os números (R60) */
export function fraseDoExcluir(h: HistoriaDoContrato): string {
  if (!h.temHistoria) return `Apaga de vez: ${h.parcelas} parcela(s) da agenda, nenhuma paga, nenhum vínculo.`
  const partes = [`${h.pagas} parcela(s) paga(s)`, `${h.vinculos} vínculo(s) com o extrato`]
  if (h.liberacaoVinculada) partes.push('liberação vinculada')
  return `Some de todas as telas; o nome continua nos relatórios — ${partes.join(' · ')}.`
}

export interface PendenciaDeCadastro { campo: string; rotulo: string }

/** ⛔ cobra, nunca inventa: pós-fixado sem indexador é cadastro incompleto */
export function cadastroIncompleto(loan: { rateType: string | null; indexer: string | null; scheduleSource: string | null }): PendenciaDeCadastro[] {
  const out: PendenciaDeCadastro[] = []
  if (loan.scheduleSource === 'FLEXIBLE') return out
  if (loan.rateType === 'POS' && !loan.indexer) out.push({ campo: 'indexer', rotulo: 'indexador em branco' })
  return out
}

/**
 * ⭐ o que o PATCH aceita. ⚠️ Editar a taxa/sistema NÃO regera a agenda (R55 — a agenda só muda
 * por "importar agenda do banco" ou "corrigir agenda"); a ficha é a ficha.
 */
export const patchDoContratoSchema = z.object({
  lender: z.string().trim().min(1).max(80).optional(),
  contractNumber: z.string().trim().max(60).nullable().optional(),
  bankAccountId: z.string().cuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  rateType: z.enum(['PRE', 'POS']).optional(),
  indexer: z.enum(['CDI', 'SELIC', 'IPCA']).nullable().optional(),
  indexerPercent: z.number().min(0).max(1000).nullable().optional(),
  interestRateMonthly: z.number().min(0).max(1).optional(),
  amortizationSystem: z.enum(['PRICE', 'SAC']).optional(),
  termMonths: z.number().int().min(1).max(600).optional(),
  principal: z.number().positive().optional(),
  iof: z.number().min(0).optional(),
  tarifas: z.number().min(0).optional(),
  carencia: z.number().int().min(0).max(60).optional(),
  disbursementDate: z.coerce.date().optional(),
  firstDueDate: z.coerce.date().optional(),
}).strict().refine((d) => Object.keys(d).length > 0, { message: 'Nada pra alterar' })

export type PatchDoContrato = z.infer<typeof patchDoContratoSchema>
