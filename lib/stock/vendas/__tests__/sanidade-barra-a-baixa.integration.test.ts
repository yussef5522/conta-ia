// ⛔⛔⛔ O GUARD ESTAVA NA PORTA ERRADA (11/09/2026)
//
// A sanidade nasceu ligada no `previewImportSuitable` — a tela de MAPEAMENTO. Mas quem
// **baixa o estoque** é o `processarVendas`, e a prova em prod mostrou o payload do plano
// **sem bloco de sanidade nenhum**: o import de 10/09 repetido hoje passaria calado outra
// vez, com o guard "pronto" no arquivo ao lado.
//
// ⭐ Este teste roda o CAMINHO QUE ESCREVE, com o cenário real: 14 dias de FANTA UVA a ~4
// por dia e um arquivo dizendo 1.499.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { montarPlanoVenda, processarVendas } from '../baixa-venda'
import { upsertVendaMap } from '../venda-map'
import { SanidadeNaoConfirmadaError } from '../medir-sanidade'
import { saldoItem } from '../../saldo'

const CNPJ = '13131313000199'
let companyId = ''
let fantaId = ''

const html = (linhas: [string, number][]) =>
  `<html><body><table><tr><td>Produto</td><td>Quantidade</td><td>Valor Extra</td><td>Valor total</td></tr>${linhas.map(([p, q]) => `<tr><td>${p}</td><td>${q}</td><td>R$ 0,00</td><td>R$ 0,00</td></tr>`).join('')}</table></body></html>`

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'SANIDADE' } })
  companyId = c.id
  const it = await prisma.stockItem.create({ data: { companyId, nome: 'FANTA UVA 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'CONFERENCIA' } })
  fantaId = it.id
  await prisma.stockMovement.create({ data: { companyId, itemId: fantaId, tipo: 'ENTRADA_NF', quantidade: 200, custoUnitario: 6.81, custoTotal: 1362, origem: 'SEFAZ' } })
  await upsertVendaMap(companyId, 'FANTA UVA 2L', { tipo: 'REVENDA', itemId: fantaId }, 'u', prisma)

  // ⭐ o histórico REAL da geladeira: ~4 por dia, 6 dias seguidos
  for (let d = 1; d <= 6; d++) {
    const data = new Date(Date.now() - d * 86_400_000)
    const imp = await prisma.stockVendaImport.create({ data: { companyId, data, totalLinhas: 1, totalUnidades: 4, status: 'CONFIRMADO' } })
    await prisma.stockVendaLinha.create({ data: { companyId, importId: imp.id, data, nomeSuitable: 'FANTA UVA 2L', quantidade: 4, valorTotal: 60 } })
  }
})

afterEach(async () => { await prisma.company.deleteMany({ where: { cnpj: CNPJ } }) })

describe('⛔⛔ a sanidade mora no caminho que BAIXA', () => {
  it('⭐ o PLANO carrega a pergunta (era isso que faltava no payload de prod)', async () => {
    const p = await montarPlanoVenda(companyId, '2026-09-10', html([['FANTA UVA 2L', 1499]]), prisma)
    expect(p.sanidade).toBeDefined()
    expect(p.sanidade.precisaConfirmar).toBe(true)
    expect(p.sanidade.suspeitas[0]?.frase).toContain('1.499')
    expect(p.sanidade.suspeitas[0]?.frase).toContain('o normal é 4')
  })

  it('⛔⛔ e a BAIXA é RECUSADA — o estoque não se mexe', async () => {
    await expect(processarVendas(companyId, '2026-09-10', html([['FANTA UVA 2L', 1499]]), 'u', prisma))
      .rejects.toBeInstanceOf(SanidadeNaoConfirmadaError)
    const s = await saldoItem(prisma, companyId, fantaId)
    expect(s.saldo).toBe(200)                       // ⭐ nada baixou
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'BAIXA_VENDA' } })).toBe(0)
  })

  it('⭐ o dono confirma e passa — pergunta, nunca recusa cega', async () => {
    const r = await processarVendas(companyId, '2026-09-10', html([['FANTA UVA 2L', 1499]]), 'u', prisma, null, true)
    expect(r.itensBaixados).toBe(1)
    expect((await saldoItem(prisma, companyId, fantaId)).saldo).toBe(-1299)
  })

  it('⭐ e o dia NORMAL passa sem perguntar nada', async () => {
    const p = await montarPlanoVenda(companyId, '2026-09-10', html([['FANTA UVA 2L', 5]]), prisma)
    expect(p.sanidade.precisaConfirmar).toBe(false)
    const r = await processarVendas(companyId, '2026-09-10', html([['FANTA UVA 2L', 5]]), 'u', prisma)
    expect(r.itensBaixados).toBe(1)
    expect((await saldoItem(prisma, companyId, fantaId)).saldo).toBe(195)
  })
})
