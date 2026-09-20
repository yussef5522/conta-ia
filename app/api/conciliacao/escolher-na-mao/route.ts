// GET /api/conciliacao/escolher-na-mao?empresaId=…
//
// ⭐ OS CARDS do Find & Match: cada linha do extrato que NOMEIA um fornecedor e não fecha
// na soma, contra as notas abertas dele.
//
// ⛔⛔ **DEVOLVE A LISTA INTEIRA, e essa é a correção de 10/09/2026.**
//
// A primeira versão carregava UMA linha por vez, sob demanda (`?extratoId=`). Na tela isso
// virou **porta sem maçaneta**: a seção nascia colapsada, o dono precisava (1) expandir,
// (2) clicar "escolher na mão" numa linha, e o card aparecia no RODAPÉ da página, longe do
// clique. Ele abriu `/conciliacao` e disse: *"continua a mensagem antiga… sem os cards
// novos"*. **A seção dos que não fecham VIRA os cards.**
//
// ⚠️ E o modo de uma-linha-só saiu junto: sem chamador, ele seria o campo decorativo que
// esta casa já pagou caro no `registry.parse` (existia, ninguém chamava, e o bug ficou
// invisível por semanas).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { fornecedoresDaEmpresa, lotesDaFila } from '@/lib/conciliacao/fila-de-conciliacao'
import { reconhecerFornecedorComIrmaos, canonizadorDeFornecedor } from '@/lib/conciliacao/sugestao-de-vinculo'
import { montarCardDeEscolha, linhasCandidatasDaConta, identidadeDoCard } from '@/lib/conciliacao/escolher-na-mao'
import { dividirPorCasa } from '@/lib/conciliacao/uma-casa-por-caso'
import { lerCaixa, paraLei } from '@/lib/conciliacao/leitura-da-caixa'
import { palpitesDaCaixa } from '@/lib/conciliacao/palpites-da-caixa'
import { estacaoDaLinha } from '@/lib/conciliacao/caixa-de-entrada'
import { jaPagoPorConta } from '@/lib/conciliacao/aplicar-baixa-parcial'

const querySchema = z.object({
  empresaId: z.string().cuid(),
  /**
   * ⭐⭐ A PORTA DOS DOIS LADOS precisa montar o card de UMA LINHA QUALQUER (10/09/2026).
   *
   * ⛔ A fila só lista o que o motor de LOTE marcou como "não fecha", e o lote exige
   * 2+ notas. Fornecedor com UMA nota aberta (Oesa depois de conciliar uma, Focatto)
   * **não entra na fila** — e sem isto o "Casar com conta a pagar…" abriria a tela sem
   * card nenhum, que é a porta sem maçaneta de novo, agora do outro lado.
   *
   * ⚠️ É o MESMO `montarCardDeEscolha` — o card continua morando num lugar só.
   */
  abrir: z.string().cuid().optional(),
  /**
   * ⭐⭐ A PORTA DO OUTRO LADO (13/09): veio do "procurar no extrato" de uma CONTA A PAGAR.
   *
   * ⚠️ Aqui o alvo não é uma linha — é uma NOTA. A rota resolve as linhas candidatas
   * dela (mesmo fornecedor, ou as compatíveis por valor quando não há fornecedor) e as
   * trata como se tivessem vindo pelo `abrir=`. Sem isto, o dono clicava na conta da
   * `isabel camera fria` e caía numa tela sem card nenhum dela.
   */
  conta: z.string().cuid().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))
    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    const fila = await lotesDaFila(data.empresaId, prisma)

    /**
     * ⭐ `conta=` → as LINHAS candidatas daquela conta a pagar.
     *
     * ⛔ Usa o MESMO `LINHA_DISPONIVEL_WHERE` da fila (dinheiro que já tem dono não pode
     * ser oferecido de novo) e a MESMA janela de ±15 dias, com a régua de valor do gesto
     * manual. **Não é um segundo matcher** — é o recorte que traz as candidatas pra o card
     * que já existe montar a escolha.
     */
    const porConta = data.conta ? await linhasCandidatasDaConta(data.empresaId, data.conta) : []

    const ids = [...new Set([
      ...fila.naoFecham.map((x) => x.extratoId),
      ...(data.abrir ? [data.abrir] : []),
      ...porConta,
    ])]
    if (!ids.length) return NextResponse.json({ cards: [] })

    const fornecedores = await fornecedoresDaEmpresa(prisma, data.empresaId)

    const linhas = await prisma.transaction.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, description: true, amount: true, date: true, supplierId: true,
        bankAccount: { select: { name: true, companyId: true } },
        category: { select: { name: true } },
      },
    })
    // ⛔ REGRA 8: a linha tem que ser DESTA empresa — resolvida pelo dono da conta bancária
    const daEmpresa = linhas.filter((l) => l.bankAccount?.companyId === data.empresaId)

    // ⭐ UMA query pras notas de TODOS os fornecedores envolvidos — nunca uma por card.
    // ⚠️ N cards × 1 query cada é o padrão que já custou 9,6 s nesta mesma tela.
    // ⭐ o fornecedor da linha E os IRMÃOS dele no cadastro: 11 fornecedores da Caçula
    // estão cadastrados 2×, e as contas podem estar em qualquer um dos registros.
    const canon = canonizadorDeFornecedor(fornecedores)
    const fornecedorDaLinha = new Map<string, string>()
    const irmaosDe = new Map<string, string[]>()
    for (const l of daEmpresa) {
      const achado = reconhecerFornecedorComIrmaos(l.description, fornecedores)
      const fid = canon(l.supplierId) ?? (achado ? canon(achado.fornecedor.id) : null)
      if (!fid) continue
      fornecedorDaLinha.set(l.id, fid)
      const ids = l.supplierId
        ? fornecedores.filter((f) => canon(f.id) === fid).map((f) => f.id)
        : (achado?.ids ?? [])
      irmaosDe.set(fid, ids.length ? ids : [fid])
    }
    const notasTodas = fornecedorDaLinha.size
      ? await prisma.transaction.findMany({
          where: {
            supplierId: { in: [...new Set([...irmaosDe.values()].flat())] },
            lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] },
            status: 'PENDING',
            paymentDate: null,
            reconciledWithId: null,
            reconciledFrom: { none: {} },
          },
          select: { id: true, description: true, amount: true, dueDate: true, date: true, supplierId: true },
          orderBy: { dueDate: 'asc' },
        })
      : []
    /**
     * ⭐⭐⭐ AS CONTAS SEM FORNECEDOR — só quando o dono ABRE a linha (13/09/2026).
     *
     * **Medido em prod:** 10 contas em aberto sem fornecedor (R$ 30.738,31) que **nenhum
     * card jamais alcançou**, porque o card nasce de um fornecedor reconhecido. São
     * `oesa 1.759,44`, `oficina 180`, `radio 109`, `aluguel caçula 5.234`… — lançadas à
     * mão, sem FK. É o débito de 10/09, nunca fechado.
     *
     * ⛔⛔ **SÓ PELA PORTA (`?abrir=`), NUNCA NA FILA.** A fila é o que o sistema OFERECE
     * sozinho, e sem nome dos dois lados não há âncora — sugerir ali seria o caça-níquel
     * que a régua de 09/09 recusou (9% de valores aleatórios fecham). Aqui o dono APONTOU
     * a linha; a resposta honesta é mostrar o que existe, sem marcar nada.
     */
    const semFornecedor = data.abrir || data.conta
      ? await prisma.transaction.findMany({
          where: {
            supplierId: null,
            lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] },
            status: 'PENDING',
            paymentDate: null,
            reconciledWithId: null,
            reconciledFrom: { none: {} },
            // ⛔ REGRA 8: multi-tenant pelo que a conta manual TEM (categoria/conta/pessoa)
            OR: [
              { category: { companyId: data.empresaId } },
              { bankAccount: { companyId: data.empresaId } },
              { employee: { companyId: data.empresaId } },
            ],
          },
          select: { id: true, description: true, amount: true, dueDate: true, date: true },
          orderBy: { dueDate: 'asc' },
        })
      : []

    const jaPago = await jaPagoPorConta([...notasTodas, ...semFornecedor].map((n) => n.id), prisma)

    const hoje = new Date()
    const cards = daEmpresa.flatMap((l) => {
      const fid = fornecedorDaLinha.get(l.id)
      /**
       * ⭐⭐ LINHA SEM FORNECEDOR RECONHECIDO TAMBÉM GANHA CARD — pela porta.
       *
       * Era aqui que MIXX PLAY e PJBANK morriam: `if (!fid) return []`. A linha que o
       * dono abriu de propósito não pode devolver tela vazia — **abrir a porta e não ter
       * nada atrás é a mesma "porta sem maçaneta" de cabeça pra baixo.**
       */
      const semFornDaLinha = (l.id === data.abrir || porConta.includes(l.id)) ? semFornecedor : []
      /**
       * ⛔⛔⛔ O CONTRATO DO `?abrir=` (13/09/2026) — ordem do dono:
       * *"`?abrir=<linha>` SEMPRE mostra o card daquela linha no topo; se ela não tem
       * candidata nenhuma, o card abre VAZIO dizendo isso. **Deep-link que abre a tela sem
       * o alvo é porta pintada na parede.**"*
       *
       * ⚠️ Era aqui que a porta morria em silêncio: sem fornecedor E sem conta manual
       * compatível, a linha simplesmente não virava card — e o dono, vindo dos Pendentes,
       * caía numa tela com "o Casper de sempre" e nada do que ele clicou.
       */
      const veioPelaPorta = l.id === data.abrir || porConta.includes(l.id)
      if (!fid && !semFornDaLinha.length && !veioPelaPorta) return []
      const dele = new Set(fid ? (irmaosDe.get(fid) ?? [fid]) : [])
      const doForn = fid ? notasTodas.filter((n) => n.supplierId && dele.has(n.supplierId)) : []
      if (!doForn.length && !semFornDaLinha.length && !veioPelaPorta) return []
      const forn = fid ? fornecedores.find((f) => f.id === fid) : null
      return [montarCardDeEscolha({
        linha: {
          id: l.id,
          descricao: l.description,
          valor: Math.abs(l.amount),
          data: l.date,
          conta: l.bankAccount?.name?.trim() ?? null,
          categoria: l.category?.name ?? null,
        },
        ...identidadeDoCard(fid ?? null, forn?.nomeFantasia ?? forn?.razaoSocial ?? null, { id: l.id, descricao: l.description }),
        notas: doForn.map((n) => ({
          id: n.id,
          descricao: n.description,
          valor: Math.abs(n.amount),
          vencimento: n.dueDate ?? n.date,
          jaPago: jaPago.get(n.id) ?? 0,
        })),
        hoje,
        semFornecedor: semFornDaLinha.map((n) => ({
          id: n.id,
          descricao: n.description,
          valor: Math.abs(n.amount),
          vencimento: n.dueDate ?? n.date,
          jaPago: jaPago.get(n.id) ?? 0,
        })),
      })]
    })
    // ⚠️ a mais ANTIGA primeiro — a ordem que o dono pediu no mock ("da mais antiga")
    cards.sort((a, b) => a.linha.data.getTime() - b.linha.data.getTime())

    /**
     * ⭐⭐⭐ UMA PERGUNTA, UMA CASA (20/09) — **o card não repete o par 1↔1 da caixa.**
     *
     * O dono viu a linha FRANCIELE na caixa **com palpite e botão** e o MESMO par aqui
     * embaixo **com botões próprios**. ⛔ *Duas superfícies com botão pro mesmo par é como
     * a nota errada do Cancian foi vinculada — o desenho certo é nem criar a disputa.*
     *
     * ⭐ A régua é a MESMA função que a caixa consulta (`dividirPorCasa`), com a MESMA
     * entrada (os palpites das linhas em aberto) — uma régua em cada rota divergiria no
     * primeiro caso de borda e o par voltaria a aparecer duas vezes.
     *
     * ⚠️ **Quem veio PELA PORTA (`?abrir=` / `?conta=`) nunca é escondido**: ali o dono
     * apontou a linha de propósito, e devolver tela vazia seria a porta pintada de novo.
     */
    const { rows } = await lerCaixa(data.empresaId, prisma)
    const naCaixa = rows.filter((r) => estacaoDaLinha(paraLei(r)) === 'CAIXA')
    const palpites = await palpitesDaCaixa(data.empresaId, naCaixa).catch(() => new Map())
    const casas = dividirPorCasa(naCaixa.map((r) => {
      const p = palpites.get(r.id) as { alvo?: Record<string, unknown>; titulo?: string } | undefined
      const a = p?.alvo ?? {}
      const contaIds = Array.isArray(a.contaIds)
        ? (a.contaIds as string[])
        : typeof a.contaId === 'string' ? [a.contaId] : []
      return { linhaId: r.id, contaIds, nomeDoCaso: p?.titulo?.trim() || (r.description ?? 'este pagamento') }
    }))
    const visiveis = cards.filter((c) =>
      c.linha.id === data.abrir || porConta.includes(c.linha.id) || casas.get(c.linha.id)?.casa !== 'CAIXA')

    return NextResponse.json({ cards: visiveis })
  } catch (error) {
    return handleApiError(error)
  }
}
