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
import { produzirAvisosDeMargem } from './margem'
import { produzirAvisosDeImportDeVenda } from './import-de-venda'
import { produzirAvisosDeConferencia } from './conferencia'
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
      /**
       * ⭐⭐ A MARGEM (07/10) — sobra negativa, margem que despencou, e o relatório de
       * complementos incompleto.
       *
       * ⛔ Entra DEPOIS do estoque de propósito: o aviso de sobra negativa só faz sentido
       * sobre produto cujo custo é confiável, e é a rodada do estoque que resolve os avisos
       * de insumo sem custo. ⚠️ Empresa sem produto com custo devolve zero e não grava nada.
       */
      const mg = await produzirAvisosDeMargem(e.id, agora)
      r.gravados += mg.gravados
      r.reabertos += mg.reabertos
      /**
       * ⭐⭐ CAMADA 3 DO IMPORT DE VENDA (08/10) — o dia que amanheceu torto.
       *
       * ⛔ Entra DEPOIS da margem de propósito, e o motivo é o mesmo da ordem de cima: o
       * "Quem paga a casa" fica cego no dia sem import, então os avisos de margem daquele dia
       * seriam consequência, não causa. ⚠️ Empresa que não importa venda devolve zero e não
       * grava nada — o produtor é mudo até existir dia de venda.
       */
      const iv = await produzirAvisosDeImportDeVenda(e.id, agora)
      r.gravados += iv.gravados
      r.reabertos += iv.reabertos
      r.resolvidos += iv.resolvidos
      for (const x of iv.recusados) r.recusados.push({ empresa: e.name, ...x })
      /**
       * ⭐⭐ A CONFERÊNCIA PARADA (09/10, item 2d) — setor `gerencia`, invisível pro tablet.
       *
       * ⛔ Entra DEPOIS da produção de propósito, e o motivo é o inverso do de cima: o aviso do
       * FISCAL (*"declarou mais do que o material dava"*) nasce lá e fala da RECEITA; este fala
       * do GESTO QUE FALTA. Eles **não se suprimem** — suprimir deixaria um lote impossível sem
       * ninguém sendo cobrado de olhar —, mas a ordem mantém o fiscal falando primeiro, que é
       * quem o gerente vai ler antes de carimbar.
       *
       * ⚠️ Empresa sem conclusão parada devolve zero e não grava nada.
       */
      const cf = await produzirAvisosDeConferencia(e.id, agora)
      r.gravados += cf.gravados
      r.reabertos += cf.reabertos
      r.resolvidos += cf.resolvidos
      for (const x of cf.recusados) r.recusados.push({ empresa: e.name, ...x })
      if (await verdeDaSemana(e.id, agora)) r.verdesSemanais++
    } catch (err) {
      // ⛔ uma empresa com problema não derruba a rodada das outras nem o juiz
      r.falhas.push({ empresa: e.name, erro: err instanceof Error ? err.message : String(err) })
    }
  }
  return r
}
