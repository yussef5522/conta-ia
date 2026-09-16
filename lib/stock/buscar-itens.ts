// ⭐⭐ A BUSCA DE ITEM DO ESTOQUE — o universo no TIPO (16/09/2026).
//
// **A régua do dono:** *"o seletor recebe o UNIVERSO como contrato obrigatório (sem
// default silencioso — chamador que não declara não compila)"*.
//
// ⛔ **É aqui que o "não compila" acontece.** O 400 da rota é a rede; este tipo é a trava:
// `universo` não é opcional, então esquecer vira **erro de build**, não uma lista
// plausível e errada na cara do dono.

import type { UniversoDoSeletor } from './universo-do-seletor'

export interface ItemDoSeletor {
  id: string
  nome: string
  unidadeControle: string
  categoria: string
  custoMedio?: number | null
  /** ⭐ o apelido que a busca também acha (o nome anterior, de 09/09) */
  nomeAnterior?: string | null
}

export interface BuscaDeItens {
  empresaId: string
  /** ⛔ OBRIGATÓRIO — o gesto declara o seu universo (ver `universo-do-seletor.ts`) */
  universo: UniversoDoSeletor
  busca?: string
  /** ⚠️ recorte a mais DENTRO do universo (o hub usa pra listar só revenda) */
  categoria?: string
}

/** ⭐ a URL da listagem — um lugar só, com o universo sempre presente */
export function urlDaBuscaDeItens(p: BuscaDeItens): string {
  const qs = new URLSearchParams({ universo: p.universo })
  if (p.busca) qs.set('busca', p.busca)
  if (p.categoria) qs.set('categoria', p.categoria)
  return `/api/empresas/${p.empresaId}/estoque/itens?${qs.toString()}`
}

/**
 * ⚠️ NUNCA LANÇA — devolve lista vazia e o motivo. Busca que estoura derruba o seletor
 * inteiro, e aí o dono não consegue nem escolher outro item (a lição do spinner eterno).
 */
export async function buscarItensDoEstoque(p: BuscaDeItens): Promise<{ itens: ItemDoSeletor[]; erro: string | null }> {
  try {
    const r = await fetch(urlDaBuscaDeItens(p))
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return { itens: [], erro: j?.erro ?? 'Não consegui carregar a lista de itens.' }
    return { itens: j.itens ?? [], erro: null }
  } catch {
    return { itens: [], erro: 'A rede falhou ao carregar os itens — tente de novo.' }
  }
}
