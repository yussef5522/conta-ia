// ⛔⛔⛔ CADA GESTO TEM SEU UNIVERSO — o guard POR GESTO (16/09/2026)
//
// **O defeito:** na **entrada manual** (a compra do fermento sem nota) o seletor listava
// *"coisa de CARDÁPIO (fichas) e coisa de PRODUÇÃO"*, e o dono não achava os itens da
// Posição. A rota `/estoque/itens` **sem parâmetro** devolvia tudo.
//
// ⚠️ **O TESTE É POR GESTO, não por função** — o pedido do dono foi literal: *"busca
// 'fermento' → acha o item KG da Posição; busca 'XIS - COMPLETO' → NÃO aparece"*. Um teste
// que só provasse `categoriasDoUniverso` aprovaria a tela que chama com o universo errado.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { categoriasDoUniverso, pesoDaCategoria, fraseDoVazio, type UniversoDoSeletor } from '../universo-do-seletor'
import { seContaFisicamente } from '../tipos-ficha'
import { casaBusca } from '@/lib/busca-texto'

const SUFIXO = `universo-${Date.now()}`
let companyId = ''

/** ⭐ o catálogo da cena real: item de compra, porção produzida e invólucro de cardápio */
const CENA = [
  { nome: 'fermento', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA' },
  { nome: 'COCA COLA LATA 350ML', unidadeControle: 'UN', categoria: 'REVENDA' },
  { nome: 'CAIXA DE PIZZA', unidadeControle: 'UN', categoria: 'EMBALAGEM' },
  { nome: 'DESENGRAXANTE', unidadeControle: 'LT', categoria: 'LIMPEZA' },
  { nome: 'porcao de carne 100 grama', unidadeControle: 'UN', categoria: 'INTERMEDIARIO' },
  { nome: 'XIS - COMPLETO', unidadeControle: 'UN', categoria: 'PRODUTO_FINAL' },
  { nome: 'CALABRESA', unidadeControle: 'UN', categoria: 'SABOR' },
]

beforeAll(async () => {
  const c = await prisma.company.create({ data: { name: `Empresa ${SUFIXO}`, cnpj: `88${Date.now()}`.slice(0, 14) } })
  companyId = c.id
  for (const i of CENA) await prisma.stockItem.create({ data: { companyId, ...i, criadoVia: 'MANUAL' } })
})

afterAll(async () => {
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** ⭐ o que a ROTA devolveria — a MESMA query, com o universo do gesto */
async function listar(universo: UniversoDoSeletor, busca = ''): Promise<string[]> {
  const cats = categoriasDoUniverso(universo)
  const todos = await prisma.stockItem.findMany({
    where: { companyId, ativo: true, ...(cats ? { categoria: { in: [...cats] } } : {}) },
    select: { nome: true, categoria: true },
  })
  return todos.filter((i) => !busca || casaBusca(i.nome, busca)).map((i) => i.nome)
}

describe('⭐⭐⭐ ENTRADA MANUAL / COMPRA → só item de estoque', () => {
  it('⭐ busca "fermento" → acha o item da Posição', async () => {
    const r = await listar('COMPRAVEL', 'fermento')
    expect(r).toContain('fermento')
  })

  /**
   * ⛔⛔ O CASO QUE O DONO NOMEOU: *"compra NUNCA aponta pra ficha de cardápio nem pra
   * tarefa de produção"*.
   */
  it('⛔ "XIS - COMPLETO" NÃO aparece na compra — é ficha de cardápio', async () => {
    expect(await listar('COMPRAVEL', 'XIS')).toEqual([])
  })

  it('⛔ nem o SABOR (invólucro do menu), nem a PORÇÃO (se produz, não se compra)', async () => {
    const tudo = await listar('COMPRAVEL')
    expect(tudo, 'sabor de cardápio entrou na lista de compra').not.toContain('CALABRESA')
    expect(tudo, 'porção produzida entrou na lista de compra').not.toContain('porcao de carne 100 grama')
  })

  it('⭐ e o que SE COMPRA está lá — inclusive limpeza e embalagem', async () => {
    const tudo = await listar('COMPRAVEL')
    expect(tudo).toEqual(expect.arrayContaining(['fermento', 'COCA COLA LATA 350ML', 'CAIXA DE PIZZA', 'DESENGRAXANTE']))
  })
})

describe('⭐⭐ CONTAGEM / SAÍDA → a PRATELEIRA (o que existe fisicamente)', () => {
  /**
   * ⛔ A DIFERENÇA QUE A VARREDURA ACHOU: ninguém COMPRA "porção de carne", mas ela **se
   * conta** (está na câmara) e **se perde** (cai no chão). Tratar compra e prateleira como
   * o mesmo universo poria porção na compra ou tiraria porção da contagem.
   */
  it('⭐ a porção produzida ENTRA na prateleira', async () => {
    expect(await listar('PRATELEIRA')).toContain('porcao de carne 100 grama')
  })

  it('⛔ mas o invólucro de cardápio NÃO — ninguém pesa "XIS - COMPLETO"', async () => {
    const tudo = await listar('PRATELEIRA')
    expect(tudo).not.toContain('XIS - COMPLETO')
    expect(tudo).not.toContain('CALABRESA')
  })

  /**
   * ⭐⭐ E A PRATELEIRA CONCORDA COM `seContaFisicamente` — o dono único da pergunta
   * *"isto ocupa espaço na câmara?"* (03/09).
   *
   * ⚠️ Aqui a régua é uma LISTA (ela vira `where` e não atravessa a query), lá é uma
   * FUNÇÃO. Por isso o teste roda as duas e exige que concordem: sem ele, a divergência
   * nasceria no primeiro tipo novo — que é exatamente como o módulo já perdeu o B1.
   */
  it('⭐⭐ a lista PRATELEIRA == a função seContaFisicamente, item a item', async () => {
    const naPrateleira = new Set(await listar('PRATELEIRA'))
    for (const i of CENA) {
      expect(
        naPrateleira.has(i.nome),
        `"${i.nome}" (${i.categoria}): a lista diz ${naPrateleira.has(i.nome)}, a função diz ${seContaFisicamente(i.categoria)}`,
      ).toBe(seContaFisicamente(i.categoria))
    }
  })
})

describe('⭐ FICHA TÉCNICA → componentes são itens de estoque', () => {
  it('⭐ o intermediário produzido PODE ser ingrediente (xis usa a porção)', async () => {
    expect(await listar('RECEITA')).toContain('porcao de carne 100 grama')
  })

  /** ⚠️ a régua de 27/08, preservada: pano de chão não vai em receita */
  it('⛔ mas DESENGRAXANTE não é ingrediente de lanche', async () => {
    expect(await listar('RECEITA')).not.toContain('DESENGRAXANTE')
  })

  /** ⭐ e a embalagem ENTRA — toda pizza sai com caixa, e ela custa (01/09) */
  it('⭐ a EMBALAGEM entra — sem ela o CMV mente pra baixo', async () => {
    expect(await listar('RECEITA')).toContain('CAIXA DE PIZZA')
  })
})

describe('⭐ VENDA / MAPA → fichas de cardápio e revenda', () => {
  it('⭐ o vendável é o inverso da compra', async () => {
    const v = await listar('VENDAVEL')
    expect(v).toEqual(expect.arrayContaining(['XIS - COMPLETO', 'CALABRESA', 'COCA COLA LATA 350ML']))
    expect(v, 'matéria-prima não se vende no PDV').not.toContain('fermento')
  })
})

describe('⚠️ o CATÁLOGO é o único que mostra tudo — e o nome diz isso', () => {
  it('⭐ ele traz os 7', async () => {
    expect((await listar('CATALOGO')).length).toBe(CENA.length)
  })
})

describe('⭐ o vazio DIZ o recorte', () => {
  /**
   * ⛔ *"Nenhum item encontrado"* faz o dono achar que o item não existe, quando ele só
   * não pertence àquele gesto. **Vazio que não diz o recorte é a ausência fingindo verdade.**
   */
  it('⭐ a frase nomeia o universo', () => {
    expect(fraseDoVazio('COMPRAVEL', 'xis')).toMatch(/COMPRAM/)
    expect(fraseDoVazio('PRATELEIRA', 'xis')).toMatch(/prateleira/)
    expect(fraseDoVazio('COMPRAVEL', 'xis')).toContain('xis')
  })
})

describe('⭐ a ordem serve o gesto', () => {
  it('⭐ na compra, matéria-prima vem antes de uso interno', () => {
    expect(pesoDaCategoria('COMPRAVEL', 'MATERIA_PRIMA')).toBeLessThan(pesoDaCategoria('COMPRAVEL', 'USO_INTERNO'))
  })
  it('⭐ na receita, o produzido vem primeiro (é o que a cozinha mais usa)', () => {
    expect(pesoDaCategoria('RECEITA', 'INTERMEDIARIO')).toBeLessThan(pesoDaCategoria('RECEITA', 'MATERIA_PRIMA'))
  })
})

// ⭐⭐ REGRA 11 — o defeito reposto (universo trocado) tem que ficar vermelho.
describe('o guard morde (auto-teste)', () => {
  it('⛔ universo trocado na compra traria a ficha de cardápio', async () => {
    // é EXATAMENTE o defeito de prod: a compra chamando sem recorte
    const comDefeito = await listar('CATALOGO', 'XIS')
    expect(comDefeito, 'o auto-teste não reproduziu o defeito').toContain('XIS - COMPLETO')
    // e o universo certo não traz
    expect(await listar('COMPRAVEL', 'XIS')).toEqual([])
  })
})

/**
 * ⛔⛔⛔ E O GUARD QUE FALTAVA — **o que a TELA DECLARA**, não só o que a lib sabe.
 *
 * ⚠️⚠️ **A REGRA 11 EXIGIU ESTE BLOCO.** Repondo o defeito exato do dono — a entrada
 * manual apontada pro universo errado — os 515 testes ficaram **VERDES**: os de cima
 * chamam `listar(universo)` direto, e nenhum lê o universo que a TELA escolheu.
 *
 * ⭐ É a lição de sempre nesta casa, agora no seletor: ***guard que testa a lib aprova a
 * tela que ignora a lib*** (a mesma de 14/09 no modal, e de 13/09 no card do PJBANK).
 */
describe('⛔⛔ cada TELA declara o universo do SEU gesto', () => {
  const raiz = process.cwd()
  const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  /** ⭐ o gesto → o universo que ELE tem que declarar */
  const GESTOS: [string, string, string][] = [
    ['entrada manual (compra)', 'app/(dashboard)/empresas/[id]/estoque/entrada-manual/page.tsx', 'COMPRAVEL'],
    ['DANFE digitado (compra)', 'components/estoque/itens-manuais-editor.tsx', 'COMPRAVEL'],
    ['editor de ficha', 'components/estoque/ficha-editor.tsx', 'RECEITA'],
    ['saída / perda', 'components/estoque/saida-modal.tsx', 'PRATELEIRA'],
    // ⚠️ `busca-item.tsx` NÃO entra: ele é a PEÇA, não o gesto — quem declara o universo
    // é quem o monta. Exigir uma constante dentro dele seria travar a peça num gesto só.
  ]

  for (const [gesto, arq, universo] of GESTOS) {
    it(`⭐ ${gesto} → universo ${universo}`, async () => {
      const { readFileSync } = await import('node:fs')
      const src = semComentario(readFileSync(`${raiz}/${arq}`, 'utf-8'))
      // ⚠️ declara pelo helper OU pela prop do seletor único — os dois carregam o universo
      expect(
        /urlDaBuscaDeItens|universo=/.test(src),
        `${arq} não declara universo — volta o default silencioso`,
      ).toBe(true)
      expect(
        src,
        `${arq} declara o universo ERRADO — "${universo}" é o gesto dela`,
      ).toMatch(new RegExp(`['"]${universo}['"]`))
    })
  }

  /**
   * ⛔⛔ E O SELETOR SEM BUSCA NÃO VOLTA — nos DOIS viewports (REGRA 12).
   *
   * ⚠️⚠️ **ISTO QUASE PASSOU:** a entrada manual tem duas composições (tabela no desktop,
   * cards no celular) e eu troquei **só a de cima**. **O dono opera no celular** — o fix
   * teria passado ao lado do caso que motivou o sprint. O guard conta as ocorrências: um
   * `<select>` listando `cat.map` é a lista truncada de volta.
   */
  it('⛔ a entrada manual não tem <select> de catálogo em viewport nenhum', async () => {
    const { readFileSync } = await import('node:fs')
    const src = semComentario(readFileSync(`${raiz}/app/(dashboard)/empresas/[id]/estoque/entrada-manual/page.tsx`, 'utf-8'))
    const selectsDeCatalogo = (src.match(/\{cat\.map\(/g) ?? []).length
    expect(
      selectsDeCatalogo,
      'voltou um <select> com o catálogo truncado — o item fora dos 50 some de novo',
    ).toBe(0)
  })

  /**
   * ⛔ E NINGUÉM CHAMA A ROTA DE LISTAGEM NA MÃO. O helper é o choke-point: é ele que
   * carrega o universo no TIPO, e quem monta a URL à mão escapa da trava.
   */
  it('⛔ nenhum componente monta a URL de listagem na mão', async () => {
    const { readFileSync } = await import('node:fs')
    for (const [, arq] of GESTOS.map((g) => [g[0], g[1]] as const)) {
      const src = semComentario(readFileSync(`${raiz}/${arq}`, 'utf-8'))
      expect(
        /estoque\/itens\?busca=|estoque\/itens`\)/.test(src),
        `${arq} monta a URL na mão — passa por fora do contrato do universo`,
      ).toBe(false)
    }
  })
})
