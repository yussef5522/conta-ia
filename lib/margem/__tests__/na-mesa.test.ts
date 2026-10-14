/**
 * ⭐⭐⭐ "NA MESA" + A FATIA DOS FIXOS — os vermelhos do dono (14/10/2026).
 *
 * *"na mesa com o caso real: (95,90 − 78,34) × 212 = +R$ 3.723"* ·
 * *"MINI FRITAS (hoje ≥ ideal) → 'segura o preço', nunca sugerir baixar"*.
 *
 * ⛔⛔ O segundo é o que importa mais: com o preço de hoje JÁ ganhando do alvo, a diferença é
 * NEGATIVA — e qualquer coisa que a imprima (um `Math.abs`, um sinal solto na tela) vira o
 * sistema **sugerindo baixar preço**. O estado ali é VERDE, valor zero, conselho de freio.
 */
import { describe, it, expect } from 'vitest'
import { fatiaDosFixos, naMesa } from '../na-mesa'

const semNbsp = (s: string) => s.replace(/ /g, ' ')

describe('NA MESA — o dinheiro que o preço de hoje deixa passar', () => {
  it('⭐⭐ o caso real: (95,90 − 78,34) × 212 = +R$ 3.723', () => {
    const m = naMesa({ preco: 78.34, ideal: 95.9, unidades: 212 })
    expect(m.tom).toBe('ambar')
    expect(m.valor, 'o valor exato, ao centavo').toBe(3722.72)
    expect(semNbsp(m.valorTexto!.curto), 'o número REDONDO na frente').toBe('R$ 3.723')
    expect(semNbsp(m.valorTexto!.cheio), 'e o centavo guardado no tooltip').toBe('R$ 3.722,72')
    expect(semNbsp(m.frase)).toBe('subindo pro ideal, entravam +R$ 3.723 no período')
    expect(m.unidades).toBe(212)
  })

  it('⛔⛔ MINI FRITAS — hoje (9,99) ≥ ideal (7,90): "segura o preço, NÃO BAIXA"', () => {
    const m = naMesa({ preco: 9.99, ideal: 7.9, unidades: 399 })
    expect(m.tom).toBe('verde')
    expect(m.frase).toBe('nada — teu preço já ganha desse alvo')
    expect(m.conselho).toBe('segura o preço, não baixa.')
    expect(m.valor, '⛔ ZERO, nunca a diferença negativa').toBe(0)
  })

  it('⛔⛔ e NADA na saída pode soar como ordem de baixar', () => {
    const m = naMesa({ preco: 9.99, ideal: 7.9, unidades: 399 })
    const tudo = `${m.frase} ${m.conselho ?? ''}`
    expect(tudo, 'nenhum "descendo/baixando/reduza"').not.toMatch(/descend|baixand|reduz|diminu/i)
    expect(tudo, 'e nenhum R$ negativo').not.toMatch(/-\s*R\$|R\$\s*-/)
    expect(m.valor!).toBeGreaterThanOrEqual(0)
  })

  it('⭐ preço IGUAL ao ideal já é verde — não existe "entravam R$ 0,00"', () => {
    const m = naMesa({ preco: 7.9, ideal: 7.9, unidades: 100 })
    expect(m.tom).toBe('verde')
    expect(m.frase).not.toContain('entravam')
  })

  it('⛔ "a apurar" com o porquê — e NUNCA R$ 0,00 no lugar', () => {
    const semFicha = naMesa({ preco: 95.9, ideal: null, unidades: 212 })
    expect(semFicha.tom).toBe('neutro')
    expect(semFicha.valor).toBeNull()
    expect(semFicha.porque).toContain('sem ficha')

    const semVenda = naMesa({ preco: null, ideal: 95.9, unidades: 0 })
    expect(semVenda.valor).toBeNull()
    expect(semVenda.porque).toContain('sem venda no período')

    const semUnidade = naMesa({ preco: 78.34, ideal: 95.9, unidades: 0 })
    expect(semUnidade.tom, 'produto sem venda não deixou nada na mesa NEM ganhou do alvo').toBe('neutro')
    expect(semUnidade.valor).toBeNull()
    expect(semUnidade.porque).toContain('nenhuma unidade')
  })
})

describe('A FATIA DOS FIXOS — a letra miúda', () => {
  it('⭐ custo fixo do período ÷ unidades vendidas, COM centavos', () => {
    const f = fatiaDosFixos(43_599.36, 12_400)
    // 43.599,36 ÷ 12.400 = 3,5161... → 3,52
    expect(f.porUnidade).toBe(3.52)
    expect(semNbsp(f.frase)).toBe('cada unidade ainda precisa deixar ~R$ 3,52 pros fixos')
  })

  it('⛔ aqui o R$ vai COM centavos — redondo é régua de MILHAR', () => {
    const f = fatiaDosFixos(43_599.36, 12_400)
    expect(semNbsp(f.frase), 'R$ 4 seria 14% de erro no número que decide preço').toContain('R$ 3,52')
    expect(semNbsp(f.frase)).not.toContain('R$ 4 ')
  })

  it('⛔ sem custo fixo declarado → "a apurar" com o porquê, nunca R$ 0,00', () => {
    const f = fatiaDosFixos(null, 12_400)
    expect(f.porUnidade).toBeNull()
    expect(f.frase).toContain('a apurar')
    expect(f.porque).toContain('não está declarado')
    expect(f.frase).not.toContain('R$ 0,00')
  })

  it('⛔ sem unidade vendida → "a apurar" (dividir por zero não vira infinito na tela)', () => {
    const f = fatiaDosFixos(43_599.36, 0)
    expect(f.porUnidade).toBeNull()
    expect(f.frase).toContain('a apurar')
    expect(f.porque).toContain('nenhuma unidade')
  })
})
