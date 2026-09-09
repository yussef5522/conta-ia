// ⭐⭐ UM PIX PAGA N NOTAS — os casos REAIS da Caçula (09/09/2026).
//
// Os números vêm da medição em prod: a linha da ODISSEA (R$ 1.137,78, Stone, 08/09) fecha
// com 5 das 11 notas abertas dela; a do ALAN (R$ 1.370,33) com 5 das 12.
//
// ⛔⛔ E O TESTE QUE MAIS IMPORTA É O DO CAÇA-NÍQUEL: sem a âncora de fornecedor, a soma
// das notinhas da Odissea fecha numa linha *"YUSSEF ABU ZAHRY MUSA · Distribuição de
// Lucros"* de R$ 500,00 — foi o que a 1ª versão da minha investigação fez, e é por isso que
// a linha SEM fornecedor resolvido nem entra no motor.

import { describe, it, expect } from 'vitest'
import {
  sugerirPagamentosEmLote, combinacoesQueFecham,
  type NotaAberta, type LinhaParaLote,
} from '../pagamento-em-lote'

const ODISSEA = 'forn-odissea'
const ALAN = 'forn-alan'
const NOMES: Record<string, string> = { [ODISSEA]: 'ODISSEA CORREA DA SILVA', [ALAN]: 'ALAN SALBEGO DA SILVA' }
const nomeDoFornecedor = (id: string) => NOMES[id] ?? id

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

/** as 11 notas abertas da Odissea, como estão em prod */
const NOTAS_ODISSEA: NotaAberta[] = [
  { id: 'o721', descricao: 'NF 721', valor: 793.73, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
  { id: 'o716', descricao: 'NF 716', valor: 160.19, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
  { id: 'o719', descricao: 'NF 719', valor: 89.91, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
  { id: 'o722', descricao: 'NF 722', valor: 71.05, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
  { id: 'o723', descricao: 'NF 723', valor: 22.90, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
  { id: 'o711', descricao: 'NF 711', valor: 122.47, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
  { id: 'o707', descricao: 'NF 707', valor: 62.89, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
  { id: 'o712', descricao: 'NF 712', valor: 184.10, vencimento: d('2026-09-05'), fornecedorId: ODISSEA },
  { id: 'o710', descricao: 'NF 710', valor: 95.75, vencimento: d('2026-09-04'), fornecedorId: ODISSEA },
  { id: 'o709', descricao: 'NF 709', valor: 59.68, vencimento: d('2026-09-04'), fornecedorId: ODISSEA },
  { id: 'o708', descricao: 'NF 708', valor: 69.28, vencimento: d('2026-09-04'), fornecedorId: ODISSEA },
]

const linhaOdissea: LinhaParaLote = {
  id: 'ext-odissea', descricao: 'ODISSEA CORREA DA SILVA - Transferência | Pix',
  valor: 1137.78, data: d('2026-09-08'), tipo: 'DEBIT',
  fornecedorId: ODISSEA, contaBancariaId: 'stone', contaBancaria: 'stone',
}

describe('⭐⭐ o PIX em lote da ODISSEA — o caso real', () => {
  it('fecha com as 5 notas certas, e diz de onde saiu', () => {
    const { lotes } = sugerirPagamentosEmLote({
      linhas: [linhaOdissea], notas: NOTAS_ODISSEA, nomeDoFornecedor,
    })
    expect(lotes).toHaveLength(1)
    expect(lotes[0].notas.map((n) => n.id).sort()).toEqual(['o716', 'o719', 'o721', 'o722', 'o723'])
    expect(lotes[0].soma).toBe(1137.78)
    expect(lotes[0].diferenca).toBe(0)
    expect(lotes[0].porQue).toContain('ODISSEA CORREA DA SILVA')
    expect(lotes[0].porQue).toContain('5 das 11 notas abertas')
  })

  it('⛔⛔ SEM O NOME NA LINHA NÃO EXISTE LOTE — a trava do caça-níquel', () => {
    // ⚠️ o caso REAL que a 1ª versão da investigação produziu: uma linha de
    // "Distribuição de Lucros" cujo valor é alcançável somando as notinhas.
    const linhaDeOutraCoisa: LinhaParaLote = {
      ...linhaOdissea, id: 'ext-lucros', descricao: 'YUSSEF ABU ZAHRY MUSA',
      valor: 500, fornecedorId: null,
    }
    const { lotes, naoFecham } = sugerirPagamentosEmLote({
      linhas: [linhaDeOutraCoisa], notas: NOTAS_ODISSEA, nomeDoFornecedor,
    })
    expect(lotes).toEqual([])
    expect(naoFecham).toEqual([])
    // ⭐ e a soma REALMENTE fecharia — é isso que torna a âncora indispensável
    expect(combinacoesQueFecham(NOTAS_ODISSEA.map((n) => n.valor), 500).length).toBeGreaterThan(0)
  })

  it('⛔ DUAS combinações que fecham = não sabe qual foi, e não sugere', () => {
    const gemeas: NotaAberta[] = [
      { id: 'g1', descricao: 'NF A', valor: 100, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
      { id: 'g2', descricao: 'NF B', valor: 100, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
      { id: 'g3', descricao: 'NF C', valor: 50, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
      { id: 'g4', descricao: 'NF D', valor: 50, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
    ]
    const { lotes, naoFecham } = sugerirPagamentosEmLote({
      linhas: [{ ...linhaOdissea, valor: 150 }], notas: gemeas, nomeDoFornecedor,
    })
    expect(lotes).toEqual([])
    expect(naoFecham[0].motivo).toBe('AMBIGUO')
  })

  it('⭐ nota fora da janela de vencimento não entra no lote', () => {
    // a mesma soma, mas com a maior nota vencendo daqui a 3 meses
    const longe = NOTAS_ODISSEA.map((n) => n.id === 'o721' ? { ...n, vencimento: d('2026-12-20') } : n)
    const { lotes } = sugerirPagamentosEmLote({ linhas: [linhaOdissea], notas: longe, nomeDoFornecedor })
    expect(lotes).toEqual([])
  })

  it('⛔ uma nota só não é lote — esse é o caminho 1:1, que já existe', () => {
    const uma: NotaAberta[] = [
      { id: 'u1', descricao: 'NF X', valor: 1137.78, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
      { id: 'u2', descricao: 'NF Y', valor: 10, vencimento: d('2026-09-07'), fornecedorId: ODISSEA },
    ]
    const { lotes } = sugerirPagamentosEmLote({ linhas: [linhaOdissea], notas: uma, nomeDoFornecedor })
    expect(lotes).toEqual([])
  })
})

describe('⭐ o lote do ALAN — 5 das 12, com uma nota paga adiantada', () => {
  const NOTAS_ALAN: NotaAberta[] = [
    { id: 'a1609', descricao: 'NF 1609', valor: 797.05, vencimento: d('2026-09-20'), fornecedorId: ALAN },
    { id: 'a1604', descricao: 'NF 1604', valor: 283.64, vencimento: d('2026-09-07'), fornecedorId: ALAN },
    { id: 'a1596', descricao: 'NF 1596', valor: 159.80, vencimento: d('2026-09-07'), fornecedorId: ALAN },
    { id: 'a1605', descricao: 'NF 1605', valor: 71.88, vencimento: d('2026-09-07'), fornecedorId: ALAN },
    { id: 'a1594', descricao: 'NF 1594', valor: 57.96, vencimento: d('2026-09-07'), fornecedorId: ALAN },
    { id: 'a1538', descricao: 'NF 1538', valor: 231.60, vencimento: d('2026-09-05'), fornecedorId: ALAN },
    { id: 'a1545', descricao: 'NF 1545', valor: 64.95, vencimento: d('2026-09-06'), fornecedorId: ALAN },
    { id: 'a1532', descricao: 'NF 1532', valor: 19.00, vencimento: d('2026-09-03'), fornecedorId: ALAN },
  ]
  const linhaAlan: LinhaParaLote = {
    id: 'ext-alan', descricao: 'ALAN SALBEGO DA SILVA - Transferência | Pix',
    valor: 1370.33, data: d('2026-09-08'), tipo: 'DEBIT',
    fornecedorId: ALAN, contaBancariaId: 'stone', contaBancaria: 'stone',
  }

  it('acha as 5, inclusive a que vence 12 dias depois (pagou adiantado)', () => {
    const { lotes } = sugerirPagamentosEmLote({ linhas: [linhaAlan], notas: NOTAS_ALAN, nomeDoFornecedor })
    expect(lotes).toHaveLength(1)
    expect(lotes[0].notas.map((n) => n.id).sort()).toEqual(['a1594', 'a1596', 'a1604', 'a1605', 'a1609'])
    expect(lotes[0].soma).toBe(1370.33)
  })
})

describe('⭐⭐ IVAN / MARIA LUIZA / OESA — nomeiam o fornecedor e NÃO fecham', () => {
  // ⚠️ medido em prod: a linha de R$ 2.008,00 de 08/09 nomeia o Ivan, ele tem 3 notas
  // abertas somando R$ 1.588,50, e nenhuma combinação fecha. Some da tela = "erro
  // disfarçado de vazio"; o certo é aparecer dizendo o que é.
  const IVAN = 'forn-ivan'
  const notas: NotaAberta[] = [
    { id: 'i39', descricao: 'NF 39', valor: 625.00, vencimento: d('2026-09-07'), fornecedorId: IVAN },
    { id: 'i41', descricao: 'NF 41', valor: 613.50, vencimento: d('2026-09-07'), fornecedorId: IVAN },
    { id: 'i40', descricao: 'NF 40', valor: 350.00, vencimento: d('2026-09-07'), fornecedorId: IVAN },
  ]
  const linha: LinhaParaLote = {
    id: 'ext-ivan', descricao: 'M. Ivan Lunardi Ourique Ltda - Transferência | Pix',
    valor: 2008.00, data: d('2026-09-08'), tipo: 'DEBIT',
    fornecedorId: IVAN, contaBancariaId: 'stone', contaBancaria: 'stone',
  }

  it('vira NAO_FECHA com os números à vista, nunca some da tela', () => {
    const { lotes, naoFecham } = sugerirPagamentosEmLote({
      linhas: [linha], notas, nomeDoFornecedor: (id) => (id === IVAN ? 'M. IVAN LUNARDI OURIQUE LTDA' : id),
    })
    expect(lotes).toEqual([])
    expect(naoFecham).toHaveLength(1)
    expect(naoFecham[0].motivo).toBe('NAO_FECHA')
    expect(naoFecham[0].somaDasAbertas).toBe(1588.50)
    expect(naoFecham[0].abertasDoFornecedor).toBe(3)
    expect(naoFecham[0].valorDaLinha).toBe(2008)
  })
})
