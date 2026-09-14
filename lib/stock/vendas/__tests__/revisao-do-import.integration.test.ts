// ⭐⭐⭐ A REVISÃO DO IMPORT — o padrão do extrato de banco (14/09/2026).
//
// **O dono:** *"o que chegou · com quem está vinculado · ajusto ali mesmo"*.
//
// O fixture é o dia REAL de 13/09, com os nomes que ele trouxe: `COCA COLA 2L` vinculada,
// `COCA COLA LATA` sem vínculo (mas com a `COCA LATA` existindo), `FRUKI LATA` sem
// vínculo e SEM candidata segura, e o combo.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { montarRevisao, previewDoAjuste, sugerirDestino } from '../revisao-do-import'

const CNPJ = '50607080000818'
let companyId = ''
let fCoca = ''

async function item(nome: string, cat = 'REVENDA') {
  return (await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria: cat, criadoVia: 'MANUAL' } })).id
}
async function ficha(nomeProduzido: string, comps: { itemId: string; qtd: number }[]) {
  const prod = await item(nomeProduzido, 'PRODUTO_FINAL')
  const f = await prisma.stockFicha.create({ data: { companyId, itemProduzidoId: prod, tipoProduto: 'PRODUTO_FINAL', versaoAtual: 1, ativo: true } })
  const v = await prisma.stockFichaVersao.create({ data: { companyId, fichaId: f.id, versao: 1, loteBase: 1, unidadeLoteBase: 'UN' } })
  for (const c of comps) await prisma.stockFichaComponente.create({ data: { companyId, versaoId: v.id, itemId: c.itemId, qtdPlanejada: c.qtd, unidade: 'UN' } })
  return f.id
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA REVISAO' } })).id

  const garrafa = await item('COCA-COLA 2L')
  const lata = await item('COCA LATA 350ML')
  fCoca = await ficha('COCA COLA 2L', [{ itemId: garrafa, qtd: 1 }])
  const fLata = await ficha('COCA LATA', [{ itemId: lata, qtd: 1 }])

  // o mapa de HOJE: só a 2L e a LATA estão mapeadas
  await prisma.stockVendaComplementoMap.create({ data: { companyId, nomeSuitable: 'COCA COLA 2L', alvoTipo: 'FICHA', fichaId: fCoca } })
  await prisma.stockVendaComplementoMap.create({ data: { companyId, nomeSuitable: 'COCA LATA', alvoTipo: 'FICHA', fichaId: fLata } })
  await prisma.stockVendaComplementoMap.create({ data: { companyId, nomeSuitable: 'não desejo refrigerante', alvoTipo: 'IGNORAR' } })

  // as linhas do import de 13/09
  const d = new Date('2026-09-13T12:00:00')
  await prisma.stockVendaComplementoLinha.createMany({
    data: [
      { companyId, importId: 'imp-13', data: d, nomeSuitable: 'COCA COLA 2L', ocorrencias: 15, mapeadoNoImport: true },
      { companyId, importId: 'imp-13', data: d, nomeSuitable: 'COCA COLA LATA', ocorrencias: 5, mapeadoNoImport: false },
      { companyId, importId: 'imp-13', data: d, nomeSuitable: 'FRUKI LATA', ocorrencias: 1, mapeadoNoImport: false },
      { companyId, importId: 'imp-13', data: d, nomeSuitable: 'COCA LATA MAIS MINI FRITAS', ocorrencias: 19, mapeadoNoImport: false },
      { companyId, importId: 'imp-13', data: d, nomeSuitable: 'não desejo refrigerante', ocorrencias: 2, mapeadoNoImport: false },
    ],
  })
})

afterEach(async () => {
  for (const t of ['stockVendaComplementoLinha', 'stockVendaComplementoMap', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const rev = () => montarRevisao(companyId, '2026-09-13', 'COMPLEMENTOS', prisma)

describe('⭐⭐ o extrato do que chegou', () => {
  it('⭐⭐ toda linha tem ESTADO — vinculado, sem vínculo ou ignorado', async () => {
    const r = await rev()
    const por = Object.fromEntries(r.linhas.map((l) => [l.nome, l.estado]))
    expect(por['COCA COLA 2L']).toBe('VINCULADO')
    expect(por['COCA COLA LATA']).toBe('SEM_VINCULO')
    expect(por['não desejo refrigerante']).toBe('IGNORADO')
  })

  it('⭐⭐ a vinculada mostra O QUE DESCONTA — "vinculado" sem isso é afirmação cega', async () => {
    const l = (await rev()).linhas.find((x) => x.nome === 'COCA COLA 2L')!
    expect(l.destinoNome).toBe('COCA COLA 2L')
    expect(l.baixa).toEqual([{ itemNome: 'COCA-COLA 2L', qtd: 1 }])
  })

  it('⭐⭐⭐ a SEM VÍNCULO ganha a sugestão do canônico quase-igual — marcada como sugestão', async () => {
    const l = (await rev()).linhas.find((x) => x.nome === 'COCA COLA LATA')!
    expect(l.sugestao, 'a COCA COLA LATA não sugeriu a COCA LATA').not.toBeNull()
    expect(l.sugestao!.rotulo).toBe('COCA LATA')
    // ⚠️ sugestão SEM o porquê visível não existe nesta casa
    expect(l.sugestao!.porQue).toContain('COCA LATA')
  })

  it('⛔⛔ e a ambígua NÃO sugere — "FRUKI LATA" com duas candidatas é "não sei qual"', async () => {
    // ⚠️ é o contrafactual que segura a régua: apontar a ZERO baixaria a bebida errada
    const zero = await item('FRUKI LATA ZERO 350ML')
    const f1 = await ficha('FRUKI LATA ZERO', [{ itemId: zero, qtd: 1 }])
    const f2 = await ficha('FRUKI LATA GRANDE', [{ itemId: zero, qtd: 1 }])
    for (const [n, f] of [['FRUKI LATA ZERO', f1], ['FRUKI LATA GRANDE', f2]] as const) {
      await prisma.stockVendaComplementoMap.create({ data: { companyId, nomeSuitable: n, alvoTipo: 'FICHA', fichaId: f } })
    }
    const l = (await rev()).linhas.find((x) => x.nome === 'FRUKI LATA')!
    expect(l.sugestao, 'sugeriu com DUAS candidatas — isso escolhe a bebida por ele').toBeNull()
  })

  it('⭐ o ignorado mostra o rastro (desde quando), em vez de sumir', async () => {
    const l = (await rev()).linhas.find((x) => x.nome === 'não desejo refrigerante')!
    expect(l.ignoradoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('⛔⛔ os 3 contadores saem da MESMA lista — card e lista não podem divergir', async () => {
    const r = await rev()
    expect(r.contadores).toEqual({ vinculados: 1, semVinculo: 3, ignorados: 1 })
    // ⭐ e em OCORRÊNCIAS, que é o que diz quanto do DIA está resolvido
    expect(r.ocorrencias).toEqual({ vinculadas: 15, semVinculo: 25, ignoradas: 2 })
    expect(r.linhas).toHaveLength(5)
  })

  it('⭐ o trabalho vem primeiro: sem vínculo no topo, e o que mais vendeu antes', async () => {
    const r = await rev()
    expect(r.linhas[0].nome).toBe('COCA LATA MAIS MINI FRITAS') // 19 ocorr., sem vínculo
    expect(r.linhas.at(-1)!.estado).toBe('IGNORADO')
  })
})

describe('⭐⭐ o preview do ajuste — só o que MUDA', () => {
  it('⭐⭐⭐ apelidei a COCA COLA LATA → o preview mostra SÓ ela, com a conta', async () => {
    await prisma.stockVendaComplementoMap.create({
      data: { companyId, nomeSuitable: 'COCA COLA LATA', alvoTipo: 'FICHA', fichaId: (await prisma.stockVendaComplementoMap.findFirstOrThrow({ where: { companyId, nomeSuitable: 'COCA LATA' } })).fichaId },
    })
    const p = await previewDoAjuste(companyId, '2026-09-13', 'COMPLEMENTOS', prisma)
    expect(p.mudam).toHaveLength(1)
    expect(p.mudam[0].frase).toBe('COCA COLA LATA: 5 ocorr. → baixa 5 × COCA LATA 350ML')
    // ⚠️ e diz quantos NÃO mudam — sem isso o dono não sabe se o preview está completo
    expect(p.inalterados).toBe(4)
  })

  it('⛔ tirar o vínculo TAMBÉM é mudança, e a frase diz que o estoque volta', async () => {
    await prisma.stockVendaComplementoMap.deleteMany({ where: { companyId, nomeSuitable: 'COCA COLA 2L' } })
    const p = await previewDoAjuste(companyId, '2026-09-13', 'COMPLEMENTOS', prisma)
    expect(p.mudam.map((m) => m.nome)).toEqual(['COCA COLA 2L'])
    expect(p.mudam[0].frase).toContain('o estoque volta')
  })

  it('⭐ sem ajuste nenhum, o preview vem VAZIO — nada a confirmar', async () => {
    const p = await previewDoAjuste(companyId, '2026-09-13', 'COMPLEMENTOS', prisma)
    expect(p.mudam).toEqual([])
  })
})

describe('⛔ a régua da sugestão, pura', () => {
  const cands = [{ fichaId: 'f1', rotulo: 'COCA LATA' }, { fichaId: 'f2', rotulo: 'FANTA UVA' }]

  it('⭐ sugere quando o nome CONTÉM o candidato, em palavras inteiras e na ordem', () => {
    expect(sugerirDestino('COCA COLA LATA', cands)?.rotulo).toBe('COCA LATA')
  })

  it('⛔⛔ NÃO sugere por letras parecidas — "FANTA LARANJA" não é "FANTA UVA"', () => {
    expect(sugerirDestino('FANTA LARANJA LATA', cands)).toBeNull()
  })

  it('⛔ nome IGUAL não vira sugestão — ali quem age é a régua do automático (08/09)', () => {
    expect(sugerirDestino('COCA LATA', cands)).toBeNull()
  })
})

// ⭐⭐⭐ O GUARD QUE O DONO PEDIU: *"nome sem destino NUNCA some do contador"*.
//
// ⛔ É a doença que este módulo mais paga: o nome que ninguém conta é a dívida invisível —
// foram 21 notas sem vencimento (F5), 13 nomes de complemento sem herança, e a fila de
// mapeamento que sumia quando o contador zerava.
describe('⛔⛔ nada some calado da revisão', () => {
  it('⭐⭐ TODA linha do import cai num dos três estados — a soma fecha com o total', async () => {
    const r = await rev()
    const soma = r.contadores.vinculados + r.contadores.semVinculo + r.contadores.ignorados
    expect(soma, 'algum nome do import não caiu em estado nenhum').toBe(r.linhas.length)
    // ⭐ e em OCORRÊNCIAS também: é o que diz quanto do DIA está resolvido
    const ocs = r.ocorrencias.vinculadas + r.ocorrencias.semVinculo + r.ocorrencias.ignoradas
    expect(ocs).toBe(r.linhas.reduce((s, l) => s + l.ocorrencias, 0))
  })

  it('⛔⛔ e o nome NOVO de um import futuro nasce SEM VÍNCULO — nunca baixa calado', async () => {
    await prisma.stockVendaComplementoLinha.create({
      data: { companyId, importId: 'imp-13', data: new Date('2026-09-13T12:00:00'), nomeSuitable: 'BEBIDA QUE NINGUEM VIU', ocorrencias: 3, mapeadoNoImport: false },
    })
    const r = await rev()
    const nova = r.linhas.find((l) => l.nome === 'BEBIDA QUE NINGUEM VIU')!
    expect(nova.estado).toBe('SEM_VINCULO')
    expect(nova.baixa, 'um nome sem destino não pode ter baixa').toEqual([])
    expect(r.contadores.semVinculo).toBe(4)
  })

  it('⭐ e o IGNORADO continua na lista — decisão tomada não vira ausência', async () => {
    // ⚠️ some-lo faria o dono reabrir a mesma decisão a cada import (a lição da
    // prateleira: "ignorar é uma resposta, não uma ausência")
    const r = await rev()
    expect(r.linhas.some((l) => l.estado === 'IGNORADO')).toBe(true)
  })
})
