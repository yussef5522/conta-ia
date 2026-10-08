/**
 * ⭐⭐ O REGISTRO DO ARQUIVO QUE ENTROU — a PORTA ÚNICA (08/10/2026).
 *
 * Guarda, por (dia, relatório): nome do arquivo, Σ DECLARADO, autor e hora. Nasceu do retrato:
 * nada disso era guardado, e os COMPLEMENTOS não tinham nem autor nem hora.
 *
 * ⚠️⚠️ E PRECISO SER HONESTO SOBRE O QUE A COMPARAÇÃO VALE. **No instante do import, Σ do
 * arquivo == Σ gravado por construção** — `gravarVenda` escreve TODAS as linhas parseadas.
 * Comparar ali seria o invariante circular de 28/08, que dá verde de graça.
 *
 * ⭐ O VALOR DELA É NO TEMPO, e a pergunta que ela responde é outra: ***"o arquivo declarado
 * pra este dia ainda explica as linhas que estão gravadas?"***. Ela FALHA quando:
 *   · um **lançamento manual** reescreve as linhas de um dia que veio de arquivo;
 *   · um re-import é interrompido no meio (a transação volta, mas o registro do arquivo não);
 *   · um import de **PERÍODO** cai sobre um dia;
 *   · alguém apaga linhas por fora.
 * ⛔ Em todos esses casos, hoje, **ninguém notaria** — o dia continuaria dizendo "completo ✓".
 *
 * ⛔ FAIL-SOFT: registrar é BÔNUS. Um erro aqui nunca pode derrubar um import de vendas
 * legítimo (o padrão do recebimento, 21/08) — o dado que importa já está gravado.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export type RelatorioDeVenda = 'PRODUTOS' | 'COMPLEMENTOS'

export interface ArquivoARegistrar {
  companyId: string
  /** `YYYY-MM-DD` */
  data: string
  relatorio: RelatorioDeVenda
  nomeArquivo: string
  /** quantas linhas o ARQUIVO trouxe (antes de mapa, filtro ou agrupamento) */
  linhasArquivo: number
  /** Σ da quantidade do ARQUIVO (unidades em produtos · ocorrências em complementos) */
  somaQuantidade: number
  /**
   * ⛔ `null` quando o relatório não declara valor que sirva de régua. É o caso dos
   * COMPLEMENTOS: **34% das linhas valem R$ 0,00** (sabor incluso no preço), então o Σ em R$
   * dele não confere nada — quem confere complemento é a CONTAGEM de ocorrências.
   * ⚠️ `null` significa *"não declara"*, nunca *"somava zero"*.
   */
  somaValor: number | null
  modo?: 'DIA' | 'PERIODO'
  userId?: string
}

export async function registrarArquivoDoImport(
  a: ArquivoARegistrar,
  db: PrismaClient = defaultPrisma,
): Promise<void> {
  // ⛔ arquivo de ZERO linha não é arquivo que entrou — e o CHECK do banco recusaria
  if (a.linhasArquivo <= 0) return
  const nome = a.nomeArquivo.trim()
  if (!nome) return

  const dataDate = new Date(`${a.data}T12:00:00`)
  try {
    await db.stockVendaArquivo.upsert({
      where: {
        companyId_data_relatorio: { companyId: a.companyId, data: dataDate, relatorio: a.relatorio },
      },
      /**
       * ⭐ O UPDATE REESCREVE TUDO, inclusive autor e hora — e isto **conserta um defeito
       * medido**: o `upsert` do `stock_venda_import` não mexe em `criadoPorId`/`criadoEm`, então
       * "quem · hora" mostrava o PRIMEIRO import do dia. Aqui a linha conta a verdade do
       * arquivo que está VALENDO.
       */
      update: {
        nomeArquivo: nome,
        linhasArquivo: a.linhasArquivo,
        somaQuantidade: a.somaQuantidade,
        somaValor: a.somaValor,
        modo: a.modo ?? 'DIA',
        importadoPorId: a.userId ?? null,
        importadoEm: new Date(),
      },
      create: {
        companyId: a.companyId,
        data: dataDate,
        relatorio: a.relatorio,
        nomeArquivo: nome,
        linhasArquivo: a.linhasArquivo,
        somaQuantidade: a.somaQuantidade,
        somaValor: a.somaValor,
        modo: a.modo ?? 'DIA',
        importadoPorId: a.userId ?? null,
      },
    })
  } catch (e) {
    // ⚠️ nunca silencioso: o log sai, mas o import NÃO cai por causa do registro
    console.error('[venda-arquivo] não consegui registrar o arquivo do import', {
      data: a.data,
      relatorio: a.relatorio,
      erro: e instanceof Error ? e.message : String(e),
    })
  }
}
