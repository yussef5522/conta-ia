// ESTOQUE FASE 3 — GOLDEN do parser do Suitable, contra o ARQUIVO REAL (80 produtos, 494
// unidades). REGRA 3: roda o parser no dado verdadeiro desde o dia um.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseSuitable, SuitableParseError } from '../parse-suitable'

const HTML = readFileSync(join(__dirname, 'fixtures/suitable-produtos-agrupado.xls'), 'utf-8')

describe('parseSuitable (arquivo real)', () => {
  const r = parseSuitable(HTML)

  it('80 produtos, 494 unidades (bate com a tela do Suitable)', () => {
    expect(r.totalProdutos).toBe(80)
    expect(r.totalUnidades).toBe(494)
  })
  it('o campeão é o Combo Caçula com 57', () => {
    expect(r.linhas[0]).toMatchObject({ produto: 'Combo Caçula', quantidade: 57 })
    expect(r.linhas[0].valorTotal).toBeCloseTo(4362.97, 2)
  })
  it('mantém as duplicatas de cadastro do PDV separadas (o mapa resolve depois)', () => {
    const nomes = r.linhas.map((l) => l.produto)
    expect(nomes).toContain('XIS COMPLETO')
    expect(nomes).toContain('XIS - COMPLETO') // duplicata — vira a mesma ficha no mapa
  })
  it('lê BRL com vírgula decimal', () => {
    const coca = r.linhas.find((l) => l.produto === 'COCA COLA 2L')!
    expect(coca.quantidade).toBe(20)
    expect(coca.valorTotal).toBeCloseTo(340, 2)
  })
  it('rejeita arquivo que não é o relatório', () => {
    expect(() => parseSuitable('<html><body>nada</body></html>')).toThrow(SuitableParseError)
  })
})
