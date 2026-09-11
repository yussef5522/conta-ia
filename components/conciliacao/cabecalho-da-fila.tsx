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

export function CabecalhoDaFila({ empresaId, filas, semPar, corte, aoTrocarCorte }: {
  empresaId: string; filas: FilasDTO; semPar: SemParDTO
  /** AAAA-MM-DD ou null (sem corte). Ver `lib/conciliacao/corte-de-epoca.ts`. */
  corte?: string | null
  aoTrocarCorte?: (novo: string | null) => void
}) {
  return (
    <div>
      <StatsDoMock filas={filas} />

      {/* ⭐⭐ O CORTE DE ÉPOCA, à vista (11/09/2026) — decisão do dono: *"comecei a usar a
          conciliação em setembro; agosto fica pra trás POR DECISÃO"*.
          ⛔ Tem que estar NA TELA, não escondido numa config: a fila mostrando menos do que
          existe precisa DIZER por quê, senão o dono procura o card que ele não vê. */}
      {corte !== undefined && (
        <p className="mb-[10px] text-[11.5px]" style={{ color: MOCK.sub }}>
          {corte ? (
            <>conciliando a partir de <b style={{ color: MOCK.ink }}>{corte.split('-').reverse().join('/')}</b>
              {' '}· o que é anterior continua nas Movimentações e na busca, só não é oferecido aqui</>
          ) : (
            <>sem corte de época — a fila oferece todo o extrato importado</>
          )}
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
              className="ml-1.5 font-medium hover:underline"
              style={{ color: MOCK.roxo }}
            >
              mudar
            </button>
          )}
        </p>
      )}

      {/* ⭐ UMA FRASE, e o resto mora no Contas a Pagar (ordem do dono): a quebra em três
          (não venceram · esperam extrato · já dava pra pagar) e o gesto do cofre saíram
          daqui. ⚠️ Elas continuam existindo — conta em aberto sem par é o estado NORMAL
          de quem ainda não pagou; o que não podia é ocupar a dobra do celular acima do
          trabalho. */}
      {semPar.total > 0 && (
        <p className="mb-[18px] text-[12px] tabular-nums" style={{ color: MOCK.sub }}>
          <b style={{ color: MOCK.ink }}>{semPar.total}</b> em aberto sem par ·{' '}
          <Link
            href={`/contas-a-pagar?empresaId=${empresaId}`}
            className="inline-flex items-center gap-0.5 font-medium hover:underline"
            style={{ color: MOCK.roxo }}
          >
            Ver no Contas a Pagar <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      )}
    </div>
  )
}
