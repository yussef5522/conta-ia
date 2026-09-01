// ⭐⭐ EMBALAGEM É COMPONENTE DE VERDADE (01/09/2026).
//
// ⛔ ERRO MEU, corrigido: em 27/08 o dono reclamou que a busca de ingredientes oferecia
// "DESENGRAXANTE, SACO DE LIXO e JAPONA DE CÂMARA" pra uma ficha de lanche, e eu cortei
// **EMBALAGEM junto com LIMPEZA**. Não são a mesma coisa: **toda pizza sai com caixa** —
// embalagem CUSTA, BAIXA do estoque e entra no CMV. Sem ela na ficha, o CMV mente pra
// baixo. Pano de chão continua fora, que era o pedido original.
//
// ⚠️ DECISÃO DO DONO sobre a baixa (01/09), depois de eu levantar o problema do canal: o
// relatório do Suitable **NÃO diz** se a venda foi salão, delivery ou retirada (as colunas
// são Produto | Quantidade | Valor Extra | Valor total, e o arquivo real não tem nenhuma
// palavra de canal). Em vez de inventar um marcador "só quando sai pra fora", a regra
// passou a ser **por PRODUTO**: pizza que sempre vai em caixa tem a caixa na ficha; pizza
// que nunca vai, não tem. **Sem estado especial, sem código de canal.**

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { explodir, type Ctx } from '@/lib/stock/vendas/baixa-venda'

const ROTA = readFileSync(join(process.cwd(), 'app/api/empresas/[id]/estoque/itens/route.ts'), 'utf-8')

/**
 * A ficha REAL da pizza da Caçula, montada como o motor a enxerga:
 * PIZZA GRANDE = massa (MATERIA_PRIMA) + molho + queijo + **1 CAIXA P/ PIZZA (EMBALAGEM)**
 */
function ctxDaPizza(): Ctx {
  return {
    componentesByFicha: new Map([
      ['f-pizza', [
        { itemId: 'i-massa', qtdPlanejada: 0.4 },
        { itemId: 'i-molho', qtdPlanejada: 0.12 },
        { itemId: 'i-queijo', qtdPlanejada: 0.2 },
        { itemId: 'i-caixa35', qtdPlanejada: 1 }, // ⭐ a EMBALAGEM
      ]],
    ]),
    fichaByItemProduzido: new Map(),
    fichaById: new Map([['f-pizza', { id: 'f-pizza', tipoProduto: 'PRODUTO_FINAL', itemProduzidoId: 'i-pizza' }]]),
    nomeItem: new Map([
      ['i-massa', 'FARINHA'], ['i-molho', 'MOLHO TOMATE'], ['i-queijo', 'MUSSARELA'],
      ['i-caixa35', 'CAIXA P/ PIZZA OITAVADA 35X35X4.0 CM'],
    ]),
  }
}

/** as categorias que a busca da ficha aceita (lida da própria rota) */
function catsDaBusca(): string[] {
  const m = ROTA.match(/const CATS_RECEITA = \[([^\]]+)\]/)
  return m ? m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean) : []
}

describe('⭐⭐ a busca da ficha aceita EMBALAGEM e recusa LIMPEZA', () => {
  const cats = catsDaBusca()

  it('⭐⭐ o caso REAL: a caixa de pizza pode entrar na ficha', () => {
    // "CAIXA P/ PIZZA OITAVADA 35X35X4.0 CM" é categoria EMBALAGEM no catálogo da Caçula
    expect(cats).toContain('EMBALAGEM')
  })

  it('⛔ e o pedido de 27/08 continua valendo: limpeza NÃO é ingrediente', () => {
    expect(cats).not.toContain('LIMPEZA')
    expect(cats).not.toContain('USO_INTERNO')
  })

  it('⭐ o resto continua como estava (não alarguei nada além do pedido)', () => {
    expect(cats.sort()).toEqual(
      ['EMBALAGEM', 'INTERMEDIARIO', 'MATERIA_PRIMA', 'PRODUTO_FINAL', 'REVENDA'],
    )
  })
})

describe('⭐⭐ embalagem BAIXA como qualquer componente — RODANDO a explosão', () => {
  it('⭐⭐ vender 1 pizza baixa 1 CAIXA, junto com a comida', () => {
    const acc = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId: 'f-pizza' }, 1, ctxDaPizza(), acc)
    expect(acc.get('i-caixa35')).toBe(1)
    expect(acc.get('i-queijo')).toBe(0.2)
    expect(acc.size).toBe(4) // nada foi filtrado fora
  })

  it('⭐⭐ 38 pizzas (o volume real do "GRANDE PRECINHO") baixam 38 caixas', () => {
    const acc = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId: 'f-pizza' }, 38, ctxDaPizza(), acc)
    expect(acc.get('i-caixa35')).toBe(38)
    expect(acc.get('i-massa')).toBe(15.2)
  })

  it('⛔⛔ NÃO existe caso especial: a caixa sai pela MESMA porta que o queijo', () => {
    // ⚠️ a decisão do dono foi "componente normal, sem estado especial". Se um dia alguém
    // puser uma regra própria pra embalagem aqui, a ficha passa a mentir sobre o que baixa.
    const acc = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId: 'f-pizza' }, 3, ctxDaPizza(), acc)
    // a razão entre o que saiu é a razão da ficha, pra todos
    // ⚠️ `toBeCloseTo`, não `toBe`: `explodir` arredonda em 2 casas (3 × 0,2 → 0,6) e a
    // divisão de volta dá 2,9999999999999996. Ponto flutuante, não defeito.
    expect(acc.get('i-caixa35')! / 1).toBeCloseTo(acc.get('i-queijo')! / 0.2, 6)
  })

  it('⭐ e o CUSTO da pizza inclui a caixa — é a soma das folhas que saíram', () => {
    // o hub do cardápio reusa esta MESMA explosão com qtd=1 (REGRA 4), então o custo do
    // produto é Σ(folha × custo médio). Sem a caixa na ficha, o CMV mentiria pra baixo.
    const custo = new Map([['i-massa', 3.2], ['i-molho', 12.5], ['i-queijo', 31.9], ['i-caixa35', 1.85]])
    const acc = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId: 'f-pizza' }, 1, ctxDaPizza(), acc)
    const total = [...acc].reduce((s, [id, q]) => s + q * (custo.get(id) ?? 0), 0)
    const semCaixa = total - 1 * 1.85
    // ⚠️ 0,4×3,20 + 0,12×12,50 + 0,2×31,90 + 1×1,85 = 11,01 (conferido à mão — a 1ª
    // versão deste teste dizia 11,06: erro MEU de asserção, não do motor).
    expect(Math.round(total * 100) / 100).toBe(11.01)
    expect(Math.round(semCaixa * 100) / 100).toBe(9.16) // ⛔ 1,85 a menos por pizza no CMV
  })

  it('⚠️ pizza SEM caixa na ficha não baixa caixa (a regra é por PRODUTO)', () => {
    // o dono cortou o marcador de canal: "pizza que sempre vai com caixa tem a caixa na
    // ficha; pizza que nunca vai, não tem". É a ficha que decide, não um estado especial.
    const ctx = ctxDaPizza()
    ctx.componentesByFicha.set('f-pizza', ctx.componentesByFicha.get('f-pizza')!.filter((c) => c.itemId !== 'i-caixa35'))
    const acc = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId: 'f-pizza' }, 10, ctx, acc)
    expect(acc.has('i-caixa35')).toBe(false)
    expect(acc.get('i-queijo')).toBe(2)
  })
})

describe('⚠️ o canal da venda NÃO existe no Suitable — e nada foi construído pra ele', () => {
  it('⛔ o parser lê 4 colunas, e nenhuma é canal', () => {
    const P = readFileSync(join(process.cwd(), 'lib/stock/vendas/parse-suitable.ts'), 'utf-8')
    expect(P).toMatch(/Produto \| Quantidade \| Valor Extra \| Valor total/)
    for (const termo of ['canal', 'delivery', 'salao', 'salão', 'retirada']) {
      expect(P.toLowerCase(), `o parser não deve falar de "${termo}"`).not.toContain(termo)
    }
  })

  it('⛔⛔ e a ficha NÃO ganhou marcador de canal (a regra é por PRODUTO)', () => {
    // ⚠️ o dono cortou o marcador "só quando sai pra fora" de propósito: inventar um
    // estado que o dado não sustenta seria pior que a imprecisão conhecida.
    const SCHEMA = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf-8')
    const ficha = SCHEMA.slice(SCHEMA.indexOf('model StockFichaComponente'))
      .slice(0, SCHEMA.slice(SCHEMA.indexOf('model StockFichaComponente')).indexOf('}'))
    for (const termo of ['canal', 'delivery', 'somenteFora', 'apenasDelivery']) {
      expect(ficha.toLowerCase()).not.toContain(termo.toLowerCase())
    }
  })
})
