// ⭐⭐⭐ A RÉGUA DO DESEMPENHO — UM DONO, DUAS JANELAS (13/09/2026)
//
// **O dono:** *"O cálculo de média/velocidade/rendimento tem UM dono (lib), e HOJE e
// Relatórios chamam a MESMA função — mesma pergunta, duas janelas, zero divergência."*

import { describe, it, expect } from 'vitest'
import {
  mediaDaTarefa, placarDaEquipe, rendimentoDoLote, passouDaMedia,
  LOTES_PRA_TER_MEDIA, type Execucao,
} from '../desempenho'

let n = 0
const ex = (tarefa: string, nome: string, minutos: number | null, unidades = 100): Execucao => ({
  ordemId: `o${++n}`, tarefa, colaboradorId: `c-${nome}`, nome, minutos, unidades,
  quando: new Date('2026-09-13T12:00:00Z'),
})

/** o histórico real da cozinha: queijo ~108min, massa ~185min */
const historico: Execucao[] = [
  ex('porção queijo 135 grama', 'rodrigo', 100), ex('porção queijo 135 grama', 'nadine', 110),
  ex('porção queijo 135 grama', 'edmar', 114), ex('porção queijo 135 grama', 'rodrigo', 108),
  ex('massa de pizza', 'eliane', 180), ex('massa de pizza', 'eliane', 190), ex('massa de pizza', 'jessica', 185),
  ex('porcao bacon 80 grama', 'rodrigo', 16),   // só 1 → sem média
]

describe('⭐ a média é DA TAREFA, e só com 3+ lotes medidos', () => {
  it('⭐ queijo tem média (4 lotes) — com mediana junto', () => {
    const m = mediaDaTarefa('porção queijo 135 grama', historico)
    expect(m.lotesMedidos).toBe(4)
    expect(m.minutosPorLote).toBe(108)
    expect(m.medianaMinutos).toBe(109)     // ⭐ a mediana anda junto: média sozinha esconde o outlier
    expect(m.porQue).toBeNull()
  })

  it('⛔ bacon NÃO tem média — 1 lote, e a tela DIZ por quê', () => {
    const m = mediaDaTarefa('porcao bacon 80 grama', historico)
    expect(m.minutosPorLote).toBeNull()
    expect(m.porQue).toContain(`precisa de ${LOTES_PRA_TER_MEDIA}`)
  })

  it('⛔⛔ tempo A APURAR fica FORA da média e é CONTADO À PARTE', () => {
    const comGerente = [...historico, ex('porção queijo 135 grama', 'viviane', null)]
    const m = mediaDaTarefa('porção queijo 135 grama', comGerente)
    expect(m.minutosPorLote).toBe(108)     // ⭐ não mudou — o sem-tempo não entrou
    expect(m.lotesSemTempo).toBe(1)        // ⚠️ e não sumiu
  })

  it('⛔ tarefa que não existe no histórico: "tarefa nova — sem média ainda"', () => {
    expect(mediaDaTarefa('sorvete', historico).porQue).toBe('tarefa nova — sem média ainda')
  })
})

describe('⭐⭐ o placar compara queijo com queijo', () => {
  it('⭐ quem foi mais rápido que a média da tarefa ganha selo ACIMA, com %', () => {
    const p = placarDaEquipe([ex('porção queijo 135 grama', 'rodrigo', 90, 400)], historico)[0]
    expect(p.selo).toBe('ACIMA')
    expect(p.frase).toMatch(/^\+\d+% vs média$/)
    expect(p.vsMediaPct).toBeCloseTo(16.7, 0)   // (108−90)/108
  })

  it('⭐ quem ficou dentro do ruído fica "na média" — diferença pequena não é desempenho', () => {
    const p = placarDaEquipe([ex('porção queijo 135 grama', 'edmar', 110, 200)], historico)[0]
    expect(p.selo).toBe('NA_MEDIA')
    expect(p.frase).toBe('na média')
  })

  it('⭐⭐ o ÂMBAR vem com os NÚMEROS — "−31% · 2h18 (média 1h35)" é convite, não veredito', () => {
    const p = placarDaEquipe([ex('massa de pizza', 'viviane', 260, 73)], historico)[0]
    expect(p.selo).toBe('ABAIXO')
    expect(p.frase).toContain('4h20')       // o tempo dela
    expect(p.frase).toContain('média 3h05') // e a média, pra ela poder julgar
  })

  it('⛔ tarefa SEM média não recebe selo de velocidade', () => {
    const p = placarDaEquipe([ex('porcao bacon 80 grama', 'jessica', 30, 50)], historico)[0]
    expect(p.selo).toBe('SEM_MEDIA')
    expect(p.frase).toBe('tarefa nova — sem média ainda')
  })

  it('⛔⛔ quem foi finalizado PELO GERENTE não entra na velocidade — e aparece assim mesmo', () => {
    const p = placarDaEquipe([ex('porção queijo 135 grama', 'eliane', null, 150)], historico)[0]
    expect(p.unidades).toBe(150)          // ⭐ o VOLUME conta
    expect(p.selo).toBe('SEM_MEDIA')      // ⛔ a VELOCIDADE não
    expect(p.tarefasSemTempo).toBe(1)     // ⚠️ e é dito
  })

  it('⛔ sem pódio: a ordem é por VOLUME, não por velocidade', () => {
    const p = placarDaEquipe([
      ex('porção queijo 135 grama', 'rodrigo', 90, 781),
      ex('porção queijo 135 grama', 'nadine', 60, 55),   // mais rápida, menos volume
    ], historico)
    expect(p.map((x) => x.nome)).toEqual(['rodrigo', 'nadine'])
  })

  it('⭐⭐ A MESMA função serve às DUAS janelas — muda só o que entra', () => {
    const hoje = [ex('porção queijo 135 grama', 'rodrigo', 90, 400)]
    const semana = [...hoje, ex('porção queijo 135 grama', 'rodrigo', 100, 300)]
    // mesma régua, resultados diferentes só porque a JANELA é outra
    expect(placarDaEquipe(hoje, historico)[0].unidades).toBe(400)
    expect(placarDaEquipe(semana, historico)[0].unidades).toBe(700)
  })
})

describe('⭐⭐ pedido → entregue', () => {
  it('⭐ 130 → 137 é 105%, verde', () => {
    const r = rendimentoDoLote(130, 137)
    expect([r.pct, r.selo]).toEqual([105, 'OK'])
    expect(r.frase).toBe('pedido 130 → entregue 137 UN')
  })

  it('⛔ 60 → 54 é 90%, ÂMBAR (faltou)', () => {
    expect(rendimentoDoLote(60, 54).selo).toBe('BAIXO')
  })

  it('⛔⛔ MUITO ACIMA também é ÂMBAR — produzir demais é custo parado', () => {
    expect(rendimentoDoLote(100, 300).selo).toBe('ALTO')
  })

  it('⛔⛔ SEM META não vira 100% — vira "sem meta registrada", com o entregue à vista', () => {
    const r = rendimentoDoLote(null, 72)
    expect([r.pct, r.selo]).toEqual([null, 'SEM_META'])
    expect(r.frase).toBe('sem meta registrada · entregue 72 UN')
  })
})

describe('⭐ o alerta inteligente do card vivo', () => {
  it('⭐ passou da média da tarefa → a frase com o excedente', () => {
    const m = mediaDaTarefa('massa de pizza', historico)   // 185min
    expect(passouDaMedia(252, m)).toBe('passou 1h07 da média')
  })

  it('⛔ dentro da média → nada (alerta que grita sempre ninguém lê)', () => {
    expect(passouDaMedia(100, mediaDaTarefa('massa de pizza', historico))).toBeNull()
  })

  it('⛔ tarefa SEM média não gera alerta — a régua das 4h continua sendo o teto', () => {
    expect(passouDaMedia(300, mediaDaTarefa('porcao bacon 80 grama', historico))).toBeNull()
  })
})
