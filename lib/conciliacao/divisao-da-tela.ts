// ⭐⭐⭐ A DIVISÃO DA TELA — UMA PORTA, AS TRÊS SUPERFÍCIES (20/09/2026).
//
// **O defeito que isto mata, nas palavras do dono:** *"cada lado acha que é o dono e os DOIS
// mostram botão."*
//
// ⛔⛔ A página `/conciliacao` faz **quatro** chamadas — `/caixa`, `/fila`,
// `/escolher-na-mao` e `/corte` — e **três delas desenham botão**. Ligar a régua em duas
// deixou a terceira decidindo sozinha: a `/fila` continuou oferecendo `[Vincular]` pro mesmo
// par que a caixa já mostrava com palpite.
//
// ⭐ Aqui as **duas fontes** são lidas e a divisão sai de uma função só. As rotas chamam
// **esta** porta — não têm como montar entrada diferente, então não têm como divergir.
//
// ⚠️ **CUSTO MEDIDO (prod, Caçula):** `contasEsperandoPagamento` **229 ms** ·
// `lerCaixa`+`palpitesDaCaixa` **149 ms**. Cada rota passa a pagar os dois (~380 ms). É a
// régua do dono sobre isto, de 11/09: ***"performance se resolve com cache, nunca com número
// errado"*** — e um número errado aqui é botão em duas telas pro mesmo dinheiro.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { contasEsperandoPagamento } from './fila-de-conciliacao'
import { lerCaixa, paraLei } from './leitura-da-caixa'
import { palpitesDaCaixa } from './palpites-da-caixa'
import { estacaoDaLinha } from './caixa-de-entrada'
import { dividir, type Divisao } from './uma-casa-por-caso'

/**
 * ⭐⭐ A DIVISÃO QUE AS TRÊS SUPERFÍCIES OBEDECEM.
 *
 * ⛔ Fail-soft de propósito: se uma das fontes falhar, a divisão volta VAZIA — e vazio aqui
 * significa *"ninguém reivindica nada"*, ou seja **cada superfície segue como antes**. É
 * preferível a duplicação de um par a uma tela que esconde trabalho por causa de um erro de
 * leitura. *Some dos dois é pior que aparecer nos dois.*
 */
export async function divisaoDaTela(
  companyId: string,
  db: PrismaClient = defaultPrisma,
): Promise<Divisao> {
  try {
    const [contas, caixa] = await Promise.all([
      contasEsperandoPagamento(companyId, db),
      lerCaixa(companyId, db),
    ])
    const naCaixa = caixa.rows.filter((r) => estacaoDaLinha(paraLei(r)) === 'CAIXA')
    const palpites = await palpitesDaCaixa(companyId, naCaixa).catch(() => new Map())

    return dividir({
      // ⭐ a fonte dos `[Vincular]` — a MESMA lista que a fila desenha
      sugestoesPorConta: contas
        .filter((c) => c.sugestoes.length > 0)
        .map((c) => ({
          contaId: c.conta.id,
          nomeDaConta: (c.conta.descricao ?? '').trim() || 'esta conta',
          linhaIds: [...new Set(c.sugestoes.map((s) => s.extratoId))],
        })),
      // ⭐ a fonte dos botões da caixa
      palpites: naCaixa.map((r) => {
        const p = palpites.get(r.id) as { alvo?: Record<string, unknown>; titulo?: string } | undefined
        const a = p?.alvo ?? {}
        const contaIds = Array.isArray(a.contaIds)
          ? (a.contaIds as string[])
          : typeof a.contaId === 'string' ? [a.contaId] : []
        return { linhaId: r.id, contaIds, nomeDoCaso: p?.titulo?.trim() || (r.description ?? 'este pagamento') }
      }),
    })
  } catch {
    return { linhas: new Map(), contasQueMoramNaCaixa: new Set(), casos: new Map(), anfitriaDoCaso: new Map() }
  }
}
