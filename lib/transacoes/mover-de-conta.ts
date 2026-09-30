// ⭐⭐⭐ TROCAR A CONTA DE UM LANÇAMENTO (30/09/2026) — a porta que faltava.
//
// **O caso que a motivou:** uma venda em dinheiro de R$ 2.112,00 do dia 17/09 foi lançada
// na **stone** em vez da **caixa loja/cofre**. As outras 14 vendas em dinheiro do mês estão
// todas no cofre — foi o dedo escorregando no seletor de conta, e **a tela de editar
// lançamento deixava trocar tipo, data, valor, categoria e status, mas NÃO a conta.**
//
// ⚠️ Errar a conta é ROTINA, não exceção. Sem este gesto, a saída era apagar e lançar de
// novo — que perde o rastro, a categoria e o vínculo, e (pior) deixa o saldo das duas
// contas driftado, porque delete e create somavam delta em vez de re-derivar.
//
// ═══ AS DUAS METADES QUE FAZEM ISTO SER SEGURO ═══
//
// 1. **A FRONTEIRA** (`podeMoverDeConta`, pura): linha que VEIO DO EXTRATO não se move.
//    Ela é o espelho do que o banco registrou — mover faria o sistema discordar do
//    extrato e o gate do import acusaria um descolamento que a gente mesmo criou.
//
// 2. **O SALDO SE RE-ANCORA, NUNCA SE SOMA** (`reAncorarContas` nas DUAS contas). Mover
//    é o gesto que mais expõe o drift: ele mexe em duas contas de uma vez, e um `increment`
//    esquecido de um lado deixaria as duas erradas em direções opostas.
//
// ⭐ E a COMPETÊNCIA muda com a conta, porque a régua de recebimento é POR CONTA
// (dinheiro no cofre é D+1 corrido; PIX na Stone é D+0). A mesma venda vale por outro dia
// dependendo de onde o dinheiro entrou — então a tela DIZ quando o dia andou, em vez de
// mexer no calendário em silêncio.

import type { PrismaClient, Prisma } from '@prisma/client'
import type { RecalcResult } from '@/lib/balance/recalcular'
import { computeCompetencia } from '@/lib/vendas/compute-competencia'
import type { Meio, RegraRecebimento } from '@/lib/vendas/perfil-recebimento'
import { feriadosNacionaisAnos } from '@/lib/vendas/feriados-nacionais'

type Db = PrismaClient | Prisma.TransactionClient

/** Códigos de recusa — a TELA age em cima deles, nunca em cima do texto. */
export type MotivoBloqueio =
  | 'VEIO_DO_EXTRATO'
  | 'CONCILIADA'
  | 'PERNA_DE_TRANSFERENCIA'
  | 'NAO_EFETIVADA'
  | 'ORIGEM_NAO_MOVIVEL'

export interface LinhaParaMover {
  origin: string | null
  reconciledWithId: string | null
  transferGroupId: string | null
  type: string
  lifecycle: string | null
  /** nome de quem a conciliou, quando houver — pra frase dizer COM O QUÊ */
  conciliadaCom?: string | null
}

export interface VereditoDaFronteira {
  pode: boolean
  motivo: MotivoBloqueio | null
  /** frase de balcão: o que impede E o que fazer. Nunca só "não pode". */
  explicacao: string | null
}

/**
 * ⛔⛔ ALLOWLIST, NÃO DENYLIST — e a direção do erro é deliberada.
 *
 * Só quem NASCEU DA MÃO DO DONO se move. Origem nova (um import de um banco novo, uma
 * ponte nova) cai automaticamente no lado que RECUSA — e o erro seguro aqui é recusar:
 * quem levou um "não" com o motivo escrito vem falar comigo; quem moveu uma linha de
 * extrato sem perceber só descobre semanas depois, quando o saldo não fecha.
 *
 * ⚠️ `null` entra porque é o legado de antes do campo `origin` existir, e ali o histórico
 * é de lançamento manual.
 */
const ORIGENS_QUE_MOVEM = new Set(['MANUAL', null])

export function podeMoverDeConta(l: LinhaParaMover): VereditoDaFronteira {
  // ⭐ A ordem das recusas é a ordem do que o dono resolve PRIMEIRO: não faz sentido
  // explicar a conciliação de uma linha que nunca poderia se mover.
  if (l.origin && !ORIGENS_QUE_MOVEM.has(l.origin)) {
    if (l.origin === 'OFX' || l.origin === 'PDF_STATEMENT' || l.origin === 'OPEN_FINANCE') {
      return {
        pode: false,
        motivo: 'VEIO_DO_EXTRATO',
        explicacao:
          'esta linha veio do extrato do banco — ela é o espelho do que o banco registrou nesta conta. ' +
          'Trocar a conta faria o sistema discordar do extrato e o próximo import acusaria uma diferença ' +
          'que não existe. Se o arquivo entrou na conta errada, o caminho é reimportar o extrato na conta certa.',
      }
    }
    return {
      pode: false,
      motivo: 'ORIGEM_NAO_MOVIVEL',
      explicacao:
        `esta linha foi criada por outro fluxo do sistema (${l.origin}) e a conta dela vem de lá — ` +
        'mover por aqui deixaria os dois lados discordando. Só lançamento feito à mão troca de conta.',
    }
  }

  if (l.lifecycle && l.lifecycle !== 'EFFECTED') {
    return {
      pode: false,
      motivo: 'NAO_EFETIVADA',
      explicacao:
        'este lançamento ainda não foi realizado (é conta a pagar/receber em aberto) — a conta dele se ' +
        'escolhe na hora de dar baixa, no Contas a Pagar.',
    }
  }

  // ⛔ Perna de par: mover uma sozinha quebraria o par e deixaria o dinheiro entrando numa
  // conta e saindo de outra que não conversam mais.
  if (l.transferGroupId || l.type === 'TRANSFER') {
    return {
      pode: false,
      motivo: 'PERNA_DE_TRANSFERENCIA',
      explicacao:
        'esta linha é uma das pontas de uma transferência entre contas — mover só ela quebraria o par. ' +
        'Desfaça o pareamento primeiro e as duas pontas voltam a ser lançamentos soltos.',
    }
  }

  if (l.reconciledWithId) {
    return {
      pode: false,
      motivo: 'CONCILIADA',
      explicacao:
        `este lançamento está conciliado${l.conciliadaCom ? ` com «${l.conciliadaCom}»` : ''} — ` +
        'a conta faz parte do vínculo. Desfaça a conciliação primeiro e depois troque a conta.',
    }
  }

  return { pode: true, motivo: null, explicacao: null }
}

// ═══ A COMPETÊNCIA (que muda com a conta) ═══

export interface CompetenciaDaConta {
  /** null quando a empresa não tem perfil de recebimento, ou a linha é anterior ao módulo */
  inicio: string | null
  fim: string | null
  meio: Meio | null
  isBloco: boolean
}

const soDia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

/**
 * Qual a competência de venda desta linha SE ela estiver nesta conta.
 *
 * ⚠️ **Reusa `computeCompetencia`** — a MESMA função do recompute, do juiz e da tela. Uma
 * segunda régua aqui faria o aviso da tela prometer um dia e o calendário gravar outro,
 * que é a doença que este módulo mais paga.
 */
export async function competenciaNaConta(
  db: Db,
  companyId: string,
  bankAccountId: string,
  data: Date,
): Promise<CompetenciaDaConta> {
  const brutas = await db.regraRecebimento.findMany({ where: { companyId } })
  if (brutas.length === 0) return { inicio: null, fim: null, meio: null, isBloco: false }

  const regras: RegraRecebimento[] = brutas.map((r) => ({
    bankAccountId: r.bankAccountId,
    meio: r.meio as Meio,
    diasUteisAtraso: r.diasUteisAtraso,
    recebeSabDom: r.recebeSabDom,
    vigenteDe: r.vigenteDe,
    vigenteAte: r.vigenteAte,
    origemHint: r.origemHint,
    confirmadoPeloDono: r.confirmadoPeloDono,
  }))
  const meio = (regras.find((r) => r.bankAccountId === bankAccountId)?.meio ?? null) as Meio | null
  if (!meio) return { inicio: null, fim: null, meio: null, isBloco: false }

  // ⚠️ feriado é FUNÇÃO PURA nesta casa (`feriadosNacionaisAnos`), não tabela — e o ano
  // do ANTERIOR entra porque a competência pode voltar (venda de 31/12 recebida em 02/01).
  const ano = data.getUTCFullYear()
  const feriados = feriadosNacionaisAnos([ano - 1, ano])
  const moduleInicio = regras.reduce<Date | null>(
    (min, r) => (min == null || r.vigenteDe < min ? r.vigenteDe : min),
    null,
  )

  const c = computeCompetencia(data, bankAccountId, meio, regras, feriados, {
    ...(moduleInicio ? { moduleInicio } : {}),
  })
  if (c.fora) return { inicio: null, fim: null, meio, isBloco: false }
  return { inicio: soDia(c.inicio), fim: soDia(c.fim), meio, isBloco: c.isBloco }
}

// ═══ O MOVIMENTO ═══

export class MoverDeContaError extends Error {
  constructor(
    message: string,
    readonly code: MotivoBloqueio | 'CONTA_DE_OUTRA_EMPRESA' | 'MESMA_CONTA' | 'CONTA_INEXISTENTE',
  ) {
    super(message)
    this.name = 'MoverDeContaError'
  }
}

export interface ResultadoDaMudanca {
  de: { id: string; nome: string }
  para: { id: string; nome: string }
  saldos: RecalcResult[]
  competencia: { antes: CompetenciaDaConta; depois: CompetenciaDaConta; mudou: boolean }
  /** a frase que vai pro rastro (notes/audit) */
  rastro: string
}

/**
 * Prepara e valida a mudança de conta. **Não grava a transação** — quem grava é o PUT,
 * junto das outras mudanças, no mesmo commit (senão a linha mudaria de conta e uma falha
 * seguinte deixaria a categoria velha).
 *
 * ⚠️ REGRA 8 — a conta de destino é conferida contra a MESMA empresa. Sem isso, um id
 * trocado na URL moveria dinheiro de uma empresa pra outra.
 */
export async function prepararMudancaDeConta(
  db: Db,
  params: { transacaoId: string; contaDestinoId: string; companyId: string },
): Promise<{
  de: { id: string; nome: string }
  para: { id: string; nome: string }
  competencia: { antes: CompetenciaDaConta; depois: CompetenciaDaConta; mudou: boolean }
  rastro: string
}> {
  const tx = await db.transaction.findUnique({
    where: { id: params.transacaoId },
    select: {
      id: true, date: true, amount: true, type: true, description: true,
      origin: true, reconciledWithId: true, transferGroupId: true, lifecycle: true,
      bankAccountId: true,
      bankAccount: { select: { id: true, name: true, companyId: true } },
    },
  })
  if (!tx || !tx.bankAccount) throw new MoverDeContaError('Lançamento não encontrado', 'CONTA_INEXISTENTE')
  if (tx.bankAccountId === params.contaDestinoId) {
    throw new MoverDeContaError('A conta de destino é a mesma de origem', 'MESMA_CONTA')
  }

  const veredito = podeMoverDeConta({
    origin: tx.origin,
    reconciledWithId: tx.reconciledWithId,
    transferGroupId: tx.transferGroupId,
    type: tx.type,
    lifecycle: tx.lifecycle,
  })
  if (!veredito.pode) throw new MoverDeContaError(veredito.explicacao!, veredito.motivo!)

  const destino = await db.bankAccount.findFirst({
    where: { id: params.contaDestinoId, companyId: params.companyId },
    select: { id: true, name: true },
  })
  if (!destino) {
    throw new MoverDeContaError(
      'A conta escolhida não é desta empresa — recarregue a tela e escolha de novo.',
      'CONTA_DE_OUTRA_EMPRESA',
    )
  }

  const antes = await competenciaNaConta(db, params.companyId, tx.bankAccountId!, tx.date)
  const depois = await competenciaNaConta(db, params.companyId, destino.id, tx.date)
  const mudou = antes.inicio !== depois.inicio || antes.fim !== depois.fim

  return {
    de: { id: tx.bankAccount.id, nome: tx.bankAccount.name },
    para: { id: destino.id, nome: destino.name },
    competencia: { antes, depois, mudou },
    rastro: `movida de ${tx.bankAccount.name} pra ${destino.name}`,
  }
}
