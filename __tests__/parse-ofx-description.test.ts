// Sprint Conciliação-Visual: testes do parser heurístico de descrição OFX
// usado pra montar o card "statement line" estilo Mercury/Linear.

import { describe, it, expect } from 'vitest'
import { extractStatementInfo } from '@/lib/conciliacao/parse-ofx-description'

describe('extractStatementInfo — separadores', () => {
  it('split por " - " (Stone padrão)', () => {
    const r = extractStatementInfo(
      'JONAS RAFAEL MESSA TALHAFERRO - Pix | Maquininha',
    )
    expect(r.favored).toBe('JONAS RAFAEL MESSA TALHAFERRO')
    expect(r.subDescription).toBe('Pix | Maquininha')
    expect(r.kindHints).toContain('PIX')
  })

  it('split por " | " (separador alternativo)', () => {
    const r = extractStatementInfo('FORNECEDOR X | TED Recebida')
    expect(r.favored).toBe('FORNECEDOR X')
    expect(r.subDescription).toBe('TED Recebida')
    expect(r.kindHints).toContain('TED')
  })

  it('split por " – " (en dash)', () => {
    const r = extractStatementInfo('CLIENTE Y – Boleto pago')
    expect(r.favored).toBe('CLIENTE Y')
    expect(r.subDescription).toBe('Boleto pago')
    expect(r.kindHints).toContain('BOLETO')
  })

  it('escolhe o PRIMEIRO separador que aparece', () => {
    // " - " antes de " | " → divide pelo " - "
    const r = extractStatementInfo('NOME - meio | fim')
    expect(r.favored).toBe('NOME')
    expect(r.subDescription).toBe('meio | fim')
  })
})

describe('extractStatementInfo — sem separador (Banrisul curto)', () => {
  it('"PAGAMENTO CONSORCIO" vira favored inteiro + chip PAGAMENTO', () => {
    const r = extractStatementInfo('PAGAMENTO CONSORCIO')
    expect(r.favored).toBe('PAGAMENTO CONSORCIO')
    expect(r.subDescription).toBeNull()
    expect(r.kindHints).toEqual(['PAGAMENTO'])
  })

  it('"PIX ENVIADO" vira favored + chip PIX', () => {
    const r = extractStatementInfo('PIX ENVIADO')
    expect(r.favored).toBe('PIX ENVIADO')
    expect(r.subDescription).toBeNull()
    expect(r.kindHints).toEqual(['PIX'])
  })

  it('"ANTECIPACAO BANRICOMPRAS" → chip ANTECIPAÇÃO', () => {
    const r = extractStatementInfo('ANTECIPACAO BANRICOMPRAS')
    expect(r.favored).toBe('ANTECIPACAO BANRICOMPRAS')
    expect(r.subDescription).toBeNull()
    expect(r.kindHints).toEqual(['ANTECIPAÇÃO'])
  })

  it('"DEBITO STONE" sem hints conhecidos (mantém só favored)', () => {
    const r = extractStatementInfo('DEBITO STONE')
    expect(r.favored).toBe('DEBITO STONE')
    expect(r.subDescription).toBeNull()
    expect(r.kindHints).toEqual([])
  })

  it('"PACOTE SERVICOS" detecta TARIFA via regex', () => {
    const r = extractStatementInfo('PACOTE SERVICOS')
    expect(r.kindHints).toContain('TARIFA')
  })

  it('"BANRI A VISTA" não detecta nada (mantém só favored)', () => {
    const r = extractStatementInfo('BANRI A VISTA')
    expect(r.favored).toBe('BANRI A VISTA')
    expect(r.kindHints).toEqual([])
  })
})

describe('extractStatementInfo — chips múltiplos', () => {
  it('PIX + outra palavra-chave gera 2 chips', () => {
    const r = extractStatementInfo('Cliente Z - Pix Boleto')
    expect(r.kindHints).toContain('PIX')
    expect(r.kindHints).toContain('BOLETO')
  })

  it('IOF detecta TARIFA', () => {
    const r = extractStatementInfo('IOF sobre operacao')
    expect(r.kindHints).toContain('TARIFA')
  })

  it('Estorno', () => {
    const r = extractStatementInfo('ESTORNO PIX')
    expect(r.kindHints).toContain('ESTORNO')
    expect(r.kindHints).toContain('PIX')
  })

  it('Devolução conta como ESTORNO', () => {
    const r = extractStatementInfo('Devolução de TED')
    expect(r.kindHints).toContain('ESTORNO')
    expect(r.kindHints).toContain('TED')
  })
})

describe('extractStatementInfo — edge cases', () => {
  it('vazia', () => {
    const r = extractStatementInfo('')
    expect(r.favored).toBe('')
    expect(r.subDescription).toBeNull()
    expect(r.kindHints).toEqual([])
  })

  it('só whitespace', () => {
    const r = extractStatementInfo('   ')
    expect(r.favored).toBe('')
    expect(r.kindHints).toEqual([])
  })

  it('hífen no início (sem espaço antes) não vira separador', () => {
    // Após trim() o " - " do início perde o espaço-antes e não é mais válido.
    // Description vira favored inteiro. Aceitável — caso rarissimamente real.
    const r = extractStatementInfo(' - Pix Maquininha')
    expect(r.favored).toBe('- Pix Maquininha')
    expect(r.subDescription).toBeNull()
    expect(r.kindHints).toContain('PIX')
  })

  it('separador no fim ignora a sub vazia', () => {
    const r = extractStatementInfo('NOME -')
    expect(r.favored).toBe('NOME -')
    expect(r.subDescription).toBeNull()
  })

  it('descrição com PIX mas hífen genérico não vira separador', () => {
    // " - " com espaços precisa estar EXATO. "FOO-BAR" não divide.
    const r = extractStatementInfo('FOO-BAR Pix')
    expect(r.favored).toBe('FOO-BAR Pix')
    expect(r.kindHints).toContain('PIX')
  })

  it('case-insensitive nos chips', () => {
    const r = extractStatementInfo('pix recebido')
    expect(r.kindHints).toContain('PIX')
  })

  it('caso real cacula 01 — descrição longa Stone PIX', () => {
    const r = extractStatementInfo(
      'Ana Paula Vieira Campodonico Simoes - Pix | Maquininha',
    )
    expect(r.favored).toBe('Ana Paula Vieira Campodonico Simoes')
    expect(r.subDescription).toBe('Pix | Maquininha')
    expect(r.kindHints).toEqual(['PIX'])
  })
})
