// ⭐⭐ FICHA ARQUIVADA NÃO APARECE NA BUSCA DE ORDEM (01/09/2026).
//
// *"Operação de dado de hoje é o caso que o teste de amanhã protege"* (dono, ao aprovar
// este guard). Hoje eu arquivei a ficha de TESTE "porcao de carne 100 grama" à mão, em
// prod — o guard da exclusão barrou o apagar (1 produção concluída, 25 UN de saldo) e
// arquivar foi a saída. Nada garantia que ela não voltasse a aparecer.
//
// ⚠️ E ela era especial: a única de LOTE FIXO (componentes de 1 KG com `loteBase` 1), o
// que fazia o selo teórico calcular **2500%**. Se ela reaparecer na busca e alguém criar
// uma ordem, o número volta junto.
//
// ⚠️ ITEM e FICHA são flags SEPARADAS, e isso importa: `stockItem.ativo` governa a Posição
// (o saldo aparece?), `stockFicha.ativo` governa a busca de ordem (dá pra produzir?).
// Arquivei as duas hoje; dá pra ter uma sem a outra — item ativo com ficha arquivada é
// "tenho o estoque, mas não produzo mais isto".

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { ehReceitaDeProducao } from '../tipo-receita'
import { listFichas } from '../fichas'

const CNPJ = '50505050000255'
let companyId: string
let insumoId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'ARQ' } })
  companyId = c.id
  const it = await prisma.stockItem.create({ data: { companyId, nome: 'CARNE', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
  insumoId = it.id
})
afterEach(async () => {
  for (const t of ['stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** cria uma ficha de produção direto no banco (sem passar pelo guard de nome duplicado) */
async function criar(nome: string, ativo = true) {
  const prod = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' } })
  const f = await prisma.stockFicha.create({ data: { companyId, itemProduzidoId: prod.id, tipoProduto: 'INTERMEDIARIO', versaoAtual: 1, ativo } })
  const v = await prisma.stockFichaVersao.create({ data: { companyId, fichaId: f.id, versao: 1, loteBase: 1, unidadeLoteBase: 'UN' } })
  await prisma.stockFichaComponente.create({ data: { companyId, versaoId: v.id, itemId: insumoId, qtdPlanejada: 0.1, unidade: 'KG', posicao: 0 } })
  return { fichaId: f.id, itemId: prod.id }
}

/** a régua REAL da busca de nova ordem: rota devolve, tela filtra por tipo */
const oferecidasNaBusca = (fichas: { tipoProduto: string; ativo: boolean; nomeProduzido: string }[]) =>
  // ⭐ SÓ `ehReceitaDeProducao` — a régua carrega o `ativo` por dentro, exatamente como as
  // duas telas fazem. Um `.filter(f => f.ativo)` aqui esconderia que a tela não filtra.
  fichas.filter(ehReceitaDeProducao).map((f) => f.nomeProduzido)

describe('⛔⛔ ficha ARQUIVADA some da busca de nova ordem', () => {
  it('⛔⛔ a arquivada não é oferecida; a ativa continua', async () => {
    await criar('porcao queijo 135 grama')
    await criar('porcao de carne 100 grama', false) // ⬅️ a de TESTE, arquivada hoje em prod

    const fichas = await listFichas(companyId, prisma)
    expect(fichas).toHaveLength(2) // a listagem crua traz as duas
    expect(oferecidasNaBusca(fichas)).toEqual(['porcao queijo 135 grama'])
  })

  it('⛔ e desarquivar a traz de volta — o estado é reversível, não destrutivo', async () => {
    const { fichaId } = await criar('porcao de carne 100 grama', false)
    expect(oferecidasNaBusca(await listFichas(companyId, prisma))).toHaveLength(0)

    await prisma.stockFicha.update({ where: { id: fichaId }, data: { ativo: true } })
    expect(oferecidasNaBusca(await listFichas(companyId, prisma))).toEqual(['porcao de carne 100 grama'])
  })

  it('⚠️ ITEM e FICHA são flags SEPARADAS — arquivar a ficha não tira o saldo da Posição', async () => {
    // ⚠️ é a distinção que me mordeu hoje: arquivei as duas de uma vez e o saldo de
    // R$ 90,50 saiu da Posição junto. Dá pra ter "não produzo mais, mas ainda tenho".
    const { fichaId, itemId } = await criar('porcao de carne 100 grama')
    await prisma.stockFicha.update({ where: { id: fichaId }, data: { ativo: false } })

    const item = await prisma.stockItem.findUnique({ where: { id: itemId }, select: { ativo: true } })
    expect(item!.ativo).toBe(true) // ⭐ o ITEM segue ativo: o estoque continua visível
    expect(oferecidasNaBusca(await listFichas(companyId, prisma))).toHaveLength(0)
  })

  it('⭐ as duas telas usam a MESMA régua (busca de ordem e Receitas de produção)', async () => {
    await criar('ativa A')
    await criar('arquivada B', false)
    const fichas = await listFichas(companyId, prisma)
    // a tela de Receitas faz exatamente isto; a de nova ordem também
    const receitas = fichas.filter(ehReceitaDeProducao)
    expect(receitas.map((f) => f.nomeProduzido)).toEqual(['ativa A'])
  })
})
