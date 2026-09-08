// ⭐ O CRONÔMETRO DO POSTO DE COMANDO (08/09/2026) — decisão 1 do desenho aprovado.
//
// *"Cronômetro grande e vivo (o protagonista da tela)"* — o dono.
//
// ⛔ O FORMATO MUDA COM A GRANDEZA, de propósito: até 1h conta **mm:ss** (quem olha quer ver
// o segundo andar — é isso que diz "está vivo"); passando de 1h vira **h:mm**, porque aí o
// segundo é ruído e a hora é a informação. Regra que mora na tela é regra que ninguém prova,
// então ela mora aqui.

import { describe, it, expect } from 'vitest'
// ⛔ IMPORTA a mesma função que a tela usa. A 1ª versão deste arquivo COPIAVA o corpo dela
// aqui — a segunda derivação que este projeto inteiro combate, escrita por mim num teste
// cujo próprio comentário dizia pra não fazer isso.
import { textoDoCronometro as cronometro } from '../cronometro'

const T0 = new Date('2026-09-08T17:12:00.000Z').getTime()
const iso = (ms: number) => new Date(ms).toISOString()

describe('o cronômetro do AGORA', () => {
  it('conta SEGUNDO enquanto é curto — é o que faz a tela parecer viva', () => {
    expect(cronometro(iso(T0), T0 + 2_000)).toBe('00:02')
    expect(cronometro(iso(T0), T0 + 95_000)).toBe('01:35')
    expect(cronometro(iso(T0), T0 + 3_599_000)).toBe('59:59')
  })

  it('⭐ passando de 1h vira h:mm — aí o segundo é ruído', () => {
    expect(cronometro(iso(T0), T0 + 3_600_000)).toBe('1:00')
    expect(cronometro(iso(T0), T0 + 4 * 3_600_000 + 7 * 60_000)).toBe('4:07')
  })

  it('⚠️ relógio do aparelho atrasado não faz o número ficar negativo', () => {
    // o clamp continua aqui; o desvio de verdade é corrigido no tablet (cronometro.ts)
    expect(cronometro(iso(T0), T0 - 60_000)).toBe('00:00')
  })
})
