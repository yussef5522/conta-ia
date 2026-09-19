// ⭐⭐⭐ A QUARENTENA DO IMPORT DE VENDAS (19/09/2026) — o relatório que falhou fica guardado.
//
// **A ordem do dono:** *"Quarentena do import de vendas (produtos E complementos — toda
// tentativa guarda arquivo+erro, como os bancos)."*
//
// ⛔⛔ **O BURACO QUE ELA FECHA, na letra:** quando o relatório de produtos não leu nada, o
// arquivo **morreu no `throw`** e diagnosticar exigia pedir o .xls de volta. É exatamente o
// que o `rawOfxBlob` resolveu pro extrato em 13/08 e a `fatura_quarentena` pro cartão em
// 16/09 — e que o import de vendas nunca teve. ***É a terceira vez que esta casa paga pela
// mesma ausência***: "N caminhos, 1 esquecido", agora entre três importadores.
//
// ⭐ **E a que FECHA é tão valiosa quanto a que falha**: o Suitable muda o layout sem avisar
// (o `.xls` é HTML), e cada import bem-sucedido é o golden de amanhã. Foi por não ter os
// documentos antigos que o congelador das faturas nasceu com 9 fixtures em vez do histórico.
//
// ⚠️ **Fail-soft, sempre.** Guardar é diagnóstico; um erro aqui nunca pode derrubar um
// import legítimo — o dono perderia o dia de vendas por causa do mecanismo que existe pra
// ajudar depois.
//
// ⚠️ **Expurgo em 12 meses** (a mesma régua do blob do OFX): o relatório do PDV tem nome de
// produto, não dado pessoal, mas texto guardado sem prazo é texto que ninguém revisa.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

/** ⭐ o mesmo vocabulário dos dois relatórios — um import, dois layouts */
export type RelatorioDeVenda = 'PRODUTOS' | 'COMPLEMENTOS'
export type DesfechoDaVenda = 'OK' | 'RECUSADA'

export interface EntradaDaQuarentenaDeVenda {
  companyId: string
  relatorio: RelatorioDeVenda
  desfecho: DesfechoDaVenda
  /** o dia que o dono informou (o arquivo NÃO traz data — régua de 22/08) */
  data?: string | null
  /** o que a leitura disse: "0 linhas", "coluna Quantidade não achada", … */
  motivo?: string | null
  /** ⭐ o TEXTO do arquivo — é o que faz o diagnóstico não precisar do .xls de novo */
  texto: string
  /** quantas linhas o parser achou (0 é o caso que motivou tudo) */
  linhas?: number
  nomeArquivo?: string | null
  userId?: string | null
}

const LIMITE_TEXTO = 2_000_000 // ~2 MB — relatório de um dia não passa disso

export async function guardarVendaNaQuarentena(
  e: EntradaDaQuarentenaDeVenda, db: PrismaClient = defaultPrisma,
): Promise<{ id: string } | null> {
  try {
    const r = await db.stockVendaQuarentena.create({
      data: {
        companyId: e.companyId, relatorio: e.relatorio, desfecho: e.desfecho,
        data: e.data ?? null, motivo: e.motivo ?? null,
        texto: (e.texto ?? '').slice(0, LIMITE_TEXTO),
        linhas: e.linhas ?? 0, nomeArquivo: e.nomeArquivo ?? null,
        criadoPorId: e.userId ?? null,
      },
      select: { id: true },
    })
    return r
  } catch {
    // ⛔ fail-soft de propósito — ver o topo do arquivo
    return null
  }
}

/** ⭐ as que falharam e ainda esperam diagnóstico — a porta do dono pro que deu errado */
export async function vendasRecusadasParaDiagnosticar(
  companyId: string, db: PrismaClient = defaultPrisma, limite = 20,
) {
  return db.stockVendaQuarentena.findMany({
    where: { companyId, desfecho: 'RECUSADA' },
    orderBy: { criadoEm: 'desc' }, take: limite,
    select: { id: true, relatorio: true, data: true, motivo: true, linhas: true, nomeArquivo: true, criadoEm: true },
  })
}

/** ⚠️ expurgo do TEXTO em 12 meses; a metadata fica (auditoria sem o conteúdo) */
export async function expurgarTextosDeVendaAntigos(db: PrismaClient = defaultPrisma): Promise<number> {
  const corte = new Date(Date.now() - 365 * 86_400_000)
  const r = await db.stockVendaQuarentena.updateMany({
    where: { criadoEm: { lt: corte }, textoPurgadoEm: null },
    data: { texto: '', textoPurgadoEm: new Date() },
  })
  return r.count
}

/**
 * ⭐ A LEITURA QUE EXPLICA O "NÃO LEU NADA" — e ela é o coração do diagnóstico.
 *
 * ⚠️ O `.xls` do Suitable **é HTML**. Quando o dono exporta em outro formato (ou a página
 * exporta um erro), o arquivo chega sem `<table>` nenhuma — e "0 linhas" sozinho não
 * distingue *"dia sem venda"* de *"arquivo que não é o relatório"*. Estas pistas separam
 * os dois sem abrir o arquivo.
 */
export function pistasDoArquivo(texto: string): { temTabela: boolean; temCabecalho: boolean; tamanho: number; pista: string } {
  const t = texto ?? ''
  const temTabela = /<table/i.test(t)
  const temCabecalho = /(produto|descri[çc][ãa]o)/i.test(t) && /(quantidade|valor)/i.test(t)
  const pista = !t.trim()
    ? 'o arquivo chegou VAZIO'
    : !temTabela
      ? 'o arquivo não tem tabela nenhuma — o Suitable exporta um .xls que por dentro é HTML; confira se o download foi o relatório certo'
      : !temCabecalho
        ? 'tem tabela, mas sem as colunas esperadas — pode ser outro relatório do Suitable'
        : 'tem tabela e cabeçalho, mas nenhuma linha de produto — pode ser um dia sem venda ou um filtro que zerou'
  return { temTabela, temCabecalho, tamanho: t.length, pista }
}

/**
 * ⭐⭐ A PORTA ÚNICA DE LEITURA (REGRA 4/5) — parse + quarentena num lugar só.
 *
 * ⛔ Os dois importadores chamavam `parseSuitable` direto. Ligar a quarentena em cada um
 * seria dois lugares pra alguém esquecer — e "N caminhos, 1 esquecido" é justamente o que
 * fez este módulo ficar sem quarentena enquanto extrato e cartão já tinham a deles.
 *
 * ⭐ E a recusa de "não leu nada" passa a ENSINAR: as pistas dizem se o arquivo é outro
 * relatório, se veio vazio, ou se é mesmo um dia sem venda.
 */
export class RelatorioVazioError extends Error {
  readonly quarentenaId: string | null
  readonly pista: string
  constructor(mensagem: string, pista: string, quarentenaId: string | null) {
    super(mensagem); this.name = 'RelatorioVazioError'; this.pista = pista; this.quarentenaId = quarentenaId
  }
}

export interface LeituraComQuarentena<T> { resultado: T; quarentenaId: string | null }

export async function lerComQuarentena<T extends { linhas: unknown[] }>(
  ctx: { companyId: string; relatorio: RelatorioDeVenda; html: string; data?: string | null; nomeArquivo?: string | null; userId?: string | null },
  parse: (html: string) => T,
  db: PrismaClient = defaultPrisma,
): Promise<LeituraComQuarentena<T>> {
  let resultado: T | null = null
  let erroDoParse: string | null = null
  try {
    resultado = parse(ctx.html)
  } catch (e) {
    erroDoParse = e instanceof Error ? e.message : 'não consegui ler o arquivo'
  }

  const linhas = resultado?.linhas.length ?? 0
  const vazio = linhas === 0
  const pistas = pistasDoArquivo(ctx.html)

  const q = await guardarVendaNaQuarentena({
    companyId: ctx.companyId, relatorio: ctx.relatorio,
    // ⭐ TODA tentativa fica: a que falha pra diagnosticar, a que fecha como golden de amanhã
    desfecho: erroDoParse || vazio ? 'RECUSADA' : 'OK',
    data: ctx.data ?? null,
    motivo: erroDoParse ?? (vazio ? `0 linhas — ${pistas.pista}` : null),
    texto: ctx.html, linhas, nomeArquivo: ctx.nomeArquivo ?? null, userId: ctx.userId ?? null,
  }, db)

  if (erroDoParse || !resultado) {
    throw new RelatorioVazioError(`Não consegui ler este relatório: ${erroDoParse ?? 'formato inesperado'}. ${pistas.pista}.`, pistas.pista, q?.id ?? null)
  }
  if (vazio) {
    throw new RelatorioVazioError(
      `O relatório de ${ctx.relatorio === 'PRODUTOS' ? 'produtos' : 'complementos'} não tinha nenhuma linha — ${pistas.pista}. ` +
      'O arquivo ficou guardado; se você acha que ele está certo, me avise que eu olho sem precisar do arquivo de novo.',
      pistas.pista, q?.id ?? null,
    )
  }
  return { resultado, quarentenaId: q?.id ?? null }
}
