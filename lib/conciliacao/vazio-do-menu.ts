// ⭐⭐ O QUE O MENU DIZ QUANDO NÃO TEM O QUE MOSTRAR (18/09/2026).
//
// **A ordem do dono:** *"vazio LEGÍTIMO diz por quê («nenhum contrato ativo nesta empresa»)
// em vez de silêncio."*
//
// ⛔⛔ E há um estado pior que o silêncio: a **afirmação falsa**. As listas do menu carregam
// com falha macia — chamada morreu, o estado fica `[]` — e a frase *"nenhum contrato com
// parcela em aberto"* passava a **afirmar sobre a empresa** a partir de uma falha de rede.
// *Erro disfarçado de vazio.* Aqui os três estados têm três frases diferentes.

export type EstadoDaCarga = 'CARREGANDO' | 'OK' | 'FALHOU'

export interface FraseDoVazio {
  texto: string
  /** ⭐ tom: o que FALHOU pede ação; o vazio legítimo é só informação */
  tom: 'NEUTRO' | 'ALERTA'
}

/**
 * ⭐ A frase do menu vazio, pelos três estados.
 *
 * ⚠️ `OK` + lista vazia é a única situação em que dá pra afirmar algo sobre a empresa —
 * e é a única em que a frase fala dela.
 */
export function fraseDoVazio(estado: EstadoDaCarga, oQue: string): FraseDoVazio {
  if (estado === 'CARREGANDO') return { texto: `carregando ${oQue}…`, tom: 'NEUTRO' }
  if (estado === 'FALHOU') {
    return { texto: `Não consegui carregar ${oQue} — recarregue a página e tente de novo.`, tom: 'ALERTA' }
  }
  return { texto: `Nenhum item em ${oQue} nesta empresa.`, tom: 'NEUTRO' }
}

/** ⭐ as frases de cada gesto, num lugar só — e só a de `OK` fala da empresa */
export const VAZIO = {
  categorias: (e: EstadoDaCarga): FraseDoVazio =>
    e === 'OK' ? { texto: 'Nenhuma categoria ativa nesta empresa.', tom: 'NEUTRO' } : fraseDoVazio(e, 'as categorias'),
  cartoes: (e: EstadoDaCarga): FraseDoVazio =>
    e === 'OK' ? { texto: 'Nenhum cartão cadastrado nesta empresa.', tom: 'NEUTRO' } : fraseDoVazio(e, 'os cartões'),
  contratos: (e: EstadoDaCarga): FraseDoVazio =>
    e === 'OK' ? { texto: 'Nenhum contrato com parcela em aberto nesta empresa.', tom: 'NEUTRO' } : fraseDoVazio(e, 'os contratos'),
}
