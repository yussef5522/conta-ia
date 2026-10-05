/**
 * ⭐⭐⭐ O FISCAL — *"o declarado cabe no material separado?"* (04/10/2026).
 *
 * **Ordem do dono:** *"a conta segue rodando por baixo. Onde aparece: na PÁGINA DA ORDEM (com a
 * frase de balcão), no SININHO quando vira caso impossível, e na LISTA da home só um pontinho
 * vermelho — sem número, sem pílula."*
 *
 * ⭐⭐ **A ÁLGEBRA É O CORAÇÃO, e é ela que faz o fiscal não ser uma 2ª régua:**
 * `permitido = pedido × real ÷ plano`, com `plano = insumoDoPedido(dose, pedido, loteBase)` —
 * **o `pedido` se CANCELA**. Ou seja o fiscal mede o MATERIAL, não a meta; e por isso ele vale
 * igual na ordem com pedido DECLARADO (o `stockOrdemMeta`, de 04/10 em diante) e na ordem
 * antiga, cujo pedido é DERIVADO da escala. Há um teste exigindo isso explicitamente — se
 * alguém trocar a conta por uma multiplicação própria da dose, ele morde.
 */
import { describe, it, expect } from 'vitest'
import {
  eficienciaDaOrdem,
  fiscalDoDeclarado,
  fraseDoFiscal,
  TETO_FISICO,
} from '../eficiencia-da-ordem'

/** uma ficha de lote 10 que pede 1 unidade de cada componente por lote */
const ordem = (escala: number, qtdGerada: number, comps: { nome: string; porLote: number; consumido: number }[]) =>
  eficienciaDaOrdem({
    escala,
    loteBase: 10,
    qtdGerada,
    componentes: comps.map((c) => ({ nome: c.nome, unidade: 'KG', porLote: c.porLote, consumido: c.consumido })),
  })

describe('⭐⭐ o GARGALO é o componente que limita (mínimo, nunca média)', () => {
  it('⭐ o componente mais restritivo manda, e é ele que a frase nomeia', () => {
    // pedido 20 · plano 2 de cada · A consumiu 2 (permite 20) · B consumiu 1 (permite 10)
    const ef = ordem(2, 10, [
      { nome: 'Acém', porLote: 1, consumido: 2 },
      { nome: 'Gordura', porLote: 1, consumido: 1 },
    ])
    expect(ef.pedido).toBe(20)
    expect(ef.fiscal.permitido, 'quem limita é o menor — o material acaba junto com ele').toBe(10)
    expect(ef.fiscal.gargalo).toBe('Gordura')
  })

  /**
   * ⚠️ Média seria o erro clássico: `(20 + 10) / 2 = 15` deixaria passar um declarado de 14 que
   * o material NÃO dava. *O estoque não faz média — ele acaba.*
   */
  it('⛔ não é média dos componentes', () => {
    const ef = ordem(2, 14, [
      { nome: 'Acém', porLote: 1, consumido: 2 },
      { nome: 'Gordura', porLote: 1, consumido: 1 },
    ])
    expect(ef.fiscal.permitido).toBe(10)
    expect(ef.fiscal.pctFisico, '14 sobre 10 = 140%').toBe(1.4)
    expect(ef.fiscal.impossivel).toBe(true)
  })

  /**
   * ⛔⛔ Componente com `plano` ZERO **não limita**. Tratá-lo como limite daria `permitido: 0` e
   * o fiscal acusaria TODA ordem que tenha um componente de dose zero — *alarme em tudo é
   * alarme em nada* (a lição dos 111 falsos do juiz de vendas).
   */
  it('⛔⛔ componente sem dose na receita sai da conta, não zera o permitido', () => {
    const ef = ordem(2, 20, [
      { nome: 'Acém', porLote: 1, consumido: 2 },
      { nome: 'Etiqueta', porLote: 0, consumido: 0 },
    ])
    expect(ef.fiscal.permitido).toBe(20)
    expect(ef.fiscal.gargalo).toBe('Acém')
    expect(ef.fiscal.impossivel).toBe(false)
  })

  /**
   * ⚠️⚠️ **ESTE É O CASO QUE ISOLA A TRAVA — e eu só soube porque a REGRA 11 cobrou.** Com o
   * componente de dose zero DEPOIS, remover o `continue` passa VERDE: `0/0` dá `NaN`, e
   * `NaN < 20` é `false`, então o menor sobrevive por acidente. Com ele **PRIMEIRO**, o `NaN`
   * entra como `permitido` (porque o 1º componente não tem com quem comparar) e **nenhuma
   * comparação seguinte o substitui** — a tela passaria a imprimir *"permite ~NaN"*.
   * *Guard testado só na ordem conveniente é guard que não morde.*
   */
  it('⛔⛔ o componente de dose zero vindo PRIMEIRO não envenena o permitido', () => {
    const ef = ordem(2, 20, [
      { nome: 'Etiqueta', porLote: 0, consumido: 0 },
      { nome: 'Acém', porLote: 1, consumido: 2 },
    ])
    expect(Number.isNaN(ef.fiscal.permitido as number), 'NaN na tela é pior que silêncio').toBe(false)
    expect(ef.fiscal.permitido).toBe(20)
    expect(ef.fiscal.gargalo).toBe('Acém')
  })
})

describe('⭐⭐ o pedido se CANCELA — o fiscal mede material, não meta', () => {
  it('⭐⭐ mesmo consumo e mesma ficha ⇒ mesmo permitido, com pedidos diferentes', () => {
    const pequena = ordem(2, 20, [{ nome: 'Acém', porLote: 1, consumido: 2 }])
    const grande = ordem(5, 50, [{ nome: 'Acém', porLote: 1, consumido: 2 }])
    expect(pequena.pedido).toBe(20)
    expect(grande.pedido).toBe(50)
    expect(
      grande.fiscal.permitido,
      'o pedido cancela na álgebra: 2 KG de acém dão o mesmo tanto de porção, pediram o que pediram',
    ).toBe(pequena.fiscal.permitido)
    expect(pequena.fiscal.permitido).toBe(20)
  })

  /** ⚠️ sem pedido declarável (escala/lote zerados) não há o que fiscalizar — e isso é `null`,
   *  nunca zero: zero afirmaria que o material não permitia nada. */
  it('⛔ sem pedido, o fiscal se cala (null, não zero)', () => {
    const ef = ordem(0, 20, [{ nome: 'Acém', porLote: 1, consumido: 2 }])
    expect(ef.fiscal).toEqual({ permitido: null, gargalo: null, pctFisico: null, impossivel: false })
    expect(fraseDoFiscal(ef.fiscal, 20, 'UN'), 'frase sem conta é ruído').toBeNull()
  })

  it('⛔ ficha sem componente nenhum também se cala', () => {
    const ef = ordem(2, 20, [])
    expect(ef.fiscal.permitido).toBeNull()
    expect(ef.fiscal.impossivel).toBe(false)
  })
})

describe('⛔⛔ o degrau: 120% é ruído de cozinha, acima disso é lançamento', () => {
  it('⭐ o teto é o do dono', () => {
    expect(TETO_FISICO).toBe(1.2)
  })

  it('⭐ exatamente 120% NÃO acusa — aparas e arredondamento cabem aí', () => {
    const ef = ordem(2, 24, [{ nome: 'Acém', porLote: 1, consumido: 2 }])
    expect(ef.fiscal.pctFisico).toBe(1.2)
    expect(ef.fiscal.impossivel).toBe(false)
  })

  it('⛔ acima do teto acusa', () => {
    const ef = ordem(2, 25, [{ nome: 'Acém', porLote: 1, consumido: 2 }])
    expect(ef.fiscal.pctFisico).toBe(1.25)
    expect(ef.fiscal.impossivel).toBe(true)
  })

  /** ⭐ render MENOS nunca é caso de fiscal — é o P8 (eficiência), e já tem alarme próprio */
  it('⭐ declarar menos do que o material dava não é caso do fiscal', () => {
    const ef = ordem(2, 12, [{ nome: 'Acém', porLote: 1, consumido: 2 }])
    expect(ef.fiscal.pctFisico).toBe(0.6)
    expect(ef.fiscal.impossivel, 'sobrou material: é rendimento, não lançamento torto').toBe(false)
  })

  /**
   * ⛔⛔ PERMITIDO ZERO COM DECLARADO > 0 é impossível **por definição**, não por degrau: saiu
   * produto sem material nenhum sair da prateleira. Esse é o caso em que o degrau de 120% não
   * serve (não existe % de zero).
   */
  it('⛔⛔ material zero com produto declarado = impossível, sem precisar de percentual', () => {
    const ef = ordem(2, 20, [{ nome: 'Acém', porLote: 1, consumido: 0 }])
    expect(ef.fiscal.permitido).toBe(0)
    expect(ef.fiscal.pctFisico, 'não existe percentual de zero').toBeNull()
    expect(ef.fiscal.impossivel).toBe(true)
  })

  it('⭐ material zero e NADA declarado não acusa (ordem que não produziu)', () => {
    const f = fiscalDoDeclarado(20, 0, [{ nome: 'Acém', unidade: 'KG', plano: 2, real: 0, gap: -2 }])
    expect(f.permitido).toBe(0)
    expect(f.impossivel, 'nada saiu: não há o que conferir').toBe(false)
  })
})

describe('⭐⭐ a frase de balcão — a que o dono ditou', () => {
  it('⭐ ela diz o que o material permitia, quem limitou e o que foi declarado', () => {
    const ef = ordem(2, 25, [
      { nome: 'Acém', porLote: 1, consumido: 2 },
      { nome: 'Gordura', porLote: 1, consumido: 1 },
    ])
    const frase = fraseDoFiscal(ef.fiscal, ef.produzido, 'UN')
    expect(frase).toBe(
      'pelo material separado, a receita permite ~10 UN (limitado por Gordura); foram declaradas 25 UN — confere o lançamento',
    )
  })

  /** ⚠️ o `~` é honestidade: consumo com 3 casas contra dose com até 6 sempre deixa resíduo.
   *  Número seco faria o dono tratar arredondamento como fato. */
  it('⚠️ o permitido vai com `~` (é estimativa do que o material dava)', () => {
    const ef = ordem(2, 20, [{ nome: 'Acém', porLote: 1, consumido: 2 }])
    expect(fraseDoFiscal(ef.fiscal, ef.produzido, 'UN')).toContain('permite ~20 UN')
  })

  it('⭐ dentro do teto a frase existe e NÃO cobra nada', () => {
    const ef = ordem(2, 20, [{ nome: 'Acém', porLote: 1, consumido: 2 }])
    const frase = fraseDoFiscal(ef.fiscal, ef.produzido, 'UN')!
    expect(frase).not.toContain('confere o lançamento')
    expect(frase, 'informa sem alarmar').toContain('foram declaradas 20 UN')
  })

  it('⭐ item sem unidade cadastrada não escreve espaço solto', () => {
    const ef = ordem(2, 20, [{ nome: 'Acém', porLote: 1, consumido: 2 }])
    expect(fraseDoFiscal(ef.fiscal, ef.produzido, '')).toBe(
      'pelo material separado, a receita permite ~20 (limitado por Acém); foram declaradas 20',
    )
  })
})

describe('⭐⭐ o caso REAL que motivou o sprint (prod, 03/10)', () => {
  /**
   * `porçao frango frito 200g`: pedido 45,91 · produziu **153** · FILE DE FRANGO plano 9,18 e
   * consumo real 14,95 — a ordem que o relatório mostrou como **333%**. O fiscal responde a
   * outra pergunta: o material consumido dava ~74,8 porções, e foram declaradas 153.
   */
  it('⛔⛔ o frango frito: material pra ~74,8 e 153 declaradas', () => {
    const f = fiscalDoDeclarado(45.91, 153, [
      { nome: 'FILE DE PEITO DE FRANGO', unidade: 'KG', plano: 9.18, real: 14.95, gap: 5.77 },
    ])
    expect(f.permitido).toBeCloseTo(74.77, 1)
    expect(f.pctFisico!, 'mais que o DOBRO do que o material dava').toBeGreaterThan(2)
    expect(f.impossivel).toBe(true)
    expect(f.gargalo).toBe('FILE DE PEITO DE FRANGO')
  })

  /**
   * ⭐⭐ **O CONTRASTE QUE SEPARA O FISCAL DO P8 — e ele é o que impede o pontinho vermelho de
   * aparecer em toda linha de rendimento alto.** Quando a cozinha produz MAIS e consome
   * proporcionalmente mais, a ficha é que está apertada: o P8 diz *"saiu mais do que a receita
   * promete"* e o **fiscal cala**, porque o material separado comportava o que foi declarado.
   */
  it('⭐⭐ produziu mais CONSUMINDO mais: o P8 fala, o fiscal cala', () => {
    const ef = eficienciaDaOrdem({
      escala: 6.78,
      loteBase: 10,
      qtdGerada: 92,
      // plano 6,17 pro pedido de 67,8 — e consumiu 8,37, que é material pra ~92
      componentes: [{ nome: 'Acém', unidade: 'KG', porLote: 0.91, consumido: 8.37 }],
    })
    expect(ef.faixa, 'o P8 vê rendimento acima do prometido').toBe('ACIMA')
    expect(ef.fiscal.permitido!, 'o material dava ~92').toBeCloseTo(92, 0)
    expect(ef.fiscal.impossivel, 'o material comporta o declarado: é ficha apertada, não lançamento').toBe(false)
  })

  /**
   * ⚠️⚠️ **E O MESMO LOTE COM O CONSUMO DO PLANO É CASO DE FISCAL — isto é um achado, não uma
   * escolha de teste.** Em prod o `beef de xis` fechou *pedi 67,80 · produziu 92 · acém plano
   * 6,17 e real 6,17 (ao grama)*: o material que saiu da câmara dava ~67,8 porções e foram
   * declaradas 92. **As 24 a mais não têm material** — ou a dose da ficha está acima do real,
   * ou saiu unidade que ninguém contou. É exatamente a pergunta que o dono quer na tela.
   */
  it('⛔⛔ consumo IGUAL ao plano com 136% declarado: o fiscal acusa', () => {
    const ef = eficienciaDaOrdem({
      escala: 6.78,
      loteBase: 10,
      qtdGerada: 92,
      componentes: [{ nome: 'Acém', unidade: 'KG', porLote: 0.91, consumido: 6.17 }],
    })
    expect(ef.fiscal.permitido!).toBeCloseTo(67.8, 0)
    expect(ef.fiscal.impossivel).toBe(true)
  })
})
