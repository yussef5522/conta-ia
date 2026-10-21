/**
 * ⭐⭐⭐ O DESTINO DA LINHA DA NOTA — "isto é estoque, ou não é?" (20/10/2026)
 *
 * **O caso que pariu o arquivo:** a NF da BOLEADORA BOL600 (1 UN, R$ 21.000) parada no
 * funil. O funil só oferecia CATEGORIAS DE ESTOQUE (matéria-prima / revenda / embalagem /
 * limpeza / uso interno), e `sugerirCategoria` cai em `USO_INTERNO` quando nada casa — então
 * **o balde onde equipamento cai hoje é por construção**. Classificado ali, ele nasce com
 * POSIÇÃO, entra no custo médio e polui toda tela de estoque.
 *
 * ═══ ⛔⛔⛔ POR QUE `EQUIPAMENTO` **NÃO** É UMA 6ª CATEGORIA ═══
 *
 * `CategoriaEstoque` responde *"QUE ITEM DE ESTOQUE é este?"*. Equipamento responde
 * *"NENHUM — isto não é estoque"*. São duas perguntas, e enfiá-las no mesmo campo é
 * **exatamente o bug do `tipoProduto` de 03/09**, que respondia *"como isto baixa na venda?"*
 * e *"isto aparece na cozinha?"* ao mesmo tempo — e por isso o sabor CALABRESA foi parar no
 * meio das receitas da produção.
 *
 * ⚠️ **E o custo seria pior aqui.** Com `EQUIPAMENTO` dentro do enum, **todo leitor de
 * estoque teria que APRENDER a excluí-la** — a Posição, a contagem, o custo médio, o Real vs
 * Teórico, o Radar, a busca de ingrediente, o CMV. E **o primeiro que esquecesse criaria
 * posição de uma máquina**, em silêncio.
 *
 * ⭐⭐ Como DESTINO, o guard do brief (*"essa categoria NUNCA gera posição"*) deixa de ser
 * uma checagem a lembrar e vira **IMPOSSIBILIDADE POR CONSTRUÇÃO** (REGRA 5): o
 * `confirmarConferencia` parte as linhas em duas listas no topo, e **o laço que cria item e
 * movimento só vê a lista de ESTOQUE**. Não existe `if` pra alguém remover.
 *
 * ═══ ⛔ O DESTINO É FATO GRAVADO, NUNCA INFERIDO DE `itemId == null` ═══
 *
 * A linha de equipamento tem uma linha em `stock_equipamento` **apontando pra ela**, e os
 * invariantes perguntam por esse FATO. Derivar de *"a conferência não tem item"* seria
 * **ausência virando estado** — a doença do `?? 'CAIXA'` que sumiu com o CASPER (20/09) e do
 * `'categoryId' in t` que era verdade com valor nulo (26/08). *Default que resolve é default
 * que esconde.*
 *
 * ═══ ⚠️ ESTE ARQUIVO É PURO ═══
 *
 * Zero import de `prisma`. A régua que a tela desenha, a gravação executa e os invariantes
 * descontam é a MESMA função — se ela precisasse de banco, a tela montaria a lista do funil
 * à mão e as duas divergiriam no primeiro destino novo.
 */

import { CATEGORIAS_ESTOQUE, type CategoriaEstoque } from './sugestoes'

export const DESTINO_ESTOQUE = 'ESTOQUE' as const
export const DESTINO_EQUIPAMENTO = 'EQUIPAMENTO' as const

/**
 * ⛔ UNIÃO FECHADA: destino novo **não compila** sem passar por todos os `switch` que o
 * consomem. É o que impede um terceiro destino de nascer tratado como estoque por omissão.
 */
export type DestinoDaLinha = typeof DESTINO_ESTOQUE | typeof DESTINO_EQUIPAMENTO

export const DESTINOS: readonly DestinoDaLinha[] = [DESTINO_ESTOQUE, DESTINO_EQUIPAMENTO]

/**
 * O valor que o `<select>` do funil manda quando o dono escolhe equipamento.
 *
 * ⚠️ Os sublinhados existem pra ele **nunca colidir** com uma `CategoriaEstoque` — o campo
 * do banco é String livre, e um dia alguém pode cadastrar uma categoria nova.
 */
export const VALOR_EQUIPAMENTO_NO_FUNIL = '__EQUIPAMENTO__'

export interface OpcaoDoFunil {
  /** o `value` do `<option>` */
  valor: string
  rotulo: string
  destino: DestinoDaLinha
  /** só pra destino ESTOQUE */
  categoria: CategoriaEstoque | null
}

const ROTULO_DA_CATEGORIA: Record<CategoriaEstoque, string> = {
  MATERIA_PRIMA: 'Matéria-prima',
  REVENDA: 'Revenda (bebida, etc.)',
  EMBALAGEM: 'Embalagem',
  LIMPEZA: 'Limpeza',
  USO_INTERNO: 'Uso interno',
}

/**
 * ⭐ A LISTA QUE A TELA DESENHA — fonte única.
 *
 * ⚠️ Equipamento vem **POR ÚLTIMO e separado**: ele não é "mais uma categoria de estoque",
 * e pôr no meio das cinco convidaria a ler como se fosse. O rótulo diz o que ele FAZ
 * (*investimento*), porque é isso que muda no bolso do dono — não vira custo do mês.
 */
export const OPCOES_DO_FUNIL: readonly OpcaoDoFunil[] = [
  ...CATEGORIAS_ESTOQUE.map((c) => ({
    valor: c,
    rotulo: ROTULO_DA_CATEGORIA[c],
    destino: DESTINO_ESTOQUE,
    categoria: c,
  })),
  {
    valor: VALOR_EQUIPAMENTO_NO_FUNIL,
    rotulo: '🏭 Equipamento (investimento)',
    destino: DESTINO_EQUIPAMENTO,
    categoria: null,
  },
]

export interface EscolhaDoFunil {
  destino: DestinoDaLinha
  /** `null` quando o destino não é estoque — não existe categoria de prateleira pra máquina */
  categoria: CategoriaEstoque | null
}

/**
 * Traduz o que veio do `<select>`.
 *
 * ⚠️ Valor desconhecido cai em **ESTOQUE com a categoria default**, nunca em equipamento: o
 * erro seguro é a linha aparecer na prateleira (o dono vê e corrige); o inseguro é uma
 * compra de mercadoria virar imobilizado e **sair do custo do mês em silêncio**.
 */
export function escolhaDoFunil(valor: string | null | undefined): EscolhaDoFunil {
  if (valor === VALOR_EQUIPAMENTO_NO_FUNIL) {
    return { destino: DESTINO_EQUIPAMENTO, categoria: null }
  }
  const achou = OPCOES_DO_FUNIL.find((o) => o.valor === valor && o.destino === DESTINO_ESTOQUE)
  return { destino: DESTINO_ESTOQUE, categoria: achou?.categoria ?? 'USO_INTERNO' }
}

/** O destino de uma linha que já carrega o campo (ausente = o caminho de sempre). */
export function destinoDaLinha(linha: { destino?: DestinoDaLinha | null }): DestinoDaLinha {
  return linha.destino === DESTINO_EQUIPAMENTO ? DESTINO_EQUIPAMENTO : DESTINO_ESTOQUE
}

export function ehEquipamento(destino: DestinoDaLinha | null | undefined): boolean {
  return destino === DESTINO_EQUIPAMENTO
}

/**
 * ⭐⭐ O GUARD DO BRIEF, com nome: *"essa categoria NUNCA gera posição"*.
 *
 * ⛔ Quem o faz valer é a **separação das listas** no `confirmarConferencia` — esta função é
 * o nome da régua, consumida por quem precisa PERGUNTAR (a tela, o preview). **Ela não é a
 * trava**: trava que depende de alguém chamá-la é combinado, não construção.
 */
export function geraPosicaoDeEstoque(destino: DestinoDaLinha): boolean {
  switch (destino) {
    case DESTINO_ESTOQUE:
      return true
    case DESTINO_EQUIPAMENTO:
      return false
  }
}

/**
 * ⭐⭐ A CATEGORIA FINANCEIRA — e ela é **DECLARAÇÃO, não inferência** (o raciocínio de 06/10).
 *
 * O dono escolheu "🏭 Equipamento (investimento)" no funil; gravar
 * `Equipamentos (investimento)` na conta a pagar é **repetir a decisão dele**, nunca adivinhar
 * pelo memo do banco. É a mesma régua de *"categoria é decisão do dono"* (17/08), do lado
 * certo: aqui a decisão existe e está registrada.
 *
 * ⛔⛔ **E SÓ QUANDO TODAS AS LINHAS SÃO EQUIPAMENTO.** Nota mista (uma máquina + três caixas
 * de embalagem) **fica sem categoria**, exatamente como hoje — porque a conta a pagar é UMA
 * pra a nota inteira, e marcá-la de investimento tiraria a embalagem do custo do mês em
 * silêncio. ⭐ E a tela **DIZ por quê**: *número sem régua em tela de dinheiro é pior que
 * ausência*.
 */
export const CATEGORIA_FINANCEIRA_EQUIPAMENTO = 'Equipamentos (investimento)'

/**
 * ⚠️ `INVESTIMENTOS` é **NÃO-DRE** (`NON_DRE_GROUPS` em `lib/dre/types.ts`) — é isso que
 * cumpre o requisito de Lucro Real do brief: **imobilizado não é despesa**, então a compra da
 * boleadora não come o lucro do mês.
 */
export const DRE_GROUP_EQUIPAMENTO = 'INVESTIMENTOS'

export function notaInteiraEhEquipamento(
  linhas: readonly { destino?: DestinoDaLinha | null }[],
): boolean {
  // ⚠️ nota sem linha nenhuma não é "nota de equipamento" — é nota sem item parseado
  return linhas.length > 0 && linhas.every((l) => ehEquipamento(destinoDaLinha(l)))
}
