// ⛔⛔⛔ O GESTO REAL DO CARTEIRO: URL da revisão → criar ficha → ficha + vínculo NA MESMA
// TRANSAÇÃO → a revisão devolve VINCULADO (10/05/2026).
//
// ⭐ Este teste percorre o CAMINHO INTEIRO, não a função do meio: ele parte da query que a
// revisão do import monta (`?mapearComplemento=X&tipo=SABOR`), passa pela rede única
// (`nomesDeComplementoDaUrl`) e entrega o resultado ao `criarFicha` — a MESMA porta que o POST
// do editor chama. ⚠️ Testar só `criarFicha` com o nome na mão provaria a porta e **aprovaria
// a tela que não lê o param** (a cicatriz de 14/09): o defeito de 10/05 vivia ANTES da porta.
//
// ⛔ E ele afirma a ATOMICIDADE pelo contrafactual: com `componentes: []` o `criarFicha` recusa
// ANTES de qualquer escrita, então **nem a ficha nem o vínculo nascem** — meia-gravação é
// impossível, não "checada".

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, FichaError } from '../fichas'
import { nomesDeComplementoDaUrl } from '../voltar-ficha'
import { montarRevisaoDeLinhas } from '@/lib/stock/vendas/revisao-do-import'

const CNPJ = '10101010000110'
/** O sabor real de outubro: ficha criada, vínculo ZERO, 241 vendas sem baixa. */
const SABOR = 'NAPOLITANA'
const DIA = '2026-05-10'

let companyId: string
let itemId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'CARTEIRO DO VINCULO' } })
  companyId = c.id
  // a porção que o sabor consome — com custo, pra a ficha nascer com custo fechado
  const it = await prisma.stockItem.create({
    data: { companyId, nome: 'porcao de napolitana 100 grama', unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
  })
  itemId = it.id
  await prisma.stockMovement.create({
    data: { companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 2.5, custoTotal: 250, origem: 'SEFAZ' },
  })
})

afterEach(async () => {
  for (const t of ['stockVendaGrafiaAgrupada', 'stockVendaComplementoMap', 'stockMovement', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** O corpo que o editor manda no POST, montado DA URL — como a tela faz. */
function corpoDoEditor(query: string) {
  const nomes = nomesDeComplementoDaUrl(new URLSearchParams(query))
  return {
    companyId,
    nomeProduzido: SABOR,
    unidadeProduzido: 'UN',
    tipoProduto: 'SABOR' as const,
    loteBase: 1,
    unidadeLoteBase: 'UN',
    componentes: [{ itemId, qtdPlanejada: 1, unidade: 'UN' }],
    mapearComplemento: nomes.length ? nomes : null,
  }
}

describe('revisão → criar ficha: ficha E vínculo juntos', () => {
  it('⭐⭐ O GESTO INTEIRO: `?mapearComplemento=X&tipo=SABOR` grava ficha + vínculo', async () => {
    const r = await criarFicha(corpoDoEditor(`nome=${SABOR}&mapearComplemento=${SABOR}&tipo=SABOR`), prisma)

    // a ficha nasceu
    const ficha = await prisma.stockFicha.findUnique({ where: { id: r.fichaId } })
    expect(ficha?.companyId).toBe(companyId)
    expect(ficha?.tipoProduto).toBe('SABOR')

    // ⭐ e o VÍNCULO nasceu no mesmo gesto, apontando pra ELA
    const mapa = await prisma.stockVendaComplementoMap.findMany({ where: { companyId } })
    expect(mapa).toHaveLength(1)
    expect(mapa[0].nomeSuitable).toBe(SABOR)
    expect(mapa[0].alvoTipo).toBe('FICHA')
    expect(mapa[0].fichaId).toBe(r.fichaId)
    expect(r.vinculadoAoPdv).toBe(true)
  })

  it('⭐⭐ a REVISÃO devolve VINCULADO pro nome — era aqui que ela dizia "sem destino"', async () => {
    await criarFicha(corpoDoEditor(`nome=${SABOR}&mapearComplemento=${SABOR}&tipo=SABOR`), prisma)

    const rev = await montarRevisaoDeLinhas(companyId, DIA, 'COMPLEMENTOS', [{ nome: SABOR, ocorrencias: 241 }], prisma)
    const linha = rev.linhas.find((l) => l.nome === SABOR)
    expect(linha?.estado).toBe('VINCULADO')
    expect(rev.contadores.vinculados).toBe(1)
    expect(rev.contadores.semVinculo).toBe(0)
    // ⭐ e as 241 ocorrências do sabor passam a BAIXAR estoque — o que o defeito custava
    expect(rev.ocorrencias.vinculadas).toBe(241)
    expect(rev.ocorrencias.semVinculo).toBe(0)
  })

  it('⛔ O CONTRAFACTUAL DO DEFEITO: lendo só `complemento`, a ficha nasce ÓRFÃ', async () => {
    // é exatamente o que a tela fazia: `qp.getAll('complemento')` na URL com o ALIAS
    const query = `nome=${SABOR}&mapearComplemento=${SABOR}&tipo=SABOR`
    const reguaVelha = new URLSearchParams(query).getAll('complemento')
    const r = await criarFicha({ ...corpoDoEditor(query), mapearComplemento: reguaVelha.length ? reguaVelha : null }, prisma)

    expect(r.vinculadoAoPdv).toBe(false)
    expect(await prisma.stockVendaComplementoMap.count({ where: { companyId } })).toBe(0)

    // ⭐ e é por isso que a revisão seguia cobrando o mesmo nome: ficha existe, vínculo não
    const rev = await montarRevisaoDeLinhas(companyId, DIA, 'COMPLEMENTOS', [{ nome: SABOR, ocorrencias: 241 }], prisma)
    expect(rev.linhas.find((l) => l.nome === SABOR)?.estado).toBe('SEM_VINCULO')
    expect(rev.contadores.semVinculo).toBe(1)
    expect(rev.ocorrencias.semVinculo).toBe(241)
  })

  it('⛔ ATOMICIDADE: ficha recusada não deixa vínculo pela metade', async () => {
    const corpo = { ...corpoDoEditor(`mapearComplemento=${SABOR}`), componentes: [] }
    await expect(criarFicha(corpo, prisma)).rejects.toThrow(FichaError)

    expect(await prisma.stockFicha.count({ where: { companyId } })).toBe(0)
    expect(await prisma.stockVendaComplementoMap.count({ where: { companyId } })).toBe(0)
  })

  it('a convenção `?complemento=` do cardápio continua gravando igual', async () => {
    const r = await criarFicha(corpoDoEditor(`nome=${SABOR}&complemento=${SABOR}&tipo=SABOR`), prisma)
    expect(r.vinculadoAoPdv).toBe(true)
    const mapa = await prisma.stockVendaComplementoMap.findMany({ where: { companyId } })
    expect(mapa.map((m) => m.nomeSuitable)).toEqual([SABOR])
  })

  it('as DUAS grafias no mesmo link viram UM vínculo (o upsert não briga com ele mesmo)', async () => {
    const r = await criarFicha(corpoDoEditor(`complemento=${SABOR}&mapearComplemento=${SABOR}`), prisma)
    expect(r.vinculadoAoPdv).toBe(true)
    expect(await prisma.stockVendaComplementoMap.count({ where: { companyId } })).toBe(1)
  })

  it('sem nome na URL, a ficha nasce sem vínculo — e isso é o caminho LEGÍTIMO (receita avulsa)', async () => {
    const r = await criarFicha(corpoDoEditor('tipo=SABOR'), prisma)
    expect(r.vinculadoAoPdv).toBe(false)
    expect(await prisma.stockFicha.count({ where: { companyId } })).toBe(1)
    expect(await prisma.stockVendaComplementoMap.count({ where: { companyId } })).toBe(0)
  })
})
