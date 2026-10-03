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
  /** ⭐ linhas de estoque cujo `companyId` não existe mais em `Company` (ver abaixo) */
  orfasRemovidas: number
}

/**
 * ⛔⛔⛔ A VARREDURA DE ÓRFÃS — o buraco que a rede de baixo tinha (02/10/2026).
 *
 * **O estado medido:** `28.392 linhas` de `stock_*` no `dev.db` sem empresa nenhuma — 8.112
 * linhas de venda, 3.224 itens, 1.441 fichas, 32 ordens de produção. Acumuladas por **meses**.
 *
 * ⚠️⚠️ **E A CAUSA É IRÔNICA: quem escapa da rede é o teste DISCIPLINADO.** A limpeza por
 * empresa apaga `WHERE companyId IN (as empresas novas que SOBRARAM)` — então o teste que faz
 * a coisa certa e apaga a própria `Company` no `afterEach` **tira a empresa da lista** e deixa
 * as linhas de estoque órfãs pra sempre. Quanto mais limpo o teste, mais lixo ele deixa.
 *
 * ⛔ E o lixo não é inerte: `checkProducaoInvariants` e os outros juízes varrem o **banco
 * INTEIRO** (não filtram empresa), então 32 ordens órfãs em estado `PLANEJADA` fazem o golden
 * da produção ficar vermelho — foi exatamente o que aconteceu em 02/10, e eu levei três
 * medições pra achar que o vermelho era sujeira minha, não código.
 *
 * ⭐ Por que varrer órfãs é SEGURO: `companyId` nas tabelas `stock_*` é **VALOR sem FK** (o
 * isolamento do módulo proíbe `@relation`), então não existe cascade — mas também não existe
 * dado REAL com `companyId` que não aponte pra uma empresa viva. Órfã é, por definição, lixo.
 *
 * ⚠️ E isso vira IMPOSSIBILIDADE em vez de disciplina (REGRA 5): exigir que cada um dos ~100
 * arquivos de teste de estoque liste as 36 tabelas é um combinado que o próximo arquivo
 * esquece. A rede de baixo passa a pegar sozinha.
 */
async function varrerOrfas(db: PrismaClient): Promise<number> {
  const vivas = new Set((await db.company.findMany({ select: { id: true } })).map((c) => c.id))
  let n = 0
  for (const tabela of TABELAS_POR_COMPANY) {
    try {
      // @ts-expect-error acesso dinâmico ao delegate
      const rows: { id: string; companyId: string }[] = await db[tabela].findMany({
        select: { id: true, companyId: true },
      })
      const orfas = rows.filter((r) => !vivas.has(r.companyId)).map((r) => r.id)
      if (!orfas.length) continue
      // ⚠️ em lotes: `IN` com milhares de ids estoura o limite de parâmetros do SQLite
      for (let i = 0; i < orfas.length; i += 500) {
        // @ts-expect-error acesso dinâmico ao delegate
        const r = await db[tabela].deleteMany({ where: { id: { in: orfas.slice(i, i + 500) } } })
        n += r.count
      }
    } catch { /* tabela ausente, sem `id`, ou delete recusado — segue */ }
  }
  return n
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

  let linhas = 0
  if (novas.length) {
    for (const tabela of TABELAS_POR_COMPANY) {
      try {
        // @ts-expect-error acesso dinâmico ao delegate
        const r = await db[tabela].deleteMany({ where: { companyId: { in: novas } } })
        linhas += r.count
      } catch { /* tabela ausente ou delete recusado — segue */ }
    }
  }

  let empresas = 0
  if (novas.length) {
    try {
      const r = await db.company.deleteMany({ where: { id: { in: novas } } })
      empresas = r.count
    } catch { /* falha macia */ }
  }

  /**
   * ⭐ DEPOIS de apagar as empresas da rodada: varre o que ficou sem dono — incluindo o que
   * os `afterEach` disciplinados deixaram atrás (ver `varrerOrfas`). ⚠️ Roda SEMPRE, mesmo
   * quando nenhuma empresa nova sobrou, que é justamente o caso em que o lixo se acumula.
   */
  const orfas = await varrerOrfas(db).catch(() => 0)

  return { empresasRemovidas: empresas, linhasRemovidas: linhas, orfasRemovidas: orfas }
}
