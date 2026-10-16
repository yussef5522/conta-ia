/**
 * ⚠️⚠️ **O DIA RACHADO — o par de relatórios que caiu em dois dias (16/10/2026).**
 *
 * O CASO REAL que criou esta régua: na madrugada de 16/10, à 1h da manhã, a cozinha subiu os
 * dois relatórios da sexta que **ainda não tinha aberto**. O de complementos foi apontado pro
 * dia 15 (R$ 769, só sabores) e o de produtos pro 16 (R$ 13.749). Resultado: **dois dias
 * meio-importados, lado a lado, e NENHUM selo dizendo que eles são o MESMO dia**.
 *
 * ⛔⛔ **A LEI DA DATA (`lei-da-data.ts`) FECHA ISSO NA ENTRADA; este arquivo é o ESPELHO.** Lá
 * o sistema PERGUNTA antes de gravar; aqui ele **ACHA o que já está gravado torto** — inclusive
 * os dias que entraram antes da lei existir. Os dois são necessários: trava na porta não
 * conserta o passado, e alarme no passado não impede o próximo.
 *
 * ⭐⭐ **A ASSINATURA É A COMPLEMENTARIDADE, nunca "o dia está incompleto".** Dia só com
 * complementos é defeito por si (e tem selo próprio, `PRODUTOS_NAO_IMPORTADOS`); o que
 * caracteriza o RACHO é ele ter, **no dia vizinho**, exatamente a metade que falta nele. Um dia
 * só-complementos com um vizinho COMPLETO não é racho — é arquivo que falta.
 *
 * ⛔ **ANTI-SPAM DA CASA: UM CASO, UM ALARME.** O par 15↔16 produz **UMA** entrada, ancorada no
 * dia dos PRODUTOS (o mais recente, o que o dono acabou de importar e é o suspeito de estar
 * datado pra frente). Marcar os dois faria o sininho e a central gritarem duas vezes pelo mesmo
 * fato — ***alarme que repete é alarme que se aprende a ignorar*** (os 111 falsos de 26/08).
 */

export interface DiaParaRacho {
  dia: string
  temProdutos: boolean
  temComplementos: boolean
}

export interface DiaRachado {
  /** ⭐ o dia que carrega o selo: o dos PRODUTOS (o mais recente do par) */
  dia: string
  /** o vizinho, que só tem os complementos */
  vizinho: string
  frase: string
}

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const DIA_MS = 86_400_000
/**
 * ⭐⭐ A VIZINHANÇA É GARANTIDA PELA **CONSTRUÇÃO**, não por uma comparação depois.
 *
 * O dia anterior é **calculado** (`dia − 1`) e procurado no mapa pela chave exata — então não
 * existe caminho em que um dia distante entre. ⚠️ A 1ª versão tinha um `if (!ehVizinho(a, b))`
 * a mais e a **REGRA 11 provou que ele não mordia**: removê-lo deixava os 16 testes VERDES.
 * ***Linha que não pode falhar é linha que finge ser trava*** — a cicatriz do `SELOS_QUE_PEDEM_ACAO`
 * como "cinto sobre suspensório" (08/10). O que morde é o teste do dia DISTANTE, que falha se
 * alguém trocar o cálculo por *"qualquer dia anterior presente no mapa"*.
 */
const diaAnterior = (dia: string) =>
  new Date(new Date(`${dia}T12:00:00Z`).getTime() - DIA_MS).toISOString().slice(0, 10)

/**
 * ⭐ Acha os pares `(dia só-complementos) → (dia seguinte só-produtos)`.
 *
 * ⚠️ A ordem importa e **não é simétrica de propósito**: o relatório de produtos chegando
 * **DEPOIS** é o caso real (o dia vira à meia-noite no meio do gesto). O inverso — produtos
 * num dia e complementos no dia SEGUINTE — não é racho de data: é alguém que importou o par de
 * amanhã, e isso a lei da data recusa na entrada (`FUTURO`).
 */
export function acharDiasRachados(dias: DiaParaRacho[]): DiaRachado[] {
  const porDia = new Map(dias.map((d) => [d.dia, d]))
  const saida: DiaRachado[] = []

  for (const d of [...dias].sort((a, b) => a.dia.localeCompare(b.dia))) {
    // o ANCORA é o dia só-produtos
    if (!d.temProdutos || d.temComplementos) continue

    const v = porDia.get(diaAnterior(d.dia))
    if (!v || v.temProdutos || !v.temComplementos) continue

    saida.push({
      dia: d.dia,
      vizinho: v.dia,
      frase:
        `⚠ dia rachado: o relatório de produtos entrou em ${ddmm(d.dia)} e o de sabores em ` +
        `${ddmm(v.dia)} — os dois parecem ser do MESMO dia. Confira a data de ${ddmm(d.dia)}: ` +
        `se o relatório é de ${ddmm(v.dia)}, reimporte-o nessa data.`,
    })
  }

  return saida
}
