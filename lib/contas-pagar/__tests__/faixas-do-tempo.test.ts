/**
 * ⭐⭐⭐ AS FAIXAS DO TEMPO — e o que este arquivo trava é a **PARTIÇÃO**, não cada rótulo.
 *
 * **O invariante que o dono pediu:** *"Σ das faixas == Σ das linhas da lista == total em
 * aberto do cabeçalho"*. Aqui ele é provado pela forma: as faixas **particionam** o universo
 * em aberto — disjuntas (nenhuma conta em duas) e cobrindo tudo (nenhuma conta fora).
 *
 * ⛔⛔ **O CONTRAFACTUAL É O CORAÇÃO:** um teste que só afirmasse *"a conta de amanhã cai em
 * SETE_DIAS"* ficaria **verde** no dia em que alguém reescrevesse "vencida" aqui com outra
 * régua (timestamp em vez de dia) — porque o caso feliz continua certo. O que morde é
 * comparar a faixa com o `statusDaConta`, que é o dono da palavra: se as duas respostas
 * divergirem, o cartão e o chip passam a dizer números diferentes do mesmo fato (o defeito
 * de 13/09, `34 · 48.502,57` contra `9 · 20.635,54`).
 */
import { describe, it, expect } from 'vitest'
import {
  FAIXAS,
  faixaDaConta,
  intervaloDaFaixa,
  faixaTemIntervaloVazio,
  rotuloDaFaixa,
  nomeDaFaixa,
  dataDaFaixa,
  ehFaixaDoTempo,
  type FaixaDoTempo,
} from '../faixa-do-tempo'
import { statusDaConta, type ContaParaStatus } from '../escopo'

// ⚠️ relógio FIXO e no PASSADO, e com hora alta de propósito: às 23h de São Paulo o servidor
// em UTC já diz amanhã, e é esse o caso em que a fronteira do dia costuma quebrar.
// ⛔ Data fixa no FUTURO em posição de relógio é bomba de calendário (REGRA 12, 01/09).
const NOW = new Date('2026-10-21T02:30:00.000Z') // 20/10/2026 23h30 em São Paulo

function conta(dueDate: string | null, pago = false): ContaParaStatus {
  return {
    status: pago ? 'RECONCILED' : 'PENDING',
    dueDate: dueDate ? new Date(dueDate) : null,
    paymentDate: pago ? new Date('2026-10-15T12:00:00.000Z') : null,
  }
}

describe('as faixas PARTICIONAM o que está em aberto', () => {
  it('toda conta em aberto cai em EXATAMENTE UMA faixa', () => {
    const datas = [
      '2026-09-01', // vencida há muito
      '2026-10-19', // vencida ontem
      '2026-10-20', // vence hoje (dia do Brasil)
      '2026-10-21', // amanhã
      '2026-10-27', // dentro dos 7 dias
      '2026-10-29', // resto do mês
      '2026-10-31', // último do mês
      '2026-11-05', // depois do mês
      '2027-03-01', // bem longe
    ]
    for (const d of datas) {
      const f = faixaDaConta(conta(d), NOW)
      expect(f, `a conta de ${d} ficou sem faixa`).not.toBeNull()
      // ⭐ e ela não pode caber em duas: o intervalo da faixa dela contém a data, os outros não
      const dentro = FAIXAS.filter((cand) => {
        const iv = intervaloDaFaixa(cand, NOW)
        if (!iv) return false
        const t = new Date(d + 'T12:00:00.000Z').getTime()
        const de = iv.de ? iv.de.getTime() : -Infinity
        const ate = iv.ate ? iv.ate.getTime() : Infinity
        return t >= de && t < ate
      })
      expect(dentro, `a conta de ${d} cabe em ${dentro.length} intervalos`).toHaveLength(1)
      expect(dentro[0]).toBe(f)
    }
  })

  it('conta SEM vencimento tem faixa própria — ela não some nem inventa data', () => {
    expect(faixaDaConta(conta(null), NOW)).toBe('SEM_VENCIMENTO')
    // ⚠️ e o rótulo dela NÃO leva data: inventar uma seria mentir sobre um combinado
    // que ninguém fez (a lei do rótulo-com-data não se aplica aqui)
    expect(dataDaFaixa('SEM_VENCIMENTO', NOW)).toBeNull()
    expect(rotuloDaFaixa('SEM_VENCIMENTO', NOW)).toBe(nomeDaFaixa('SEM_VENCIMENTO'))
  })

  it('conta PAGA não entra em faixa nenhuma', () => {
    expect(faixaDaConta(conta('2026-10-19', true), NOW)).toBeNull()
  })

  it('⛔ CONTRAFACTUAL — a faixa CONCORDA com o `statusDaConta` nos dois degraus dele', () => {
    // é a trava que impede uma SEGUNDA definição de "vencida"/"vence hoje" nascer aqui
    const casos: Array<[string, FaixaDoTempo]> = [
      ['2026-10-19', 'VENCIDAS'],
      ['2026-10-20', 'VENCE_HOJE'],
    ]
    for (const [d, esperada] of casos) {
      const c = conta(d)
      expect(faixaDaConta(c, NOW)).toBe(esperada)
      // ⭐ e o dono da palavra diz o mesmo
      expect(statusDaConta(c, NOW)).toBe(esperada === 'VENCIDAS' ? 'VENCIDA' : 'VENCE_HOJE')
    }
  })

  it('o dia é o do BRASIL, não o do servidor em UTC', () => {
    // às 23h30 de SP (02h30 UTC do dia seguinte) a conta de 20/10 ainda VENCE HOJE.
    // ⛔ Pelo relógio UTC ela já estaria "vencida" — e o dono ainda tem o dia pra pagar.
    expect(faixaDaConta(conta('2026-10-20'), NOW)).toBe('VENCE_HOJE')
  })
})

describe('os intervalos são contíguos e o rótulo DERIVA deles', () => {
  it('cada faixa de data começa onde a anterior termina', () => {
    const vh = intervaloDaFaixa('VENCE_HOJE', NOW)!
    const sete = intervaloDaFaixa('SETE_DIAS', NOW)!
    const resto = intervaloDaFaixa('RESTO_DO_MES', NOW)!
    const depois = intervaloDaFaixa('DEPOIS_DO_MES', NOW)!
    expect(intervaloDaFaixa('VENCIDAS', NOW)!.ate!.getTime()).toBe(vh.de!.getTime())
    expect(vh.ate!.getTime()).toBe(sete.de!.getTime())
    expect(sete.ate!.getTime()).toBe(resto.de!.getTime())
    expect(resto.ate!.getTime()).toBe(depois.de!.getTime())
    // ⭐ as pontas são abertas: vencida não tem começo, depois não tem fim
    expect(intervaloDaFaixa('VENCIDAS', NOW)!.de).toBeNull()
    expect(depois.ate).toBeNull()
  })

  it('⭐ a fronteira dos 7 dias TRANSBORDA o mês e as faixas seguem disjuntas', () => {
    // 28/10: os 7 dias vão até 04/11 → RESTO DO MÊS fica vazio e DEPOIS começa em 05/11.
    // ⛔ Rótulo escrito à mão diria "DEPOIS DE 31/10" sobre uma faixa que começa em 05/11.
    const fim = new Date('2026-10-29T02:30:00.000Z') // 28/10 23h30 em SP
    const resto = intervaloDaFaixa('RESTO_DO_MES', fim)!
    expect(resto.de!.getTime()).toBe(resto.ate!.getTime())
    expect(faixaTemIntervaloVazio('RESTO_DO_MES', fim)).toBe(true)
    const depois = intervaloDaFaixa('DEPOIS_DO_MES', fim)!
    expect(depois.de!.getTime()).toBe(intervaloDaFaixa('SETE_DIAS', fim)!.ate!.getTime())
    // ⭐ e a conta de 05/11 cai no DEPOIS, não num buraco
    expect(faixaDaConta(conta('2026-11-05'), fim)).toBe('DEPOIS_DO_MES')
  })

  it('o rótulo SEMPRE leva a data nas faixas de data (lei do dono)', () => {
    for (const f of FAIXAS) {
      if (f === 'SEM_VENCIMENTO') continue
      const r = rotuloDaFaixa(f, NOW)
      expect(r, `${f} saiu sem data no rótulo: ${r}`).toMatch(/\d{2}\/\d{2}/)
    }
  })

  it('a validação da URL recusa valor desconhecido', () => {
    expect(ehFaixaDoTempo('VENCIDAS')).toBe(true)
    expect(ehFaixaDoTempo('xpto')).toBe(false)
    expect(ehFaixaDoTempo('')).toBe(false)
  })
})
