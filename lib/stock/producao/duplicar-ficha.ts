// ⭐⭐ DUPLICAR FICHA — o que a cópia HERDA e o que ela NÃO herda (02/09/2026).
//
// Padrão do modelo de etiqueta, nas palavras do dono: *"criar um NOVO com o conteúdo deste.
// Nada é sobrescrito."*
//
// ⚠️ POR QUE ISTO É UMA LIB E NÃO UM `useState` NO EDITOR: a lição do prefill do cardápio —
// *regra que mora num `useState` é regra que ninguém prova* (o projeto roda em
// `environment: node`, sem jsdom). A decisão fica aqui, pura; o componente só ecoa.
//
// ⭐ POR QUE DUPLICAR EXISTE: os ~50 sabores de pizza se agrupam em FAMÍLIAS — 14 variações
// de FILE, 8 de FRANGO — e cada variação é "a mesma porção + um acabamento". Do zero seriam
// 50 montagens; duplicando, 8 montagens e 42 ajustes de um componente.

export interface FichaParaCopiar {
  nomeProduzido: string
  unidadeProduzido: string
  tipoProduto: string
  setorId?: string | null
  valorVenda?: number | null
  loteBase: number
  unidadeLoteBase: string
  validadeDias?: number | null
  tempoPreparoMin?: number | null
  modoPreparo?: string | null
  componentes: { itemId: string; nome: string; unidade: string; qtdPlanejada: number; custoMedio: number | null; unidadeControle: string }[]
}

export interface CamposDaCopia extends Omit<FichaParaCopiar, 'nomeProduzido'> {
  nomeProduzido: string
  /**
   * ⛔⛔ SEMPRE null, e não é conservadorismo — é correção.
   *
   * O mapa do PDV é `@@unique(companyId, nomeSuitable)` e a gravação usa UPSERT: herdar o
   * mapeamento faria a cópia **roubar as baixas da original**, em silêncio, sem erro nenhum
   * na tela. O dono aponta o destino da cópia depois, na prateleira.
   */
  mapearComplemento: null
  mapearNomeSuitable: null
}

/** Sufixo da cópia: duas fichas ATIVAS com o mesmo nome são recusadas na gravação. */
export const SUFIXO_COPIA = ' (cópia)'

/**
 * O conteúdo da nova ficha a partir de uma existente.
 *
 * @param nomeEscolhido nome que o contexto já decidiu (ex.: o complemento que veio no link).
 *        Vazio/ausente → `<original> (cópia)`, pra o dono trocar antes de salvar.
 */
export function camposDaCopia(f: FichaParaCopiar, nomeEscolhido?: string | null): CamposDaCopia {
  const nome = (nomeEscolhido ?? '').trim()
  return {
    // ⚠️ o NOME é o único campo que NÃO se herda cru — herdar garante erro de duplicidade.
    nomeProduzido: nome || `${f.nomeProduzido}${SUFIXO_COPIA}`,
    unidadeProduzido: f.unidadeProduzido,
    tipoProduto: f.tipoProduto,
    setorId: f.setorId ?? null,
    valorVenda: f.valorVenda ?? null,
    loteBase: f.loteBase,
    unidadeLoteBase: f.unidadeLoteBase,
    validadeDias: f.validadeDias ?? null,
    tempoPreparoMin: f.tempoPreparoMin ?? null,
    modoPreparo: f.modoPreparo ?? null,
    // ⭐ os componentes vêm INTEIROS — é o motivo de duplicar existir.
    componentes: f.componentes.map((c) => ({ ...c })),
    mapearComplemento: null,
    mapearNomeSuitable: null,
  }
}
