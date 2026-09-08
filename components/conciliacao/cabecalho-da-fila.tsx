'use client'

// ⭐⭐ O CABEÇALHO DA CONCILIAÇÃO (07/09/2026) — refeito porque contradizia as abas.
//
// ⛔⛔ O QUE ELE DIZIA ANTES, e por que saiu:
//
//  1. *"69 prováveis duplicatas somando R$ 845.646,99"* enquanto a aba de
//     duplicatas dizia **0**. Duas respostas pra mesma pergunta na MESMA tela.
//     A régua de trás era um JOIN por **valor + ±5 dias sem olhar o nome** — a
//     família dos 84 fantasmas. Medida, ela chamava de duplicata coisas como
//     *"BIG GELO R$ 80,00"* × *"Mauricio Ramos Berro - Pix"* e *"chat gpt
//     R$ 100,00"* × *"COOPERATIVA DE PAIS E MESTRES"*. ⚠️ E o dinheiro estava
//     errado **sob a própria régua**: `COUNT(DISTINCT e.id)` com
//     `SUM(e.amount)` sobre as linhas do JOIN → R$ 845.646,99 no lugar de
//     R$ 444.746,99.
//
//  2. *"SALDO DO EXTRATO R$ 33.046,25 × SALDO NO SISTEMA −R$ 128.404,22"*.
//     Nenhum dos dois era saldo: o 1º era Σ(CREDIT−DEBIT) de TUDO que já entrou
//     por OFX (ignora saldo inicial e o que o banco declarou) e o 2º era a régua
//     da DRE realizada — com **325 linhas sem conta bancária** (R$ 61.812,00)
//     dentro dele, que não podem bater com extrato nenhum. A soma dos cards das
//     contas é −R$ 74.190,46, que não é nem um nem outro.
//
// ⭐ A REGRA DO DONO: *"o que dá pra derivar da MESMA fonte das abas, deriva; o
// que não tem definição honesta, sai — número sem régua em tela de dinheiro é
// pior que ausência."*
//
// Sobrou o que se defende: os vínculos (o mesmo `totais` das abas), a dupla
// contagem (a mesma lista, somada UMA vez cada) e a conferência de saldo por
// conta — `balance` (o número do card) contra `ledgerBal` (o que o banco
// declarou), com a data da declaração. Conta sem extrato importado fica de fora,
// nomeada.

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'

export interface ConferenciaContaDTO {
  id: string; nome: string; sistema: number; declarado: number
  declaradoEm: string | null; diferenca: number; bate: boolean
}
export interface SaldosDTO {
  contas: ConferenciaContaDTO[]
  semExtrato: { id: string; nome: string; sistema: number }[]
  batem: number
  naoBatem: number
}
export interface TotaisDTO {
  contas: number; comSugestao: number; transferencias: number; duplicatas: number
  duplaContagem: number; valorEmDuplaContagem: number
}

const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'

export function CabecalhoDaFila({ totais, saldos }: { totais: TotaisDTO; saldos: SaldosDTO }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border rounded-lg overflow-hidden">
        <Bloco
          valor={String(totais.comSugestao)}
          rotulo="vínculos esperando decisão"
          tom={totais.comSugestao > 0 ? 'atencao' : 'neutro'}
        />
        <Bloco
          valor={formatBRL(totais.valorEmDuplaContagem)}
          rotulo={`em dupla contagem · ${totais.duplaContagem} conta${totais.duplaContagem === 1 ? '' : 's'}`}
          tom={totais.duplaContagem > 0 ? 'ruim' : 'neutro'}
        />
        <Bloco
          valor={String(totais.contas - totais.comSugestao)}
          rotulo="contas em aberto sem par no extrato"
        />
        <Bloco
          valor={`${saldos.batem}/${saldos.contas.length}`}
          rotulo="contas com extrato batendo com o banco"
          tom={saldos.naoBatem > 0 ? 'atencao' : 'bom'}
        />
      </div>

      {/* ⛔ a conferência é POR CONTA — foi o agregado que produzia o número
          indefensável. Quem não bate aparece com o valor e a DATA da declaração. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground px-1">
        {saldos.contas.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 tabular-nums">
            {c.bate
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
            <b className="text-foreground font-medium">{c.nome}</b>
            {c.bate
              ? <>bate com o banco em {dia(c.declaradoEm)}</>
              : <>
                  sistema {formatBRL(c.sistema)} × banco declarou {formatBRL(c.declarado)} em{' '}
                  {dia(c.declaradoEm)} — <b className="text-foreground">{formatBRL(Math.abs(c.diferenca))} de diferença</b>
                </>}
          </span>
        ))}
        {saldos.semExtrato.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 tabular-nums opacity-70">
            <b className="text-foreground font-medium">{c.nome}</b>
            {/* ⚠️ nomeada de propósito: sem declaração do banco não há conferência,
                e dizer "bate" aqui seria inventar o outro lado. */}
            sem extrato importado — fora da conferência
          </span>
        ))}
      </div>
    </div>
  )
}

function Bloco({ valor, rotulo, tom = 'neutro' }: {
  valor: string; rotulo: string; tom?: 'neutro' | 'bom' | 'atencao' | 'ruim'
}) {
  const cor = tom === 'ruim' ? 'text-red-700 dark:text-red-400'
    : tom === 'atencao' ? 'text-amber-700 dark:text-amber-400'
      : tom === 'bom' ? 'text-emerald-700 dark:text-emerald-400' : ''
  return (
    <div className="bg-card px-3.5 py-2.5 flex flex-col gap-0.5">
      <span className={`text-xl font-semibold tabular-nums leading-tight ${cor}`}>{valor}</span>
      <span className="text-[11.5px] text-muted-foreground">{rotulo}</span>
    </div>
  )
}
