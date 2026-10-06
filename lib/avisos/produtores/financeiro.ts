/**
 * ⛔⛔⛔ O AVISO DO CUSTO FIXO QUE ESTOUROU O PLANO (06/10/2026) — **NADA INLINE.**
 *
 * **Ordem do dono:** *"categoria estourou o plano em >20% = aviso no SININHO setor financeiro
 * (língua do balcão: «A energia veio R$ 590 acima do plano este mês — [ver as contas →]»;
 * anti-spam padrão, 1 por categoria/mês). **NADA inline — a regra do dono.**"*
 *
 * ⚠️ É a lei de 04/10 ao pé da letra: *"o bloco inline MORRE — avisos só no sininho do topo"*.
 * A tela de Custos Fixos mostra o SELO na linha (que é o estado daquela linha, informação da
 * própria tabela) e **não** monta bloco de aviso nenhum; quem avisa é o sininho.
 *
 * ⛔ **E O DEGRAU DO AVISO É MAIS ALTO QUE O DO SELO, de propósito:** o selo âmbar acende acima
 * de 15% (*"+18% do plano"*), o aviso só acima de **20%**. Avisar no mesmo degrau do selo faria
 * o sininho repetir o que já está na cara do dono — e *alarme que repete a tela é alarme que se
 * aprende a ignorar* (os 111 falsos do juiz de vendas).
 *
 * ⚠️⚠️ **E O FATO TEM UMA FONTE SÓ:** o par (plano declarado, realizado do fluxo) sai de
 * `lerCustosFixos`, a MESMA função que a tela desenha. Recalcular aqui seria a 2ª resposta pra
 * *"a energia estourou?"* — e as duas divergiriam no primeiro ajuste da régua do realizado.
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { registrarAviso, reconciliarOrigem } from '../central'
import { avaliarLinguaDoBalcao } from '../lingua-do-balcao'
import type { NovoAviso } from '../tipos'
import { lerCustosFixos, hrefDasTransacoes } from '@/lib/custos-fixos/leitura'
import { estourouOQueAvisa } from '@/lib/custos-fixos/situacao'
import { mesCorrente, mesVizinho, rotuloDoMes } from '@/lib/periodo/mes-corrente'

type Db = PrismaClient | Prisma.TransactionClient

export const ORIGEM = 'CUSTO_FIXO_ACIMA_DO_PLANO'

export interface ResumoDoFinanceiro {
  gravados: number
  reabertos: number
  resolvidos: number
  recusados: { motivo: string; titulo: string }[]
}

const brl = (n: number) => `R$ ${Math.abs(n).toFixed(2).replace('.', ',')}`

async function gravar(r: ResumoDoFinanceiro, novo: NovoAviso, db: Db) {
  const v = avaliarLinguaDoBalcao(novo)
  if (!v.ok) { r.recusados.push({ motivo: v.motivo, titulo: novo.titulo }); return }
  const { reaberto } = await registrarAviso(novo, db)
  if (reaberto) r.reabertos++
  else r.gravados++
}

/**
 * ⭐⭐ O PRODUTOR — chamado pelo cron das 3h.
 *
 * ⚠️ **A JANELA É O MÊS CORRENTE + O ANTERIOR**, e isso não é arbitrário: se eu reconciliasse
 * olhando só o mês corrente, no dia 1º de novembro o aviso *"a energia estourou em outubro"*
 * seria **resolvido sozinho** sem ninguém ter olhado. Mais pra trás que isso é arqueologia —
 * e *fila que cobra o que já passou é como o dono aprende a não abrir o sininho*.
 */
export async function produzirAvisosDeFinanceiro(
  companyId: string,
  agora: Date = new Date(),
  db: Db = prisma,
): Promise<ResumoDoFinanceiro> {
  const r: ResumoDoFinanceiro = { gravados: 0, reabertos: 0, resolvidos: 0, recusados: [] }
  const atual = mesCorrente(agora)
  const meses = [atual, mesVizinho(atual, -1)]

  const vivos: string[] = []
  for (const mes of meses) {
    const tela = await lerCustosFixos(companyId, mes, agora, db)
    for (const l of tela.linhas) {
      const excesso = estourouOQueAvisa(l.realizado, l.planejado)
      if (excesso == null || l.planejado == null) continue

      const diferenca = l.realizado - l.planejado
      const alvo = `categoria:${l.categoryId}:${mes}`
      await gravar(r, {
        companyId,
        setor: 'financeiro',
        /**
         * ⚠️ ÂMBAR: o dado não está errado — o custo veio mais alto. O que pede olho é a conta.
         * Vermelho aqui competiria com "dinheiro errado agora", que é outra categoria de susto.
         */
        severidade: 'ambar',
        titulo: `Confere ${l.nome.toLowerCase()}: veio ${brl(diferenca)} acima do plano`,
        corpo:
          `Em ${rotuloDoMes(mes, agora)} saiu ${brl(l.realizado)} de ${l.nome.toLowerCase()}`
          + ` contra ${brl(l.planejado)} que você planejou — ${Math.round(excesso * 100)}% acima.`,
        oQueFazer:
          'Abra as contas do mês nessa categoria pra ver o que entrou a mais. '
          + 'Se o custo mudou pra valer, ajuste o plano na tela de Custos fixos.',
        acaoRotulo: 'ver as contas',
        acaoHref: hrefDasTransacoes(companyId, l.categoryId, mes),
        origem: ORIGEM,
        alvo,
      }, db)
      vivos.push(alvo)
    }
  }

  /**
   * ⭐ RECONCILIA: o que deixou de estourar (o dono ajustou o plano, ou a nota foi estornada)
   * sai da fila. ⛔ Sem isso o aviso ficaria lá pra sempre — *trabalho FEITO tem que sair da
   * fila*, a régua do produtor do estoque.
   */
  r.resolvidos += await reconciliarOrigem(companyId, ORIGEM, vivos, db)
  return r
}
