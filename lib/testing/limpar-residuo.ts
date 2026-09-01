// ⭐⭐ A SUÍTE NÃO PODE DEIXAR LIXO NO BANCO DE DEV (01/09/2026).
//
// ⛔ O ESTADO QUE MOTIVOU: **663 empresas** acumuladas no `dev.db`, todas de teste — 317 de
// "Empresa multi1", 317 de "Empresa ofx", e dezenas de `socios-agg-…`, `bridge-create-…`.
// Nenhum dado real. Cada rodada de suíte deixava mais.
//
// ⚠️ POR QUE ISSO IMPORTA ALÉM DA ARRUMAÇÃO: banco sujo é ambiente que muda sozinho entre
// rodadas, e ambiente que muda sozinho produz vermelho que ninguém sabe explicar. Foi
// exatamente o que aconteceu com os 5 do `real-vs-teorico`: **eu olhei os vermelhos e
// concluí "poluição do dev.db" DUAS vezes** — e a causa era outra (uma janela de data
// fixa que virou o mês). A sujeira não causou aquele bug, mas serviu de explicação
// confortável pra eu não medir. **Alarme falso repetido mata o alarme; ruído de fundo
// mata o diagnóstico.**
//
// ⚠️ ESCOPO: remove só o que NASCEU durante a rodada. O que já existia antes fica —
// apagar por heurística ("parece de teste") é como um script de limpeza vira incidente.

import { PrismaClient } from '@prisma/client'

/** tabelas do estoque: `companyId` é VALOR, sem FK — apagar a empresa deixaria órfão */
const TABELAS_POR_COMPANY = [
  'stockContagemVersao', 'stockContagemRevisao', 'stockContagemOrdem',
  'stockContagemItem', 'stockContagem', 'stockSaida', 'stockEtiqueta',
  'stockImpressaoJob', 'stockImpressora', 'stockEtiquetaModelo',
  'stockVendaLinha', 'stockVendaImport', 'stockVendaProdutoMap',
  'stockProducaoConclusao', 'stockProductionOrder',
  'stockFichaComponente', 'stockFichaVersao', 'stockFicha',
  'stockEntradaManualItem', 'stockEntradaManual',
  'stockPayableLink', 'stockPayableSuggestion', 'stockParcelaCombinada',
  'stockConferenceItem', 'stockReceiptConference',
  'stockItemMesclado', 'stockSupplierProdutoNome', 'stockSupplierProduct',
  'stockNfeItem', 'stockNfeDup', 'stockNfeEmit', 'stockNfe',
  'stockMovement', 'stockSaldoCache', 'stockItem', 'stockSupplier',
] as const

/** fotografia das empresas ANTES da rodada — o que existir além disso é resíduo dela */
export async function fotografarEmpresas(db: PrismaClient): Promise<Set<string>> {
  const cs = await db.company.findMany({ select: { id: true } })
  return new Set(cs.map((c) => c.id))
}

export interface ResultadoLimpeza {
  empresasRemovidas: number
  linhasRemovidas: number
}

/**
 * Remove as empresas criadas DEPOIS da fotografia, com as linhas de estoque delas.
 *
 * ⚠️ Falha macia por tabela: se um model não existir (schema mais antigo) ou um delete der
 * erro, segue pro próximo. Limpeza não pode derrubar a suíte — o resultado dos TESTES é
 * que importa, e um erro aqui viraria vermelho sem relação com o código.
 */
export async function limparResiduo(db: PrismaClient, antes: Set<string>): Promise<ResultadoLimpeza> {
  const agora = await db.company.findMany({ select: { id: true } })
  const novas = agora.map((c) => c.id).filter((id) => !antes.has(id))
  if (novas.length === 0) return { empresasRemovidas: 0, linhasRemovidas: 0 }

  let linhas = 0
  for (const tabela of TABELAS_POR_COMPANY) {
    try {
      // @ts-expect-error acesso dinâmico ao delegate
      const r = await db[tabela].deleteMany({ where: { companyId: { in: novas } } })
      linhas += r.count
    } catch { /* tabela ausente ou delete recusado — segue */ }
  }
  try {
    const r = await db.company.deleteMany({ where: { id: { in: novas } } })
    return { empresasRemovidas: r.count, linhasRemovidas: linhas }
  } catch {
    return { empresasRemovidas: 0, linhasRemovidas: linhas }
  }
}
