// REGRA 1 — o PÃO estava no estoque em PACOTE e a receita usa PÃO (27/08).
//
// O caso real: "PAO TRADICIONAL GERGELIM CT PC/12 UN (900G) CX/16 PC" entrou controlado em
// PACOTE (64 PC a R$ 27,75). Pôr `1` na ficha do xis baixaria um PACOTE INTEIRO por lanche —
// **12× a mais** — e o Real vs Teórico apontaria um rombo que não existe.
//
// ⭐ A invariante que este teste existe pra travar: **a reunitização não move dinheiro.**
// Quantidade × fator, custo ÷ fator, VALOR IDÊNTICO AO CENTAVO.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../producao/fichas'
import { saldoItem } from '../saldo'
import { reunitizarItem, previewReunitizar, ReunitizarError } from '../reunitizar-item'

const CNPJ = '34343434000134'
let companyId: string
let paoId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'REUNIT' } })).id
  // os números REAIS da Caçula: 64 pacotes a 27,75 = 1.776,00
  const pao = await prisma.stockItem.create({
    data: { companyId, nome: 'PAO TRADICIONAL GERGELIM CT PC/12 UN (900G) CX/16 PC', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA', estoqueMin: 10, estoqueMax: 80 },
  })
  paoId = pao.id
  await prisma.stockMovement.create({ data: { companyId, itemId: paoId, tipo: 'ENTRADA_NF', quantidade: 64, custoUnitario: 27.75, custoTotal: 1776, origem: 'SEFAZ' } })
  await prisma.stockSupplierProduct.create({ data: { companyId, supplierCnpj: '04902760000145', cProd: '900', xProd: 'PAO TRADICIONAL', itemId: paoId, fatorConversao: 16, unidadeNota: 'CX' } })
})

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockSupplierProduct', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockSaldoCache', 'stockMovement', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐ o pão: de PACOTE pra PÃO', () => {
  it('⭐⭐ quantidade ×12, custo ÷12 e o VALOR não se mexe', async () => {
    const r = await reunitizarItem({ companyId, itemId: paoId, fator: 12, novoNome: 'Pão tradicional c/ gergelim (unidade)' }, prisma)

    expect(r.antes.saldo).toBe(64)
    expect(r.antes.custoMedio).toBe(27.75)
    expect(r.depois.saldo).toBe(768) // 64 pacotes × 12 pães
    // ⚠️ DUAS PRECISÕES, de propósito: o custo médio DERIVADO arredonda pro centavo (2,31 —
    // o número que o dono citou, e o que a tela mostra), enquanto o LEDGER guarda 2,3125
    // pra 768 × custo fechar 1.776,00 dentro do CHECK. Quem arredonda é a leitura.
    expect(r.depois.custoMedio).toBe(2.31)

    // ⭐ a prova: o dinheiro é o mesmo dos dois lados
    expect(r.depois.valor).toBe(r.antes.valor)
    expect(r.depois.valor).toBe(1776)
  })

  it('⭐ o custo fica em PRECISÃO CHEIA — arredondar quebraria o CHECK do ledger', async () => {
    await reunitizarItem({ companyId, itemId: paoId, fator: 12 }, prisma)
    const mov = await prisma.stockMovement.findFirst({ where: { companyId, itemId: paoId, tipo: 'ENTRADA_NF', quantidade: 768 } })
    expect(mov!.custoUnitario).toBeCloseTo(2.3125, 6) // NÃO 2,31
    // 768 × 2,31 daria 1.774,08 — fora da tolerância de ±0,01 do banco
    expect(Math.abs(768 * 2.31 - 1776)).toBeGreaterThan(0.01)
    expect(mov!.custoTotal).toBe(1776)
  })

  it('⚠️ o ledger continua IMUTÁVEL: correção = estorno + novo, o original fica', async () => {
    await reunitizarItem({ companyId, itemId: paoId, fator: 12 }, prisma)
    const movs = await prisma.stockMovement.findMany({ where: { companyId, itemId: paoId }, orderBy: { criadoEm: 'asc' } })
    expect(movs).toHaveLength(3) // original + estorno + novo
    expect(movs[0].quantidade).toBe(64) // o original NÃO foi editado nem apagado
    expect(movs[1].tipo).toBe('ESTORNO')
    expect(movs[1].estornoDeId).toBe(movs[0].id)
    expect(movs[2].quantidade).toBe(768)
    // e o saldo derivado fecha: 64 − 64 + 768
    expect((await saldoItem(prisma, companyId, paoId)).saldo).toBe(768)
  })

  it('⭐ o FATOR APRENDIDO da nota vai junto: 16 CX→PC vira 192 CX→pães', async () => {
    const r = await reunitizarItem({ companyId, itemId: paoId, fator: 12 }, prisma)
    expect(r.mapasAtualizados).toEqual([{ cProd: '900', fatorAntes: 16, fatorDepois: 192 }])
    // ⚠️ sem isto a PRÓXIMA nota entraria de novo na régua antiga e o bug voltava sozinho
    const mp = await prisma.stockSupplierProduct.findFirst({ where: { companyId, itemId: paoId } })
    expect(mp!.fatorConversao).toBe(192)
  })

  it('mín/máx convertem junto (senão viram alarme falso de estoque baixo)', async () => {
    await reunitizarItem({ companyId, itemId: paoId, fator: 12 }, prisma)
    const it = await prisma.stockItem.findUnique({ where: { id: paoId } })
    expect(it!.estoqueMin).toBe(120) // 10 pacotes = 120 pães
    expect(it!.estoqueMax).toBe(960)
  })

  it('o preview mostra o antes/depois SEM gravar', async () => {
    const p = await previewReunitizar(companyId, paoId, 12, prisma)
    expect(p.depois.saldo).toBe(768)
    expect(p.depois.valor).toBe(p.antes.valor)
    expect(p.mapas[0].fatorDepois).toBe(192)
    // nada mudou no banco
    expect((await saldoItem(prisma, companyId, paoId)).saldo).toBe(64)
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: paoId } })).toBe(1)
  })
})

describe('recusas — a conversão não pode acontecer por debaixo', () => {
  it('⛔ item JÁ usado em ficha é recusado (a receita foi escrita na régua antiga)', async () => {
    const outro = await prisma.stockItem.create({ data: { companyId, nome: 'Carne', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    await criarFicha({ companyId, nomeProduzido: 'Xis', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: paoId, qtdPlanejada: 1, unidade: 'UN' }, { itemId: outro.id, qtdPlanejada: 0.1, unidade: 'KG' }] }, prisma)
    await expect(reunitizarItem({ companyId, itemId: paoId, fator: 12 }, prisma)).rejects.toBeInstanceOf(ReunitizarError)
    // e NADA foi convertido
    expect((await saldoItem(prisma, companyId, paoId)).saldo).toBe(64)
  })

  it('fator 0, negativo ou 1 é recusado', async () => {
    for (const f of [0, -3, 1]) {
      await expect(reunitizarItem({ companyId, itemId: paoId, fator: f }, prisma)).rejects.toBeInstanceOf(ReunitizarError)
    }
  })

  it('item de outra empresa é recusado (REGRA 8)', async () => {
    await expect(reunitizarItem({ companyId: 'outra', itemId: paoId, fator: 12 }, prisma)).rejects.toBeInstanceOf(ReunitizarError)
  })

  it('rodar 2× não dobra: a 2ª conversão parte do estado novo', async () => {
    await reunitizarItem({ companyId, itemId: paoId, fator: 12 }, prisma)
    const s1 = await saldoItem(prisma, companyId, paoId)
    // uma 2ª chamada com fator 2 (hipotética) parte de 768, não de 64
    const r2 = await reunitizarItem({ companyId, itemId: paoId, fator: 2 }, prisma)
    expect(r2.antes.saldo).toBe(s1.saldo)
    expect(r2.depois.saldo).toBe(1536)
    expect(r2.depois.valor).toBe(1776) // o dinheiro segue intocado
  })
})

describe('o queijo NÃO precisa de conversão — já está na régua certa', () => {
  it('⭐ KG aceita decimal na receita: 0,080 KG × 31,90 = 2,55', async () => {
    const queijo = await prisma.stockItem.create({ data: { companyId, nome: 'QUEIJO MUSSARELA EM PECA 02 KG', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
    await prisma.stockMovement.create({ data: { companyId, itemId: queijo.id, tipo: 'ENTRADA_NF', quantidade: 201.98, custoUnitario: 31.9, custoTotal: 6443.16, origem: 'SEFAZ' } })
    const s = await saldoItem(prisma, companyId, queijo.id)
    expect(s.custoMedio).toBe(31.9)

    // a ficha aceita a fração e o custo sai certo
    const f = await criarFicha({
      companyId, nomeProduzido: 'Xis com queijo', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: queijo.id, qtdPlanejada: 0.08, unidade: 'KG' }],
    }, prisma)
    const { getFicha } = await import('../producao/fichas')
    const view = (await getFicha(companyId, f.fichaId, prisma))!.ficha
    expect(view.componentes[0].qtdPlanejada).toBe(0.08) // decimal preservado
    expect(view.componentes[0].subtotal).toBe(2.55) // 0,080 × 31,90 = 2,552 → 2,55
    expect(view.custoLote).toBe(2.55)
  })
})
