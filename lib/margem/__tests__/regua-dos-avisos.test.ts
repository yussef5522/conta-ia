/**
 * ⭐⭐ A RÉGUA DOS AVISOS DA MARGEM, EXECUTADA (07/10/2026).
 *
 * ⛔ Antes deste arquivo a régua só era conferida por MENÇÃO do símbolo no produtor — e a prova
 * em prod mostrou que o caminho que MONTA a frase nunca tinha rodado: com o dado real e o gate
 * do dia 10 aberto, 18 produtos foram avaliados e **zero** avisos nasceram, todos por razão
 * legítima (volume abaixo do mínimo). Régua que nunca produziu nada é promessa.
 *
 * ⚠️ Os números são os MEDIDOS em prod na janela de outubro.
 */
import { describe, it, expect } from 'vitest'
import {
  reguaDosAvisosDaMargem,
  ORIGEM_NEGATIVA,
  ORIGEM_DESPENCOU,
  ORIGEM_RELATORIO,
  MINIMO_DE_UNIDADES,
  DIA_QUE_ABRE_A_COMPARACAO,
  type ProdutoParaAviso,
} from '../regua-dos-avisos'
import { exigirLinguaDoBalcao } from '@/lib/avisos/lingua-do-balcao'
import { formatBRL } from '@/lib/format/money'

const CO = 'cmq17yapb00gnrndlh33sctbo'

const prod = (o: Partial<ProdutoParaAviso> & { chave: string; nome: string }): ProdutoParaAviso => {
  const preco = o.preco ?? 83.3
  const custo = o.custo ?? 15.2
  const unidades = o.unidades ?? 285
  const sobraUn = o.sobraUn ?? preco - custo
  return {
    unidades,
    preco,
    custo,
    sobraUn,
    sobraTotal: o.sobraTotal ?? sobraUn * unidades,
    margemPct: o.margemPct ?? (preco - custo) / preco,
    ...o,
  }
}

/** ⭐ o maior tijolo real de prod: Combo Caçula, 285 un, preço 83,30, custo 15,20 */
const COMBO = prod({ chave: 'f:combo', nome: 'Combo Caçula' })

describe('⛔⛔ 1. SOBRA NEGATIVA — vermelho, e a CONTA vai na frase', () => {
  it('⭐ o aviso nasce com preço, custo, o que sai por venda e o total do período', () => {
    const negativo = prod({
      chave: 'f:x', nome: 'XIS COMPLETO', unidades: 40, preco: 20, custo: 26, sobraUn: -6, sobraTotal: -240, margemPct: -0.3,
    })
    const { avisos } = reguaDosAvisosDaMargem({
      companyId: CO, mes: [negativo], anterior: null, diaDoMes: 5, diasComRelatorioSuspeito: [],
    })
    const a = avisos.find((x) => x.origem === ORIGEM_NEGATIVA)!
    expect(a).toBeTruthy()
    expect(a.severidade).toBe('vermelho')
    expect(a.setor).toBe('estoque')
    expect(a.alvo).toBe('f:x')
    // ⛔ a conta inteira na frase — número sem a conta é o dono tendo que confiar
    // ⚠️ o `Intl` põe ESPAÇO NÃO-QUEBRÁVEL depois do "R$" — comparar com espaço comum
    // nunca casa (a cicatriz de 24/09). A asserção usa o MESMO formatador da frase.
    expect(a.corpo).toContain(formatBRL(20))
    expect(a.corpo).toContain(formatBRL(26))
    expect(a.corpo).toContain(formatBRL(6))
    expect(a.corpo).toContain('40 unidades')
    expect(a.corpo).toContain(formatBRL(240))
    // ⚠️ formatBRL em toda moeda — nunca toFixed com ponto (a cicatriz de 06/10)
    expect(a.corpo).not.toMatch(/R\$\s\d+\.\d{2}\b/)
    expect(a.acaoHref).toContain(`/empresas/${CO}/estoque/cardapio/`)
  })

  it('⛔ volume abaixo do mínimo CALA, com o porquê escrito', () => {
    const r = reguaDosAvisosDaMargem({
      companyId: CO,
      mes: [prod({ chave: 'f:y', nome: 'Y', unidades: MINIMO_DE_UNIDADES - 1, preco: 10, custo: 12, sobraUn: -2, sobraTotal: -18, margemPct: -0.2 })],
      anterior: null, diaDoMes: 5, diasComRelatorioSuspeito: [],
    })
    expect(r.avisos).toHaveLength(0)
    expect(r.calados.some((c) => c.produto === 'Y' && c.porque.includes('abaixo do mínimo'))).toBe(true)
  })

  it('⭐ produto com sobra POSITIVA não vira aviso nem calado', () => {
    const r = reguaDosAvisosDaMargem({
      companyId: CO, mes: [COMBO], anterior: null, diaDoMes: 5, diasComRelatorioSuspeito: [],
    })
    expect(r.avisos.filter((a) => a.origem === ORIGEM_NEGATIVA)).toHaveLength(0)
    expect(r.calados.filter((c) => c.produto === 'Combo Caçula')).toHaveLength(0)
  })
})

describe('⛔⛔ 2. MARGEM DESPENCOU — e o gate do dia é o que impede o alarme diário', () => {
  const antes = prod({ chave: 'f:combo', nome: 'Combo Caçula', preco: 83.3, custo: 15.2 }) // margem 81,8%
  const agora = prod({ chave: 'f:combo', nome: 'Combo Caçula', preco: 83.3, custo: 35 })   // margem 58,0%

  it('⭐ queda de 24 pontos vira aviso âmbar com os DOIS meses na frase', () => {
    const { avisos } = reguaDosAvisosDaMargem({
      companyId: CO, mes: [agora], anterior: [antes], diaDoMes: 15, diasComRelatorioSuspeito: [],
    })
    const a = avisos.find((x) => x.origem === ORIGEM_DESPENCOU)!
    expect(a).toBeTruthy()
    expect(a.severidade).toBe('ambar')
    expect(a.titulo).toContain('caiu 24 pontos')
    expect(a.corpo).toContain('82%')
    expect(a.corpo).toContain('58%')
    expect(a.corpo).toContain(formatBRL(68.1))
    expect(a.corpo).toContain(formatBRL(48.3))
  })

  it('⛔⛔ ANTES do dia 10 a comparação não existe — e a régua DIZ por quê', () => {
    const r = reguaDosAvisosDaMargem({
      companyId: CO, mes: [agora], anterior: null, diaDoMes: DIA_QUE_ABRE_A_COMPARACAO - 1, diasComRelatorioSuspeito: [],
    })
    expect(r.avisos.filter((a) => a.origem === ORIGEM_DESPENCOU)).toHaveLength(0)
    const c = r.calados.find((x) => x.produto === '(todos)')!
    expect(c.porque).toContain('não tem corpo pra comparar')
    expect(c.porque).toContain(`dia ${DIA_QUE_ABRE_A_COMPARACAO - 1}`)
  })

  it('⛔ queda abaixo de 8 pontos não acusa — é ruído de custo médio', () => {
    const pouco = prod({ chave: 'f:combo', nome: 'Combo Caçula', preco: 83.3, custo: 19 }) // −4,6 pontos
    const r = reguaDosAvisosDaMargem({
      companyId: CO, mes: [pouco], anterior: [antes], diaDoMes: 15, diasComRelatorioSuspeito: [],
    })
    expect(r.avisos).toHaveLength(0)
  })

  it('⛔⛔ UMA CAUSA, UM ALARME: quem já tem o vermelho da sobra negativa não ganha o âmbar', () => {
    const negativo = prod({
      chave: 'f:combo', nome: 'Combo Caçula', unidades: 285, preco: 83.3, custo: 90, sobraUn: -6.7, sobraTotal: -1909.5, margemPct: -0.08,
    })
    const r = reguaDosAvisosDaMargem({
      companyId: CO, mes: [negativo], anterior: [antes], diaDoMes: 15, diasComRelatorioSuspeito: [],
    })
    expect(r.avisos.map((a) => a.origem)).toEqual([ORIGEM_NEGATIVA])
    expect(r.calados.some((c) => c.porque.includes('uma causa, um alarme'))).toBe(true)
  })

  it('⛔ produto que não existia no mês anterior não é comparado (nem calado por isso)', () => {
    const r = reguaDosAvisosDaMargem({
      companyId: CO, mes: [agora], anterior: [], diaDoMes: 15, diasComRelatorioSuspeito: [],
    })
    expect(r.avisos).toHaveLength(0)
    expect(r.calados).toHaveLength(0)
  })

  it('⛔ volume abaixo do mínimo num dos DOIS meses cala — é o caso real de prod', () => {
    const r = reguaDosAvisosDaMargem({
      companyId: CO,
      mes: [prod({ chave: 'f:p', nome: 'PORCAO FRITAS - P', unidades: 4, preco: 30, custo: 20 })],
      anterior: [prod({ chave: 'f:p', nome: 'PORCAO FRITAS - P', unidades: 60, preco: 30, custo: 5 })],
      diaDoMes: 15, diasComRelatorioSuspeito: [],
    })
    expect(r.avisos).toHaveLength(0)
    expect(r.calados[0].porque).toContain('num dos dois meses')
  })
})

describe('⭐ 3. RELATÓRIO DE COMPLEMENTOS INCOMPLETO — com o DIA citado', () => {
  it('⭐ a frase traz o dia, as pizzas e os sabores, e leva pros imports', () => {
    const { avisos } = reguaDosAvisosDaMargem({
      companyId: CO, mes: [], anterior: null, diaDoMes: 5,
      diasComRelatorioSuspeito: [{ dia: '2026-09-16', pizzas: 214, sabores: 80 }],
    })
    const a = avisos.find((x) => x.origem === ORIGEM_RELATORIO)!
    expect(a.titulo).toContain('16/09')
    expect(a.corpo).toContain('214 pizzas')
    expect(a.corpo).toContain('80 sabores')
    expect(a.corpo).toContain('toda pizza obriga ao menos um')
    expect(a.alvo).toBe('dia:2026-09-16')
    expect(a.acaoHref).toContain('estoque/vendas?aba=processados#dia-2026-09-16')
  })

  it('⛔ a dedupe é por (origem, alvo): dois dias suspeitos são dois avisos distintos', () => {
    const { avisos } = reguaDosAvisosDaMargem({
      companyId: CO, mes: [], anterior: null, diaDoMes: 5,
      diasComRelatorioSuspeito: [
        { dia: '2026-09-16', pizzas: 214, sabores: 80 },
        { dia: '2026-09-17', pizzas: 190, sabores: 12 },
      ],
    })
    expect(new Set(avisos.map((a) => a.alvo)).size).toBe(2)
  })
})

describe('⛔⛔ A LÍNGUA DO BALCÃO — todo aviso passa pela régua da casa', () => {
  it('⭐ os três tipos de aviso são aceitos pelo validador do sininho', () => {
    const { avisos } = reguaDosAvisosDaMargem({
      companyId: CO,
      mes: [
        prod({ chave: 'f:x', nome: 'XIS COMPLETO', unidades: 40, preco: 20, custo: 26, sobraUn: -6, sobraTotal: -240, margemPct: -0.3 }),
        prod({ chave: 'f:combo', nome: 'Combo Caçula', preco: 83.3, custo: 35 }),
      ],
      anterior: [prod({ chave: 'f:combo', nome: 'Combo Caçula', preco: 83.3, custo: 15.2 })],
      diaDoMes: 15,
      diasComRelatorioSuspeito: [{ dia: '2026-09-16', pizzas: 214, sabores: 80 }],
    })
    expect(avisos.map((a) => a.origem).sort()).toEqual(
      [ORIGEM_DESPENCOU, ORIGEM_NEGATIVA, ORIGEM_RELATORIO].sort(),
    )
    for (const a of avisos) {
      // ⛔ a recusa aqui seria o aviso morrendo no `registrarAviso` em prod, calado
      expect(() => exigirLinguaDoBalcao({ ...a, companyId: CO }), a.titulo).not.toThrow()
    }
  })
})
