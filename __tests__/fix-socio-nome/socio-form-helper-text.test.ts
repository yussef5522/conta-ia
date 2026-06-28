// Sprint Fix SocioPF Nome (28/06/2026) — defensivo cosmético:
// o form de cadastro de SocioPF passa a orientar o user a usar nome COMPLETO
// (causa raiz do detector não reconhecer "YUSSEF ABU ZAHRY MUSA" quando o
// nome cadastrado era só "yussef" — 6 chars, abaixo do filtro 8+).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('Sprint Fix SocioPF Nome — form orienta nome completo', () => {
  const code = readFileSync(
    root('app/(dashboard)/empresas/[id]/socios/socios-unified-client.tsx'),
    'utf-8',
  )

  it('Label virou "Nome completo"', () => {
    expect(code).toMatch(/Nome completo \*/)
  })

  it('Placeholder mostra exemplo de nome completo', () => {
    expect(code).toMatch(/placeholder="Ex\.: Yussef Abu Zahry Musa"/)
  })

  it('Helper text explica POR QUÊ usar completo', () => {
    expect(code).toMatch(/nome\s*<strong>completo<\/strong>/)
    expect(code).toMatch(/aparece nos extratos bancários/)
    expect(code).toMatch(/detectar movimentações próprias/)
  })

  it('CPF tem dica de uso (sinal forte detector)', () => {
    expect(code).toMatch(/CPF na descrição do PIX/)
  })
})
