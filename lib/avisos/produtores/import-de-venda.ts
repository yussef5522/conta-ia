/**
 * ⛔⛔⛔ CAMADA 3 — O SININHO DO IMPORT DE VENDA (08/10/2026). **O dia torto não amanhece calado.**
 *
 * **Ordem do dono:** *"CAMADA 3 — SININHO: produtor na rodada da manhã (gate ~10h): dia que
 * amanheceu sem importação, sem sabores ou incompleto = aviso setor estoque, língua do balcão,
 * com a consequência na frase («as pizzas de DD/MM não baixaram sabor do estoque») + link pra
 * cá. Anti-spam padrão (uma causa, um alarme; origem+alvo UNIQUE)."*
 *
 * ⭐⭐ **A RÉGUA É A MESMA DA TELA, LITERALMENTE.** O veredito de cada dia sai de
 * `lerCentralDeImport` → `vereditoDoDia`, a função que desenha o selo na central. ⛔ Uma régua
 * própria aqui faria o sininho gritar sobre um dia que a tela mostra verde (ou calar sobre um
 * que ela mostra coral) — é a doença do B1, que esta casa paga desde que o menu dizia um número
 * e a tela outro. ***O produtor TRADUZ o veredito; ele não decide o veredito.***
 *
 * ⚠️⚠️ **A CONSEQUÊNCIA VAI NA FRASE, nunca só o estado.** *"05/10 está incompleto"* não diz ao
 * dono o que ele perde; *"as pizzas de 05/10 não baixaram sabor do estoque"* diz. É a lição de
 * 16/09 (*"mensagem que acusa o campo errado faz o dono caçar um erro que não existe"*) do lado
 * de quem lê: alarme sem consequência é alarme que se aprende a ignorar.
 */
import { prisma } from '@/lib/db'
import type { Prisma, PrismaClient } from '@prisma/client'
import { registrarAviso, reconciliarOrigem } from '../central'
import { avaliarLinguaDoBalcao } from '../lingua-do-balcao'
import { lerCentralDeImport, type DiaDaCentral } from '@/lib/stock/vendas/central-de-import'
import { SELOS_QUE_PEDEM_ACAO } from '@/lib/stock/vendas/razao-sabor-pizza'
import type { NovoAviso } from '../tipos'

/** ⚠️ client por PARÂMETRO — a lição de 04/09: com o global cravado, um preview gravaria */
type Db = PrismaClient | Prisma.TransactionClient

export const ORIGEM = 'IMPORT_DE_VENDA_TORTO'

/**
 * ⭐⭐ O GATE DA MANHÃ, e ele existe por causa da ROTINA MEDIDA: **o import acontece de noite**
 * (a referência mostra 23h41, 23h58, 00h12) e a cozinha às vezes sobe o arquivo na manhã
 * seguinte. Se o produtor falasse do dia de ontem às 3h, ele gritaria sobre um arquivo que
 * ainda vai entrar às 8h — e o aviso seria **resolvido na rodada seguinte**, ou seja ruído
 * diário sobre um dia que não tem problema.
 *
 * ⭐ Então o dia D só entra depois das **10h de D+1**. Na rodada das 3h ele fala de anteontem
 * pra trás; quando o dono abre o sininho às 10h30 (a central também roda na 1ª carga), o dia de
 * ontem entra — que é exatamente *"a rodada da manhã"* que o dono pediu.
 */
export const HORA_DO_GATE = 10

/**
 * ⚠️ Quanto tempo pra trás olhar. Aviso sobre um dia de três meses atrás é arqueologia, e
 * ***fila que cobra o que já passou é como o dono aprende a não abrir o sininho***.
 */
export const JANELA_DIAS = 21

export interface ResumoDoImportDeVenda {
  gravados: number
  reabertos: number
  resolvidos: number
  calados: { dia: string; porque: string }[]
  recusados: { motivo: string; titulo: string }[]
}

async function gravar(r: ResumoDoImportDeVenda, novo: NovoAviso, db: Db) {
  const v = avaliarLinguaDoBalcao(novo)
  // ⚠️ texto recusado é erro MEU, nunca motivo pra derrubar o cron (o padrão dos produtores)
  if (!v.ok) { r.recusados.push({ motivo: v.motivo, titulo: novo.titulo }); return }
  const { reaberto } = await registrarAviso(novo, db)
  if (reaberto) r.reabertos++
  else r.gravados++
}

/** ⚠️ `YYYY-MM-DD` → `DD/MM`, o formato que o balcão lê */
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`

/**
 * ⭐ O DIA DE HOJE **NO BRASIL**, e o gate em cima dele.
 *
 * ⚠️ O servidor roda em UTC: às 23h de São Paulo ele já diz o dia seguinte, e sem o desconto o
 * gate das 10h disparia às 7h da manhã. É a mesma correção do card do cartão (09/09) e do
 * Contas a Pagar (13/09).
 */
export function diaLimiteDoGate(agora: Date): string {
  const brasil = new Date(agora.getTime() - 3 * 3_600_000)
  const hoje = brasil.toISOString().slice(0, 10)
  /**
   * ⛔ ANTES das 10h o dia de ONTEM ainda não conta: o limite recua um dia. Depois das 10h,
   * ontem entra. O dia de HOJE nunca entra — ele não acabou, e cobrar import de um dia que
   * ainda está vendendo é cobrar o impossível.
   */
  const ontem = new Date(Date.UTC(
    Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1, Number(hoje.slice(8, 10)) - 1,
  )).toISOString().slice(0, 10)
  if (brasil.getUTCHours() >= HORA_DO_GATE) return ontem
  const anteontem = new Date(Date.UTC(
    Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1, Number(hoje.slice(8, 10)) - 2,
  )).toISOString().slice(0, 10)
  return anteontem
}

/** ⭐ os meses que a janela alcança — ela atravessa a virada do mês, e a leitura é por MÊS */
export function mesesDaJanela(limite: string, dias = JANELA_DIAS): string[] {
  const fim = new Date(`${limite}T12:00:00Z`)
  const inicio = new Date(fim.getTime() - (dias - 1) * 86_400_000)
  const meses = new Set<string>([inicio.toISOString().slice(0, 7), fim.toISOString().slice(0, 7)])
  return [...meses].sort()
}

/**
 * ⭐⭐ A FRASE, com a CONSEQUÊNCIA dentro — uma por selo, na língua do balcão.
 *
 * ⛔ Cada uma diz **o que o dono perde**, não o estado técnico: é isso que separa um aviso que
 * se lê de um aviso que se fecha sem ler.
 */
export function fraseDoDiaTorto(
  d: DiaDaCentral,
): { titulo: string; corpo: string; oQueFazer: string } | null {
  const data = ddmm(d.dia)
  if (d.selo === 'SEM_IMPORTACAO') {
    return {
      titulo: `Importe a venda de ${data}`,
      corpo:
        `Teve venda em ${data} e nenhum arquivo do Suitable entrou — o estoque não baixou nada ` +
        `desse dia e o "Quem paga a casa" está cego pra ele.`,
      oQueFazer: `Importe os dois relatórios de ${data} (Produtos e Sabores) na central de import.`,
    }
  }
  if (d.selo === 'SABORES_NAO_IMPORTADOS') {
    return {
      titulo: `Importe os sabores de ${data}`,
      corpo:
        `As pizzas de ${data} não baixaram sabor do estoque: saíram ${d.pizzas} pizzas e o ` +
        `relatório de SABORES não entrou — calabresa, frango e queijo continuam no sistema como ` +
        `se ninguém tivesse usado.`,
      oQueFazer: `Importe o relatório de Complementos de ${data} na central de import.`,
    }
  }
  if (d.selo === 'COMPLEMENTOS_INCOMPLETOS') {
    return {
      titulo: `Importe de novo os sabores de ${data}`,
      corpo:
        `Parte das pizzas de ${data} não baixou sabor do estoque: saíram ${d.pizzas} pizzas e só ` +
        `${d.conferencia.ocorrenciasSabores} ocorrências de sabor entraram.`,
      oQueFazer: `Importe o relatório de Complementos de ${data} inteiro — ele veio pela metade.`,
    }
  }
  return null
}

/**
 * ⭐⭐ O PRODUTOR — chamado pela rodada dos produtores (cron das 3h E 1ª carga do sininho).
 *
 * ⭐ E ele **RECONCILIA**: dia que ele deixa de reportar numa rodada é RESOLVIDO. Sem isso o
 * dono importaria o arquivo que faltava e o aviso ficaria lá pra sempre — ***trabalho FEITO tem
 * que sair da fila***.
 */
export async function produzirAvisosDeImportDeVenda(
  companyId: string, agora: Date = new Date(), db: Db = prisma,
): Promise<ResumoDoImportDeVenda> {
  const r: ResumoDoImportDeVenda = { gravados: 0, reabertos: 0, resolvidos: 0, calados: [], recusados: [] }

  const limite = diaLimiteDoGate(agora)
  const inicio = new Date(new Date(`${limite}T12:00:00Z`).getTime() - (JANELA_DIAS - 1) * 86_400_000)
    .toISOString().slice(0, 10)

  const dias: DiaDaCentral[] = []
  for (const mes of mesesDaJanela(limite)) {
    // ⚠️ a MESMA leitura da tela — o `db` entra pra o preview poder embrulhar num rollback
    const c = await lerCentralDeImport(companyId, mes, db as PrismaClient)
    dias.push(...c.dias)
  }

  const vivos: string[] = []
  for (const d of dias) {
    if (d.dia > limite) {
      // ⚠️ dentro do gate: o dia ainda pode receber o arquivo hoje
      r.calados.push({ dia: d.dia, porque: `ainda dentro do gate das ${HORA_DO_GATE}h — o arquivo pode entrar hoje` })
      continue
    }
    if (d.dia < inicio) continue
    /**
     * ⛔⛔ UMA CAUSA, UM ALARME: **um aviso por DIA, com o selo PIOR**. O `vereditoDoDia` já
     * ordena pela AÇÃO (sem importação → sem sabores → incompleto), então o dia sem arquivo
     * nenhum não ganha também o aviso de "sabor faltando" — ele JÁ é o caso mais grave, e os
     * dois juntos mandariam o dono olhar a mesma coisa duas vezes.
     */
    if (!SELOS_QUE_PEDEM_ACAO.includes(d.selo)) continue
    const f = fraseDoDiaTorto(d)
    if (!f) continue

    const alvo = `dia:${d.dia}`
    vivos.push(alvo)
    await gravar(r, {
      companyId,
      origem: ORIGEM,
      alvo,
      setor: 'estoque',
      severidade: d.selo === 'COMPLEMENTOS_INCOMPLETOS' ? 'ambar' : 'coral',
      titulo: f.titulo,
      corpo: f.corpo,
      oQueFazer: f.oQueFazer,
      // ⭐ o link leva PRA CÁ — aviso sem caminho é a "porta sem maçaneta" do lado do alarme
      acaoRotulo: 'abrir a central de import',
      acaoHref: `/empresas/${companyId}/estoque/vendas`,
    }, db)
  }

  r.resolvidos += await reconciliarOrigem(companyId, ORIGEM, vivos, db)
  return r
}
