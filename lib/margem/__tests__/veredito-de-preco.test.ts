/**
 * ⭐⭐⭐ A PORTA ÚNICA DO VEREDITO DE PREÇO — os vermelhos que o dono ditou (13/10/2026).
 *
 * Cada `it` aqui é um dos vermelhos da ordem dele, escrito ANTES da implementação (REGRA 11
 * ao pé da letra): farol com ponto decimal · charme abaixo do ideal cru · preço que não
 * termina em ,90 · sobra do iFood MENOR que a do balcão · preço do balcão copiado pro iFood ·
 * produto sem ficha mostrando número.
 *
 * ⛔ Os dois cartões (montador e "escolha um produto") chamam ESTA lib. Conta de veredito
 * duplicada em tela é a doença que esta casa mais paga — e aqui ela seria pior que de
 * costume: as duas telas ficam a dez centímetros uma da outra na MESMA página.
 */
import { describe, it, expect } from 'vitest'
import {
  charme,
  farolDoPreco,
  fraseDoEspecialista,
  precoIdealDoCanal,
  precosIdeais,
  montarBlocoDoVeredito,
  reguaDaSecao,
  REGUA_POR_SECAO,
  TETO_AMBAR_PCT,
} from '../veredito-de-preco'

/** a taxa do iFood vem da porta de canais; aqui ela entra por parâmetro, como na lib */
const IFOOD = { canal: 'iFood', taxaPct: 0.2 }
const BALCAO = { canal: 'balcão', taxaPct: 0 }

describe('⭐ FAROL — o caso real do dono: custo 25,42 / preço 39,99', () => {
  it('⛔ VERMELHO DO DONO: sai "63,6%" coral — ponto decimal no % é defeito', () => {
    const f = farolDoPreco(25.42, 39.99, 33)

    expect(f.tom, 'CMV de 63,6% está muito acima de 45 — é coral').toBe('coral')
    expect(f.rotulo).toContain('63,6%')
    expect(f.rotulo, 'o dono escreve com VÍRGULA — ponto decimal aqui é o vermelho').not.toMatch(/\d\.\d/)
    expect(f.rotulo).toContain('fora do padrão')
  })

  it('o CMV viaja como FRAÇÃO, a convenção da casa (taxaPct 0,2 / margem.pct)', () => {
    const f = farolDoPreco(25.42, 39.99, 33)
    expect(f.cmvPct).toBeCloseTo(0.6357, 4)
  })

  it('≤ teto da categoria é verde "no padrão"', () => {
    const f = farolDoPreco(10, 33.9, 33) // 29,5%
    expect(f.tom).toBe('verde')
    expect(f.rotulo).toContain('no padrão')
    expect(f.rotulo).toContain('29,5%')
  })

  it('entre o teto e 45 é âmbar "apertado" — e o degrau de 45 tem dono', () => {
    const f = farolDoPreco(40, 100, 33)
    expect(f.tom).toBe('ambar')
    expect(f.rotulo).toContain('apertado')
    expect(TETO_AMBAR_PCT, 'número solto em tela é a 2ª régua no dia em que ele mudar').toBe(45)
  })

  it('⛔ VERMELHO DO DONO: sem ficha (custo null) NÃO mostra número — farol NEUTRO', () => {
    const f = farolDoPreco(null, 39.99, 33)
    expect(f.tom).toBe('neutro')
    expect(f.cmvPct).toBeNull()
    expect(f.rotulo, 'número inventado numa tela de dinheiro é pior que ausência').not.toMatch(/\d/)
  })

  it('sem preço também é NEUTRO — e nunca 0%', () => {
    expect(farolDoPreco(10, null, 33).tom).toBe('neutro')
    expect(farolDoPreco(10, 0, 33).tom).toBe('neutro')
  })

  it('fatia pendente pede o farol de "fecha a pizza", nunca um número parcial', () => {
    const f = farolDoPreco(null, 62.9, 33, { motivoNeutro: 'fecha a pizza' })
    expect(f.tom).toBe('neutro')
    expect(f.rotulo).toBe('fecha a pizza')
  })
})

describe('⭐ CHARME — todo preço ideal termina em ,90 e NUNCA fica abaixo do ideal cru', () => {
  it('⛔ VERMELHO DO DONO: o charme nunca desce abaixo do ideal cru', () => {
    // 30,30 → descer pra 29,90 cortaria a margem que o alvo pediu
    expect(charme(30.3)).toBe(30.9)
    expect(charme(30.3)).toBeGreaterThanOrEqual(30.3)
  })

  it('⛔ VERMELHO DO DONO: o preço ideal SEMPRE termina em ,90', () => {
    for (const v of [0.01, 7.5, 29.9, 30.3, 41.11, 76.99, 100]) {
      const r = charme(v)
      expect(`${r.toFixed(2)}`, `charme(${v}) tem que terminar em ,90`).toMatch(/\.90$/)
      expect(r, `charme(${v}) não pode descer abaixo do cru`).toBeGreaterThanOrEqual(v)
    }
  })

  it('valor que JÁ termina em ,90 fica como está — subir seria inventar margem', () => {
    expect(charme(29.9)).toBe(29.9)
  })

  it('o ideal do canal é custo ÷ alvo, com o charme POR CIMA', () => {
    // custo 10, alvo 33% → cru 30,303… → 30,90
    expect(precoIdealDoCanal(10, 33, BALCAO)).toBe(30.9)
  })
})

describe('⭐⭐ GROSS-UP — o iFood tem preço PRÓPRIO, nunca o do balcão', () => {
  const custo = 10
  const alvo = 33

  it('⛔ VERMELHO DO DONO: o preço do iFood NUNCA é o do balcão', () => {
    const p = precosIdeais(custo, alvo, [BALCAO, IFOOD])
    const balcao = p.find((c) => c.canal === 'balcão')!
    const ifood = p.find((c) => c.canal === 'iFood')!

    expect(ifood.preco, 'copiar o preço do balcão pro iFood entrega a taxa de graça').not.toBe(balcao.preco)
    expect(ifood.preco!).toBeGreaterThan(balcao.preco!)
  })

  it('⛔ VERMELHO DO DONO: a sobra do iFood é IGUAL ou MAIOR que a do balcão, nunca menor', () => {
    for (const c of [1, 5.5, 10, 13.4, 25.42, 100]) {
      for (const a of [28, 30, 33, 35, 40, 45]) {
        const p = precosIdeais(c, a, [BALCAO, IFOOD])
        const sB = p.find((x) => x.canal === 'balcão')!.sobra!
        const sI = p.find((x) => x.canal === 'iFood')!.sobra!
        expect(sI, `custo ${c} alvo ${a}: o gross-up existe pra sobrar o mesmo`).toBeGreaterThanOrEqual(sB - 1e-9)
      }
    }
  })

  it('o gross-up é EXATO antes do charme (a referência manda assim)', () => {
    // custo 10, alvo 33 → balcão 30,90, sobra 20,90
    // cru do iFood = (10 + 20,90) / 0,80 = 38,625 → charme 38,90
    const p = precosIdeais(10, 33, [IFOOD])
    expect(p[0].preco).toBe(38.9)
    expect(p[0].sobra).toBeCloseTo(38.9 * 0.8 - 10, 2) // 21,12
  })

  it('canal com taxa 0 (tele própria) tem o MESMO preço do balcão — não é gross-up', () => {
    const p = precosIdeais(10, 33, [BALCAO, { canal: 'tele-entrega própria', taxaPct: 0 }])
    expect(p[0].preco).toBe(p[1].preco)
  })

  it('⛔ taxa "a declarar" (null) NUNCA vira 0% — devolve "a apurar"', () => {
    const p = precosIdeais(10, 33, [{ canal: 'iFood', taxaPct: null }])
    expect(p[0].preco).toBeNull()
    expect(p[0].porque).toMatch(/taxa/i)
  })

  it('⛔ VERMELHO DO DONO: sem ficha, TODO canal é "a apurar" — zero número inventado', () => {
    const p = precosIdeais(null, 33, [BALCAO, IFOOD])
    expect(p.every((c) => c.preco === null && c.sobra === null)).toBe(true)
    expect(p[0].porque).toMatch(/ficha/i)
  })
})

describe('⭐ A RÉGUA POR CATEGORIA — um mapa só, nunca dois', () => {
  it('os tetos que o dono ditou, verbatim', () => {
    expect(reguaDaSecao('PIZZAS').tetoPct).toBe(33)
    expect(reguaDaSecao('LANCHES').tetoPct).toBe(35)
    expect(reguaDaSecao('XIS').tetoPct).toBe(35)
    expect(reguaDaSecao('BURGERS').tetoPct).toBe(35)
    expect(reguaDaSecao('PORCOES').tetoPct).toBe(40)
  })

  it('os alvos que o dono ditou, verbatim', () => {
    expect(reguaDaSecao('PIZZAS').alvosPct).toEqual([28, 33, 45])
    expect(reguaDaSecao('LANCHES').alvosPct).toEqual([30, 35, 45])
  })

  it('⭐ a DERIVAÇÃO é a mesma régua dos dois que ele deu: [teto−5, teto, 45]', () => {
    for (const secao of Object.keys(REGUA_POR_SECAO)) {
      const r = REGUA_POR_SECAO[secao]
      expect(r.alvosPct, `${secao} tem que seguir a régua dos declarados`).toEqual([
        r.tetoPct - 5,
        r.tetoPct,
        TETO_AMBAR_PCT,
      ])
    }
  })

  it('o alvo do meio é SEMPRE o teto da categoria — o default é o padrão da casa', () => {
    for (const secao of Object.keys(REGUA_POR_SECAO)) {
      const r = REGUA_POR_SECAO[secao]
      expect(r.alvosPct[1]).toBe(r.tetoPct)
    }
  })

  it('⛔ seção que o dono NÃO declarou vem MARCADA como derivada', () => {
    expect(reguaDaSecao('PIZZAS').origem).toBe('DECLARADO')
    expect(reguaDaSecao('BEBIDAS').origem).toBe('DERIVADO')
    expect(reguaDaSecao('OUTROS').origem).toBe('DERIVADO')
  })

  it('⛔ seção desconhecida/ausente NÃO explode e NÃO chuta teto apertado', () => {
    const r = reguaDaSecao(null)
    expect(r.tetoPct).toBe(40)
    expect(r.origem).toBe('DERIVADO')
    // teto apertado num produto sem categoria faria o farol gritar à toa — e alarme
    // falso repetido é como um alarme morre.
    expect(r.tetoPct).toBeGreaterThanOrEqual(35)
  })

  it('⛔ TODA seção do vocabulário do cardápio tem régua — seção nova sem teto é vermelho', async () => {
    const { SECOES_SEED } = await import('@/lib/stock/cardapio/secoes')
    for (const s of SECOES_SEED) {
      expect(REGUA_POR_SECAO[s.chave], `a seção ${s.chave} do cardápio ficou sem teto`).toBeDefined()
    }
  })
})

describe('⭐⭐ O BLOCO — a chamada ÚNICA que os DOIS cartões fazem', () => {
  const canais = [BALCAO, { canal: 'tele-entrega própria', taxaPct: 0 }, IFOOD]

  it('⭐ O CASO REAL DO DONO: grande filé+bacon · custo 25,42 · preço 39,99', () => {
    const b = montarBlocoDoVeredito({
      custo: 25.42,
      preco: 39.99,
      tetoPct: 33,
      alvosPct: [28, 33, 45],
      alvoPct: 33,
      canais,
      tipo: 'pizza',
    })

    expect(b.farol.rotulo).toBe('CMV 63,6% · fora do padrão')
    expect(b.farol.tom).toBe('coral')
    expect(b.frase).toContain('premium')

    const balcao = b.canais[0]
    const ifood = b.canais[2]
    // custo 25,42 ÷ 0,33 = 77,0303… → charme 77,90 · sobra 52,48
    expect(balcao.preco).toBe(77.9)
    expect(balcao.sobra).toBe(52.48)
    // gross-up: (25,42 + 52,48) ÷ 0,80 = 97,375 → charme 97,90
    expect(ifood.preco).toBe(97.9)
    expect(ifood.sobra!, 'a sobra do iFood nunca é menor').toBeGreaterThanOrEqual(balcao.sobra!)
  })

  it('⭐ os TRÊS alvos do dono, com o MESMO custo (é o que o chip troca)', () => {
    const emAlvo = (a: number) =>
      montarBlocoDoVeredito({
        custo: 25.42,
        preco: 39.99,
        tetoPct: 33,
        alvosPct: [28, 33, 45],
        alvoPct: a,
        canais,
        tipo: 'pizza',
      }).canais

    // ⚠️ alvo mais APERTADO pede preço MAIOR (o custo tem que caber numa fatia menor do preço)
    expect(emAlvo(28)[0].preco!).toBeGreaterThan(emAlvo(33)[0].preco!)
    expect(emAlvo(33)[0].preco!).toBeGreaterThan(emAlvo(45)[0].preco!)

    for (const a of [28, 33, 45]) {
      const c = emAlvo(a)
      expect(c[2].sobra!, `alvo ${a}: o gross-up vale em todo alvo`).toBeGreaterThanOrEqual(c[0].sobra!)
    }
  })

  it('⛔ MONTADOR com fatia em aberto: farol "fecha a pizza" e canais "a apurar"', () => {
    const b = montarBlocoDoVeredito({
      custo: null,
      preco: 62.9,
      tetoPct: 33,
      alvosPct: [28, 33, 45],
      alvoPct: 33,
      canais,
      tipo: 'pizza',
      motivoNeutro: 'fecha a pizza',
    })
    expect(b.farol.rotulo).toBe('fecha a pizza')
    expect(b.canais.every((c) => c.preco === null)).toBe(true)
    expect(b.frase).toContain('cria a ficha')
  })

  it('⛔ PRODUTO sem ficha: o neutro é "—" (outro estado, outra frase que a tela usa)', () => {
    const b = montarBlocoDoVeredito({
      custo: null,
      preco: 24.9,
      tetoPct: 40,
      alvosPct: [35, 40, 45],
      alvoPct: 40,
      canais,
      tipo: 'produto',
    })
    expect(b.farol.rotulo).toBe('—')
    expect(b.farol.rotulo).not.toMatch(/\d/)
  })

  it('o bloco carrega os chips e qual está ligado — a tela não escolhe alvo sozinha', () => {
    const b = montarBlocoDoVeredito({
      custo: 13.4,
      preco: 29.9,
      tetoPct: 35,
      alvosPct: [30, 35, 45],
      alvoPct: 35,
      canais,
      tipo: 'produto',
    })
    expect(b.alvosPct).toEqual([30, 35, 45])
    expect(b.alvoPct).toBe(35)
    expect(b.tetoPct).toBe(35)
    expect(b.farol.tom, 'xis a 44,8% com teto 35 é apertado, não fora do padrão').toBe('ambar')
  })
})

describe('⭐ A FRASE DO ESPECIALISTA — curta, por estado, língua do balcão', () => {
  it('sem ficha: convida a criar, e é o convite que o dono ditou', () => {
    const f = fraseDoEspecialista(null, 39.99, 33, 'pizza')
    expect(f).toContain('cria a ficha')
    expect(f).toContain('na hora')
  })

  it('sem preço: pede o preço', () => {
    expect(fraseDoEspecialista(10, null, 33, 'produto')).toContain('digita o preço')
  })

  it('fora do padrão: a frase da PIZZA fala de sabor premium', () => {
    const f = fraseDoEspecialista(25.42, 39.99, 33, 'pizza')
    expect(f).toContain('premium')
  })

  it('fora do padrão: a frase do PRODUTO fala de tabela/ficha', () => {
    const f = fraseDoEspecialista(20, 30, 35, 'produto')
    expect(f).toContain('revisa a ficha')
    expect(f, 'produto não tem "sabor premium"').not.toContain('premium')
  })

  it('acima do teto mas dentro de 45: fala da média do cardápio', () => {
    expect(fraseDoEspecialista(40, 100, 33, 'pizza')).toContain('resto do cardápio')
  })

  it('saudável: fala do jogo da média', () => {
    expect(fraseDoEspecialista(10, 33.9, 33, 'pizza')).toContain('saudável')
  })

  it('⛔ a frase é TEXTO PURO — markdown não atravessa pra UI (cicatriz de 11/10)', () => {
    const todas = [
      fraseDoEspecialista(null, 1, 33, 'pizza'),
      fraseDoEspecialista(10, null, 33, 'pizza'),
      fraseDoEspecialista(25.42, 39.99, 33, 'pizza'),
      fraseDoEspecialista(20, 30, 35, 'produto'),
      fraseDoEspecialista(40, 100, 33, 'pizza'),
      fraseDoEspecialista(10, 33.9, 33, 'pizza'),
    ]
    for (const f of todas) {
      expect(f, 'a tela renderiza {frase} como texto — o rótulo é da TELA').not.toMatch(/\*\*|<b>|__/)
      expect(f.length, 'curta: o dono lê de pé, no balcão').toBeLessThan(170)
    }
  })
})
