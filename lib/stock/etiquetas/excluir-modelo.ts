// ⭐⭐ EXCLUIR MODELO — e as duas recusas que impedem a empresa de ficar sem etiqueta.
//
// ⚠️ REGRA DO DONO (01/09), levantada por ele antes de eu construir a lista: *"a lista
// precisa mostrar qual é o padrão E impedir excluir o padrão (ou o único modelo). Senão o
// próximo bug é a empresa ficar sem modelo nenhum."*
//
// ⛔ POR QUE ISSO SERIA GRAVE: sem modelo, `lerBlocos(null)` cai no `BLOCOS_PADRAO` de
// fábrica — a etiqueta continua saindo, mas **com o desenho de fábrica, não com o que o
// dono desenhou**, e sem nada na tela dizendo que trocou. É a falha silenciosa que este
// módulo mais combate.
//
// ⚠️ RECUSA COM MOTIVO, NUNCA BOTÃO CINZA MUDO: a mesma lição do "não declarou o total" e
// da caixa da chave — quem é recusado precisa saber o que fazer pra conseguir.

export type MotivoRecusa = 'E_O_PADRAO' | 'E_O_UNICO' | null

export interface ModeloParaExcluir {
  id: string
  nome: string
  padrao: boolean
}

/**
 * PURA. Pode excluir este modelo? Devolve o motivo da recusa, ou `null` se pode.
 *
 * ⚠️ A ordem importa: "é o único" é checado ANTES de "é o padrão", porque quando só há um
 * modelo as duas coisas são verdade e a mensagem útil é a do único (o dono precisa criar
 * outro, não apenas trocar o padrão).
 */
export function motivoParaNaoExcluir(alvo: ModeloParaExcluir, total: number): MotivoRecusa {
  if (total <= 1) return 'E_O_UNICO'
  if (alvo.padrao) return 'E_O_PADRAO'
  return null
}

/** a frase que a tela mostra — diz o que fazer, não só que não pode */
export function mensagemDeRecusa(motivo: MotivoRecusa, alvo: ModeloParaExcluir): string | null {
  if (motivo === 'E_O_UNICO') {
    return `“${alvo.nome}” é o único modelo da empresa — sem ele a etiqueta sairia com o ` +
      'desenho de fábrica, sem avisar. Crie outro antes de excluir este.'
  }
  if (motivo === 'E_O_PADRAO') {
    return `“${alvo.nome}” é o modelo PADRÃO — é ele que sai quando ninguém escolhe outro. ` +
      'Marque outro como padrão primeiro, aí este pode ser excluído.'
  }
  return null
}
