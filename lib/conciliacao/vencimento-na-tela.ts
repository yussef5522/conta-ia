/**
 * ⭐ COMO O VENCIMENTO APARECE NO CARD DO PALPITE (23/09/2026).
 *
 * ⚠️ **O dia é de CALENDÁRIO, comparado com o dia do BRASIL** — e isso não é preciosismo:
 * o servidor roda em UTC, então das 21h à meia-noite TODA conta que vence naquele dia
 * apareceria como "venceu". É a cicatriz do card do cartão (09/09) e da fronteira do
 * Contas a Pagar (13/09), onde a mesma troca custou 25 contas pintadas de vermelho.
 *
 * ⛔ E ele NUNCA diz só "venceu": diz **quando**. *"Venceu"* sem a data manda o dono
 * procurar no extrato qual dia era — que é exatamente o que este card existe pra poupar.
 */
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

/**
 * ⭐ `22/09` no ano corrente, `22/09/2025` fora dele.
 *
 * ⚠️ O ano não some sempre: *"venceu 22/09"* numa conta de 2025 é uma data que o dono lê
 * como deste mês. Ele só cala quando é redundante — que é o caso da esmagadora maioria.
 */
const br = (iso: string, anoDeHoje: string) => {
  const [a, m, d] = iso.split('-')
  return a === anoDeHoje ? `${d}/${m}` : `${d}/${m}/${a}`
}

export function venceuOuVence(vencimentoIso: string, hoje: string = diaEmSaoPaulo()): string {
  const d = vencimentoIso.slice(0, 10)
  const ano = hoje.slice(0, 4)
  if (d < hoje) return `venceu ${br(d, ano)}`
  if (d === hoje) return `vence HOJE (${br(d, ano)})`
  return `vence ${br(d, ano)}`
}
