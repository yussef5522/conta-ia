// SÉRIE B — a LEITURA que alimenta o invariante (28/08). Separada da decisão de propósito:
// a decisão (`avaliarConta`) é pura e testável; aqui é só ir ao banco buscar os números.
//
// ⭐ AS ÂNCORAS JÁ EXISTEM — não precisou de tabela nova. Todo import de OFX grava
// `ledgerBalAmount` + `anchorDate` em `OfxImport`, desde 12/08. Ou seja, o HISTÓRICO de
// saldos declarados pelo banco já estava no banco de dados, só não era usado por ninguém.
//
// ⚠️ Só imports com status SUCCESS entram: PREVIEW é simulação, não é declaração aceita.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { avaliarConta, estadoDaConferencia, type CheckSaldo, type LeituraConta, type EstadoConferencia } from './ledgerbal-invariants'
import { parseOFX } from '@/lib/ofx/parser'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** Sinal com que a transação entra no saldo — a MESMA regra do `recalcularSaldoConta`. */
function sinal(t: { type: string; transferDirection: string | null }): 1 | -1 {
  if (t.type === 'CREDIT') return 1
  if (t.type === 'TRANSFER') return t.transferDirection === 'IN' ? 1 : -1
  return -1
}

export async function lerConta(bankAccountId: string, db: PrismaClient = defaultPrisma): Promise<LeituraConta | null> {
  const conta = await db.bankAccount.findUnique({
    where: { id: bankAccountId },
    select: { id: true, name: true, companyId: true, balance: true, ledgerBal: true, ledgerBalDate: true },
  })
  if (!conta) return null

  const imports = await db.ofxImport.findMany({
    where: { bankAccountId, status: 'SUCCESS', ledgerBalAmount: { not: null }, anchorDate: { not: null } },
    // ⚠️⚠️ ORDENAR TAMBÉM POR `createdAt` É OBRIGATÓRIO, e isso me mordeu na 1ª rodada:
    // com dois imports do MESMO dia (26/08 teve dois, ambos ancorados em 25/08, com
    // LEDGERBAL −6.408,68 e −9.434,99), ordenar só por `anchorDate` deixa o desempate
    // ARBITRÁRIO — o mapa abaixo ficou com a declaração ANTIGA e o juiz acusou DOIS erros
    // de ±3.026,31 que se cancelavam. Erro que se cancela em intervalos vizinhos é a
    // assinatura de âncora errada, não de transação faltando.
    orderBy: [{ anchorDate: 'asc' }, { createdAt: 'asc' }],
    select: { anchorDate: true, ledgerBalAmount: true },
  })
  // mesma data importada 2×: fica a declaração do import MAIS RECENTE — é a que o banco
  // considerou final. Guardar as duas faria o invariante comparar o banco com ele mesmo.
  const porDia = new Map<string, { data: Date; valor: number }>()
  for (const i of imports) {
    porDia.set(i.anchorDate!.toISOString().slice(0, 10), { data: i.anchorDate!, valor: i.ledgerBalAmount! })
  }
  const ancoras = [...porDia.values()].sort((a, b) => a.data.getTime() - b.data.getTime())

  // ⚠️ só EFFECTED soma — PAYABLE/RECEIVABLE é compromisso, não caixa (a mesma regra do
  // motor de saldo; se divergisse daqui, o invariante acusaria diferença fantasma).
  const txs = await db.transaction.findMany({
    where: { bankAccountId, lifecycle: 'EFFECTED' },
    select: { date: true, amount: true, type: true, transferDirection: true },
  })

  const somaNoIntervalo = (depoisDe: Date, ate: Date) => {
    const a = depoisDe.toISOString().slice(0, 10)
    const b = ate.toISOString().slice(0, 10)
    return round2(txs
      .filter((t) => { const d = t.date.toISOString().slice(0, 10); return d > a && d <= b })
      .reduce((s, t) => s + sinal(t) * t.amount, 0))
  }

  // ⭐ AS LINHAS DO PRÓPRIO BANCO, lidas dos blobs guardados (29/08). É o terceiro dado que
  // separa "falta linha AQUI" de "o banco se contradiz" — sem ele toda divergência virava
  // culpa nossa, e no Banrisul (cujo saldo declarado embute BLOQUEADO) isso dava alarme
  // falso em série. Usa o blob que COBRE o intervalo; sem blob, devolve null e o B1 volta
  // ao comportamento antigo (erro), que é o conservador.
  const blobs = await db.ofxImport.findMany({
    where: { bankAccountId, rawOfxBlob: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { rawOfxBlob: true },
    take: 40,
  })
  type LinhaArquivo = { dia: string; valor: number }
  const arquivos: { ate: string; linhas: LinhaArquivo[] }[] = []
  for (const b of blobs) {
    try {
      const p = parseOFX(b.rawOfxBlob!)
      const fim = p.statementEnd ?? p.ledgerBalance?.asOfDate ?? null
      if (!fim) continue
      arquivos.push({
        ate: fim.toISOString().slice(0, 10),
        linhas: p.transactions.map((t) => ({
          dia: t.datePosted.toISOString().slice(0, 10),
          valor: t.type === 'CREDIT' ? t.amount : -t.amount,
        })),
      })
    } catch { /* blob ilegível não invalida a leitura */ }
  }
  const somaDoArquivoNoIntervalo = (depoisDe: Date, ate: Date): number | null => {
    const a = depoisDe.toISOString().slice(0, 10)
    const b = ate.toISOString().slice(0, 10)
    // o arquivo mais ANTIGO que já cobre o fim do intervalo (mais próximo da época)
    const cobre = arquivos.filter((f) => f.ate >= b).sort((x, y) => x.ate.localeCompare(y.ate))[0]
    if (!cobre) return null
    return round2(cobre.linhas.filter((l) => l.dia > a && l.dia <= b).reduce((s, l) => s + l.valor, 0))
  }

  const somaPosAncora = conta.ledgerBalDate
    ? round2(txs
        .filter((t) => t.date.toISOString().slice(0, 10) > conta.ledgerBalDate!.toISOString().slice(0, 10))
        .reduce((s, t) => s + sinal(t) * t.amount, 0))
    : 0

  return {
    bankAccountId: conta.id,
    contaNome: conta.name,
    companyId: conta.companyId,
    ancoras,
    somaNoIntervalo,
    somaDoArquivoNoIntervalo,
    balanceGravado: conta.balance,
    ledgerBalVigente: conta.ledgerBal ?? null,
    ledgerBalDataVigente: conta.ledgerBalDate ?? null,
    somaPosAncora,
  }
}

/** Roda a série B em TODAS as contas (o juiz noturno). */
export async function checkSaldosBancarios(db: PrismaClient = defaultPrisma, agora = new Date()): Promise<CheckSaldo[]> {
  const contas = await db.bankAccount.findMany({ select: { id: true } })
  const out: CheckSaldo[] = []
  for (const c of contas) {
    const l = await lerConta(c.id, db)
    if (l) out.push(...avaliarConta(l, agora))
  }
  return out
}

/** Estado por conta pra a TELA de Contas. */
export async function conferenciaDasContas(companyId: string, db: PrismaClient = defaultPrisma, agora = new Date()): Promise<EstadoConferencia[]> {
  const contas = await db.bankAccount.findMany({ where: { companyId }, select: { id: true } })
  const out: EstadoConferencia[] = []
  for (const c of contas) {
    const l = await lerConta(c.id, db)
    if (l) out.push(estadoDaConferencia(l, agora))
  }
  return out
}
