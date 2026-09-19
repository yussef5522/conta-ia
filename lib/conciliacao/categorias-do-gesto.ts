// ⭐⭐⭐ O UNIVERSO DO GESTO "CLASSIFICAR A SAÍDA" (17/09/2026).
//
// **O dono, no PIX de R$ 500 pra FRANCIELE:** *"o PIX pra uma pessoa que é a retirada do
// dono não tem onde morar. O gesto é «classificar a saída», e saída de sócio é classe
// legítima — não é despesa operacional, mas É um destino. **Nunca forçar retirada a virar
// despesa pra caber no menu.**"*
//
// ⚠️⚠️ **E A MEDIÇÃO CONTRARIOU A HIPÓTESE ÓBVIA.** A aposta era *"o seletor filtra só
// EXPENSE e por isso a retirada some"*. Medido em prod, as 5 categorias de retirada da
// Caçula **JÁ SÃO `type: 'EXPENSE'`** (com `dreGroup: 'DISTRIBUICAO_LUCROS'`, fora do DRE):
//
//   EXPENSE · DISTRIBUICAO_LUCROS · Distribuição de Lucros
//   EXPENSE · DISTRIBUICAO_LUCROS · Pró-labore Sócios
//   EXPENSE · DISTRIBUICAO_LUCROS · Retirada de Lucros / Pró-labore   (+2)
//
// ⛔ Ou seja: o filtro **não** as excluía. O que as escondia era o **menu** — 50 opções de
// despesa numa lista chapada, sem dizer que aquelas cinco são outra classe de dinheiro.
// *Item que existe e ninguém acha é item que não existe* — a mesma família da maçaneta.
//
// ⭐ **A CURA É NOMEAR A CLASSE, NUNCA RECLASSIFICAR O DADO.** O menu ganha a seção
// **«💰 retirada / distribuição de lucros»** ao lado de **«despesa operacional»**, e a
// separação sai do `dreGroup` que o dono já decidiu — nada é movido de grupo, nada vira
// despesa pra caber. *Categoria é decisão do dono* (a régua de 17/08).

/** ⚠️ `dreGroup` é o que separa retirada de despesa — NUNCA o nome da categoria. */
export const GRUPO_RETIRADA = 'DISTRIBUICAO_LUCROS'

/** a fila de triagem nunca é DESTINO — escolher "a classificar" não classifica nada */
export const GRUPO_A_CLASSIFICAR = 'A_CLASSIFICAR'

export interface CategoriaDoMenu {
  id: string
  name: string
  type: string
  dreGroup?: string | null
}

export interface SecaoDoMenu {
  /** rótulo da seção como o dono lê */
  titulo: string
  /** ⭐ a frase que diz o que aquela classe É — sem ela a seção vira enfeite */
  ajuda?: string
  itens: CategoriaDoMenu[]
}

const porNome = (a: CategoriaDoMenu, b: CategoriaDoMenu) => a.name.localeCompare(b.name, 'pt-BR')

/**
 * ⭐⭐ AS SEÇÕES DO MENU DE UMA LINHA.
 *
 * **SAÍDA** → `despesa operacional` + `retirada / distribuição de lucros`.
 * **ENTRADA** → as de receita, com `aporte / liberação` separado do faturamento — pela
 * mesma régua e pelo mesmo motivo: *dívida e capital entrando não são venda* (25/08).
 *
 * ⛔ **Seção VAZIA não aparece.** Cabeçalho sobre lista vazia é a tela prometendo um
 * destino que ela não tem.
 */
export function secoesDoMenu(
  categorias: readonly CategoriaDoMenu[],
  sentido: 'SAIDA' | 'ENTRADA',
): SecaoDoMenu[] {
  const ativas = categorias.filter((c) => c.dreGroup !== GRUPO_A_CLASSIFICAR)

  if (sentido === 'SAIDA') {
    const saidas = ativas.filter((c) => c.type === 'EXPENSE')
    const retirada = saidas.filter((c) => c.dreGroup === GRUPO_RETIRADA).sort(porNome)
    const despesa = saidas.filter((c) => c.dreGroup !== GRUPO_RETIRADA).sort(porNome)
    return [
      // ⭐ a retirada vem PRIMEIRO de propósito: é a classe que o dono não achava
      { titulo: '💰 retirada / distribuição de lucros', ajuda: 'dinheiro do sócio — não é despesa operacional e fica fora do DRE', itens: retirada },
      { titulo: '🏷 despesa operacional', itens: despesa },
    ].filter((s) => s.itens.length > 0)
  }

  const entradas = ativas.filter((c) => c.type === 'INCOME')
  const aporte = entradas.filter((c) => c.dreGroup === 'APORTES_CAPITAL').sort(porNome)
  const receita = entradas.filter((c) => c.dreGroup !== 'APORTES_CAPITAL').sort(porNome)
  return [
    { titulo: '🏷 receita', itens: receita },
    { titulo: '🏦 aporte / liberação de empréstimo', ajuda: 'entra no caixa e não é venda — fica fora da receita', itens: aporte },
  ].filter((s) => s.itens.length > 0)
}

/** ⭐ quantas opções o menu oferece de fato — o número que o guard cobra */
export function totalDeOpcoes(secoes: readonly SecaoDoMenu[]): number {
  return secoes.reduce((n, s) => n + s.itens.length, 0)
}
