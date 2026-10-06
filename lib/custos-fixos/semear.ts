/**
 * ⭐⭐ SEMEAR O PLANO COM O REALIZADO — PRÉVIA E GRAVAÇÃO PELA MESMA FUNÇÃO (06/10/2026).
 *
 * **Ordem do dono:** *"no topo da lista, «preencher todos com o realizado de [mês]» de uma vez
 * (preview antes de gravar, rastro). Plano continua sendo MEU número — o botão só poupa
 * digitação."*
 *
 * ⛔⛔ **A PRÉVIA É A LISTA QUE A GRAVAÇÃO EXECUTA, literalmente.** `semear` chama
 * `previaDaSemente` e grava **o que ela devolveu** — não existe um segundo cálculo do "o que
 * vai entrar". É a cicatriz mais caras desta casa: o preview do import dizia *"N novas"* e o
 * confirm fazia outra coisa (17/08), e a cura foi exatamente esta — uma função, as duas pontas.
 *
 * ⛔ **E ELE NÃO SOBRESCREVE PLANO DECLARADO sem o dono pedir.** O plano é afirmação dele; um
 * lote que passa por cima apagaria uma decisão sem avisar. A linha que já tem plano fica de
 * fora **com o porquê escrito**, e o toggle que inclui elas **nasce desmarcado** (a régua do
 * rename em lote, 09/09: *"confirmar em lote não pode virar «aceitei sem ler»"*).
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { mesCorrente } from '@/lib/periodo/mes-corrente'
import { lerCustosFixos, referenciaPadrao } from './leitura'
import { definirPlanejado, CustoFixoError, MES_RE } from './gestos'

type Db = PrismaClient | Prisma.TransactionClient

export interface LinhaDaSemente {
  categoryId: string
  nome: string
  qualificador: string | null
  /** o plano de hoje naquele mês — `null` = ainda não declarado */
  planoAtual: number | null
  /** o realizado do mês de REFERÊNCIA — o número que semeia */
  valor: number
  /** entra nesta semeadura? */
  vai: boolean
  /** ⚠️ quando NÃO vai, o motivo vai escrito — exclusão silenciosa é a doença do lote */
  porque: string | null
}

export interface PreviaDaSemente {
  mesDestino: string
  mesReferencia: string
  /** ⚠️ a referência é um mês que ainda está correndo? */
  referenciaEhParcial: boolean
  incluirComPlano: boolean
  linhas: LinhaDaSemente[]
  /** quantas linhas vão entrar e quanto elas somam */
  quantas: number
  soma: number
  /** quantas ficam de fora porque já têm plano (e o dono não pediu pra substituir) */
  jaTemPlano: number
  /** quantas ficam de fora porque não houve realizado nenhum na referência */
  semRealizado: number
}

/**
 * ⭐ A PRÉVIA — e ela **não grava nada**.
 *
 * ⚠️ Lê a tela pela MESMA `lerCustosFixos` que o dono vê: o `realizadoReferencia` de cada
 * linha é o número que a tela já mostra no botão da linha. Uma consulta própria aqui faria o
 * lote semear um número diferente do que o botão da linha oferece.
 */
export async function previaDaSemente(
  companyId: string,
  mesDestino: string,
  mesReferencia: string | null,
  incluirComPlano: boolean,
  agora: Date = new Date(),
  db: Db = prisma,
): Promise<PreviaDaSemente> {
  if (!MES_RE.test(mesDestino)) throw new CustoFixoError('Mês inválido — use o formato AAAA-MM.', 'MES_INVALIDO')
  const ref = mesReferencia ?? referenciaPadrao(mesDestino)
  if (!MES_RE.test(ref)) throw new CustoFixoError('Mês de referência inválido.', 'MES_INVALIDO')

  const tela = await lerCustosFixos(companyId, mesDestino, agora, db, ref)

  const linhas: LinhaDaSemente[] = tela.linhas.map((l) => {
    const valor = Math.round(l.realizadoReferencia * 100) / 100
    /**
     * ⛔ ORDEM DAS RECUSAS: "já tem plano" vem ANTES de "não houve realizado". A linha que já
     * tem plano fica de fora **independente** do realizado — dizer *"não houve realizado"*
     * sobre ela mandaria o dono procurar um lançamento que não é o problema (a lição de 16/09:
     * mensagem que acusa o campo errado faz o dono caçar um erro que não existe).
     */
    if (l.planejado != null && !incluirComPlano) {
      return {
        categoryId: l.categoryId, nome: l.nome, qualificador: l.qualificador,
        planoAtual: l.planejado, valor, vai: false,
        porque: 'já tem plano — marque "substituir também os que já têm plano" se quer trocar',
      }
    }
    if (valor <= 0) {
      return {
        categoryId: l.categoryId, nome: l.nome, qualificador: l.qualificador,
        planoAtual: l.planejado, valor, vai: false,
        porque: 'nada saiu nesta categoria no mês de referência — não há número pra semear',
      }
    }
    return {
      categoryId: l.categoryId, nome: l.nome, qualificador: l.qualificador,
      planoAtual: l.planejado, valor, vai: true, porque: null,
    }
  })

  const vao = linhas.filter((l) => l.vai)
  return {
    mesDestino,
    mesReferencia: ref,
    referenciaEhParcial: ref === mesCorrente(agora),
    incluirComPlano,
    linhas,
    quantas: vao.length,
    soma: vao.reduce((s, l) => s + l.valor, 0),
    jaTemPlano: linhas.filter((l) => !l.vai && l.planoAtual != null && !incluirComPlano).length,
    semRealizado: linhas.filter((l) => !l.vai && l.valor <= 0).length,
  }
}

/**
 * ⭐⭐ GRAVA **o que a prévia disse** — e o rastro vai em cada linha.
 *
 * ⚠️ Passa pelo `definirPlanejado`, a porta única do plano: se um dia ele ganhar uma trava
 * nova (um teto, uma validação), o lote herda de graça. Uma escrita direta na tabela aqui
 * seria a segunda porta de gravação do plano.
 */
export async function semear(
  companyId: string,
  mesDestino: string,
  mesReferencia: string | null,
  incluirComPlano: boolean,
  quemId: string | null,
  agora: Date = new Date(),
  db: Db = prisma,
): Promise<{ previa: PreviaDaSemente; aplicados: number }> {
  const previa = await previaDaSemente(companyId, mesDestino, mesReferencia, incluirComPlano, agora, db)
  let aplicados = 0
  for (const l of previa.linhas) {
    if (!l.vai) continue
    await definirPlanejado(companyId, l.categoryId, mesDestino, l.valor, quemId, db)
    aplicados++
  }
  return { previa, aplicados }
}
