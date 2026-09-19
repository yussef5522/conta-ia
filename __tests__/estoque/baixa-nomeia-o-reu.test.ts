// ⛔⛔⛔ A BAIXA QUE TRAVOU 58 ITENS POR CAUSA DE 1 (19/09/2026)
//
// **O dono:** *"o confirmar recusa com «Este item ficaria com 0 unidades e valor R$ -0.04»
// mas NÃO DIZ QUAL ITEM dos 58 — fico travado sem saber onde agir (e os outros 57 reféns)."*
//
// ⭐⭐ **DE ONDE VEM O CENTAVO NEGATIVO, medido em prod:** `custoMedioPorItem` devolve o
// custo **arredondado em 2 casas**, e a baixa multiplica pela quantidade — o erro **cresce
// com a quantidade**:
//
// ```
// OVO BRANCO · 1.019 un · R$ 555,64 · custo médio arredondado 0,55
//    zerar: 1.019 × 0,55 = R$ 560,45  →  sobra R$ -4,81
// 55 dos 215 itens da empresa estavam nesse estado; o pior: R$ -113,63
// ```
//
// ⚠️⚠️ **ISSO DERRUBOU O TETO DE 5 CENTAVOS** que o dono propôs — ele recusaria quase todos.
// O teto certo é o **limite matemático do arredondamento** (meio centavo × quantidade), a
// mesma régua do E16. E a cura de fundo é *o ledger guarda precisão cheia*.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { avaliarResiduo, custoParaBaixar, ERRO_POR_UNIDADE, PISO } from '@/lib/stock/residuo-de-centavos'
import { semOsPendentes, BaixaComItemBarradoError } from '@/lib/stock/vendas/itens-pendentes-da-baixa'

const fonte = (arq: string) =>
  readFileSync(join(process.cwd(), arq), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

describe('⭐⭐ o custo em PRECISÃO CHEIA faz o resíduo não nascer', () => {
  it('⭐ o caso real dos ovos: 1.019 un · R$ 555,64', () => {
    const cheio = custoParaBaixar(555.64, 1019)
    // com o custo cheio, zerar deixa exatamente zero
    const v = avaliarResiduo({ saldoAntes: 1019, valorAntes: 555.64, qtdDaBaixa: 1019, valorDaBaixa: Math.round(1019 * cheio * 100) / 100 })
    expect(v.saldoDepois).toBe(0)
    expect(Math.abs(v.valorDepois)).toBeLessThanOrEqual(0.01)
    expect(v.decisao).toBe('OK')
  })

  it('⛔ com o custo ARREDONDADO (o defeito) sobrariam R$ -4,81', () => {
    const arredondado = Math.round((555.64 / 1019) * 100) / 100 // 0,55
    const baixa = Math.round(1019 * arredondado * 100) / 100
    expect(Math.round((555.64 - baixa) * 100) / 100).toBeCloseTo(-4.81, 2)
  })

  it('⭐ item sem saldo não divide por zero', () => {
    expect(custoParaBaixar(0, 0)).toBe(0)
    expect(custoParaBaixar(10, 0)).toBe(0)
  })
})

describe('⭐⭐ zerar quantidade zera valor — dentro do teto do arredondamento', () => {
  it('⭐ resíduo pequeno numa baixa que ZERA vai junto', () => {
    const v = avaliarResiduo({ saldoAntes: 3, valorAntes: 0.02, qtdDaBaixa: 3, valorDaBaixa: 0.06 })
    expect(v.zeraQuantidade).toBe(true)
    expect(v.decisao).toBe('AJUSTA_RESIDUO')
  })

  it('⛔⛔ mas com SALDO REMANESCENTE continua recusando — é o caso do fermento', () => {
    // valor negativo com item ainda na prateleira = compra que falta, não arredondamento
    const v = avaliarResiduo({ saldoAntes: 10, valorAntes: -31.04, qtdDaBaixa: 2, valorDaBaixa: 0 })
    expect(v.zeraQuantidade).toBe(false)
    expect(v.decisao).toBe('RECUSA')
  })

  it('⭐ o teto é PROPORCIONAL — meio centavo por unidade, nunca um número a dedo', () => {
    expect(ERRO_POR_UNIDADE).toBe(0.005)
    // 1.019 unidades ⇒ teto de R$ 5,10 (por isso os R$ 4,81 dos ovos cabem)
    const v = avaliarResiduo({ saldoAntes: 1019, valorAntes: 555.64, qtdDaBaixa: 1019, valorDaBaixa: 560.45 })
    expect(v.teto).toBeCloseTo(5.1, 2)
    expect(v.decisao).toBe('AJUSTA_RESIDUO')
  })

  it('⛔ e ACIMA do teto continua recusando — ali não é centavo, é dado torto', () => {
    // a CUBA MAIONESE: R$ -113,63 num item de 22 mil "kg" (resíduo do lote podre)
    const v = avaliarResiduo({ saldoAntes: 5, valorAntes: 10, qtdDaBaixa: 5, valorDaBaixa: 123.63 })
    expect(v.decisao).toBe('RECUSA')
  })

  it('⭐ o piso protege o ruído de ponto flutuante em item pequeno', () => {
    expect(PISO).toBe(0.05)
    const v = avaliarResiduo({ saldoAntes: 2, valorAntes: 1, qtdDaBaixa: 2, valorDaBaixa: 1.03 })
    expect(v.teto).toBe(0.05)
    expect(v.decisao).toBe('AJUSTA_RESIDUO')
  })
})

describe('⛔⛔ a recusa NOMEIA o réu', () => {
  it('⭐ o guard busca o nome do item antes de falar', () => {
    const m = fonte('lib/stock/movement.ts')
    expect(m, 'a mensagem voltou a dizer "Este item" sem nomear').toMatch(/stockItem\.findUnique[\s\S]{0,200}nome: true/)
    expect(m).toMatch(/«\$\{nome\}» ficaria com/)
    expect(m, 'a mensagem deixou de dizer o estado atual').toMatch(/Hoje ele tem \$\{saldoAntes\}/)
  })

  it('⭐ e o erro CARREGA o item — sem isso a tela não consegue oferecer nada', () => {
    expect(fonte('lib/stock/movement.ts')).toMatch(/culpado\?: CulpadoDoMovimento/)
  })
})

describe('⭐⭐ o lote não fica refém de um item', () => {
  it('⭐ a recusa diz quantos seguem e o que fazer', () => {
    const e = new BaixaComItemBarradoError([{ itemId: 'i1', nome: 'porcao file para xis', motivo: 'ficaria negativo.' }], 57)
    expect(e.message).toMatch(/«porcao file para xis»/)
    expect(e.message).toMatch(/baixar os outros 57/)
    expect(e.quantosSeguem).toBe(57)
  })

  it('⭐ o reenvio tira SÓ os pendentes', () => {
    const agregada = [{ itemId: 'a' }, { itemId: 'b' }, { itemId: 'c' }]
    expect(semOsPendentes(agregada, ['b'])).toEqual([{ itemId: 'a' }, { itemId: 'c' }])
    expect(semOsPendentes(agregada, [])).toHaveLength(3)
  })

  it('⛔ a ATOMICIDADE não afrouxa — a baixa junta os barrados e DESFAZ tudo', () => {
    const b = fonte('lib/stock/vendas/baixa-venda.ts')
    expect(b, 'voltou a estourar no primeiro item barrado').toMatch(/barrados\.push\(/)
    expect(b, 'a transação deixou de ser desfeita quando há barrado')
      .toMatch(/if \(barrados\.length\) throw new BaixaComItemBarradoError/)
  })

  it('⭐ a baixa usa o custo CHEIO, não o arredondado', () => {
    const b = fonte('lib/stock/vendas/baixa-venda.ts')
    expect(b).toMatch(/custoParaBaixar\(at\?\.valor \?\? 0, at\?\.saldo \?\? 0\)/)
    expect(b, 'voltou a mover dinheiro com o custo de TELA')
      .not.toMatch(/const custo = custoMap\.get\(a\.itemId\) \?\? 0/)
  })

  it('⭐ a rota devolve 409 com os réus (pergunta, não erro)', () => {
    const r = fonte('app/api/empresas/[id]/estoque/vendas/processar/route.ts')
    expect(r).toMatch(/code: 'ITEM_BARRADO', barrados: e\.barrados/)
    expect(r).toMatch(/itensPendentes: z\.array\(z\.string\(\)\)\.optional\(\)/)
  })

  it('⭐ e a TELA oferece o caminho, com o motivo à vista (uma composição só)', () => {
    const t = fonte('app/(dashboard)/empresas/[id]/estoque/vendas/page.tsx')
    expect(t).toMatch(/baixar os outros \{barrados\.seguem\}/)
    expect(t, 'a tela deixou de dizer que o dia continua reprocessável').toMatch(/reprocesso baixa o que faltou/)
    // ⚠️ a régua é a LISTA DESENHADA uma vez só (os outros usos de `.map` são do reenvio,
    // que monta o payload — contá-los seria a sonda errada dando vermelho convincente)
    expect((t.match(/<li key=\{b\.itemId\}/g) ?? []).length, 'lista duplicada por viewport = duas telas divergindo').toBe(1)
  })
})
