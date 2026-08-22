// ESTOQUE — sugestão de fator pelo nome (REGRA 3, casos reais das notas).

import { describe, it, expect } from 'vitest'
import { sugerirFatorConversao } from '../unidade-fator'

describe('sugerirFatorConversao', () => {
  it('acha o pack no nome (casos reais)', () => {
    expect(sugerirFatorConversao('FRUKI GUARANA 600ML PET 12UN')).toBe(12)
    expect(sugerirFatorConversao('REFRIGERANTE C/6')).toBe(6)
    expect(sugerirFatorConversao('CERVEJA CX24')).toBe(24)
    expect(sugerirFatorConversao('AGUA FD 12')).toBe(12)
  })
  it('não chuta quando o nome não diz o pack', () => {
    expect(sugerirFatorConversao('CERV SKOL 600ML')).toBeNull() // dono digita (24)
    expect(sugerirFatorConversao('PIZZA FAMILIA 45CM')).toBeNull() // 45CM não é pack
    expect(sugerirFatorConversao('OLEO DE SOJA 900ML')).toBeNull()
  })
})
