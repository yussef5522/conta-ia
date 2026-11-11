// SUITAPI — os COMPLEMENTOS pela régua contra 3 DIAS REAIS (07, 08 e 09/11/2026: os pedidos da
// API e o que o XLS de complementos gravou — só nomes de opção e números, sem dado pessoal).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import fx from '../__fixtures__/complementos-07-08-09.json'
import { linhasDeComplementoDaRegua, materializarComplementosDia, exigirComplementoSemApi, ComplementosDaApiError, ComplementosJaTemXlsError, CORTE_COMPLEMENTOS, nomeArquivoComplementosApi, type PedidoParaComplemento } from '../complementos'
import { confirmarComplementos } from '../../stock/vendas/import-complementos'
import { importIdDe } from '../../stock/vendas/identidade-import-complemento'
import { diaOperacional } from '../espelho'
import { somarDias } from '../regua-sombra'

type Dia = { pedidos: PedidoParaComplemento[]; xls: { nomeSuitable: string; ocorrencias: number; valorTotal: number }[] }
const FX = fx as unknown as Record<string, Dia>
const cent = (v: number) => Math.round(v * 100)

describe('⭐ a régua dos complementos reproduz o XLS de 3 dias reais — nome a nome, ao centavo', () => {
  it.each([
    ['2026-11-07', 91, 866, 208633],
    ['2026-11-08', 84, 614, 180264],
    ['2026-11-09', 65, 187, 68325],
  ])('%s: %i linhas · %i ocorrências · %i centavos', (dia, nLinhas, occ, totalCent) => {
    const { pedidos, xls } = FX[dia]
    const r = linhasDeComplementoDaRegua(pedidos)
    expect(r.linhas).toHaveLength(nLinhas)
    expect(r.ocorrencias).toBe(occ)
    expect(r.totalCent).toBe(totalCent)
    const daRegua = r.linhas.map((l) => [l.produto, l.quantidade, cent(l.valorTotal)]).sort()
    const doXls = xls.map((l) => [l.nomeSuitable, l.ocorrencias, cent(l.valorTotal)]).sort()
    expect(daRegua).toEqual(doXls)
  })

  it('⛔ o valor é unit_price × qtd do ITEM (o unit_price já vem × qtd da opção; o price conta duas vezes)', () => {
    const p: PedidoParaComplemento[] = [{ status: 'delivered', sumido: false, itens: [
      { quantidade: 1, cancelado: false, opcoes: [{ nome: 'BATATA FRITA EM CIMA DA PIZZA', quantidade: 2, unitarioCent: 1980 }] },
      { quantidade: 2, cancelado: false, opcoes: [{ nome: 'BATATA FRITA EM CIMA DA PIZZA', quantidade: 1, unitarioCent: 990 }] },
    ] }]
    expect(linhasDeComplementoDaRegua(p).linhas).toEqual([{ produto: 'BATATA FRITA EM CIMA DA PIZZA', quantidade: 4, valorTotal: 39.6 }])
  })

  it('abandoned, apagado e item cancelado ficam fora; caixa diferente = linha diferente; espaço colapsa', () => {
    const op = (nome: string) => ({ nome, quantidade: 1, unitarioCent: 199 })
    const r = linhasDeComplementoDaRegua([
      { status: 'abandoned', sumido: false, itens: [{ quantidade: 1, cancelado: false, opcoes: [op('KETCHUP')] }] },
      { status: 'delivered', sumido: true, itens: [{ quantidade: 1, cancelado: false, opcoes: [op('KETCHUP')] }] },
      { status: 'delivered', sumido: false, itens: [{ quantidade: 1, cancelado: true, opcoes: [op('KETCHUP')] }] },
      { status: 'delivered', sumido: false, itens: [{ quantidade: 1, cancelado: false, opcoes: [op('MAIONESE CASEIRA'), op('Maionese  Caseira')] }] },
    ])
    expect(r.linhas).toEqual([
      { produto: 'MAIONESE CASEIRA', quantidade: 1, valorTotal: 1.99 },
      { produto: 'Maionese Caseira', quantidade: 1, valorTotal: 1.99 },
    ])
  })
})

// ─── a esteira de verdade (banco de teste): materializa, recusa XLS, recusa dia com XLS ────────
const CNPJ = '11111511000111'
let companyId = ''
// ⛔ dia RELATIVO ao relógio (nunca data fixa no futuro): ontem operacional, ≥ corte
const D = [CORTE_COMPLEMENTOS, somarDias(diaOperacional(new Date().toISOString().slice(0, 19)), -1)].sort().at(-1)!
const FECHA = new Date(`${somarDias(D, 1)}T06:10:00Z`)
const html = (linhas: [string, number, string][]) =>
  `<html><body><table><tr><td>Descrição</td><td>Valor unitário</td><td>Quantidade</td><td>Valor total</td></tr>${linhas.map(([n, q, v]) => `<tr><td>${n}</td><td>R$ 0,00</td><td>${q}</td><td>R$ ${v}</td></tr>`).join('')}</table></body></html>`

async function espelhar(pedidos: PedidoParaComplemento[]) {
  let n = 0
  for (const p of pedidos) {
    n++
    await prisma.suitPedido.create({
      data: {
        companyId, apiId: n, dia: D, status: p.status, criadoApiEm: new Date(`${D}T12:00:00Z`), produtosCent: 0, entregaCent: 0, servicoCent: 0, descontoCent: 0, adicionalCent: 0, totalCent: 0, pago: true, impressao: '', conteudo: String(n),
        sumidoEm: p.sumido ? new Date() : null,
        itens: { create: p.itens.map((i, k) => ({ companyId, apiItemId: k + 1, nome: 'X', quantidade: i.quantidade, unitarioCent: 0, precoCent: 0, canceladoEm: i.cancelado ? new Date() : null, opcoes: { create: i.opcoes.map((o, j) => ({ ordem: j, nome: o.nome, quantidade: o.quantidade, unitarioCent: o.unitarioCent, precoCent: 0 })) } })) },
      },
    })
  }
}
async function limpar() {
  for (const { id } of await prisma.company.findMany({ where: { cnpj: CNPJ }, select: { id: true } })) {
    await prisma.suitPedido.deleteMany({ where: { companyId: id } })
    await prisma.stockVendaComplementoLinha.deleteMany({ where: { companyId: id } })
    await prisma.stockVendaComplementoNome.deleteMany({ where: { companyId: id } })
    await prisma.stockVendaArquivo.deleteMany({ where: { companyId: id } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
}
beforeEach(async () => { await limpar(); companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'SUIT COMP' } })).id })
afterEach(limpar)

describe('⭐ os complementos pela esteira de sempre (o funil único)', () => {
  it('o dia real 08/11 materializado: as linhas gravadas = as do XLS, mesmo importId e mesma data', async () => {
    await espelhar(FX['2026-11-08'].pedidos)
    const r = await materializarComplementosDia(prisma, companyId, D, FECHA)
    expect(r).toMatchObject({ status: 'MATERIALIZADO', linhas: 84, ocorrencias: 614, totalCent: 180264 })
    const g = await prisma.stockVendaComplementoLinha.findMany({ where: { companyId }, select: { importId: true, data: true, nomeSuitable: true, ocorrencias: true, valorTotal: true } })
    expect(new Set(g.map((l) => l.importId))).toEqual(new Set([importIdDe(companyId, D, 'DIA')]))
    expect(new Set(g.map((l) => l.data.toISOString()))).toEqual(new Set([`${D}T00:00:00.000Z`]))
    expect(g.map((l) => [l.nomeSuitable, l.ocorrencias, cent(l.valorTotal)]).sort()).toEqual(FX['2026-11-08'].xls.map((l) => [l.nomeSuitable, l.ocorrencias, cent(l.valorTotal)]).sort())
    const arq = await prisma.stockVendaArquivo.findFirst({ where: { companyId, relatorio: 'COMPLEMENTOS' }, select: { nomeArquivo: true, linhasArquivo: true, somaQuantidade: true } })
    expect(arq).toEqual({ nomeArquivo: nomeArquivoComplementosApi(D), linhasArquivo: 84, somaQuantidade: 614 })
    expect((await materializarComplementosDia(prisma, companyId, D, FECHA)).status).toBe('JA_FEITO')
  }, 120_000)

  it('⛔ ANTI-DUPLICATA: XLS de complementos em dia da Suit → recusa sem confirmação (nada muda); confirmando → troca', async () => {
    await espelhar(FX['2026-11-09'].pedidos)
    await materializarComplementosDia(prisma, companyId, D, FECHA)
    const arquivo = html([['CALABRESA', 3, '0,00']])
    await expect(exigirComplementoSemApi(companyId, D, false, prisma)).rejects.toThrow(ComplementosDaApiError)
    await expect(confirmarComplementos(companyId, D, arquivo, 'u1', prisma, 'DIA', 'x.xls')).rejects.toThrow(ComplementosDaApiError)
    expect(await prisma.stockVendaComplementoLinha.count({ where: { companyId } })).toBe(65)
    await confirmarComplementos(companyId, D, arquivo, 'u1', prisma, 'DIA', 'x.xls', true)
    expect(await prisma.stockVendaComplementoLinha.count({ where: { companyId } })).toBe(1)
  }, 120_000)

  it('⛔ dia que JÁ TEM XLS de complementos: a Suit não passa por cima (o passado não se mexe)', async () => {
    await confirmarComplementos(companyId, D, html([['CALABRESA', 3, '0,00']]), 'u1', prisma, 'DIA', 'dono.xls')
    await espelhar(FX['2026-11-09'].pedidos)
    await expect(materializarComplementosDia(prisma, companyId, D, FECHA)).rejects.toThrow(ComplementosJaTemXlsError)
    expect(await prisma.stockVendaComplementoLinha.count({ where: { companyId } })).toBe(1)
  }, 120_000)
})
