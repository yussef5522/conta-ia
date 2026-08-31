// ⭐⭐ GOLDEN DA FATURA NUBANK PF — venc 17/08/2026 (31/08/2026).
//
// ⭐ FIXTURE REAL: o `pdftotext -layout` do PDF do dono (poppler, UTF-8), anonimizado
// SÓ no nome do portador, nos estabelecimentos, CNPJ, endereço e telefone.
//
// ⚠️⚠️ TODA PALAVRA QUE O PARSER USA PRA DECIDIR SOBREVIVEU À ANONIMIZAÇÃO — e isso é
// deliberado: em 26/08 o anonimizador comeu "PAGAMENTO" e os nomes dos meses e quebrou o
// parser PJ; em 31/08 comeu "Banrisul" e derrubou 12 testes do ciclo PF. A lista de
// palavras preservadas está no gerador desta fixture. **Palavra que decide não se
// anonimiza.**
//
// Os números são os do documento, conferidos pelo dono na fatura em papel:
//   2.692,12 (compras) · 33,91 (IOF) · 327,29 (outros) · 3.053,32 (total a pagar)
//   2.726,03 (bloco do portador) · −5.066,39 declarado / −5.066,40 somado

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseNubankFaturaPF, conferirNubank, resolverAno } from '../parser'
import { reconhecerBancoPF } from '@/lib/credit-card/registry-fatura-pf'

const TEXTO = readFileSync(join(__dirname, 'fixtures/nubank-fatura-pf.txt'), 'utf-8')
const r = parseNubankFaturaPF(TEXTO)

describe('⭐⭐ a COMPOSIÇÃO fecha ao centavo (nunca a soma bruta)', () => {
  it('⭐⭐ compras + IOF + outros = Total a pagar', () => {
    expect(r.computed.compras).toBeCloseTo(2692.12, 2)
    expect(r.computed.iof).toBeCloseTo(33.91, 2)
    expect(r.declared.outrosLancamentos).toBeCloseTo(327.29, 2)
    const c = conferirNubank(r)
    expect(c.composicao).toBeCloseTo(3053.32, 2)
    expect(c.totalAPagar).toBeCloseTo(3053.32, 2)
    expect(c.fecha).toBe(true)
  })

  it('⛔⛔ a SOMA BRUTA de todas as linhas NÃO é a régua — e prova por quê', () => {
    // o dono mediu na fatura real: somar tudo dá −2.340,37, porque o Nubank mistura
    // pagamentos, créditos e saldo em atraso no mesmo bloco. Conferir por aí reprovaria
    // uma fatura correta.
    const bruta = r.linhas.reduce((s, l) => s + (l.credito ? -l.valor : l.valor), 0)
    expect(Math.round(bruta * 100) / 100).not.toBeCloseTo(3053.32, 2)
    expect(bruta).toBeLessThan(0) // negativa, como na fatura real
  })

  it('⭐ o bloco do portador declara 2.726,03 e as linhas dele somam isso', () => {
    const b = r.blocos.find((x) => /Silva/i.test(x.nome))!
    expect(b.declarado).toBeCloseTo(2726.03, 2)
    expect(b.somado).toBeCloseTo(2726.03, 2)
    expect(b.fecha).toBe(true)
  })

  it('⭐ e 2.726,03 − IOF (33,91) = 2.692,12 = "Total de compras"', () => {
    expect(Math.round((2726.03 - r.computed.iof) * 100) / 100).toBeCloseTo(r.declared.compras!, 2)
  })
})

describe('⚠️⚠️ O CENTAVO É DO NUBANK, NÃO DO PARSER', () => {
  it('⚠️ "Pagamentos e Financiamentos" declara −5.066,39 e as linhas somam −5.066,40', () => {
    const b = r.blocos.find((x) => /Pagamentos e Financiamentos/i.test(x.nome))!
    expect(b.declarado).toBeCloseTo(-5066.39, 2)
    expect(b.somado).toBeCloseTo(-5066.4, 2)
    // ⭐ 1 centavo de tolerância no SUBTOTAL — o total principal continua exigindo exato
    expect(b.fecha).toBe(true)
  })

  it('⭐ e a folga do subtotal NÃO contamina o total (que fecha exato)', () => {
    expect(conferirNubank(r).diferenca).toBe(0)
  })
})

describe('⚠️ as manias do layout, uma a uma', () => {
  it('⭐ IOF é LANÇAMENTO PRÓPRIO, e vem SEM os 4 dígitos do cartão', () => {
    const iofs = r.linhas.filter((l) => l.ehIof)
    // ⚠️ 6 no documento INTEIRO: 4 no bloco de compras (33,91) + 2 no de pagamentos
    // ("IOF Complementar por renegociação" 0,03 e "IOF de atraso" 23,44). Só os 4 do
    // bloco de compras entram no "IOF de compras internacionais" declarado.
    expect(iofs.length).toBe(6)
    for (const i of iofs) expect(i.final).toBeNull()
    expect(r.computed.iof).toBeCloseTo(33.91, 2)
  })

  it('⛔ as 2 linhas de conversão internacional NÃO viram lançamento', () => {
    expect(r.linhas.some((l) => /BRL .* = USD|Convers[ãa]o/i.test(l.descricao))).toBe(false)
  })

  it('⛔⛔ as linhas do RESUMO não viram transação (senão duplicam o pagamento)', () => {
    // "Fatura anterior" e "Pagamento recebido" existem SÓ no resumo — sem data, então não
    // chegam a virar lançamento. O pagamento de verdade é a linha do bloco de transações,
    // que no documento se chama "Pagamento em 22 JUL".
    expect(r.linhas.some((l) => /^Fatura anterior/i.test(l.descricao))).toBe(false)
    expect(r.linhas.some((l) => /^Pagamento recebido/i.test(l.descricao))).toBe(false)
    const pgto = r.linhas.filter((l) => /^Pagamento em/i.test(l.descricao))
    expect(pgto.length).toBe(1)
    expect(pgto[0].credito).toBe(true)
    expect(pgto[0].valor).toBeCloseTo(5393.69, 2)
  })

  it('⛔ detalhe de encargo ("•" / "Referente ao valor") não vira lançamento', () => {
    expect(r.linhas.some((l) => /Referente ao valor/i.test(l.descricao))).toBe(false)
  })

  it('⭐ MENOS UNICODE (−) e HÍFEN ASCII (-) no mesmo documento, os dois tratados', () => {
    // a linha usa − (U+2212); o subtotal usa - (ASCII)
    expect(TEXTO).toMatch(/−\s*R\$\s*5\.393,69/)
    expect(TEXTO).toMatch(/-R\$\s*5\.066,39/)
    expect(r.linhas.find((l) => /^Pagamento em/i.test(l.descricao))!.credito).toBe(true)
    expect(r.blocos.find((b) => /Pagamentos/i.test(b.nome))!.declarado).toBeLessThan(0)
  })

  it('⭐ parcela sai do nome pra estrutura', () => {
    const p = r.linhas.find((l) => /Parcela 2\/4/i.test(l.descricao))!
    expect([p.parcelaNumero, p.parcelaTotal]).toEqual([2, 4])
    expect(r.linhas.filter((l) => l.parcelaNumero != null).length).toBe(3) // 2/4, 7/10, 6/9
  })

  it('⭐ três finais de cartão diferentes na mesma fatura (adicionais do titular)', () => {
    const finais = [...new Set(r.linhas.map((l) => l.final).filter(Boolean))].sort()
    expect(finais).toEqual(['2716', '5166', '8685'])
  })

  it('⭐ os bullets são U+2022, não asterisco', () => {
    expect(TEXTO).toMatch(/•{4}\s*8685/)
  })
})

describe('⭐ o ANO vem do período, não do relógio', () => {
  const venc = new Date(2026, 7, 17) // 17/08/2026

  it('mês ≤ o do vencimento → mesmo ano', () => {
    expect(resolverAno(7, venc)).toBe(2026) // JUL
    expect(resolverAno(8, venc)).toBe(2026) // AGO
  })

  it('⭐⭐ mês MAIOR que o do vencimento → ano ANTERIOR', () => {
    // fatura de agosto com lançamento de dezembro = dezembro do ano passado.
    // Sem isso, parcelada antiga entraria com data no futuro.
    expect(resolverAno(12, venc)).toBe(2025)
    expect(resolverAno(9, venc)).toBe(2025)
  })

  it('⭐ e as datas lidas saem no ano certo', () => {
    expect(r.linhas.find((l) => /Parcela 2\/4/i.test(l.descricao))!.data).toBe('2026-07-08')
    expect(r.linhas.find((l) => /Nuvem\.Com/i.test(l.descricao))!.data).toBe('2026-08-01')
  })
})

describe('⭐⭐ o registry separa Nubank de Banrisul', () => {
  it('⭐ a fatura Nubank é reconhecida como Nubank', () => {
    expect(reconhecerBancoPF(TEXTO)?.banco).toBe('Nubank')
  })

  it('⛔⛔ e as âncoras do Banrisul NÃO existem neste documento (o dono conferiu)', () => {
    expect(TEXTO).not.toMatch(/Saldo da fatura atual/i)
    expect(TEXTO).not.toMatch(/Despesas \/ D[ée]bitos no Brasil/i)
  })

  it('⭐ o vencimento sai do documento', () => {
    expect(r.vencimento).toBe('2026-08-17')
  })
})
