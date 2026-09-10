// ⭐⭐⭐ AS TRÊS FILAS DA TELA — UMA FUNÇÃO, TRÊS NÚMEROS (10/09/2026).
//
// **O dono, pedindo os stats do mock:** *"são as três filas REAIS da tela, com os números
// derivados delas (badge e stats da mesma função, como sempre)."*
//
// ⛔⛔ E A MEDIÇÃO ACHOU A DIVERGÊNCIA QUE ELE ESTAVA PREVENINDO: o badge do menu contava
// `contas.filter(c => c.sugestoes.length > 0)` — **os pares 1:1, sem os LOTES**. A seção
// "prontos pra confirmar" renderiza os dois. Ou seja, o menu já dizia um número e a tela
// mostrava outro, exatamente o defeito que o cabeçalho de 07/09 existiu pra matar (*"69
// duplicatas" com a aba dizendo 0*). Agora os dois passam por aqui.
//
// ⚠️ FUNÇÃO PURA, recebendo o que a tela JÁ tem: contar de novo com query própria seria a
// segunda derivação — a doença que este módulo mais paga.

export interface ContagemDasFilas {
  /** lotes sugeridos + pares 1:1 — o que a seção "prontos pra confirmar" desenha */
  prontosPraConfirmar: number
  /** as linhas que nomeiam fornecedor e NÃO fecham — os cards do "escolher na mão" */
  praTuaMao: number
  /** contas em aberto sem nenhuma linha no extrato */
  semPagamento: number
  /** ⚠️ anomalia, não fila: só aparece na tela quando > 0 */
  duplaContagem: number
  valorEmDuplaContagem: number
}

export function contarFilas(x: {
  lotes: number
  paresUmPraUm: number
  naoFecham: number
  semPar: number
  duplaContagem: number
  valorEmDuplaContagem: number
}): ContagemDasFilas {
  return {
    prontosPraConfirmar: x.lotes + x.paresUmPraUm,
    praTuaMao: x.naoFecham,
    semPagamento: x.semPar,
    duplaContagem: x.duplaContagem,
    valorEmDuplaContagem: x.valorEmDuplaContagem,
  }
}
