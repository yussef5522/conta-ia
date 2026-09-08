// ⛔⛔⛔ A DUPLA NA MESMA ETAPA (08/09/2026) — as duas decisões do dono, viradas em teste.
//
// A v1 travou em 1 responsável por etapa **de propósito**, pra não ratear tempo no chute.
// Esta evolução admite duas pessoas e mantém a honestidade inteira: dois relógios do próprio
// PIN, nenhum minuto dividido, e as unidades só entre quem MEDIU.

import { describe, it, expect } from 'vitest'
import {
  MAX_PARTICIPANTES, DuplaError, validarEntrada, quemTrabalhou, etapaEstaFeita,
  aindaTrabalhando, designadosQueNaoParticiparam, dividirUnidades, type Participante,
} from '../dupla-na-etapa'

const h = (hhmm: string) => new Date(`2026-09-08T${hhmm}:00.000Z`)
const p = (colaboradorId: string, ini?: string, fim?: string, gerente = false): Participante => ({
  colaboradorId, iniciadoEm: ini ? h(ini) : null, finalizadoEm: fim ? h(fim) : null,
  finalizadaPeloGerente: gerente,
})

describe('⛔ o teto de 2 é travado na GRAVAÇÃO', () => {
  it('a terceira pessoa é recusada', () => {
    const dois = [p('a'), p('b')]
    expect(() => validarEntrada(dois, 'c')).toThrow(DuplaError)
    // ⚠️ e a mensagem ENSINA a saída em vez de só recusar
    expect(() => validarEntrada(dois, 'c')).toThrow(/Tire alguém antes/)
  })

  it('⚠️ pôr de novo quem JÁ está é idempotente, não erro', () => {
    expect(() => validarEntrada([p('a'), p('b')], 'b')).not.toThrow()
  })

  it('a segunda entra normalmente', () => {
    expect(() => validarEntrada([p('a')], 'b')).not.toThrow()
    expect(MAX_PARTICIPANTES).toBe(2)
  })
})

describe('⭐⭐ DECISÃO 1 — o segundo é OPCIONAL: "quem pegou, pegou"', () => {
  it('só um iniciou e terminou → a etapa está FEITA', () => {
    // ⛔ o designado que não veio NÃO trava: travar pararia a cozinha por um plano furado
    const ps = [p('quem-veio', '08:00', '08:30'), p('quem-nao-veio')]
    expect(etapaEstaFeita(ps)).toBe(true)
    expect(quemTrabalhou(ps).map((x) => x.colaboradorId)).toEqual(['quem-veio'])
  })

  it('os dois iniciaram, um ainda trabalha → NÃO está feita', () => {
    const ps = [p('a', '08:00', '08:30'), p('b', '08:05')]
    expect(etapaEstaFeita(ps)).toBe(false)
    expect(aindaTrabalhando(ps).map((x) => x.colaboradorId)).toEqual(['b'])
  })

  it('os dois terminaram → feita', () => {
    expect(etapaEstaFeita([p('a', '08:00', '08:30'), p('b', '08:05', '08:40')])).toBe(true)
  })

  it('⛔ NINGUÉM iniciou → NÃO está feita (é aguardando)', () => {
    // devolver true aqui liberaria a etapa seguinte sem nada ter sido produzido
    expect(etapaEstaFeita([p('a'), p('b')])).toBe(false)
    expect(etapaEstaFeita([])).toBe(false)
  })

  it('⚠️ o designado que não veio sai com RASTRO, não em silêncio', () => {
    const ps = [p('veio', '08:00', '08:30'), p('faltou')]
    expect(designadosQueNaoParticiparam(ps).map((x) => x.colaboradorId)).toEqual(['faltou'])
  })
})

describe('⭐⭐ DECISÃO 2 — a etapa 2 libera com a 1 FEITA', () => {
  // ⭐ a regra de sequência NÃO muda: ela continua olhando `etapa.finalizadoEm`, que passa a
  // ser carimbado exatamente quando `etapaEstaFeita` vira true. Uma regra só.
  it('com um da dupla ainda trabalhando, a etapa não está pronta pra liberar a seguinte', () => {
    const gessado = [p('a', '08:00', '08:30'), p('b', '08:05')]
    expect(etapaEstaFeita(gessado)).toBe(false)   // → `finalizadoEm` fica null → etapa 2 espera
  })

  it('quando o último fecha, a etapa fica feita e a seguinte libera', () => {
    const gessado = [p('a', '08:00', '08:30'), p('b', '08:05', '08:45')]
    expect(etapaEstaFeita(gessado)).toBe(true)
  })
})

describe('⛔⛔ AS UNIDADES DIVIDEM SÓ ENTRE QUEM MEDIU', () => {
  it('dois relógios de verdade → metade pra cada, minutos de cada um', () => {
    const r = dividirUnidades([p('a', '08:00', '08:30'), p('b', '08:00', '09:00')], 20)
    expect(r).toEqual([
      { colaboradorId: 'a', unidades: 10, minutos: 30 },
      { colaboradorId: 'b', unidades: 10, minutos: 60 },
    ])
    // ⚠️ e o min/un de cada um sai do PRÓPRIO relógio: 3,0 e 6,0 — nunca uma média rateada
    expect(r[0].minutos! / r[0].unidades).toBeCloseTo(3)
    expect(r[1].minutos! / r[1].unidades).toBeCloseTo(6)
  })

  it('⛔⛔ quem foi finalizado PELO GERENTE não divide — a família do tempo-zero', () => {
    const ps = [p('mediu', '08:00', '08:30'), p('gerente-fechou', '08:00', '09:00', true)]
    const r = dividirUnidades(ps, 20)
    // as 20 unidades vão INTEIRAS pra quem tem relógio
    expect(r.find((x) => x.colaboradorId === 'mediu')).toEqual({ colaboradorId: 'mediu', unidades: 20, minutos: 30 })
    // ⛔ e o outro fica com ZERO unidade e tempo A APURAR
    expect(r.find((x) => x.colaboradorId === 'gerente-fechou')).toEqual({ colaboradorId: 'gerente-fechou', unidades: 0, minutos: null })
  })

  it('⛔⛔ REPONDO O DEFEITO: se dividisse com quem não mediu, a velocidade dele DOBRARIA', () => {
    // com a regra certa: 20 un / 30 min = 1,5 min/un pra quem mediu
    const certo = dividirUnidades([p('mediu', '08:00', '08:30'), p('g', '08:00', '09:00', true)], 20)
    expect(certo[0].minutos! / certo[0].unidades).toBeCloseTo(1.5)
    // com o defeito (dividir 10/10), ele apareceria a 3,0 min/un — DUAS VEZES mais lento,
    // e o outro apareceria com unidades sem minuto nenhum. É o mesmo erro de 06/09.
    expect(certo[0].unidades).not.toBe(10)
  })

  it('⚠️ NINGUÉM mediu: as unidades existem, o ritmo é A APURAR', () => {
    const r = dividirUnidades([p('a', '08:00', '08:30', true), p('b', '08:00', '09:00', true)], 20)
    // alguém produziu — o volume conta
    expect(r.map((x) => x.unidades)).toEqual([10, 10])
    // mas a velocidade não se inventa
    expect(r.every((x) => x.minutos === null)).toBe(true)
  })

  it('quem não iniciou nem aparece na divisão', () => {
    const r = dividirUnidades([p('veio', '08:00', '08:30'), p('faltou')], 12)
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({ colaboradorId: 'veio', unidades: 12, minutos: 30 })
  })

  it('etapa sem ninguém: divisão vazia, não erro', () => {
    expect(dividirUnidades([], 10)).toEqual([])
  })

  it('⚠️ quem começou e NÃO terminou não tem minutos — mas continua dividindo', () => {
    // ele trabalhou de verdade; o tempo é que ainda não fechou
    const r = dividirUnidades([p('a', '08:00', '08:30'), p('b', '08:00')], 20)
    expect(r.find((x) => x.colaboradorId === 'b')).toEqual({ colaboradorId: 'b', unidades: 0, minutos: null })
    expect(r.find((x) => x.colaboradorId === 'a')!.unidades).toBe(20)
  })
})
