/**
 * ⭐⭐⭐ A MATEMÁTICA BATE COM A REFERÊNCIA — E O GUARD ABRE O ARQUIVO (16/10/2026).
 *
 * **`docs/consumo-e-compras-referencia.html` é a LEI.** O `<script>` dela é a especificação da
 * conta, e este guard **não repete os números de cabeça**: ele EXTRAI a amostra do arquivo
 * (dias de chegada, antecedência, estoque, consumo por dia) e roda `contaDoPedido` /
 * `contaDoPlano` contra ela.
 *
 * ⛔⛔ **POR QUE LER O ARQUIVO EM VEZ DE CRAVAR OS NÚMEROS:** cravados, eles seriam a minha
 * memória da referência — e *"enquanto o mock vivia numa pasta de downloads, «igual ao mock»
 * era MEMÓRIA MINHA"* (10/09, a tela que foi refeita 3×). Lidos, o dia em que o dono mudar a
 * amostra **este teste acompanha**; e se a lib divergir, ele aponta o número do arquivo.
 *
 * ⭐ E os 3 PINS que o dono escreveu no brief entram também, como asserção literal — eles são
 * a tradução humana do que o arquivo calcula, e conferir os dois lados é o que prova que o
 * arquivo e o pedido do dono dizem a mesma coisa.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  contaDoPedido,
  contaDoPlano,
  diaPedir,
  coberturaEmDias,
  farolDaCobertura,
  textoDoPedido,
  fmt1,
  segPrimeiro,
  DIAS,
  FOLGA_PADRAO,
  PAR_DIAS,
  ANTECEDENCIA_PADRAO,
  DIAS_DA_BASELINE,
} from '../consumo-e-compras'

const CAMINHO = 'docs/consumo-e-compras-referencia.html'
const HTML = readFileSync(resolve(process.cwd(), CAMINHO), 'utf8')
const SCRIPT = HTML.slice(HTML.indexOf('<script>'), HTML.lastIndexOf('</script>'))

/**
 * ⭐ O LEITOR DA AMOSTRA — recorta o objeto de cada item do `<script>` e tira os campos que a
 * conta usa. ⚠️ Deliberadamente conservador: se um campo não estiver lá, ele devolve
 * `undefined` e a asserção falha dizendo o nome — **nunca** inventa um default, que faria o
 * teste passar sobre um arquivo que mudou de forma.
 */
function amostra(nome: string) {
  const i = SCRIPT.indexOf(`{n:"${nome}"`)
  if (i < 0) throw new Error(`a referência não tem mais o item de amostra "${nome}"`)
  const resto = SCRIPT.slice(i + 1)
  const j = resto.indexOf('{n:"')
  const bloco = j < 0 ? resto : resto.slice(0, j)

  const lista = (campo: string) => {
    const m = new RegExp(`${campo}:\\[([^\\]]*)\\]`).exec(bloco)
    return m ? m[1].split(',').filter((s) => s.trim() !== '').map(Number) : undefined
  }
  const numero = (campo: string) => {
    const m = new RegExp(`${campo}:(-?[\\d.]+)`).exec(bloco)
    return m ? Number(m[1]) : undefined
  }
  const texto = (campo: string) => {
    const m = new RegExp(`${campo}:"([^"]*)"`).exec(bloco)
    return m ? m[1] : undefined
  }
  return {
    nome,
    unidade: texto('u'),
    fornecedor: texto('forn') ?? null,
    diasChegada: lista('cheg'),
    antecedenciaDias: numero('antec'),
    estoque: numero('est'),
    consumoPorDia: lista('d'),
  }
}

/** ⚠️ o `HOJE` da amostra sai do arquivo — cravar 4 aqui seria a 2ª fonte do dia da amostra */
const HOJE = (() => {
  const m = /var HOJE=(\d)/.exec(SCRIPT)
  if (!m) throw new Error('a referência não declara mais o HOJE da amostra')
  return Number(m[1])
})()

const comoItem = (a: ReturnType<typeof amostra>, folga = FOLGA_PADRAO) => {
  expect(a.diasChegada, `${a.nome}: a amostra perdeu os dias de chegada`).toBeDefined()
  expect(a.consumoPorDia, `${a.nome}: a amostra perdeu o consumo por dia`).toHaveLength(7)
  expect(a.estoque, `${a.nome}: a amostra perdeu o estoque`).toBeDefined()
  return {
    diasChegada: a.diasChegada!,
    antecedenciaDias: a.antecedenciaDias ?? ANTECEDENCIA_PADRAO,
    folga,
    estoque: a.estoque!,
    mediaPorDia: a.consumoPorDia!,
  }
}

describe('⭐⭐⭐ consumo-e-compras bate com a referência', () => {
  // ─────────────────────────────────────────────────────────────────
  // 1. as CONSTANTES são as do arquivo
  // ─────────────────────────────────────────────────────────────────
  it('⭐ a folga, o PAR e a antecedência são os que a referência declara', () => {
    expect(SCRIPT).toContain('FOLGA=1.10')
    expect(FOLGA_PADRAO).toBe(1.1)
    expect(SCRIPT).toContain('PAR_DIAS=3')
    expect(PAR_DIAS).toBe(3)
    // a antecedência é POR ITEM na config; o padrão 1 está escrito na lei C15
    expect(HTML).toMatch(/antecedência\s*\n?\s*padrão 1/)
    expect(ANTECEDENCIA_PADRAO).toBe(1)
    // ⭐ a amostra da referência é SEXTA — e o dia vem do arquivo
    expect(DIAS[HOJE]).toBe('SEX')
  })

  it('⛔ o dia-da-semana é SEG-first, como a referência — e a conversão tem um lugar só', () => {
    expect(SCRIPT).toContain('var DIAS=["SEG","TER","QUA","QUI","SEX","SÁB","DOM"]')
    expect([...DIAS]).toEqual(['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'])
    // `getUTCDay()` fala DOM-first: 0=dom … 6=sáb
    expect(segPrimeiro(0)).toBe(6) // domingo é o ÚLTIMO em SEG-first
    expect(segPrimeiro(1)).toBe(0) // segunda é o primeiro
    expect(segPrimeiro(5)).toBe(4) // sexta — o HOJE da amostra
    expect(segPrimeiro(6)).toBe(5)
  })

  // ─────────────────────────────────────────────────────────────────
  // 2. OS 3 PINS DO DONO — contra a amostra LIDA do arquivo
  // ─────────────────────────────────────────────────────────────────
  it('⭐⭐ FRANGO: chega SEG, cobre seg+ter, pedir DOM, PEDIR 6,6 KG', () => {
    const a = amostra('FRANGO')
    expect(a.diasChegada).toEqual([0, 2, 4]) // SEG/QUA/SEX
    expect(a.antecedenciaDias).toBe(1)
    expect(a.estoque).toBe(14.2)

    const c = contaDoPedido(comoItem(a), HOJE)
    expect(c.ok).toBe(true)
    if (!c.ok) return
    expect(DIAS[c.chegaDia]).toBe('SEG')
    expect(c.janela.map((d) => DIAS[d])).toEqual(['SEG', 'TER'])
    expect(c.saiJanela).toBe(6) // 3,2 + 2,8
    expect(c.precisa).toBe(6.6) // × 1,10
    expect(c.saiAteChegar).toBe(20.9) // sex + sáb + dom
    expect(c.sobraNaChegada).toBe(0) // 14,2 − 20,9 → nunca negativo
    expect(fmt1(c.pedir)).toBe('6,6')
    expect(diaPedir(c, HOJE)).toBe('DOM')
  })

  it('⭐⭐ ACÉM: chega SEG, janela de 7 dias, pedir SÁB, PEDIR 26,6 KG', () => {
    const a = amostra('ACÉM')
    expect(a.diasChegada).toEqual([0]) // só SEG
    expect(a.antecedenciaDias).toBe(2)
    expect(a.estoque).toBe(9.8)

    const c = contaDoPedido(comoItem(a), HOJE)
    expect(c.ok).toBe(true)
    if (!c.ok) return
    // ⭐ chegada ÚNICA na semana → a janela é a semana inteira (a próxima chegada é em 7 dias)
    expect(c.janela).toHaveLength(7)
    expect(c.saiJanela).toBe(24.2)
    expect(fmt1(c.pedir)).toBe('26,6')
    expect(c.pedir).toBe(26.62)
    expect(diaPedir(c, HOJE)).toBe('SÁB')
  })

  it('⭐⭐ QUEIJO: chega SEG, cobre seg+ter+qua, pedir HOJE ⚠, PEDIR 14,6 KG', () => {
    const a = amostra('QUEIJO')
    expect(a.diasChegada).toEqual([0, 3]) // SEG/QUI
    expect(a.antecedenciaDias).toBe(3)
    expect(a.estoque).toBe(18.6)

    const c = contaDoPedido(comoItem(a), HOJE)
    expect(c.ok).toBe(true)
    if (!c.ok) return
    expect(c.janela.map((d) => DIAS[d])).toEqual(['SEG', 'TER', 'QUA'])
    expect(c.saiJanela).toBe(13.3)
    expect(fmt1(c.pedir)).toBe('14,6')
    // ⭐ antecedência 3 com chegada em 3 dias → o pedido sai HOJE
    expect(c.pedirEm).toBe(0)
    expect(diaPedir(c, HOJE)).toBe('HOJE')
  })

  // ─────────────────────────────────────────────────────────────────
  // 3. a conta do PLANO (lei C9)
  // ─────────────────────────────────────────────────────────────────
  it('⭐ o plano das porções = 3 dias × média + o que sai hoje − o que tem', () => {
    const a = amostra('metade de bolinha')
    const p = contaDoPlano({ estoque: a.estoque!, mediaPorDia: a.consumoPorDia! }, HOJE)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const media = a.consumoPorDia!.reduce((s, v) => s + v, 0) / 7
    expect(p.minimo).toBe(Math.ceil(media * PAR_DIAS))
    expect(p.saiHoje).toBe(a.consumoPorDia![HOJE])
    expect(p.produzir).toBe(Math.max(0, Math.ceil(p.minimo + p.saiHoje - a.estoque!)))
    // ⭐ a amostra tem 12 UN na prateleira contra ~82 de mínimo: o plano PEDE produção
    expect(p.produzir).toBeGreaterThan(0)
  })

  /**
   * ⚠️⚠️ O SEGUNDO VERDE DE GRAÇA (REGRA 11): repus `Math.round` no lugar do `Math.ceil` do
   * mínimo e os testes passaram — porque na amostra `média × 3 = 81,857`, e **ceil e round dão
   * 82 os dois**. ⭐ O caso que ISOLA é a média cuja fração fica **abaixo de meio**: `1,1 × 3 =
   * 3,3` → ceil **4**, round **3**. Arredondar pra baixo deixa a prateleira abaixo do mínimo
   * que o próprio número acabou de declarar.
   */
  it('⛔⛔ o mínimo ARREDONDA PRA CIMA — média 1,1/dia pede 4 de mínimo, nunca 3', () => {
    const p = contaDoPlano({ estoque: 0, mediaPorDia: [1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1] }, HOJE)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.minimo).toBe(4) // Math.round daria 3
    expect(p.produzir).toBe(6) // ceil(4 + 1,1 − 0) — com o mínimo errado sairia 5
  })

  it('⛔ produzir nunca é negativo: estoque acima do mínimo devolve 0', () => {
    const p = contaDoPlano({ estoque: 10_000, mediaPorDia: [10, 10, 10, 10, 10, 10, 10] }, HOJE)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.produzir).toBe(0)
  })

  // ─────────────────────────────────────────────────────────────────
  // 4. HONESTIDADE — "a apurar" nunca vira zero (lei C2)
  // ─────────────────────────────────────────────────────────────────
  it('⛔⛔ dia sem consumo medido → "a apurar" NOMEANDO o dia, nunca um pedido inventado', () => {
    const a = amostra('FRANGO')
    const base = comoItem(a)
    // a terça entra na janela do FRANGO — sem média dela, a conta não existe
    const media: (number | null)[] = [...base.mediaPorDia]
    media[1] = null
    const c = contaDoPedido({ ...base, mediaPorDia: media }, HOJE)
    expect(c.ok).toBe(false)
    if (c.ok) return
    expect(c.porque).toContain('ter')
  })

  it('⛔ item sem dias de chegada fica FORA da mesa, com o que fazer escrito', () => {
    const c = contaDoPedido({ ...comoItem(amostra('FRANGO')), diasChegada: [] }, HOJE)
    expect(c.ok).toBe(false)
    if (c.ok) return
    expect(c.porque).toBe('configura os dias de chegada')
  })

  it('⛔ plano sem consumo medido também é "a apurar"', () => {
    const p = contaDoPlano({ estoque: 5, mediaPorDia: [null, null, null, null, null, null, null] }, HOJE)
    expect(p.ok).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────────
  // 5. a FOLGA é a do dono, e ela não se cancela
  // ─────────────────────────────────────────────────────────────────
  it('⭐ a folga entra SÓ no precisa — inflar a sobra também a anularia', () => {
    const a = comoItem(amostra('FRANGO'))
    const comFolga = contaDoPedido(a, HOJE)
    const sem = contaDoPedido({ ...a, folga: 1 }, HOJE)
    expect(comFolga.ok && sem.ok).toBe(true)
    if (!comFolga.ok || !sem.ok) return
    expect(comFolga.precisa).toBeGreaterThan(sem.precisa)
    expect(comFolga.sobraNaChegada).toBe(sem.sobraNaChegada)
    expect(comFolga.pedir).toBeGreaterThan(sem.pedir)
  })

  /**
   * ⚠️⚠️ ESTE TESTE NASCEU DE UM VERDE DE GRAÇA (REGRA 11). Repus o defeito *"a folga vaza pro
   * `sobra`"* e os 17 testes passaram **VERDES** — porque no FRANGO da amostra a sobra é **0**
   * (o estoque não chega até a chegada), e `0 × 1,10` continua 0. ⭐ O caso que ISOLA a régua
   * é o item cujo estoque **SOBREVIVE** até a chegada: aí a folga no lugar errado infla a
   * sobra, **derruba o pedido** e a folga vira enfeite — exatamente ao contrário do que ela
   * existe pra fazer.
   */
  it('⛔⛔ com estoque que SOBREVIVE até a chegada, a folga não pode inflar a sobra', () => {
    /**
     * ⚠️ O estoque é escolhido pra sobrar MENOS que o necessário (25 − 20,9 = 4,1 contra 6,6
     * de `precisa`): assim o defeito move **os dois** números. Com `estoque: 30` a sobra
     * passaria do necessário, o pedido viraria 0 pelos dois caminhos e o `pedir` deixaria de
     * isolar — foi o que a minha 1ª versão fez, e o próprio clamp a reprovou.
     */
    const base = comoItem(amostra('FRANGO'))
    const a = { ...base, estoque: 25 }
    const c = contaDoPedido(a, HOJE)
    const sem = contaDoPedido({ ...a, folga: 1 }, HOJE)
    expect(c.ok && sem.ok).toBe(true)
    if (!c.ok || !sem.ok) return
    // a sobra é do ESTOQUE — ela não conhece folga nenhuma
    expect(c.sobraNaChegada).toBe(4.1)
    expect(c.sobraNaChegada).toBe(sem.sobraNaChegada)
    // e o pedido é exatamente precisa − sobra (com a folga 1,10 só no precisa)
    expect(c.pedir).toBe(2.5)
    expect(c.pedir).toBe(Math.round((c.precisa - c.sobraNaChegada) * 100) / 100)
    expect(c.pedir).toBeGreaterThan(sem.pedir)
  })

  it('⭐ estoque que cobre a janela derruba o pedido a zero', () => {
    const c = contaDoPedido({ ...comoItem(amostra('FRANGO')), estoque: 500 }, HOJE)
    expect(c.ok).toBe(true)
    if (!c.ok) return
    expect(c.pedir).toBe(0)
  })

  // ─────────────────────────────────────────────────────────────────
  // 6. COBERTURA e FAROL (lei C13)
  // ─────────────────────────────────────────────────────────────────
  it('⭐⭐ o farol é relativo à CHEGADA, nunca a um número fixo de dias', () => {
    const media = [2, 2, 2, 2, 2, 2, 2]
    // 6 dias de cobertura é CORAL pra quem só recebe em 7 dias…
    expect(farolDaCobertura(coberturaEmDias(12, media), 7)).toBe('CORAL')
    // …e VERDE pra quem recebe amanhã
    expect(farolDaCobertura(coberturaEmDias(12, media), 1)).toBe('VERDE')
    // o degrau âmbar é chegada + 2
    expect(farolDaCobertura(coberturaEmDias(12, media), 5)).toBe('AMBAR')
  })

  it('⛔ cobertura sem média, ou com média zero, é "a apurar" — nunca ∞ nem 0 na tela', () => {
    expect(coberturaEmDias(10, [null, null, null, null, null, null, null])).toBeNull()
    expect(coberturaEmDias(10, [0, 0, 0, 0, 0, 0, 0])).toBeNull()
    expect(farolDaCobertura(null, 3)).toBe('A_APURAR')
    // sem dias de chegada não há contra o que comparar — a tela cobra a config
    expect(farolDaCobertura(4, null)).toBe('A_APURAR')
  })

  // ─────────────────────────────────────────────────────────────────
  // 7. O TEXTO DO WHATSAPP (lei C8) — no formato que a referência monta
  // ─────────────────────────────────────────────────────────────────
  it('⭐ o texto do pedido sai no formato da referência', () => {
    expect(SCRIPT).toContain('"Pedido Caçula Mix — "')
    expect(SCRIPT).toContain('(entrega "')
    const t = textoDoPedido({
      empresa: 'Caçula Mix',
      fornecedor: 'Frigorífico Silva',
      chegaDia: 0,
      linhas: [
        { nome: 'FRANGO', quantidade: 6.6, unidade: 'KG' },
        { nome: 'ACÉM', quantidade: 26.62, unidade: 'KG' },
      ],
    })
    expect(t).toBe('Pedido Caçula Mix — Frigorífico Silva (entrega SEG): FRANGO 6,6 KG · ACÉM 26,6 KG')
  })

  it('⚠️ sem fornecedor o texto não inventa um nome', () => {
    const t = textoDoPedido({
      empresa: 'Caçula Mix',
      fornecedor: null,
      chegaDia: 3,
      linhas: [{ nome: 'QUEIJO', quantidade: 14.63, unidade: 'KG' }],
    })
    expect(t).toBe('Pedido Caçula Mix (entrega QUI): QUEIJO 14,6 KG')
  })

  // ─────────────────────────────────────────────────────────────────
  // 8. a BASELINE é independente do seletor
  // ─────────────────────────────────────────────────────────────────
  it('⭐⭐ a baseline do pedido são 4 semanas — pra cada dia-da-semana ter amostra', () => {
    expect(DIAS_DA_BASELINE).toBe(28)
    // 4 semanas = 4 amostras por dia-da-semana, acima do mínimo de 2 das vendas
    expect(DIAS_DA_BASELINE / 7).toBeGreaterThanOrEqual(2)
  })
})
