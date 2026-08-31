// ⭐⭐ O DADO DE EXEMPLO MORA NA LINHA A QUE ELE PERTENCE (31/08/2026).
//
// ⛔ O QUE ESTE ARQUIVO EXISTE PRA IMPEDIR: na tela anterior a configuração ficava de um
// lado e os dados de exemplo do outro, em dois blocos de inputs **visualmente idênticos**.
// O dono — dono do produto — olhou e concluiu que os dois lados faziam a mesma coisa; foi
// por isso que ele digitou "queijo" no campo Rótulo. Comportamento certo, ensino errado.
//
// ⭐ Agora cada linha da etiqueta sabe QUAL dado de exemplo é o dela. Selecionou a linha
// da Validade, edita a data da validade — ali, na mesma caixa, embaixo do rótulo. A
// pergunta "o que estas duas coisas têm a ver uma com a outra?" deixa de existir.
//
// ⚠️ E O MAPA É DECLARATIVO DE PROPÓSITO: campo novo no modelo sem entrada aqui vira
// campo que o dono NÃO consegue prever — que é exatamente o defeito que este sprint
// conserta. O teste `todo campo tem como editar o exemplo` trava isso.

import type { CampoId, DadosEtiqueta } from './modelo'

export type TipoEntrada = 'texto' | 'datahora' | 'numero' | 'estado'

export interface EntradaPrevia {
  /** onde o valor mora em `DadosEtiqueta` */
  chave: keyof DadosEtiqueta
  rotulo: string
  tipo: TipoEntrada
  /** o que acontece se ficar vazio — dito na tela, não descoberto na bobina */
  dica?: string
  /** ocupa a linha inteira do inspetor (nome de produto é longo) */
  largo?: boolean
}

export const ENTRADAS_PREVIA: Record<CampoId, EntradaPrevia[]> = {
  produto: [{ chave: 'produto', rotulo: 'Nome do produto', tipo: 'texto', largo: true, dica: 'vazio → a linha some da etiqueta' }],
  validade: [{ chave: 'validadeAte', rotulo: 'Validade', tipo: 'datahora', largo: true, dica: 'vazio → a etiqueta diz “A DEFINIR”' }],
  fabricacao: [{ chave: 'fabricacao', rotulo: 'Fabricação / manipulação', tipo: 'datahora', largo: true }],
  estado: [{ chave: 'estado', rotulo: 'Estado de conservação', tipo: 'estado', largo: true }],
  quantidade: [
    { chave: 'quantidade', rotulo: 'Quantidade', tipo: 'numero', dica: 'vazio → a linha some' },
    { chave: 'unidade', rotulo: 'Unidade', tipo: 'texto' },
  ],
  lote: [{ chave: 'lote', rotulo: 'Lote', tipo: 'texto', largo: true, dica: 'o QR carrega este mesmo lote' }],
  colaborador: [{ chave: 'colaborador', rotulo: 'Quem manipulou', tipo: 'texto', largo: true, dica: 'vazio → a linha some' }],
  empresa: [{ chave: 'empresa', rotulo: 'Nome da empresa', tipo: 'texto', largo: true, dica: 'vazio → a linha some' }],
  // ⚠️ o QR não tem dado próprio: ele CARREGA O LOTE. Dar um campo aqui criaria um
  // segundo lugar pra dizer a mesma coisa — e os dois divergiriam na primeira edição.
  qr: [],
}

/** as entradas de exemplo desta linha (vazio = a linha não tem dado editável) */
export function entradasDaLinha(campo: CampoId | undefined): EntradaPrevia[] {
  return campo ? (ENTRADAS_PREVIA[campo] ?? []) : []
}
