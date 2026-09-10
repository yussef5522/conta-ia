// ⭐⭐ GOLDEN DA FATURA ITAÚ/LUIZACRED PF — venc 09/09/2026 (09/09/2026).
//
// ⭐ FIXTURE REAL: o `pdftotext -layout` do PDF do dono, anonimizado por
// `scripts/gerar-fixture-itau.ts` **com trocas do MESMO COMPRIMENTO** — nesta fatura a
// GEOMETRIA é o que está sendo testado (duas colunas achadas por calha), e uma troca de
// tamanho diferente moveria a calha e faria a fixture testar um documento que não existe.
// O gerador roda o parser antes e depois e aborta se qualquer número mudar.
//
// Os números são os do documento, conferidos pelo dono:
//   1.070,89 (cartão 8818) + 3.285,23 (cartão 2971) + 14,67 (produtos e serviços)
//                                             = 4.370,79 "Total dos lançamentos atuais"
//   1.635,08 − 1.635,08 + 0,00 + 120,39 + 4.370,79 = 4.491,18 "Total desta fatura"

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseItauFaturaPF, conferirItau, separarParcela, resolverAno } from '../parser'
import { calhas, colunasDaRegiao } from '../colunas'
import { reconhecerBancoPF } from '@/lib/credit-card/registry-fatura-pf'

const TEXTO = readFileSync(join(__dirname, 'fixtures/itau-luizacred-pf.txt'), 'utf-8')
const r = parseItauFaturaPF(TEXTO)
const c = conferirItau(r)

describe('⭐⭐ a fatura fecha AO CENTAVO, pelas duas provas', () => {
  it('⭐ os 37 lançamentos somam o "Total dos lançamentos atuais"', () => {
    expect(r.linhas).toHaveLength(37)
    expect(c.lancamentos).toBeCloseTo(4370.79, 2)
    expect(c.declarado).toBeCloseTo(4370.79, 2)
    expect(c.fecha).toBe(true)
  })

  it('⭐⭐ CADA CARTÃO bate com o subtotal do próprio bloco', () => {
    const porFinal = Object.fromEntries(r.cartoes.map((x) => [x.final, x]))
    expect(porFinal['8818'].somado).toBeCloseTo(1070.89, 2)
    expect(porFinal['8818'].declarado).toBeCloseTo(1070.89, 2)
    expect(porFinal['2971'].somado).toBeCloseTo(3285.23, 2)
    expect(porFinal['2971'].declarado).toBeCloseTo(3285.23, 2)
    expect(c.cartoesFecham).toBe(true)
  })

  it('⭐ e o total do boleto fecha pela composição que o resumo escreve', () => {
    // 1.635,08 − 1.635,08 + 0,00 + 120,39 + 4.370,79
    expect(r.declared.faturaAnterior).toBeCloseTo(1635.08, 2)
    expect(r.declared.pagamentoEfetuado).toBeCloseTo(-1635.08, 2)
    expect(r.declared.saldoFinanciado).toBe(0)
    expect(r.declared.encargos).toBeCloseTo(120.39, 2)
    expect(c.totalRecomposto).toBeCloseTo(4491.18, 2)
    expect(c.totalDeclarado).toBeCloseTo(4491.18, 2)
    expect(c.totalFecha).toBe(true)
  })

  it('⭐ vencimento, emissão e beneficiário', () => {
    expect(r.vencimento).toBe('2026-09-09')
    expect(r.emissao).toBe('2026-09-02')
    expect(r.beneficiario).toBe('LUIZACRED S/A SCFI')
  })
})

describe('⛔⛔ o total NÃO pode vir de regex solto — a fatura tem "Total a pagar" 2× de SIMULAÇÃO', () => {
  it('os números da propaganda existem no documento e NÃO são o total', () => {
    // 5.185,79 (parcelar o rotativo) e 5.387,96 (parcelas fixas) — os dois MAIORES que a
    // fatura. É a armadilha que custou o parser do Nubank em 31/08.
    expect(TEXTO).toContain('5.185,79')
    expect(TEXTO).toContain('5.387,96')
    expect(c.totalDeclarado).toBeCloseTo(4491.18, 2)
    expect(c.totalDeclarado).not.toBeCloseTo(5185.79, 2)
    expect(c.totalDeclarado).not.toBeCloseTo(5387.96, 2)
  })

  it('⛔ e um regex ingênuo pegaria o número errado — o contrafactual', () => {
    const ingenuo = /Total a pagar\s+R\$\s*([\d.]+,\d{2})/.exec(TEXTO)?.[1]
    expect(ingenuo).toBe('5.185,79') // ⚠️ a simulação, não a fatura
  })
})

describe('⭐⭐ DOIS CARTÕES na mesma fatura — cada linha sabe de quem é', () => {
  it('os portadores vêm dos cabeçalhos de bloco, com o titular', () => {
    expect(r.cartoes.map((x) => x.final)).toEqual(['8818', '2971'])
    expect(r.cartoes.find((x) => x.final === '2971')!.titular).toBe('YUSSEF ABU ZAHRY MUSA')
  })

  it('⭐ nenhuma linha de compra fica sem portador (só o encargo da fatura)', () => {
    const semPortador = r.linhas.filter((l) => !l.portador)
    expect(semPortador).toHaveLength(1)
    expect(semPortador[0].descricao).toBe('ENCARGOS DE ATRASO')
    expect(semPortador[0].encargo).toBe(true)
    expect(semPortador[0].valor).toBeCloseTo(14.67, 2)
  })

  it('⛔ e as linhas do 2971 atravessam DUAS páginas e as DUAS colunas', () => {
    const doDois = r.linhas.filter((l) => l.portador === '2971')
    // 20 na pág 1 (3 na coluna esquerda + 16 na direita) + 7 na pág 2
    expect(doDois).toHaveLength(26)
    expect(doDois.some((l) => l.descricao === 'Leiturinha S.A')).toBe(true)   // esquerda, pág 1
    expect(doDois.some((l) => l.descricao === 'PayU *ADIDA')).toBe(true)      // direita, pág 1
    expect(doDois.some((l) => l.descricao === 'SHOPEE *OnlineEditora')).toBe(true) // pág 2
  })
})

describe('⭐ a PARCELA vem colada no nome — com e sem espaço', () => {
  it('extrai NN/NN do fim e devolve o nome limpo', () => {
    expect(separarParcela('LOJAS RIACHUELO SA03/03')).toEqual({
      descricao: 'LOJAS RIACHUELO SA', parcelaNumero: 3, parcelaTotal: 3,
    })
    expect(separarParcela('Leiturinha S.A 12/12')).toEqual({
      descricao: 'Leiturinha S.A', parcelaNumero: 12, parcelaTotal: 12,
    })
    expect(separarParcela('PACCOBY *Pacco01/04')).toEqual({
      descricao: 'PACCOBY *Pacco', parcelaNumero: 1, parcelaTotal: 4,
    })
  })

  it('⛔ e NÃO inventa parcela onde não há', () => {
    expect(separarParcela('SUPER DUDA -CT').parcelaNumero).toBeNull()
    // parcela maior que o total não é parcela
    expect(separarParcela('LOJA 09/03').parcelaNumero).toBeNull()
    // "de 1" não é parcelamento
    expect(separarParcela('LOJA 01/01').parcelaNumero).toBeNull()
  })

  it('⭐ na fatura real, 15 linhas são parceladas', () => {
    expect(r.linhas.filter((l) => l.parcelaNumero != null)).toHaveLength(15)
    const riachuelo = r.linhas.find((l) => l.descricao === 'LOJAS RIACHUELO SA' && l.valor === 91.01)!
    expect([riachuelo.parcelaNumero, riachuelo.parcelaTotal]).toEqual([3, 3])
  })
})

describe('⭐ a DATA é a da COMPRA, e o ano vem do fechamento', () => {
  it('parcela antiga mantém a data original (27/01, 16/04, 20/05)', () => {
    const datas = r.linhas.map((l) => l.data)
    expect(datas).toContain('2026-01-27')
    expect(datas).toContain('2026-04-16')
    expect(datas).toContain('2026-05-20')
  })

  it('⛔ mês MAIOR que o do fechamento é do ano anterior', () => {
    expect(resolverAno('27/01', { ano: 2026, mes: 9 })).toBe('2026-01-27')
    expect(resolverAno('15/12', { ano: 2026, mes: 9 })).toBe('2025-12-15')
  })
})

describe('⭐ ESTORNO tem sinal', () => {
  it('"PACCOBY *Pacco  - 0,03" entra como crédito', () => {
    const e = r.linhas.filter((l) => l.credito)
    expect(e).toHaveLength(1)
    expect(e[0].descricao).toBe('PACCOBY *Pacco')
    expect(e[0].valor).toBeCloseTo(0.03, 2)
    expect(e[0].portador).toBe('8818')
  })

  it('⛔ e ele SUBTRAI — sem isso o cartão 8818 não fecharia', () => {
    const soma = r.linhas.filter((l) => l.portador === '8818')
      .reduce((s, l) => s + l.valor, 0) // ⚠️ somando TUDO como positivo, de propósito
    expect(Math.round(soma * 100) / 100).toBeCloseTo(1070.95, 2) // 6 centavos a mais
    expect(r.cartoes.find((x) => x.final === '8818')!.somado).toBeCloseTo(1070.89, 2)
  })
})

describe('⛔⛔ "Compras parceladas - próximas faturas" NÃO entra', () => {
  it('as 10 linhas do bloco existem no PDF e ficam FORA dos lançamentos', () => {
    expect(r.proximas.linhas).toBe(10)
    expect(r.proximas.total).toBeCloseTo(1818.89, 2)
    expect(r.proximas.proxima).toBeCloseTo(844.59, 2)
    // ⚠️ se elas entrassem, a soma passaria de 4.370,79 — e é assim que uma fatura
    // "fecha" com o dobro do que o dono deve.
    expect(c.lancamentos).toBeCloseTo(4370.79, 2)
  })

  it('⛔ a parcela 09/12 da próxima fatura NÃO virou lançamento (a desta é a 08/12)', () => {
    const dm = r.linhas.filter((l) => l.descricao === 'DM*helphbomaxcom')
    expect(dm).toHaveLength(1)
    expect(dm[0].parcelaNumero).toBe(8)
    expect(TEXTO).toContain('DM*helphbomaxcom 09/12') // ela está no PDF, no bloco futuro
  })
})

describe('⭐⭐ a GEOMETRIA — duas colunas achadas no próprio documento', () => {
  it('a região de lançamentos da 1ª página se divide em DUAS colunas', () => {
    const pagina = TEXTO.split('\f')[1].split('\n')
    const inicio = pagina.findIndex((l) => /Lançamentos: compras/.test(l))
    const bandas = colunasDaRegiao(pagina.slice(inicio))
    expect(bandas).toHaveLength(2)
  })

  it('⛔⛔ e a calha SÓ existe na região de lançamentos — o erro que dava 2.686,42', () => {
    // ⚠️ rodando na página INTEIRA, os parágrafos de aviso do topo atravessam as duas
    // colunas e apagam a calha: a página vira uma coluna só e 16 linhas se perdem.
    const pagina = TEXTO.split('\f')[1].split('\n')
    const inteira = calhas(pagina).filter(([a, b]) => b - a >= 3 && a > 50)
    const inicio = pagina.findIndex((l) => /Lançamentos: compras/.test(l))
    const soLancamentos = calhas(pagina.slice(inicio)).filter(([a, b]) => b - a >= 3 && a > 50)
    expect(inteira).toHaveLength(0)          // sem calha entre as colunas
    expect(soLancamentos.length).toBeGreaterThan(0) // com a região certa, ela aparece
  })
})

describe('⭐ o registry reconhece a fatura', () => {
  it('o PDF cai no parser do Itaú/Luizacred', () => {
    expect(reconhecerBancoPF(TEXTO)?.banco).toBe('Itaú/Luizacred')
  })

  it('⛔ e o reconhecimento passa pelo `ler`, não por um parser cravado', () => {
    const lida = reconhecerBancoPF(TEXTO)!.ler(TEXTO)
    expect(lida.banco).toBe('Itaú/Luizacred')
    expect(lida.linhas).toHaveLength(37)
    expect(lida.conferencia.fecha).toBe(true)
    expect(lida.portadores).toEqual(['8818', '2971'])
  })
})
