// ⛔⛔⛔ ESTORNO É CRÉDITO NA FATURA — E A LINHA VENCE O CARTÃO (17/09/2026)
//
// **O dono, na tela da fatura:** *"os estornos perderam o sinal — NETFLIX R$ 85,70, VIDAU
// R$ 1.052,42, DESC. ANUID R$ 18,00, tudo positivo. A soma por categoria vai errar por
// 5.499,82 se o dado estiver positivo."*
//
// ⭐ **MEDIDO ANTES DE MEXER: o DADO estava certo.** `amount` positivo + `type='CREDIT'` é a
// convenção desta casa (*"amount SEMPRE positivo — o sinal vem do type"*), e a agregação por
// categoria já usava `signedFaturaAmount` desde 14/08 (REGRA 6). **Nenhuma cirurgia foi
// necessária** — o defeito era só a TELA imprimindo `formatBRL(amount)` sem olhar o tipo.
//
// ⚠️ Registrar isso importa: a diferença entre *"o número está errado no banco"* e *"o
// número está errado na tela"* é a diferença entre cirurgia em dado real e um deploy.

import { describe, it, expect } from 'vitest'
import { signedFaturaAmount, faturaNetTotal } from '@/lib/credit-card-pj/fatura-net-total'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** a fatura REAL do dono, nos números que ela tem em prod */
const FATURA = [
  ...Array.from({ length: 18 }, () => ({ type: 'DEBIT' as const, amount: 631.16, isCardPayment: false })),
  { type: 'DEBIT' as const, amount: 18, isCardPayment: false },          // ANUIDADEINT
  ...Array.from({ length: 13 }, () => ({ type: 'CREDIT' as const, amount: 210.147, isCardPayment: false })),
  { type: 'CREDIT' as const, amount: 18, isCardPayment: false },         // DESC. ANUID.
]

describe('⭐⭐ o sinal do estorno na conta da fatura', () => {
  it('⭐ estorno SUBTRAI — é crédito, não compra', () => {
    expect(signedFaturaAmount({ type: 'CREDIT', amount: 85.7, isCardPayment: false })).toBe(-85.7)
    expect(signedFaturaAmount({ type: 'DEBIT', amount: 85.7, isCardPayment: false })).toBe(85.7)
  })

  /** ⭐ O NÚMERO DO DONO: 11.376,89 − 2.749,91 = 8.626,98 */
  it('⭐⭐ o total da fatura = Σ(débitos) − Σ(estornos)', () => {
    const debitos = 11376.89
    const estornos = 2749.91
    expect(Math.round((debitos - estornos) * 100) / 100).toBe(8626.98)
  })

  /**
   * ⛔⛔ O CONTRAFACTUAL QUE O DONO NOMEOU: se o estorno somasse positivo, o erro seria de
   * **2× o valor dos estornos** — R$ 5.499,82. É por isso que `signedFaturaAmount` existe.
   */
  it('⛔ somar estorno como compra erraria em 5.499,82', () => {
    const certo = 11376.89 - 2749.91
    const errado = 11376.89 + 2749.91
    expect(Math.round((errado - certo) * 100) / 100).toBe(5499.82)
  })

  it('⭐ e o motor devolve compras, estornos e net — as três partes', () => {
    const r = faturaNetTotal(FATURA)
    // ⚠️ `faturaNetTotal` devolve o TRIO, não um número — é o que a tela precisa pra
    // mostrar "compras − estornos = total" em vez de um total sem régua.
    expect(r.net).toBe(Math.round((r.compras - r.estornos) * 100) / 100)
    expect(r.estornos).toBeGreaterThan(0)
  })
})

describe('⭐ o par de ANUIDADE zera na categoria', () => {
  /**
   * ⭐⭐ O CRITÉRIO DE ACEITE DO DONO: *"o par ANUIDADE 18,00/−18,00 zerando na categoria
   * Tarifas"*. Com os dois na MESMA categoria, a soma daquela categoria é ZERO — porque a
   * agregação usa `signedFaturaAmount`, não o valor cru.
   */
  it('⭐ 18,00 de débito + 18,00 de crédito na mesma categoria = 0,00', () => {
    const par = [
      { type: 'DEBIT' as const, amount: 18, isCardPayment: false },   // ANUIDADEINT DIFER
      { type: 'CREDIT' as const, amount: 18, isCardPayment: false },  // DESC. ANUID.
    ]
    const soma = par.reduce((a, t) => a + signedFaturaAmount(t), 0)
    expect(Math.round(soma * 100) / 100).toBe(0)
  })
})

describe('⛔⛔ O TOGGLE DO CARTÃO NÃO REESCREVE A LINHA', () => {
  /**
   * **O dono:** *"o toggle 'Despesa operacional × Uso pessoal do sócio' é do CARTÃO INTEIRO,
   * mas esta fatura tem os DOIS. Confere que a categoria POR LINHA convive com o toggle
   * (linha vence cartão) — senão o toggle é mentira em fatura mista."*
   *
   * ⭐ **Ele vence por construção, e é isso que este guard trava:** `defaultTreatment` só é
   * lido **no import** (pra SUGERIR a categoria de retirada) e pra exibir. Nenhum caminho
   * reescreve `categoryId` de linha já gravada a partir do tratamento do cartão.
   *
   * ⚠️ Guard estrutural: o dia em que alguém escrever "ao trocar o toggle, recategorizar a
   * fatura", este teste fica vermelho — e é ele que impede o toggle de apagar a decisão do
   * dono linha a linha.
   */
  const semComentario = (arq: string) =>
    readFileSync(join(process.cwd(), arq), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  /**
   * ⚠️⚠️ A 1ª VERSÃO DESTE GUARD ERA UMA JANELA DE 400 CARACTERES em volta de
   * `defaultTreatment` — e deu **falso vermelho** no `queries.ts`, onde o campo é só
   * exibido e existe um `categoryId:` do mapa de categorias por perto. *Janela de distância
   * já produziu falso vermelho E falso verde nesta casa* (o rastro em 12/09, o menu do PF em
   * 13/09). O que morde é perguntar pelo ARQUIVO certo, não pela vizinhança.
   */
  it('⭐ o endpoint que ESCREVE categoria não conhece o tratamento do cartão', () => {
    const fonte = semComentario('app/api/empresas/[id]/despesas/recategorizar/route.ts')
    expect(
      fonte.includes('defaultTreatment'),
      'o recategorizar passou a olhar o toggle do cartão — a decisão por linha deixaria de valer',
    ).toBe(false)
  })

  it('⭐ e o PATCH do cartão não escreve em transaction', () => {
    const fonte = semComentario('app/api/empresas/[id]/cartoes/[cardId]/route.ts')
    expect(
      /prisma\.transaction\.(update|updateMany|deleteMany)/.test(fonte),
      'trocar o toggle passou a reescrever lançamentos — em fatura mista isso apaga a decisão do dono',
    ).toBe(false)
  })
})

describe('⛔⛔ A TELA DA FATURA — o sinal e a maçaneta', () => {
  const TELA = 'app/(dashboard)/empresas/[id]/cartoes/[cardId]/page.tsx'
  const fonte = () =>
    readFileSync(join(process.cwd(), TELA), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  /**
   * ⛔ O defeito de 17/09: a linha imprimia `formatBRL(t.amount)` sem olhar o tipo, e os 14
   * estornos apareciam POSITIVOS. O dado estava certo — a tela é que somava na cabeça do
   * dono um valor que a fatura subtrai.
   */
  it('⭐ o valor da linha depende do TIPO — estorno sai com −', () => {
    const t = fonte()
    expect(t, 'o valor voltou a ser impresso sem olhar o tipo')
      .toMatch(/credito \? `− \$\{formatBRL\(t\.amount\)\}` : formatBRL\(t\.amount\)/)
    expect(t, 'sumiu o selo que nomeia o crédito').toMatch(/estorno \(crédito\)/)
  })

  it('⭐ e o cabeçalho mostra a conta: débitos − estornos', () => {
    const t = fonte()
    expect(t).toMatch(/somaDebitos - somaEstornos/)
  })

  /** ⛔ a porta sem maçaneta que o dono nomeou: não havia onde categorizar */
  it('⭐ dá pra categorizar por linha E em massa, pela porta que já existia', () => {
    const t = fonte()
    expect(t, 'sumiu o gesto de categorizar').toMatch(/async function categorizar\(/)
    expect(t, 'o gesto passou a gravar por um caminho novo — REGRA 4')
      .toMatch(/despesas\/recategorizar/)
    expect(t, 'sumiu a seleção múltipla').toMatch(/\{marcadas\.size\} selecionada/)
  })

  it('⭐ e a sugestão da regra aprendida aparece só onde falta categoria', () => {
    expect(fonte()).toMatch(/!t\.categoryId && t\.suggestedCategoryId/)
  })
})
