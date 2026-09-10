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

export function CabecalhoDaFila({ empresaId, filas, semPar }: {
  empresaId: string; filas: FilasDTO; semPar: SemParDTO
}) {
  return (
    <div>
      <StatsDoMock filas={filas} />

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
