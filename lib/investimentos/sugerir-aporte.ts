// ⭐⭐ O PALPITE DO APORTE — nome + valor + recorrência (25/09/2026)
//
// **O pedido do dono:** *"palpite por nome+valor+recorrência como o do empréstimo"*.
//
// ⛔⛔ **E ELE HERDA A LIÇÃO DE HOJE DE MANHÃ, ANTES DE ERRAR:** o palpite de fatura casava
// por **2% do valor** e 17 de 18 apontavam pagamento de fornecedor. Aqui o valor é
// **EXATO** (só o centavo de arredondamento), e **o valor sozinho NUNCA basta** — tem que
// haver também sinal de NOME. *Diferença de centavos não compra identidade* (11/09), e
// parcela de consórcio tem exatamente a cara de um pagamento qualquer de mesmo valor.

import { normalizarBusca } from '@/lib/busca-texto'

/** dois centavos — arredondamento, não folga (o mesmo degrau `FECHA` de 24/09) */
const CENTAVO = 0.02

export interface ContratoParaPalpite {
  id: string
  nome: string
  tipo: string
  valorParcela: number
  diaDoMes: number
  bankAccountId: string | null
}

export interface LinhaParaPalpite {
  descricao: string
  valor: number
  data: Date
  bankAccountId: string | null
}

export interface PalpiteDeAporte {
  contractId: string
  nome: string
  competencia: string
  /** por que este contrato — a frase vai pra TELA (sugestão sem motivo não existe, 07/09) */
  porQue: string
  confianca: 'ALTA' | 'MEDIA'
}

/**
 * ⭐ As palavras que identificam a FAMÍLIA no extrato do banco.
 *
 * ⚠️ Lista FECHADA e por TIPO — inferir "é investimento" de qualquer texto seria a classe
 * do *"o memo diz Transferência"* (29/08): **heurística sobre texto livre pode SUGERIR,
 * nunca DECIDIR**, e aqui ela só entra como UM dos sinais.
 */
const PALAVRAS_DO_TIPO: Record<string, string[]> = {
  CONSORCIO: ['consorcio'],
  CAPITALIZACAO: ['capitalizacao', 'capitaliz'],
  OUTRO: [],
}

/** ⭐ o nome do contrato também conta: "Consórcio Randon" casa "CONSORCIO RANDON" no extrato */
function palavrasDoNome(nome: string): string[] {
  return normalizarBusca(nome).split(/\s+/).filter((p: string) => p.length >= 4)
}

/**
 * ⭐⭐ O PALPITE. Devolve `null` quando não sabe — **sem fallback**, a lição do
 * `resolvePaidInvoiceMonth` (16/09): *palpite com fallback é palpite inventado*.
 *
 * ⛔ **EMPATE NÃO ESCOLHE:** dois contratos igualmente plausíveis (o caso REAL da Caçula —
 * ela tem DOIS títulos de capitalização de R$ 297,84 debitados no mesmo dia) devolvem
 * `null`. *"Não sei qual é" é resposta* — a trava do PAO DE MEL.
 */
export function sugerirAporte(
  linha: LinhaParaPalpite,
  contratos: readonly ContratoParaPalpite[],
): PalpiteDeAporte | null {
  const desc = normalizarBusca(linha.descricao ?? '')
  if (!desc) return null

  const candidatos = contratos.filter((c) => {
    // (1) VALOR exato — a lição do palpite de fatura de hoje de manhã
    if (Math.abs(c.valorParcela - Math.abs(linha.valor)) > CENTAVO) return false
    // (2) NOME: a família do tipo OU uma palavra do nome do contrato
    const doTipo = (PALAVRAS_DO_TIPO[c.tipo] ?? []).some((p) => desc.includes(p))
    const doNome = palavrasDoNome(c.nome).some((p) => desc.includes(p))
    if (!doTipo && !doNome) return false
    // (3) CONTA: se o contrato declara a conta, ela tem que bater
    if (c.bankAccountId && linha.bankAccountId && c.bankAccountId !== linha.bankAccountId) return false
    return true
  })

  // ⛔ "não sei qual é" é resposta — e este empate ACONTECE na Caçula (2 títulos iguais)
  if (candidatos.length !== 1) return null
  const c = candidatos[0]

  /**
   * ⭐ A RECORRÊNCIA é o 3º sinal, e ela decide a CONFIANÇA, nunca a exclusão.
   * ⚠️ O banco atrasa: o consórcio da Caçula caiu dia 9, 10 e 11 em meses diferentes.
   * Exigir o dia cravado descartaria o caso comum.
   */
  const dia = linha.data.getUTCDate()
  const perto = Math.abs(dia - c.diaDoMes) <= 5 || Math.abs(dia - c.diaDoMes) >= 26
  const competencia = `${linha.data.getUTCFullYear()}-${String(linha.data.getUTCMonth() + 1).padStart(2, '0')}`

  return {
    contractId: c.id,
    nome: c.nome,
    competencia,
    porQue: `valor exato da parcela${perto ? ` · cai sempre por volta do dia ${c.diaDoMes}` : ''}`
      + ` · o nome bate com «${c.nome}»`,
    confianca: perto ? 'ALTA' : 'MEDIA',
  }
}
