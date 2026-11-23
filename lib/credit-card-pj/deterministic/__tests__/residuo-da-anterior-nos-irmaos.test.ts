/**
 * ⭐⭐⭐ REGRA 14 — O ESPELHO NOS IRMÃOS (20/10/2026).
 *
 * *"Cura de família num parser obriga teste-espelho nos parsers irmãos, com o mesmo caso.
 * E golden com o campo em 0,00 não protege."*
 *
 * A cura de hoje é da Caixa: **pagamento parcial da fatura anterior deixa um resíduo que
 * evaporava**. A pergunta desta suíte é a mesma pros quatro layouts: *quem carrega o
 * resíduo quando a anterior não é quitada?* — e ela é **MEDIDA em cada um**, nunca
 * presumida pela semelhança dos documentos.
 *
 * ⚠️ E o resultado NÃO é "aplicar a mesma cura em todos": as estruturas são diferentes de
 * verdade, e inventar pareamento onde o banco já resolve de outro jeito criaria dupla
 * contagem. O que a REGRA 14 exige é que cada caminho **TENHA um carregador provado**.
 *
 *   ┌───────────┬──────────────────────────────────┬────────────────────────────────────┐
 *   │ banco     │ onde a anterior/pagamento vivem  │ quem carrega o resíduo             │
 *   ├───────────┼──────────────────────────────────┼────────────────────────────────────┤
 *   │ CAIXA     │ LINHAS do Demonstrativo (D e C), │ ⭐ PAREAMENTO (curado hoje) — o    │
 *   │           │ e o bloco entra no total         │    resíduo vira LINHA sem portador │
 *   │ BANRISUL  │ DECLARADOS no resumo             │ ⭐ a EQUAÇÃO declarada             │
 *   │ SICREDI   │ (23/11) a anterior ENTRA: o juiz │ ⭐ a EQUAÇÃO DO RESUMO (anterior + │
 *   │           │ confere a equação do resumo      │    pag/créd + despesas + encargos) │
 *   │ MERC.PAGO │ DECLARADOS, com check informativo│ ⚠️ LATENTE REGISTRADO — fora do    │
 *   │           │                                  │    julgamento (ordem do dono)      │
 *   └───────────┴──────────────────────────────────┴────────────────────────────────────┘
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCaixaFatura } from '../caixa-fatura-parser'
import { parseBanrisulFatura } from '../banrisul-fatura-parser'
import { validateBanrisulFatura } from '../validate-banrisul-fatura'
import { parseSicrediFatura } from '../sicredi-fatura-parser'
import { validateSicrediFatura } from '../validate-fatura'
import { parseMercadoPagoFatura } from '../mercadopago-fatura-parser'
import { validateMercadoPagoFatura } from '../validate-mercadopago-fatura'
import { GOLDENS } from '../congelador'

const dir = join(__dirname, 'fixtures')
const ler = (f: string) => readFileSync(join(dir, f), 'utf-8')

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

describe('CAIXA — o par é PAREADO (a cura)', () => {
  it('a anterior deixou de ser pulada por nome: ela é somada e pareada', () => {
    const p = parseCaixaFatura(ler('caixa-fatura-residuo-anterior.txt'))
    expect(p.computed.faturaAnterior).toBeGreaterThan(0)
    expect(p.computed.residuoAnterior).toBe(round2(p.computed.faturaAnterior + p.computed.pagamentoAnterior))
    // e o resíduo está DENTRO do que a fatura cobra
    expect(p.computed.net).toBe(p.declared.valorTotalFatura)
  })
})

describe('BANRISUL — quem carrega é a EQUAÇÃO DECLARADA do resumo', () => {
  const fixtures = ['banrisul-fatura-real.txt', 'banrisul-pj-2-portadores.txt', 'banrisul-pj-encargo-no-resumo.txt']

  /**
   * ⭐ Aqui a anterior e os pagamentos são DECLARADOS, e o validador confere a identidade
   * `anterior − pag/créd + brasil + exterior + iof + encargos = saldo atual`. Logo um
   * pagamento parcial já aparece no `saldo atual` que o banco declara — **não há resíduo
   * pra materializar**, e materializar um contaria a dívida duas vezes.
   */
  it.each(fixtures)('%s: a anterior é DECLARADA e entra na equação conferida', (f) => {
    const p = parseBanrisulFatura(ler(f))
    expect(p.declared.anterior).not.toBeNull()
    expect(p.declared.pagamentosCreditos).not.toBeNull()
    expect(p.declared.saldoAtual).not.toBeNull()

    const v = validateBanrisulFatura(p)
    const eq = v.checks.find((c) => c.name === 'Resumo declarado = Saldo atual')
    expect(eq, 'a equação do resumo tem que ser uma checagem, não um comentário').toBeDefined()
    expect(eq!.pass).toBe(true)
  })

  /**
   * ⚠️ REGRA 14, 2ª metade — **as fixtures do Banrisul NÃO são "só com o par anulado"**:
   * medido, a anterior e os pagamentos/créditos DIFEREM nas três (18,00 · 2.749,91 ·
   * 210,92). Ou seja, o campo é exercido com valor > 0 e **desparelhado**.
   */
  it('as 3 fixtures exercitam a anterior com valor > 0 e DESPAREADA', () => {
    const difs = fixtures.map((f) => {
      const p = parseBanrisulFatura(ler(f))
      return round2((p.declared.anterior ?? 0) - (p.declared.pagamentosCreditos ?? 0))
    })
    expect(difs.every((d) => d !== 0), `as diferenças medidas: ${difs.join(' · ')}`).toBe(true)
  })

  /**
   * ⛔ O CONTRAFACTUAL — se a anterior fosse lida errada, a equação morde. É isso que faz
   * dela um carregador de verdade e não uma promessa.
   */
  it('CONTRAFACTUAL: anterior errada por 100,00 → a equação ACUSA', () => {
    const p = parseBanrisulFatura(ler('banrisul-pj-encargo-no-resumo.txt'))
    const torto = { ...p, declared: { ...p.declared, anterior: round2((p.declared.anterior ?? 0) + 100) } }
    const v = validateBanrisulFatura(torto)
    const eq = v.checks.find((c) => c.name === 'Resumo declarado = Saldo atual')!
    expect(eq.pass).toBe(false)
    expect(eq.diff).toBe(100)
    expect(v.ok).toBe(false)
  })
})

describe('SICREDI — a anterior ENTRA no total (medido no resumo do próprio banco, 23/11)', () => {
  const texto = ler('sicredi-fatura-real.txt')
  const p = parseSicrediFatura(texto)

  /**
   * ⛔⛔ CORREÇÃO DE 23/11 — este bloco afirmava "a fatura EXCLUI a anterior; o resíduo volta
   * como linha de ROTATIVO" e conferia `Total cartão + estornos = Total desta Fatura`. A
   * fatura de novembro (2 cartões) DESMENTIU pela aritmética do próprio banco: o resumo declara
   * `Subtotal Despesas e Pagamentos = anterior + pagamentos/créditos + despesas`
   * (6.667,14 − 6.815,54 + 4.959,09 = 4.810,69). A identidade antiga só fechava porque, nas DUAS
   * fixtures, o pagamento quitou a anterior ao centavo — o "par anulado" que a REGRA 14 diz
   * que não protege nada. Agora o juiz confere a equação do resumo, que vale com e sem resíduo.
   */
  it('o parser LÊ a anterior declarada, e a equação do resumo fecha com as linhas', () => {
    expect(p.declared.anterior).toBe(2304.83)
    const v = validateSicrediFatura(p)
    const c = v.checks.find((x) => x.name === 'anterior + pagamentos/créditos + despesas + encargos = Total desta Fatura')!
    expect(c.pass).toBe(true)
    expect(c.lei).toBe('FATURA')
    expect(v.ok).toBe(true)
  })

  it('⭐ REGRA 14 — variante com RESÍDUO (pagou menos que a anterior): a equação do resumo cobra a diferença', () => {
    // pagamento parcial: a anterior sobe 500 sem pagamento correspondente → o banco declararia
    // Total desta Fatura 500 maior. A equação nova fecha; a antiga (cartão + estornos) NÃO.
    const torto = {
      ...p,
      declared: { ...p.declared, anterior: round2(p.declared.anterior! + 500), totalFatura: round2(p.declared.totalFatura! + 500) },
    }
    const v = validateSicrediFatura(torto)
    expect(v.checks.find((x) => x.lei === 'FATURA' && x.name.startsWith('anterior'))!.pass).toBe(true)
    expect(round2((p.declared.totalCartao ?? 0) + p.computed.sumEstornos)).not.toBe(torto.declared.totalFatura)
  })

  /** ⭐ e o pagamento é CONFERIDO contra o declarado — pagamento mal-lido morde. */
  it('o pagamento lido é conferido contra "Pagamentos/Créditos"', () => {
    const v = validateSicrediFatura(p)
    const c = v.checks.find((x) => x.name === 'Pagamentos/Créditos = pagamento + estorno')!
    expect(c.pass).toBe(true)
    const torto = { ...p, computed: { ...p.computed, sumPayments: round2(p.computed.sumPayments + 50) } }
    expect(validateSicrediFatura(torto).ok).toBe(false)
  })
})

describe('MERCADO PAGO — latente REGISTRADO, não atacado (ordem do dono)', () => {
  const p = parseMercadoPagoFatura(ler('mercadopago-fatura-2026-08.txt'))
  const v = validateMercadoPagoFatura(p)

  /**
   * ⚠️⚠️ A ÚNICA FIXTURE DO MERCADO PAGO É "SÓ COM O PAR ANULADO" — anterior 2.025,73 ==
   * pagamentos 2.025,73 —, que é exatamente o estado que a REGRA 14 diz que **não
   * protege**. E o check que revelaria o parcial existe e é **INFORMATIVO**: ele fica
   * FORA do julgamento, então um pagamento parcial aqui **avisa e não recusa**.
   *
   * ⛔ Fica REGISTRADO e NÃO atacado — decisão do dono. Este teste é a trava que impede
   * o latente de virar paisagem: se alguém puser o check no julgamento (ou tirá-lo), ele
   * fica vermelho e a decisão volta pra mesa.
   */
  it('a fixture tem o par ANULADO (anterior == pagamentos) — o campo não é exercido', () => {
    expect(p.declarados.totalFaturaAnterior).toBe(2025.73)
    expect(p.declarados.pagamentosCreditos).toBe(2025.73)
    expect(p.somaPagamentos).toBe(2025.73)
  })

  it('o check da quitação EXISTE e é INFORMATIVO (fora do julgamento)', () => {
    const c = v.checks.find((x) => x.name === 'quitação da fatura anterior (informativo)')
    expect(c, 'o check que revela pagamento parcial tem que continuar existindo').toBeDefined()
    expect(c!.diff).toBe(0) // par anulado nesta fixture
    expect(c!.pass, 'o informativo nunca "falha" — pagar parcial é legítimo').toBe(true)

    /**
     * ⛔ O CASO QUE ISOLA: mexer SÓ na anterior (nunca nos pagamentos, senão a checagem
     * nº 4 falha junto e o `ok` cai por OUTRO motivo). Com a anterior 1.000,00 maior, o
     * informativo passa a apontar pagamento PARCIAL de −1.000,00 — e a fatura **importa
     * do mesmo jeito**, porque ele está fora do julgamento. É o latente, medido.
     */
    const tortoP = { ...p, declarados: { ...p.declarados, totalFaturaAnterior: 3025.73 } }
    const tortoV = validateMercadoPagoFatura(tortoP)
    const tortoC = tortoV.checks.find((x) => x.name === 'quitação da fatura anterior (informativo)')!
    expect(tortoC.diff).toBe(-1000)
    expect(tortoV.ok, 'o informativo NÃO julga — é o latente registrado').toBe(true)
  })
})

/**
 * ⭐⭐ REGRA 14, 2ª metade, COMO GUARD: *"nenhuma fixture só com o par anulado"*.
 *
 * ⛔ **Par que anula passa VERDE com a régua certa E com a errada** — foi assim que o
 * buraco da Caixa viveu de 18/08 a 20/10 com golden, validador e runner no lugar. Apagar
 * a fixture nova deixa este teste vermelho.
 */
describe('REGRA 14 — o caminho da Caixa tem fixture com o campo > 0 e DESPAREADO', () => {
  const daCaixa = GOLDENS.filter((g) => g.parser.endsWith('caixa-fatura-parser.ts'))

  it('a Caixa tem pelo menos 3 goldens registrados no congelador', () => {
    expect(daCaixa.length).toBeGreaterThanOrEqual(3)
  })

  it('⛔ pelo menos UMA fixture da Caixa tem resíduo != 0 (par desparelhado)', () => {
    const residuos = daCaixa.map((g) => {
      const texto = readFileSync(join(process.cwd(), g.fixture), 'utf-8')
      return { nome: g.nome, residuo: parseCaixaFatura(texto).computed.residuoAnterior }
    })
    const desparelhadas = residuos.filter((r) => r.residuo !== 0)
    expect(
      desparelhadas.length,
      `goldens da Caixa e o resíduo de cada: ${residuos.map((r) => `${r.nome}=${r.residuo}`).join(' · ')}`,
    ).toBeGreaterThanOrEqual(1)
  })

  it('e a fixture desparelhada materializa a LINHA do resíduo', () => {
    const comResiduo = daCaixa
      .map((g) => parseCaixaFatura(readFileSync(join(process.cwd(), g.fixture), 'utf-8')))
      .filter((p) => p.computed.residuoAnterior !== 0)
    expect(comResiduo.length).toBeGreaterThanOrEqual(1)
    for (const p of comResiduo) {
      expect(p.extraction.lines.some((l) => /carregad[ao] da fatura anterior/i.test(l.description))).toBe(true)
      expect(p.computed.net).toBe(p.declared.valorTotalFatura)
    }
  })
})
