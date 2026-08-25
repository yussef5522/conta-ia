// VENDAS — DETALHE DO DIA: descer do número até a ORIGEM (25/08).
//
// O painel do dia mostrava PIX/Cartão/Dinheiro somados. Somado não se audita: quando um
// dia parece gordo demais, o dono precisa ver DE ONDE veio cada real — mesma
// rastreabilidade que o estoque já tem (movimento → nota), agora no dinheiro
// (dia → lançamento → extrato).
//
// SÓ LEITURA. O rastro JÁ existe: `venda_diaria_transacao` liga cada VendaDiaria às
// transações que a compõem (gravado no recompute). Aqui a gente lê e explica.
//
// ⚠️ REGRA 4 — a frase que explica a atribuição NÃO é uma segunda cópia da regra: ela é
// montada a partir da `RegraRecebimento` resolvida por `resolveRegraRecebimento`, a MESMA
// função que o motor usa pra decidir. Se a regra mudar, o texto muda junto.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { resolveRegraRecebimento, type Meio, type RegraRecebimento, type RegraResolvida } from './perfil-recebimento'
import { isDiaUtil, proximoDia } from './dias-uteis'

/** Anda N dias ÚTEIS PRA FRENTE. O módulo só tinha `voltarDiasUteis` (o motor vai da
 *  entrada pra a competência; aqui o caminho é o inverso: da competência pra a entrada
 *  esperada). Reusa os mesmos primitivos de calendário — não reimplementa feriado. */
function avancarDiasUteis(d: Date, n: number, feriados: Set<string>): Date {
  let cur = d
  let restam = n
  while (restam > 0) {
    cur = proximoDia(cur)
    if (isDiaUtil(cur, feriados)) restam--
  }
  return cur
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const iso = (d: Date) => d.toISOString().slice(0, 10)

export interface LancamentoOrigem {
  transactionId: string
  /** dia em que o dinheiro ENTROU no extrato (≠ o dia da venda) */
  dataEntrada: string
  contaId: string
  contaNome: string
  descricao: string
  valor: number
  /** por que este lançamento foi parar NESTE dia de venda */
  motivo: string
}

export interface MeioDetalhe {
  meio: string
  valor: number
  lancamentos: LancamentoOrigem[]
}

export interface AguardandoMeio {
  meio: string
  contaNome: string
  /** quando o dinheiro deste dia deve cair, pela regra vigente */
  chegaEm: string
  frase: string
}

export interface DetalheDia {
  de: string
  ate: string
  total: number
  meios: MeioDetalhe[]
  /** meios cuja regra diz que o dinheiro ainda NÃO deveria ter chegado */
  aguardando: AguardandoMeio[]
}

const DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** Monta a frase do motivo a partir da regra REAL (não reimplementa a decisão). */
export function explicarAtribuicao(regra: RegraResolvida | null, meio: string, dataEntrada: Date, isBloco: boolean): string {
  if (!regra) return 'sem regra de recebimento cadastrada pra esta conta/meio — atribuído ao dia da entrada'
  const quando = `${DIA_SEMANA[dataEntrada.getUTCDay()]} ${iso(dataEntrada).split('-').reverse().join('/')}`
  if (regra.diasUteisAtraso === 0) {
    return `${meio === 'DINHEIRO' ? 'dinheiro declarado no próprio dia' : 'cai no mesmo dia'} · entrou ${quando}`
  }
  const unidade = regra.recebeSabDom ? 'dia corrido' : 'dia útil'
  const plural = regra.diasUteisAtraso > 1 ? 's' : ''
  const base = `D+${regra.diasUteisAtraso} ${unidade}${plural}`
  const bloco = isBloco && !regra.recebeSabDom
    ? ' — o fim de semana acumula e cai junto no 1º dia útil'
    : ''
  return `${base}${bloco} · o dinheiro entrou ${quando}`
}

/**
 * Detalhe de UM dia (ou bloco de fim de semana) de competência: cada meio com os
 * lançamentos que o compõem.
 */
export async function getDetalheDia(
  input: { companyId: string; de: string; ate: string; hoje?: Date },
  db: PrismaClient = defaultPrisma,
): Promise<DetalheDia> {
  const inicio = new Date(`${input.de}T00:00:00.000Z`)
  const fim = new Date(`${input.ate}T23:59:59.999Z`)

  const vendas = await db.vendaDiaria.findMany({
    where: { companyId: input.companyId, dataCompetencia: { gte: inicio, lte: fim } },
    include: { origens: true },
  })

  const txIds = vendas.flatMap((v) => v.origens.map((o) => o.transactionId))
  const txs = txIds.length
    ? await db.transaction.findMany({
        where: { id: { in: txIds } },
        select: { id: true, date: true, description: true, bankAccountId: true, bankAccount: { select: { id: true, name: true } } },
      })
    : []
  const txPorId = new Map(txs.map((t) => [t.id, t]))

  // regras vigentes — a MESMA fonte do motor
  const regrasDb = await db.regraRecebimento.findMany({ where: { companyId: input.companyId } })
  const regras: RegraRecebimento[] = regrasDb.map((r) => ({
    bankAccountId: r.bankAccountId, meio: r.meio as Meio, diasUteisAtraso: r.diasUteisAtraso,
    recebeSabDom: r.recebeSabDom, vigenteDe: r.vigenteDe, vigenteAte: r.vigenteAte,
    origemHint: r.origemHint, confirmadoPeloDono: r.confirmadoPeloDono,
  }))

  const porMeio = new Map<string, MeioDetalhe>()
  for (const v of vendas) {
    const m = porMeio.get(v.meio) ?? { meio: v.meio, valor: 0, lancamentos: [] }
    m.valor = round2(m.valor + v.valorLiquido)
    for (const o of v.origens) {
      const t = txPorId.get(o.transactionId)
      if (!t) continue
      const regra = t.bankAccountId ? resolveRegraRecebimento(regras, t.bankAccountId, v.meio as Meio, t.date) : null
      m.lancamentos.push({
        transactionId: t.id,
        dataEntrada: iso(t.date),
        contaId: t.bankAccount?.id ?? '',
        contaNome: t.bankAccount?.name ?? '(sem conta)',
        descricao: t.description,
        valor: round2(o.valor),
        motivo: explicarAtribuicao(regra, v.meio, t.date, v.isBloco),
      })
    }
    porMeio.set(v.meio, m)
  }
  for (const m of porMeio.values()) m.lancamentos.sort((a, b) => a.dataEntrada.localeCompare(b.dataEntrada))

  // ── AGUARDANDO: meio cuja regra diz que o dinheiro ainda não deveria ter caído ──
  // ⚠️ Isto é EXPECTATIVA, não fato: o sistema não distingue "ainda não caiu" de "não
  // houve venda nesse meio". A frase da tela precisa dizer isso.
  const hoje = input.hoje ?? new Date()
  const aguardando: AguardandoMeio[] = []
  const contasPorId = new Map((await db.bankAccount.findMany({
    where: { companyId: input.companyId }, select: { id: true, name: true },
  })).map((c) => [c.id, c.name]))

  for (const r of regras) {
    if (porMeio.has(r.meio)) continue // já chegou dinheiro desse meio neste dia
    if (r.diasUteisAtraso === 0) continue // sem atraso, não há o que esperar
    const vigente = resolveRegraRecebimento(regras, r.bankAccountId, r.meio, fim)
    if (!vigente) continue
    const chega = vigente.recebeSabDom
      ? new Date(fim.getTime() + vigente.diasUteisAtraso * 86_400_000)
      : avancarDiasUteis(inicio, vigente.diasUteisAtraso, new Set())
    if (chega.getTime() <= hoje.getTime()) continue // já deveria ter caído — ausência não é espera
    aguardando.push({
      meio: r.meio,
      contaNome: contasPorId.get(r.bankAccountId) ?? '(conta)',
      chegaEm: iso(chega),
      frase: `pela regra, o ${r.meio.toLowerCase()} deste dia cai no depósito de ${DIA_SEMANA[chega.getUTCDay()]} (${iso(chega).split('-').reverse().join('/')}) — se houve venda nesse meio, ela aparece aqui quando o dinheiro entrar`,
    })
  }

  return {
    de: input.de, ate: input.ate,
    total: round2([...porMeio.values()].reduce((s, m) => s + m.valor, 0)),
    meios: [...porMeio.values()].sort((a, b) => b.valor - a.valor),
    aguardando,
  }
}
