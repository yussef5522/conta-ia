// ⭐⭐ A CAIXA DE ENTRADA DO BANCO — a lista das duas abas (15/09/2026).
//
// ⛔ **UMA LINHA, UMA ESTAÇÃO:** o payload devolve os contadores das TRÊS (saídas, entradas,
// arquivo) e o total, porque o invariante `saídas + entradas + arquivo == total` só é
// verificável se ele estiver **na tela**. Número que fecha por fora é promessa.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { estacaoDaLinha, comoFoiResolvida, sentidoDaLinha, acoesDoSentido } from '@/lib/conciliacao/caixa-de-entrada'
/**
 * ⭐ A CONSULTA NÃO MORA MAIS AQUI (faxina de 15/09) — ela é de `leitura-da-caixa`, a MESMA
 * que o **badge do menu** chama. Rota e badge lendo o mesmo recorte é o que impede o menu
 * de dizer um número e a tela mostrar outro (o defeito de 10/09).
 */
import { lerCaixa, paraLei } from '@/lib/conciliacao/leitura-da-caixa'
import { progressoDoMes } from '@/lib/conciliacao/palpite-da-linha'
/**
 * ⭐ O PALPITE do cartão ≍ (mock v3). ⚠️ Ele NÃO tem matcher próprio: chama os motores
 * provados (`resolvePaidInvoiceMonth`, `sugerirVinculoEmprestimo`, `sugerirVinculos`) e
 * só ESCOLHE entre o que eles devolveram. É fail-soft: sem palpite, a linha aparece com
 * os chips de sempre — a caixa de ontem, que funciona.
 */
import { palpitesDaCaixa } from '@/lib/conciliacao/palpites-da-caixa'
import { ancoraDoPar } from '@/lib/conciliacao/uma-casa-por-caso'
import { lotesDaFila } from '@/lib/conciliacao/fila-de-conciliacao'
import { cardsDeEscolha } from '@/lib/conciliacao/cards-de-escolha'
import { contadoresDaLista, linhasDaLista, type CasoNaLinha } from '@/lib/conciliacao/lista-unica'
import { divisaoDaTela } from '@/lib/conciliacao/divisao-da-tela'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const empresaId = url.searchParams.get('empresaId') ?? ''
  /**
   * ⭐⭐⭐ O DEEP-LINK SOBREVIVE À LISTA ÚNICA (23/09) — e ele quase morreu aqui.
   *
   * ⛔ Com as seções mortas, o `?abrir=` continuava sendo LIDO pela página e alimentava um
   * bloco que não existe mais: a linha apontada **não entrava em lugar nenhum**. É a
   * ***porta pintada na parede*** de 13/09 de volta, agora por dentro.
   *
   * ⭐ Agora ele entra na LISTA: `cardsDeEscolha` monta o card daquela linha mesmo que ela
   * não esteja na fila, e a régua `caixa ∪ caso aberto` a carrega.
   */
  const abrir = url.searchParams.get('abrir') ?? undefined
  const conta = url.searchParams.get('conta') ?? undefined
  const ctx = await getAuthContext(request, empresaId)
  if (!ctx) return NextResponse.json({ erro: 'Sessão expirada ou não autenticado' }, { status: 401 })
  if (!ctx.permissions.some((k) => k === '*' || k === 'transaction.view')) {
    return NextResponse.json({ erro: 'Sem permissão.', permission: 'transaction.view' }, { status: 403 })
  }

  const { rows, contadores, nomeConta, corte } = await lerCaixa(empresaId)

  // ⚠️ só as linhas que ESTÃO na caixa ganham palpite — palpitar sobre o arquivo é
  // trabalho (e consulta) pra quem já está resolvido.
  const naCaixa = rows.filter((r) => estacaoDaLinha(paraLei(r)) === 'CAIXA')
  const naCaixaIds = new Set(naCaixa.map((r) => r.id))
  const palpites = await palpitesDaCaixa(empresaId, naCaixa).catch(() => new Map())

  /**
   * ⭐⭐ A CATEGORIA DA CONTA CASADA — pra o seletor da esquerda DIZER *"herda da conta: X"*
   * em vez de pedir uma escolha que o reconcile vai descartar (ele faz backfill da conta).
   *
   * ⛔ E quando a conta **não tem**, a tela mostra *"a conta casada não tem categoria —
   * escolha"* — a mesma recusa que o servidor daria no clique (`PEDE_CATEGORIA`), só que
   * **antes** dele. *Descobrir no confirmar o que dava pra dizer no cartão é fazer o dono
   * clicar pra levar um não.*
   */
  const alvosDeCasar = [...palpites.values()].flatMap((p: { alvo?: Record<string, unknown> }) => {
    const a = p?.alvo ?? {}
    if (Array.isArray(a.contaIds)) return a.contaIds as string[]
    return typeof a.contaId === 'string' ? [a.contaId] : []
  })
  const catDaConta = new Map<string, string | null>()
  if (alvosDeCasar.length) {
    const contas = await prisma.transaction.findMany({
      where: { id: { in: alvosDeCasar } },
      select: { id: true, category: { select: { name: true } } },
    })
    for (const c of contas) catDaConta.set(c.id, c.category?.name ?? null)
  }
  /** ⚠️ a 1ª conta do palpite basta: o seletor fala do gesto, não de cada nota do lote */
  const categoriaDoAlvo = (p: { alvo?: Record<string, unknown> } | null | undefined) => {
    const a = p?.alvo ?? {}
    const id = Array.isArray(a.contaIds) ? (a.contaIds as string[])[0] : typeof a.contaId === 'string' ? a.contaId : null
    return id ? catDaConta.get(id) ?? null : null
  }

  /**
   * ⭐⭐⭐ UMA PERGUNTA, UMA CASA (20/09) — a mesma régua que os cards consultam.
   *
   * ⛔ Sem ela, a linha aparecia na caixa **com palpite e botão** e o MESMO par aparecia
   * embaixo como card, **com botões próprios**. Duas superfícies decidindo o mesmo par é a
   * família do caso Cancian: o desenho certo é **nem criar a disputa visual**.
   */
  /**
   * ⭐⭐⭐ UMA PERGUNTA, UMA CASA (20/09) — **a mesma porta que a fila e os cards chamam.**
   *
   * ⛔ A 1ª versão tinha régua PRÓPRIA aqui (contava linhas na caixa) e a fila tinha a dela
   * (conta candidatas incluindo categorizadas). **As duas divergiram no franciele e o dono
   * viu botão nos dois lados.** Agora a divisão vem de um lugar só.
   */
  const divisao = await divisaoDaTela(empresaId, prisma)

  /**
   * ⭐⭐⭐ UMA LISTA SÓ (23/09) — o LOTE e a ESCOLHA deixam de ser seções e viram CASO da
   * linha. A página parava de perguntar *"o que esta linha é?"* em três lugares.
   *
   * ⚠️ Fail-soft nos dois: se uma fonte cair, a lista continua (sem aquele caso) em vez de
   * a tela inteira sumir. *Some dos dois é pior que aparecer nos dois.*
   */
  const [lotes, cardsEscolha] = await Promise.all([
    lotesDaFila(empresaId, prisma).then((r) => r.lotes).catch(() => []),
    cardsDeEscolha({ empresaId, abrir, conta }, prisma).catch(() => []),
  ])
  const lotePorLinha = new Map(lotes.map((l) => [l.extratoId, l]))
  const escolhaPorLinha = new Map(cardsEscolha.map((c) => [c.linha.id, c]))

  /**
   * ⭐⭐⭐ O CASO VAI **DENTRO DO CARTÃO ≍** (20/09) — régua do dono: *"uma decisão aparece
   * UMA vez na página, SEMPRE no mesmo modelo visual"*.
   *
   * ⛔ Antes ele virava seção separada embaixo (a FILA, com visual próprio), e o dono via
   * *"a mesma coisa duas vezes, em dois MODELOS visuais diferentes"*. Aqui as candidatas
   * viajam junto da linha pra o lado direito do cartão renderizá-las no lugar do palpite.
   */
  const idsDasCandidatas = [...new Set([...divisao.casos.values()].flatMap((c) => c.linhaIds))]
  const dadosDaCandidata = new Map(
    (idsDasCandidatas.length
      ? await prisma.transaction.findMany({
          where: { id: { in: idsDasCandidatas } },
          select: { id: true, description: true, amount: true, date: true, category: { select: { name: true } } },
        })
      : []).map((t) => [t.id, t]),
  )
  const contasDoCaso = new Map(
    (divisao.casos.size
      ? await prisma.transaction.findMany({
          where: { id: { in: [...divisao.casos.keys()] } },
          select: { id: true, description: true, amount: true, dueDate: true, date: true },
        })
      : []).map((t) => [t.id, t]),
  )

  /**
   * ⭐⭐ QUAL CASO ESTA LINHA TEM — a decisão num lugar só.
   *
   * ⚠️ Ela responde pela lista INTEIRA (inclusive pela linha que só está aqui por ter
   * caso), então a ordem é do mais específico pro mais genérico.
   */
  function casoDaLinha(id: string): { tipo: string; hospeda: boolean; nome?: string; ancora?: string } | null {
    // ⭐ LOTE: um pagamento que liquida N notas — a linha É a anfitriã, por construção
    const lo = lotePorLinha.get(id)
    if (lo) return { tipo: 'LOTE', hospeda: true, nome: lo.fornecedorNome }
    // ⭐ ESCOLHA: o card de "pra tua mão" (N:M / não fecha) vira o caso desta linha
    const es = escolhaPorLinha.get(id)
    if (es) return { tipo: 'ESCOLHA', hospeda: true, nome: es.fornecedorNome }
    // ⭐ e o ambíguo/N:M de sempre, com o ponteiro pra anfitriã
    const c = montarCaso(divisao.linhas.get(id))
    return c ? { ...c, tipo: c.tipo === 'N_PARA_M' ? 'ESCOLHA' : 'AMBIGUO' } as never : null
  }

  /** ⭐ o painel que o lado direito do cartão desenha — ou o ponteiro pra quem hospeda */
  function montarCaso(c: ReturnType<typeof divisao.linhas.get>) {
    if (!c?.contaDoCaso) return null
    const s = divisao.casos.get(c.contaDoCaso)
    const conta = contasDoCaso.get(c.contaDoCaso)
    if (!s || !conta) return null
    if (!c.hospeda) {
      // ⛔ mesma decisão, mesma página: a 2ª linha do caso APONTA, não repete o painel
      return { tipo: c.motivo ?? 'AMBIGUO', hospeda: false as const,
        ancora: ancoraDoPar(c.contaDoCaso), nome: s.nomeDaConta }
    }
    return {
      tipo: c.motivo ?? 'AMBIGUO',
      hospeda: true as const,
      ancora: ancoraDoPar(c.contaDoCaso),
      nome: s.nomeDaConta,
      conta: {
        id: conta.id, descricao: (conta.description ?? '').trim() || '(sem descrição)',
        valor: Math.abs(conta.amount),
        vencimento: (conta.dueDate ?? conta.date).toISOString().slice(0, 10),
      },
      candidatas: s.linhaIds.map((id) => {
        const t = dadosDaCandidata.get(id)
        return {
          id,
          descricao: (t?.description ?? '').trim() || '(sem descrição)',
          valor: t ? Math.abs(t.amount) : 0,
          data: t ? t.date.toISOString().slice(0, 10) : '',
          categoria: t?.category?.name ?? null,
          diferenca: t ? Math.round((Math.abs(t.amount) - Math.abs(conta.amount)) * 100) / 100 : 0,
        }
      }),
    }
  }

  const linhas = rows.map((r) => {
    const l = paraLei(r)
    return {
      id: r.id, tipo: r.type, valor: r.amount, data: r.date.toISOString().slice(0, 10),
      descricao: r.description ?? '', contraparte: r.counterpartyName,
      conta: nomeConta.get(r.bankAccountId ?? '') ?? null,
      sentido: sentidoDaLinha(r.type),
      estacao: estacaoDaLinha(l),
      // ⭐ o selo do ARQUIVO diz COMO foi resolvida — nunca um "ok" genérico
      resolvidaComo: comoFoiResolvida(l),
      acoes: estacaoDaLinha(l) === 'CAIXA' ? acoesDoSentido(sentidoDaLinha(r.type)) : [],
      palpite: palpites.get(r.id) ?? null,
      /** ⭐ o que o seletor da esquerda mostra quando o palpite é CASAR */
      categoriaDaConta: categoriaDoAlvo(palpites.get(r.id)),
      /**
       * ⭐ quando o caso mora no CARD, a linha perde o botão e ganha o CAMINHO.
       * ⛔ Nunca as duas com botão — e nunca a linha muda sem dizer pra onde ir.
       */
      /**
       * ⛔⛔ **AQUI EU ERREI DE NOVO, e a prova na página pegou:** esta linha testava
       * `casa === 'CARD'` e o ambíguo passou a morar em **`FILA`** — então o `casoNoCard`
       * vinha `null` e **o botão voltava**. *Meu guard exercitava o predicado da lib e a
       * ROTA não o usava* — a lição "guard que testa a lib aprova a tela que a ignora".
       *
       * ⭐ Agora quem decide é o predicado: a caixa desenha botão **só** quando é a dona.
       */
      /**
       * ⭐ O PAINEL DO CASO — só na linha que HOSPEDA. As outras do mesmo caso apontam
       * pra ela ("parte do caso acima ↑"), nunca desenham o painel de novo.
       */
      /**
       * ⭐⭐⭐ UMA LISTA SÓ (23/09) — o caso de QUALQUER família renderiza aqui dentro.
       *
       * ⛔ A ordem importa e não é estética: **lote** e **escolha** vêm antes do ambíguo
       * porque são mais específicos — uma linha que é anfitriã de um lote fechado não deve
       * cair no painel genérico. E só UM painel por linha: dois seria a duplicação de
       * volta, agora dentro do mesmo cartão.
       */
      caso: casoDaLinha(r.id),
      /** ⚠️ o painel do LOTE precisa do lote inteiro (as N notas + a soma) */
      lote: lotePorLinha.get(r.id) ?? null,
      /** ⚠️ o painel da ESCOLHA precisa das candidatas do fornecedor */
      escolha: escolhaPorLinha.get(r.id) ?? null,
    }
  })

  /**
   * ⭐⭐ A LISTA QUE A TELA DESENHA — a régua é PURA (`linhasDaLista`) e tem teste próprio.
   *
   * ⛔ Ela não mora aqui: a rota só junta as duas entradas (quem está na caixa, quem tem
   * caso) e pergunta. Régua dentro de rota é régua que ninguém consegue provar.
   */
  const casos = new Map(linhas.flatMap((l) => (l.caso ? [[l.id, l.caso as CasoNaLinha]] : [])))
  const daLista = new Set(linhasDaLista(linhas, naCaixaIds, casos).map((x) => x.id))
  const soPeloCaso = new Set(
    linhasDaLista(linhas, naCaixaIds, casos).filter((x) => x.soPeloCaso).map((x) => x.id),
  )
  const paraTela = linhas
    .filter((l) => daLista.has(l.id))
    // ⭐ marcada: sem isto, uma linha já categorizada aparecendo do nada parece defeito
    .map((l) => ({ ...l, soPeloCaso: soPeloCaso.has(l.id) }))

  return NextResponse.json({
    contadores,
    /** ⭐ o anel do mês sai dos MESMOS contadores — nunca de uma consulta própria */
    progresso: progressoDoMes(contadores),
    /** a tela DIZ de quando ela conta: fila que mostra menos precisa dizer por quê */
    corte: corte ? corte.toISOString().slice(0, 10) : null,
    /**
     * ⭐⭐⭐ A LISTA ÚNICA (23/09) — **caixa ∪ caso aberto**, e a régua mora na lib.
     *
     * ⚠️⚠️ A linha que entra **só pelo caso** já está CATEGORIZADA (estação ARQUIVO): são
     * os 14 cards de *"pra tua mão"* medidos em prod. ⛔ Filtrar só por `estacao==='CAIXA'`
     * — o que esta linha fazia — os faria **sumir** junto com as seções, perdendo
     * R$ 2.120,81 · 2.275,05 · 3.510,78 … de trabalho real. *Categoria não quita conta.*
     */
    linhas: paraTela,
    /** ⭐ os contadores saem da MESMA lista — contador ≠ lista é o badge de 10/09 de novo */
    filtros: contadoresDaLista(paraTela.map((l) => ({ caso: l.caso as CasoNaLinha | null }))),
  })
}
