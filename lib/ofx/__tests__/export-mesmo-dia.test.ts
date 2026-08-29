// REGRA 1 — o aviso de export de mesmo dia (29/08/2026).
//
// O caso REAL que motiva: 28/08 às 15:09 o dono baixou o extrato do Banrisul e importou
// com o dia ainda correndo; o gate travou e a investigação começou pelo lado errado. O
// arquivo não estava errado — o DIA é que não tinha fechado.

import { describe, it, expect } from 'vitest'
import { avisoExportMesmoDia } from '../export-mesmo-dia'

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const AGORA = new Date('2026-08-28T15:09:00.000Z')

describe('⭐ o extrato termina HOJE — o dia ainda está aberto', () => {
  it('⭐⭐ avisa, e diz quantos lançamentos são do dia que não fechou', () => {
    const r = avisoExportMesmoDia(D('2026-08-28'), [D('2026-08-26'), D('2026-08-28'), D('2026-08-28')], AGORA)
    expect(r.mesmoDia).toBe(true)
    expect(r.linhasDoDiaAberto).toBe(2)
    expect(r.aviso).toContain('28/08/2026')
    expect(r.aviso).toContain('2 lançamentos são de hoje')
  })

  it('⭐ NÃO manda parar — diz que importar agora é seguro (nada se perde, não duplica)', () => {
    // ⚠️ importa muito: aviso que manda o dono parar vira aviso que ele ignora. O que
    // falta hoje entra no próximo extrato, e a dedup é por data+valor+memo.
    const r = avisoExportMesmoDia(D('2026-08-28'), [D('2026-08-28')], AGORA)
    expect(r.aviso).toMatch(/importar assim mesmo/i)
    expect(r.aviso).toMatch(/sem duplicar/i)
  })

  it('e explica que o saldo declarado pode não incluir tudo — a causa provável do gate', () => {
    const r = avisoExportMesmoDia(D('2026-08-28'), [D('2026-08-28')], AGORA)
    expect(r.aviso).toMatch(/saldo declarado/i)
  })
})

describe('quando NÃO se aplica (e não pode virar ruído)', () => {
  it('extrato de ontem: dia fechado, sem aviso', () => {
    const r = avisoExportMesmoDia(D('2026-08-27'), [D('2026-08-27')], AGORA)
    expect(r.mesmoDia).toBe(false)
    expect(r.aviso).toBe('')
  })

  it('extrato antigo importado hoje: sem aviso', () => {
    const r = avisoExportMesmoDia(D('2026-07-31'), [D('2026-07-30')], AGORA)
    expect(r.mesmoDia).toBe(false)
  })

  it('arquivo sem âncora declarada: não inventa aviso', () => {
    expect(avisoExportMesmoDia(null, [D('2026-08-28')], AGORA).mesmoDia).toBe(false)
    expect(avisoExportMesmoDia(undefined, [], AGORA).mesmoDia).toBe(false)
  })

  it('⚠️ termina hoje mas SEM linha de hoje — avisa igual, sem citar contagem', () => {
    // o dia aberto pode ainda não ter movimento: o aviso continua valendo (o banco pode
    // lançar mais tarde), mas não inventa "0 lançamentos são de hoje".
    const r = avisoExportMesmoDia(D('2026-08-28'), [D('2026-08-26')], AGORA)
    expect(r.mesmoDia).toBe(true)
    expect(r.linhasDoDiaAberto).toBe(0)
    expect(r.aviso).not.toMatch(/0 lançamento/)
  })
})

describe('⚠️ a decisão é do DIA, não do instante', () => {
  it('importar às 23:59 do mesmo dia ainda é mesmo dia', () => {
    const r = avisoExportMesmoDia(D('2026-08-28'), [], new Date('2026-08-28T23:59:00.000Z'))
    expect(r.mesmoDia).toBe(true)
  })
  it('importar 1 minuto depois da virada já é dia fechado', () => {
    const r = avisoExportMesmoDia(D('2026-08-28'), [], new Date('2026-08-29T00:01:00.000Z'))
    expect(r.mesmoDia).toBe(false)
  })
})
