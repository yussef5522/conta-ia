/**
 * ⭐⭐ OS AVISOS DA MARGEM (07/10/2026) — no SININHO, nunca inline.
 *
 * ⛔ A lei de 04/10 vale: *"nada de bloco de aviso inline em tela nenhuma sem o dono pedir"*.
 * A tela de margem mostra o ESTADO (o selo, a cobertura, o banquinho); o que pede AÇÃO vai pro
 * sininho.
 *
 * ⛔⛔ **ZERO CONTA NOVA:** este produtor lê a MESMA `lerMargem` que a tela desenha. Uma régua
 * própria aqui faria o sininho e a tela discordarem do mesmo produto — a doença que este
 * projeto mais paga.
 *
 * ⭐⭐ E A RÉGUA MORA EM `lib/margem/regua-dos-avisos.ts`, PURA — este arquivo é a CASCA que
 * lê e grava. Enquanto a decisão vivia aqui, entre dois `await`, a única coisa que dava pra
 * conferir sobre ela era a MENÇÃO do símbolo no arquivo ("menção, não uso", 11 vezes nesta
 * casa). A prova em prod mostrou o tamanho do vão: o produtor rodou contra o dado real e
 * devolveu zero avisos **por razão legítima**, então o caminho que monta a frase nunca tinha
 * sido exercido — nem aqui, nem em produção.
 *
 * ⚠️ O client vem por PARÂMETRO (a lição de 04/09): com o `prisma` global cravado, o preview
 * que embrulha o produtor num `$transaction` gravaria de verdade.
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { registrarAviso } from '../central'
import { lerMargem } from '@/lib/margem/leitura'
import {
  reguaDosAvisosDaMargem,
  DIA_QUE_ABRE_A_COMPARACAO,
  type Calado,
  type ProdutoParaAviso,
} from '@/lib/margem/regua-dos-avisos'

export {
  ORIGEM_NEGATIVA,
  ORIGEM_DESPENCOU,
  ORIGEM_RELATORIO,
  QUEDA_EM_PONTOS,
  MINIMO_DE_UNIDADES,
} from '@/lib/margem/regua-dos-avisos'

type Db = PrismaClient | Prisma.TransactionClient

export interface ResumoDaMargem {
  gravados: number
  reabertos: number
  /** ⚠️ os que NÃO viraram aviso, com o porquê — supressão silenciosa viraria "o aviso não funciona" */
  calados: Calado[]
}

/** ⚠️ só os campos que a régua usa — o resto do payload da margem não atravessa */
const paraRegua = (p: {
  chave: string
  nome: string
  unidades: number
  preco: number
  custo: number
  sobraUn: number
  sobraTotal: number
  margemPct: number
}): ProdutoParaAviso => p

export async function produzirAvisosDeMargem(
  companyId: string,
  agora: Date = new Date(),
  db: Db = defaultPrisma,
): Promise<ResumoDaMargem> {
  // ⚠️ o MÊS é a janela do aviso: 7 dias oscila demais pra cobrar ação, e "hoje" muda de
  // veredito a cada import da madrugada
  const mes = await lerMargem(companyId, 'MES', agora, {}, db as PrismaClient)

  /**
   * ⚠️ A comparação é com o MÊS ANTERIOR INTEIRO, e o mês corrente é PARCIAL — então ela só
   * vale depois que o mês tem corpo. Sem essa trava, todo dia 2 do mês o sininho acusaria
   * queda em metade do cardápio.
   */
  const diaDoMes = Number(agora.toISOString().slice(8, 10))
  let anterior: ProdutoParaAviso[] | null = null
  if (diaDoMes >= DIA_QUE_ABRE_A_COMPARACAO) {
    const fim = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 0))
    const lido = await lerMargem(
      companyId,
      'DATAS',
      agora,
      { de: `${fim.toISOString().slice(0, 7)}-01`, ate: fim.toISOString().slice(0, 10) },
      db as PrismaClient,
    )
    anterior = lido.sobras.dentro.map(paraRegua)
  }

  const { avisos, calados } = reguaDosAvisosDaMargem({
    companyId,
    mes: mes.sobras.dentro.map(paraRegua),
    anterior,
    diaDoMes,
    diasComRelatorioSuspeito: mes.diasComRelatorioSuspeito,
  })

  let gravados = 0
  let reabertos = 0
  for (const a of avisos) {
    const { reaberto } = await registrarAviso({ ...a, companyId }, db)
    gravados++
    if (reaberto) reabertos++
  }

  return { gravados, reabertos, calados }
}
