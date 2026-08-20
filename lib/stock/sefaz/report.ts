// ESTOQUE FASE 0 item 2 — relatório "o que a SEFAZ devolveu" (REGRA 2 da fase).
// Lê stock_nfe (só LÊ) e agrega: total, históricas vs novas, fornecedores, período,
// XML completo vs resumo, anomalias (canceladas, auto-emitidas = transferência).

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

export interface FornecedorLinha {
  cnpj: string
  nome: string
  nNotas: number
  valor: number
}

export interface SefazReport {
  total: number
  historicas: number
  novas: number
  fornecedoresDistintos: number
  valorTotalNovas: number
  periodo: { de: string | null; ate: string | null }
  novasComXml: number
  novasSoResumo: number
  canceladas: number
  autoEmitidas: number // emitente == a própria empresa (transferência, não compra)
  topFornecedores: FornecedorLinha[]
  dataCorte: string | null
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export async function buildSefazReport(companyId: string, db: Db = defaultPrisma): Promise<SefazReport> {
  const [company, state, notas] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { cnpj: true } }),
    db.stockSefazState.findUnique({ where: { companyId }, select: { dataCorte: true } }),
    db.stockNfe.findMany({
      where: { companyId },
      select: { emitCnpj: true, emitNome: true, vNF: true, dataEmissao: true, status: true, temXmlCompleto: true, cSitNFe: true },
    }),
  ])
  const ownCnpj = company?.cnpj?.replace(/\D/g, '') ?? null

  const novas = notas.filter((n) => n.status === 'AGUARDANDO_MERCADORIA')
  const historicas = notas.filter((n) => n.status === 'HISTORICA')
  const fornec = new Map<string, FornecedorLinha>()
  let valorTotalNovas = 0
  for (const n of novas) {
    if (n.cSitNFe !== '2' && n.vNF) valorTotalNovas += n.vNF // não soma cancelada
    const cnpj = n.emitCnpj ?? '—'
    const f = fornec.get(cnpj) ?? { cnpj, nome: n.emitNome ?? '—', nNotas: 0, valor: 0 }
    f.nNotas++
    if (n.cSitNFe !== '2' && n.vNF) f.valor += n.vNF
    fornec.set(cnpj, f)
  }

  const datas = notas.map((n) => n.dataEmissao).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())

  return {
    total: notas.length,
    historicas: historicas.length,
    novas: novas.length,
    fornecedoresDistintos: new Set(novas.map((n) => n.emitCnpj).filter(Boolean)).size,
    valorTotalNovas: round2(valorTotalNovas),
    periodo: {
      de: datas[0]?.toISOString().slice(0, 10) ?? null,
      ate: datas[datas.length - 1]?.toISOString().slice(0, 10) ?? null,
    },
    novasComXml: novas.filter((n) => n.temXmlCompleto).length,
    novasSoResumo: novas.filter((n) => !n.temXmlCompleto).length,
    canceladas: notas.filter((n) => n.cSitNFe === '2').length,
    autoEmitidas: ownCnpj ? notas.filter((n) => n.emitCnpj === ownCnpj).length : 0,
    topFornecedores: [...fornec.values()].sort((a, b) => b.valor - a.valor).slice(0, 20).map((f) => ({ ...f, valor: round2(f.valor) })),
    dataCorte: state?.dataCorte?.toISOString().slice(0, 10) ?? null,
  }
}
