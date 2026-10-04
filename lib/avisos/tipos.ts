/**
 * ⭐⭐ O VOCABULÁRIO DA CENTRAL DE AVISOS (04/10/2026).
 *
 * ⚠️ Vive aqui, e **não no CHECK do banco**: é a cicatriz de 21/09, em que o
 * `CHECK (lista IN ('CAROS','PORCOES'))` virou PAREDE um dia depois, quando o dono pediu a 3ª
 * lista. Setor novo (`fiscal`, `cozinha`) se resolve editando um array; o banco só garante a
 * FORMA (minúsculo, não-vazio).
 */

/**
 * ⛔⛔ **LEI DO DONO: `financeiro` NUNCA aparece na produção.** O setor não é etiqueta
 * decorativa — é o filtro do bloco por tela, e é ele que torna a lei aplicável em vez de
 * combinada. `sistema` é o balde do que não é de setor nenhum (certificado vencendo, cron
 * parado): ele aparece no SININHO e em nenhum bloco de setor.
 */
export const SETORES = ['producao', 'estoque', 'financeiro', 'sistema'] as const
export type Setor = (typeof SETORES)[number]

/**
 * A severidade é o FILETE de cor, e a escada é a da casa:
 * **vermelho** = dado impossível / dinheiro errado agora ·
 * **coral** = algo parado que devia andar (a linguagem da ordem atrasada) ·
 * **ambar** = fora da régua, pede olho ·
 * **azul** = informação que pede uma decisão, sem urgência ·
 * **verde** = está tudo certo (o aviso semanal).
 */
export const SEVERIDADES = ['vermelho', 'coral', 'ambar', 'azul', 'verde'] as const
export type Severidade = (typeof SEVERIDADES)[number]

/** ⭐ a ordem em que o olho deve bater — pior primeiro, e o verde por último */
export const PESO_SEVERIDADE: Record<Severidade, number> = {
  vermelho: 0,
  coral: 1,
  ambar: 2,
  azul: 3,
  verde: 4,
}

/** ⭐ a família de cor de cada severidade — reusa os tokens `--fam-*` da casa, nunca hex novo */
export const FAMILIA_DA_SEVERIDADE: Record<Severidade, string> = {
  vermelho: 'coral',
  coral: 'coral',
  ambar: 'ambar',
  azul: 'azul',
  verde: 'verde',
}

export const ROTULO_DO_SETOR: Record<Setor, string> = {
  producao: 'Produção',
  estoque: 'Estoque',
  financeiro: 'Financeiro',
  sistema: 'Sistema',
}

export function ehSetor(x: unknown): x is Setor {
  return typeof x === 'string' && (SETORES as readonly string[]).includes(x)
}

export function ehSeveridade(x: unknown): x is Severidade {
  return typeof x === 'string' && (SEVERIDADES as readonly string[]).includes(x)
}

/** o que um produtor manda pra registrar um aviso */
export interface NovoAviso {
  companyId: string
  setor: Setor
  severidade: Severidade
  /** a AÇÃO, na língua do balcão */
  titulo: string
  /** o porquê, em 1-2 frases de gente */
  corpo: string
  /** ⛔ obrigatório */
  oQueFazer: string
  /** o botão que leva DIRETO ao lugar — os dois juntos, ou nenhum */
  acaoRotulo?: string | null
  acaoHref?: string | null
  /** qual guard/juiz falou */
  origem: string
  /** o objeto do aviso — com a origem, forma a chave de dedupe */
  alvo: string
}
