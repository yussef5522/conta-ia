// Sprint CSV-Encoding: testes do diagnóstico de CSV com fixtures binárias
// montadas em runtime (sem arquivos no disco).

import { describe, it, expect } from 'vitest'
import { decodeCsvBytes } from '@/lib/csv-import/decode-bytes'
import { diagnoseCsv, diagnosticoPermiteBatch } from '@/lib/csv-import/diagnose-csv'

// Helper: monta CSV em bytes pra encoding específico.
function bytes(...arr: number[]): Buffer {
  return Buffer.from(arr)
}
function utf8(s: string): Buffer {
  return Buffer.from(s, 'utf-8')
}
function latin1(s: string): Buffer {
  return Buffer.from(s, 'latin1')
}
function utf16le(s: string): Buffer {
  return Buffer.from(s, 'utf-16le')
}

describe('decodeCsvBytes', () => {
  it('detecta BOM UTF-8 e remove dos primeiros 3 bytes', () => {
    const buf = Buffer.concat([bytes(0xef, 0xbb, 0xbf), utf8('Favorecido')])
    const r = decodeCsvBytes(buf)
    expect(r.encoding).toBe('utf-8')
    expect(r.bomDetected).toBe(true)
    expect(r.text).toBe('Favorecido')
  })

  it('detecta BOM UTF-16 LE', () => {
    const buf = Buffer.concat([bytes(0xff, 0xfe), utf16le('Olá')])
    const r = decodeCsvBytes(buf)
    expect(r.encoding).toBe('utf-16le')
    expect(r.bomDetected).toBe(true)
    expect(r.text).toBe('Olá')
  })

  it('UTF-8 válido sem BOM → utf-8', () => {
    const r = decodeCsvBytes(utf8('Descrição;Valor'))
    expect(r.encoding).toBe('utf-8')
    expect(r.bomDetected).toBe(false)
    expect(r.text).toBe('Descrição;Valor')
  })

  it('Latin1 com acentos (Excel BR ANSI) → windows-1252 (sem mojibake)', () => {
    // 0xE7=ç, 0xE3=ã, 0xC7=Ç em windows-1252
    const buf = latin1('Descrição;Vencimento')
    const r = decodeCsvBytes(buf)
    expect(r.encoding).toBe('windows-1252')
    expect(r.text).toBe('Descrição;Vencimento')
    expect(r.replacementCharsCount).toBe(0)
  })

  it('ASCII puro sem BOM → utf-8 (compat com US)', () => {
    const r = decodeCsvBytes(utf8('Favorecido,Valor\nJoao,100\n'))
    expect(r.encoding).toBe('utf-8')
    expect(r.replacementCharsCount).toBe(0)
  })

  it('buffer vazio → text vazio sem throw', () => {
    const r = decodeCsvBytes(Buffer.from([]))
    expect(r.text).toBe('')
    expect(r.encoding).toBe('utf-8')
  })
})

describe('diagnoseCsv — encoding e separador', () => {
  it('CSV BR completo (windows-1252, separador ;, acentos)', () => {
    const csv = latin1(
      'Favorecido;Descrição;Valor;Vencimento\nENERGISA;Conta de luz;250,50;15/06/2026\n',
    )
    const diag = diagnoseCsv(csv)
    expect(diag.encoding).toBe('windows-1252')
    expect(diag.separator).toBe(';')
    expect(diag.separatorLabel).toContain('ponto-e-vírgula')
    expect(diag.headers).toEqual([
      'Favorecido',
      'Descrição',
      'Valor',
      'Vencimento',
    ])
    expect(diag.dataLineCount).toBe(1)
    expect(diag.mapping.favorecido).toBe('Favorecido')
    expect(diag.mapping.valor).toBe('Valor')
    expect(diag.mapping.vencimento).toBe('Vencimento')
    expect(diagnosticoPermiteBatch(diag)).toBe(true)
  })

  it('CSV US (UTF-8, separador ,, sem acentos)', () => {
    const csv = utf8('Favorecido,Description,Valor,Vencimento\nJoao,Teste,100,2026-06-15\n')
    const diag = diagnoseCsv(csv)
    expect(diag.encoding).toBe('utf-8')
    expect(diag.separator).toBe(',')
    expect(diag.separatorLabel).toContain('vírgula')
    expect(diag.dataLineCount).toBe(1)
  })

  it('TSV (TAB separado) detectado e flag de warning', () => {
    const csv = utf8('Favorecido\tValor\tVencimento\nJoao\t100\t2026-06-15\n')
    const diag = diagnoseCsv(csv)
    expect(diag.separator).toBe('\t')
    expect(diag.warnings.some((w) => w.toLowerCase().includes('tab'))).toBe(true)
  })

  it('arquivo SÓ com cabeçalho → 0 linhas + warning explícito', () => {
    const csv = utf8('Favorecido;Valor;Vencimento\n')
    const diag = diagnoseCsv(csv)
    expect(diag.dataLineCount).toBe(0)
    expect(diag.warnings.some((w) => w.includes('só tem o cabeçalho'))).toBe(true)
    expect(diagnosticoPermiteBatch(diag)).toBe(false)
  })

  it('arquivo vazio → 0 headers + warning', () => {
    const diag = diagnoseCsv(Buffer.from([]))
    expect(diag.dataLineCount).toBe(0)
    expect(diag.headers).toEqual([])
    expect(diagnosticoPermiteBatch(diag)).toBe(false)
  })

  it('arquivo só com linhas em branco → 0 linhas + warning de filtradas', () => {
    const csv = utf8('Favorecido;Valor\n\n\n   \n')
    const diag = diagnoseCsv(csv)
    expect(diag.dataLineCount).toBe(0)
    expect(diag.filteredBlankCount).toBeGreaterThan(0)
    expect(
      diag.warnings.some((w) => w.includes('em branco foram ignoradas')),
    ).toBe(true)
  })
})

describe('diagnoseCsv — mapping warnings', () => {
  it('mapping completo → sem warnings de campo faltando', () => {
    const csv = utf8('Favorecido;Valor;Vencimento\nX;100;01/01/2026\n')
    const diag = diagnoseCsv(csv)
    expect(diag.mapping.favorecido).toBe('Favorecido')
    expect(diag.mapping.valor).toBe('Valor')
    expect(diag.mapping.vencimento).toBe('Vencimento')
    expect(diag.warnings.some((w) => w.includes('favorecido/fornecedor'))).toBe(false)
  })

  it('falta favorecido → warning explica esperado', () => {
    const csv = utf8('Nome Esquisito;Valor;Vencimento\nX;100;01/01/2026\n')
    const diag = diagnoseCsv(csv)
    expect(diag.mapping.favorecido).toBeNull()
    expect(diag.warnings.some((w) => w.toLowerCase().includes('favorecido/fornecedor'))).toBe(true)
  })

  it('falta valor → warning explica esperado', () => {
    const csv = utf8('Favorecido;Quantia Doida;Vencimento\nX;100;01/01/2026\n')
    const diag = diagnoseCsv(csv)
    expect(diag.mapping.valor).toBeNull()
    expect(diag.warnings.some((w) => w.includes('valor'))).toBe(true)
  })

  it('preview tem no máximo 3 linhas', () => {
    const lines = ['H1;H2', ...Array.from({ length: 10 }, (_, i) => `v${i};${i}`)]
    const csv = utf8(lines.join('\n'))
    const diag = diagnoseCsv(csv)
    expect(diag.previewRows.length).toBe(3)
  })
})

describe('diagnoseCsv — caso real Yussef (Excel BR exportado)', () => {
  // Simula contas-pagar-2026-06-05.csv com encoding ANSI + ; + acentos
  it('Excel BR com colunas pt-BR e ANSI → diagnóstico completo + cria batch', () => {
    const csv = latin1(
      [
        'Favorecido;Descrição;Valor;Vencimento;Pagamento',
        'ENERGISA RS;Conta de luz;250,50;15/06/2026;15/06/2026',
        'VIVO S.A.;Telefone;89,00;18/06/2026;',
        ';Pagamento sem favorecido;99,00;20/06/2026;',
      ].join('\r\n'),
    )
    const diag = diagnoseCsv(csv)
    expect(diag.encoding).toBe('windows-1252')
    expect(diag.separator).toBe(';')
    expect(diag.dataLineCount).toBe(3)
    expect(diag.mapping.favorecido).toBe('Favorecido')
    expect(diag.mapping.valor).toBe('Valor')
    expect(diag.mapping.vencimento).toBe('Vencimento')
    expect(diagnosticoPermiteBatch(diag)).toBe(true)
    // Warning de encoding pra UI mostrar
    expect(
      diag.warnings.some((w) => w.includes('Windows-1252')),
    ).toBe(true)
  })
})
