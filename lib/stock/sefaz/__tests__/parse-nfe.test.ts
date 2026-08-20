// Golden da NF-e completa (item 3) — parseia uma NF-e REAL da Cacula (anonimizada:
// CNPJ/nomes/endereço sintéticos; itens/qtd/valores/NCM/duplicatas IDÊNTICOS) e trava
// ao centavo. REGRA 3: roda o parser real contra o XML real.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseNfeCompleta, NfeParseError } from '../parse-nfe'

const xml = readFileSync(join(__dirname, 'fixtures/nfe-completa-real.xml'), 'utf-8')

describe('parseNfeCompleta — golden', () => {
  const nfe = parseNfeCompleta(xml)

  it('cabeçalho + emitente', () => {
    expect(nfe.chave).toBe('42260511222333000181550020063812691168173940')
    expect(nfe.nNF).toBe('6381269')
    expect(nfe.tpNF).toBe('1')
    expect(nfe.emit.cnpj).toBe('11222333000181')
    expect(nfe.emit.xNome).toBe('FORNECEDOR TESTE LTDA')
    expect(nfe.emit.uf).toBe('SC')
  })

  it('itens ao centavo', () => {
    expect(nfe.itens).toHaveLength(1)
    const it0 = nfe.itens[0]
    expect(it0.nItem).toBe(1)
    expect(it0.cProd).toBe('282')
    expect(it0.xProd).toContain('OLEO DE SOJA')
    expect(it0.ncm).toBe('15079011')
    expect(it0.cfop).toBe('6102')
    expect(it0.uCom).toBe('UN')
    expect(it0.qCom).toBe(120)
    expect(it0.vUnCom).toBe(7.72)
    expect(it0.vProd).toBe(926.4)
  })

  it('duplicatas ao centavo', () => {
    expect(nfe.duplicatas).toHaveLength(1)
    expect(nfe.duplicatas[0].nDup).toBe('001')
    expect(nfe.duplicatas[0].dVenc).toBe('2026-06-17')
    expect(nfe.duplicatas[0].vDup).toBe(926.4)
  })

  it('totais + INVARIANTES (Σ itens == vProd; Σ dup == vNF)', () => {
    expect(nfe.totais.vNF).toBe(926.4)
    expect(nfe.totais.vProd).toBe(926.4)
    const somaItens = Math.round(nfe.itens.reduce((s, i) => s + (i.vProd ?? 0), 0) * 100) / 100
    expect(somaItens).toBe(nfe.totais.vProd)
    const somaDup = Math.round(nfe.duplicatas.reduce((s, d) => s + d.vDup, 0) * 100) / 100
    expect(somaDup).toBe(nfe.totais.vNF)
  })

  it('resumo (sem infNFe completo) → NfeParseError', () => {
    expect(() => parseNfeCompleta('<resNFe><chNFe>123</chNFe></resNFe>')).toThrow(NfeParseError)
  })
})
