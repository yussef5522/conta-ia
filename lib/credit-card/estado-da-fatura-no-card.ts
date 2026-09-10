// ⭐⭐⭐ O CARD DO CARTÃO DIZ O ESTADO DA FATURA, não só o cadastro (09/09/2026).
//
// **O dono:** *"hoje a lista diz limite e 'fecha dia X · vence dia Y' — e nada sobre a
// fatura em si: aberta? fechada esperando pagamento? vencida? paga? **É a pergunta que me
// faz abrir a tela.**"*
//
// ⛔⛔ **A RÉGUA DO PAGO É A DELE, e ela é dura:** *"pago = pagamento REGISTRADO. Se não
// tem registro, a tela não adivinha — mostra vencida mesmo que eu tenha pago por fora."*
// Aqui isso não é uma escolha de estilo: **um cartão que se diz pago sem vínculo é dinheiro
// contado duas vezes** (a saída no extrato existindo por um lado e a fatura "quitada" pelo
// outro), que é exatamente a dupla contagem que a Conciliação persegue no PJ.
//
// ⚠️ E O SILÊNCIO NUNCA VIRA VERDE: *"ausência de dado NUNCA vira cara de 'tudo certo'"*.
// Ciclo sem fatura importada tem estado PRÓPRIO (`SEM_FATURA`) e diz o que fazer — não
// herda o "aberta" nem some do card.
//
// ⭐ O ESTADO É DERIVADO, nunca gravado: sai do ciclo do cartão + das faturas que
// existem + do vínculo de pagamento. O dia em que o pagamento for registrado, o card muda
// sozinho — **sem nenhum job, sem nenhuma coluna nova pra ficar velha.** É a mesma decisão
// de 26/08 no ciclo PF ("`CreditCardInvoice.status` existe mas NINGUÉM o transiciona com o
// tempo: fatura importada nasce OPEN e continua OPEN depois de vencer").

import { calculateInvoiceReference, type CardConfig } from './calculate-invoice-reference'
import { endOfTodayBrazil } from '@/lib/ofx/future-line'

/**
 * ⛔⛔⛔ O "HOJE" DO CARD É O DIA **DO BRASIL**, não o do servidor (09/09/2026).
 *
 * **Pego na prova em prod, não em teste:** o servidor marcava `2026-09-10 02:32 UTC` —
 * mas em São Paulo ainda era **23:32 de 09/09**. O card do Magalu, cuja fatura vence
 * 09/09, já dizia **"VENCEU dia 09/09"** com o dono ainda dentro do prazo.
 *
 * ⚠️ Não é preciosismo de fuso: **todo dia, das 21h à meia-noite, todo cartão que vence
 * naquele dia apareceria como vencido.** É uma mentira de três horas por dia, no número
 * que o dono usa pra decidir se corre pagar.
 *
 * ⭐ Reusa o `endOfTodayBrazil` do módulo de OFX — a casa já tinha o dono desta pergunta
 * desde 07/08; escrever um segundo cálculo de "dia BRT" aqui seria a lição do B1 de novo.
 */
export function hojeNoBrasil(agora: Date = new Date()): Date {
  // ⚠️ o fim do dia BRT convertido pra UTC cai no dia seguinte; recuo 12h pra pousar no
  // MEIO do dia brasileiro, que é o instante que representa o dia sem ambiguidade.
  return new Date(endOfTodayBrazil(agora).getTime() - 12 * 3600_000)
}

export type EstadoDaFatura =
  /** ciclo corrente, ainda não fechou */
  | 'ABERTA'
  /** fechou e espera pagamento */
  | 'FECHADA'
  /** vence hoje */
  | 'VENCE_HOJE'
  /** passou do vencimento e não há pagamento registrado */
  | 'VENCIDA'
  /** pagamento registrado (vínculo, não palpite) */
  | 'PAGA'
  /** o ciclo existe e nenhuma fatura dele foi importada */
  | 'SEM_FATURA'

/** o tom que a tela pinta — um por estado, decidido aqui e não no componente */
export type TomDoCard = 'neutro' | 'atencao' | 'alerta' | 'ok'

export interface FaturaConhecida {
  id: string
  reference: string
  closingDate: Date
  dueDate: Date
  totalAmount: number
  paidAmount: number
  status: string
  /** a data do pagamento REGISTRADO (o vínculo), quando existe */
  pagoEm: Date | null
}

export interface EstadoNoCard {
  estado: EstadoDaFatura
  tom: TomDoCard
  /** ⛔ a frase que o card imprime — estado sem frase manda o dono adivinhar */
  frase: string
  invoiceId: string | null
  referencia: string | null
  valor: number | null
  vencimento: string | null
  fechamento: string | null
  /** negativo = já passou */
  diasPraVencer: number | null
  diasPraFechar: number | null
  pagoEm: string | null
  /**
   * ⚠️ SEGUNDA LINHA, e ela é o "ausência não é tudo certo": o card pode estar mostrando
   * uma fatura VENCIDA de julho e, ao mesmo tempo, não ter a do ciclo de agora. As duas
   * coisas são verdade e as duas aparecem.
   */
  cicloCorrenteSemFatura: boolean
}

const DIA = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)
const diaMes = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** ⚠️ dias de CALENDÁRIO, em UTC — "vence em 2 dias" não pode virar 1 por causa do fuso */
export function diasEntre(de: Date, ate: Date): number {
  const a = Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), de.getUTCDate())
  const b = Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth(), ate.getUTCDate())
  return Math.round((b - a) / DIA)
}

/**
 * ⭐ ESTÁ PAGA? — **só o vínculo responde.**
 *
 * ⛔ Não é `status === 'PAID'` sozinho: o status é um campo gravado, e campo gravado
 * envelhece (foi por isso que o preview da fatura passou a derivar o estado em 26/08). A
 * pergunta real é *"o dinheiro que quitou esta fatura está registrado?"*, e a resposta é
 * `paidAmount`, que só cresce quando um pagamento é AMARRADO.
 */
export function estaPaga(f: FaturaConhecida): boolean {
  if (f.totalAmount <= 0) return false
  return round2(f.paidAmount) >= round2(f.totalAmount) - 0.02
}

/** quantos dias antes do vencimento o card já pede atenção */
export const DIAS_DE_ATENCAO = 3

/**
 * ⭐⭐ QUAL FATURA O CARD MOSTRA — a que PEDE DECISÃO, não a mais recente.
 *
 * A ordem é a do trabalho do dono:
 *   1. **vencida sem pagamento** (a mais antiga primeiro — ela é a que dói)
 *   2. **fechada esperando pagamento**
 *   3. o **ciclo corrente**, aberta ou ainda não importada
 *   4. e, se nada disso existe, a última paga — pra o card não ficar mudo
 */
export function estadoDaFaturaNoCard(entrada: {
  card: CardConfig
  faturas: FaturaConhecida[]
  hoje: Date
}): EstadoNoCard {
  const { card, faturas, hoje } = entrada
  const ciclo = calculateInvoiceReference(hoje, card)
  const doCiclo = faturas.find((f) => f.reference === ciclo.reference) ?? null
  const cicloCorrenteSemFatura = !doCiclo

  const abertas = faturas
    .filter((f) => !estaPaga(f) && f.totalAmount > 0)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

  // 1 e 2 — o que já fechou e não foi pago
  const naoPagaFechada = abertas.find((f) => diasEntre(hoje, f.dueDate) <= 0 || f.closingDate <= hoje)
  if (naoPagaFechada) {
    const dias = diasEntre(hoje, naoPagaFechada.dueDate)
    const base = comum(naoPagaFechada, cicloCorrenteSemFatura)
    if (dias < 0) {
      return {
        ...base, estado: 'VENCIDA', tom: 'alerta',
        frase: `${brl(naoPagaFechada.totalAmount)} · VENCEU dia ${diaMes(naoPagaFechada.dueDate)}`,
      }
    }
    if (dias === 0) {
      return {
        ...base, estado: 'VENCE_HOJE', tom: 'alerta',
        frase: `${brl(naoPagaFechada.totalAmount)} · vence HOJE`,
      }
    }
    return {
      ...base,
      estado: 'FECHADA',
      tom: dias <= DIAS_DE_ATENCAO ? 'atencao' : 'neutro',
      frase: `${brl(naoPagaFechada.totalAmount)} · vence em ${dias} dia${dias > 1 ? 's' : ''}`,
    }
  }

  // 3 — o ciclo corrente, quando ele foi importado e não está pago
  if (doCiclo && !estaPaga(doCiclo)) {
    const paraFechar = diasEntre(hoje, doCiclo.closingDate)
    const base = comum(doCiclo, false)
    return {
      ...base, estado: 'ABERTA', tom: 'neutro',
      // ⚠️ o acumulado só entra quando existe: fatura aberta sem lançamento importado
      // mostrando "R$ 0,00" afirmaria que não se gastou nada.
      frase: doCiclo.totalAmount > 0
        ? `aberta · ${brl(doCiclo.totalAmount)} até agora · fecha em ${paraFechar} dia${paraFechar > 1 ? 's' : ''}`
        : `aberta · fecha em ${paraFechar} dia${paraFechar > 1 ? 's' : ''}`,
    }
  }

  // 4 — nada pendente: a última PAGA.
  //
  // ⚠️⚠️ ELA VEM ANTES DO "SEM FATURA", e a ordem foi corrigida no teste: no Magalu o
  // ciclo corrente já é o de OUTUBRO no dia 09/09 (fecha dia 2), então a fatura recém-paga
  // de setembro não é "a do ciclo". Caindo direto no SEM_FATURA, o card diria *"sem fatura
  // importada"* logo depois de o dono pagar 4.491,18 — apagando a única notícia boa da
  // tela. O `cicloCorrenteSemFatura` continua indo junto, na segunda linha.
  const paga = [...faturas].filter(estaPaga).sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())[0]
  if (paga) {
    const base = comum(paga, cicloCorrenteSemFatura)
    return {
      ...base, estado: 'PAGA', tom: 'ok',
      frase: `paga ✓${paga.pagoEm ? ` em ${diaMes(paga.pagoEm)}` : ''}`,
    }
  }

  // 5 — não há o que dizer além da ausência, e ela é dita por extenso
  const paraFechar = diasEntre(hoje, ciclo.closingDate)
  return {
    estado: 'SEM_FATURA', tom: 'neutro',
    // ⛔ diz o que É e o que fazer. "Ausência de dado NUNCA vira cara de tudo certo."
    frase: `sem fatura importada deste ciclo · fecha ${paraFechar > 0 ? `em ${paraFechar} dia${paraFechar > 1 ? 's' : ''}` : `dia ${diaMes(ciclo.closingDate)}`}`,
    invoiceId: null, referencia: ciclo.reference, valor: null,
    vencimento: iso(ciclo.dueDate), fechamento: iso(ciclo.closingDate),
    diasPraVencer: diasEntre(hoje, ciclo.dueDate), diasPraFechar: paraFechar,
    pagoEm: null, cicloCorrenteSemFatura: true,
  }

  function comum(f: FaturaConhecida, semFatura: boolean) {
    return {
      invoiceId: f.id, referencia: f.reference, valor: f.totalAmount,
      vencimento: iso(f.dueDate), fechamento: iso(f.closingDate),
      diasPraVencer: diasEntre(hoje, f.dueDate),
      diasPraFechar: diasEntre(hoje, f.closingDate),
      pagoEm: f.pagoEm ? iso(f.pagoEm) : null,
      cicloCorrenteSemFatura: semFatura,
    }
  }
}
