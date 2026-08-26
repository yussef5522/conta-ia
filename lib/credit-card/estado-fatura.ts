// ESTADO DA FATURA — a decisão ÚNICA de "em que pé está esta fatura" (26/08).
//
// ⚠️ POR QUE EXISTE: a tela mostrava **"fecha em −29 dias"** numa fatura que fechou em
// 29/07 e venceu em 10/08 — dia negativo é o sistema pedindo pro dono fazer a conta de
// cabeça. E não dizia NADA sobre estar vencida: R$ 18 mil em atraso sem uma cor na
// tela. Contas a Pagar já resolve isso há meses; o cartão PF não tinha.
//
// ⚠️ O ESTADO É DERIVADO, NÃO ARMAZENADO. O campo `CreditCardInvoice.status` existe
// (OPEN/CLOSED/PAID/PARTIAL/OVERDUE) mas **ninguém o transiciona com o tempo** — uma
// fatura importada nasce OPEN e continua OPEN depois de vencer, porque não há job que
// acorde e mude. Derivar da DATA + do PAGO nunca fica velho: não existe o estado
// "vencida mas o banco ainda diz OPEN". O `status` gravado segue sendo a verdade do
// PAGAMENTO (quem pagou escreve lá); a passagem do tempo é calculada.

export type EstadoFatura = 'ABERTA' | 'FECHADA' | 'VENCIDA' | 'PARCIAL' | 'PAGA'

export interface FaturaParaEstado {
  closingDate: Date
  dueDate: Date
  totalAmount: number
  paidAmount: number
}

export interface EstadoResultado {
  estado: EstadoFatura
  /** rótulo curto pro badge: "Vencida", "A pagar"… */
  rotulo: string
  /** frase de apoio, SEM número negativo */
  detalhe: string
  /** tom semântico do sistema (mesma paleta da Contas a Pagar) */
  tom: 'emerald' | 'amber' | 'rose' | 'sky' | 'slate'
  /** quanto ainda se deve */
  devido: number
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const dia = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().slice(0, 2).join('/')
const diasEntre = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000)

/** "em 3 dias" · "amanhã" · "hoje" — nunca "em −29 dias". */
function emDias(n: number): string {
  if (n <= 0) return 'hoje'
  if (n === 1) return 'amanhã'
  return `em ${n} dias`
}

/** "há 16 dias" · "ontem" · "hoje" */
function haDias(n: number): string {
  if (n <= 0) return 'hoje'
  if (n === 1) return 'ontem'
  return `há ${n} dias`
}

export function estadoDaFatura(inv: FaturaParaEstado, agora: Date): EstadoResultado {
  const devido = round2(inv.totalAmount - inv.paidAmount)
  const fechou = dia(inv.closingDate)
  const venceu = dia(inv.dueDate)

  // ⚠️ ORDEM IMPORTA: pago vem antes de vencido. Fatura paga com atraso é PAGA — o
  // vermelho é pra cobrar ação, e não há ação pendente quando o dinheiro já saiu.
  if (inv.totalAmount > 0 && devido <= 0.01) {
    return {
      estado: 'PAGA', rotulo: 'Paga', tom: 'emerald',
      detalhe: `fechou ${fechou} · venceu ${venceu} · paga`, devido: 0,
    }
  }
  if (inv.paidAmount > 0.01) {
    return {
      estado: 'PARCIAL', rotulo: 'Paga em parte', tom: 'amber',
      detalhe: `fechou ${fechou} · venceu ${venceu} · falta pagar`, devido,
    }
  }

  const paraVencer = diasEntre(inv.dueDate, agora)
  const paraFechar = diasEntre(inv.closingDate, agora)

  if (paraVencer < 0) {
    return {
      estado: 'VENCIDA', rotulo: 'Vencida', tom: 'rose',
      detalhe: `fechou ${fechou} · venceu ${venceu} (${haDias(-paraVencer)})`, devido,
    }
  }
  if (paraFechar < 0) {
    return {
      estado: 'FECHADA', rotulo: 'A pagar', tom: 'amber',
      detalhe: `fechou ${fechou} · vence ${venceu} (${emDias(paraVencer)})`, devido,
    }
  }
  return {
    estado: 'ABERTA', rotulo: 'Aberta', tom: 'sky',
    detalhe: `fecha ${fechou} (${emDias(paraFechar)}) · vence ${venceu}`, devido,
  }
}
