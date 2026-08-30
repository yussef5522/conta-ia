// ⭐⭐ AJUSTE MANUAL DE QUANTIDADE NUNCA MUDA SÓ A QUANTIDADE (30/08/2026).
//
// O CASO QUE PEDIU ISTO (o dono, com todas as letras): *"fui eu: ajustei manual a
// quantidade pra 360 (12 cartelas × 30 ovos, a conta certa) — e o sistema manteve o custo
// POR CARTELA (18,00) em cada OVO: 360 × 18 = 6.480 por nota"*. R$ 12.528 de estoque que
// não existe, em duas notas.
//
// ⚠️ A RAIZ É MAIS SUTIL DO QUE "faltou perguntar": o campo de FATOR de conversão só
// aparecia quando a unidade da nota (`uCom`) era DIFERENTE da unidade de controle. No ovo
// as duas são "UN" — cartela UN e ovo UN — então **o caminho certo estava invisível** e
// só sobrou o campo de quantidade. Por isso o gatilho aqui é a RAZÃO entre as
// quantidades, não a diferença de unidade.
//
// ⭐ AS DUAS LEITURAS SÃO LEGÍTIMAS, e só o dono sabe qual é:
//   (a) CONVERSÃO de unidade  → o valor total fica INTACTO, o custo unitário se divide
//   (b) QUANTIDADE REAL diferente (recebi mais/menos, correção) → o valor MUDA
// O sistema mostra o número das duas e pergunta. Escolher por ele é o que criou o
// fantasma — e é a mesma regra do módulo inteiro: *sugere, o dono decide*.

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface OpcaoAjuste {
  /** rótulo curto pro botão */
  titulo: string
  /** o que acontece, em uma frase */
  explicacao: string
  fatorConversao: number
  custoUnitario: number
  /** o valor que ENTRA no estoque por esta linha */
  valorTotal: number
}

export interface AjusteQuantidade {
  mudou: boolean
  qtdNota: number
  qtdRecebida: number
  /** quantas vezes a quantidade foi multiplicada (360/12 = 30) */
  razao: number | null
  /**
   * a razão parece uma CONVERSÃO de embalagem? (múltiplo inteiro ≥ 2, ou submúltiplo)
   * ⚠️ é só pra ORDENAR as opções na tela — nunca pra decidir sozinho.
   */
  pareceConversao: boolean
  conversao: OpcaoAjuste | null
  quantidadeReal: OpcaoAjuste
  /** o valor que a NOTA declara pra esta linha (a âncora das duas contas) */
  valorDaNota: number
}

const quaseInteiro = (n: number) => Math.abs(n - Math.round(n)) < 1e-6

/**
 * PURA. Dada a linha da nota e a quantidade que o dono digitou, devolve as DUAS leituras
 * com os números feitos — pra a tela mostrar lado a lado e ele escolher.
 */
export function interpretarAjusteQtd(input: {
  qtdNota: number
  qtdRecebida: number
  /** valor unitário comercial da nota (por CARTELA, no caso do ovo) */
  vUnCom: number
  /** fator já aprendido pra este produto (default 1) */
  fatorAtual?: number
}): AjusteQuantidade {
  const { qtdNota, qtdRecebida, vUnCom } = input
  const fatorAtual = input.fatorAtual || 1
  const valorDaNota = round2(qtdNota * vUnCom)
  const mudou = Math.abs(qtdRecebida - qtdNota) > 1e-9
  const razao = qtdNota > 0 ? qtdRecebida / qtdNota : null

  // (b) QUANTIDADE REAL — o custo por unidade não muda; o valor acompanha a quantidade.
  const custoB = vUnCom / fatorAtual
  const quantidadeReal: OpcaoAjuste = {
    titulo: 'Recebi uma quantidade diferente',
    explicacao:
      `Cada unidade continua custando ${custoB.toFixed(2)} — o valor que entra no estoque ` +
      `${qtdRecebida > qtdNota ? 'sobe' : 'desce'} pra ${round2(qtdRecebida * custoB).toFixed(2)} ` +
      `(a nota diz ${valorDaNota.toFixed(2)}). Use quando chegou mais ou menos mercadoria do que a nota.`,
    fatorConversao: fatorAtual,
    custoUnitario: custoB,
    valorTotal: round2(qtdRecebida * custoB),
  }

  // (a) CONVERSÃO — só existe quando a razão faz sentido como embalagem.
  let conversao: OpcaoAjuste | null = null
  if (mudou && razao && razao > 0 && qtdRecebida > 0) {
    // ⭐ o custo se DIVIDE pela mesma razão que a quantidade multiplicou → valor intacto.
    // ⚠️ precisão CHEIA: 18/30 = 0,60 fecha, mas 27,75/12 = 2,3125 não cabe em 2 casas —
    // arredondar aqui é literalmente o bug que este módulo já pagou duas vezes.
    const custoA = valorDaNota / qtdRecebida
    conversao = {
      titulo: 'É a mesma mercadoria em outra unidade',
      explicacao:
        `O valor total NÃO muda: continua ${valorDaNota.toFixed(2)}, e cada unidade passa a ` +
        `custar ${custoA.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}. ` +
        `Use quando 1 ${qtdNota === 1 ? 'embalagem' : 'unidade da nota'} contém ${razao.toFixed(razao % 1 === 0 ? 0 : 2)} do que você controla ` +
        `(ex: 1 cartela = 30 ovos).`,
      fatorConversao: razao,
      custoUnitario: custoA,
      valorTotal: valorDaNota, // ⭐ a invariante: o dinheiro da nota é o dinheiro do estoque
    }
  }

  return {
    mudou,
    qtdNota,
    qtdRecebida,
    razao,
    // múltiplo inteiro ≥ 2 (12 → 360) ou submúltiplo exato (30 → 1)
    pareceConversao: !!razao && razao !== 1 && (quaseInteiro(razao) ? razao >= 2 : quaseInteiro(1 / razao)),
    conversao,
    quantidadeReal,
    valorDaNota,
  }
}
