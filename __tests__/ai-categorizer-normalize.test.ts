// Normalização — Fase 3 Etapa 1.

import { describe, it, expect } from 'vitest'
import {
  normalizeDescription,
  normalizeExact,
} from '@/lib/ai-categorizer/normalize'

describe('normalizeDescription — strip prefix nome próprio + data + acentos', () => {
  it('strip prefixo até o primeiro " - " (caso real Cacula Mix)', () => {
    expect(normalizeDescription('FABIO UECKER - Pix | Maquininha')).toBe(
      'pix | maquininha',
    )
    expect(
      normalizeDescription('Marcyelle da Silva dos Santos - Pix | Maquininha'),
    ).toBe('pix | maquininha')
    expect(
      normalizeDescription('Jhonas Aryel Busnello Proença - Pix | Maquininha'),
    ).toBe('pix | maquininha')
  })

  it('strip somente o PRIMEIRO " - " (preserva separadores subsequentes)', () => {
    // "A - B - C" → "B - C" (não come o segundo " - ")
    expect(normalizeDescription('Yussef - Transferência - Pix')).toBe(
      'transferência - pix'.normalize('NFD').replace(/[̀-ͯ]/g, ''),
    )
  })

  it('descrição SEM " - " fica como está (só lower + remove acentos)', () => {
    expect(normalizeDescription('PAGAMENTO TITULO')).toBe('pagamento titulo')
    expect(normalizeDescription('OP. CREDITO C/GARANTIA')).toBe(
      'op. credito c/garantia',
    )
    expect(normalizeDescription('PIX ENVIADO')).toBe('pix enviado')
  })

  it('remove acentos (NFD + diacríticos)', () => {
    expect(normalizeDescription('AÇÃO ATÉ ÁGUA')).toBe('acao ate agua')
    expect(normalizeDescription('cobrança mensálidade')).toBe(
      'cobranca mensalidade',
    )
  })

  it('colapsa múltiplos espaços + trim', () => {
    expect(normalizeDescription('  pix    enviado   ')).toBe('pix enviado')
    expect(normalizeDescription('A - pix\t|\nmaquininha')).toBe(
      'pix | maquininha',
    )
  })

  it('strip sufixos de data: DD/MM, DD/MM/YYYY, MM/YYYY, MES/YYYY', () => {
    expect(normalizeDescription('PAGAMENTO BOLETO 12/05')).toBe(
      'pagamento boleto',
    )
    expect(normalizeDescription('PAGAMENTO BOLETO 12/05/2026')).toBe(
      'pagamento boleto',
    )
    expect(normalizeDescription('CONTAS LUZ 05/2026')).toBe('contas luz')
    expect(normalizeDescription('AGUA MAR/2026')).toBe('agua')
  })

  it('preserva separadores semânticos | e /', () => {
    expect(normalizeDescription('PIX | MAQUININHA')).toBe('pix | maquininha')
    expect(normalizeDescription('OP. CREDITO C/GARANTIA')).toBe(
      'op. credito c/garantia',
    )
  })

  it('descrição vazia retorna string vazia', () => {
    expect(normalizeDescription('')).toBe('')
  })
})

describe('normalizeExact — descrição literal lower+trim+acentos (sem strip prefix)', () => {
  it('preserva prefixo (não remove " - ")', () => {
    expect(normalizeExact('FABIO UECKER - Pix | Maquininha')).toBe(
      'fabio uecker - pix | maquininha',
    )
  })

  it('aplica lower + acentos + trim como normalizeDescription', () => {
    expect(normalizeExact('  Açao Etc  ')).toBe('acao etc')
  })

  it('strings idênticas após normalize são iguais', () => {
    const a = 'PAGAMENTO Título'
    const b = 'pagamento titulo'
    expect(normalizeExact(a)).toBe(normalizeExact(b))
  })
})
