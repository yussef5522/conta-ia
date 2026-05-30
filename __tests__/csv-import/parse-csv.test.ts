// Sprint CSV Import (30/05/2026)

import { describe, it, expect } from 'vitest'
import { parseCsv } from '@/lib/csv-import/parse-csv'

describe('parseCsv — detecção de separador', () => {
  it('CSV com ";" detecta separator=";"', () => {
    const csv = 'A;B;C\n1;2;3'
    const r = parseCsv(csv)
    expect(r.separator).toBe(';')
    expect(r.headers).toEqual(['A', 'B', 'C'])
    expect(r.rows).toEqual([['1', '2', '3']])
  })

  it('CSV com "," detecta separator=","', () => {
    const csv = 'A,B,C\n1,2,3'
    const r = parseCsv(csv)
    expect(r.separator).toBe(',')
    expect(r.headers).toEqual(['A', 'B', 'C'])
  })

  it('forçar separator override', () => {
    const csv = 'A,B;C\n1,2;3'
    const r = parseCsv(csv, { separator: ',' })
    expect(r.separator).toBe(',')
  })

  it('empate de separadores → ; (BR padrão)', () => {
    const csv = 'A;B\n1;2' // sem vírgulas
    expect(parseCsv(csv).separator).toBe(';')
  })
})

describe('parseCsv — BOM e encoding', () => {
  it('remove BOM UTF-8 do início', () => {
    const csv = '﻿A;B\n1;2'
    const r = parseCsv(csv)
    expect(r.headers).toEqual(['A', 'B'])
    expect(r.headers[0]).not.toContain('﻿')
  })

  it('preserva acentos no conteúdo', () => {
    const csv = 'Nome;Cidade\nGRÁFICAS;SÃO PAULO\nGONÇALVES;BRASÍLIA'
    const r = parseCsv(csv)
    expect(r.rows[0]).toEqual(['GRÁFICAS', 'SÃO PAULO'])
    expect(r.rows[1]).toEqual(['GONÇALVES', 'BRASÍLIA'])
  })
})

describe('parseCsv — RFC 4180 aspas duplas', () => {
  it('campo entre aspas com separador interno', () => {
    const csv = 'A;B\n"x;y";z'
    const r = parseCsv(csv)
    expect(r.rows[0]).toEqual(['x;y', 'z'])
  })

  it('campo com aspas escapadas ("") vira " literal', () => {
    const csv = 'A;B\n"NF ""123""";z'
    const r = parseCsv(csv)
    expect(r.rows[0]).toEqual(['NF "123"', 'z'])
  })

  it('campo com quebra de linha entre aspas', () => {
    const csv = 'A;B\n"linha1\nlinha2";z'
    const r = parseCsv(csv)
    expect(r.rows[0]).toEqual(['linha1\nlinha2', 'z'])
  })

  it('todas as células do CACULA entre aspas', () => {
    const csv = '"ID";"VALOR"\n"29478";"-153,00"'
    const r = parseCsv(csv)
    expect(r.headers).toEqual(['ID', 'VALOR'])
    expect(r.rows[0]).toEqual(['29478', '-153,00'])
  })
})

describe('parseCsv — line endings', () => {
  it('aceita \\n', () => {
    const csv = 'A;B\n1;2\n3;4'
    const r = parseCsv(csv)
    expect(r.rows).toHaveLength(2)
  })

  it('aceita \\r\\n', () => {
    const csv = 'A;B\r\n1;2\r\n3;4'
    const r = parseCsv(csv)
    expect(r.rows).toHaveLength(2)
  })

  it('mistura de \\n e \\r\\n', () => {
    const csv = 'A;B\n1;2\r\n3;4'
    const r = parseCsv(csv)
    expect(r.rows).toHaveLength(2)
    expect(r.rows[1]).toEqual(['3', '4'])
  })
})

describe('parseCsv — linhas em branco', () => {
  it('ignora linhas totalmente vazias e conta em linhasIgnoradas', () => {
    const csv = 'A;B\n1;2\n\n3;4\n\n'
    const r = parseCsv(csv)
    expect(r.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
    expect(r.linhasIgnoradas).toBeGreaterThanOrEqual(1)
  })

  it('linha com whitespace ("   ;   ") é considerada blank', () => {
    const csv = 'A;B\n1;2\n   ;   '
    const r = parseCsv(csv)
    expect(r.rows).toHaveLength(1)
    expect(r.linhasIgnoradas).toBe(1)
  })
})

describe('parseCsv — edge cases', () => {
  it('input vazio', () => {
    const r = parseCsv('')
    expect(r.headers).toEqual([])
    expect(r.rows).toEqual([])
  })

  it('só whitespace', () => {
    const r = parseCsv('   \n\n  ')
    expect(r.headers).toEqual([])
  })

  it('1 linha só (header) sem body', () => {
    const r = parseCsv('A;B;C')
    expect(r.headers).toEqual(['A', 'B', 'C'])
    expect(r.rows).toEqual([])
  })

  it('CACULA trailing ; no header gera 21 campos com último vazio', () => {
    const header = 'ID;VALOR;TOTAL;'
    const r = parseCsv(header + '\n"1";"2";"3";')
    expect(r.headers).toHaveLength(4)
    expect(r.headers[3]).toBe('')
    expect(r.rows[0]).toHaveLength(4)
    expect(r.rows[0][3]).toBe('')
  })
})
