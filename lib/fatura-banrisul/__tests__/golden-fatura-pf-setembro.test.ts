// ⭐⭐ GOLDEN DA FATURA BANRISUL PF DE **SETEMBRO** — venc 10/09/2026 (10/09/2026).
//
// **O dono, ao subir a fatura do mês:** *"lido 32.650,23 × declarado 18.842,30 — diferença
// 13.806,48. A recusa está certa; a leitura não."* E a razão de este arquivo existir, nas
// palavras dele: ***"meses diferentes, layouts que variam — o golden de um mês não congela
// o banco no tempo."***
//
// ⛔⛔ O QUE MUDOU DE AGOSTO PRA SETEMBRO, e os dois quebraram a leitura:
//
//  1. **A coluna da direita da última página tem 2 lançamentos** (agosto tinha dezenas). A
//     dedução de colunas do Banrisul exigia **≥4 datas alinhadas** pra considerar uma
//     coluna "de verdade" — ela descartou a coluna, a página virou uma só, e o parser
//     passou a ler o dinheiro do PAINEL de limites na linha das compras:
//     `02/08 POSTO PITANGUEIRA 262,00 │ TOTAL DE GASTOS 10.482,68` → leu **10.482,68**.
//  2. **Um rótulo de encargo NOVO**: `(+) IOF sobre operações de crédito 1,45`, que não
//     existe na fatura de agosto. Sem ele o saldo ficava **1,45 curto** e a fatura era
//     recusada por um centavo e meio.
//
// ⭐ A fixture é gerada **no servidor, pelo `extractPdfText`** — o caminho da rota, byte a
// byte (a regra que nasceu do episódio do Itaú, em que o golden fechava e a tela não).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseBanrisulFaturaPF } from '../banrisul-fatura-pf'
import { lerBanrisulPF } from '@/lib/credit-card/adaptadores-fatura-pf'
import { reconhecerBancoPF } from '@/lib/credit-card/registry-fatura-pf'

const TEXTO = readFileSync(join(__dirname, 'fixtures/banrisul-fatura-pf-setembro.txt'), 'utf-8')
const AGOSTO = readFileSync(join(__dirname, 'fixtures/banrisul-fatura-pf.txt'), 'utf-8')
const r = parseBanrisulFaturaPF(TEXTO)
const lida = lerBanrisulPF(TEXTO)

describe('⭐⭐ a fatura de setembro fecha AO CENTAVO', () => {
  it('⛔ despesas: 18.842,30 lido == declarado (lia 32.650,23)', () => {
    expect(lida.conferencia.despesasCalculado).toBeCloseTo(18842.30, 2)
    expect(lida.conferencia.despesasDeclarado).toBeCloseTo(18842.30, 2)
  })

  it('⛔ saldo: 18.593,16 lido == declarado (lia 32.399,64)', () => {
    expect(lida.conferencia.saldoCalculado).toBeCloseTo(18593.16, 2)
    expect(lida.conferencia.saldoDeclarado).toBeCloseTo(18593.16, 2)
    expect(lida.conferencia.fecha).toBe(true)
  })

  it('⭐ e o encargo declarado inclui o IOF sobre operações de crédito', () => {
    // ⚠️ 114,31 (rotativo) + 1,45 (IOF de crédito) — o segundo rótulo não existe em agosto
    expect(lida.conferencia.encargosDeclarados).toBeCloseTo(115.76, 2)
  })

  it('⭐ os dois portadores e o vencimento', () => {
    expect(r.extraction.cardLastDigitsFound).toEqual(['5349', '9113'])
    expect(r.extraction.dueDate).toBe('2026-09-10')
  })
})

describe('⛔⛔ A COLUNA COM 2 LANÇAMENTOS — o defeito que a densidade de datas não via', () => {
  it('⭐ as duas linhas da coluna da direita entraram', () => {
    const ds = r.extraction.lines ?? []
    // 27/08 SUPER DUDA 76,47 e 30/08 JUROS DE MORA - MULTA 4,41
    expect(ds.some((l) => l.date === '2026-08-27' && Math.abs(l.amount - 76.47) < 0.01)).toBe(true)
    expect(ds.some((l) => Math.abs(l.amount - 4.41) < 0.01)).toBe(true)
  })

  it('⛔⛔ e o dinheiro do PAINEL não virou lançamento', () => {
    const ds = r.extraction.lines ?? []
    // os três números que o parser leu por engano na 1ª tentativa
    for (const errado of [10482.68, 2839.53, 40272.93]) {
      expect(
        ds.some((l) => Math.abs(l.amount - errado) < 0.01),
        `${errado} é do painel de totais/limites, não um lançamento`,
      ).toBe(false)
    }
  })

  it('⛔ o "TOTAL DE GASTOS" nunca vira descrição de lançamento', () => {
    expect((r.extraction.lines ?? []).some((l) => /TOTAL DE GASTOS/i.test(l.description))).toBe(false)
  })
})

describe('⛔ A PARCELA SAI DA DESCRIÇÃO — a tela mostrava "CHEFRED 10/1210/12"', () => {
  it('⭐ a descrição vem limpa e a parcela vira estrutura', () => {
    const chefred = lida.linhas.find((l) => l.descricao.startsWith('CHEFRED'))!
    expect(chefred.descricao).toBe('CHEFRED')
    expect([chefred.parcelaNumero, chefred.parcelaTotal]).toEqual([10, 12])
    const pixpel = lida.linhas.find((l) => l.descricao.startsWith('PIXPEL'))!
    expect(pixpel.descricao).toBe('PIXPEL EMBALAGENS S')
    expect([pixpel.parcelaNumero, pixpel.parcelaTotal]).toEqual([2, 6])
  })

  it('⛔ nenhuma descrição termina em NN/NN quando a parcela foi extraída', () => {
    const sujas = lida.linhas.filter((l) => l.parcelaNumero != null && /\d{2}\/\d{2}\s*$/.test(l.descricao))
    expect(sujas.map((l) => l.descricao)).toEqual([])
  })
})

describe('⛔⛔ O QUE A FATURA NÃO SOMA NO PERÍODO FICA FORA', () => {
  it('⭐ "Despesas parceladas - Próximas Faturas" é declarado e NÃO entra', () => {
    expect(r.proximas.proxima).toBeCloseTo(5732.95, 2)
    expect(r.proximas.total).toBeCloseTo(21680.57, 2)
    // ⚠️ se entrassem, as despesas passariam de 40 mil
    expect(lida.conferencia.despesasCalculado).toBeCloseTo(18842.30, 2)
  })

  it('⛔ a SIMULAÇÃO de parcelamento do topo não vira lançamento', () => {
    // "Entrada R$ 9.867,22 · 05 x R$ 4.126,37 · Total Parcelado 19.734,44"
    const ds = r.extraction.lines ?? []
    for (const errado of [9867.22, 19734.44, 4126.37, 3406.88]) {
      expect(ds.some((l) => Math.abs(l.amount - errado) < 0.01), `${errado} é simulação`).toBe(false)
    }
  })
})

describe('⛔⛔⛔ E A FATURA DE AGOSTO CONTINUA VERDE — o mês novo não pode quebrar o velho', () => {
  it('⭐ agosto: 39.302,64 de despesas e 18.348,72 de saldo, como sempre', () => {
    const ago = lerBanrisulPF(AGOSTO)
    expect(ago.conferencia.despesasCalculado).toBeCloseTo(39302.64, 2)
    expect(ago.conferencia.saldoDeclarado).toBeCloseTo(18348.72, 2)
    expect(ago.conferencia.fecha).toBe(true)
  })

  it('⭐ e as 181 linhas dele continuam lá — nenhuma sumiu com a calha nova', () => {
    // ⚠️ foi aqui que a 1ª tentativa de aresta quebrou: ela cortava no PRIMEIRO valor da
    // linha, e numa compra internacional o primeiro é o US$ — 50 linhas sumiram.
    expect(parseBanrisulFaturaPF(AGOSTO).extraction.lines?.length).toBe(181)
  })

  it('⭐ inclusive as internacionais, que trazem US$ e R$ na mesma linha', () => {
    const ago = lerBanrisulPF(AGOSTO)
    expect(ago.linhas.some((l) => l.internacional)).toBe(true)
  })
})

describe('⭐ o registry reconhece as duas', () => {
  it.each([['setembro', TEXTO], ['agosto', AGOSTO]])('a fatura de %s cai no Banrisul', (_, t) => {
    expect(reconhecerBancoPF(t)?.banco).toBe('Banrisul')
  })
})
