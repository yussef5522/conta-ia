// ⭐⭐⭐ INVESTIMENTOS — O ESPELHO DO EMPRÉSTIMO, DO LADO DO ATIVO (25/09/2026)
//
// **Decisão do dono:** *"CAPITALIZACAO RG e PAGAMENTO CONSORCIO não são despesa nem conta a
// pagar — são APORTES recorrentes que constroem patrimônio. O espelho do empréstimo: lá a
// parcela reduz dívida, aqui aumenta ativo."*
//
// ⭐ **O QUE A MEDIÇÃO EM PROD MOSTROU ANTES DE EU ESCREVER ISTO** (e mudou o escopo):
// as linhas **JÁ ESTÃO** categorizadas como `Investimentos [INVESTIMENTOS]`, e o
// `INVESTIMENTOS` **já é um dreGroup NÃO-DRE**. Provado por contrafactual: o DRE de setembro
// é **idêntico ao centavo** com e sem os R$ 2.214,23 de aportes, e eles aparecem em
// `nonDreGroups`. ⚠️ *O item 3 do pedido já estava atendido* — o que faltava era o CONTRATO,
// o GESTO e a linha na lista fechada.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

/**
 * ⭐ O vocabulário mora aqui, NÃO num CHECK do banco.
 *
 * ⚠️ É a lição do `stock_radar_watchlist` (21/09): *"CHECK com vocabulário fechado numa
 * tabela de CONFIGURAÇÃO envelhece mal — e o prazo foi de um dia"*. O banco valida a FORMA
 * (dia 1..31, valor > 0, nome não-vazio); o tipo novo se acrescenta aqui.
 */
export const TIPOS_DE_INVESTIMENTO = [
  { chave: 'CONSORCIO', rotulo: 'Consórcio' },
  { chave: 'CAPITALIZACAO', rotulo: 'Capitalização' },
  { chave: 'OUTRO', rotulo: 'Outro' },
] as const

export type TipoDeInvestimento = typeof TIPOS_DE_INVESTIMENTO[number]['chave']

export const ehTipoValido = (t: string): t is TipoDeInvestimento =>
  TIPOS_DE_INVESTIMENTO.some((x) => x.chave === t)

export interface ContratoComTotais {
  id: string
  nome: string
  tipo: string
  valorParcela: number
  diaDoMes: number
  totalParcelas: number | null
  parcelasPagasAoIniciar: number | null
  ativo: boolean
  bankAccountId: string | null
  bankAccountNome: string | null
  observacao: string | null
  /** ⭐ quanto já foi aportado POR AQUI (a soma dos vínculos, nunca um campo gravado) */
  totalAportado: number
  /** quantos aportes conciliados */
  aportes: number
  /** ⚠️ inclui o que o dono declarou ter pago ANTES de entrar no sistema */
  parcelasPagasTotal: number
  /** `null` quando o total é desconhecido — nunca 0, que se leria como "acabou" */
  parcelasRestantes: number | null
  ultimoAporte: { competencia: string; valor: number; data: Date } | null
}

/**
 * ⭐⭐ **O TOTAL APORTADO É DERIVADO, NUNCA GRAVADO** — a régua da casa desde o saldo do
 * empréstimo. Campo gravado envelhece: foi assim que a `CreditCardInvoice.status` ficou
 * eternamente `OPEN` depois de vencer.
 *
 * ⚠️ E ele conta **só o que passou pelo gesto**. O dono pode ter pago 20 parcelas antes de
 * usar o sistema — isso vive em `parcelasPagasAoIniciar`, **separado**, porque uma coisa é
 * o que o sistema viu e outra é o que ele declarou. Misturar faria a tela afirmar um
 * histórico que ninguém conferiu.
 */
export async function contratosComTotais(
  companyId: string,
  db: PrismaClient = defaultPrisma,
  opts?: { incluirInativos?: boolean },
): Promise<ContratoComTotais[]> {
  const contratos = await db.investmentContract.findMany({
    where: { companyId, ...(opts?.incluirInativos ? {} : { ativo: true }) },
    include: {
      bankAccount: { select: { name: true } },
      aportes: {
        select: { valor: true, competencia: true, transaction: { select: { date: true } } },
        orderBy: { competencia: 'desc' },
      },
    },
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
  })

  return contratos.map((c) => {
    const totalAportado = c.aportes.reduce((s, a) => s + a.valor, 0)
    const pagasAntes = c.parcelasPagasAoIniciar ?? 0
    const parcelasPagasTotal = pagasAntes + c.aportes.length
    const u = c.aportes[0]
    return {
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      valorParcela: c.valorParcela,
      diaDoMes: c.diaDoMes,
      totalParcelas: c.totalParcelas,
      parcelasPagasAoIniciar: c.parcelasPagasAoIniciar,
      ativo: c.ativo,
      bankAccountId: c.bankAccountId,
      bankAccountNome: c.bankAccount?.name ?? null,
      observacao: c.observacao,
      totalAportado: Math.round(totalAportado * 100) / 100,
      aportes: c.aportes.length,
      parcelasPagasTotal,
      // ⛔ sem total conhecido, "restantes" é `null` — 0 se leria como "acabou"
      parcelasRestantes: c.totalParcelas != null ? Math.max(0, c.totalParcelas - parcelasPagasTotal) : null,
      ultimoAporte: u ? { competencia: u.competencia, valor: u.valor, data: u.transaction.date } : null,
    }
  })
}

/**
 * ⭐ A COMPETÊNCIA DE UM APORTE — o mês em que a parcela caiu.
 *
 * ⚠️ Em **UTC**, como o resto do módulo: `getMonth()` no fuso do processo puxaria o dia 1º
 * pro mês anterior (o servidor roda em UTC e o dono está em São Paulo).
 */
export function competenciaDaData(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** ⭐ o rótulo curto que vai pro rastro: "set/2026" */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export function competenciaCurta(competencia: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia)
  if (!m) return competencia
  return `${MESES[Number(m[2]) - 1] ?? m[2]}/${m[1]}`
}

/**
 * ⭐⭐ O RASTRO DO APORTE — *"aporte no Consórcio X, parcela de set/2026"* (palavras do dono).
 *
 * ⚠️ Ele NOMEIA o contrato e a competência. *"Aporte em investimento"* sozinho faria o
 * contador voltar a perguntar em qual dos cinco contratos — e é ele quem lê isto.
 */
export function rastroDoAporte(nomeDoContrato: string, competencia: string): string {
  return `aporte no ${nomeDoContrato}, parcela de ${competenciaCurta(competencia)}`
}
