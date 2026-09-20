'use client'

// ⭐⭐ O TOPO DA CONCILIAÇÃO — os 3 stats do mock e MAIS NADA (10/09/2026).
//
// **O dono:** *"a conferência de contas SAI INTEIRA da tela. Conferência de saldo
// (bate/explicado/diverge) tem casa própria: o card da conta em BANCOS, que já mostra
// isso. Repetir na Conciliação é informação duplicada — e duplicado diverge, em tela como
// em código. A Conciliação cuida de VÍNCULOS (pagamento ↔ conta a pagar); saldo é assunto
// de Bancos."*
//
// ⭐ CONFERIDO ANTES DE APAGAR (a régua da casa: nada some sem ter onde morar): o selo
// vive em `/empresas/[id]/contas`, alimentado por `conferenciaDasContas` via
// `/api/contas-bancarias` — *"✓ conferido · ⚠ divergente em R$ X · ○ nunca conferida"*.
// O motor não foi tocado; o que saiu foi a **segunda vitrine** dele.
//
// ⚠️ E SAIU DO PAYLOAD TAMBÉM, não só da tela: dado que ninguém desenha é dado que alguém
// religa por descuido — e, no caminho, a fila parava pra calcular a conferência de todas
// as contas a cada carregamento.
//
// ⛔ O QUE JÁ TINHA SAÍDO DAQUI, e por quê (07/09): o cabeçalho afirmava *"69 prováveis
// duplicatas somando R$ 845.646,99"* com a aba dizendo **0**, e dois "saldos" que não
// eram saldo. A regra que ficou: *"o que dá pra derivar da MESMA fonte das abas, deriva;
// o que não tem definição honesta, sai — número sem régua em tela de dinheiro é pior que
// ausência."* Hoje a régua é a mesma: o topo só mostra as filas que a tela desenha.

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { StatsDoMock, type FilasDTO } from './stats-do-mock'
import { MOCK } from './mock-tokens'

export interface SemParDTO {
  total: number
  naoVenceram: number
  aguardandoExtrato: number
  comExtratoImportado: number
  ultimoExtrato: string | null
}
/** ⚠️ os totais das ABAS (o cabeçalho não usa; quem desenha é a página) */
export interface TotaisDTO {
  contas: number; comSugestao: number; lotes: number; notasEmLote: number
  transferencias: number; duplicatas: number
  duplaContagem: number; valorEmDuplaContagem: number
}

/**
 * ⭐⭐⭐ O TOPO ENXUGOU (20/09/2026) — ordem do dono.
 *
 * *"A linha «conciliando a partir de… mudar» + «104 em aberto sem par · Ver no Contas a
 * Pagar» SAI da posição atual (está estragando o topo). A FUNÇÃO não pode morrer: vão pra
 * um lugar discreto — ⚙️ pequeno ou uma linha miúda no RODAPÉ da seção."*
 *
 * ⛔ **REMOÇÃO SEM REALOCAÇÃO É PERDA** (a régua da conferência de saldo, 10/09): as duas
 * ofertas não sumiram — desceram pro `RodapeDaTela`, e os "sem pagamento" ganharam o
 * caminho natural que faltava: **o próprio card 💤 agora É o link**.
 */
export function CabecalhoDaFila({ filas, empresaId }: { filas: FilasDTO; empresaId: string }) {
  return <StatsDoMock filas={filas} hrefSemPagamento={`/contas-a-pagar?empresaId=${empresaId}`} />
}

/**
 * ⭐⭐ O RODAPÉ DISCRETO — as duas funções que saíram do topo, em uma linha miúda.
 *
 * ⚠️ **O PORQUÊ DO CORTE NÃO SE PERDEU, virou `title`** (o padrão do ⓘ da doutrina, 10/09):
 * *"a fila mostrando menos do que existe precisa DIZER por quê, senão o dono procura o card
 * que ele não vê"* — a frase continua alcançável, só parou de ocupar a dobra.
 */
export function RodapeDaTela({ empresaId, semPar, corte, aoTrocarCorte }: {
  empresaId: string
  semPar: SemParDTO
  /** AAAA-MM-DD ou null (sem corte). Ver `lib/conciliacao/corte-de-epoca.ts`. */
  corte?: string | null
  aoTrocarCorte?: (novo: string | null) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 pt-1 text-[11px]"
      style={{ color: MOCK.sub }}>
      {corte !== undefined ? (
        <span
          title={corte
            ? 'O que é anterior a esta data continua nas Movimentações e na busca — só não é oferecido na fila.'
            : 'Sem corte de época: a fila oferece todo o extrato importado.'}
        >
          {corte
            ? <>conciliando a partir de <b style={{ color: MOCK.ink }}>{corte.split('-').reverse().join('/')}</b></>
            : <>sem corte de época</>}
          {aoTrocarCorte && (
            <button
              onClick={() => {
                const v = window.prompt(
                  'Conciliar a partir de qual data? (AAAA-MM-DD · vazio = sem corte)',
                  corte ?? '',
                )
                if (v === null) return
                aoTrocarCorte(v.trim() === '' ? null : v.trim())
              }}
              className="ml-1.5 font-semibold hover:underline"
              style={{ color: MOCK.roxo }}
            >
              ⚙️ mudar
            </button>
          )}
        </span>
      ) : <span />}

      {semPar.total > 0 && (
        <Link
          href={`/contas-a-pagar?empresaId=${empresaId}`}
          className="inline-flex items-center gap-0.5 tabular-nums hover:underline"
          style={{ color: MOCK.roxo }}
        >
          <b>{semPar.total}</b> em aberto sem par · Ver no Contas a Pagar
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}
