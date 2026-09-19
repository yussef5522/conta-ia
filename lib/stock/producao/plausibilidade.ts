// ⭐⭐⭐ O GUARD DE PLAUSIBILIDADE DA CONCLUSÃO (19/09/2026).
//
// **O caso que pediu isto:** em 14/09 e 16/09 a cozinha fechou dois lotes de maionese com
// **22864** no lugar de **22,864** — e o sistema gravou calado. O estrago mediu:
//
// ```
// CUBA MAIONESE  rendimento 2855,50  (a média das outras: 2,85)   custo un R$ 0,01 (era 10,95)
// MAIONESE       rendimento 2858,00  (a média das outras: 2,858)  custo un R$ 0,01 (era  9,79)
// ```
//
// ⭐⭐ **O FATOR É EXATAMENTE MIL, e é isso que dá o nome à causa:** a balança da cozinha
// mostra **GRAMA** e o item é controlado em **KG**. Quem pesou leu `22864` no visor e
// digitou o que leu. *Não é erro de digitação aleatório: é unidade mental ≠ unidade de
// controle*, e por isso se repete.
//
// ⚠️⚠️ **E A DÍVIDA DO PARSE NÃO EXPLICAVA ESTE CASO — medido antes de escrever o guard:**
// `sanitizarQtd('22.864','KG')` devolve **22,864** e o parse próprio do tablet devolve
// **22.864** também. Os dois caminhos concordam; o que produz 22864 é digitar `22864` sem
// separador nenhum. *Costurar os parses é dívida legítima e não era a cura daqui.*
//
// ⛔ **POR QUE O RENDIMENTO É A RÉGUA, e não a quantidade:** "22864 é muito?" não tem
// resposta sem contexto — 22.864 unidades de porção é um dia normal. O que não existe é
// **mil vezes o rendimento histórico da MESMA ficha**. A régua compara o lote com ele
// mesmo no passado, que é o único número que sabe o tamanho daquela receita.

/** ⭐ o fator a partir do qual a casa PERGUNTA (10× a média já é estranho) */
export const FATOR_PERGUNTA = 10
/** ⛔ o fator a partir do qual a casa RECUSA sem confirmação (100× não é variação, é grandeza) */
export const FATOR_RECUSA = 100

export interface EstadoDaConclusao {
  qtdGerada: number
  rendimento: number
  /** média medida das conclusões anteriores DESTA ficha (null = sem histórico) */
  rendimentoMedio: number | null
  lotesNaMedia: number
  unidade: string
  nomeDoProduto: string
}

export interface VeredictoDaPlausibilidade {
  decisao: 'OK' | 'PERGUNTA' | 'RECUSA'
  fator: number | null
  /** ⭐ a leitura que explica o número, quando ela existe (grama lido como quilo) */
  suspeitaDeGrandeza: 'MIL_VEZES' | null
  mensagem: string | null
  /** o que o dono provavelmente quis dizer — SUGESTÃO, nunca aplicada sozinha */
  qtdProvavel: number | null
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * ⭐⭐ A DECISÃO, pura.
 *
 * ⛔ **Sem histórico não há régua, e a casa NÃO inventa uma.** Primeiro lote de uma ficha
 * passa — comparar com a escala teórica acusaria toda receita nova (é a lição dos 111
 * alarmes falsos: alarme que nasce ruidoso morre antes de servir).
 *
 * ⚠️ E a média precisa de **pelo menos 2 lotes**: com um só, um lote atípico vira a régua
 * e reprova o normal seguinte.
 */
export function avaliarPlausibilidade(e: EstadoDaConclusao): VeredictoDaPlausibilidade {
  const ok: VeredictoDaPlausibilidade = { decisao: 'OK', fator: null, suspeitaDeGrandeza: null, mensagem: null, qtdProvavel: null }
  if (!e.rendimentoMedio || e.rendimentoMedio <= 0 || e.lotesNaMedia < 2) return ok
  if (!(e.rendimento > 0)) return ok

  const fator = e.rendimento / e.rendimentoMedio
  if (fator < FATOR_PERGUNTA) return ok

  // ⭐ a assinatura de GRANDEZA: entre 500× e 2000× é grama lido como quilo (ou o inverso).
  // Faixa larga de propósito — o rendimento real oscila, então 1000 exato quase nunca sai.
  const milVezes = fator >= 500 && fator <= 2000
  const provavel = milVezes ? round3(e.qtdGerada / 1000) : null

  const quanto = fator >= 1000 ? `${Math.round(fator)}×` : `${fator.toFixed(fator < 100 ? 1 : 0)}×`
  const base = `«${e.nomeDoProduto}»: ${e.qtdGerada} ${e.unidade} dá ${quanto} o rendimento dos últimos ${e.lotesNaMedia} lotes desta receita.`
  const pista = milVezes
    ? ` Isso tem cara de **grama lido como ${e.unidade}** — ${e.qtdGerada} g é ${provavel} ${e.unidade}. Se foi isso, digite ${String(provavel).replace('.', ',')}.`
    : ''

  if (fator >= FATOR_RECUSA) {
    return { decisao: 'RECUSA', fator, suspeitaDeGrandeza: milVezes ? 'MIL_VEZES' : null, qtdProvavel: provavel,
      mensagem: `${base}${pista} Confira o número antes de fechar — se estiver certo mesmo, confirme a grandeza.` }
  }
  return { decisao: 'PERGUNTA', fator, suspeitaDeGrandeza: milVezes ? 'MIL_VEZES' : null, qtdProvavel: provavel,
    mensagem: `${base}${pista} Confirme que é isso mesmo.` }
}
