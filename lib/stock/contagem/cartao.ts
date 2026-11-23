// ⭐ R38 — a CONTA do cartão de contar, pura (o componente só desenha o que esta função diz).
// Número PURO na unidade do item; o atalho de caixa só soma quando há caixa CADASTRADA; o TOTAL
// vai escrito no botão. Extraída do componente pra ser EXECUTADA no teste (REGRA 3).
import { aceitaFracao, sanitizarQtd, valorQtd } from '@/lib/stock/quantidade'
import { fmt1, rotConfirmar } from './direcao'

export interface ContaDoCartao {
  valor: number
  valido: boolean
  fracaoProibida: boolean
  /** o rótulo do botão — com o TOTAL quando há número válido */
  botao: string
  /** a conta escrita (só quando o atalho de caixa foi usado) */
  conta: string | null
}

export function contaDoCartao(input: {
  texto: string; caixas: number; unidade: string; caixa: { fator: number; nome: string } | null
}): ContaDoCartao {
  const { texto, unidade, caixa } = input
  const caixas = caixa ? input.caixas : 0 // ⛔ sem caixa cadastrada, caixa não existe
  const vazio = texto.trim() === ''
  const solto = vazio ? (caixas > 0 ? 0 : NaN) : valorQtd(sanitizarQtd(texto, unidade)) ?? NaN
  const valor = Math.round(((caixa ? caixas * caixa.fator : 0) + solto) * 1e6) / 1e6
  const temNumero = !vazio || caixas > 0
  const inteiroOk = !!aceitaFracao(unidade) || Number.isInteger(valor)
  const valido = temNumero && Number.isFinite(valor) && valor >= 0 && inteiroOk
  return {
    valor,
    valido,
    fracaoProibida: temNumero && Number.isFinite(valor) && !inteiroOk,
    botao: valido ? rotConfirmar(valor, unidade) : 'Confirmar',
    conta: caixa && caixas > 0 && Number.isFinite(valor)
      ? `${caixas} cx + ${vazio ? '0' : texto.trim()} = ${fmt1(valor)} ${unidade} · ${caixa.nome} ×${fmt1(caixa.fator)}`
      : null,
  }
}
