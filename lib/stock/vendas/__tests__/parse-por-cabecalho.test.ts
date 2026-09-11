// ⛔⛔⛔ O PREÇO ENTROU COMO QUANTIDADE E EXPLODIU O ESTOQUE (11/09/2026)
//
// **O caso real:** o **Relatório de COMPLEMENTOS** de 10/09 foi subido na aba de
// **PRODUTOS**. Lendo por POSIÇÃO, a coluna 1 do arquivo errado é o **PREÇO**:
// `R$ 14,99` virou **1499**. O import baixou **1.499 FANTA UVA** (o real era **1**), o
// custo médio virou negativo e a Posição ficou com **valor negativo e saldo positivo**.
//
// ⭐ As fixtures são os DOIS arquivos REAIS de 10/09 (cabeçalho + 6 linhas): o que se
// testa aqui é a GEOMETRIA das colunas, e ela não depende do resto das linhas.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseSuitable, resolverColunas, SuitableParseError,
  COLUNAS_PRODUTOS, COLUNAS_COMPLEMENTOS,
} from '../parse-suitable'

const ler = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf-8')
const PRODUTOS = ler('suitable-produtos-1009.xls')
const COMPLEMENTOS = ler('suitable-complementos-1009.xls')

describe('⭐⭐ a coluna sai do NOME do cabeçalho', () => {
  it('PRODUTOS: quantidade é a coluna 1 e é quantidade de verdade', () => {
    const c = resolverColunas(PRODUTOS, COLUNAS_PRODUTOS)
    expect(c.nome).toBe(0)
    expect(c.quantidade).toBe(1)
    const r = parseSuitable(PRODUTOS, COLUNAS_PRODUTOS)
    // GRANDE PRECINHO: 114 unidades, R$ 5252,07 — o arquivo real de 10/09
    expect(r.linhas[0].produto).toBe('GRANDE PRECINHO')
    expect(r.linhas[0].quantidade).toBe(114)
  })

  it('COMPLEMENTOS: quantidade é a coluna 2 — e sai daí, não da posição fixa', () => {
    const c = resolverColunas(COMPLEMENTOS, COLUNAS_COMPLEMENTOS)
    expect(c.quantidade).toBe(2)
    expect(c.unitario).toBe(1)
    const r = parseSuitable(COMPLEMENTOS, COLUNAS_COMPLEMENTOS)
    expect(r.linhas[0].produto).toBe('CALABRESA')
    expect(r.linhas[0].quantidade).toBe(83)      // ⭐ 83, não "R$ 0,00"
  })
})

describe('⛔⛔ o arquivo trocado é RECUSADO — nunca entra calado', () => {
  it('complementos na aba de produtos PARA, e a mensagem diz o que achou', () => {
    expect(() => parseSuitable(COMPLEMENTOS, COLUNAS_PRODUTOS)).toThrow(SuitableParseError)
    try {
      parseSuitable(COMPLEMENTOS, COLUNAS_PRODUTOS)
    } catch (e) {
      expect((e as Error).message.toLowerCase()).toContain('descrição')
      expect((e as Error).message.toLowerCase()).toContain('aba')
    }
  })

  it('produtos na aba de complementos também para', () => {
    expect(() => parseSuitable(PRODUTOS, COLUNAS_COMPLEMENTOS)).toThrow(SuitableParseError)
  })

  it('⛔⛔ O CONTRAFACTUAL: lendo por POSIÇÃO, o preço vira quantidade', () => {
    // é exatamente o que aconteceu em 10/09 — a régua velha, reposta aqui
    const trs = COMPLEMENTOS.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
    const linha = trs.find((t) => /MAIONESE CASEIRA/.test(t))!
    const tds = [...linha.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1])
    const porPosicao = Number((tds[1] || '').replace(/\D/g, ''))   // col 1 = "R$ 1,99"
    const porCabecalho = Number((tds[2] || '').replace(/\D/g, '')) // col 2 = "26"
    expect(porPosicao).toBe(199)        // ⛔ o preço, lido como quantidade
    expect(porCabecalho).toBe(26)       // ⭐ a quantidade de verdade
  })

  it('cabeçalho sem as colunas esperadas recusa dizendo o que achou', () => {
    const estranho = '<table><tr><th>Coisa</th><th>Outra</th><th>Mais</th><th>Fim</th></tr></table>'
    expect(() => parseSuitable(estranho, COLUNAS_PRODUTOS)).toThrow(/Achei:/)
  })
})
