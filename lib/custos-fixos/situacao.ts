/**
 * ⭐⭐ O SELO DE CADA LINHA DE CUSTO FIXO (06/10/2026) — função PURA.
 *
 * **Ordem do dono:** *"SITUAÇÃO em selo: pago ✓ verde · vence dia X azul · atrasado Nd coral ·
 * realizado >15% acima do plano âmbar («+18% do plano»)."*
 *
 * ⛔⛔ **O ESTADO DA CONTA EM ABERTO NÃO É DECIDIDO AQUI.** Quem responde *"esta conta está
 * vencida, vence hoje ou ainda vai vencer?"* é o `statusDaConta` do Contas a Pagar — o dono
 * único dessa pergunta desde 13/09, com a fronteira do **dia do BRASIL**. Uma comparação de
 * data própria aqui faria esta tela dizer *"atrasado"* às 23h de São Paulo sobre uma conta que
 * o dono ainda tem o dia inteiro pra pagar — o fuso que já mentiu 3 horas por dia no card do
 * cartão (09/09) e nos 25 vermelhos do Contas a Pagar (13/09).
 *
 * ⚠️ E `SEM_LANCAMENTO` é estado PRÓPRIO, nunca colapsado em "pago": categoria fixa marcada em
 * que nada saiu no mês **não está paga** — e chamar de paga seria a tela afirmando um pagamento
 * que não houve (a mesma régua do *"sem contagem"* do estoque, que nunca vira zero).
 */
import { statusDaConta, diasAteVencer, textoDoPrazo, type StatusDaConta } from '@/lib/contas-pagar/escopo'

/** ⭐ quanto o realizado pode passar do plano antes de pedir olho — ordem do dono */
export const TOLERANCIA_DO_PLANO = 0.15

/** ⭐⭐ o degrau do SININHO é MAIS ALTO que o do selo (ordem do dono: aviso só acima de 20%) */
export const ESTOURO_QUE_AVISA = 0.20

export type TomDoSelo = 'verde' | 'azul' | 'coral' | 'ambar' | 'cinza'

export interface SeloDaSituacao {
  /** a chave que o teste e o aviso leem — nunca o texto */
  estado: 'PAGO' | 'VENCE' | 'ATRASADO' | 'ACIMA_DO_PLANO' | 'SEM_LANCAMENTO'
  tom: TomDoSelo
  /** o texto do selo, na língua do balcão */
  texto: string
  /** ⭐ quanto passou do plano (0,18 = +18%) — `null` quando não há plano ou nada saiu */
  excessoPct: number | null
}

export interface ContaEmAbertoDaLinha {
  dueDate: Date | string | null
  amount: number
  status: string
  paymentDate: Date | string | null
}

export interface EntradaDaSituacao {
  /** o que o fluxo REALMENTE pagou no mês naquela categoria */
  realizado: number
  /** o que o dono declarou — `null` = sem plano */
  planejado: number | null
  /** as contas a pagar em aberto daquela categoria (a fonte do "vence dia X") */
  emAberto: ContaEmAbertoDaLinha[]
}

/** ⭐ quanto o realizado passou do plano. `null` sem plano, sem realizado, ou plano zero. */
export function excessoDoPlano(realizado: number, planejado: number | null): number | null {
  if (planejado == null || planejado <= 0) return null
  if (realizado <= 0) return null
  return (realizado - planejado) / planejado
}

/**
 * ⭐⭐ A PRECEDÊNCIA É PELA AÇÃO, não pela cor.
 *
 * Atrasado primeiro (dinheiro que já venceu) · depois o estouro do plano (a notícia que o dono
 * abriu a tela pra ver) · depois o vencimento futuro (informação) · depois pago · e o
 * "nada lançado" por último, que é ausência.
 *
 * ⚠️ Uma linha pode ser DUAS coisas ao mesmo tempo (vence dia 21 **e** já está 18% acima do
 * plano). O selo mostra a mais urgente; o número do excesso viaja junto (`excessoPct`), então a
 * tela nunca perde a segunda notícia.
 */
export function situacaoDaLinha(e: EntradaDaSituacao, agora: Date = new Date()): SeloDaSituacao {
  const excesso = excessoDoPlano(e.realizado, e.planejado)

  const estados = e.emAberto.map((c) => ({ c, s: statusDaConta(c, agora) }))
  const vencidas = estados.filter((x) => x.s === 'VENCIDA')
  const aVencer = estados.filter((x) => x.s === 'VENCE_HOJE' || x.s === 'A_PAGAR')

  if (vencidas.length > 0) {
    // ⚠️ a mais antiga manda — é ela que diz o tamanho do atraso
    const dias = vencidas
      .map((x) => diasAteVencer(x.c.dueDate, agora))
      .filter((d): d is number => d != null)
      .sort((a, b) => a - b)[0]
    const n = dias == null ? null : -dias
    return {
      estado: 'ATRASADO',
      tom: 'coral',
      texto: n == null ? 'atrasado' : `atrasado ${n}d`,
      excessoPct: excesso,
    }
  }

  if (excesso != null && excesso > TOLERANCIA_DO_PLANO) {
    return {
      estado: 'ACIMA_DO_PLANO',
      tom: 'ambar',
      texto: `+${Math.round(excesso * 100)}% do plano`,
      excessoPct: excesso,
    }
  }

  if (aVencer.length > 0) {
    // ⚠️ a mais PRÓXIMA manda — é a que pede ação primeiro
    const prox = aVencer
      .map((x) => ({ x, d: diasAteVencer(x.c.dueDate, agora) }))
      .sort((a, b) => (a.d ?? 9e9) - (b.d ?? 9e9))[0]
    const dia = prox.x.c.dueDate
      ? new Date(prox.x.c.dueDate).getUTCDate()
      : null
    const prazo = textoDoPrazo(prox.x.c.dueDate, agora)
    return {
      estado: 'VENCE',
      tom: 'azul',
      texto: dia == null ? 'em aberto · sem data' : `vence dia ${dia}${prazo ? ` · ${prazo}` : ''}`,
      excessoPct: excesso,
    }
  }

  if (e.realizado > 0) {
    return { estado: 'PAGO', tom: 'verde', texto: 'pago ✓', excessoPct: excesso }
  }

  return { estado: 'SEM_LANCAMENTO', tom: 'cinza', texto: 'nada lançado neste mês', excessoPct: null }
}

/** ⭐ o estado que o SININHO cobra — degrau mais alto que o do selo, por ordem do dono */
export function estourouOQueAvisa(realizado: number, planejado: number | null): number | null {
  const x = excessoDoPlano(realizado, planejado)
  return x != null && x > ESTOURO_QUE_AVISA ? x : null
}

/** ⭐ o tipo exportado pra quem precisa do estado da conta sem reimplementar a régua */
export type { StatusDaConta }
