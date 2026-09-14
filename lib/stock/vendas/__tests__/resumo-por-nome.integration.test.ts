// ⭐⭐⭐ O RESUMO DO IMPORT LISTA TUDO, POR NOME (14/09/2026) — ordem do dono.
//
// **O relato:** *"o que o Yussef viu como 'só leu cachorro quente'"*. Medido: o plano
// SEMPRE carregou tudo (`produtos` com nome + quantidade + destino, `pendentes`, `fora`);
// **a TELA é que só desenhava o `agregada`** — o que sai do ESTOQUE, por item.
//
// ⛔ E isso não responde a pergunta que ele fez (*"e a COCA COLA 2L?"*): um xis vira 6
// itens, então o nome do PDV **sumia no meio do efeito**. **Contar o efeito não é listar
// o que entrou.**

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { montarPlanoDeLinhas } from '../baixa-venda'

const CNPJ = '50607080000717'
let companyId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA RESUMO' } })).id

  const item = async (nome: string, cat = 'REVENDA') =>
    (await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria: cat, criadoVia: 'MANUAL' } })).id
  const coca = await item('COCA-COLA 2L')
  const pao = await item('PAO DE XIS', 'MATERIA_PRIMA')
  const beef = await item('beef', 'INTERMEDIARIO')

  /** ⚠️ a ficha de PRODUTO_FINAL explode na venda — é o caso que faz o nome sumir */
  const ficha = async (itemProduzidoId: string, comps: { itemId: string; qtd: number }[]) => {
    const f = await prisma.stockFicha.create({ data: { companyId, itemProduzidoId, tipoProduto: 'PRODUTO_FINAL', versaoAtual: 1, ativo: true } })
    const v = await prisma.stockFichaVersao.create({ data: { companyId, fichaId: f.id, versao: 1, loteBase: 1, unidadeLoteBase: 'UN' } })
    for (const c of comps) await prisma.stockFichaComponente.create({ data: { companyId, versaoId: v.id, itemId: c.itemId, qtdPlanejada: c.qtd, unidade: 'UN' } })
    await prisma.stockFicha.update({ where: { id: f.id }, data: { versaoAtual: 1 } })
    return f.id
  }
  /**
   * ⚠️ A FICHA NÃO PODE PRODUZIR E CONSUMIR O MESMO ITEM — `criarFicha` recusa isso desde
   * 09/09 (ciclo), e o meu 1º fixture caiu nele: *"Explosão de venda muito profunda"*.
   * O invólucro do cardápio é um item PRÓPRIO que baixa a garrafa.
   */
  const fCoca = await ficha(await item('COCA COLA 2L (menu)', 'PRODUTO_FINAL'), [{ itemId: coca, qtd: 1 }])
  const fXis = await ficha(await item('XIS COMPLETO', 'PRODUTO_FINAL'), [{ itemId: pao, qtd: 1 }, { itemId: beef, qtd: 1 }])

  for (const [nome, fichaId] of [['COCA COLA 2L', fCoca], ['XIS COMPLETO', fXis]] as const) {
    await prisma.stockVendaProdutoMap.create({ data: { companyId, nomeSuitable: nome, alvoTipo: 'FICHA', fichaId } })
  }
})

afterEach(async () => {
  for (const t of ['stockVendaProdutoMap', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** as linhas REAIS do import de 13/09 que o dono trouxe */
const LINHAS = [
  { produto: 'COCA COLA 2L', quantidade: 15, valorTotal: 0 },
  { produto: 'XIS COMPLETO', quantidade: 3, valorTotal: 0 },
  { produto: 'COCA COLA LATA', quantidade: 5, valorTotal: 0 },              // ⛔ sem mapa
  { produto: 'COCA LATA MAIS MINI FRITAS', quantidade: 19, valorTotal: 0 }, // ⛔ combo, sem mapa
]

describe('⭐⭐ o plano responde "e a COCA COLA 2L?"', () => {
  it('⭐⭐ cada nome do PDV aparece com QUANTIDADE e DESTINO', async () => {
    const p = await montarPlanoDeLinhas(companyId, '2026-09-13', LINHAS, null, prisma)
    const coca = p.produtos.find((x) => x.nome === 'COCA COLA 2L')
    expect(coca, 'a COCA COLA 2L sumiu do resumo').toBeDefined()
    expect(coca!.quantidade).toBe(15)
    // ⚠️ o destino é o INVÓLUCRO do cardápio; a garrafa é o que SAI (ver `agregada`)
    expect(coca!.alvoNome).toBe('COCA COLA 2L (menu)')
    expect(coca!.baixa.map((b) => b.nome)).toEqual(['COCA-COLA 2L'])
  })

  it('⛔⛔ e o nome NÃO se perde quando 1 venda vira N itens — o caso do xis', async () => {
    // ⚠️ é aqui que a lista por ITEM engana: o XIS vira PAO + beef, e quem lê o
    // `agregada` não acha "XIS COMPLETO" em lugar nenhum
    const p = await montarPlanoDeLinhas(companyId, '2026-09-13', LINHAS, null, prisma)
    expect(p.produtos.find((x) => x.nome === 'XIS COMPLETO')!.quantidade).toBe(3)
    expect(p.agregada.map((a) => a.nome)).not.toContain('XIS COMPLETO')
  })

  it('⭐⭐ os SEM MAPA aparecem por nome — "baixou N × pendente M"', async () => {
    const p = await montarPlanoDeLinhas(companyId, '2026-09-13', LINHAS, null, prisma)
    expect(p.produtos).toHaveLength(2)
    expect(p.pendentes.map((x) => x.nome).sort())
      .toEqual(['COCA COLA LATA', 'COCA LATA MAIS MINI FRITAS'])
  })

  it('⛔⛔ e NADA some calado: todo nome do arquivo cai num dos TRÊS baldes', async () => {
    // ⚠️ é o invariante que segura o resumo — nome que não caia em balde nenhum vira
    // exatamente a dívida invisível que este módulo mais paga
    const p = await montarPlanoDeLinhas(companyId, '2026-09-13', LINHAS, null, prisma)
    const contados = [...p.produtos, ...p.pendentes, ...p.fora].map((x) => x.nome).sort()
    expect(contados).toEqual(LINHAS.map((l) => l.produto).sort())
  })

  /**
   * ⚠️⚠️ A REGRA 11 ME PEGOU: os testes acima provam o PLANO — e ele **sempre** carregou
   * tudo. Apagar o resumo por nome DA TELA deixava os 5 verdes. *Guard que testa o dado
   * aprova a tela que não o desenha* (a mesma lição do card do PJBANK, ontem).
   */
  it('⛔⛔ e a TELA desenha o resumo por nome — não só o que sai do estoque', () => {
    const src = readFileSync(join(__dirname, '..', '..', '..', '..', 'components', 'estoque', 'plano-venda-modal.tsx'), 'utf8')
    expect(src, 'o resumo por nome sumiu da tela').toContain('o que cada nome do PDV baixou')
    expect(src).toMatch(/plano\.produtos\.map/)
    // ⭐ e os três contadores, que são a frase "baixou N × pendente M × fora K"
    expect(src).toContain('baixam')
    expect(src).toContain('sem mapa')
  })

  it('⭐ e o "fora" (desmarcado) também é nomeado, nunca só contado', async () => {
    const p = await montarPlanoDeLinhas(companyId, '2026-09-13', LINHAS, ['COCA COLA 2L'], prisma)
    expect(p.fora.map((x) => x.nome)).toEqual(['XIS COMPLETO'])
    expect(p.fora[0].quantidade).toBe(3)
  })
})
