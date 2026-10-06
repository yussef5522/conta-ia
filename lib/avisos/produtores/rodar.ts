/**
 * ⭐⭐ A RODADA DOS PRODUTORES (04/10/2026) — chamada pelo cron das 3h E pela primeira carga.
 *
 * ⛔⛔ **FAIL-SOFT POR EMPRESA, e isso é desenho.** O juiz das 3h é o guarda do dinheiro desta
 * casa; se a central de avisos estourar numa empresa (texto recusado, banco lento, tabela
 * recém-criada), ele **não pode** morrer no meio e deixar os invariantes de empréstimo, cartão
 * e vendas sem rodar. A falha vai pro log com o nome da empresa e a rodada segue.
 *
 * ⚠️ E o e-mail CONTINUA saindo igual: o aviso é o CANAL NOVO, não o substituto. Quem está fora
 * do sistema precisa ser alcançado — a lição dos R$ 21.968,02 de 30/08 é que o e-mail não
 * BASTA, nunca que ele sobra.
 */
import { prisma } from '@/lib/db'
import { produzirAvisosDeProducao, type ResumoDaCarga } from './producao'
import { produzirAvisosDeEstoque } from './estoque'
import { produzirAvisosDeFinanceiro } from './financeiro'
import { montarSemanaVerde } from '../semana-verde'
import { registrarAviso, avisosAbertos } from '../central'

export interface RodadaDeAvisos {
  empresas: number
  gravados: number
  reabertos: number
  resolvidos: number
  verdesSemanais: number
  recusados: { empresa: string; motivo: string; titulo: string }[]
  falhas: { empresa: string; erro: string }[]
}

/**
 * ⭐ O verde semanal precisa de uma FOTO. Hoje ela sai do que a central já sabe (nada vermelho
 * nem coral em aberto) + do que o estoque mediu.
 *
 * ⚠️ **Sem nada medido, NÃO sai verde** — `montarSemanaVerde` devolve `null`. Dizer "tudo certo"
 * sem ter conferido nada é o selo de graça que o invariante circular de saldo deu em 28/08, e
 * ele é pior que silêncio: ele AFIRMA.
 */
async function verdeDaSemana(companyId: string, agora: Date): Promise<boolean> {
  const abertos = await avisosAbertos(companyId)
  const contagens = await prisma.stockContagemItem.count({ where: { companyId } })
  const divergentes = await prisma.stockContagemItem.count({
    where: { companyId, divergencia: { not: 0 } },
  })
  const contas = await prisma.bankAccount.count({ where: { companyId } })
  const comAncora = await prisma.bankAccount.count({
    where: { companyId, ledgerBal: { not: null } },
  })

  const aviso = montarSemanaVerde(
    companyId,
    {
      contasQueFecham: Math.max(0, contagens - divergentes),
      contasConferidas: contagens,
      bancosOk: comAncora,
      bancosTotal: contas,
      severidadesAbertas: abertos.map((a) => a.severidade),
    },
    agora,
  )
  if (!aviso) return false
  await registrarAviso(aviso)
  return true
}

export async function rodarProdutoresDeAviso(agora: Date = new Date()): Promise<RodadaDeAvisos> {
  const r: RodadaDeAvisos = {
    empresas: 0,
    gravados: 0,
    reabertos: 0,
    resolvidos: 0,
    verdesSemanais: 0,
    recusados: [],
    falhas: [],
  }

  const empresas = await prisma.company.findMany({ select: { id: true, name: true } })
  for (const e of empresas) {
    r.empresas++
    try {
      const p: ResumoDaCarga = await produzirAvisosDeProducao(e.id)
      r.gravados += p.gravados
      r.reabertos += p.reabertos
      r.resolvidos += p.resolvidos
      for (const x of p.recusados) r.recusados.push({ empresa: e.name, ...x })
      /**
       * ⛔⛔ O ESTOQUE ENTRA **DEPOIS** DA PRODUÇÃO, e a ordem é a régua anti-spam.
       *
       * O aviso de investigação do negativo CALA quando a causa já tem aviso aberto (ficha na
       * fila de conversão, fiscal, grandeza) — e esses nascem na rodada da produção. Rodando
       * antes, ele veria a lista de ontem e **gritaria sobre uma causa que acabou de ganhar o
       * próprio alarme**. *Uma causa, um alarme* depende de quem fala primeiro.
       */
      const q = await produzirAvisosDeEstoque(e.id, agora)
      r.gravados += q.gravados
      r.reabertos += q.reabertos
      r.resolvidos += q.resolvidos
      for (const x of q.recusados) r.recusados.push({ empresa: e.name, ...x })
      /**
       * ⭐ O FINANCEIRO (custo fixo acima do plano, 06/10) — independente dos dois de cima: a
       * causa dele é outra (plano × realizado) e não existe supressão cruzada aqui.
       *
       * ⚠️ Empresa que nunca marcou custo fixo nenhum devolve zero e **não grava nada** — a
       * leitura parte da lista do dono, então o produtor é mudo até ele declarar o primeiro.
       */
      const f = await produzirAvisosDeFinanceiro(e.id, agora)
      r.gravados += f.gravados
      r.reabertos += f.reabertos
      r.resolvidos += f.resolvidos
      for (const x of f.recusados) r.recusados.push({ empresa: e.name, ...x })
      if (await verdeDaSemana(e.id, agora)) r.verdesSemanais++
    } catch (err) {
      // ⛔ uma empresa com problema não derruba a rodada das outras nem o juiz
      r.falhas.push({ empresa: e.name, erro: err instanceof Error ? err.message : String(err) })
    }
  }
  return r
}
