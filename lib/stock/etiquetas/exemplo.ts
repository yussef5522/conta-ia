// Os dados de exemplo com que o editor abre.
//
// ⚠️ SAIU DE DENTRO DO COMPONENTE (31/08/2026): era uma constante fixa no arquivo da
// tela, o que fazia dela a ÚNICA etiqueta que dava pra prever. Agora é uma função — o
// editor a usa como ponto de partida e o dono troca campo a campo, na linha de cada um.
//
// ⚠️ É FUNÇÃO, não constante, por causa das datas: uma constante de módulo congelaria
// `new Date()` no instante em que o arquivo foi carregado, e a etiqueta abriria com a
// fabricação de horas atrás depois que a aba ficasse aberta um tempo.

import type { DadosEtiqueta } from './modelo'

export function exemploDeEtiqueta(): DadosEtiqueta {
  return {
    produto: 'Porção de carne 100g',
    lote: 'A1B2C3D4',
    fabricacao: new Date(),
    validadeAte: new Date(Date.now() + 3 * 86_400_000),
    estado: 'RESFRIADO',
    quantidade: 25,
    unidade: 'UN',
    colaborador: 'Cristian',
    empresa: 'Caçula Mix',
  }
}
