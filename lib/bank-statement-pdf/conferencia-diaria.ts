// ⭐⭐⭐ CONFERÊNCIA DIA A DIA — o ledger contra o SALDO NA DATA do PDF (01/09/2026).
//
// ⛔ O QUE MOTIVOU, e é a terceira vez que um número declarado não é o que parece:
// o LEDGERBAL do OFX do Banrisul é o saldo **DISPONÍVEL**, já descontando o
// "(+) BLOQUEADO + 24 HS". O sistema ancorava nele e a conta mostrava **−6.267,03**
// enquanto o banco declarava **−4.567,03** de saldo contábil em 28/08 — um fantasma de
// **exatamente R$ 1.700,00**, com o ledger 100% correto o mês inteiro.
//
// ⭐ A REGRA DE CLASSE (dono, 01/09): **"saldo declarado pelo banco pode ser DISPONÍVEL,
// não contábil. Âncora de conciliação é o saldo contábil DIA A DIA, nunca um único saldo
// final."** É o 3º parser da série — Nubank (propaganda), Sicredi (rótulo repetido),
// Banrisul (bloqueio).
//
// ⭐ POR QUE DIA A DIA E NÃO UM SALDO SÓ: um saldo final que bate prova pouco — erros que
// se cancelam passam (foi o par ±2.178,67 do Stone). Fechando os 21 dias de agosto um a
// um, cada dia é uma equação independente; um lançamento a mais e um a menos em dias
// diferentes **não** se escondem.
//
// ⚠️ O SELO É POR DIA, NUNCA PELA CONTA (decisão do dono): agosto pode estar verde e
// setembro sem selo, e isso é o honesto — dizer "conta conferida" cobriria dia nenhum
// conferido de um período que o PDF não alcança.

/** Uma linha do nosso ledger, já com o sinal resolvido por `prepareBalanceTransactions`. */
export interface LancamentoSistema {
  id: string
  /** YYYY-MM-DD */
  data: string
  /** com sinal: negativo = saída */
  valor: number
  descricao: string
}

/** O que o banco declara: a abertura e o fecho de cada dia com movimento. */
export interface ReguaDoBanco {
  /** "SALDO ANT EM dd/mm" — a abertura. Sem ela não há de onde partir. */
  saldoAnterior: { data: string; valor: number } | null
  /** um "SALDO NA DATA" por dia, em ordem crescente */
  saldosDiarios: Array<{ data: string; valor: number }>
}

export interface DiaConferido {
  data: string
  /** SALDO NA DATA declarado */
  saldoBanco: number
  /** abertura + Σ do nosso ledger até este dia */
  saldoSistema: number
  /** sistema − banco. Positivo = temos a mais. */
  diferenca: number
  fecha: boolean
  /** quantos lançamentos NOSSOS caem neste dia (pra tela listar quando não fecha) */
  lancamentos: LancamentoSistema[]
}

export interface ResultadoConferencia {
  dias: DiaConferido[]
  /** ⭐ o dia em que o descolamento COMEÇOU — a pergunta que leva a uma ação */
  primeiroQueNaoFecha: DiaConferido | null
  todosFecham: boolean
  /** true = deu pra conferir (havia abertura e ao menos um dia declarado) */
  conferivel: boolean
  motivoNaoConferivel: string | null
}

const cent = (n: number) => Math.round((n + 1e-9) * 100) / 100

/**
 * PURA. Confere o nosso ledger contra a régua do banco, dia a dia.
 *
 * ⚠️ O BANCO SÓ LISTA DIA COM MOVIMENTO. Então cada dia declarado acumula tudo o que o
 * nosso ledger tem **desde o dia declarado anterior (exclusive) até ele (inclusive)** —
 * senão um lançamento nosso num sábado (que o banco não lista) apareceria como buraco.
 */
export function conferirDiaADia(
  banco: ReguaDoBanco,
  lancamentos: LancamentoSistema[],
): ResultadoConferencia {
  if (!banco.saldoAnterior) {
    return { dias: [], primeiroQueNaoFecha: null, todosFecham: false, conferivel: false,
      motivoNaoConferivel: 'o PDF não trouxe o "SALDO ANT EM" — sem abertura não dá pra conferir' }
  }
  if (!banco.saldosDiarios.length) {
    return { dias: [], primeiroQueNaoFecha: null, todosFecham: false, conferivel: false,
      motivoNaoConferivel: 'o PDF não trouxe nenhum "SALDO NA DATA"' }
  }

  const ordenados = [...banco.saldosDiarios].sort((a, b) => a.data.localeCompare(b.data))
  const dias: DiaConferido[] = []
  let saldo = banco.saldoAnterior.valor
  let anterior = banco.saldoAnterior.data

  for (const d of ordenados) {
    const doDia = lancamentos.filter((l) => l.data > anterior && l.data <= d.data)
    saldo = cent(saldo + doDia.reduce((s, l) => s + l.valor, 0))
    const diferenca = cent(saldo - d.valor)
    dias.push({
      data: d.data, saldoBanco: d.valor, saldoSistema: saldo,
      diferenca, fecha: Math.abs(diferenca) < 0.005, lancamentos: doDia,
    })
    anterior = d.data
    // ⚠️ SEGUE do saldo do BANCO, não do nosso: assim cada dia é uma equação independente
    // e um erro de um dia não contamina todos os seguintes (que viraria um borrão de
    // vermelhos e esconderia onde começou).
    saldo = d.valor
  }

  const primeiro = dias.find((d) => !d.fecha) ?? null
  return {
    dias, primeiroQueNaoFecha: primeiro, todosFecham: primeiro == null,
    conferivel: true, motivoNaoConferivel: null,
  }
}

/** A frase da tela quando um dia não fecha. Diz o dia, o valor e o que olhar. */
export function mensagemDoDia(d: DiaConferido): string {
  const brl = (n: number) => Math.abs(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const lado = d.diferenca > 0 ? 'a mais que o banco' : 'a menos que o banco'
  return `${d.data.slice(8, 10)}/${d.data.slice(5, 7)} não fecha: temos ${brl(d.diferenca)} ${lado} ` +
    `(nosso ${brl(d.saldoSistema)} × banco ${brl(d.saldoBanco)}), com ${d.lancamentos.length} lançamento(s) nossos no dia.`
}

/**
 * O saldo CONTÁBIL do último dia declarado — o número que a conta deve mostrar.
 * ⚠️ NÃO é o "SALDO DEVEDOR" do cabeçalho: aquele é o disponível, já sem o bloqueado.
 */
export function contabilMaisRecente(banco: ReguaDoBanco): { data: string; valor: number } | null {
  if (!banco.saldosDiarios.length) return null
  const ult = [...banco.saldosDiarios].sort((a, b) => a.data.localeCompare(b.data)).slice(-1)[0]
  return { data: ult.data, valor: ult.valor }
}
