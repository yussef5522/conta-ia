/**
 * ⭐⭐⭐ GOLDEN DA CARA DA RECEITA — as 44 receitas REAIS da Caçula (05/10/2026).
 *
 * **Medidas em prod, read-only, ANTES de o mapa de 13 grupos ser escrito** (produção dos
 * últimos 90 dias, ordenada por nº de lotes). ⛔ É isso que separa um mapa de comida de uma
 * **imaginação minha sobre o que uma cozinha produz** — e é o mesmo método do golden das
 * faturas e do golden da 1ª ficha: o dado vem primeiro, a régua depois.
 *
 * ⚠️ O grupo esperado de CADA nome foi conferido um por um contra a ordem da lista. Palavra
 * nova no mapa que reclassifique um destes 44 fica **vermelha aqui**, com o nome na mensagem —
 * e aí a pergunta é se o dono quis isso, não se o teste está velho.
 */
import { describe, it, expect } from 'vitest'
import { caraDaReceita, type IconeDaReceita } from '../cara-da-receita'

/** `[nome real, lotes em 90 dias, ícone esperado]` */
const PROD: [string, number, IconeDaReceita][] = [
  ['porçao queijo 135 grama', 38, 'queijo'],
  ['porcao de calabresa 100 grama', 36, 'calabresa'],
  ['porcao bacon 80 grama', 34, 'bacon'],
  ['beef de xis', 33, 'carne'],
  ['beef de hamburger', 30, 'carne'],
  ['porcao frango 100 grama', 27, 'frango'],
  ['porcao coxao 80 grama', 25, 'carne'],
  ['metade de bolinha massa de pizza', 24, 'massa'],
  ['porçao frango frito 200 grama', 20, 'frito'],
  ['tomate em rodela', 14, 'legume'],
  ['porcao iscas de frango 250 grama', 12, 'frango'],
  ['ABRIR MILHO', 12, 'legume'],
  ['porçao calabresa ralada 50 grama', 11, 'calabresa'],
  ['ABRIR ERVILHA', 11, 'legume'],
  ['TOMATE PICADO', 11, 'legume'],
  ['MAIONESE', 11, 'molho'],
  ['PICAR BRÓCOLIS', 10, 'legume'],
  ['CUBA MAIONESE', 10, 'molho'],
  ['CEBOLA FATIADO', 10, 'legume'],
  ['POÇAO MAIONESE 30G', 9, 'molho'],
  ['Porçao aneis de cebola', 9, 'legume'],
  ['OVOS COZIDOS', 8, 'ovo'],
  ['porcao beef de alimenuta', 6, 'carne'],
  ['Frango Black Friday 150G', 6, 'frango'],
  ['QUEIJO Black Friday 200G', 6, 'queijo'],
  ['Pizza congelada de calabresa', 5, 'massa'],
  ['PORÇAO CALABRESA 85g congelada', 5, 'calabresa'],
  ['porcao frango prato 150 grama', 4, 'frango'],
  ['Parmigiana de frango 150g', 4, 'frango'],
  ['ENCHER TUBO MAIONESE', 4, 'molho'],
  ['PIMENTÃO PICADO', 4, 'legume'],
  ['QUEIJO CHEDDAR FATIADO', 4, 'queijo'],
  ['porcao coax prato 200 grama', 3, 'carne'],
  ['beef aparmegiana de carne 120g', 3, 'carne'],
  ['CALABRESA BLACK 120 GRAMAS', 3, 'calabresa'],
  ['porcao queijo empanado 100 grama', 2, 'queijo'],
  ['Hamburger de frango 150 grama', 2, 'frango'],
  ['Aneis de cebola hamburguer', 2, 'legume'],
  ['PIZZA FRANGO CATUPIRY CONGELADA', 2, 'massa'],
  ['porcao de carne 100 grama', 1, 'carne'],
  ['porcao file prato 200 grama', 1, 'carne'],
  ['porcao file xis', 1, 'carne'],
  ['porcao chuleta', 1, 'carne'],
  ['PORÇAO DE CHOCOLATE PRETO 50G', 1, 'porcao'],
]

describe('⭐⭐⭐ as 44 receitas de prod, uma por uma', () => {
  it('⭐ cada nome real cai no grupo que o dono reconhece', () => {
    for (const [nome, , esperado] of PROD) {
      expect(caraDaReceita(nome).icone, `${nome}`).toBe(esperado)
    }
  })

  /**
   * ⛔⛔ **OS QUATRO CASOS QUE A ORDEM DA LISTA DECIDE** — cada um é um nome REAL que casa duas
   * palavras, e cada um justifica uma linha da ordem. Trocar a ordem quebra exatamente estes.
   */
  it('⛔⛔ os desempates que vêm do dado, não de teoria', () => {
    expect(caraDaReceita('porçao frango frito 200 grama').icone, 'FRITO antes de FRANGO').toBe('frito')
    expect(caraDaReceita('Hamburger de frango 150 grama').icone, 'FRANGO antes de CARNE').toBe('frango')
    expect(caraDaReceita('Pizza congelada de calabresa').icone, 'MASSA antes de CALABRESA').toBe('massa')
    expect(caraDaReceita('porcao queijo empanado 100 grama').icone, 'QUEIJO antes de FRITO/EMPANADO').toBe('queijo')
    /** ⭐ e o irmão que prova que o anterior não é acidente: sem a palavra "frango", volta a ser carne */
    expect(caraDaReceita('beef de hamburger').icone).toBe('carne')
  })

  /** ⛔ coral é do ALARME — 44 nomes reais e nenhum pode nascer com a cara de ordem atrasada */
  it('⛔⛔ nenhuma das 44 sai coral', () => {
    for (const [nome] of PROD) {
      expect(caraDaReceita(nome).familia, nome).not.toBe('coral')
    }
  })

  /**
   * ⭐ ESTÁVEL é o ponto: a mesma receita, sempre a mesma cara — em toda linha, em todo dia, em
   * toda sessão. Cor sorteada no render destruiria o reconhecimento que a coluna existe pra ter.
   */
  it('⭐⭐ a MESMA receita devolve SEMPRE a mesma cara', () => {
    for (const [nome] of PROD) {
      const a = caraDaReceita(nome)
      for (let i = 0; i < 20; i++) expect(caraDaReceita(nome)).toEqual(a)
    }
  })

  /** ⚠️ e o espaço no fim não cria uma segunda receita (a cicatriz da conta `'sicredi '`) */
  it('⭐ espaço e caixa não mudam a cara', () => {
    expect(caraDaReceita('porçao queijo 135 grama ')).toEqual(caraDaReceita('PORCAO QUEIJO 135 GRAMA'))
  })

  /**
   * ⚠️⚠️ **O GRUPO GENÉRICO NÃO PODE VIRAR A MAIORIA** — se virar, o mapa deixou de reconhecer
   * a cozinha e o quadradinho volta a ser decoração. Medido: 1 das 44 (o chocolate), e o
   * `generico` (hash) não aparece em NENHUMA.
   */
  it('⭐⭐ o mapa reconhece a cozinha: 43 das 44 por tipo, zero no hash', () => {
    const genericas = PROD.filter(([n]) => caraDaReceita(n).icone === 'generico')
    expect(genericas.map(([n]) => n), 'nenhuma receita real deveria cair no hash').toEqual([])
    const porcaoSeca = PROD.filter(([n]) => caraDaReceita(n).icone === 'porcao')
    expect(porcaoSeca.length, 'só o chocolate, que não diz comida nenhuma conhecida').toBe(1)
  })
})
