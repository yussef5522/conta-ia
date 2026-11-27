/**
 * ⭐ O AVISO DA CONFERÊNCIA DE NOTA DIZ A VERDADE (27/11/2026) — achado da auditoria de 26/11.
 * A nota real dizia "o CONFIRMAR liga em breve. Nada é gravado ainda" e o Confirmar GRAVA.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AvisoDoModo } from '@/components/estoque/aviso-do-modo'

describe('o aviso do modo da conferência de nota', () => {
  it('⭐⭐ nota real: diz que o Confirmar GRAVA — nunca "em breve" nem "nada é gravado"', () => {
    const html = renderToStaticMarkup(<AvisoDoModo modoTeste={false} />)
    expect(html).toContain('Confirmar grava a entrada no estoque')
    expect(html.toLowerCase()).not.toContain('em breve')
    expect(html.toLowerCase()).not.toContain('nada é gravado')
  })
  it('⭐ modo teste (prévia do XML): aí sim, nada é gravado', () => {
    expect(renderToStaticMarkup(<AvisoDoModo modoTeste />)).toContain('Modo teste — nada é gravado')
  })
})
