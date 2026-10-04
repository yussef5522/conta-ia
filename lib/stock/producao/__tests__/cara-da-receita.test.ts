/**
 * ⭐⭐ A CARA DA RECEITA — ícone e cor ESTÁVEIS (04/10/2026).
 *
 * **Pedido do dono:** *"mapa ícone/cor estável por tipo: carne/beef, porção, massa, preparo —
 * hash estável, mesma receita sempre igual"*.
 *
 * ⛔⛔ **O TESTE QUE MAIS IMPORTA É O DO CORAL.** Nesta casa coral significa *"algo está errado"*
 * — é a linguagem da ordem ATRASADA. Se uma receita qualquer puder sair coral, toda linha dela
 * nasce com a cara de atrasada e o alarme perde o contraste. A 1ª versão desta lib dava coral
 * pra CARNE, que é a receita mais produzida da Caçula.
 */
import { describe, it, expect } from 'vitest'
import { caraDaReceita } from '../cara-da-receita'

/** os nomes REAIS do cardápio da Caçula — não exemplos inventados */
const REAIS = [
  'beef de xis', 'beef de hamburguer', 'porcao coxao 80 grama', 'porçao queijo 135 grama',
  'metade de bolinha massa de pizza', 'TOMATE PICADO', 'ABRIR MILHO', 'ABRIR ERVILHA',
  'PICAR BRÓCOLIS', 'tomate em rodela', 'QUEIJO CHEDDAR FATIADO', 'MAIONESE', 'CUBA MAIONESE',
  'porçao frango frito 200 grama', 'porcao bacon 80 grama', 'PAO DE XIS', 'Combo Caçula',
]

describe('⛔⛔ coral é do ALARME — nenhuma receita pode usá-lo', () => {
  it('⭐⭐ nenhum nome real sai coral', () => {
    for (const n of REAIS) {
      expect(caraDaReceita(n).familia, `${n} não pode ser coral (é a cor da ordem atrasada)`).not.toBe('coral')
    }
  })

  it('⭐ nem 500 nomes sorteados pelo hash', () => {
    for (let i = 0; i < 500; i++) {
      expect(caraDaReceita(`receita qualquer ${i}`).familia).not.toBe('coral')
    }
  })
})

describe('⭐ o tipo, quando o nome diz o tipo', () => {
  it('⭐ carne/beef', () => {
    for (const n of ['beef de xis', 'beef de hamburguer', 'porcao coxao 80 grama', 'Acém moído', 'GESSADO']) {
      expect(caraDaReceita(n).icone, n).toBe('carne')
    }
  })

  /**
   * ⚠️ `porcao coxao` casa PORCAO **e** COXAO — e a ordem da lista decide. Está certo que
   * COXAO (carne) ganhe: a porção de coxão é carne. É a mesma disciplina de `FRANGO FRITO`
   * antes de `FRITAS` na régua de seções do cardápio.
   */
  it('⭐ porção (quando não é carne)', () => {
    expect(caraDaReceita('porçao queijo 135 grama').icone).toBe('porcao')
    expect(caraDaReceita('porçao frango frito 200 grama').icone).toBe('porcao')
    expect(caraDaReceita('porcao coxao 80 grama').icone, 'carne ganha — a porção de coxão é carne').toBe('carne')
  })

  it('⭐ massa e preparo', () => {
    expect(caraDaReceita('metade de bolinha massa de pizza').icone).toBe('massa')
    expect(caraDaReceita('PAO DE XIS').icone).toBe('massa')
    for (const n of ['TOMATE PICADO', 'ABRIR MILHO', 'PICAR BRÓCOLIS', 'tomate em rodela', 'QUEIJO CHEDDAR FATIADO']) {
      expect(caraDaReceita(n).icone, n).toBe('preparo')
    }
  })

  it('⭐ acento e caixa não mudam nada — `porçao` e `PORCAO` são a mesma palavra', () => {
    expect(caraDaReceita('porçao queijo')).toEqual(caraDaReceita('PORCAO QUEIJO'))
    expect(caraDaReceita('Pão de xis')).toEqual(caraDaReceita('PAO DE XIS'))
  })
})

/**
 * ⛔⛔ A BORDA DE PALAVRA — a cicatriz do `AGUA` que casava dentro de `GUARDANAPO` (08/09).
 */
describe('⛔ a palavra casa com BORDA, nunca como pedaço de outra', () => {
  it('⭐ MASSA não casa dentro de MASSAROCA; CARNE não casa dentro de CARNEIRO', () => {
    expect(caraDaReceita('MASSAROCA doce').icone).toBe('generico')
    expect(caraDaReceita('CARNEIRO assado').icone).toBe('generico')
    expect(caraDaReceita('ABRIRAM a caixa').icone).toBe('generico')
  })

  it('⭐ mas casa no começo, no meio e no fim', () => {
    expect(caraDaReceita('MASSA fresca').icone).toBe('massa')
    expect(caraDaReceita('meia MASSA fina').icone).toBe('massa')
    expect(caraDaReceita('bolinha de MASSA').icone).toBe('massa')
  })
})

describe('⭐⭐ estabilidade — a MESMA receita sempre igual', () => {
  it('⭐ chamar 100× dá a mesma resposta', () => {
    const a = caraDaReceita('Combo Caçula')
    for (let i = 0; i < 100; i++) expect(caraDaReceita('Combo Caçula')).toEqual(a)
  })

  it('⭐ espaço no fim e caixa não trocam a cor (a cicatriz do `sicredi `)', () => {
    const a = caraDaReceita('Combo Caçula')
    expect(caraDaReceita('Combo Caçula ')).toEqual(a)
    expect(caraDaReceita(' combo caçula')).toEqual(a)
  })

  it('⛔ nomes diferentes não caem todos na mesma cor (o hash espalha)', () => {
    const familias = new Set(REAIS.map((n) => caraDaReceita(n).familia))
    expect(familias.size, 'se tudo caísse numa cor, o quadradinho não serviria pra reconhecer').toBeGreaterThan(2)
  })
})
