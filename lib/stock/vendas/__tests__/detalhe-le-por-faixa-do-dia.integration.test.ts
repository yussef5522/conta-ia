/**
 * ⛔⛔⛔ O DETALHE LÊ POR **FAIXA DO DIA** — os dois writers gravam em horas diferentes (08/10/2026).
 *
 * ⚠️⚠️ **ESTE TESTE NASCEU DE UM VERMELHO EM PROD, não de uma ideia.** A prova em prod mostrou o
 * detalhe de 07/10 dizendo **`sabores: 0 nomes · 0 ocorrências`** num dia que a central mostra
 * com *"2 arquivos · razão 5,4 sabores/pizza"* — ou seja, as ocorrências ESTAVAM gravadas e a
 * leitura não as achava.
 *
 * **A causa é a cicatriz de 14/09 renascida:**
 *   · `stock_venda_complemento_linha` grava o dia às **00:00:00.000Z** (`diaUtc`);
 *   · `stock_venda_linha` grava às **12:00:00** (e sem o `Z` isso depende do fuso do processo).
 *
 * ⛔ Comparar o instante EXATO **acerta um writer e erra o outro, em silêncio** — e o silêncio é
 * o que faz isso sobreviver: a aba Produtos vinha cheia e a aba Sabores vazia, que é um estado
 * plausível ("o relatório de sabores não entrou") sobre um dia em que ele entrou.
 *
 * ⭐ REGRA 1: com a leitura exata de volta, o caso abaixo fica VERMELHO.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { lerDetalheDoDia } from '../detalhe-do-dia'

const CNPJ = '81828384000265'
let companyId = ''
const DIA = '2025-10-07'

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'DETALHE POR FAIXA' } })
  companyId = c.id
})

afterEach(async () => {
  await prisma.stockVendaLinha.deleteMany({ where: { companyId } })
  await prisma.stockVendaComplementoLinha.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⛔⛔ as DUAS convenções de hora do módulo, no mesmo dia', () => {
  it('⭐⭐ o detalhe acha produto (12h) E sabor (00h) do mesmo dia', async () => {
    /** ⚠️ EXATAMENTE como os writers reais gravam — fixture que "arredonda" a hora esconderia o bug */
    await prisma.stockVendaLinha.create({
      data: {
        companyId, importId: 'p1', data: new Date(`${DIA}T12:00:00.000Z`),
        nomeSuitable: 'PIZZA GRANDE 35CM', quantidade: 38, valorTotal: 2157.35,
        mapeadoNoImport: true,
      },
    })
    await prisma.stockVendaComplementoLinha.create({
      data: {
        companyId, importId: 'c1', data: new Date(`${DIA}T00:00:00.000Z`),
        nomeSuitable: 'CALABRESA', ocorrencias: 76, valorTotal: 0, mapeadoNoImport: true,
      },
    })

    const d = await lerDetalheDoDia(companyId, DIA, prisma)
    expect(d.produtos.length, 'os produtos (12h) sumiram').toBe(1)
    expect(d.totais.unidades).toBe(38)
    /** ⛔ ERA AQUI QUE DAVA ZERO EM PROD */
    expect(d.sabores.length, 'os sabores (00h) sumiram — leitura por instante exato').toBe(1)
    expect(d.totais.ocorrencias).toBe(76)
  })

  it('⛔ a faixa é do DIA: 23h59 entra, 00h do dia seguinte NÃO', async () => {
    await prisma.stockVendaComplementoLinha.createMany({
      data: [
        {
          companyId, importId: 'c1', data: new Date(`${DIA}T23:59:59.999Z`),
          nomeSuitable: 'NO LIMITE', ocorrencias: 1, valorTotal: 0, mapeadoNoImport: true,
        },
        {
          companyId, importId: 'c2', data: new Date('2025-10-08T00:00:00.000Z'),
          nomeSuitable: 'DO DIA SEGUINTE', ocorrencias: 99, valorTotal: 0, mapeadoNoImport: true,
        },
      ],
    })
    const d = await lerDetalheDoDia(companyId, DIA, prisma)
    expect(d.sabores.map((s) => s.nome)).toEqual(['NO LIMITE'])
    expect(d.totais.ocorrencias, 'o dia seguinte vazou pra dentro do dia').toBe(1)
  })

  it('⛔ dia sem nada é VAZIO honesto (e o guard da tela fecha)', async () => {
    const d = await lerDetalheDoDia(companyId, DIA, prisma)
    expect(d.produtos).toEqual([])
    expect(d.sabores).toEqual([])
    expect(d.totais.bateComODia, 'o guard Σ(linhas)==Σ do dia tem que fechar no vazio').toBe(true)
  })
})
