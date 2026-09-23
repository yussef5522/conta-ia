/**
 * ⭐⭐⭐ RECUSA SEM PORTA É BECO SEM SAÍDA (22/09/2026) — o pedido do dono.
 *
 * *"Contei a porção calabresa e a recusa diz só 'estoque negativo, não aceita' — sem
 * explicar POR QUE nem O QUE FAZER."*
 *
 * ⛔ A régua NÃO mudou (o guard de 11/09 continua recusando o mesmo estado impossível).
 * O que este arquivo trava é a **frase** e a **porta**: item PRODUZIDO negativo pede
 * PRODUÇÃO, não nota de compra, e sempre tem pra onde ir.
 *
 * ⚠️ REGRA 3: roda o caminho REAL (`criarMovimento` contra o banco) e o tradutor REAL —
 * grep de string no arquivo não distingue "a frase existe" de "a frase é entregue".
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento, MovementInvalidError } from '../movement'
import { respostaDeErroDoEstoque } from '../erro-da-tela'
import { porQueEstaNegativo, portaDoNegativo, familiaDoItem, type FatosDoNegativo } from '../porta-do-negativo'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CNPJ = '50607080000931' // ⚠️ exclusivo deste arquivo (guard de colisão, 21/09)
let companyId = ''
let porcaoId = ''   // INTERMEDIARIO, negativo — o caso do dono
let fermentoId = '' // MATERIA_PRIMA, negativo — o caso de 16/09, que NÃO pode regredir
let fichaId = ''

/** deixa o item com saldo e valor negativos, como a operação real deixou */
async function deixarNegativo(itemId: string, qtd: number, valor: number) {
  await prisma.stockMovement.create({
    data: { companyId, itemId, tipo: 'BAIXA_VENDA', quantidade: qtd, custoUnitario: 0, custoTotal: valor, origem: 'TESTE' },
  })
}

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const co = await prisma.company.create({ data: { name: 'porta-negativo', cnpj: CNPJ }, select: { id: true } })
  companyId = co.id
  const p = await prisma.stockItem.create({
    data: { companyId, nome: 'PORÇAO CALABRESA 85g congelada', unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
    select: { id: true },
  })
  porcaoId = p.id
  const f = await prisma.stockItem.create({
    data: { companyId, nome: 'FERMENTO BIOLOGICO', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
    select: { id: true },
  })
  fermentoId = f.id
  const fi = await prisma.stockFicha.create({
    data: { companyId, itemProduzidoId: porcaoId, tipoProduto: 'INTERMEDIARIO', versaoAtual: 1, ativo: true },
    select: { id: true },
  })
  fichaId = fi.id
  // os números REAIS de prod: a porção em −8 UN / −R$ 135,20; o fermento em −1,92 / −R$ 31,04
  await deixarNegativo(porcaoId, -8, -135.2)
  await deixarNegativo(fermentoId, -1.92, -31.04)
})

afterAll(async () => {
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockFicha.deleteMany({ where: { companyId } })
  await prisma.stockProductionOrder.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** o gesto do dono: contar 10 na prateleira = ajuste que cruza o zero */
async function contar(itemId: string, ajuste: number) {
  try {
    await criarMovimento(prisma, {
      companyId, itemId, tipo: 'AJUSTE_CONTAGEM', quantidade: ajuste, custoUnitario: 0, custoTotal: 0, origem: 'TESTE',
    })
    return null
  } catch (e) {
    if (!(e instanceof MovementInvalidError)) throw e
    return e
  }
}

describe('⛔⛔ o item PRODUZIDO negativo pede PRODUÇÃO, nunca nota de compra', () => {
  it('⭐ a recusa DIZ o porquê — "vendeu sem ter produção registrada"', async () => {
    const e = await contar(porcaoId, 18)
    expect(e, 'a régua parou de recusar — ela NÃO devia mudar').not.toBeNull()
    expect(e!.message).toContain('vendeu sem ter produção registrada')
    // ⛔ e a frase do fermento NÃO pode vazar pra cá: ninguém compra porção de calabresa
    expect(e!.message, 'voltou a mandar o dono caçar uma nota que não existe')
      .not.toContain('falta registrar a COMPRA')
    // ⭐ o motivo de a recusa existir, dito na cara: contar por cima enterra o lote
    expect(e!.message).toContain('ENTERRA o lote')
  })

  it('⭐ e o MATERIA_PRIMA continua pedindo a COMPRA (o caso do fermento, 16/09)', async () => {
    const e = await contar(fermentoId, 11.92)
    expect(e).not.toBeNull()
    expect(e!.message).toContain('falta registrar a COMPRA')
    expect(e!.message, 'a frase de produção vazou pro item comprado')
      .not.toContain('vendeu sem ter produção registrada')
  })
})

describe('⛔⛔ A PORTA — três casos, e NENHUM é beco sem saída', () => {
  it('⭐ com ORDEM PARADA, linka DIRETO nela (a porta mais curta)', async () => {
    const o = await prisma.stockProductionOrder.create({
      data: {
        companyId, fichaId, versaoFicha: 1, itemProduzidoId: porcaoId,
        dataProducao: new Date('2026-09-19T00:00:00.000Z'), estado: 'EM_PRODUCAO', escalaReceitas: 1,
      },
      select: { id: true },
    })
    const e = await contar(porcaoId, 18)
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })!
    expect(r.status).toBe(422)
    expect(r.saida?.href).toBe(`/empresas/${companyId}/estoque/producao/${o.id}`)
    expect(r.saida?.rotulo).toContain('concluir a ordem aberta')
    // ⚠️ a data é de CALENDÁRIO: formatar no fuso a puxaria pro dia 18
    expect(r.saida?.rotulo).toContain('19/09')
    await prisma.stockProductionOrder.deleteMany({ where: { companyId } })
  })

  it('⭐ sem ordem mas COM ficha, abre a produção JÁ com a ficha escolhida', async () => {
    const e = await contar(porcaoId, 18)
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })!
    // ⛔ sem o `?ficha=` o dono cai num dropdown pra procurar o que o sistema nomeou
    expect(r.saida?.href).toBe(`/empresas/${companyId}/estoque/producao?ficha=${fichaId}`)
    expect(r.saida?.rotulo).toContain('registrar a produção que faltou')
  })

  it('⛔⛔ sem ordem e sem ficha, AINDA tem porta — a entrada com motivo', async () => {
    await prisma.stockFicha.updateMany({ where: { companyId }, data: { ativo: false } })
    const e = await contar(porcaoId, 18)
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })!
    expect(r.saida, 'BECO SEM SAÍDA — o único desfecho proibido').toBeTruthy()
    expect(r.saida!.href).toBe(`/empresas/${companyId}/estoque/itens/${porcaoId}`)
    expect(r.saida!.rotulo).toContain('lançar a entrada que faltou')
    await prisma.stockFicha.updateMany({ where: { companyId }, data: { ativo: true } })
  })

  it('⛔ e o COMPRADO vai pro histórico, não pra produção', async () => {
    const e = await contar(fermentoId, 11.92)
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })!
    expect(r.saida!.href).toBe(`/empresas/${companyId}/estoque/itens/${fermentoId}`)
    expect(r.saida!.href, 'item comprado sendo mandado pra produção').not.toContain('/producao')
  })
})

describe('⭐ a régua pura — a família sai do dono único do vocabulário', () => {
  it('produzido × comprado', () => {
    expect(familiaDoItem('INTERMEDIARIO')).toBe('PRODUZIDO')
    expect(familiaDoItem('PRODUTO_FINAL')).toBe('PRODUZIDO')
    expect(familiaDoItem('SABOR')).toBe('PRODUZIDO')
    expect(familiaDoItem('MATERIA_PRIMA')).toBe('COMPRADO')
    expect(familiaDoItem('REVENDA')).toBe('COMPRADO')
    // ⚠️ categoria desconhecida cai em COMPRADO: mandar pra produção um item que talvez
    // não se produza seria inventar um gesto; o histórico serve pros dois.
    expect(familiaDoItem(null)).toBe('COMPRADO')
  })

  it('⛔⛔ NENHUMA combinação de fatos devolve porta vazia', () => {
    const base: FatosDoNegativo = {
      empresaId: 'e1', itemId: 'i1', nome: 'X', unidade: 'UN', saldoAntes: -3, familia: 'PRODUZIDO',
    }
    for (const familia of ['PRODUZIDO', 'COMPRADO'] as const) {
      for (const ordem of [null, { id: 'o1', dia: '19/09' }]) {
        for (const ficha of [null, 'f1']) {
          const p = portaDoNegativo({ ...base, familia, ordemAberta: ordem, fichaAtivaId: ficha })
          expect(p.href, `beco: ${familia}/${!!ordem}/${!!ficha}`).toMatch(/^\/empresas\//)
          expect(p.rotulo.length).toBeGreaterThan(5)
        }
      }
    }
  })

  it('⭐ a frase fala a UNIDADE do item', () => {
    const f: FatosDoNegativo = { empresaId: 'e', itemId: 'i', nome: 'PORÇAO', unidade: 'UN', saldoAntes: -8, familia: 'PRODUZIDO' }
    expect(porQueEstaNegativo(f)).toContain('-8 UN')
    expect(porQueEstaNegativo({ ...f, unidade: 'KG', saldoAntes: -1.92 })).toContain('-1.92 KG')
  })
})

describe('⛔ A TELA ENTREGA A PORTA — composição ÚNICA, os dois viewports (REGRA 12)', () => {
  const tela = readFileSync(
    join(process.cwd(), 'app/(dashboard)/empresas/[id]/estoque/contagem/page.tsx'), 'utf-8',
  )

  it('⭐ os DOIS estados de erro da tela desenham o link da saída', () => {
    // ⚠️ a tela tem UMA composição (não há bloco mobile + bloco desktop) — o que existe
    // são dois ESTADOS (antes de começar e contando). Os dois precisam do link, senão a
    // porta some justamente quando o dono bate nela no meio da contagem.
    const blocos = tela.match(/erro\.saida &&/g) ?? []
    expect(blocos.length, 'um dos estados de erro ficou sem a saída').toBe(2)
    expect(tela).toContain('erro.saida.href')
    expect(tela).toContain('erro.saida.rotulo')
  })

  it('⭐ e a produção LÊ o ?ficha= — senão a porta é meia-porta', () => {
    const prod = readFileSync(
      join(process.cwd(), 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'), 'utf-8',
    )
    expect(prod).toContain("get('ficha')")
    // ⛔ e ABRE o formulário sozinho: chegar na tela com o form fechado é chegar em lugar nenhum
    expect(prod).toContain('useState(!!fichaDaUrl)')
    expect(prod).toContain('fichaInicial')
  })
})
