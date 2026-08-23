// ESTOQUE — E10 (bug da Focatto, 23/08). REGRA 1: o teste falha ANTES do fix e passa
// DEPOIS. O cenário é o real: nota na fila, só-resumo, ZERO eventos, parada há 2 dias.
// O E15 não via porque olha `stock_sefaz_event` — e não havia linha nenhuma lá.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { checkNfeInvariants, E10_HORAS } from '../nfe-invariants'
import { checkStockInvariants, type StockInvariantFail } from '../stock-invariants'

const CNPJ = '50607080000155'
const CHAVE_FOCATTO = '43260804902760000145550010012406791107915950'
const CHAVE_OK = '43260804902760000145550010012406791107915951'
const CHAVE_NOVA = '43260804902760000145550010012406791107915952'
let companyId: string

const doisDiasAtras = new Date(Date.now() - 2 * 86_400_000)

const soDesta = (fs: StockInvariantFail[], inv: string) => fs.filter((f) => f.companyId === companyId && f.invariante === inv)

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA E10' } })).id

  // 1) o caso REAL: só-resumo, sem nenhum evento, há 2 dias
  await prisma.stockNfe.create({ data: { companyId, chave: CHAVE_FOCATTO, nsu: '1', status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: false, emitNome: 'FOCATTO DISTRIBUIDORA DE ALIMENTOS LTDA', vNF: 2459.76, criadoEm: doisDiasAtras } })
  // 2) nota com XML completo — não pode virar alerta
  await prisma.stockNfe.create({ data: { companyId, chave: CHAVE_OK, nsu: '2', status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: true, emitNome: 'FORNECEDOR OK', vNF: 100, criadoEm: doisDiasAtras } })
  // 3) nota só-resumo RECÉM chegada — dentro da janela, ainda não é problema
  await prisma.stockNfe.create({ data: { companyId, chave: CHAVE_NOVA, nsu: '3', status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: false, emitNome: 'CHEGOU AGORA', vNF: 50, criadoEm: new Date() } })
})

afterAll(async () => {
  await prisma.stockSefazEvent.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('E10 — nota presa na fila sem os itens', () => {
  it('PEGA a nota só-resumo parada há 2 dias e diz que NENHUMA manifestação foi enviada', async () => {
    const e10 = soDesta(await checkNfeInvariants(prisma), 'E10')
    expect(e10).toHaveLength(1)
    expect(e10[0].detalhe).toContain('FOCATTO')
    expect(e10[0].detalhe).toContain('2 dia')
    // o alerta precisa dizer O QUE FAZER, não só que está errado
    expect(e10[0].detalhe).toContain('NENHUMA manifestação')
    expect(e10[0].detalhe).toContain('Ciência')
  })

  it('NÃO alerta nota que já tem XML completo', async () => {
    const e10 = soDesta(await checkNfeInvariants(prisma), 'E10')
    expect(e10.some((f) => f.detalhe.includes('FORNECEDOR OK'))).toBe(false)
  })

  it(`NÃO alerta nota que chegou agora (janela de ${E10_HORAS}h)`, async () => {
    const e10 = soDesta(await checkNfeInvariants(prisma), 'E10')
    expect(e10.some((f) => f.detalhe.includes('CHEGOU AGORA'))).toBe(false)
  })

  it('muda o PORQUÊ quando a Ciência falhou (alerta acionável, não genérico)', async () => {
    await prisma.stockSefazEvent.create({ data: { companyId, chave: CHAVE_FOCATTO, tpEvento: '210210', nSeqEvento: 1, status: 'ERRO', cStat: '594', xMotivo: 'Numero sequencial do evento maior que o permitido', tentativas: 1 } })

    const e10 = soDesta(await checkNfeInvariants(prisma), 'E10')
    expect(e10).toHaveLength(1)
    expect(e10[0].detalhe).toContain('594')
    expect(e10[0].detalhe).toContain('a Ciência falhou')
  })

  it('quando a Ciência foi ACEITA mas o XML não veio, aponta pro download/parse', async () => {
    await prisma.stockSefazEvent.create({ data: { companyId, chave: CHAVE_FOCATTO, tpEvento: '210210', nSeqEvento: 2, status: 'ENVIADO', cStat: '135', xMotivo: 'Evento registrado e vinculado a NF-e', tentativas: 1 } })

    const e10 = soDesta(await checkNfeInvariants(prisma), 'E10')
    expect(e10).toHaveLength(1)
    expect(e10[0].detalhe).toContain('não chegou')
    expect(e10[0].detalhe).toContain('download/parse')
  })

  it('some quando a nota finalmente ganha o XML completo', async () => {
    await prisma.stockNfe.updateMany({ where: { companyId, chave: CHAVE_FOCATTO }, data: { temXmlCompleto: true } })
    expect(soDesta(await checkNfeInvariants(prisma), 'E10')).toHaveLength(0)
    await prisma.stockNfe.updateMany({ where: { companyId, chave: CHAVE_FOCATTO }, data: { temXmlCompleto: false } })
  })

  it('está LIGADO no juiz de verdade (checkStockInvariants), não só na função solta', async () => {
    // o E10 existir num arquivo não adianta — o buraco era justamente ninguém chamar
    const e10 = soDesta(await checkStockInvariants(prisma), 'E10')
    expect(e10.length).toBeGreaterThan(0)
  })
})
