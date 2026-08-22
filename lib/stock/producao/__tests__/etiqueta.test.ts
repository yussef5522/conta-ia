// ESTOQUE FASE 2 item 2.3 — ZPL da etiqueta: contém os campos e o QR do lote (REGRA 3).

import { describe, it, expect } from 'vitest'
import { etiquetaZpl, type EtiquetaData } from '../etiqueta'

const E: EtiquetaData = { conclusaoId: 'c1', produto: 'Porção de carne 100g', lote: 'ABCD1234', manipulacao: '21/08/2026', validade: '05/09/2026', qtdGerada: 17, unidade: 'UN', colaborador: 'Maria' }

describe('etiquetaZpl', () => {
  it('tem produto, lote, validade, qtd, colaborador e o QR do lote', () => {
    const z = etiquetaZpl(E)
    expect(z).toContain('^XA'); expect(z).toContain('^XZ')
    expect(z).toContain('Porção de carne 100g')
    expect(z).toContain('Lote: ABCD1234')
    expect(z).toContain('Val: 05/09/2026')
    expect(z).toContain('Qtd: 17 UN')
    expect(z).toContain('Maria')
    expect(z).toContain('^BQN') // QR
    expect(z).toContain('LA,ABCD1234') // QR = lote
    expect(z).toContain('^CI28') // UTF-8 (acentos)
  })
  it('sanitiza controles ZPL do texto (^ e ~)', () => {
    const z = etiquetaZpl({ ...E, produto: 'X^Y~Z' })
    expect(z).toContain('X Y-Z')
  })
})
