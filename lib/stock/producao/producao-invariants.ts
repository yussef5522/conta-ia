// ESTOQUE FASE 2 item 2.5 — invariantes do JUIZ pra produção (P1-P6, P8 + M2). Rodam no juiz
// noturno (mesma tabela stock_judge_report isolada). P7 (etiqueta vencida ainda vendida)
// depende de BAIXA_VENDA/fase 3 — deferido. Retorna o mesmo StockInvariantFail[] do E*.

import type { PrismaClient, Prisma } from '@prisma/client'
import type { StockInvariantFail } from '../stock-invariants'
import { rendimentoMedioDaFicha } from './conclusao'
import { emProducaoPorOrdem } from './em-producao'
import { dosesSuspeitas, assinaturaDoDesvio, DESVIO_DA_DOSE } from './plausibilidade-da-dose'
import { EFICIENCIA_MINIMA, DESVIO_GRAVE } from './eficiencia-da-ordem'
import { diaEmSaoPaulo, janelaDoDiaSP } from '@/lib/datas/dia-sao-paulo'

type Db = PrismaClient | Prisma.TransactionClient

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const round4 = (n: number) => Math.round((n + 1e-9) * 1e4) / 1e4
/**
 * ⭐ O ±25% do P3 MUDOU DE CASA pra `eficiencia-da-ordem.ts` (`DESVIO_GRAVE`), onde moram as
 * faixas. Motivo: o selo da tela do relatório precisa do MESMO degrau pro vermelho — o dono
 * pediu *"a cor segue a régua que o P8/eficienciaDaOrdem já usa, a tela só pinta"* —, e este
 * arquivo não é importável do cliente (ele carrega o juiz inteiro). Digitar 0,25 no componente
 * seria a segunda régua no dia em que o "grave" mudar.
 */
const P5_DIAS = 14
const P6_DIAS = 7
const TIPOS_ORDEM = ['SEPARACAO_SAIDA', 'DEVOLUCAO_PRODUCAO', 'PRODUCAO_CONSUMO']

export async function checkProducaoInvariants(db: Db, now: Date = new Date()): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []
  const F = (invariante: string, companyId: string | null, detalhe: string, nivel?: 'erro' | 'aviso') => fails.push({ invariante, companyId, detalhe, ...(nivel ? { nivel } : {}) })

  const ordens = await db.stockProductionOrder.findMany({ select: { id: true, companyId: true, estado: true, atualizadoEm: true, fichaId: true, versaoFicha: true, escalaReceitas: true } })
  /**
   * ⭐ AS ORDENS COM DESCANSO PLANEJADO — etapa ainda por fazer, marcada pra HOJE ou pra
   * FRENTE. É o que separa *"o lote está dormindo de propósito"* de *"o lote foi esquecido"*.
   * ⚠️ O corte é o DIA de São Paulo: um plano pra hoje não pode virar "vencido" às 21h.
   */
  const hojeSP = janelaDoDiaSP(diaEmSaoPaulo(now), diaEmSaoPaulo(now)).de
  const planosVigentes = await db.stockEtapaPlano.findMany({
    where: { diaPrevisto: { gte: hojeSP } },
    select: { etapaId: true },
  })
  const descansoPlanejado = new Set(
    planosVigentes.length
      ? (await db.stockOrdemEtapa.findMany({
          where: { id: { in: planosVigentes.map((p) => p.etapaId) }, finalizadoEm: null },
          select: { ordemId: true },
        })).map((e) => e.ordemId)
      : [],
  )
  /**
   * ⚠️ IÇADO do `if (ordens.length)` em 02/10 porque o **M2** (plausibilidade da dose) também
   * precisa do consumo por ordem+item. Sem içar, o M2 lia um mapa fora de escopo e o
   * `tsc` cobrou — e o remédio errado seria ele montar o SEU agrupamento, que é a conta
   * paralela que este sprint inteiro existe pra matar.
   */
  const porOrdemItem = new Map<string, Map<string, { sep: number; con: number; dev: number }>>()
  if (ordens.length) {
    const ids = ordens.map((o) => o.id)
    const movs = await db.stockMovement.findMany({ where: { receiptId: { in: ids }, tipo: { in: TIPOS_ORDEM } }, select: { receiptId: true, itemId: true, tipo: true, quantidade: true } })
    // agrupa por ordem+item: {sep, con, dev}
    for (const m of movs) {
      const oi = porOrdemItem.get(m.receiptId!) ?? new Map()
      const cur = oi.get(m.itemId) ?? { sep: 0, con: 0, dev: 0 }
      const abs = Math.abs(m.quantidade)
      if (m.tipo === 'SEPARACAO_SAIDA') cur.sep += abs
      else if (m.tipo === 'PRODUCAO_CONSUMO') cur.con += abs
      else cur.dev += abs
      oi.set(m.itemId, cur); porOrdemItem.set(m.receiptId!, oi)
    }

    // ⭐ fonte única do em-produção (a mesma que a tela usa)
    const emProducao = emProducaoPorOrdem(movs as never)

    for (const o of ordens) {
      const itens = porOrdemItem.get(o.id)
      // P1 — ordem CONCLUIDA: Σ|SEPARACAO| == Σ|CONSUMO| + Σ|DEVOLUCAO| por item
      if (o.estado === 'CONCLUIDA' && itens) {
        for (const [itemId, v] of itens) {
          if (Math.abs(round2(v.sep) - round2(v.con + v.dev)) > 0.01) {
            F('P1', o.companyId, `ordem ${o.id} item ${itemId}: separado ${round2(v.sep)} ≠ consumido ${round2(v.con)} + devolvido ${round2(v.dev)} (algo evaporou entre a câmara e a panela).`)
          }
        }
      }
      // P4 — ordem ENCERRADA com em-produção sobrando (vazamento)
      // ⭐ A CONTA SAIU DAQUI (01/09): `sep − con − dev` estava escrita inline e também em
      // `separadoPorItem`. Agora as duas — e o card "Em produção" do painel — leem
      // `emProducaoPorOrdem`. O juiz e a tela não têm como discordar sobre o que está
      // parado na produção.
      if ((o.estado === 'CONCLUIDA' || o.estado === 'CANCELADA')) {
        for (const [itemId, emProd] of emProducao.get(o.id) ?? new Map<string, number>()) {
          if (emProd > 0.01) F('P4', o.companyId, `ordem ${o.id} (${o.estado}) tem ${emProd} do item ${itemId} preso em-produção — não devolvido nem consumido.`)
        }
      }
      /**
       * P2 — ordem em aberto parada > 24h no mesmo estado.
       *
       * ⛔⛔ **DESCANSO INTENCIONAL NÃO É ATRASO (15/09):** desde que a etapa pode ter DIA
       * PRÓPRIO, um lote que dorme (massa que descansa, molho que apura) fica legitimamente
       * parado — e o alarme gritaria **toda noite** sobre uma receita funcionando.
       * *Alarme falso repetido é como um alarme morre* (a lição dos 111 de vendas).
       *
       * ⚠️ E a exceção é ESTREITA: só cala quando existe etapa **planejada pra hoje ou pra
       * frente**. Lote esquecido com o plano VENCIDO continua vermelho — que é o caso que o
       * P2 existe pra pegar.
       */
      if (['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO'].includes(o.estado)) {
        const horas = (now.getTime() - o.atualizadoEm.getTime()) / 3600_000
        if (horas > 24 && !descansoPlanejado.has(o.id)) F('P2', o.companyId, `ordem ${o.id} está ${o.estado} há ${Math.floor(horas)}h sem avançar.`)
      }
    }
  }

  /**
   * ⭐⭐⭐ P8 — A EFICIÊNCIA CAIU (item 2 da decisão do dono, 03/10/2026).
   *
   * *"Aviso no juiz quando a eficiência cai (ex. <85%) — me DENUNCIA, não me corrige."*
   *
   * ⛔⛔ **ESTE INVARIANTE É A CONTRAPARTIDA DE TIRAR O RENDIMENTO DA SEPARAÇÃO.** Enquanto a
   * medição dividia o pedido, render mal **se autocorrigia em silêncio** (separava menos, a
   * conta "fechava", e o desvio virava a nova linha de base). Agora a separação é fixa pela
   * ficha, então render mal **sobra** — e sobrar é o ponto: alguém tem que ser avisado.
   *
   * ⚠️ **A RÉGUA É A FICHA, NUNCA A MÉDIA** — e é o que o separa do P3. Medir contra a média
   * pergunta *"você produziu como costuma produzir?"*, que sempre responde SIM porque a
   * referência anda junto com o desvio. O P8 pergunta *"você produziu o que a receita
   * prometia?"*, e a receita não anda.
   *
   * ⭐ Lê o valor **CONGELADO** na conclusão (`stock_producao_desvio.pctTeorico`), nunca um
   * recálculo: é o número que o operador viu, e recalcular faria o alarme nascer e morrer
   * sozinho conforme a média da ficha andasse. ⚠️ A coluna conserva o nome antigo porque
   * migration de estoque é CREATE-only.
   *
   * ⭐ **AVISO, não erro:** eficiência baixa é fato da operação, não defeito de dado. Deixar o
   * selo vermelho por causa dela faria o dono parar de ler o e-mail — a lição dos 111 alarmes
   * falsos do juiz de vendas.
   */
  const desviosP8 = await db.stockProducaoDesvio.findMany({
    select: { conclusaoId: true, companyId: true, pctTeorico: true },
  })
  /** conclusões que o P8 já denunciou — uma causa, um alarme (a régua do N1/N3 do juiz de infra) */
  const denunciadasPeloP8 = new Set<string>()
  for (const d of desviosP8) {
    if (d.pctTeorico == null || !(d.pctTeorico > 0)) continue
    if (d.pctTeorico >= EFICIENCIA_MINIMA) continue
    denunciadasPeloP8.add(d.conclusaoId)
    F(
      'P8',
      d.companyId,
      `conclusão ${d.conclusaoId}: saiu ${Math.round(d.pctTeorico * 100)}% do que a receita promete ` +
        `(abaixo de ${Math.round(EFICIENCIA_MINIMA * 100)}%) — o material consumido dava pra mais. ` +
        `Confira a operação, a sobra não contada, ou mude a ficha se a perda é real.`,
      'aviso',
    )
  }

  // P3 — rendimento do lote fora de ±25% da média (desvio grave não revisado)
  const conclusoes = await db.stockProducaoConclusao.findMany({ select: { id: true, companyId: true, ordemId: true, rendimento: true } })
  const fichaDaOrdem = new Map(ordens.map((o) => [o.id, o.fichaId]))
  for (const c of conclusoes) {
    const fichaId = fichaDaOrdem.get(c.ordemId)
    if (!fichaId) continue
    // ⚠️ o P8 já apontou este lote contra a FICHA; repetir "desvia da sua média" aqui seria o
    // mesmo problema contado duas vezes, e é assim que o e-mail vira ruído.
    if (denunciadasPeloP8.has(c.id)) continue
    const media = await rendimentoMedioDaFicha(c.companyId, fichaId, db as PrismaClient, c.id)
    if (media && media > 0) {
      const desvio = Math.abs((c.rendimento - media) / media)
      if (desvio > DESVIO_GRAVE) F('P3', c.companyId, `conclusão ${c.id}: rendimento ${round2(c.rendimento)} desvia ${Math.round(desvio * 100)}% da média ${round2(media)} — revisar (carne ruim? porção errada? sobra não contada?).`)
    }
  }

  /**
   * ⭐⭐ M2 — PLAUSIBILIDADE DA DOSE (item 2b do sprint do motor, 02/10/2026).
   *
   * *"dose efetiva (consumo ÷ unidades produzidas) fora de ±20% da ficha = aviso nomeado;
   * pega ficha errada E motor errado, os dois lados."*
   *
   * ⚠️ É a **terceira** pergunta desta família, e não se confunde com as outras duas: o P1 é
   * contábil (nada evapora), o P3 olha o RENDIMENTO do lote contra a história da própria
   * ficha, e o M2 olha **quanto de CADA componente entrou em cada unidade que saiu**. Era a
   * pergunta que a perícia do acém respondeu à mão — e que ninguém faria de novo sozinho.
   *
   * ⭐ E o aviso diz a ASSINATURA: razão igual em todos os componentes = ESCALA (um problema,
   * não N); razão só num = dose/versão da ficha. Sem isso, três avisos de 21% na mesma ordem
   * mandariam o dono conferir três fichas que estão certas.
   */
  const conclusoesM2 = await db.stockProducaoConclusao.findMany({
    select: { id: true, companyId: true, ordemId: true },
  })
  for (const c of conclusoesM2) {
    const fichaId = fichaDaOrdem.get(c.ordemId)
    const itens = porOrdemItem.get(c.ordemId)
    if (!fichaId || !itens) continue
    const ordem = ordens.find((o) => o.id === c.ordemId)
    if (!ordem) continue
    // ⚠️ a dose tem que vir da VERSÃO QUE A ORDEM USOU (snapshot), nunca da vigente: a ficha
    // pode ter sido editada depois, e aí o aviso acusaria uma mudança de receita legítima.
    const versao = await db.stockFichaVersao.findFirst({
      where: { companyId: c.companyId, fichaId, versao: ordem.versaoFicha },
      select: { id: true },
    })
    if (!versao) continue
    const comps = await db.stockFichaComponente.findMany({
      where: { companyId: c.companyId, versaoId: versao.id },
      select: { itemId: true, qtdPlanejada: true },
    })
    if (!comps.length) continue
    const doses = comps.map((cp) => ({
      itemId: cp.itemId,
      doseDaFicha: cp.qtdPlanejada,
      consumido: itens.get(cp.itemId)?.con ?? 0,
    }))
    /**
     * ⭐ O DENOMINADOR É A ESCALA DA ORDEM (o PLANO), não as unidades produzidas nem a
     * `escalaConsumida` da conclusão. A 1ª versão dividia por `qtdGerada` e media o
     * RENDIMENTO (107 falsos em prod, a pergunta que o P3 já faz); a `escalaConsumida` é
     * derivada do próprio consumo e daria 1,000 sempre — invariante circular.
     */
    const suspeitas = dosesSuspeitas(doses, ordem.escalaReceitas)
    if (!suspeitas.length) continue
    const assinatura = assinaturaDoDesvio(suspeitas, comps.length)
    const lista = suspeitas
      .slice(0, 3)
      .map((s) => `${s.itemId}: ficha ${round4(s.doseDaFicha)} × efetiva ${round4(s.doseEfetiva)} (${s.lado === 'ACIMA' ? '+' : '−'}${Math.round(Math.abs(s.razao - 1) * 100)}%)`)
    const pista =
      assinatura === 'ESCALA'
        ? ' · ⭐ TODOS os componentes desviam na MESMA proporção = assinatura de ESCALA (o rendimento do lote), não das doses'
        : ' · a razão aparece em componente isolado = conferir a DOSE / a versão da ficha'
    F(
      'M2',
      c.companyId,
      `conclusão ${c.id}: a dose efetiva POR LOTE (consumo ÷ escala da ordem) saiu de ±${Math.round(DESVIO_DA_DOSE * 100)}% da ficha — ${lista.join(' · ')}${pista}`,
      'aviso',
    )
  }

  // P5 — PRODUTO_FINAL ativo com valorVenda nulo há > 14 dias (cobra o "a definir")
  const semPreco = await db.stockFicha.findMany({ where: { tipoProduto: 'PRODUTO_FINAL', ativo: true, valorVenda: null }, select: { id: true, companyId: true, criadoEm: true } })
  for (const f of semPreco) {
    if ((now.getTime() - f.criadoEm.getTime()) / 86_400_000 > P5_DIAS) F('P5', f.companyId, `ficha ${f.id} (produto final) está sem preço de venda há > ${P5_DIAS} dias — defina no cardápio.`)
  }

  // P6 — ficha com componente sem custo há > 7 dias
  const fichasAtivas = await db.stockFicha.findMany({ where: { ativo: true }, select: { id: true, companyId: true, versaoAtual: true, atualizadoEm: true } })
  for (const f of fichasAtivas) {
    if ((now.getTime() - f.atualizadoEm.getTime()) / 86_400_000 <= P6_DIAS) continue
    const versao = await db.stockFichaVersao.findFirst({ where: { companyId: f.companyId, fichaId: f.id, versao: f.versaoAtual }, select: { id: true } })
    if (!versao) continue
    const comps = await db.stockFichaComponente.findMany({ where: { companyId: f.companyId, versaoId: versao.id }, select: { itemId: true } })
    if (!comps.length) continue
    // componente sem custo = item sem nenhum movimento ENTRADA_NF
    const semCusto = await db.stockMovement.groupBy({ by: ['itemId'], where: { companyId: f.companyId, itemId: { in: comps.map((c) => c.itemId) }, tipo: 'ENTRADA_NF' }, _count: { _all: true } })
    const comCusto = new Set(semCusto.map((g) => g.itemId))
    const faltando = comps.filter((c) => !comCusto.has(c.itemId)).length
    if (faltando > 0) F('P6', f.companyId, `ficha ${f.id}: ${faltando} componente(s) sem custo (sem nota) há > ${P6_DIAS} dias — o custo teórico fica "a definir".`)
  }

  return fails
}
