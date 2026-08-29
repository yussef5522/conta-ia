// GOLDEN DA FATURA MERCADO PAGO (29/08/2026) — fixture REAL de 20/08, anonimizada só no
// nome do titular. ⚠️ Nada que o parser use pra DECIDIR foi trocado (rótulos, valores,
// datas, "Parcela N de M", nomes de seção) — anonimizar isso já quebrou fixture 2× na PF.
//
// É também o CATÁLOGO DE MANIAS deste banco: mexeu no parser, roda tudo de novo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseMercadoPagoFatura } from '../mercadopago-fatura-parser'
import { validateMercadoPagoFatura } from '../validate-mercadopago-fatura'

const TXT = readFileSync(join(__dirname, 'fixtures', 'mercadopago-fatura-2026-08.txt'), 'utf-8')
const p = parseMercadoPagoFatura(TXT)

describe('⭐⭐ o golden: fecha AO CENTAVO com o que o PDF declara', () => {
  it('⭐ os 24 consumos somam exatamente os 2.503,08 declarados', () => {
    expect(p.declarados.consumos).toBe(2503.08)
    expect(p.somaConsumos).toBe(2503.08)
  })

  it('⭐⭐ consumos + encargos = 2.666,44 — SEM subtrair pagamentos', () => {
    expect(p.somaEncargos).toBe(163.36) // 9,20 + 40,06 + 108,04 + 6,06
    expect(Math.round((p.somaConsumos + p.somaEncargos) * 100) / 100).toBe(2666.44)
    expect(p.declarados.total).toBe(2666.44)
  })

  it('⚠️ subtrair os pagamentos daria 640,71 — a fórmula intuitiva está ERRADA', () => {
    const comSubtracao = Math.round((p.somaConsumos + p.somaEncargos - (p.declarados.pagamentosCreditos ?? 0)) * 100) / 100
    expect(comSubtracao).toBe(640.71)
    expect(comSubtracao).not.toBe(p.declarados.total)
  })

  it('⭐ a validação passa', () => {
    const v = validateMercadoPagoFatura(p)
    expect(v.ok).toBe(true)
    expect(v.message).toBeNull()
  })

  it('cabeçalho: vence 20/08, fecha 15/08, limite 7.200', () => {
    expect(p.dueDate).toBe('2026-08-20')
    expect(p.closingDate).toBe('2026-08-15')
    expect(p.creditLimit).toBe(7200)
    expect(p.cardLastDigitsFound).toContain('2711')
  })
})

describe('⭐⭐ MANIA 1 — data da parcela é da COMPRA ORIGINAL, e cai NO FUTURO', () => {
  it('⭐⭐ NENHUMA linha nasce com data futura (o veneno que isso causaria)', () => {
    // no PDF há 25/10, 06/10, 16/09, 07/09, 01/09, 28/08 — todas DEPOIS do fechamento
    const fechamento = p.closingDate!
    for (const l of p.lines) {
      expect(l.date <= fechamento).toBe(true)
    }
  })

  it('⭐ a competência é a do FECHAMENTO da fatura, para todas', () => {
    expect(new Set(p.lines.map((l) => l.date))).toEqual(new Set(['2026-08-15']))
  })

  it('⚠️ o texto TEM as datas futuras — não é que elas sumiram do PDF', () => {
    for (const d of ['25/10', '06/10', '16/09', '01/09', '28/08']) expect(TXT).toContain(d)
  })
})

describe('⭐⭐ MANIA 2 — item repetido é COMPRA DISTINTA, não duplicata de exibição', () => {
  it('⭐ as duas MADEIRA 3/12 de 47,59 ficam — quem decidiu foi a soma declarada', () => {
    const madeiras = p.lines.filter((l) => /MADEIRA/i.test(l.description))
    expect(madeiras).toHaveLength(2)
    expect(madeiras.every((m) => m.amount === 47.59)).toBe(true)
  })

  it('⚠️ tirando uma, a soma NÃO fecharia (2.455,49 ≠ 2.503,08)', () => {
    expect(Math.round((p.somaConsumos - 47.59) * 100) / 100).toBe(2455.49)
    expect(2455.49).not.toBe(p.declarados.consumos)
  })
})

describe('⭐ MANIA 3 — encargos viram LINHAS, nunca soma por fora', () => {
  it('IOF, multa, juros do rotativo e juros de mora estão na lista', () => {
    const enc = p.lines.filter((l) => l.suggestedKind === 'ENCARGO_FINANCEIRO')
    expect(enc).toHaveLength(4)
    const valores = enc.map((e) => e.amount).sort((a, b) => a - b)
    expect(valores).toEqual([6.06, 9.2, 40.06, 108.04])
  })

  it('⚠️ e por isso o total continua sendo Σ das linhas (o invariante do módulo)', () => {
    const soma = Math.round(p.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100
    expect(soma).toBe(2666.44)
  })
})

describe('⭐ MANIA 4 — "Parcela N de M" vira parcelamento', () => {
  it('extrai número e total da parcela', () => {
    const comParcela = p.lines.filter((l) => l.installmentTotal != null)
    expect(comParcela.length).toBeGreaterThanOrEqual(12)
    const primo = comParcela.find((l) => /PRIMO RICO/i.test(l.description))!
    expect(primo.installmentNumber).toBe(12)
    expect(primo.installmentTotal).toBe(12)
    expect(primo.amount).toBe(291.41)
  })

  it('compra à vista não ganha parcela', () => {
    const avista = p.lines.find((l) => /EMEEX/i.test(l.description))!
    expect(avista.installmentNumber).toBeUndefined()
    expect(avista.amount).toBe(219.9)
  })
})

describe('⚠️ MANIA 5 — a fatura anterior foi paga INTEGRALMENTE, só que EM ATRASO', () => {
  it('⭐ os 3 pagamentos somam exatamente o total de julho', () => {
    expect(p.somaPagamentos).toBe(2025.73)
    expect(p.declarados.totalFaturaAnterior).toBe(2025.73)
    expect(p.declarados.pagamentosCreditos).toBe(2025.73)
  })

  it('⚠️ NÃO é pagamento parcial — por isso o K-series não precisou mudar', () => {
    expect(p.somaPagamentos).toBe(p.declarados.totalFaturaAnterior)
  })

  it('⭐ os pagamentos NÃO viram transação (são caixa do mês passado, já no extrato)', () => {
    expect(p.lines.some((l) => l.suggestedKind === 'IGNORAR')).toBe(false)
  })
})

describe('⛔ o juiz MORDE quando não fecha', () => {
  it('mexer numa linha derruba a validação (e nada é gravado)', () => {
    const adulterado = { ...p, somaConsumos: Math.round((p.somaConsumos + 10) * 100) / 100 }
    const v = validateMercadoPagoFatura(adulterado)
    expect(v.ok).toBe(false)
    expect(v.message).toContain('não fecha')
    expect(v.message).toContain('Nada foi gravado')
  })

  it('⚠️ sem NENHUM total declarado, também falha — não dá pra julgar ⇒ não grava', () => {
    const semTotais = { ...p, declarados: { consumos: null, jurosMesAnterior: null, tarifasEncargos: null, multasAtraso: null, pagamentosCreditos: null, totalFaturaAnterior: null, total: null } }
    const v = validateMercadoPagoFatura(semTotais)
    expect(v.ok).toBe(false)
    expect(v.message).toContain('não dá pra conferir')
  })
})
